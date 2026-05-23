#!/usr/bin/env bash
set -euo pipefail

AGENT_REACH_ENV_FILE="${AGENT_REACH_ENV_FILE:-$HOME/.agent-reach/env}"
if [[ -f "$AGENT_REACH_ENV_FILE" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$AGENT_REACH_ENV_FILE"
  set +a
fi

EXA_API_KEY_VALUE="${AGENT_REACH_EXA_API_KEY:-${EXA_API_KEY:-}}"
EXA_BASE_URL_VALUE="${AGENT_REACH_EXA_BASE_URL:-${EXA_BASE_URL:-https://api.exa.ai}}"
EXA_NUM_RESULTS_VALUE="${AGENT_REACH_EXA_NUM_RESULTS:-5}"
EXA_SEARCH_TYPE_VALUE="${AGENT_REACH_EXA_SEARCH_TYPE:-auto}"
NORMALIZER_SCRIPT="${AGENT_REACH_NORMALIZER_SCRIPT:-/Users/handy/.claude/skills/agent-reach/scripts/normalize-research-output.py}"
JINA_ENRICH_TOP_N="${AGENT_REACH_JINA_ENRICH_TOP_N:-2}"
JINA_TIMEOUT_SEC="${AGENT_REACH_JINA_TIMEOUT_SEC:-15}"
OUTPUT_JSON=1
RESEARCH_MODE=0
PREFER_OFFICIAL=1
ENABLE_JINA_ENRICH=1
QUERY=""
QUERY_FILE=""
INCLUDE_DOMAINS=()
EXCLUDE_DOMAINS=()

usage() {
  cat <<'EOF'
usage: exa-search.sh [options] --query "your question"

options:
  --query <text>              search query
  --query-file <file>         read query from file
  --num-results <n>           default 5
  --type <type>               auto | fast | instant | deep-lite | deep | deep-reasoning | neural
  --include-domain <domain>   may repeat
  --exclude-domain <domain>   may repeat
  --research                  ask Exa for synthesized Chinese research answer
  --no-prefer-official        keep Exa result order, do not prefer official/authoritative domains
  --jina-enrich-top-n <n>     fetch top N result pages via Jina for better evidence, default 2
  --no-jina-enrich            disable Jina body enrichment
  --text                      print compact text instead of JSON
  --json                      print JSON (default)
  -h, --help                  show this help

env:
  EXA_API_KEY or AGENT_REACH_EXA_API_KEY
  EXA_BASE_URL or AGENT_REACH_EXA_BASE_URL
  AGENT_REACH_ENV_FILE default ~/.agent-reach/env
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
    --num-results)
      EXA_NUM_RESULTS_VALUE="$2"
      shift 2
      ;;
    --type)
      EXA_SEARCH_TYPE_VALUE="$2"
      shift 2
      ;;
    --include-domain)
      INCLUDE_DOMAINS+=("$2")
      shift 2
      ;;
    --exclude-domain)
      EXCLUDE_DOMAINS+=("$2")
      shift 2
      ;;
    --research)
      RESEARCH_MODE=1
      shift
      ;;
    --no-prefer-official)
      PREFER_OFFICIAL=0
      shift
      ;;
    --jina-enrich-top-n)
      JINA_ENRICH_TOP_N="$2"
      shift 2
      ;;
    --no-jina-enrich)
      ENABLE_JINA_ENRICH=0
      shift
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
  echo "exa-search.sh: query is required" >&2
  usage >&2
  exit 2
fi

if [[ -z "$EXA_API_KEY_VALUE" ]]; then
  echo "exa-search.sh: missing EXA_API_KEY or AGENT_REACH_EXA_API_KEY" >&2
  exit 2
fi

TMP_JSON="$(mktemp -t agent-reach-exa)"
trap 'rm -f "$TMP_JSON"' EXIT

python3 - "$TMP_JSON" "$EXA_BASE_URL_VALUE" "$EXA_API_KEY_VALUE" "$QUERY" "$EXA_NUM_RESULTS_VALUE" "$EXA_SEARCH_TYPE_VALUE" "${INCLUDE_DOMAINS[*]:-}" "${EXCLUDE_DOMAINS[*]:-}" "$RESEARCH_MODE" "$PREFER_OFFICIAL" "$JINA_ENRICH_TOP_N" "$JINA_TIMEOUT_SEC" "$ENABLE_JINA_ENRICH" <<'PY'
import json
import re
import sys
import urllib.error
import urllib.request
from urllib.parse import urlparse

