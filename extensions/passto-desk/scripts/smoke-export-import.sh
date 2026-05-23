#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$ROOT/../.." && pwd)"
cd "$REPO_ROOT"

SESSION_DIR="${SESSION_DIR:-$(mktemp -d /tmp/passto-desk-smoke-XXXXXX)}"
EXT="./extensions/passto-desk"
MODEL="${PI_MODEL:-deepseek-v4-flash}"
PROVIDER="${PI_PROVIDER:-ds4}"
OUT_DIR="$SESSION_DIR/artifacts"
mkdir -p "$OUT_DIR"

run_pi() {
  local name="$1"
  local prompt="$2"
  local out="$OUT_DIR/$name.jsonl"
  pi \
    --provider "$PROVIDER" \
    --model "$MODEL" \
    --session-dir "$SESSION_DIR" \
    --continue \
    --no-extensions \
    --extension "$EXT" \
    --no-skills \
    --no-context-files \
    --mode json \
    -p "$prompt" > "$out" 2>&1
  echo "$out"
}

extract_last_tool_details() {
  local file="$1"
  python3 - <<'PY' "$file"
import json,sys
path=sys.argv[1]
last=None
for raw in open(path):
    line=raw.strip()
    if not line.startswith('{'):
        continue
    try:
        obj=json.loads(line)
    except Exception:
        continue
    if obj.get('type')=='turn_end':
        for item in obj.get('toolResults') or []:
            if isinstance(item, dict) and isinstance(item.get('details'), dict):
                last=item['details']
    if obj.get('type')=='agent_end':
        for msg in obj.get('messages') or []:
            if isinstance(msg, dict) and msg.get('role')=='toolResult' and isinstance(msg.get('details'), dict):
                last=msg['details']
if last is None:
    raise SystemExit('NO_TOOL_RESULT_DETAILS')
print(json.dumps(last, ensure_ascii=False))
PY
}

extract_last_assistant_text() {
  local file="$1"
  python3 - <<'PY' "$file"
import json,sys
path=sys.argv[1]
last_text=None
for raw in open(path):
    line=raw.strip()
    if not line.startswith('{'):
        continue
    try:
        obj=json.loads(line)
    except Exception:
        continue
    if obj.get('type')=='message_end':
        msg=obj.get('message') or {}
        if msg.get('role')!='assistant':
            continue
        texts=[]
        for item in msg.get('content', []):
            if isinstance(item, dict) and item.get('type')=='text':
                texts.append(item.get('text',''))
        if texts:
            last_text='\n'.join(texts)
if last_text is None:
    raise SystemExit('NO_ASSISTANT_TEXT')
print(last_text)
PY
}

printf 'SESSION_DIR=%s\n' "$SESSION_DIR"

CREATE_OUT=$(run_pi create '请调用 passto_desk 工具，参数为 {"action":"create_room"}。完成后只返回最终 roomUrl。')
CREATE_DETAILS=$(extract_last_tool_details "$CREATE_OUT")
printf '%s\n' "$CREATE_DETAILS" > "$OUT_DIR/create.details.json"
ROOM_URL=$(python3 - <<'PY' "$OUT_DIR/create.details.json"
import json,sys
obj=json.load(open(sys.argv[1]))
print((obj.get('binding') or {}).get('roomUrl') or '')
PY
)
if [[ -z "$ROOM_URL" ]]; then
  echo 'failed to obtain roomUrl' >&2
  exit 1
fi
printf 'ROOM_URL=%s\n' "$ROOM_URL"

IMPORT1_PROMPT=$(python3 - <<'PY' "$ROOT/examples/domain-v2-minimal.json"
import json,sys
from pathlib import Path
payload={"action":"import_domain_json","domainJson":Path(sys.argv[1]).read_text(),"verifyPersistence":True}
print("请调用 passto_desk 工具，参数为 " + json.dumps(payload, ensure_ascii=False) + "。完成后只返回 ok。")
PY
)
IMPORT1_OUT=$(run_pi import1 "$IMPORT1_PROMPT")
IMPORT1_DETAILS=$(extract_last_tool_details "$IMPORT1_OUT")
printf '%s\n' "$IMPORT1_DETAILS" > "$OUT_DIR/import1.details.json"

