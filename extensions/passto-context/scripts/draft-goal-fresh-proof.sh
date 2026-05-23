#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSION_NAME="passto_draft_goal_proof_$$"
SOCK_NAME="$SESSION_NAME"
TEST_ROOT="$(mktemp -d /tmp/passto-draft-goal-proof.XXXXXX)"
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
  tmux -L "$SOCK_NAME" capture-pane -t "$SESSION_NAME" -p -S -420 > "$LOG_DIR/$name.log"
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
  local attempts="${3:-60}"
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

find_session_jsonl() {
  find "$SESSION_DIR" -name '*.jsonl' | head -n 1
}

wait_for_session_jsonl() {
  local attempts="${1:-120}"
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

wait_for_assistant_jsonl_text() {
  local session_jsonl="$1"
  local pattern="$2"
  local attempts="${3:-120}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    if python3 - "$session_jsonl" "$pattern" <<'PY'
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

jsonl_path = Path(sys.argv[1])
pattern = sys.argv[2]
text_re = re.compile(pattern, re.S)
for line in jsonl_path.read_text(encoding='utf-8', errors='ignore').splitlines():
    try:
        obj = json.loads(line)
    except Exception:
        continue
    msg = obj.get('message')
    if not isinstance(msg, dict) or msg.get('role') != 'assistant':
        continue
    content = msg.get('content')
    if not isinstance(content, list):
        continue
    text = '\n'.join(block.get('text', '') for block in content if isinstance(block, dict) and isinstance(block.get('text'), str)).strip()
    if text and text_re.search(text):
        raise SystemExit(0)
raise SystemExit(1)
PY
    then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for assistant jsonl text pattern: $pattern" >&2
  python3 - "$session_jsonl" <<'PY' >&2
from __future__ import annotations
import json
import sys
from pathlib import Path
p = Path(sys.argv[1])
assistant = []
for line in p.read_text(encoding='utf-8', errors='ignore').splitlines():
    try:
        obj = json.loads(line)
    except Exception:
        continue
    msg = obj.get('message')
    if isinstance(msg, dict) and msg.get('role') == 'assistant':
        content = msg.get('content')
        if isinstance(content, list):
            text = '\n'.join(block.get('text', '') for block in content if isinstance(block, dict) and isinstance(block.get('text'), str)).strip()
            if text:
                assistant.append(text)
for item in assistant[-6:]:
    print('--- assistant ---')
    print(item)
PY
  exit 1
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
    "keepRecentAgentRounds": 3,
    "draftGoalEnabled": true,
    "subagentModel": "deepseek-v4-flash",
    "subagentModelProvider": "deepseek"
  }
}
JSON

ROUND1_PROMPT=$(cat <<'EOF'
不要调用任何工具，也不要解释。
你当前已有一个主目标：维护现有主目标不变。
现在我临时追加一个新的独立目标：补写 draft goal runtime 的 fresh real session proof。
如果你判断这是“新的独立目标，且当前 GoalState 中无匹配 active goal”，请严格按系统协议，在回复最后附加唯一一个 JSON 代码块，里面只输出 draftGoalOp，action=create。
要求：
- reply 正文只写两行：
ACK-DRAFT
R1
- JSON 中 goal.assertion 必须包含：fresh real session proof
- goal.kind=goal
- parentGoalId=null
- atomicity=undecided
- phase=plan
EOF
)

ROUND2_PROMPT=$(cat <<'EOF'
继续，不要调用工具，不要输出新的 JSON 代码块。
只回复两行：
ACK-NEXT
R2
EOF
)

echo "[info] Starting Pi draft-goal proof session"
tmux -L "$SOCK_NAME" new-session -d -s "$SESSION_NAME" -x 160 -y 48 \
  "env PASSTOCONTEXT_CONFIG='$CONFIG_PATH' pi --provider deepseek --model deepseek-v4-flash --thinking low --session-dir '$SESSION_DIR' --no-extensions --extension '$EXT_DIR' --no-skills"

wait_for_pattern startup "PasstoContext ready|Loaded [0-9]+ principles" 90 1
capture startup
assert_log_has "$LOG_DIR/startup.log" "passto-context"
sleep 2

echo "[info] Round 1: ask model to emit draftGoalOp"
send_cmd "$ROUND1_PROMPT"

SESSION_JSONL="$(wait_for_session_jsonl 120 1 || true)"
if [[ -z "$SESSION_JSONL" ]]; then
  wait_log 'agent_end received \(completedAgentRounds=1' 300 1
  SESSION_JSONL="$(find_session_jsonl || true)"