(
    out_path,
    base_url,
    api_key,
    query,
    num_results,
    search_type,
    include_domains_raw,
    exclude_domains_raw,
    research_mode_raw,
    prefer_official_raw,
    jina_enrich_top_n_raw,
    jina_timeout_sec_raw,
    enable_jina_enrich_raw,
) = sys.argv[1:14]

base_url = base_url.rstrip('/')
num_results = int(num_results)
research_mode = research_mode_raw == '1'
prefer_official = prefer_official_raw == '1'
jina_enrich_top_n = max(0, int(jina_enrich_top_n_raw))
jina_timeout_sec = max(1, int(jina_timeout_sec_raw))
enable_jina_enrich = enable_jina_enrich_raw == '1'
include_domains = [d for d in include_domains_raw.split() if d]
exclude_domains = [d for d in exclude_domains_raw.split() if d]

body = {
    'query': query,
    'type': search_type,
    'numResults': num_results,
    'contents': {
        'highlights': True,
    },
}
if include_domains:
    body['includeDomains'] = include_domains
if exclude_domains:
    body['excludeDomains'] = exclude_domains
if research_mode:
    body['outputSchema'] = {'type': 'text'}
    body['systemPrompt'] = '请用中文输出：1) 3-5 条核心结论；2) 关键证据点；3) 单独列出来源链接。优先采用官方、原始、权威来源，避免重复来源。'

req = urllib.request.Request(
    f'{base_url}/search',
    data=json.dumps(body, ensure_ascii=False).encode('utf-8'),
    headers={
        'Content-Type': 'application/json',
        'x-api-key': api_key,
    },
    method='POST',
)

try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        raw = resp.read().decode('utf-8', 'replace')
except urllib.error.HTTPError as e:
    detail = e.read().decode('utf-8', 'replace') if hasattr(e, 'read') else str(e)
    raise SystemExit(f'HTTP {e.code}: {detail}')
except Exception as e:
    raise SystemExit(str(e))

try:
    data = json.loads(raw)
except Exception:
    raise SystemExit(f'non-json response: {raw[:500]}')


def normalized_url(value: str) -> str:
    value = (value or '').strip()
    if not value:
        return ''
    parsed = urlparse(value)
    path = parsed.path or '/'
    if path != '/' and path.endswith('/'):
        path = path[:-1]
    return f'{parsed.scheme}://{parsed.netloc.lower()}{path}'


def domain_rank(value: str) -> int:
    host = (urlparse(value).netloc or '').lower()
    path = (urlparse(value).path or '').lower()
    score = 0
    if host.endswith('.gov') or '.gov.' in host:
        score += 60
    if host.endswith('.edu') or '.edu.' in host:
        score += 55
    if host.startswith('docs.') or '/docs' in path or '/reference' in path or '/api' in path:
        score += 40
    if host.startswith('developer.') or host.startswith('developers.'):
        score += 35
    if host.endswith('.org'):
        score += 15
    if host.endswith('github.com') or host.endswith('arxiv.org'):
        score += 20
    return score


def query_terms(text: str):
    ascii_terms = [m.lower() for m in re.findall(r'[A-Za-z][A-Za-z0-9+._-]{1,}', text)]
    cjk_terms = re.findall(r'[\u4e00-\u9fff]{2,12}', text)
    stop_cjk = {
        '是什么', '什么', '请给出', '给出', '来源', '高质量来源',
        '研究问题', '请用', '问题', '一个', '哪些', '如何'
    }
    terms = []
    for token in ascii_terms:
        if token not in {'what', 'is', 'the', 'and'}:
            terms.append(token)
    for token in cjk_terms:
        if token not in stop_cjk and len(token) >= 2:
            terms.append(token)
    dedup = []
    seen = set()
    for token in terms:
        if token not in seen:
            seen.add(token)
            dedup.append(token)
    return dedup[:12]


QUERY_TERMS = query_terms(query)
NOISE_KEYWORDS = {
    '登录', '注册', '首页', '导航', '菜单', '版权', '隐私', 'cookie', 'cookies', '条款', '联系我们',
    '关于我们', '上一篇', '下一篇', '相关阅读', '相关推荐', '下载app', 'app下载', '展开全部',
    '点击查看', '广告', '赞助', '订阅', '分享', '举报', '评论', '点赞', '收藏', '返回顶部'
}