EXPORT1_OUT=$(run_pi export1 '请调用 passto_desk 工具，参数为 {"action":"export_domain_json"}。完成后只返回 ok。')
EXPORT1_DETAILS=$(extract_last_tool_details "$EXPORT1_OUT")
printf '%s\n' "$EXPORT1_DETAILS" > "$OUT_DIR/export1.details.json"
python3 - <<'PY' "$OUT_DIR/export1.details.json" "$OUT_DIR/export1.domain.json"
import json,sys
obj=json.load(open(sys.argv[1]))
open(sys.argv[2],'w').write(obj['domainJson'])
summary={
  'version': obj.get('version'),
  'nodeCount': obj.get('nodeCount'),
  'edgeCount': obj.get('edgeCount'),
  'freeTextCount': obj.get('freeTextCount'),
  'warningCount': obj.get('warningCount'),
}
print(json.dumps(summary, ensure_ascii=False))
PY

python3 - <<'PY' "$OUT_DIR/export1.domain.json" "$OUT_DIR/modified.domain.json"
import json,sys
src=json.load(open(sys.argv[1]))
if not src.get('nodes'):
    raise SystemExit('NO_NODES_IN_EXPORT1')
src['nodes'][0]['label']['text']='Node A (edited by smoke)'
json.dump(src, open(sys.argv[2],'w'), ensure_ascii=False, indent=2)
open(sys.argv[2],'a').write('\n')
PY

IMPORT2_PROMPT=$(python3 - <<'PY' "$OUT_DIR/modified.domain.json"
import json,sys
from pathlib import Path
payload={"action":"import_domain_json","domainJson":Path(sys.argv[1]).read_text(),"verifyPersistence":True}
print("请调用 passto_desk 工具，参数为 " + json.dumps(payload, ensure_ascii=False) + "。完成后只返回 ok。")
PY
)
IMPORT2_OUT=$(run_pi import2 "$IMPORT2_PROMPT")
IMPORT2_DETAILS=$(extract_last_tool_details "$IMPORT2_OUT")
printf '%s\n' "$IMPORT2_DETAILS" > "$OUT_DIR/import2.details.json"

EXPORT2_OUT=$(run_pi export2 '请调用 passto_desk 工具，参数为 {"action":"export_domain_json"}。完成后只返回 ok。')
EXPORT2_DETAILS=$(extract_last_tool_details "$EXPORT2_OUT")
printf '%s\n' "$EXPORT2_DETAILS" > "$OUT_DIR/export2.details.json"
python3 - <<'PY' "$OUT_DIR/export2.details.json" "$OUT_DIR/export2.domain.json"
import json,sys
obj=json.load(open(sys.argv[1]))
open(sys.argv[2],'w').write(obj['domainJson'])
summary={
  'version': obj.get('version'),
  'nodeCount': obj.get('nodeCount'),
  'edgeCount': obj.get('edgeCount'),
  'freeTextCount': obj.get('freeTextCount'),
  'warningCount': obj.get('warningCount'),
}
print(json.dumps(summary, ensure_ascii=False))
PY

python3 - <<'PY' "$OUT_DIR/export1.domain.json" "$OUT_DIR/export2.domain.json" "$OUT_DIR/assertions.json"
import json,sys
before=json.load(open(sys.argv[1]))
after=json.load(open(sys.argv[2]))
result={
  'beforeLabel': before['nodes'][0]['label']['text'],
  'afterLabel': after['nodes'][0]['label']['text'],
  'beforeNodeCount': len(before.get('nodes', [])),
  'afterNodeCount': len(after.get('nodes', [])),
  'beforeEdgeCount': len(before.get('edges', [])),
  'afterEdgeCount': len(after.get('edges', [])),
  'beforeWarningCount': len(before.get('warnings', [])),
  'afterWarningCount': len(after.get('warnings', [])),
}
json.dump(result, open(sys.argv[3], 'w'), ensure_ascii=False, indent=2)
open(sys.argv[3], 'a').write('\n')
print(json.dumps(result, ensure_ascii=False))
if result['afterLabel'] != 'Node A (edited by smoke)':
    raise SystemExit('LABEL_EDIT_NOT_PERSISTED')
if result['afterNodeCount'] != result['beforeNodeCount']:
    raise SystemExit('NODE_COUNT_CHANGED')
if result['afterEdgeCount'] != result['beforeEdgeCount']:
    raise SystemExit('EDGE_COUNT_CHANGED')
PY

echo "SMOKE_OK artifacts=$OUT_DIR room=$ROOM_URL"
