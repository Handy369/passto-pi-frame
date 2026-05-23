#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSION_NAME="passto_reflector_replay_regression_$$"
SOCK_NAME="$SESSION_NAME"
TEST_ROOT="$(mktemp -d /tmp/passto-reflector-replay.XXXXXX)"
SESSION_DIR="$TEST_ROOT/session"
LOG_DIR="$TEST_ROOT/logs"
CONFIG_PATH="$TEST_ROOT/config.json"

mkdir -p "$SESSION_DIR" "$LOG_DIR"

cleanup() {
  tmux -L "$SOCK_NAME" kill-session -t "$SESSION_NAME" >/dev/null 2>&1 || true
  echo "[info] test_root=$TEST_ROOT"
  echo "[info] session_dir=$SESSION_DIR"
  echo "[info] logs_dir=$LOG_DIR"
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
    if rg -q "$pattern" "$file"; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for jsonl pattern: $pattern" >&2
  echo '[info] jsonl tail:' >&2
  tail -n 40 "$file" >&2 || true
  exit 1
}

wait_for_final_answer() {
  local file="$1"
  local attempts="${2:-240}"
  local delay="${3:-1}"

  for _ in $(seq 1 "$attempts"); do
    if rg -q '恢复哪些轻状态字段|latest reflector artifact should restore|latest reflector artifact' "$file"; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for final assistant answer in jsonl" >&2
  echo '[info] jsonl tail:' >&2
  tail -n 40 "$file" >&2 || true
  exit 1
}

run_reload() {
  send_cmd "/reload"
  wait_for_pattern reload "Reloaded keybindings, extensions, skills, prompts, themes" 40 1
  sleep 3
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
    "subagentModel": "deepseek-v4-flash",
    "subagentModelProvider": "deepseek"
  }
}
JSON

PROMPT=$(cat <<'EOF'
请在 /Users/handy/dev/passto-ai/extensions/passto-context 内完成一个极简的真实检查任务：
1. 逐个读取并核对 README.md、index.ts、grc-restore.ts、ptc-status.ts。
2. 每个文件只总结与 reflector artifact / restore / replay / status 相关的事实。
3. 最后输出一个简短结论，明确说明：
   - replay 后 status 应看到什么
   - 最新 reflector artifact 应恢复哪些轻状态字段
要求：
- 必须真实读取文件后再回答；
- 不要修改任何文件；
- 给出简短但明确的结论。
EOF
)

printf '[info] Starting Pi reflector replay regression session\n'
tmux -L "$SOCK_NAME" new-session -d -s "$SESSION_NAME" -x 140 -y 42 \
  "env PASSTOCONTEXT_CONFIG='$CONFIG_PATH' pi --provider deepseek --model deepseek-v4-flash --thinking low --session-dir '$SESSION_DIR' --no-extensions --extension '$EXT_DIR' --no-skills"

wait_for_pattern startup "PasstoContext ready|Loaded [0-9]+ principles" 60 1
capture startup
assert_log_has "$LOG_DIR/startup.log" "passto-context"

printf '[info] Test 1: submit a real task to trigger post-round reflector\n'
send_cmd "$PROMPT"

SESSION_JSONL="$(wait_for_session_jsonl 60 1 || true)"

if [[ -z "$SESSION_JSONL" ]]; then
  echo "[FAIL] session jsonl not found" >&2
  capture session-jsonl-timeout
  sed -n '1,260p' "$LOG_DIR/session-jsonl-timeout.log" >&2 || true
  find "$SESSION_DIR" -maxdepth 3 -print >&2 || true
  exit 1
fi

echo "[info] session_jsonl=$SESSION_JSONL"

wait_for_final_answer "$SESSION_JSONL" 240 1
# Some models stop after tool-result-heavy answers without immediately emitting agent_end.
# Send an explicit interrupt to flush the round so post-round reflector replay can run.
tmux -L "$SOCK_NAME" send-keys -t "$SESSION_NAME" C-c
wait_for_jsonl_pattern "$SESSION_JSONL" '"customType":"grc-reflector-artifact"' 360 1

printf '[info] Test 2: check status before reload\n'
send_cmd "/ptc status"
wait_for_pattern status-before "PasstoContext Runtime Status" 30 1
assert_log_has "$LOG_DIR/status-before.log" "PasstoContext Runtime Status"

printf '[info] Test 3: reload and verify replayed status\n'
run_reload
send_cmd "/ptc status"
wait_for_pattern status-after-reload "PasstoContext Runtime Status" 30 1
assert_log_has "$LOG_DIR/status-after-reload.log" "PasstoContext Runtime Status"

python3 - "$SESSION_JSONL" "$LOG_DIR/status-before.log" "$LOG_DIR/status-after-reload.log" <<'PY'
from __future__ import annotations
import json
import re
import sys
from pathlib import Path

jsonl_path = Path(sys.argv[1])
status_before_path = Path(sys.argv[2])
status_after_path = Path(sys.argv[3])

latest_artifact = None
latest_state = None

for line in jsonl_path.read_text(encoding='utf-8', errors='ignore').splitlines():
    try:
        obj = json.loads(line)
    except Exception:
        continue
    custom_type = obj.get('customType')
    data = obj.get('data')
    if custom_type == 'grc-reflector-artifact' and isinstance(data, dict):
        latest_artifact = data
    if custom_type == 'grc-state' and isinstance(data, dict):
        latest_state = data

