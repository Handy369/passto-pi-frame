#!/usr/bin/env bash
set -euo pipefail

EXT_DIR="/Users/handy/dev/passto-ai/extensions/passto-context"
SESSION_NAME="passto_tui_regression_$$"
SOCK_NAME="${SESSION_NAME}"
SESSION_DIR="$(mktemp -d /tmp/passto-tui-regression.XXXXXX)"
LOG_DIR="$(mktemp -d /tmp/passto-tui-regression-logs.XXXXXX)"

cleanup() {
  tmux -L "$SOCK_NAME" kill-session -t "$SESSION_NAME" >/dev/null 2>&1 || true
  echo "[info] session_dir=$SESSION_DIR"
  echo "[info] logs_dir=$LOG_DIR"
}
trap cleanup EXIT

capture() {
  local name="$1"
  tmux -L "$SOCK_NAME" capture-pane -t "$SESSION_NAME" -p -S -260 > "$LOG_DIR/$name.log"
}

extract_session_name() {
  local file="$1"
  python3 - "$file" <<'PY'
import re, sys
text = open(sys.argv[1], 'r', encoding='utf-8').read()
matches = re.findall(r"\*\*Session\*\*: `([^`]+)`", text)
print(matches[-1] if matches else "")
PY
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
  local attempts="${3:-20}"
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

wait_for_prompt_ready() {
  wait_for_pattern startup "PasstoContext ready|Loaded [0-9]+ principles"
}

run_reload() {
  send_cmd "/reload"
  wait_for_pattern reload "Reloaded keybindings, extensions, skills, prompts, themes" 30 1
  sleep 3
}

printf '[info] Starting Pi TUI regression session\n'
tmux -L "$SOCK_NAME" new-session -d -s "$SESSION_NAME" -x 120 -y 36 \
  "pi --provider ds4 --model deepseek-v4-flash --session-dir '$SESSION_DIR' --no-extensions --extension '$EXT_DIR' --no-skills"

sleep 2
wait_for_prompt_ready
capture startup
assert_log_has "$LOG_DIR/startup.log" "passto-context"

printf '[info] Test 1: /ptc status\n'
send_cmd "/ptc status"
wait_for_pattern ptc-status "PasstoContext Runtime Status"
assert_log_has "$LOG_DIR/ptc-status.log" "Runtime\*\*: on"
assert_log_has "$LOG_DIR/ptc-status.log" "Current mode\*\*: normal"

printf '[info] Test 2: /ptc on\n'
send_cmd "/ptc on"
wait_for_pattern ptc-on "PasstoContext 已开启|PTC 已开启"
sleep 1
send_cmd "/ptc status"
wait_for_pattern ptc-on-status "PasstoContext Runtime Status"
assert_log_has "$LOG_DIR/ptc-on-status.log" "Runtime\*\*: on"

printf '[info] Test 3: /ptc off\n'
send_cmd "/ptc off"
wait_for_pattern ptc-off "PasstoContext 已关闭|PTC:off"
sleep 1
send_cmd "/ptc status"
wait_for_pattern ptc-off-status "PasstoContext Runtime Status"
assert_log_has "$LOG_DIR/ptc-off-status.log" "Runtime\*\*: off"
assert_log_has "$LOG_DIR/ptc-off-status.log" "Current mode\*\*: normal"

printf '[info] Test 4: /ptc config\n'
send_cmd "/ptc config"
wait_for_pattern ptc-config "已打开 PasstoContext 配置文件|打开配置文件失败" 25 1

printf '[info] Test 5: /reload persistence\n'
run_reload
send_cmd "/ptc status"
wait_for_pattern post-reload-status "PasstoContext Runtime Status"
assert_log_has "$LOG_DIR/post-reload-status.log" "Runtime\*\*: off"
assert_log_has "$LOG_DIR/post-reload-status.log" "Reflector status\*\*: (idle|done|failed)"
assert_log_has "$LOG_DIR/post-reload-status.log" "Curator status\*\*: (idle|done|failed)"

OLD_SESSION_NAME="$(extract_session_name "$LOG_DIR/post-reload-status.log")"
if [[ -z "$OLD_SESSION_NAME" ]]; then
  echo "[FAIL] could not extract pre-/new session name" >&2
  exit 1
fi

echo "[info] Captured pre-/new session name: $OLD_SESSION_NAME"

printf '[info] Test 6: /new resets session-scoped state\n'
send_cmd "/new"
wait_for_pattern after-new "New session started|✓ New session started" 25 1
sleep 2
send_cmd "/ptc status"
wait_for_pattern after-new-status "PasstoContext Runtime Status"
assert_log_has "$LOG_DIR/after-new-status.log" "Runtime\*\*: on"
assert_log_has "$LOG_DIR/after-new-status.log" "Current mode\*\*: normal"

NEW_SESSION_NAME="$(extract_session_name "$LOG_DIR/after-new-status.log")"
if [[ -z "$NEW_SESSION_NAME" ]]; then
  echo "[FAIL] could not extract post-/new session name" >&2
  exit 1
fi
if [[ "$NEW_SESSION_NAME" == "$OLD_SESSION_NAME" ]]; then
  echo "[FAIL] /new did not create a distinct session" >&2
  exit 1
fi

echo "[PASS] /new created distinct session: $NEW_SESSION_NAME"

printf '[info] Test 7: /resume dialog is reachable\n'
send_cmd "/resume"
wait_for_pattern resume-open "Resume Session \(Current Folder\)|No sessions in current folder" 25 1
assert_log_has "$LOG_DIR/resume-open.log" "Resume Session \(Current Folder\)"
tmux -L "$SOCK_NAME" send-keys -t "$SESSION_NAME" Tab
sleep 1
capture resume-all
assert_log_has "$LOG_DIR/resume-all.log" "Resume Session \(All\)"

echo "[info] /resume restore selection is not fully automated in this script because the All view mixes global historical sessions with nondeterministic ordering."

echo
printf '[OK] TUI regression passed\n'
