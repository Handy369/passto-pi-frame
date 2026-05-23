#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SESSION_NAME="passto_principles_review_regression_$$"
SOCK_NAME="$SESSION_NAME"
TEST_ROOT="$(mktemp -d /tmp/passto-principles-review.XXXXXX)"
SESSION_DIR="$TEST_ROOT/session"
LOG_DIR="$TEST_ROOT/logs"
PRINCIPLES_DIR="$TEST_ROOT/principles"
CONFIG_PATH="$TEST_ROOT/config.json"
DECISION_PATH="$TEST_ROOT/review-decision.json"
DEFAULT_EXPORT_ROOT="$PRINCIPLES_DIR/reviews"
EXPLICIT_EXPORT_DIR="$TEST_ROOT/explicit-review-output"

mkdir -p "$SESSION_DIR" "$LOG_DIR" "$PRINCIPLES_DIR"

cleanup() {
  tmux -L "$SOCK_NAME" kill-session -t "$SESSION_NAME" >/dev/null 2>&1 || true
  echo "[info] test_root=$TEST_ROOT"
  echo "[info] session_dir=$SESSION_DIR"
  echo "[info] logs_dir=$LOG_DIR"
  echo "[info] principles_dir=$PRINCIPLES_DIR"
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
  sed -n '1,260p' "$LOG_DIR/$name.log" >&2 || true
  exit 1
}

wait_for_file() {
  local file="$1"
  local attempts="${2:-30}"
  local delay="${3:-1}"

  for _ in $(seq 1 "$attempts"); do
    if [[ -f "$file" ]]; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for file: $file" >&2
  exit 1
}

wait_for_default_export_bundle() {
  local attempts="${1:-30}"
  local delay="${2:-1}"

  for _ in $(seq 1 "$attempts"); do
    if find "$DEFAULT_EXPORT_ROOT" -name 'review-model.json' -print -quit 2>/dev/null | grep -q .; then
      return 0
    fi
    sleep "$delay"
  done

  echo "[FAIL] timed out waiting for default export bundle under $DEFAULT_EXPORT_ROOT" >&2
  find "$DEFAULT_EXPORT_ROOT" -maxdepth 3 -print 2>/dev/null >&2 || true
  exit 1
}

wait_for_prompt_ready() {
  wait_for_pattern startup "PasstoContext ready|Loaded [0-9]+ principles" 60 1
}

REGISTRY_PATH="$PRINCIPLES_DIR/principles-registry.json"
cat > "$REGISTRY_PATH" <<'JSON'
{
  "version": 2,
  "updatedAt": "2026-05-12T12:00:00.000Z",
  "principles": [
    {
      "id": "principle_keep",
      "created": "2026-05-12T11:00:00.000Z",
      "updated": "2026-05-12T11:00:00.000Z",
      "tags": ["quality"],
      "content": "修改文件后必须验证结果。",
      "metadata": {
        "activeScore": 10,
        "hintCount": 10,
        "hintTimestamps": ["2026-05-12T11:00:00.000Z"],
        "lifecycle": "active"
      }
    },
    {
      "id": "principle_stale",
      "created": "2026-05-12T11:01:00.000Z",
      "updated": "2026-05-12T11:01:00.000Z",
      "tags": ["legacy"],
      "content": "引用 RequirementLedger 的旧原则应停止注入。",
      "metadata": {
        "activeScore": 4,
        "hintCount": 4,
        "hintTimestamps": ["2026-05-12T11:01:00.000Z"],
        "lifecycle": "active"
      }
    },
    {
      "id": "principle_archive",
      "created": "2026-05-12T11:02:00.000Z",
      "updated": "2026-05-12T11:02:00.000Z",
      "tags": ["legacy"],
      "content": "新增：同步文档。新增：更新 README 并记录迁移备注。",
      "metadata": {
        "activeScore": 3,
        "hintCount": 3,
        "hintTimestamps": ["2026-05-12T11:02:00.000Z"],
        "lifecycle": "active"
      }
    },
    {
      "id": "principle_disable",
      "created": "2026-05-12T11:03:00.000Z",
      "updated": "2026-05-12T11:03:00.000Z",
      "tags": ["legacy"],
      "content": "这是一条需要停用的原则。",
      "metadata": {
        "activeScore": 2,
        "hintCount": 2,
        "hintTimestamps": ["2026-05-12T11:03:00.000Z"],
        "lifecycle": "active"
      }
    }
  ]
}
JSON

cat > "$CONFIG_PATH" <<JSON
{
  "logEnabled": true,
  "logLevel": "debug",
  "memory": { "enabled": false },
  "tracking": { "enabled": true, "showWidget": true },
  "grc": {
    "enabled": true,
    "midRunTurnThreshold": 99,
    "principlesDir": "$PRINCIPLES_DIR",
    "subagentModel": "deepseek-v4-flash",
    "subagentModelProvider": "deepseek"
  }
}
JSON

printf '[info] Starting Pi principles review regression session\n'
tmux -L "$SOCK_NAME" new-session -d -s "$SESSION_NAME" -x 140 -y 42 \
  "env PASSTOCONTEXT_CONFIG='$CONFIG_PATH' pi --provider deepseek --model deepseek-v4-flash --session-dir '$SESSION_DIR' --no-extensions --extension '$EXT_DIR' --no-skills"

wait_for_prompt_ready
capture startup
assert_log_has "$LOG_DIR/startup.log" "passto-context"

