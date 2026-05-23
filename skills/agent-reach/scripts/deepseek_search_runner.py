#!/usr/bin/env python3
import argparse
import json
import os
import re
import shlex
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse


ENTRY_PROBE_JS = r'''({url:location.href,title:document.title,hasTextarea:!!document.querySelector("textarea"),hasChatLink:!!Array.from(document.querySelectorAll("a")).find(a => (a.href||"").includes("chat.deepseek.com")),bodySnippet:(document.body?.innerText||"").replace(/\s+/g," ").slice(0,800)})'''

CHAT_PROBE_JS = r'''({url:location.href,title:document.title,hasTextarea:!!document.querySelector("textarea"),bodySnippet:(document.body?.innerText||"").replace(/\s+/g," ").slice(0,2000)})'''

ANSWER_PROBE_JS = r'''(() => {
  const normalizeLine = (line) => (line || '').replace(/[ \t]+/g, ' ').trim();
  const normalizeMultiline = (text) => (text || '').split(/\n+/).map(normalizeLine).filter(Boolean).join('\n');
  const cleanUrl = (value) => (value || '').trim().replace(/\x60/g, '').replace(/^[~()\[\]{}<>,;\"']+|[~()\[\]{}<>,;\"']+$/g, '').replace(/[。；，、]+$/g, '');
  const isExternalHref = (href) => href && /^https?:\/\//i.test(href) && !href.includes('chat.deepseek.com');
  const collectLinks = (root) => {
    const out = [];
    const seen = new Set();
    for (const a of Array.from((root || document).querySelectorAll('a[href]'))) {
      const href = cleanUrl(a.href || '');
      const text = normalizeLine((a.innerText || a.textContent || '').slice(0, 220));
      if (!isExternalHref(href) || seen.has(href)) continue;
      seen.add(href);
      out.push({ href, text: text || href });
      if (out.length >= 80) break;
    }
    return out;
  };
  const trimFooter = (text) => {
    let value = normalizeMultiline(text);
    for (const marker of [
      '\n深度思考\n智能搜索\n内容由 AI 生成，请仔细甄别',
      '\n内容由 AI 生成，请仔细甄别',
      '\n深度思考\n智能搜索',
      '\n深度思考\n智能搜索\n',
      '\n智能搜索\n',
    ]) {
      const idx = value.indexOf(marker);
      if (idx !== -1) value = value.slice(0, idx);
    }
    return value.trim();
  };
  const extractCandidate = (text) => {
    let value = trimFooter(text);
    let start = -1;
    for (const header of ['[CORE_FINDINGS]', '[EVIDENCE]', '[UNCERTAINTIES]', '[SOURCE_SITES]', '[SOURCE_URLS]']) {
      const idx = value.lastIndexOf(header);
      if (idx !== -1) {
        start = idx;
        if (header === '[CORE_FINDINGS]') break;
      }
    }
    if (start !== -1) value = value.slice(start);
    return value.trim().slice(0, 24000);
  };

  const bodyText = normalizeMultiline(document.body?.innerText || '').slice(0, 24000);
  const sourceLinks = collectLinks(document);
  const sectionCandidates = [];
  const sectionsRe = /\[CORE_FINDINGS\]|\[EVIDENCE\]|\[SOURCE_URLS\]|\[SOURCE_SITES\]|F1\.|E1\.|URL1\.|来源：/;
  const promptLeakRe = /强制输出格式|研究问题：|<核心结论1|<关键证据1|给 DeepSeek 发送消息/;
  const historyLeakRe = /开启新对话|快速模式|今天|会话确认回复|pi coding agent 0\./;

  for (const el of Array.from(document.querySelectorAll('main,article,section,div,li'))) {
    const rawText = normalizeMultiline(el.innerText || '');
    if (!rawText || rawText.length < 120 || !sectionsRe.test(rawText)) continue;
    const candidateText = extractCandidate(rawText);
    if (!candidateText || candidateText.length < 80) continue;
    const links = collectLinks(el);
    let score = 0;
    if (candidateText.includes('[CORE_FINDINGS]')) score += 5000;
    if (candidateText.includes('[SOURCE_URLS]')) score += 4000;
    if (candidateText.includes('[SOURCE_SITES]')) score += 2500;
    if (candidateText.includes('[UNCERTAINTIES]')) score += 1500;
    if (/\bF1\./.test(candidateText)) score += 1400;
    if (/\bE1\./.test(candidateText)) score += 900;
    if (/\bURL1\./.test(candidateText)) score += 1200;
    if (/\bS1\./.test(candidateText)) score += 800;
    if (/来源：/.test(candidateText)) score += 500;
    score += Math.min(candidateText.length, 12000);
    score += links.length * 120;
    if (promptLeakRe.test(rawText)) score -= 4000;
    if (historyLeakRe.test(rawText)) score -= 2500;
    if (el === document.body) score -= 5000;
    if (rawText.length > 16000) score -= Math.floor((rawText.length - 16000) / 2);
    sectionCandidates.push({
      score,
      candidateText,
      rawText,
      rawLength: rawText.length,
      tagName: el.tagName,
      className: String(el.className || '').slice(0, 160),
      sourceLinks: links,
      kind: 'section',
      hasStructuredSection: /\[CORE_FINDINGS\]|\[EVIDENCE\]|\[SOURCE_URLS\]|\[SOURCE_SITES\]/.test(candidateText),
    });
  }

  const clusterCandidates = [];
  const clusterMap = new Map();
  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    const href = cleanUrl(anchor.href || '');
    if (!isExternalHref(href)) continue;
    let current = anchor.parentElement;
    let depth = 0;
    while (current && current !== document.body && depth <= 8) {
      const existing = clusterMap.get(current) || { el: current, hrefs: new Set(), minDepth: depth };
      existing.hrefs.add(href);
      existing.minDepth = Math.min(existing.minDepth, depth);
      clusterMap.set(current, existing);
      current = current.parentElement;
      depth += 1;
    }
  }

  for (const { el, hrefs, minDepth } of clusterMap.values()) {
    const rawText = normalizeMultiline(el.innerText || '');
    if (!rawText || rawText.length < 100 || rawText.length > 12000) continue;
    const links = collectLinks(el);
    const linkCount = hrefs.size;
    let score = linkCount * 2800;
    score += Math.min(rawText.length, 5000);
    score -= Math.max(0, rawText.length - 2400);
    score -= minDepth * 40;
    if (/https?:\/\//.test(rawText)) score += 500;
    if (promptLeakRe.test(rawText)) score -= 5000;
    if (historyLeakRe.test(rawText)) score -= 3500;
    if (el.querySelector('textarea')) score -= 4000;
    clusterCandidates.push({
      score,
      candidateText: trimFooter(rawText),
      rawText,
      rawLength: rawText.length,
      tagName: el.tagName,
      className: String(el.className || '').slice(0, 160),
      sourceLinks: links,
      kind: 'link-cluster',
      hasStructuredSection: /\[CORE_FINDINGS\]|\[EVIDENCE\]|\[SOURCE_URLS\]|\[SOURCE_SITES\]/.test(rawText),
      linkCount,
    });
  }

  sectionCandidates.sort((a, b) => b.score - a.score || b.candidateText.length - a.candidateText.length);
  clusterCandidates.sort((a, b) => b.score - a.score || b.candidateText.length - a.candidateText.length);
  const bestSection = sectionCandidates[0] || null;
  const bestCluster = clusterCandidates[0] || null;
  const best = (bestSection && bestSection.hasStructuredSection) ? bestSection : (bestCluster || bestSection);
  const answerBlockText = best ? best.candidateText : '';
  const answerBlockSourceLinks = best ? best.sourceLinks : [];
  const answerCandidateText = answerBlockText || extractCandidate(bodyText);
  let sourceSectionText = '';
  for (const header of ['[SOURCE_SITES]', '[SOURCE_URLS]']) {
    const idx = answerCandidateText.indexOf(header);
    if (idx !== -1) {
      sourceSectionText = answerCandidateText.slice(idx).trim();
      break;
    }
  }

  return {
    url: location.href,
    title: document.title,
    hasTextarea: !!document.querySelector('textarea'),
    bodyText,
    sourceLinks,
    answerCandidateText,
    answerBlockText,
    answerBlockSourceLinks,
    sourceSectionText,
    answerBlockMeta: best ? {
      score: best.score,
      rawLength: best.rawLength,
      tagName: best.tagName,
      className: best.className,
      sourceLinkCount: answerBlockSourceLinks.length,
      kind: best.kind || 'unknown',
      linkCount: best.linkCount || answerBlockSourceLinks.length,
    } : null,
    candidateCount: sectionCandidates.length + clusterCandidates.length,
  };
})()'''


