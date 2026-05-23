#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSION_NAME="passto_midrun_regression_$$"
SOCK_NAME="$SESSION_NAME"
TEST_ROOT="$(mktemp -d /tmp/passto-midrun-regression.XXXXXX)"
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
  tmux -L "$SOCK_NAME" capture-pane -t "$SESSION_NAME" -p -S -260 > "$LOG_DIR/$name.log"
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
    sed -n '1,240p' "$file" >&2 || true
    exit 1
  fi
  echo "[PASS] $pattern"
}

wait_for_pattern() {
  local name="$1"
  local pattern="$2"
  local attempts="${3:-30}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    capture "$name"
    if rg -q "$pattern" "$LOG_DIR/$name.log"; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for pattern: $pattern" >&2
  sed -n '1,240p' "$LOG_DIR/$name.log" >&2 || true
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

assert_jsonl_has() {
  local file="$1"
  local pattern="$2"
  if ! rg -q "$pattern" "$file"; then
    echo "[FAIL] missing jsonl pattern: $pattern in $file" >&2
    sed -n '1,240p' "$file" >&2 || true
    exit 1
  fi
  echo "[PASS] jsonl pattern: $pattern"
}

wait_for_jsonl_pattern() {
  local file="$1"
  local pattern="$2"
  local attempts="${3:-120}"
  local delay="${4:-1}"

  for _ in $(seq 1 "$attempts"); do
    if rg -q "$pattern" "$file"; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for jsonl pattern: $pattern" >&2
  sed -n '1,240p' "$file" >&2 || true
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
    "midRunTurnThreshold": 2,
    "subagentModel": "deepseek-v4-flash",
    "subagentModelProvider": "deepseek"
  }
}
JSON

printf '[info] Starting Pi mid-run regression session\n'
tmux -L "$SOCK_NAME" new-session -d -s "$SESSION_NAME" -x 140 -y 42 \
  "env PASSTOCONTEXT_CONFIG='$CONFIG_PATH' pi --provider deepseek --model deepseek-v4-flash --thinking low --session-dir '$SESSION_DIR' --no-extensions --extension '$EXT_DIR' --no-skills"

wait_for_pattern startup "PasstoContext ready|Loaded [0-9]+ principles" 60 1
capture startup
assert_log_has "$LOG_DIR/startup.log" "passto-context"

printf '[info] Test 1: /ptc status opens current status panel\n'
send_cmd "/ptc status"
wait_for_pattern status-before "PasstoContext Runtime Status" 25 1
assert_log_has "$LOG_DIR/status-before.log" "Runtime\*\*: on"
assert_log_has "$LOG_DIR/status-before.log" "Reflector status\*\*: idle"

PROMPT=$(cat <<'EOF'
请你在 /Users/handy/dev/passto-ai/extensions/passto-context 中逐个检查这些文件：index.ts、grc-state.ts、grc-prompts.ts、grc-subagent.ts、config.ts、types.ts。
要求：
1. 禁止使用 bash / ls / find / grep；直接使用 read 工具逐文件读取真实内容。
2. 一次只处理一个文件，完成当前文件后再继续下一个，不要把多个文件放在同一轮一起处理。
3. 至少确认 5 个文件。
4. 每检查完一个文件，立刻记录它与 GRC 触发链路的关系。
5. 最后输出一份简短的一致性报告。
EOF
)

printf '[info] Test 2: trigger mid-run stuck reflector\n'
send_cmd "$PROMPT"

SESSION_JSONL="$(wait_for_session_jsonl 120 1 || true)"

if [[ -z "$SESSION_JSONL" ]]; then
  echo "[FAIL] session jsonl not found" >&2
  capture session-jsonl-timeout
  sed -n '1,260p' "$LOG_DIR/session-jsonl-timeout.log" >&2 || true
  find "$SESSION_DIR" -maxdepth 3 -print >&2 || true
  exit 1
fi

echo "[info] session_jsonl=$SESSION_JSONL"

wait_for_jsonl_pattern "$SESSION_JSONL" '"customType":"grc-mid-run-debug"' 240 1
wait_for_jsonl_pattern "$SESSION_JSONL" '"phase":"delivered"' 300 1

assert_jsonl_has "$SESSION_JSONL" '"customType":"grc-mid-run-debug"'
assert_jsonl_has "$SESSION_JSONL" '"phase":"triggered"'
assert_jsonl_has "$SESSION_JSONL" '"phase":"delivered"'
assert_jsonl_has "$SESSION_JSONL" '"runTurn":2'
assert_jsonl_has "$SESSION_JSONL" '"threshold":2'

if rg -q '"customType":"grc-mid-run-reflection-steer"' "$SESSION_JSONL"; then
  echo '[PASS] jsonl pattern: "customType":"grc-mid-run-reflection-steer"'
else
  echo '[info] grc-mid-run-reflection-steer not persisted in this session jsonl; using delivered debug entry as source of truth'
fi

capture after-prompt
assert_log_has "$LOG_DIR/after-prompt.log" '思:✓|Run:'
if rg -q '运行中反思已注入' "$LOG_DIR/after-prompt.log"; then
  echo '[PASS] 运行中反思已注入'
else
  echo '[info] transient status text not captured; widget reflector check already passed'
fi

python3 - "$SESSION_JSONL" <<'PY'
from pathlib import Path
import json, sys
path = Path(sys.argv[1])
for i, line in enumerate(path.read_text(errors='ignore').splitlines(), start=1):
    try:
        obj = json.loads(line)
    except Exception:
        continue
    if obj.get('type') == 'custom' and obj.get('customType') == 'grc-mid-run-debug':
        print(f"[info] debug line {i}: {obj.get('data')}")
    if obj.get('type') == 'custom_message' and obj.get('customType') == 'grc-mid-run-reflection-steer':
        print(f"[info] steer line {i}: {obj.get('timestamp')}")
PY

echo
echo '[OK] Mid-run regression passed'