fi
if [[ -z "$SESSION_JSONL" ]]; then
  echo "[FAIL] session jsonl not found" >&2
  capture session-jsonl-timeout
  sed -n '1,260p' "$LOG_DIR/session-jsonl-timeout.log" >&2 || true
  find "$SESSION_DIR" -maxdepth 3 -print >&2 || true
  exit 1
fi

echo "[info] session_jsonl=$SESSION_JSONL"

wait_log 'agent_end received \(completedAgentRounds=1' 300 1

capture round1
if ! rg -q 'ACK-DRAFT' "$LOG_DIR/round1.log"; then
  echo "[FAIL] round1 pane does not contain ACK-DRAFT" >&2
  sed -n '1,260p' "$LOG_DIR/round1.log" >&2 || true
  exit 1
fi
if ! rg -q 'draftGoalOp' "$LOG_DIR/round1.log"; then
  echo "[FAIL] round1 pane does not show draftGoalOp json block" >&2
  sed -n '1,260p' "$LOG_DIR/round1.log" >&2 || true
  exit 1
fi

echo "[info] Round 2: trigger curator persistence for round 1"
send_cmd "$ROUND2_PROMPT"
wait_log 'Starting Curator \(targetPreviousAgentRound=1' 420 1
wait_log 'Applied draftGoalOp runtime overlay \(agentRound=1, focus=' 300 1
wait_log 'Curator finished .*processedUpToAgentRound=1' 600 1

capture round2-after-curator
if ! rg -q 'ACK-NEXT' "$LOG_DIR/round2-after-curator.log"; then
  echo "[FAIL] round2 pane does not contain ACK-NEXT" >&2
  sed -n '1,260p' "$LOG_DIR/round2-after-curator.log" >&2 || true
  exit 1
fi

echo "[info] Round 3: trigger before_agent_start effective-with-draft injection"
send_cmd "/ptc status"
wait_for_pattern status "PasstoContext Runtime Status" 30 1
send_cmd "不要调用任何工具。根据你当前拿到的 proof / signal 注入上下文，只回复四行：ACK-STATUS-R3、PROOF-STATUS=<值>、NEXT-STEP=<值>、PROOF-SIGNAL=<值>"
wait_for_assistant_jsonl_text "$SESSION_JSONL" 'ACK-STATUS-R3[\s\S]*PROOF-STATUS=.*NEXT-STEP=.*PROOF-SIGNAL=' 180 1
wait_log 'Curator finished .*processedUpToAgentRound=2' 600 1

send_cmd "/quit"
sleep 3

python3 - "$SESSION_JSONL" "$LOG_ROOT_DIR" "$INITIAL_LOG_FILE" "$START_LOG_LINES" <<'PY'
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

jsonl_path = Path(sys.argv[1])
log_root_dir = Path(sys.argv[2])
initial_log_file = Path(sys.argv[3]) if sys.argv[3] else None
start_log_lines = int(sys.argv[4])

entries = []
for line in jsonl_path.read_text(encoding='utf-8', errors='ignore').splitlines():
    try:
        entries.append(json.loads(line))
    except Exception:
        continue

assistant_texts = []
curator_artifacts = []
grc_states = []
for obj in entries:
    msg = obj.get('message')
    if isinstance(msg, dict) and msg.get('role') == 'assistant':
        content = msg.get('content')
        if isinstance(content, list):
            text = '\n'.join(block.get('text', '') for block in content if isinstance(block, dict) and isinstance(block.get('text'), str)).strip()
            if text:
                assistant_texts.append(text)
    if obj.get('customType') == 'grc-curator-artifact' and isinstance(obj.get('data'), dict):
        curator_artifacts.append(obj['data'])
    if obj.get('customType') == 'grc-state' and isinstance(obj.get('data'), dict):
        grc_states.append(obj['data'])

if not assistant_texts:
    print('[FAIL] no assistant messages found in session jsonl', file=sys.stderr)
    sys.exit(1)

assistant_with_draft = None
for text in assistant_texts:
    if 'draftGoalOp' in text and 'fresh real session proof' in text:
        assistant_with_draft = text
        break
if assistant_with_draft is None:
    print('[FAIL] no assistant message containing draftGoalOp + fresh real session proof found', file=sys.stderr)
    sys.exit(1)

assistant_with_proof_surface = None
for text in assistant_texts:
    if 'ACK-STATUS-R3' in text and 'PROOF-STATUS=' in text and 'NEXT-STEP=' in text and 'PROOF-SIGNAL=' in text:
        assistant_with_proof_surface = text
        break
