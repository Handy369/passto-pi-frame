#!/usr/bin/env bash
set -euo pipefail

AGENT_REACH_ENV_FILE="${AGENT_REACH_ENV_FILE:-$HOME/.agent-reach/env}"
if [[ -f "$AGENT_REACH_ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$AGENT_REACH_ENV_FILE"
  set +a
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER_SCRIPT="${AGENT_REACH_DEEPSEEK_RUNNER:-$SCRIPT_DIR/deepseek_search_runner.py}"
ARTIFACT_ROOT="${AGENT_REACH_ARTIFACT_ROOT:-$HOME/.agent-reach}"
PROFILE_DIR="${AGENT_REACH_DEEPSEEK_PROFILE_DIR:-$ARTIFACT_ROOT/profiles/deepseek-browser}"
SCENARIO="${AGENT_REACH_DEEPSEEK_SCENARIO:-deepseek-smart-search}"
FIRST_ANSWER_MS="${AGENT_REACH_DEEPSEEK_FIRST_ANSWER_MS:-20000}"
FULL_ANSWER_MS="${AGENT_REACH_DEEPSEEK_FULL_ANSWER_MS:-60000}"
MIN_SOURCE_COUNT="${AGENT_REACH_DEEPSEEK_MIN_SOURCE_COUNT:-1}"
EXPECTED_ANSWER_MIN_CHARS="${AGENT_REACH_DEEPSEEK_EXPECTED_ANSWER_MIN_CHARS:-180}"
EXA_NUM_RESULTS="${AGENT_REACH_EXA_NUM_RESULTS:-5}"
EXA_FALLBACK_SCRIPT="${AGENT_REACH_EXA_FALLBACK_SCRIPT:-$SCRIPT_DIR/exa-search.sh}"
NORMALIZER_SCRIPT="${AGENT_REACH_NORMALIZER_SCRIPT:-$SCRIPT_DIR/normalize-research-output.py}"
OUTPUT_JSON=1
ALLOW_EXA_FALLBACK=1
QUERY=""
QUERY_FILE=""
LAST_EXA_FALLBACK_ERROR=""

usage() {
  cat <<'EOF'
usage: deepseek-search.sh [options] --query "your question"

options:
  --query <text>                     search query / research question
  --query-file <file>                read query from file
  --text                             print compact text instead of JSON
  --json                             print JSON (default)
  --no-exa-fallback                  disable Exa fallback
  --first-answer-ms <ms>             default 20000
  --full-answer-ms <ms>              default 60000
  --min-source-count <n>             default 1
  --expected-answer-min-chars <n>    default 180
  --exa-num-results <n>              default 5
  -h, --help                         show this help

env:
  AGENT_REACH_ARTIFACT_ROOT          default ~/.agent-reach
  AGENT_REACH_DEEPSEEK_PROFILE_DIR   default ~/.agent-reach/profiles/deepseek-browser
  AGENT_REACH_ENV_FILE               default ~/.agent-reach/env
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --query)
      QUERY="$2"
      shift 2
      ;;
    --query-file)
      QUERY_FILE="$2"
      shift 2
      ;;
    --text)
      OUTPUT_JSON=0
      shift
      ;;
    --json)
      OUTPUT_JSON=1
      shift
      ;;
    --no-exa-fallback)
      ALLOW_EXA_FALLBACK=0
      shift
      ;;
    --first-answer-ms)
      FIRST_ANSWER_MS="$2"
      shift 2
      ;;
    --full-answer-ms)
      FULL_ANSWER_MS="$2"
      shift 2
      ;;
    --min-source-count)
      MIN_SOURCE_COUNT="$2"
      shift 2
      ;;
    --expected-answer-min-chars)
      EXPECTED_ANSWER_MIN_CHARS="$2"
      shift 2
      ;;
    --exa-num-results)
      EXA_NUM_RESULTS="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$QUERY" ]]; then
        QUERY="$1"
        shift
      else
        echo "unknown argument: $1" >&2
        usage >&2
        exit 2
      fi
      ;;
  esac
