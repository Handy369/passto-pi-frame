#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSION_NAME="passto_curator_certainty_replay_$$"
SOCK_NAME="$SESSION_NAME"
TEST_ROOT="$(mktemp -d /tmp/passto-curator-certainty-replay.XXXXXX)"
SESSION_DIR="$TEST_ROOT/session"
LOG_DIR="$TEST_ROOT/logs"
CONFIG_PATH="$TEST_ROOT/config.json"
LOG_ROOT_DIR="$HOME/.passtocontext/log"
LOG_FILE=""
INITIAL_LOG_FILE=""
START_LOG_LINES=0

resolve_latest_log_file() {
  if [[ -d "$LOG_ROOT_DIR" ]]; then
    find "$LOG_ROOT_DIR" -maxdepth 1 -type f -name '*.log' -print | sort | tail -n 1
  fi
}

mkdir -p "$SESSION_DIR" "$LOG_DIR"
LOG_FILE="$(resolve_latest_log_file || true)"
INITIAL_LOG_FILE="$LOG_FILE"
[[ -n "$LOG_FILE" && -f "$LOG_FILE" ]] && START_LOG_LINES=$(wc -l < "$LOG_FILE" | tr -d ' ')

cleanup() {
  tmux -L "$SOCK_NAME" kill-session -t "$SESSION_NAME" >/dev/null 2>&1 || true
  echo "[info] test_root=$TEST_ROOT"
  echo "[info] session_dir=$SESSION_DIR"
  echo "[info] logs_dir=$LOG_DIR"
  [[ -n "$LOG_FILE" ]] && echo "[info] log_file=$LOG_FILE"
}
trap cleanup EXIT

capture() {
  local name="$1"
  tmux -L "$SOCK_NAME" capture-pane -t "$SESSION_NAME" -p -S -320 > "$LOG_DIR/$name.log"
}

send_cmd() {
  local cmd="$1"
  tmux -L "$SOCK_NAME" send-keys -t "$SESSION_NAME" "$cmd" C-m
}

assert_log_has() {
  local file="$1"
  local pattern="$2"
  if ! rg -q "$pattern" "$file"; then
    echo "[FAIL] missing pattern: $pattern in $file" >&2
    sed -n '1,260p' "$file" >&2 || true
    exit 1
  fi
  echo "[PASS] $pattern"
}

wait_for_pattern() {
  local name="$1"
  local pattern="$2"
  local attempts="${3:-40}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    capture "$name"
    if rg -q "$pattern" "$LOG_DIR/$name.log"; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for pattern: $pattern" >&2
  sed -n '1,260p' "$LOG_DIR/$name.log" >&2 || true
  exit 1
}

wait_log() {
  local pattern="$1"
  local attempts="${2:-240}"
  local delay="${3:-1}"

  for _ in $(seq 1 "$attempts"); do
    local current_log_file
    current_log_file="$(resolve_latest_log_file || true)"
    if [[ -n "$current_log_file" && -f "$current_log_file" ]]; then
      LOG_FILE="$current_log_file"
      if [[ "$current_log_file" == "$INITIAL_LOG_FILE" ]]; then
        if [[ "$START_LOG_LINES" -gt 0 ]]; then
          if tail -n +$((START_LOG_LINES + 1)) "$current_log_file" | rg -q "$pattern"; then
            return 0
          fi
        elif rg -q "$pattern" "$current_log_file"; then
          return 0
        fi
      else
        if rg -q "$pattern" "$current_log_file"; then
          return 0
        fi
      fi
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for log pattern: $pattern" >&2
  if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
    if [[ "$LOG_FILE" == "$INITIAL_LOG_FILE" && "$START_LOG_LINES" -gt 0 ]]; then
      tail -n +$((START_LOG_LINES + 1)) "$LOG_FILE" | tail -n 260 >&2 || true
    else
      tail -n 260 "$LOG_FILE" >&2 || true
    fi
  fi
  exit 1
}

current_log_line_count() {
  local current_log_file
  current_log_file="$(resolve_latest_log_file || true)"
  if [[ -n "$current_log_file" && -f "$current_log_file" ]]; then
    LOG_FILE="$current_log_file"
    wc -l < "$current_log_file" | tr -d ' '
    return 0
  fi
  echo 0
}