def cleanup_markdown(line: str) -> str:
    line = line.strip()
    if not line:
        return ''
    line = re.sub(r'!\[[^\]]*\]\([^\)]*\)', ' ', line)
    line = re.sub(r'\[([^\]]+)\]\([^\)]*\)', r'\1', line)
    line = re.sub(r'<[^>]+>', ' ', line)
    line = re.sub(r'https?://\S+', ' ', line)
    line = re.sub(r'^#+\s*', '', line)
    line = re.sub(r'^[>*\-]+\s*', '', line)
    line = re.sub(r'\[[Ii]mage[^\]]*\]', ' ', line)
    line = re.sub(r'[_`~|]+', ' ', line)
    line = re.sub(r'\s+', ' ', line).strip()
    return line


def is_noise_line(line: str) -> bool:
    compact = line.lower().replace(' ', '')
    if not compact:
        return True
    if re.match(r'^(title:|urlsource:|markdowncontent:)', compact, re.I):
        return True
    if len(line) < 24 and not re.search(r'[。！？；：:]', line):
        return True
    if sum(1 for key in NOISE_KEYWORDS if key.lower().replace(' ', '') in compact) >= 2:
        return True
    if line.count('/') >= 4 or line.count('|') >= 4:
        return True
    if re.search(r'(?:^|\s)(home|menu|login|signup|privacy|terms)(?:\s|$)', line, re.I):
        return True
    bracket_density = sum(line.count(ch) for ch in '[](){}') / max(len(line), 1)
    if bracket_density > 0.12:
        return True
    uppercase_chars = sum(1 for ch in line if 'A' <= ch <= 'Z')
    alpha_chars = sum(1 for ch in line if ch.isalpha())
    if alpha_chars >= 12 and uppercase_chars / alpha_chars > 0.45:
        return True
    return False


def line_score(line: str) -> int:
    score = 0
    lower = line.lower()
    for token in QUERY_TERMS:
        if token.lower() in lower:
            score += 4 if len(token) >= 4 else 2
    if re.search(r'[。！？；：:]', line):
        score += 2
    if 35 <= len(line) <= 220:
        score += 2
    elif len(line) > 220:
        score += 1
    if any(term in line for term in ['定义', '核心', '流程', '步骤', '机制', '优势', '准确性', '检索', '生成', '向量', '数据库']):
        score += 2
    if any(key in line for key in NOISE_KEYWORDS):
        score -= 4
    if re.search(r'\b(?:copyright|all rights reserved)\b', lower):
        score -= 5
    return score


def split_candidate_sentences(line: str):
    pieces = re.split(r'(?<=[。！？；])\s+|(?<=\.)\s+(?=[A-Z])', line)
    cleaned = []
    for piece in pieces:
        part = cleanup_markdown(piece)
        if part:
            cleaned.append(part)
    return cleaned or [line]


def clean_jina_excerpt(raw_text: str) -> str:
    candidates = []
    for raw_line in raw_text.splitlines():
        line = cleanup_markdown(raw_line)
        if not line or is_noise_line(line):
            continue
        for piece in split_candidate_sentences(line):
            piece = cleanup_markdown(piece)
            if not piece or is_noise_line(piece):
                continue
            candidates.append(piece)

    scored = []
    seen = set()
    for idx, line in enumerate(candidates):
        if line in seen:
            continue
        seen.add(line)
        scored.append((line_score(line), idx, line))

    chosen = [item for item in scored if item[0] >= 3]
    if not chosen:
        chosen = sorted(scored, key=lambda item: (-item[0], -len(item[2])))[:3]
    else:
        chosen = sorted(chosen, key=lambda item: (-item[0], item[1]))[:3]

    ordered = [line for _, _, line in sorted(chosen, key=lambda item: item[1])]
    text = ' '.join(ordered)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:900]