done

if [[ -n "$QUERY_FILE" ]]; then
  QUERY="$(cat "$QUERY_FILE")"
fi

if [[ -z "${QUERY// }" ]]; then
  echo "deepseek-search.sh: query is required" >&2
  usage >&2
  exit 2
fi

build_output() {
  local payload_file="$1"
  if [[ "$OUTPUT_JSON" -eq 1 ]]; then
    cat "$payload_file"
  else
    python3 - "$payload_file" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding='utf-8'))
print(f"channel: {data.get('channel')}")
print(f"provider: {data.get('provider')}")
print(f"status: {data.get('status')}")
summary = data.get('summary')
if summary:
    print(f"summary: {summary}")
answer = data.get('answerText')
if answer:
    print("\nanswer:\n" + answer)
sources = data.get('sourceLinks') or []
if sources:
    print("\nsources:")
    for item in sources:
        href = item.get('href') if isinstance(item, dict) else str(item)
        print(f"- {href}")
if data.get('evidenceDir'):
    print(f"\nevidenceDir: {data['evidenceDir']}")
if data.get('verdictPath'):
    print(f"verdictPath: {data['verdictPath']}")
PY
  fi
}

fallback_detail_phrase() {
  local detail="${LAST_EXA_FALLBACK_ERROR:-}"
  if [[ -z "$detail" ]]; then
    echo "unavailable"
  elif [[ "$detail" == "disabled-by-flag" || "$detail" == missing-exa-fallback-script* ]]; then
    echo "unavailable ($detail)"
  else
    echo "failed: $detail"
  fi
}

