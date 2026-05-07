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
  "pi --session-dir '$SESSION_DIR' --no-extensions --extension '$EXT_DIR' --no-skills"

sleep 2
wait_for_prompt_ready
capture startup
assert_log_has "$LOG_DIR/startup.log" "passto-context"

printf '[info] Test 1: /pta status\n'
send_cmd "/pta status"
wait_for_pattern pta-status "PTA / GRC Status"
assert_log_has "$LOG_DIR/pta-status.log" "Manual mode\*\*: auto"
assert_log_has "$LOG_DIR/pta-status.log" "Current mode\*\*: normal"

printf '[info] Test 2: /pta on\n'
send_cmd "/pta on"
wait_for_pattern pta-on "GRC 已强制开启|GRC forced on"
sleep 1
send_cmd "/pta status"
wait_for_pattern pta-on-status "PTA / GRC Status"
assert_log_has "$LOG_DIR/pta-on-status.log" "Manual mode\*\*: forced-on"
assert_log_has "$LOG_DIR/pta-on-status.log" "Current mode\*\*: grc"

printf '[info] Test 3: /pta off\n'
send_cmd "/pta off"
wait_for_pattern pta-off "GRC 已停用|GRC forced off"
sleep 1
send_cmd "/pta status"
wait_for_pattern pta-off-status "PTA / GRC Status"
assert_log_has "$LOG_DIR/pta-off-status.log" "Manual mode\*\*: forced-off"
assert_log_has "$LOG_DIR/pta-off-status.log" "Current mode\*\*: normal"

printf '[info] Test 4: /pta reflect under forced-off (should still force-enable and run)\n'
send_cmd "/pta reflect"
wait_for_pattern pta-reflect "Reflector 已手动触发|Reflector is already running|Reflector 不可用" 25 1
sleep 1
send_cmd "/pta status"
wait_for_pattern pta-reflect-status "PTA / GRC Status"
assert_log_has "$LOG_DIR/pta-reflect-status.log" "Manual mode\*\*: forced-on"
assert_log_has "$LOG_DIR/pta-reflect-status.log" "Current mode\*\*: grc"

printf '[info] Test 5: /pta curate\n'
send_cmd "/pta curate"
wait_for_pattern pta-curate "Curator 已手动触发|Curator is already running|Curator 不可用" 25 1
capture pta-curate
assert_log_has "$LOG_DIR/pta-curate.log" "Curator"

printf '[info] Test 6: /reload persistence\n'
run_reload
send_cmd "/pta status"
wait_for_pattern post-reload-status "PTA / GRC Status"
assert_log_has "$LOG_DIR/post-reload-status.log" "Manual mode\*\*: forced-on"
assert_log_has "$LOG_DIR/post-reload-status.log" "Reflector\*\*: (idle|done|failed)"
assert_log_has "$LOG_DIR/post-reload-status.log" "Curator\*\*: (idle|done|failed)"

OLD_SESSION_NAME="$(extract_session_name "$LOG_DIR/post-reload-status.log")"
if [[ -z "$OLD_SESSION_NAME" ]]; then
  echo "[FAIL] could not extract pre-/new session name" >&2
  exit 1
fi

echo "[info] Captured pre-/new session name: $OLD_SESSION_NAME"

printf '[info] Test 7: /new resets session-scoped state\n'
send_cmd "/new"
wait_for_pattern after-new "New session started|✓ New session started" 25 1
sleep 2
send_cmd "/pta status"
wait_for_pattern after-new-status "PTA / GRC Status"
assert_log_has "$LOG_DIR/after-new-status.log" "Manual mode\*\*: auto"
assert_log_has "$LOG_DIR/after-new-status.log" "Current mode\*\*: normal"
assert_log_has "$LOG_DIR/after-new-status.log" "GRC cycles\*\*: 0"

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

printf '[info] Test 8: /resume dialog is reachable\n'
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
