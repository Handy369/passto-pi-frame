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
DEEPSEEK_SCRIPT="${AGENT_REACH_DEEPSEEK_SCRIPT:-$SCRIPT_DIR/deepseek-search.sh}"
EXA_SCRIPT="${AGENT_REACH_EXA_SCRIPT:-$SCRIPT_DIR/exa-search.sh}"
OUTPUT_JSON=1
QUERY=""
QUERY_FILE=""
FORCE_PROVIDER=""

usage() {
  cat <<'EOF'
usage: research-search.sh [options] --query "your question"

options:
  --query <text>         research query
  --query-file <file>    read query from file
  --provider <name>      auto | deepseek | exa (default auto)
  --text                 print compact text instead of JSON
  --json                 print JSON (default)
  -h, --help             show this help

env:
  AGENT_REACH_ENV_FILE   default ~/.agent-reach/env
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
    --provider)
      FORCE_PROVIDER="$2"
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
  echo "research-search.sh: query is required" >&2
  usage >&2
  exit 2
fi

render_text() {
  local payload_file="$1"
  python3 - "$payload_file" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding='utf-8'))
print(f"channel: {data.get('channel')}")
print(f"provider: {data.get('provider')}")
print(f"status: {data.get('status')}")
print(f"summary: {data.get('summary')}")
route = data.get('route') or []
if route:
    print(f"route: {' -> '.join(route)}")
if data.get('coreFindings'):
    print("\ncoreFindings:")
    for item in data['coreFindings']:
        print(f"- {item}")
if data.get('evidencePoints'):
    print("\nevidencePoints:")
    for item in data['evidencePoints']:
        print(f"- {item}")
if data.get('uncertainties'):
    print("\nuncertainties:")
    for item in data['uncertainties']:
        print(f"- {item}")
uncertainty_structured = data.get('uncertaintyStructured') or {}
if uncertainty_structured.get('conflicts'):
    print("\nconflicts:")
    for item in uncertainty_structured['conflicts']:
        print(f"- {item.get('text')}")
if uncertainty_structured.get('stalenessRisks'):
    print("\nstalenessRisks:")
    for item in uncertainty_structured['stalenessRisks']:
        print(f"- {item.get('text')}")
if uncertainty_structured.get('coverageGaps'):
    print("\ncoverageGaps:")
    for item in uncertainty_structured['coverageGaps']:
        print(f"- {item.get('text')}")
if data.get('sourceLinks'):
    print("\nsources:")
    for item in data['sourceLinks']:
        print(f"- {item.get('href')}")
if data.get('requestId'):
    print(f"\nrequestId: {data['requestId']}")
PY
}

TMP_JSON="$(mktemp -t agent-reach-research-search)"
trap 'rm -f "$TMP_JSON"' EXIT

provider="${FORCE_PROVIDER:-auto}"
case "$provider" in
  auto)
    if [[ ! -x "$DEEPSEEK_SCRIPT" ]]; then
      echo "research-search.sh: missing deepseek-search.sh" >&2
      exit 1
    fi
    "$DEEPSEEK_SCRIPT" --json --query "$QUERY" > "$TMP_JSON"
    ;;
  deepseek)
    "$DEEPSEEK_SCRIPT" --json --query "$QUERY" > "$TMP_JSON"
    ;;
  exa)
    "$EXA_SCRIPT" --research --json --query "$QUERY" > "$TMP_JSON"
    ;;
  *)
    echo "research-search.sh: unsupported provider '$provider'" >&2
    exit 2
    ;;
esac

if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  cat "$TMP_JSON"
else
  render_text "$TMP_JSON"
fi