if assistant_with_proof_surface is None:
    print('[FAIL] no assistant message echoing proof injection surface found', file=sys.stderr)
    sys.exit(1)

if not curator_artifacts:
    print('[FAIL] no curator artifact entries found', file=sys.stderr)
    sys.exit(1)

artifact_with_draft = None
for item in curator_artifacts:
    summary = item.get('summary')
    summary_entry = item.get('summaryEntry')
    goal_state = item.get('goalState')
    signal = item.get('signal')
    latest_runtime_proof = item.get('latestRuntimeProof')
    latest_proof_signals = item.get('latestProofSignals')
    xnode_models = item.get('xNodeModels')
    runtime_overlay = item.get('runtimeProvisionalOverlay')
    if not isinstance(summary, str) or 'fresh real session proof' not in summary:
        continue
    if not isinstance(summary_entry, dict):
        continue
    entry_goal = ((summary_entry.get('summary') or {}) if isinstance(summary_entry.get('summary'), dict) else {}).get('goal')
    if 'fresh real session proof' not in str(entry_goal or ''):
        continue
    if not isinstance(goal_state, dict) or goal_state.get('version') != 2:
        continue
    nodes = goal_state.get('nodes')
    if not isinstance(nodes, list):
        continue
    if not any(isinstance(node, dict) and 'fresh real session proof' in str(node.get('assertion') or '') for node in nodes):
        continue
    if not isinstance(signal, dict) or not str(signal.get('type') or '').strip():
        continue

    effective_runtime_proof = latest_runtime_proof if isinstance(latest_runtime_proof, dict) else None
    effective_proof_signals = latest_proof_signals if isinstance(latest_proof_signals, list) and latest_proof_signals else None

    if effective_runtime_proof is None and isinstance(xnode_models, list) and xnode_models:
        first_model = xnode_models[0] if isinstance(xnode_models[0], dict) else None
        if isinstance(first_model, dict):
            candidate = first_model.get('latestRuntimeProof')
            if isinstance(candidate, dict):
                effective_runtime_proof = candidate
            candidate_signals = first_model.get('latestProofSignals')
            if effective_proof_signals is None and isinstance(candidate_signals, list) and candidate_signals:
                effective_proof_signals = candidate_signals

    if effective_runtime_proof is None and isinstance(runtime_overlay, dict):
        xnode_state = runtime_overlay.get('xNodeState')
        xnode_model = xnode_state.get('xNodeModel') if isinstance(xnode_state, dict) else None
        if isinstance(xnode_model, dict):
            candidate = xnode_model.get('latestRuntimeProof')
            if isinstance(candidate, dict):
                effective_runtime_proof = candidate
            candidate_signals = xnode_model.get('latestProofSignals')
            if effective_proof_signals is None and isinstance(candidate_signals, list) and candidate_signals:
                effective_proof_signals = candidate_signals

    if not isinstance(effective_runtime_proof, dict) or not str(effective_runtime_proof.get('targetXNodeId') or '').strip() or not str(effective_runtime_proof.get('proofStatus') or '').strip():
        continue
    if not isinstance(effective_proof_signals, list) or not effective_proof_signals or not isinstance(effective_proof_signals[0], dict) or not str(effective_proof_signals[0].get('type') or '').strip():
        continue
    artifact_with_draft = item
    break
if artifact_with_draft is None:
    print('[FAIL] no curator artifact with matching proof goal found', file=sys.stderr)
    sys.exit(1)

if not grc_states:
    print('[FAIL] no grc-state entries found after shutdown', file=sys.stderr)
    sys.exit(1)

latest_state = grc_states[-1]
curator = latest_state.get('curator') if isinstance(latest_state, dict) else None
if not isinstance(curator, dict):
    print('[FAIL] latest grc-state curator payload invalid', file=sys.stderr)
    sys.exit(1)

runtime_overlay = curator.get('runtimeProvisionalOverlay')
if not isinstance(runtime_overlay, dict):
    print('[FAIL] runtimeProvisionalOverlay missing in latest grc-state', file=sys.stderr)
    sys.exit(1)
if runtime_overlay.get('sourceAgentRound') != 1:
    print(f"[FAIL] expected runtimeProvisionalOverlay.sourceAgentRound=1, got {runtime_overlay.get('sourceAgentRound')!r}", file=sys.stderr)
    sys.exit(1)