PROMPT_TEMPLATE = '''请使用智能搜索，对下面的问题做聚合深度搜索。

你是给下游 Agent 提供结构化研究材料，不要写面向人类的长篇解释，不要省略来源。

强制输出格式：
[CORE_FINDINGS]
F1. <核心结论1。来源：站点名1、站点名2>
F2. <核心结论2。来源：站点名1、站点名2>
F3. <核心结论3。来源：站点名1、站点名2>
- 共 3-5 条；每条必须以 F数字. 开头；每条单独一行；不要把多条结论写成同一行。

[SOURCE_SITES]
S1. <站点名或域名1>
S2. <站点名或域名2>
- 每行一个；每条必须以 S数字. 开头；先列最重要来源。

[SOURCE_URLS]
URL1. <完整URL1>
URL2. <完整URL2>
URL3. <完整URL3>
- 只输出完整 URL；每行一个；不要 Markdown；不要行内解释；至少 3 个；每条必须以 URL数字. 开头；优先官方、原始、权威来源。
- S1 必须对应 URL1，S2 必须对应 URL2，依此类推；如果列出 AWS/IBM/Pinecone/LangChain/DeepLearning.AI，就必须给出其对应官方 URL。

[EVIDENCE]
E1. <关键证据1。来源：站点名或域名>
E2. <关键证据2。来源：站点名或域名>
E3. <关键证据3。来源：站点名或域名>
- 共 3-6 条；每条必须以 E数字. 开头；每条单独一行；优先写定义、流程、机制、数据点；尽量短，避免长段落。

[UNCERTAINTIES]
C1. <来源之间的结论冲突或定义冲突；如无则可省略>
T1. <时效性风险、版本风险、发布日期风险；如无则可省略>
G1. <覆盖不足、实现细节依赖场景、缺少统一标准等 coverage gap；如无则可省略>
U1. <其他不确定性；若整体无明显问题则写 U1. 无>
- 冲突必须用 C数字. 开头。
- 时效性风险必须用 T数字. 开头。
- 覆盖缺口必须用 G数字. 开头。
- 其他一般不确定性用 U数字. 开头。

额外要求：
1. 不要把多个结论或证据写成一整段。
2. 不要只写网站名，尽量同时给出完整 URL。
3. 如果你在结论/证据里提到 AWS、IBM、Pinecone、DeepLearning.AI、LangChain 之类来源，请确保这些来源在 [SOURCE_SITES] 和 [SOURCE_URLS] 中都出现。
4. 输出必须严格包含以上 5 个 section 标题，且按顺序输出。
5. 绝对不要省略编号前缀；如果未找到足够信息，也保持 section 与编号格式。
6. 如果回答长度受限，优先保留 [SOURCE_SITES] 与 [SOURCE_URLS] 的完整性，再压缩 [EVIDENCE] 条数。

研究问题：
{query}
'''