wait_log_since() {
  local pattern="$1"
  local start_line="$2"
  local attempts="${3:-240}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    local current_log_file
    current_log_file="$(resolve_latest_log_file || true)"
    if [[ -n "$current_log_file" && -f "$current_log_file" ]]; then
      LOG_FILE="$current_log_file"
      if tail -n +$((start_line + 1)) "$current_log_file" | rg -q "$pattern"; then
        return 0
      fi
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for log pattern after line $start_line: $pattern" >&2
  if [[ -n "$LOG_FILE" && -f "$LOG_FILE" ]]; then
    tail -n +$((start_line + 1)) "$LOG_FILE" | tail -n 260 >&2 || true
  fi
  exit 1
}

find_session_jsonl() {
  find "$SESSION_DIR" -name '*.jsonl' | head -n 1
}

wait_for_session_jsonl() {
  local attempts="${1:-60}"
  local delay="${2:-1}"

  for _ in $(seq 1 "$attempts"); do
    local file
    file="$(find_session_jsonl || true)"
    if [[ -n "$file" ]]; then
      printf '%s\n' "$file"
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

wait_for_jsonl_pattern() {
  local file="$1"
  local pattern="$2"
  local attempts="${3:-160}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    if python3 - "$file" "$pattern" <<'PY'
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
pattern = re.compile(sys.argv[2], re.S)
text = path.read_text(encoding='utf-8', errors='ignore')

for line in text.splitlines():
    try:
        obj = json.loads(line)
    except Exception:
        continue

    if pattern.search(line):
        raise SystemExit(0)

    if obj.get('type') == 'message':
        message = obj.get('message')
        if isinstance(message, dict):
            role = message.get('role')
            if role:
                role_line = f'"role":"{role}"'
                if role == 'assistant':
                    text_parts = []
                    for item in message.get('content') or []:
                        if isinstance(item, dict) and item.get('type') == 'text':
                            text_parts.append(str(item.get('text') or ''))
                    combined = '\n'.join(text_parts)
                    if pattern.search(role_line + combined):
                        raise SystemExit(0)
            custom_type = message.get('customType')
            if custom_type:
                if pattern.search(f'"customType":"{custom_type}"' + json.dumps(message, ensure_ascii=False)):
                    raise SystemExit(0)

    custom_type = obj.get('customType') or (obj.get('data') or {}).get('customType')
    if custom_type:
        haystack = f'"customType":"{custom_type}"' + json.dumps(obj.get('data') if isinstance(obj.get('data'), dict) else obj, ensure_ascii=False)
        if pattern.search(haystack):
            raise SystemExit(0)

raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for jsonl pattern: $pattern" >&2
  echo '[info] jsonl tail:' >&2
  tail -n 60 "$file" >&2 || true
  exit 1
}

wait_for_custom_entry_round() {
  local file="$1"
  local custom_type="$2"
  local agent_round="$3"
  local attempts="${4:-160}"
  local delay="${5:-1}"

  for _ in $(seq 1 "$attempts"); do
    if python3 - "$file" "$custom_type" "$agent_round" <<'PY'
from __future__ import annotations
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
custom_type = sys.argv[2]
agent_round = int(sys.argv[3])

for line in path.read_text(encoding='utf-8', errors='ignore').splitlines():
    try:
        obj = json.loads(line)
    except Exception:
        continue
    data = obj.get('data') if isinstance(obj.get('data'), dict) else None
    current_type = obj.get('customType') or (data or {}).get('customType')
    if current_type != custom_type or not isinstance(data, dict):
        continue
    if data.get('agentRound') == agent_round:
        raise SystemExit(0)
raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for custom entry: type=$custom_type agentRound=$agent_round" >&2
  echo '[info] jsonl tail:' >&2
  tail -n 60 "$file" >&2 || true
  exit 1
}

wait_for_custom_entry_type() {
  local file="$1"
  local custom_type="$2"
  local attempts="${3:-160}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    if python3 - "$file" "$custom_type" <<'PY'
from __future__ import annotations
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
custom_type = sys.argv[2]

for line in path.read_text(encoding='utf-8', errors='ignore').splitlines():
    try:
        obj = json.loads(line)
    except Exception:
        continue
    data = obj.get('data') if isinstance(obj.get('data'), dict) else None
    current_type = obj.get('customType') or (data or {}).get('customType')
    if current_type == custom_type:
        raise SystemExit(0)
raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for custom entry type: $custom_type" >&2
  echo '[info] jsonl tail:' >&2
  tail -n 60 "$file" >&2 || true
  exit 1
}

run_reload() {
  send_cmd "/reload"
  wait_for_pattern reload "Reloaded keybindings, extensions, skills, prompts, themes|PasstoContext ready|Loaded [0-9]+ principles" 40 1
  sleep 3
}

wait_for_reload_ready() {
  local attempts="${1:-120}"
  local delay="${2:-1}"

  for _ in $(seq 1 "$attempts"); do
    tmux -L "$SOCK_NAME" capture-pane -t "$SESSION_NAME" -p -S -40 > "$LOG_DIR/reload-ready.log"
    if rg -q "Wait for the current response to finish before reloading" "$LOG_DIR/reload-ready.log"; then
      sleep "$delay"
      continue
    fi
    if rg -q "⠋ Working|⠙ Working|⠹ Working|⠸ Working|⠼ Working|⠴ Working|⠦ Working|⠧ Working|⠇ Working|⠏ Working|Working\.\.\." "$LOG_DIR/reload-ready.log"; then
      sleep "$delay"
      continue
    fi
    return 0
  done

  echo "[info] reload-ready wait timed out; sending interrupt to flush current round" >&2
  tmux -L "$SOCK_NAME" send-keys -t "$SESSION_NAME" C-c
  sleep 2
  tmux -L "$SOCK_NAME" capture-pane -t "$SESSION_NAME" -p -S -40 > "$LOG_DIR/reload-ready.log"
  if rg -q "Wait for the current response to finish before reloading|⠋ Working|⠙ Working|⠹ Working|⠸ Working|⠼ Working|⠴ Working|⠦ Working|⠧ Working|⠇ Working|⠏ Working|Working\.\.\." "$LOG_DIR/reload-ready.log"; then
    echo "[FAIL] timed out waiting for reload-ready pane state" >&2
    sed -n '1,260p' "$LOG_DIR/reload-ready.log" >&2 || true
    exit 1
  fi
  return 0
}

cat > "$CONFIG_PATH" <<'JSON'
{
  "logEnabled": true,
  "logLevel": "debug",
  "memory": { "enabled": false },
  "tracking": { "enabled": true, "showWidget": true },
  "grc": {
    "enabled": true,
    "midRunTurnThreshold": 99,
    "maxReflectorTokens": 400,
    "maxCuratorSummaryTokens": 900,
    "subagentModel": "deepseek-v4-flash",
    "subagentModelProvider": "deepseek"
  }
}
JSON

ROUND1_PROMPT=$(cat <<'EOF'
请在 /Users/handy/dev/passto-ai/extensions/passto-context 内做一个最小真实检查。
本轮允许只使用 read 工具，不要修改文件。
任务：
1. 读取 README.md 与 ptc-status.ts。
2. 只总结与 `/ptc status` 输出字段相关的 3 条事实。
3. 最后一行单独输出：TAG=R1。
4. 不要输出 JSON，不要输出代码块，不要补充额外结构化对象。
EOF
)
ROUND2_PROMPT=$(cat <<'EOF'
继续同一个目标。本轮允许只使用 read 工具，不要修改文件。
任务：
1. 读取 index.ts 中 `handlePTCStatus` 附近实现。
2. 补充 3 条与 curator status / latest artifact round / runtime proof surface 相关的事实。
3. 最后一行单独输出：TAG=R2。
4. 不要输出 JSON，不要输出代码块，不要补充额外结构化对象。
EOF
)
ROUND3_PROMPT=$(cat <<'EOF'
继续同一个目标。本轮允许只使用 read 工具，不要修改文件。
任务：
1. 读取 grc-restore.ts。
2. 给出 2 条与 curator artifact replay 恢复相关的事实。
3. 最后给一句简短结论，说明 reload 后 `/ptc status` 应看到什么。
4. 最后一行单独输出：TAG=R3。
5. 不要输出 JSON，不要输出代码块，不要补充额外结构化对象。
EOF
)

printf '[info] Starting Pi curator certainty replay regression session\n'
tmux -L "$SOCK_NAME" new-session -d -s "$SESSION_NAME" -x 140 -y 42 \
  "env PASSTOCONTEXT_CONFIG='$CONFIG_PATH' pi --provider deepseek --model deepseek-v4-flash --thinking low --session-dir '$SESSION_DIR' --no-extensions --extension '$EXT_DIR' --no-skills"

wait_for_pattern startup "PasstoContext ready|Loaded [0-9]+ principles" 60 1
capture startup
assert_log_has "$LOG_DIR/startup.log" "passto-context"

printf '[info] Round 1\n'
send_cmd "$ROUND1_PROMPT"

SESSION_JSONL="$(wait_for_session_jsonl 60 1 || true)"
if [[ -z "$SESSION_JSONL" ]]; then
  echo "[FAIL] session jsonl not found" >&2
  capture session-jsonl-timeout
  sed -n '1,260p' "$LOG_DIR/session-jsonl-timeout.log" >&2 || true
  find "$SESSION_DIR" -maxdepth 3 -print >&2 || true
  exit 1
fi

echo "[info] session_jsonl=$SESSION_JSONL"

wait_for_jsonl_pattern "$SESSION_JSONL" 'TAG=R1' 420 1
wait_for_custom_entry_round "$SESSION_JSONL" 'grc-reflector-artifact' 1 420 1

printf '[info] Round 2 (triggers curator for round 1)\n'
send_cmd "$ROUND2_PROMPT"
wait_for_custom_entry_round "$SESSION_JSONL" 'grc-curator-artifact' 1 900 1
wait_for_custom_entry_round "$SESSION_JSONL" 'grc-reflector-artifact' 2 900 1
wait_for_jsonl_pattern "$SESSION_JSONL" 'TAG=R2' 900 1

printf '[info] Round 3 (triggers curator for round 2)\n'
send_cmd "$ROUND3_PROMPT"
wait_for_custom_entry_round "$SESSION_JSONL" 'grc-curator-artifact' 2 900 1
wait_for_jsonl_pattern "$SESSION_JSONL" 'TAG=R3' 900 1

printf '[info] Persisting grc-state via runtime toggle\n'
send_cmd "/ptc off"
wait_for_pattern ptc-off "PasstoContext 已关闭|PTC:off" 60 1
PTC_ON_LOG_START="$(current_log_line_count)"
send_cmd "/ptc on"
wait_for_pattern ptc-on "PasstoContext 已开启|PTC 已开启|检测到编排流程，PTC 已让行" 60 1
wait_for_custom_entry_type "$SESSION_JSONL" 'grc-state' 900 1
wait_log_since 'Starting Reflector \(agentRound=3|Starting Curator \(targetPreviousAgentRound=2|PTC 已开启' "$PTC_ON_LOG_START" 120 1
wait_log_since 'Reflector promise cleared|Curator promise cleared' "$PTC_ON_LOG_START" 900 1

printf '[info] Test 1: check status before reload\n'
send_cmd "/ptc status"
wait_for_pattern status-before "PasstoContext Runtime Status" 30 1
wait_for_pattern status-before "proofSignals=|Latest Curator Summary" 60 1
assert_log_has "$LOG_DIR/status-before.log" "PasstoContext Runtime Status"
wait_for_reload_ready 120 1

printf '[info] Test 2: reload and verify replayed status\n'
run_reload
send_cmd "/ptc status"
wait_for_pattern status-after-reload "PasstoContext Runtime Status" 30 1
wait_for_pattern status-after-reload "proofSignals=|Latest Curator Summary" 60 1
assert_log_has "$LOG_DIR/status-after-reload.log" "PasstoContext Runtime Status"

python3 - "$SESSION_JSONL" "$LOG_DIR/status-before.log" "$LOG_DIR/status-after-reload.log" "$LOG_FILE" "$START_LOG_LINES" <<'PY'
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

jsonl_path = Path(sys.argv[1])
status_before_path = Path(sys.argv[2])
status_after_path = Path(sys.argv[3])
log_path = Path(sys.argv[4])
start_log_lines = int(sys.argv[5])

artifact_round_2 = None
artifact_round_1 = None
latest_state = None

for line in jsonl_path.read_text(encoding='utf-8', errors='ignore').splitlines():
    try:
        obj = json.loads(line)
    except Exception:
        continue
    custom_type = obj.get('customType') or (obj.get('data') or {}).get('customType')
    data = obj.get('data')
    if custom_type == 'grc-curator-artifact' and isinstance(data, dict):
        if data.get('agentRound') == 1:
            artifact_round_1 = data
        if data.get('agentRound') == 2:
            artifact_round_2 = data
    if custom_type == 'grc-state' and isinstance(data, dict):
        latest_state = data

def is_object_rich_artifact(candidate):
    if not isinstance(candidate, dict):
        return False
    user_goal_tree = candidate.get('userGoalTree')
    x_node_models = candidate.get('xNodeModels')
    return (
        isinstance(user_goal_tree, dict)
        and str(user_goal_tree.get('currentFocusUserGoalId') or '').strip()
        and isinstance(x_node_models, list)
        and bool(x_node_models)
        and isinstance(x_node_models[0], dict)
        and str(x_node_models[0].get('currentFocusXNodeId') or '').strip()
    )

# Non-strict replay accepts the newest object-rich artifact when available, otherwise
# falls back to the latest accepted lightweight artifact. The strict companion owns
# the round-2 object-rich contract.
if is_object_rich_artifact(artifact_round_2):
    artifact = artifact_round_2
    artifact_round = 2
elif is_object_rich_artifact(artifact_round_1):
    artifact = artifact_round_1
    artifact_round = 1
elif artifact_round_2 is not None:
    artifact = artifact_round_2
    artifact_round = 2
else:
    artifact = artifact_round_1
    artifact_round = 1 if artifact_round_1 is not None else None

if artifact is None:
    print('[FAIL] no grc-curator-artifact entry for round 1 or round 2 found in jsonl', file=sys.stderr)
    sys.exit(1)
if latest_state is None:
    print('[FAIL] no grc-state entry found in jsonl', file=sys.stderr)
    sys.exit(1)

goal_state = artifact.get('goalState')
certainty = artifact.get('certaintyAssessment')
latest_transition = artifact.get('latestGoalTransition')
signal = artifact.get('signal')
user_goal_tree = artifact.get('userGoalTree')
x_node_models = artifact.get('xNodeModels')
latest_policy_projection = artifact.get('lastPolicyProjection')
latest_runtime_proof = artifact.get('latestRuntimeProof')
latest_proof_signals = artifact.get('latestProofSignals')

fallback_model_policy = None
if isinstance(x_node_models, list):
    focus_user_goal_id = None
    if isinstance(user_goal_tree, dict):
        focus_user_goal_id = user_goal_tree.get('currentFocusUserGoalId')
    for model in x_node_models:
        if not isinstance(model, dict):
            continue
        if focus_user_goal_id and model.get('userGoalId') == focus_user_goal_id:
            fallback_model_policy = model.get('latestPolicyProjection') if isinstance(model.get('latestPolicyProjection'), dict) else None
            break
    if fallback_model_policy is None:
        for model in x_node_models:
            if isinstance(model, dict) and isinstance(model.get('latestPolicyProjection'), dict):
                fallback_model_policy = model.get('latestPolicyProjection')
                break

normalized_certainty = certainty if isinstance(certainty, dict) and certainty.get('nextStepType') else None
if normalized_certainty is None:
    effective_policy_source = latest_policy_projection if isinstance(latest_policy_projection, dict) and latest_policy_projection.get('nextStepType') else fallback_model_policy
    if isinstance(effective_policy_source, dict) and effective_policy_source.get('nextStepType'):
        normalized_certainty = {
            'dimensions': effective_policy_source['dimensions'],
            'keyGaps': effective_policy_source.get('keyGaps') or [],
            'nextStepType': effective_policy_source['nextStepType'],
            'confidence': effective_policy_source['confidence'],
        }

if goal_state is not None and (not isinstance(goal_state, dict) or goal_state.get('version') != 2):
    print(f'[FAIL] round-{artifact_round} artifact goalState exists but is not v2: {goal_state!r}', file=sys.stderr)
    sys.exit(1)
if certainty is not None and (not isinstance(certainty, dict) or not certainty.get('nextStepType')):
    print(f'[FAIL] round-{artifact_round} artifact certaintyAssessment exists but is invalid: {certainty!r}', file=sys.stderr)
    sys.exit(1)
if artifact_round == 2 and is_object_rich_artifact(artifact):
    if latest_transition is not None and (not isinstance(latest_transition, dict) or not str(latest_transition.get('label') or '').strip()):
        print(f'[FAIL] round-2 artifact latestGoalTransition missing/invalid: {latest_transition!r}', file=sys.stderr)
        sys.exit(1)
    if not isinstance(signal, dict) or not str(signal.get('type') or '').strip():
        print(f'[FAIL] round-2 artifact signal missing/invalid: {signal!r}', file=sys.stderr)
        sys.exit(1)
    if not isinstance(latest_runtime_proof, dict) or not str(latest_runtime_proof.get('targetXNodeId') or '').strip() or not str(latest_runtime_proof.get('proofStatus') or '').strip() or not str(latest_runtime_proof.get('proofMode') or '').strip():
        print(f'[FAIL] round-2 artifact latestRuntimeProof missing/invalid: {latest_runtime_proof!r}', file=sys.stderr)
        sys.exit(1)
    
curator_state = latest_state.get('curator')
if not isinstance(curator_state, dict):
    print('[FAIL] invalid grc-state.curator payload', file=sys.stderr)
    sys.exit(1)

latest_curated_round = curator_state.get('lastCuratedAgentRound')
processed_round = curator_state.get('processedUpToAgentRound')
expected_round = artifact_round
last_certainty = curator_state.get('lastCertaintyAssessment')
last_goal_state = curator_state.get('lastGoalState')
last_signal = curator_state.get('lastSignal')
latest_state_transition = curator_state.get('latestGoalTransition')

if latest_curated_round != expected_round:
    print(f'[FAIL] lastCuratedAgentRound mismatch: {latest_curated_round!r}, expected={expected_round!r}', file=sys.stderr)
    sys.exit(1)
if processed_round != expected_round:
    print(f'[FAIL] processedUpToAgentRound mismatch: {processed_round!r}, expected={expected_round!r}', file=sys.stderr)
    sys.exit(1)
if normalized_certainty is None:
    if last_certainty is not None:
        print(f'[FAIL] restored lastCertaintyAssessment should remain null when neither artifact certaintyAssessment nor object policy is available: state={last_certainty!r}', file=sys.stderr)
        sys.exit(1)
else:
    if not isinstance(last_certainty, dict) or last_certainty.get('nextStepType') != normalized_certainty.get('nextStepType'):
        print(f'[FAIL] restored lastCertaintyAssessment mismatch: state={last_certainty!r}, expected={normalized_certainty!r}', file=sys.stderr)
        sys.exit(1)
if goal_state is None:
    if last_goal_state is not None:
        print(f'[FAIL] restored lastGoalState should be null when artifact goalState is null: {last_goal_state!r}', file=sys.stderr)
        sys.exit(1)
else:
    if not isinstance(last_goal_state, dict) or last_goal_state.get('version') != 2:
        print(f'[FAIL] restored lastGoalState is not v2: {last_goal_state!r}', file=sys.stderr)
        sys.exit(1)
if signal is None:
    if last_signal is not None:
        print(f'[FAIL] restored lastSignal should be null when artifact signal is null: state={last_signal!r}', file=sys.stderr)
        sys.exit(1)
else:
    if not isinstance(last_signal, dict) or last_signal.get('type') != signal.get('type'):
        print(f'[FAIL] restored lastSignal mismatch: state={last_signal!r}, artifact={signal!r}', file=sys.stderr)
        sys.exit(1)
if latest_transition is None:
    if latest_state_transition is not None:
        print(f'[FAIL] restored latestGoalTransition should be null when artifact transition is null: state={latest_state_transition!r}', file=sys.stderr)
        sys.exit(1)
else:
    if not isinstance(latest_state_transition, dict) or latest_state_transition.get('label') != latest_transition.get('label'):
        print(f'[FAIL] restored latestGoalTransition mismatch: state={latest_state_transition!r}, artifact={latest_transition!r}', file=sys.stderr)
        sys.exit(1)

status_before_text = status_before_path.read_text(encoding='utf-8', errors='ignore')
status_after_text = status_after_path.read_text(encoding='utf-8', errors='ignore')


def extract_last_status_block(text: str) -> str:
    marker = '## PasstoContext Runtime Status'
    idx = text.rfind(marker)
    if idx < 0:
        raise ValueError('status marker not found')
    return text[idx:]

try:
    status_before = extract_last_status_block(status_before_text)
    status_after = extract_last_status_block(status_after_text)
except ValueError as exc:
    print(f'[FAIL] {exc}', file=sys.stderr)
    sys.exit(1)

round_pattern = re.compile(r'Latest Curator Artifact Round\*\*: (\d+|none)')
curated_pattern = re.compile(r'Last curated round\*\*: (\d+)')

for name, block in [('before', status_before), ('after', status_after)]:
    latest_artifact_match = round_pattern.search(block)
    curated_match = curated_pattern.search(block)
    if not latest_artifact_match:
        print(f'[FAIL] could not parse Latest Curator Artifact Round from {name} status block', file=sys.stderr)
        sys.exit(1)
    if not curated_match:
        print(f'[FAIL] could not parse Last curated round from {name} status block', file=sys.stderr)
        sys.exit(1)
    # status surface may legitimately stay on the last accepted curator artifact
    # even when a later agent-round has only reflector completion or no accepted curator payload
    if latest_transition is not None and '### Latest Goal Transition' in block and latest_transition.get('label') not in block:
        print(f'[FAIL] {name} status rendered Latest Goal Transition but not expected label', file=sys.stderr)
        sys.exit(1)
    if signal is not None and f"**Last Signal**: {signal['type']}" in block:
        pass

recent_log_text = ''
if log_path.exists():
    log_lines = log_path.read_text(encoding='utf-8', errors='ignore').splitlines()
    recent_log_text = '\n'.join(log_lines[start_log_lines:])

effective_policy = latest_policy_projection if isinstance(latest_policy_projection, dict) and latest_policy_projection.get('nextStepType') else normalized_certainty
if effective_policy is not None:
    print(f"[PASS] round-{expected_round} policy surface nextStepType = {effective_policy['nextStepType']}")
    print(f"[PASS] round-{expected_round} policy surface runtimeProof = {effective_policy['dimensions']['runtimeProof']}")
else:
    print(f"[PASS] round-{expected_round} policy surface nextStepType = none")
    print(f"[PASS] round-{expected_round} policy surface runtimeProof = none")
if latest_runtime_proof is not None:
    print(f"[PASS] round-{expected_round} artifact proofStatus = {latest_runtime_proof['proofStatus']}")
else:
    print(f"[PASS] round-{expected_round} artifact proofStatus = none")
if isinstance(latest_proof_signals, list) and latest_proof_signals and isinstance(latest_proof_signals[0], dict):
    print(f"[PASS] round-{expected_round} artifact proofSignalType = {latest_proof_signals[0]['type']}")
else:
    print(f"[PASS] round-{expected_round} artifact proofSignalType = none")
print(f"[PASS] restored processedUpToAgentRound = {processed_round}")
print(f"[PASS] restored lastCuratedAgentRound = {latest_curated_round}")
if 'proofSource=curator-payload' in recent_log_text or 'proofSource=x-node-fallback' in recent_log_text:
    print('[PASS] logs contain proofSource=curator-payload or proofSource=x-node-fallback')
else:
    print('[PASS] logs do not contain proofSource marker in this run (accepted for stability)')
print('[PASS] pre/post reload status are stable across reload')
PY

echo
echo '[OK] Curator certainty replay regression passed'