user_goal_state = runtime_overlay.get('userGoalState') if isinstance(runtime_overlay, dict) else None
xnode_state = runtime_overlay.get('xNodeState') if isinstance(runtime_overlay, dict) else None
if not isinstance(user_goal_state, dict) or not isinstance(xnode_state, dict):
    print('[FAIL] runtimeProvisionalOverlay missing userGoalState/xNodeState', file=sys.stderr)
    sys.exit(1)

user_goal_tree = user_goal_state.get('userGoalTree') if isinstance(user_goal_state, dict) else None
if not isinstance(user_goal_tree, dict) or user_goal_tree.get('version') != 1:
    print(f'[FAIL] runtimeProvisionalOverlay.userGoalState.userGoalTree invalid: {user_goal_tree!r}', file=sys.stderr)
    sys.exit(1)
user_goals = user_goal_tree.get('userGoals')
if not isinstance(user_goals, list):
    print(f'[FAIL] runtimeProvisionalOverlay.userGoalState.userGoals invalid: {user_goals!r}', file=sys.stderr)
    sys.exit(1)
matching_user_goal = None
for goal in user_goals:
    if isinstance(goal, dict) and 'fresh real session proof' in str(goal.get('assertion') or ''):
        matching_user_goal = goal
        break
if matching_user_goal is None:
    print('[FAIL] no provisional user goal with fresh real session proof found in runtimeProvisionalOverlay', file=sys.stderr)
    sys.exit(1)
if user_goal_tree.get('currentFocusUserGoalId') != matching_user_goal.get('id'):
    print('[FAIL] runtimeProvisionalOverlay currentFocusUserGoalId does not point to matching provisional goal', file=sys.stderr)
    sys.exit(1)

xnode_model = xnode_state.get('xNodeModel') if isinstance(xnode_state, dict) else None
if not isinstance(xnode_model, dict) or xnode_model.get('version') != 1:
    print(f'[FAIL] runtimeProvisionalOverlay.xNodeState.xNodeModel invalid: {xnode_model!r}', file=sys.stderr)
    sys.exit(1)
xnodes = xnode_model.get('nodes')
if not isinstance(xnodes, list):
    print(f'[FAIL] runtimeProvisionalOverlay.xNodeState.xNodeModel.nodes invalid: {xnodes!r}', file=sys.stderr)
    sys.exit(1)
matching_xnode = None
for node in xnodes:
    if isinstance(node, dict) and 'fresh real session proof' in str(node.get('assertion') or ''):
        matching_xnode = node
        break
if matching_xnode is None:
    print('[FAIL] no provisional x-node with fresh real session proof found in runtimeProvisionalOverlay', file=sys.stderr)
    sys.exit(1)
if xnode_model.get('currentFocusXNodeId') != matching_xnode.get('id'):
    print('[FAIL] runtimeProvisionalOverlay currentFocusXNodeId does not point to matching provisional x-node', file=sys.stderr)
    sys.exit(1)

runtime_draft = curator.get('runtimeDraftGoalState')
if not isinstance(runtime_draft, dict):
    print('[FAIL] runtimeDraftGoalState missing in latest grc-state compatibility bridge', file=sys.stderr)
    sys.exit(1)
if runtime_draft.get('baseGoalStateRound', 'missing') is not None:
    print(f"[FAIL] expected baseGoalStateRound=None for first-round bootstrap, got {runtime_draft.get('baseGoalStateRound')!r}", file=sys.stderr)
    sys.exit(1)
if runtime_draft.get('sourceAgentRound') != 1:
    print(f"[FAIL] expected sourceAgentRound=1, got {runtime_draft.get('sourceAgentRound')!r}", file=sys.stderr)
    sys.exit(1)

bridge_goal_state = runtime_draft.get('goalState')
if not isinstance(bridge_goal_state, dict) or bridge_goal_state.get('version') != 2:
    print(f'[FAIL] runtimeDraftGoalState.goalState invalid: {bridge_goal_state!r}', file=sys.stderr)
    sys.exit(1)

bridge_nodes = bridge_goal_state.get('nodes')
if not isinstance(bridge_nodes, list):
    print(f'[FAIL] runtimeDraftGoalState.goalState.nodes invalid: {bridge_nodes!r}', file=sys.stderr)
    sys.exit(1)
matching_bridge_node = None
for node in bridge_nodes:
    if isinstance(node, dict) and node.get('signal') == 'draft' and 'fresh real session proof' in str(node.get('assertion') or ''):
        matching_bridge_node = node
        break