printf '[info] Test 1: /ptc principles review export (default output dir)\n'
send_cmd "/ptc principles review export"
wait_for_pattern export-default "Principles review bundle exported" 30 1
wait_for_default_export_bundle 30 1
DEFAULT_REVIEW_MODEL="$(find "$DEFAULT_EXPORT_ROOT" -name 'review-model.json' -print -quit)"
DEFAULT_REVIEW_HTML="$(find "$DEFAULT_EXPORT_ROOT" -name 'review.html' -print -quit)"
wait_for_file "$DEFAULT_REVIEW_MODEL" 5 1
wait_for_file "$DEFAULT_REVIEW_HTML" 5 1
assert_log_has "$LOG_DIR/export-default.log" "review-model\\.json, review\\.html"
assert_log_has "$LOG_DIR/export-default.log" "snapshot: sha256:"

python3 - "$DEFAULT_REVIEW_MODEL" "$DEFAULT_REVIEW_HTML" "$REGISTRY_PATH" "$DECISION_PATH" <<'PY'
from __future__ import annotations
import json
import sys
from pathlib import Path

model_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])
registry_path = Path(sys.argv[3])
decision_path = Path(sys.argv[4])

model = json.loads(model_path.read_text(encoding='utf-8'))
html = html_path.read_text(encoding='utf-8')

assert model['kind'] == 'principles-review-model', model
assert model['registryPath'] == str(registry_path), model['registryPath']
assert isinstance(model['registrySnapshotHash'], str) and model['registrySnapshotHash'].startswith('sha256:'), model['registrySnapshotHash']
assert model['summary']['total'] == 4, model['summary']
assert 'Principles Review' in html, html[:200]
assert '修改文件后必须验证结果。' in html, html[:400]

decision = {
    'version': 1,
    'kind': 'principles-review-decision',
    'generatedAt': '2026-05-12T12:10:00.000Z',
    'reviewSessionId': model['reviewSessionId'],
    'registrySnapshotHash': model['registrySnapshotHash'],
    'reviewer': 'tmux-regression',
    'decisions': [
        { 'id': 'principle_keep', 'action': 'keep-active', 'note': '保留' },
        { 'id': 'principle_stale', 'action': 'mark-stale', 'note': '降权' },
        { 'id': 'principle_archive', 'action': 'archive', 'note': '归档' },
        { 'id': 'principle_disable', 'action': 'disable', 'note': '停用' },
    ],
}
decision_path.write_text(json.dumps(decision, ensure_ascii=False, indent=2), encoding='utf-8')
PY

wait_for_file "$DECISION_PATH" 5 1

printf '[info] Test 2: /ptc principles review export <output-dir>\n'
send_cmd "/ptc principles review export $EXPLICIT_EXPORT_DIR"
wait_for_file "$EXPLICIT_EXPORT_DIR/review-model.json" 30 1
wait_for_file "$EXPLICIT_EXPORT_DIR/review.html" 30 1
capture export-explicit
assert_log_has "$LOG_DIR/export-explicit.log" "Principles review bundle exported"

python3 - "$EXPLICIT_EXPORT_DIR/review-model.json" "$EXPLICIT_EXPORT_DIR/review.html" "$DECISION_PATH" <<'PY'
from __future__ import annotations
import json
import sys
from pathlib import Path

model = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
html = Path(sys.argv[2]).read_text(encoding='utf-8')
decision_path = Path(sys.argv[3])
assert model['summary']['total'] == 4, model['summary']
assert model['kind'] == 'principles-review-model', model['kind']
assert 'Principles Review' in html, html[:200]

decision = {
    'version': 1,
    'kind': 'principles-review-decision',
    'generatedAt': '2026-05-12T12:11:00.000Z',
    'reviewSessionId': model['reviewSessionId'],
    'registrySnapshotHash': model['registrySnapshotHash'],
    'reviewer': 'tmux-regression',
    'decisions': [
        { 'id': 'principle_keep', 'action': 'keep-active', 'note': '保留' },
        { 'id': 'principle_stale', 'action': 'mark-stale', 'note': '降权' },
        { 'id': 'principle_archive', 'action': 'archive', 'note': '归档' },
        { 'id': 'principle_disable', 'action': 'disable', 'note': '停用' },
    ],
}
decision_path.write_text(json.dumps(decision, ensure_ascii=False, indent=2), encoding='utf-8')
PY

wait_for_file "$DECISION_PATH" 5 1

printf '[info] Test 3: /ptc principles review import <file>\n'
send_cmd "/ptc principles review import $DECISION_PATH"
wait_for_pattern import "Principles review imported" 30 1
assert_log_has "$LOG_DIR/import.log" "total decisions: 4"
assert_log_has "$LOG_DIR/import.log" "updated: 4"
assert_log_has "$LOG_DIR/import.log" "active: 1"
assert_log_has "$LOG_DIR/import.log" "stale: 1"
assert_log_has "$LOG_DIR/import.log" "archived: 1"
assert_log_has "$LOG_DIR/import.log" "disabled: 1"

python3 - "$REGISTRY_PATH" <<'PY'
from __future__ import annotations
import json
import sys
from pathlib import Path

registry = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
items = {item['id']: item for item in registry['principles']}
assert items['principle_keep']['metadata']['lifecycle'] == 'active'
assert items['principle_stale']['metadata']['lifecycle'] == 'stale'
assert items['principle_archive']['metadata']['lifecycle'] == 'archived'
assert items['principle_disable']['metadata']['lifecycle'] == 'disabled'
assert all(items[item_id].get('updated') for item_id in items), items
PY

echo
printf '[OK] Principles review TUI regression passed\n'