if latest_artifact is None:
    print('[FAIL] no grc-reflector-artifact entry found in jsonl', file=sys.stderr)
    sys.exit(1)
if latest_state is None:
    print('[FAIL] no grc-state entry found in jsonl', file=sys.stderr)
    sys.exit(1)

artifact_round = latest_artifact.get('agentRound')
if not isinstance(artifact_round, int):
    print(f'[FAIL] invalid artifact agentRound: {artifact_round!r}', file=sys.stderr)
    sys.exit(1)

reflector_state = latest_state.get('reflector')
if not isinstance(reflector_state, dict):
    print('[FAIL] invalid grc-state.reflector payload', file=sys.stderr)
    sys.exit(1)

processed_round = reflector_state.get('processedUpToAgentRound')
last_reflected_round = reflector_state.get('lastReflectedAgentRound')
last_diagnosis = reflector_state.get('lastDiagnosis')
last_advice = reflector_state.get('lastAdvice')
artifact_diagnosis = latest_artifact.get('diagnosis')
artifact_advice = latest_artifact.get('advice')

if processed_round != artifact_round:
    print(f'[FAIL] processedUpToAgentRound mismatch: state={processed_round!r}, artifact={artifact_round!r}', file=sys.stderr)
    sys.exit(1)
if last_reflected_round != artifact_round:
    print(f'[FAIL] lastReflectedAgentRound mismatch: state={last_reflected_round!r}, artifact={artifact_round!r}', file=sys.stderr)
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

pattern = re.compile(r'Last reflected round\*\*: (\d+)')
match_before = pattern.search(status_before)
match_after = pattern.search(status_after)
if not match_before:
    print('[FAIL] could not parse pre-reload Last reflected round from latest status block', file=sys.stderr)
    sys.exit(1)
if not match_after:
    print('[FAIL] could not parse post-reload Last reflected round from latest status block', file=sys.stderr)
    sys.exit(1)

before_round = int(match_before.group(1))
after_round = int(match_after.group(1))
if before_round != artifact_round:
    print(f'[FAIL] pre-reload status round mismatch: status={before_round}, artifact={artifact_round}', file=sys.stderr)
    sys.exit(1)
if after_round != artifact_round:
    print(f'[FAIL] post-reload status round mismatch: status={after_round}, artifact={artifact_round}', file=sys.stderr)
    sys.exit(1)

before_has_diag = '### Latest Reflector Diagnosis' in status_before
after_has_diag = '### Latest Reflector Diagnosis' in status_after
before_has_advice = '### Latest Reflector Advice' in status_before
after_has_advice = '### Latest Reflector Advice' in status_after

if isinstance(artifact_diagnosis, dict):
    drift = artifact_diagnosis.get('driftSource', 'unknown')
    aligned = artifact_diagnosis.get('aligned', 'unknown')
    print(f'[info] artifact diagnosis: aligned={aligned}, driftSource={drift}')
    if not isinstance(last_diagnosis, dict):
        print(f'[FAIL] missing restored lastDiagnosis in latest grc-state: {last_diagnosis!r}', file=sys.stderr)
        sys.exit(1)
    if not before_has_diag or not after_has_diag:
        print('[FAIL] artifact has diagnosis but latest status block is missing diagnosis section before or after reload', file=sys.stderr)
        sys.exit(1)
    print('[PASS] diagnosis replay is visible in latest status block and grc-state')
else:
    print('[info] artifact diagnosis: none')
    if last_diagnosis is not None:
        print(f'[FAIL] artifact diagnosis is null but latest grc-state lastDiagnosis is not null: {last_diagnosis!r}', file=sys.stderr)
        sys.exit(1)
    if before_has_diag or after_has_diag:
        print('[FAIL] artifact diagnosis is null but latest status block still shows diagnosis section', file=sys.stderr)
        sys.exit(1)
    print('[PASS] diagnosis absence is consistent across artifact, grc-state, and latest status block')

if isinstance(artifact_advice, str) and artifact_advice.strip():
    if not (isinstance(last_advice, str) and last_advice.strip()):
        print(f'[FAIL] artifact advice is non-empty but latest grc-state lastAdvice is empty: {last_advice!r}', file=sys.stderr)
        sys.exit(1)
    if not before_has_advice or not after_has_advice:
        print('[FAIL] artifact advice is non-empty but latest status block is missing advice section before or after reload', file=sys.stderr)
        sys.exit(1)
    print(f'[info] restored advice chars: {len(last_advice)}')
    print('[PASS] advice replay is visible in latest status block and grc-state')
else:
    if last_advice is not None:
        print(f'[FAIL] artifact advice is empty/null but latest grc-state lastAdvice is not null: {last_advice!r}', file=sys.stderr)
        sys.exit(1)
    if before_has_advice or after_has_advice:
        print('[FAIL] artifact advice is empty/null but latest status block still shows advice section', file=sys.stderr)
        sys.exit(1)
    print('[info] restored advice chars: 0')
    print('[PASS] advice absence is consistent across artifact, grc-state, and latest status block')

print(f'[PASS] artifact round = {artifact_round}')
print(f'[PASS] processedUpToAgentRound = {processed_round}')
print(f'[PASS] lastReflectedAgentRound = {last_reflected_round}')
print('[PASS] pre/post reload status are aligned with latest artifact round')
PY

echo
echo '[OK] Reflector replay regression passed'