write_fail_payload() {
  local out_path="$1"
  local summary="$2"
  python3 - "$out_path" "$summary" <<'PY'
import json, sys
path, summary = sys.argv[1:3]
payload = {
    'channel': 'none',
    'status': 'FAIL',
    'summary': summary,
    'answerText': None,
    'sourceLinks': [],
    'evidenceDir': None,
    'verdictPath': None,
}
with open(path, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
PY
}

append_fallback_error_to_payload() {
  local out_path="$1"
  local detail="${LAST_EXA_FALLBACK_ERROR:-}"
  if [[ -z "$detail" || ! -f "$out_path" ]]; then
    return 0
  fi
  python3 - "$out_path" "$detail" <<'PY'
import json, sys
path, detail = sys.argv[1:3]
try:
    data = json.load(open(path, encoding='utf-8'))
except Exception:
    raise SystemExit(0)
summary = (data.get('summary') or '').strip()
suffix = f"Exa fallback failed: {detail}"
if suffix not in summary:
    data['summary'] = f"{summary}. {suffix}".strip('. ')
with open(path, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
PY
}

run_exa_fallback() {
  local reason="$1"
  local tmp_json="$2"
  LAST_EXA_FALLBACK_ERROR=""

  if [[ "$ALLOW_EXA_FALLBACK" -ne 1 ]]; then
    LAST_EXA_FALLBACK_ERROR="disabled-by-flag"
    return 1
  fi
  if [[ ! -x "$EXA_FALLBACK_SCRIPT" ]]; then
    LAST_EXA_FALLBACK_ERROR="missing-exa-fallback-script:$EXA_FALLBACK_SCRIPT"
    return 1
  fi

  local exa_raw
  if ! exa_raw="$($EXA_FALLBACK_SCRIPT --query "$QUERY" --num-results "$EXA_NUM_RESULTS" --research --json 2>&1)"; then
    LAST_EXA_FALLBACK_ERROR="$(python3 - "$exa_raw" <<'PY'
import re, sys
raw = (sys.argv[1] if len(sys.argv) > 1 else '').strip()
raw = re.sub(r'\s+', ' ', raw)
print((raw[:400] or 'exa-fallback-command-failed'))
PY
)"
    return 1
  fi

  python3 - "$tmp_json" "$reason" "$exa_raw" <<'PY'
import json, sys
out_path, reason, exa_raw = sys.argv[1:4]
exa = json.loads(exa_raw)
exa['status'] = 'FALLBACK'
exa['summary'] = f"DeepSeek smart-search unavailable or insufficient; fell back to Exa. reason={reason}. {exa.get('summary', '')}".strip()
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(exa, f, ensure_ascii=False, indent=2)
PY
  if [[ -x "$NORMALIZER_SCRIPT" ]]; then
    python3 "$NORMALIZER_SCRIPT" "$tmp_json"
  fi
  return 0
}

if [[ ! -x "$RUNNER_SCRIPT" ]]; then
  tmp_json="$(mktemp -t agent-reach-deepseek-output)"
  if run_exa_fallback "missing-runner-script" "$tmp_json"; then
    build_output "$tmp_json"
    exit 0
  fi
  write_fail_payload "$tmp_json" "DeepSeek runner script missing and Exa fallback $(fallback_detail_phrase)"
  build_output "$tmp_json"
  exit 1
fi

if ! command -v agent-browser >/dev/null 2>&1; then
  tmp_json="$(mktemp -t agent-reach-deepseek-output)"
  if run_exa_fallback "missing-agent-browser" "$tmp_json"; then
    build_output "$tmp_json"
    exit 0
  fi
  write_fail_payload "$tmp_json" "agent-browser not found and Exa fallback $(fallback_detail_phrase)"
  build_output "$tmp_json"
  exit 1
fi

mkdir -p "$ARTIFACT_ROOT" "$PROFILE_DIR"
TMP_JSON="$(mktemp -t agent-reach-deepseek-output)"
trap 'rm -f "$TMP_JSON"' EXIT

set +e
python3 "$RUNNER_SCRIPT" \
  --query "$QUERY" \
  --output "$TMP_JSON" \
  --normalizer "$NORMALIZER_SCRIPT" \
  --profile-dir "$PROFILE_DIR" \
  --artifact-root "$ARTIFACT_ROOT" \
  --scenario "$SCENARIO" \
  --first-answer-ms "$FIRST_ANSWER_MS" \
  --full-answer-ms "$FULL_ANSWER_MS" \
  --min-source-count "$MIN_SOURCE_COUNT" \
  --expected-answer-min-chars "$EXPECTED_ANSWER_MIN_CHARS"
RUN_EXIT=$?
set -e

if [[ "$RUN_EXIT" -eq 0 ]]; then
  STATUS="$(python3 - "$TMP_JSON" <<'PY'
import json, sys
print((json.load(open(sys.argv[1], encoding='utf-8')).get('status') or '').strip())
PY
)"
  if [[ "$STATUS" == "PASS" ]]; then
    build_output "$TMP_JSON"
    exit 0
  fi
fi

FAIL_REASON="run-exit-$RUN_EXIT"
if [[ -f "$TMP_JSON" ]]; then
  FAIL_REASON="$(python3 - "$TMP_JSON" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1], encoding='utf-8'))
except Exception:
    data = {}
status = (data.get('status') or '').strip()
code = ((data.get('failure') or {}).get('code') or (data.get('verdict') or {}).get('failure', {}).get('code') or '').strip()
parts = [p for p in [status, code] if p]
print('-'.join(parts) if parts else 'deepseek-runner-no-detail')
PY
)"
fi

if run_exa_fallback "$FAIL_REASON" "$TMP_JSON"; then
  build_output "$TMP_JSON"
  exit 0
fi

append_fallback_error_to_payload "$TMP_JSON"

if [[ -x "$NORMALIZER_SCRIPT" && -f "$TMP_JSON" ]]; then
  python3 "$NORMALIZER_SCRIPT" "$TMP_JSON" || true
fi
build_output "$TMP_JSON"
exit 1