def parse_args():
    parser = argparse.ArgumentParser(description='Run DeepSeek smart-search through agent-browser and emit research JSON.')
    parser.add_argument('--query', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--normalizer', required=True)
    parser.add_argument('--profile-dir', required=True)
    parser.add_argument('--artifact-root', required=True)
    parser.add_argument('--scenario', default='deepseek-smart-search')
    parser.add_argument('--first-answer-ms', type=int, default=20000)
    parser.add_argument('--full-answer-ms', type=int, default=60000)
    parser.add_argument('--min-source-count', type=int, default=1)
    parser.add_argument('--expected-answer-min-chars', type=int, default=180)
    parser.add_argument('--smart-search', choices=['on', 'off'], default='on')
    parser.add_argument('--poll-interval-sec', type=int, default=5)
    parser.add_argument('--min-ready-polls', type=int, default=2)
    return parser.parse_args()


def now_ms() -> int:
    return int(time.time() * 1000)


def normalize(text: str) -> str:
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def normalize_block(text: str) -> str:
    lines = [re.sub(r'[ \t]+', ' ', line).strip() for line in str(text or '').replace('\r\n', '\n').replace('\r', '\n').split('\n')]
    return '\n'.join(line for line in lines if line).strip()


def clean_url(raw: str) -> str:
    value = str(raw or '').strip().replace('`', '').strip("~()[]{}<>,;\"'")
    value = re.sub(r'[。；，、]+$', '', value)
    return value


def is_probably_valid_url(value: str) -> bool:
    if not value or not value.startswith(('http://', 'https://')):
        return False
    match = re.match(r'^https?://([^/]+)', value)
    if not match:
        return False
    host = match.group(1).strip().lower().strip('.')
    return '.' in host and not any(ch.isspace() for ch in host) and host not in {'hugging', 'localhost'}


def extract_text_urls(text: str):
    urls = []
    seen = set()
    for match in re.findall(r'https?://[^\s)\]>]+', str(text or '')):
        candidate = clean_url(match)
        if not is_probably_valid_url(candidate) or candidate in seen:
            continue
        seen.add(candidate)
        urls.append(candidate)
    return urls


def merge_source_links(*parts):
    out = []
    seen = set()
    for part in parts:
        if isinstance(part, list):
            items = part
        else:
            items = [{'href': href, 'text': href} for href in extract_text_urls(str(part or ''))]
        for item in items or []:
            href = clean_url(str((item or {}).get('href', '')).strip())
            text = str((item or {}).get('text', '')).strip()
            if not href or href in seen:
                continue
            seen.add(href)
            out.append({'href': href, 'text': text or href})
    return out


def extract_answer_segment(body_text: str, prompt_text: str, candidate_text: str = '') -> str:
    candidate_norm = normalize_block(candidate_text)
    if candidate_norm:
        segment = candidate_norm
    else:
        body_norm = normalize_block(body_text)
        prompt_norm = normalize_block(prompt_text)
        if prompt_norm and prompt_norm in body_norm:
            segment = body_norm.split(prompt_norm, 1)[1].strip()
        else:
            segment = body_norm
    for marker in [
        '深度思考\n智能搜索\n内容由 AI 生成，请仔细甄别',
        '内容由 AI 生成，请仔细甄别',
        '深度思考\n智能搜索',
        '深度思考 智能搜索 内容由 AI 生成，请仔细甄别',
        '深度思考 智能搜索',
    ]:
        if marker in segment:
            segment = segment.split(marker, 1)[0].strip()
    return segment.strip()


def detect_error_page(*parts: str):
    text = '\n'.join(normalize_block(part) for part in parts if str(part or '').strip())
    lower = text.lower()
    if not lower:
        return None
    if ('403' in lower and 'request could not be satisfied' in lower) or 'generated by cloudfront' in lower or 'request blocked' in lower:
        return {
            'kind': 'http-blocked',
            'message': 'chat.deepseek.com returned a 403/forbidden style page',
        }
    if 'captcha' in lower or 'verify you are human' in lower or '人机验证' in text or '安全验证' in text:
        return {
            'kind': 'captcha',
            'message': 'chat.deepseek.com required captcha / human verification before interaction',
        }
    if any(token in text for token in ['登录', '登陆']) or 'login' in lower or 'sign in' in lower:
        return {
            'kind': 'auth',
            'message': 'chat.deepseek.com required login before interaction',
        }
    return None


def extract_ref(snapshot_text: str, needles):
    lines = str(snapshot_text or '').splitlines()
    for needle in needles:
        for line in lines:
            if needle not in line:
                continue
            match = re.search(r'\[ref=(e\d+)\]', line)
            if match:
                return match.group(1)
            match = re.search(r'@(e\d+)', line)
            if match:
                return match.group(1)
    return ''


def safe_json_load(path: Path):
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except Exception:
        return {}


def dump_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def append_log(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as f:
        f.write(text)
        if not text.endswith('\n'):
            f.write('\n')


def run_cmd(args, log_path: Path, timeout=None, check=False):
    append_log(log_path, f"$ {' '.join(shlex.quote(a) for a in args)}")
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or ''
        stderr = exc.stderr or ''
        append_log(log_path, stdout)
        append_log(log_path, stderr)
        append_log(log_path, f'TIMEOUT after {timeout}s')
        if check:
            raise
        return 124, stdout, stderr + f'\nTIMEOUT after {timeout}s'

    if result.stdout:
        append_log(log_path, result.stdout)
    if result.stderr:
        append_log(log_path, result.stderr)
    if check and result.returncode != 0:
        raise subprocess.CalledProcessError(result.returncode, args, result.stdout, result.stderr)
    return result.returncode, result.stdout, result.stderr


def build_manifest(root: Path):
    import hashlib
    files = []
    manifest_path = root / 'MANIFEST.json'
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path == manifest_path:
            continue
        rel = path.relative_to(root).as_posix()
        h = hashlib.sha256()
        with path.open('rb') as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b''):
                h.update(chunk)
        files.append({'path': rel, 'sha256': h.hexdigest(), 'size': path.stat().st_size})
    payload = {
        'generatedAtEpochMs': now_ms(),
        'root': str(root),
        'fileCount': len(files),
        'files': files,
    }
    dump_json(manifest_path, payload)


def agent_browser_args(profile_dir: Path, *parts):
    return ['agent-browser', '--profile', str(profile_dir), *parts]


def main():
    args = parse_args()
    profile_dir = Path(os.path.expanduser(args.profile_dir)).resolve()
    artifact_root = Path(os.path.expanduser(args.artifact_root)).resolve()
    output_path = Path(args.output).resolve()
    normalizer = Path(args.normalizer).resolve()

    request_id = f"{args.scenario}-{time.strftime('%Y%m%d-%H%M%S')}-{os.getpid()}"
    evidence_dir = artifact_root / 'evidence' / 'deepseek-search' / request_id
    result_dir = artifact_root / 'results' / 'deepseek-search' / request_id
    screen_dir = evidence_dir / 'screenshots'
    dom_dir = evidence_dir / 'dom'
    log_dir = evidence_dir / 'logs'
    for path in [profile_dir, evidence_dir, result_dir, screen_dir, dom_dir, log_dir]:
        path.mkdir(parents=True, exist_ok=True)

    prompt = PROMPT_TEMPLATE.format(query=args.query)
    prompt_path = evidence_dir / 'prompt.md'
    prompt_path.write_text(prompt, encoding='utf-8')

    runtime_config = {
        'scenario': args.scenario,
        'enableSmartSearch': args.smart_search == 'on',
        'requireChatPage': True,
        'requireQuestionSubmitted': True,
        'requireAnswerVisible': True,
        'requireSourcesVisibleOrExtractable': True,
        'minimumSourceCount': args.min_source_count,
        'firstAnswerMs': args.first_answer_ms,
        'fullAnswerMs': args.full_answer_ms,
        'expectedAnswerMinChars': args.expected_answer_min_chars,
        'profileDir': str(profile_dir),
        'artifactRoot': str(artifact_root),
        'promptPath': str(prompt_path),
    }
    runtime_config_path = evidence_dir / 'runtime-config.json'
    dump_json(runtime_config_path, runtime_config)

    command_log = log_dir / 'commands.log'
    environment_log = evidence_dir / 'environment.log'
    environment_log.write_text(
        '\n'.join([
            f'started_at_utc={time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}',
            f'scenario={args.scenario}',
            f'profile_dir={profile_dir}',
            f'enable_smart_search={runtime_config["enableSmartSearch"]}',
            f'minimum_source_count={args.min_source_count}',
            f'expected_answer_min_chars={args.expected_answer_min_chars}',
            f'first_answer_timeout_ms={args.first_answer_ms}',
            f'full_answer_timeout_ms={args.full_answer_ms}',
        ]),
        encoding='utf-8',
    )

    start_ms = now_ms()
    run_cmd(agent_browser_args(profile_dir, 'close'), command_log, timeout=15)
    run_cmd(agent_browser_args(profile_dir, 'network', 'har', 'start'), command_log, timeout=20)

    entry_ok = chat_ok = session_ready = question_submitted = answer_visible = sources_visible = False
    question_submitted_at_ms = None
    first_answer_at_ms = None
    submit_ms = None
    last_answer_probe = {}
    last_answer_probe_path = None
    source_count_observed = 0
    ready_poll_count = 0
    early_answer_breach = False

    entry_probe = {}
    chat_probe = {}
    answer_probe = {}
    raw_answer_text = ''
    raw_source_links = []

    try:
        run_cmd(agent_browser_args(profile_dir, 'open', 'https://www.deepseek.com'), command_log, timeout=60)
        entry_ok = True
        run_cmd(agent_browser_args(profile_dir, 'wait', '--load', 'networkidle'), command_log, timeout=30)
        run_cmd(agent_browser_args(profile_dir, 'screenshot', str(screen_dir / 'screenshot-01-entry.png')), command_log, timeout=30)
        _, snapshot_text, _ = run_cmd(agent_browser_args(profile_dir, 'snapshot', '-i'), command_log, timeout=20)
        (dom_dir / 'entry-snapshot.txt').write_text(snapshot_text or '', encoding='utf-8')
        _, probe_text, _ = run_cmd(agent_browser_args(profile_dir, 'eval', ENTRY_PROBE_JS), command_log, timeout=20)
        (dom_dir / 'entry-probe.json').write_text(probe_text or '{}', encoding='utf-8')
        entry_probe = safe_json_load(dom_dir / 'entry-probe.json')
        run_cmd(agent_browser_args(profile_dir, 'get', 'url'), command_log, timeout=15)
        run_cmd(agent_browser_args(profile_dir, 'get', 'title'), command_log, timeout=15)

        run_cmd(agent_browser_args(profile_dir, 'open', 'https://chat.deepseek.com'), command_log, timeout=60)
        chat_ok = True
        run_cmd(agent_browser_args(profile_dir, 'wait', '--load', 'networkidle'), command_log, timeout=30)
        run_cmd(agent_browser_args(profile_dir, 'screenshot', str(screen_dir / 'screenshot-02-chat.png')), command_log, timeout=30)
        _, chat_snapshot_text, _ = run_cmd(agent_browser_args(profile_dir, 'snapshot', '-i'), command_log, timeout=20)
        (dom_dir / 'chat-snapshot.txt').write_text(chat_snapshot_text or '', encoding='utf-8')
        _, chat_probe_text, _ = run_cmd(agent_browser_args(profile_dir, 'eval', CHAT_PROBE_JS), command_log, timeout=20)
        (dom_dir / 'chat-probe.json').write_text(chat_probe_text or '{}', encoding='utf-8')
        chat_probe = safe_json_load(dom_dir / 'chat-probe.json')
        session_ready = bool(chat_probe.get('hasTextarea'))

        if session_ready:
            _, pre_submit_snapshot, _ = run_cmd(agent_browser_args(profile_dir, 'snapshot', '-i'), command_log, timeout=20)
            (dom_dir / 'pre-submit-snapshot.txt').write_text(pre_submit_snapshot or '', encoding='utf-8')
            msg_ref = extract_ref(pre_submit_snapshot, ['给 DeepSeek 发送消息', '发送消息', 'textarea'])
            search_ref = extract_ref(pre_submit_snapshot, ['button "智能搜索"', '智能搜索'])
            append_log(command_log, f'message_ref={msg_ref}')
            append_log(command_log, f'search_ref={search_ref}')

            if runtime_config['enableSmartSearch'] and search_ref:
                run_cmd(agent_browser_args(profile_dir, 'click', f'@{search_ref}'), command_log, timeout=20)
            if msg_ref:
                run_cmd(agent_browser_args(profile_dir, 'fill', f'@{msg_ref}', prompt), command_log, timeout=60)
                submit_ms = now_ms()
                run_cmd(agent_browser_args(profile_dir, 'press', 'Enter'), command_log, timeout=20)
                time.sleep(2)
                run_cmd(agent_browser_args(profile_dir, 'screenshot', str(screen_dir / 'screenshot-03-submitted.png')), command_log, timeout=30)
                _, submitted_snapshot, _ = run_cmd(agent_browser_args(profile_dir, 'snapshot', '-i'), command_log, timeout=20)
                (dom_dir / 'submitted-snapshot.txt').write_text(submitted_snapshot or '', encoding='utf-8')
                _, submitted_probe_text, _ = run_cmd(agent_browser_args(profile_dir, 'eval', ANSWER_PROBE_JS), command_log, timeout=20)
                (dom_dir / 'submitted-probe.json').write_text(submitted_probe_text or '{}', encoding='utf-8')

                full_deadline = now_ms() + args.full_answer_ms
                poll_idx = 0
                while now_ms() < full_deadline:
                    poll_idx += 1
                    time.sleep(args.poll_interval_sec)
                    _, poll_text, _ = run_cmd(agent_browser_args(profile_dir, 'eval', ANSWER_PROBE_JS), command_log, timeout=20)
                    poll_path = log_dir / f'answer-poll-{poll_idx:02d}.json'
                    poll_path.write_text(poll_text or '{}', encoding='utf-8')
                    last_answer_probe_path = poll_path
                    probe = safe_json_load(poll_path)
                    last_answer_probe = probe
                    answer_segment = extract_answer_segment(probe.get('bodyText', ''), prompt, probe.get('answerCandidateText', ''))
                    question_submitted = bool(str(probe.get('url', '')).startswith('https://chat.deepseek.com/a/chat/s/')) or bool(probe.get('answerCandidateText')) or (normalize(prompt) and normalize(prompt) in normalize(probe.get('bodyText', '')))
                    answer_visible = question_submitted and len(answer_segment) >= args.expected_answer_min_chars
                    source_candidates = merge_source_links(probe.get('answerBlockSourceLinks') or [], probe.get('sourceLinks') or [], answer_segment)
                    source_count_observed = len(source_candidates)
                    sources_visible = source_count_observed >= args.min_source_count
                    if question_submitted and question_submitted_at_ms is None:
                        question_submitted_at_ms = now_ms()
                    if answer_visible:
                        ready_poll_count += 1
                        if first_answer_at_ms is None:
                            first_answer_at_ms = now_ms()
                    if submit_ms and first_answer_at_ms is None and now_ms() - submit_ms > args.first_answer_ms:
                        early_answer_breach = True
                    if answer_visible and (not runtime_config['requireSourcesVisibleOrExtractable'] or sources_visible):
                        if ready_poll_count >= args.min_ready_polls:
                            break
        else:
            append_log(command_log, 'session_ready=false: no textarea detected on chat page')
    finally:
        if last_answer_probe_path and last_answer_probe_path.exists():
            (dom_dir / 'answer-probe.json').write_text(last_answer_probe_path.read_text(encoding='utf-8'), encoding='utf-8')
        else:
            _, answer_probe_text, _ = run_cmd(agent_browser_args(profile_dir, 'eval', ANSWER_PROBE_JS), command_log, timeout=20)
            (dom_dir / 'answer-probe.json').write_text(answer_probe_text or '{}', encoding='utf-8')
        answer_probe = safe_json_load(dom_dir / 'answer-probe.json')
        _, answer_snapshot_text, _ = run_cmd(agent_browser_args(profile_dir, 'snapshot', '-i'), command_log, timeout=20)
        (dom_dir / 'answer-snapshot.txt').write_text(answer_snapshot_text or '', encoding='utf-8')
        run_cmd(agent_browser_args(profile_dir, 'screenshot', str(screen_dir / 'screenshot-04-answer.png')), command_log, timeout=30)
        run_cmd(agent_browser_args(profile_dir, 'console'), command_log, timeout=20)
        run_cmd(agent_browser_args(profile_dir, 'errors'), command_log, timeout=20)
        run_cmd(agent_browser_args(profile_dir, 'network', 'har', 'stop', str(evidence_dir / 'network.har')), command_log, timeout=30)
        run_cmd(agent_browser_args(profile_dir, 'close'), command_log, timeout=15)

    end_ms = now_ms()

    authoritative_prompt = prompt
    entry_url = str(entry_probe.get('url', ''))
    chat_url = str(chat_probe.get('url', ''))
    answer_url = str(answer_probe.get('url', ''))
    chat_body = str(chat_probe.get('bodySnippet', ''))
    answer_body = str(answer_probe.get('bodyText', ''))
    answer_candidate_text = str(answer_probe.get('answerCandidateText', ''))
    answer_block_text = str(answer_probe.get('answerBlockText', ''))
    answer_source_section_text = str(answer_probe.get('sourceSectionText', ''))
    raw_answer_text = extract_answer_segment(answer_body, authoritative_prompt, answer_candidate_text)
    raw_source_links = merge_source_links(answer_probe.get('answerBlockSourceLinks', []), answer_probe.get('sourceLinks', []), answer_source_section_text or raw_answer_text)
    source_count = len(raw_source_links)

    entry_reached = entry_url.startswith('https://www.deepseek.com')
    chat_reached = chat_url.startswith('https://chat.deepseek.com')
    session_ready = bool(chat_probe.get('hasTextarea')) or bool(answer_probe.get('hasTextarea'))
    question_submitted = question_submitted or answer_url.startswith('https://chat.deepseek.com/a/chat/s/') or bool(answer_candidate_text) or (normalize(authoritative_prompt) and normalize(authoritative_prompt) in normalize(answer_body))
    answer_visible = question_submitted and len(raw_answer_text) >= args.expected_answer_min_chars
    sources_visible = source_count >= args.min_source_count

    status = 'PASS'
    failure_code = None
    failure_detail = None
    error_page = detect_error_page(chat_body, answer_body, answer_candidate_text, str(chat_probe.get('title', '')), str(answer_probe.get('title', '')))
    if not session_ready:
        if error_page and error_page['kind'] == 'http-blocked':
            status = 'BLOCKED'
            failure_code = 'F-L0-HTTP'
            failure_detail = error_page['message']
        elif error_page and error_page['kind'] == 'captcha':
            status = 'BLOCKED'
            failure_code = 'F-L0-CAPTCHA'
            failure_detail = error_page['message']
        elif error_page and error_page['kind'] == 'auth':
            status = 'FAIL'
            failure_code = 'F-L1-AUTH'
            failure_detail = error_page['message']
        elif chat_reached:
            status = 'FAIL'
            failure_code = 'F-L0-RENDER'
            failure_detail = 'chat URL opened but no textarea was detected'
        else:
            status = 'FAIL'
            failure_code = 'F-L0-CONN'
            failure_detail = 'failed before a stable chat page URL was observed'
    elif not question_submitted:
        status = 'FAIL'
        failure_code = 'F-L2-INPUT'
        failure_detail = 'interactive chat page loaded, but prompt submission was not confirmed'
    elif not answer_visible:
        status = 'FAIL'
        failure_code = 'F-L2-TIMEOUT'
        failure_detail = f'prompt submission was observed, but extracted answer text stayed below {args.expected_answer_min_chars} chars before timeout'
    elif not sources_visible:
        status = 'FAIL'
        failure_code = 'F-L3-PARTIAL'
        failure_detail = f'answer became visible, but fewer than {args.min_source_count} external source links were extractable'

    if status == 'BLOCKED' or not session_ready:
        question_submitted = False
        answer_visible = False
        sources_visible = False
        raw_answer_text = ''
        raw_source_links = []
        source_count = 0
        answer_candidate_text = ''
        answer_block_text = ''
        answer_source_section_text = ''

    first_answer_latency = None
    if submit_ms and first_answer_at_ms:
        first_answer_latency = int(first_answer_at_ms) - int(submit_ms)

    summary_parts = ['deepseek-smart-search run completed.']
    if status == 'PASS':
        summary_parts.append('Run satisfied the active success criteria.')
        summary_parts.append(f'Captured {source_count} external source link(s).')
    else:
        summary_parts.append(f'Run did not satisfy success criteria: {failure_detail}.')
    summary = ' '.join(summary_parts)

    raw_payload = {
        'scenario': args.scenario,
        'requestId': request_id,
        'runtimeConfig': runtime_config,
        'prompt': authoritative_prompt,
        'entryProbe': entry_probe,
        'chatProbe': chat_probe,
        'answerProbe': answer_probe,
        'answerText': raw_answer_text,
        'answerBlockText': answer_block_text,
        'sourceSectionText': answer_source_section_text,
        'sourceLinks': raw_source_links,
        'metrics': {
            'e2eLatencyMs': end_ms - start_ms,
            'firstAnswerMs': first_answer_latency,
            'sourceCount': source_count,
            'firstAnswerTimeoutBreached': bool(early_answer_breach),
        },
    }
    raw_path = evidence_dir / 'raw-extraction.json'
    dump_json(raw_path, raw_payload)

    verdict = {
        'requestId': request_id,
        'scenario': args.scenario,
        'status': status,
        'summary': summary,
        'funnel': {
            'entryReached': entry_reached,
            'chatReached': chat_reached,
            'sessionReady': session_ready,
            'questionSubmitted': question_submitted,
            'answerVisible': answer_visible,
            'sourcesVisibleOrExtractable': sources_visible,
        },
        'metrics': {
            'e2eLatencyMs': end_ms - start_ms,
            'firstAnswerMs': first_answer_latency,
            'sourceCount': source_count,
        },
        'failure': {
            'code': failure_code,
            'detail': failure_detail,
        },
        'artifacts': {
            'evidenceDir': str(evidence_dir),
            'screenshots': [
                'screenshots/screenshot-01-entry.png',
                'screenshots/screenshot-02-chat.png',
                'screenshots/screenshot-03-submitted.png',
                'screenshots/screenshot-04-answer.png',
            ],
            'domSnapshots': [
                'dom/entry-snapshot.txt',
                'dom/chat-snapshot.txt',
                'dom/pre-submit-snapshot.txt',
                'dom/submitted-snapshot.txt',
                'dom/answer-snapshot.txt',
                'dom/entry-probe.json',
                'dom/chat-probe.json',
                'dom/submitted-probe.json',
                'dom/answer-probe.json',
            ],
            'networkHar': 'network.har',
            'consoleLog': 'logs/commands.log',
            'rawExtraction': 'raw-extraction.json',
            'researchOutput': 'research-output.json',
            'manifest': 'MANIFEST.json',
        },
    }
    verdict_path = result_dir / 'verdict.json'
    dump_json(verdict_path, verdict)

    research_output = {
        'channel': 'deepseek-smart-search',
        'status': status,
        'summary': summary,
        'requestId': request_id,
        'answerText': raw_answer_text or None,
        'sourceLinks': raw_source_links,
        'results': ([
            {
                'title': 'DeepSeek answer',
                'url': '',
                'summary': raw_answer_text,
                'highlights': [],
                'qualityScore': len(raw_source_links),
                'evidenceText': raw_answer_text,
            }
        ] if raw_answer_text else []),
        'runtimeConfig': runtime_config,
        'metrics': raw_payload['metrics'],
        'verdict': verdict,
        'evidenceDir': str(evidence_dir),
        'verdictPath': str(verdict_path),
        'rawExtractionPath': str(raw_path),
        'enrichment': {
            'sourceSectionRecovery': {
                'candidateCount': int(answer_probe.get('candidateCount') or 0),
                'answerBlockMeta': answer_probe.get('answerBlockMeta'),
            }
        },
        'failure': verdict['failure'],
    }
    research_output_path = evidence_dir / 'research-output.json'
    dump_json(research_output_path, research_output)

    try:
        subprocess.run(['python3', str(normalizer), str(research_output_path)], check=True)
    except subprocess.CalledProcessError as exc:
        append_log(command_log, f'normalizer failed: {exc}')

    build_manifest(evidence_dir)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(research_output_path.read_text(encoding='utf-8'), encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