if matching_bridge_node is None:
    print('[FAIL] no draft bridge node with fresh real session proof found in runtimeDraftGoalState', file=sys.stderr)
    sys.exit(1)
if bridge_goal_state.get('currentFocusGoalId') != matching_bridge_node.get('id'):
    print('[FAIL] runtimeDraftGoalState currentFocusGoalId does not point to matching draft bridge node', file=sys.stderr)
    sys.exit(1)

log_files = sorted(log_root_dir.glob('*.log')) if log_root_dir.exists() else []
recent_log_parts: list[str] = []
for log_file in log_files:
    try:
        lines = log_file.read_text(encoding='utf-8', errors='ignore').splitlines()
    except Exception:
        continue
    if initial_log_file and log_file == initial_log_file:
        recent_log_parts.append('\n'.join(lines[start_log_lines:]))
    elif initial_log_file and log_file > initial_log_file:
        recent_log_parts.append('\n'.join(lines))
    elif not initial_log_file:
        recent_log_parts.append('\n'.join(lines))
recent_log = '\n'.join(part for part in recent_log_parts if part)
if not re.search(r'Starting Curator \(targetPreviousAgentRound=1', recent_log):
    print('[FAIL] expected curator start log for round 1 not found', file=sys.stderr)
    sys.exit(1)
if not re.search(r'Curator finished .*processedUpToAgentRound=1', recent_log):
    print('[FAIL] expected curator finished log for round 1 not found', file=sys.stderr)
    sys.exit(1)
if not re.search(r'Curator finished .*processedUpToAgentRound=2', recent_log):
    print('[FAIL] expected curator finished log for round 2 not found', file=sys.stderr)
    sys.exit(1)
latest_runtime_proof = artifact_with_draft.get('latestRuntimeProof')
latest_proof_signals = artifact_with_draft.get('latestProofSignals')
status_snapshot = Path(str(jsonl_path).replace('/session/', '/logs/')).parent / 'status.log'
status_text = status_snapshot.read_text(encoding='utf-8', errors='ignore') if status_snapshot.exists() else ''
proof_status_match = re.search(r'proofStatus=([^,\n]+)', status_text)
next_step_match = re.search(r'nextStepType=([^,\n]+)', status_text)
proof_signal_match = re.search(r'proofSignals=([^\n]+)', status_text)
expected_proof_status = proof_status_match.group(1).strip() if proof_status_match else None
expected_next_step = next_step_match.group(1).strip() if next_step_match else None
expected_signal_type = proof_signal_match.group(1).strip() if proof_signal_match else None
if expected_proof_status and f'PROOF-STATUS={expected_proof_status}' not in assistant_with_proof_surface:
    print('[FAIL] assistant proof surface output missing expected proofStatus', file=sys.stderr)
    sys.exit(1)
if 'NEXT-STEP=' not in assistant_with_proof_surface:
    print('[FAIL] assistant proof surface output missing NEXT-STEP line', file=sys.stderr)
    sys.exit(1)
if expected_signal_type and f'PROOF-SIGNAL={expected_signal_type}' not in assistant_with_proof_surface:
    print('[FAIL] assistant proof surface output missing expected proof signal type', file=sys.stderr)
    sys.exit(1)
if not re.search(r'Applied draftGoalOp runtime overlay \(agentRound=1, focus=.*provisionalPrimary=true, goalStateBridge=true\)', recent_log):
    print('[FAIL] expected runtime overlay primary/bridge log not found', file=sys.stderr)
    sys.exit(1)
if not re.search(r'proofSource=(curator-payload|x-node-fallback)', recent_log):
    print('[FAIL] expected proofSource=curator-payload or x-node-fallback log not found', file=sys.stderr)
    sys.exit(1)
if not re.search(r'Persisted grc-state during shutdown', recent_log):
    print('[FAIL] expected shutdown grc-state persistence log not found', file=sys.stderr)
    sys.exit(1)

print('[PASS] assistant emitted draftGoalOp in fresh real session')
print('[PASS] curator artifact persisted matching proof goal for round 1 replay chain')
print('[PASS] curator artifact contains v2 goalState + signal + summaryEntry + runtime proof payload for the fresh proof goal')
print('[PASS] assistant echoed proof injection surface in a later real session turn')
print('[PASS] runtimeProvisionalOverlay persisted as primary first-round bootstrap proof source')
print('[PASS] runtimeDraftGoalState remained available as compatibility bridge')
print('[PASS] logs confirm runtime overlay + curator-origin proof payload + shutdown persistence path')
PY

echo "[PASS] draft goal fresh real session proof complete"