def fetch_jina_excerpt(url: str):
    target = f'https://r.jina.ai/{url}'
    req = urllib.request.Request(
        target,
        headers={
            'Accept': 'text/plain',
            'User-Agent': 'agent-reach/1.0',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=jina_timeout_sec) as resp:
            raw_text = resp.read().decode('utf-8', 'replace')
    except Exception:
        return ''
    return clean_jina_excerpt(raw_text)


raw_results = data.get('results') or []
seen_urls = set()
prepared = []
for item in raw_results:
    url = str(item.get('url') or '').strip()
    norm = normalized_url(url)
    if norm and norm in seen_urls:
        continue
    if norm:
        seen_urls.add(norm)
    prepared.append(item)

if prefer_official:
    prepared.sort(key=lambda item: (-domain_rank(str(item.get('url') or '')), str(item.get('publishedDate') or '')), reverse=False)
    prepared.sort(key=lambda item: -domain_rank(str(item.get('url') or '')))

enrichment = {
    'enabled': enable_jina_enrich,
    'topN': jina_enrich_top_n,
    'attempted': 0,
    'succeeded': 0,
}
source_links = []
source_seen = set()
answer_parts = []
trimmed_results = []
for idx, item in enumerate(prepared, start=1):
    url = str(item.get('url') or '').strip()
    title = str(item.get('title') or '').strip()
    summary = str(item.get('summary') or '').strip()
    highlights = [str(x).strip() for x in (item.get('highlights') or []) if str(x).strip()]
    text = str(item.get('text') or '').strip()
    evidence_text = ''
    if enable_jina_enrich and idx <= jina_enrich_top_n and url:
        enrichment['attempted'] += 1
        evidence_text = fetch_jina_excerpt(url)
        if evidence_text:
            enrichment['succeeded'] += 1

    snippet = summary or ('；'.join(highlights[:2]) if highlights else '')
    if not snippet:
        snippet = evidence_text[:400] if evidence_text else text[:400]

    norm = normalized_url(url)
    if url and norm not in source_seen:
        source_seen.add(norm)
        source_links.append({'href': url, 'text': title or url})

    block = [f'{idx}. {title or url or "(untitled)"}']
    if url:
        block.append(f'URL: {url}')
    if snippet:
        block.append(f'摘要: {snippet}')
    if evidence_text:
        block.append(f'证据摘录: {evidence_text[:320]}')
    answer_parts.append('\n'.join(block))

    trimmed_results.append({
        'title': title,
        'url': url,
        'publishedDate': item.get('publishedDate'),
        'author': item.get('author'),
        'summary': summary,
        'highlights': highlights[:3],
        'qualityScore': domain_rank(url),
        'evidenceText': evidence_text,
    })

output = data.get('output') or {}
grounding = output.get('grounding') or []
for field in grounding:
    for citation in field.get('citations') or []:
        url = str(citation.get('url') or '').strip()
        title = str(citation.get('title') or '').strip()
        norm = normalized_url(url)
        if url and norm not in source_seen:
            source_seen.add(norm)
            source_links.append({'href': url, 'text': title or url})

answer_text = str(output.get('content') or '').strip() if research_mode else ''
if not answer_text:
    answer_text = '\n\n'.join(answer_parts)

payload = {
    'channel': 'exa-search-api',
    'status': 'PASS',
    'summary': f'Exa search completed. searchType={data.get("searchType") or search_type}; results={len(prepared)}; researchMode={research_mode}; jinaEnriched={enrichment["succeeded"]}/{enrichment["attempted"]}.',
    'answerText': answer_text,
    'sourceLinks': source_links,
    'requestId': data.get('requestId'),
    'searchType': data.get('searchType') or search_type,
    'costDollars': data.get('costDollars'),
    'researchMode': research_mode,
    'results': trimmed_results,
    'grounding': grounding,
    'enrichment': enrichment,
    'rawResponse': data,
}

with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)
PY

if [[ -x "$NORMALIZER_SCRIPT" ]]; then
  python3 "$NORMALIZER_SCRIPT" "$TMP_JSON"
fi

if [[ "$OUTPUT_JSON" -eq 1 ]]; then
  cat "$TMP_JSON"
else
  python3 - "$TMP_JSON" <<'PY'
import json
import sys

path = sys.argv[1]
data = json.load(open(path, encoding='utf-8'))
print(f"channel: {data.get('channel')}")
print(f"status: {data.get('status')}")
print(f"summary: {data.get('summary')}")
if data.get('answerText'):
    print("\nanswer:\n" + data['answerText'])
if data.get('sourceLinks'):
    print("\nsources:")
    for item in data['sourceLinks']:
        print(f"- {item.get('href')}")
if data.get('requestId'):
    print(f"\nrequestId: {data['requestId']}")
PY
fi
