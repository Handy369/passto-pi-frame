#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.request
from collections import OrderedDict
from datetime import datetime, timezone
from urllib.parse import urlparse


UNCERTAINTY_TOKENS = ['不确定', '时效性风险', '冲突', '局限', '注意事项', '风险提示']
UNCERTAINTY_EMPTY_VALUES = {
    '无', '暂无', '无明显冲突', '无明显时效性风险', '无明显冲突或时效性风险',
    '未发现明显冲突', '未发现明显时效性风险', '未发现明显冲突或时效性风险',
}
CONFLICT_TOKENS = ['冲突', '矛盾', '分歧', '不一致', '口径不一', '说法不同']
STALENESS_TOKENS = ['时效', '过时', '截至', '最新', '更新', '版本', '实时', '日期', '年份', '发布于']
COVERAGE_GAP_TOKENS = ['未覆盖', '未找到', '缺少', '不足', '有限', '无统一标准', '差异较大', '依赖工程实践', '不明确', '尚无', '未公开', '细节', '场景差异', '实现细节']
EVIDENCE_HINT_TOKENS = ['根据', '数据显示', '研究表明', '证据', '流程', '机制', '步骤', '定义', '原理']
GENERIC_ALIAS_STOPWORDS = {
    'http', 'https', 'www', 'com', 'cn', 'org', 'net', 'io', 'ai', 'co', 'docs', 'doc', 'blog', 'learn',
    'official', 'source', 'reference', 'paper', 'url', 'urls', '来源', '网址', '域名', '网站', '官网',
}
NOISE_KEYWORDS = {
    '登录', '注册', '首页', '导航', '菜单', '版权', '隐私', 'cookie', 'cookies', '条款', '联系我们',
    '关于我们', '上一篇', '下一篇', '相关阅读', '相关推荐', '下载app', 'app下载', '展开全部',
    '点击查看', '广告', '赞助', '订阅', '分享', '举报', '评论', '点赞', '收藏', '返回顶部'
}


def uniq(items):
    seen = OrderedDict()
    for item in items:
        value = str(item or '').strip()
        if value and value not in seen:
            seen[value] = True
    return list(seen.keys())


def uniq_dicts(items, key_fn):
    seen = OrderedDict()
    out = []
    for item in items:
        key = key_fn(item)
        if not key or key in seen:
            continue
        seen[key] = True
        out.append(item)
    return out


def normalize_url(url: str) -> str:
    value = str(url or '').strip()
    if not value:
        return ''
    parsed = urlparse(value)
    path = parsed.path or '/'
    if path != '/' and path.endswith('/'):
        path = path[:-1]
    return f'{parsed.scheme}://{parsed.netloc.lower()}{path}'


def domain_of(url: str) -> str:
    return (urlparse(str(url or '')).netloc or '').lower()


def comparable_host(value: str) -> str:
    host = str(value or '').strip().lower()
    if host.startswith('www.'):
        host = host[4:]
    return host


def normalize_space(text: str) -> str:
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def normalize_alias(text: str) -> str:
    return re.sub(r'[^a-z0-9\u4e00-\u9fff]+', '', str(text or '').lower())


def strip_prefix(line: str) -> str:
    line = re.sub(r'^\s*(?:[-*•]|(?:\d+|[一二三四五六七八九十]+)[\.、\)])\s*', '', str(line or '').strip())
    line = re.sub(r'\s*\[[0-9,\s]+\]\s*$', '', line).strip()
    return line


def strip_source_annotation(text: str) -> str:
    value = str(text or '').strip()
    if not value:
        return ''
    value = re.sub(r'（\s*来源[:：][^）]{0,240}）', '', value)
    value = re.sub(r'\(\s*来源[:：][^\)]{0,240}\)', '', value)
    value = re.sub(r'\s*来源[:：][^。！？；]{0,240}$', '', value)
    value = re.sub(r'\s*\|\s*来源(?:域名|URL|网址|网站)?[:：][^|]{0,240}', '', value)
    value = re.sub(r'\s*\|\s*source(?: domain| domains| url| urls)?[:：][^|]{0,240}', '', value, flags=re.I)
    return normalize_space(value)


def clean_url(raw: str) -> str:
    value = str(raw or '').strip().replace(chr(96), '').strip("~()[]{}<>,;\"'")
    value = re.sub(r'[。；，、]+$', '', value)
    return value


def is_probably_valid_url(value: str) -> bool:
    if not value or not value.startswith(('http://', 'https://')):
        return False
    match = re.match(r'^https?://([^/]+)', value)
    if not match:
        return False
    host = match.group(1).strip().lower().strip('.')
    if '.' not in host:
        return False
    if any(ch.isspace() for ch in host):
        return False
    if host in {'hugging', 'localhost'}:
        return False
    return True


def extract_urls(text: str):
    urls = []
    seen = set()
    for match in re.findall(r'https?://[^\s)\]>]+', str(text or '')):
        href = clean_url(match)
        normalized = normalize_url(href)
        if not is_probably_valid_url(href) or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        urls.append(href)
    return urls


def extract_url_like_refs(text: str):
    refs = []
    seen = set()
    for url in extract_urls(text):
        normalized = normalize_url(url)
        if normalized and normalized not in seen:
            seen.add(normalized)
            refs.append(url)

    pattern = re.compile(r'(?<!@)\b((?:[a-z0-9-]+\.)+[a-z]{2,}/[^\s)\]>，。；,;]+)', re.I)
    for match in pattern.findall(str(text or '')):
        candidate = clean_url(match)
        href = candidate if candidate.lower().startswith(('http://', 'https://')) else f'https://{candidate}'
        normalized = normalize_url(href)
        if not is_probably_valid_url(href) or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        refs.append(href)
    return refs


def extract_domain_mentions(text: str):
    domains = []
    seen = set()
    for match in re.findall(r'\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b', str(text or '').lower()):
        value = match.strip('.').lower()
        if value not in seen:
            seen.add(value)
            domains.append(value)
    return domains


def split_sentences(text: str):
    raw = str(text or '').strip()
    if not raw:
        return []
    pieces = re.split(r'(?<=[。！？；])\s*|(?<=[.!?])\s+', raw)
    out = []
    for piece in pieces:
        line = strip_prefix(piece)
        line = normalize_space(line)
        if line:
            out.append(line)
    return out


def split_list_items(text: str):
    raw = str(text or '')
    if not raw.strip():
        return []

    compact = normalize_space(raw)
    inline_marker_pattern = re.compile(r'((?:^|\s)(?:F\d+\.|E\d+\.|C\d+\.|T\d+\.|G\d+\.|U\d+\.|S\d+\.|URL\d+\.))', re.I)
    inline_marker_matches = list(inline_marker_pattern.finditer(compact))
    if len(inline_marker_matches) >= 2:
        parts = []
        for idx, match in enumerate(inline_marker_matches):
            start = match.start(1)
            end = inline_marker_matches[idx + 1].start(1) if idx + 1 < len(inline_marker_matches) else len(compact)
            item = compact[start:end].strip()
            item = re.sub(r'^(?:F\d+\.|E\d+\.|C\d+\.|T\d+\.|G\d+\.|U\d+\.|S\d+\.|URL\d+\.)\s*', '', item, flags=re.I)
            item = re.sub(r'^(?:F\d+\.|E\d+\.|C\d+\.|T\d+\.|G\d+\.|U\d+\.|S\d+\.|URL\d+\.)\s*', '', item, flags=re.I)
            item = normalize_space(item)
            if item:
                parts.append(item)
        if parts:
            return parts

    numbered_prefix = re.compile(r'^(?:[-*•]|(?:F|E|C|T|G|U|S|URL)\d+\.|(?:\d+|[一二三四五六七八九十]+)[\.、\)])\s*', re.I)
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    numbered_lines = []
    for line in lines:
        if numbered_prefix.match(line):
            numbered_lines.append(numbered_prefix.sub('', line).strip())
    if len(numbered_lines) >= 2:
        return [normalize_space(item) for item in numbered_lines if normalize_space(item)]
    if len(numbered_lines) == 1 and len(lines) == 1:
        single_item = normalize_space(numbered_lines[0])
        if single_item:
            return [single_item]

    pattern = re.compile(r'(?=(?:^|\s)(?:[-*•]|(?:\d+|[一二三四五六七八九十]+)[\.、\)])\s+)')
    parts = []
    for part in pattern.split(compact):
        item = normalize_space(part)
        if not item:
            continue
        item = re.sub(r'^(?:[-*•]|(?:\d+|[一二三四五六七八九十]+)[\.、\)])\s*', '', item)
        item = normalize_space(item)
        if item:
            parts.append(item)
    return parts


def split_labeled_items(text: str):
    raw = normalize_space(text)
    if not raw:
        return []
    label_pattern = re.compile(
        r'(^|[。！？；\s）)])'
        r'([A-Za-z\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff（）()·/\-]{1,24}[：:])'
    )
    matches = list(label_pattern.finditer(raw))
    if not matches:
        return []

    out = []
    for idx, match in enumerate(matches):
        start = match.start(2)
        end = matches[idx + 1].start(2) if idx + 1 < len(matches) else len(raw)
        item = normalize_space(raw[start:end])
        if not item:
            continue
        if item.endswith(('：', ':')) and len(item) <= 20:
            continue
        out.append(item)
    return out


def cjk_count(text: str) -> int:
    return len(re.findall(r'[\u4e00-\u9fff]', str(text or '')))


def is_uncertainty_text(text: str) -> bool:
    value = str(text or '')
    return any(token in value for token in UNCERTAINTY_TOKENS)


def is_empty_uncertainty_text(text: str) -> bool:
    value = normalize_space(text).strip('。；;！!').strip()
    return value in UNCERTAINTY_EMPTY_VALUES


def cleanup_markdown(line: str) -> str:
    value = str(line or '').strip()
    if not value:
        return ''
    value = re.sub(r'!\[[^\]]*\]\([^\)]*\)', ' ', value)
    value = re.sub(r'\[([^\]]+)\]\([^\)]*\)', r'\1', value)
    value = re.sub(r'<[^>]+>', ' ', value)
    value = re.sub(r'https?://\S+', ' ', value)
    value = re.sub(r'^#+\s*', '', value)
    value = re.sub(r'^[>*\-]+\s*', '', value)
    value = re.sub(r'[_`~|]+', ' ', value)
    return normalize_space(value)


def is_noise_line(line: str) -> bool:
    compact = str(line or '').lower().replace(' ', '')
    if not compact:
        return True
    if len(line) < 24 and not re.search(r'[。！？；：:]', line):
        return True
    if sum(1 for key in NOISE_KEYWORDS if key.lower().replace(' ', '') in compact) >= 2:
        return True
    if line.count('/') >= 4 or line.count('|') >= 4:
        return True
    if re.search(r'(?:^|\s)(home|menu|login|signup|privacy|terms)(?:\s|$)', line, re.I):
        return True
    return False


def line_score(line: str, query_terms=None) -> int:
    score = 0
    lower = str(line or '').lower()
    for token in query_terms or []:
        token_lower = token.lower()
        if token_lower and token_lower in lower:
            score += 4 if len(token_lower) >= 4 else 2
    if re.search(r'[。！？；：:]', line):
        score += 2
    if 35 <= len(line) <= 220:
        score += 2
    elif len(line) > 220:
        score += 1
    if any(term in line for term in ['定义', '核心', '流程', '步骤', '机制', '优势', '准确性', '检索', '生成', '向量', '数据库']):
        score += 2
    if any(token in line for token in ['信息冲突', '时效性风险', '不确定']) and '定义' not in line:
        score -= 3
    if any(key in line for key in NOISE_KEYWORDS):
        score -= 4
    return score


def clean_jina_excerpt(raw_text: str):
    candidates = []
    for raw_line in str(raw_text or '').splitlines():
        line = cleanup_markdown(raw_line)
        if not line or is_noise_line(line):
            continue
        candidates.extend(split_sentences(line) or [line])

    scored = []
    seen = set()
    for idx, line in enumerate(candidates):
        normalized = normalize_space(line)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        scored.append((line_score(normalized), idx, normalized))

    chosen = [item for item in scored if item[0] >= 3]
    if not chosen:
        chosen = sorted(scored, key=lambda item: (-item[0], -len(item[2])))[:3]
    else:
        chosen = sorted(chosen, key=lambda item: (-item[0], item[1]))[:3]

    ordered = [line for _, _, line in sorted(chosen, key=lambda item: item[1])]
    return normalize_space(' '.join(ordered))[:900]


def fetch_jina_excerpt(url: str, timeout_sec: int):
    target = f'https://r.jina.ai/{url}'
    req = urllib.request.Request(
        target,
        headers={
            'Accept': 'text/plain',
            'User-Agent': 'agent-reach/1.0',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            raw_text = resp.read().decode('utf-8', 'replace')
    except Exception:
        return ''
    return clean_jina_excerpt(raw_text)


def extract_structured_sections(text: str):
    raw = normalize_space(text)
    if not raw:
        return {}, ''
    pattern = re.compile(
        r'(?P<core>\[CORE_FINDINGS\]|核心结论(?:（[^）]{0,20}）|\([^)]+\))?|3-6\s*条核心结论|3\s*[—-]\s*6\s*条核心结论)'
        r'|(?P<evidence>\[EVIDENCE\]|关键证据点(?:（[^）]{0,20}）|\([^)]+\))?)'
        r'|(?P<uncertainty>\[UNCERTAINTIES\]|(?:⚠️\s*)?(?:信息冲突/不确定/时效性风险说明|时效性风险说明|风险提示|注意事项|不确定性说明))'
        r'|(?P<sources>\[SOURCE_URLS\]|来源链接|来源列表)'
        r'|(?P<source_sites>\[SOURCE_SITES\]|来源网站|来源站点)'
        , re.I
    )
    matches = []
    for match in pattern.finditer(raw):
        matches.append((match.start(), match.end(), match.lastgroup or 'unknown'))
    if not matches:
        return {}, raw

    sections = {}
    intro = raw[:matches[0][0]].strip()
    for idx, (_, end, name) in enumerate(matches):
        next_start = matches[idx + 1][0] if idx + 1 < len(matches) else len(raw)
        body = raw[end:next_start].strip()
        if body:
            sections[name] = normalize_space(body)
    return sections, intro


def clean_candidate_text(text: str) -> str:
    value = strip_prefix(text)
    value = value.replace('⚠️', ' ')
    value = strip_source_annotation(value)
    value = re.sub(r'\s*\[[A-Z_]+\]\s*', ' ', value)
    value = normalize_space(value)
    value = re.sub(r'^(?:核心结论(?:（[^）]{0,20}）|\([^)]+\))?|关键证据点(?:（[^）]{0,20}）|\([^)]+\))?|来源链接|来源列表|来源网站|来源站点)\s*', '', value)
    return normalize_space(value)


def extract_items_from_section_raw(section_name: str, text: str):
    raw_multiline = str(text or '').strip()
    raw = normalize_space(raw_multiline)
    if not raw:
        return []

    list_items = split_list_items(raw_multiline)
    labeled_items = split_labeled_items(raw)
    sentence_items = split_sentences(raw)

    if section_name in {'core', 'evidence'} and list_items:
        candidates = list_items
    elif section_name == 'evidence' and labeled_items:
        candidates = labeled_items
    elif section_name == 'core' and len(sentence_items) <= 1 and labeled_items:
        candidates = labeled_items
    elif section_name == 'uncertainty' and labeled_items:
        candidates = labeled_items
    else:
        candidates = sentence_items or labeled_items or [raw]

    out = []
    seen = set()
    for candidate in candidates:
        cleaned = clean_candidate_text(candidate)
        if not cleaned:
            continue
        if cleaned.startswith('根据对“') and '以下是核心结论' in cleaned:
            continue
        if section_name == 'evidence' and is_uncertainty_text(cleaned):
            continue
        if section_name == 'uncertainty' and len(cleaned) < 8:
            continue
        if section_name != 'uncertainty' and cleaned.endswith(('：', ':')) and len(cleaned) <= 24:
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        out.append({'raw': normalize_space(candidate), 'cleaned': cleaned})
    return out


def parse_answer_fallback(answer_text: str):
    items = {'core': [], 'evidence': [], 'uncertainty': []}
    section = None
    lines = [line.strip() for line in str(answer_text or '').splitlines()]
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        lower = line.lower()
        if lower.startswith('sources:') or '来源链接' in line or '[source_urls]' in lower:
            section = 'sources'
            continue
        if '核心结论' in line or '总结结论' in line or 'core findings' in lower or '[core_findings]' in lower:
            section = 'core'
            continue
        if '关键证据' in line or lower.startswith('evidence') or '[evidence]' in lower:
            section = 'evidence'
            continue
        if any(token in line for token in UNCERTAINTY_TOKENS) or '[uncertainties]' in lower:
            if len(line) <= 24 or line.endswith('：') or line.endswith(':') or '[uncertainties]' in lower:
                section = 'uncertainty'
                continue
        if section == 'sources':
            continue
        if re.match(r'^(URL:|https?://)', line, re.I):
            continue
        cleaned = clean_candidate_text(line)
        if not cleaned:
            continue
        target = section
        if target is None:
            if is_uncertainty_text(cleaned):
                target = 'uncertainty'
            elif any(token in cleaned for token in EVIDENCE_HINT_TOKENS) and len(cleaned) > 18:
                target = 'evidence'
            else:
                target = 'core'
        items[target].append({'raw': normalize_space(line), 'cleaned': cleaned})

    for key in items:
        items[key] = uniq_dicts(items[key], lambda item: item.get('cleaned'))[:5]
    return items


def extract_label_value_pairs(lines):
    pairs = []
    pattern = re.compile(r'^([A-Za-z\u4e00-\u9fff][A-Za-z0-9\u4e00-\u9fff（）()·/\-\s]{0,24})[:：]\s*(.+)$')
    for raw in lines or []:
        line = normalize_space(raw)
        if not line:
            continue
        match = pattern.match(line)
        if not match:
            continue
        label = normalize_space(match.group(1))
        value = clean_candidate_text(match.group(2))
        if not label or not value:
            continue
        if re.match(r'^(?:url\d*|s\d*)$', label, re.I):
            continue
        pairs.append((label, value))
    return pairs


def split_reference_block(answer_text: str):
    body_lines = []
    reference_lines = []
    in_reference = False
    for raw in str(answer_text or '').splitlines():
        line = normalize_space(raw)
        if not line:
            continue
        lower = line.lower()
        if lower.startswith('[source_') or any(token in line for token in ['参考来源', '引用来源', '来源链接', '参考链接', '参考资料', '资料来源']):
            in_reference = True
            reference_lines.append(line)
            continue
        if in_reference:
            reference_lines.append(line)
        else:
            body_lines.append(line)
    return body_lines, reference_lines


def build_unstructured_summary(prefix: str, pairs):
    if not pairs:
        return ''
    fragments = []
    seen_labels = []
    for label, value in pairs:
        short_label = normalize_space(label)
        if short_label not in seen_labels:
            seen_labels.append(short_label)
        fragments.append(f'{short_label}：{value}')
    labels_text = '、'.join(seen_labels[:5])
    summary = f'{prefix}{labels_text}。' if labels_text else prefix
    detail = '；'.join(fragments[:4])
    merged = normalize_space(f'{summary} {detail}')
    return merged[:320]


def parse_unstructured_answer(answer_text: str):
    items = {'core': [], 'evidence': [], 'uncertainty': []}
    body_lines, reference_lines = split_reference_block(answer_text)
    filtered_body = []
    for line in body_lines:
        if line in {'开启新对话', '今天', '快速模式', '深度思考', '智能搜索', '内容由 AI 生成，请仔细甄别'}:
            continue
        if any(token in line for token in ['给 DeepSeek 发送消息', '强制输出格式', '研究问题：']):
            continue
        filtered_body.append(line)

    reference_text = '\n'.join(reference_lines)
    reference_urls = uniq(extract_url_like_refs(reference_text or answer_text))
    shared_hints = reference_urls[:4]
    label_pairs = extract_label_value_pairs(filtered_body)
    label_map = OrderedDict()
    for label, value in label_pairs:
        label_map.setdefault(normalize_alias(label), []).append((label, value))

    intro_line = ''
    for line in filtered_body:
        cleaned = clean_candidate_text(line)
        if not cleaned:
            continue
        if re.match(r'^(?:https?://|URL\d+\.|S\d+\.)', cleaned, re.I):
            continue
        if 'Retrieval-Augmented Generation' in cleaned or '检索增强生成' in cleaned or 'RAG' in cleaned:
            intro_line = cleaned
            break
    if intro_line:
        items['core'].append({'raw': intro_line, 'cleaned': intro_line[:320], 'sourceHints': shared_hints})

    process_pairs = []
    for alias, values in label_map.items():
        if any(token in alias for token in ['检索', '增强', '生成', '索引', '查询编码', '上下文', '召回']):
            process_pairs.extend(values)
    if len(process_pairs) >= 2:
        summary = build_unstructured_summary('RAG 核心流程包括', process_pairs)
        if summary:
            items['core'].append({'raw': summary, 'cleaned': summary, 'sourceHints': shared_hints})
        for label, value in process_pairs[:4]:
            evidence = clean_candidate_text(f'{label}：{value}')
            if evidence:
                items['evidence'].append({'raw': evidence, 'cleaned': evidence, 'sourceHints': shared_hints})

    benefit_pairs = []
    for alias, values in label_map.items():
        if any(token in alias for token in ['优点', '优势', '知识可更新', '减少幻觉', '可解释性', '可信度']):
            benefit_pairs.extend(values)
    if benefit_pairs:
        summary = build_unstructured_summary('RAG 的主要优势包括', benefit_pairs)
        if summary:
            items['core'].append({'raw': summary, 'cleaned': summary, 'sourceHints': shared_hints})
        for label, value in benefit_pairs[:3]:
            evidence = clean_candidate_text(f'{label}：{value}')
            if evidence:
                items['evidence'].append({'raw': evidence, 'cleaned': evidence, 'sourceHints': shared_hints})

    scenario_pairs = []
    for alias, values in label_map.items():
        if any(token in alias for token in ['应用场景', '适用场景', '使用场景', '典型场景']):
            scenario_pairs.extend(values)
    if scenario_pairs:
        summary = build_unstructured_summary('RAG 的常见应用场景包括', scenario_pairs)
        if summary:
            items['core'].append({'raw': summary, 'cleaned': summary, 'sourceHints': shared_hints})

    if not items['evidence'] and intro_line:
        items['evidence'].append({'raw': intro_line, 'cleaned': intro_line[:320], 'sourceHints': shared_hints})

    for line in filtered_body:
        cleaned = clean_candidate_text(line)
        if not cleaned:
            continue
        if is_uncertainty_text(cleaned) or ('截至' in cleaned and len(cleaned) >= 12):
            items['uncertainty'].append({'raw': cleaned, 'cleaned': cleaned, 'sourceHints': shared_hints})

    for key in items:
        items[key] = uniq_dicts(items[key], lambda item: item.get('cleaned'))[:5]
    return items


def parse_answer(answer_text: str):
    items = {'core': [], 'evidence': [], 'uncertainty': []}
    sections, intro = extract_structured_sections(answer_text)
    substantive_structured = any(sections.get(name) for name in ('core', 'evidence', 'uncertainty'))
    if substantive_structured:
        items['core'].extend(extract_items_from_section_raw('core', sections.get('core', '')))
        items['evidence'].extend(extract_items_from_section_raw('evidence', sections.get('evidence', '')))
        items['uncertainty'].extend(extract_items_from_section_raw('uncertainty', sections.get('uncertainty', '')))
        if not items['core'] and intro:
            items['core'].extend(extract_items_from_section_raw('core', intro))
    else:
        unstructured = parse_unstructured_answer(answer_text)
        if any(unstructured.values()):
            items = unstructured
        else:
            items = parse_answer_fallback(answer_text)

    for key in items:
        items[key] = uniq_dicts(items[key], lambda item: item.get('cleaned'))[:5]

    if not items['core']:
        paragraphs = [clean_candidate_text(p.strip()) for p in str(answer_text or '').split('\n\n') if p.strip()]
        items['core'] = [{'raw': p, 'cleaned': p} for p in uniq([p for p in paragraphs if p and not p.lower().startswith('sources:')][:5])]
    return items


def score_evidence_sentence(sentence: str) -> int:
    text = str(sentence or '').strip()
    if not text:
        return -999
    score = 0
    if cjk_count(text) >= 6 or len(text) >= 28:
        score += 2
    if 28 <= len(text) <= 220:
        score += 2
    if any(token in text for token in ['核心', '定义', '原理', '流程', '步骤', '机制', '准确', '检索', '生成', '向量', '数据库', '幻觉']):
        score += 3
    if any(token in text for token in ['登录', '注册', '导航', '版权', 'cookie', '联系我们', '上一篇', '下一篇']):
        score -= 4
    if any(token in text for token in ['信息冲突', '时效性风险', '不确定']) and '定义' not in text:
        score -= 3
    if text.count('/') >= 3 or text.count('|') >= 3:
        score -= 3
    return score


def extract_named_list_items(text: str):
    raw_multiline = str(text or '').strip()
    if not raw_multiline:
        return []
    candidates = split_list_items(raw_multiline) or [line.strip() for line in raw_multiline.splitlines() if line.strip()]
    out = []
    seen = set()
    for candidate in candidates:
        cleaned = clean_candidate_text(candidate)
        if not cleaned:
            continue
        cleaned = re.sub(r'^(?:来源网站|来源站点|source sites?)\s*[:：]?\s*', '', cleaned, flags=re.I)
        cleaned = normalize_space(cleaned)
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        out.append(cleaned)
    return out


def extract_source_metadata(answer_text: str):
    sections, _ = extract_structured_sections(answer_text)
    source_sites = extract_named_list_items(sections.get('source_sites', ''))
    source_urls = []
    for value in split_list_items(sections.get('sources', '')) or [sections.get('sources', '')]:
        source_urls.extend(extract_url_like_refs(value))
    return source_sites, uniq(source_urls)


def extract_source_site_url_pairs(answer_text: str):
    source_sites, source_urls = extract_source_metadata(answer_text)
    pairs = []
    for site, url in zip(source_sites, source_urls):
        alias = normalize_alias(site)
        norm = normalize_url(url)
        if not site or not url or not alias or not norm:
            continue
        pairs.append({
            'site': site,
            'siteAlias': alias,
            'url': url,
            'urlNorm': norm,
        })
    return pairs


def url_path_depth(url: str) -> int:
    parsed = urlparse(str(url or '').strip())
    segments = [part for part in (parsed.path or '/').split('/') if part]
    return len(segments)


def is_parent_url(parent: str, child: str) -> bool:
    parent_parsed = urlparse(str(parent or '').strip())
    child_parsed = urlparse(str(child or '').strip())
    if not parent_parsed.netloc or comparable_host(parent_parsed.netloc) != comparable_host(child_parsed.netloc):
        return False
    parent_path = (parent_parsed.path or '/').rstrip('/')
    child_path = (child_parsed.path or '/').rstrip('/')
    if not parent_path or parent_path == '/':
        return bool(child_path and child_path != '/')
    return child_path.startswith(parent_path + '/') and child_path != parent_path


def is_generic_source_url(url: str) -> bool:
    depth = url_path_depth(url)
    return depth <= 1


def extract_evidence_from_results(results):
    points = []
    excerpts = []
    seen_excerpt = set()
    for item in results or []:
        title = str(item.get('title') or '').strip()
        url = str(item.get('url') or '').strip()
        evidence_text = str(item.get('evidenceText') or '').strip()
        summary = str(item.get('summary') or '').strip()
        merged_text = evidence_text or summary

        parsed = parse_answer(merged_text)
        parsed_evidence = parsed.get('evidence') or []
        if parsed_evidence:
            for evidence_item in parsed_evidence[:3]:
                cleaned = clean_candidate_text(evidence_item.get('cleaned') or evidence_item.get('raw') or '')
                if not cleaned or cleaned in seen_excerpt:
                    continue
                seen_excerpt.add(cleaned)
                points.append(cleaned)
                excerpts.append({
                    'title': title,
                    'url': url,
                    'excerpt': cleaned,
                })
            continue

        candidates = []
        if evidence_text:
            candidates.extend(split_sentences(evidence_text))
        if summary:
            candidates.extend(split_sentences(summary))
        scored = []
        seen = set()
        for sentence in candidates:
            normalized = clean_candidate_text(sentence)
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            scored.append((score_evidence_sentence(normalized), normalized))
        scored.sort(key=lambda item: (-item[0], -len(item[1])))
        best = next((sentence for score, sentence in scored if score >= 2), '')
        if not best and scored:
            best = scored[0][1]
        if best and best not in seen_excerpt:
            seen_excerpt.add(best)
            points.append(best)
            excerpts.append({
                'title': title,
                'url': url,
                'excerpt': best,
            })
    return uniq(points)[:5], excerpts[:5]


def normalize_source_links(existing_links, answer_text: str):
    links = []
    seen_urls = set()
    source_sites, source_urls = extract_source_metadata(answer_text)
    site_url_pairs = extract_source_site_url_pairs(answer_text)
    source_inputs = list(existing_links or [])
    source_inputs.extend({'href': url, 'text': url} for url in extract_urls(answer_text))
    source_inputs.extend({'href': url, 'text': url} for url in source_urls)
    for item in source_inputs:
        if isinstance(item, dict):
            href = clean_url(str(item.get('href') or '').strip())
            text = str(item.get('text') or href).strip()
        else:
            href = clean_url(str(item).strip())
            text = href
        normalized = normalize_url(href)
        if href and is_probably_valid_url(href) and normalized not in seen_urls:
            seen_urls.add(normalized)
            links.append({'href': href, 'text': text})

    site_aliases = [normalize_alias(site) for site in source_sites if normalize_alias(site)]
    for link in links:
        link_aliases = aliases_for_link(link)
        for pair in site_url_pairs:
            if pair['urlNorm'] == normalize_url(link.get('href')):
                link['text'] = pair['site']
                break
        if str(link.get('text') or '').strip() and str(link.get('text')).strip() != str(link.get('href')).strip():
            continue
        for raw_site, site_alias in zip(source_sites, site_aliases):
            if site_alias and site_alias in link_aliases:
                link['text'] = raw_site
                break

    preferred_norms = {pair['urlNorm'] for pair in site_url_pairs}
    if preferred_norms:
        filtered = []
        for link in links:
            href = str(link.get('href') or '').strip()
            norm = normalize_url(href)
            if not norm:
                continue
            if norm in preferred_norms:
                filtered.append(link)
                continue
            if any(is_parent_url(href, pair['url']) for pair in site_url_pairs):
                continue
            if is_generic_source_url(href) and any(comparable_host(domain_of(href)) == comparable_host(domain_of(pair['url'])) for pair in site_url_pairs):
                continue
            filtered.append(link)
        links = filtered

    deduped = []
    for link in links:
        href = str(link.get('href') or '').strip()
        if not href:
            continue
        if any(is_parent_url(href, other.get('href')) for other in links if other is not link):
            continue
        deduped.append(link)
    return uniq_dicts(deduped, lambda item: normalize_url(item.get('href')))


def aliases_for_link(link):
    href = str((link or {}).get('href') or '').strip()
    text = str((link or {}).get('text') or '').strip()
    domain = domain_of(href)
    aliases = set()
    candidates = [text, domain]
    if domain:
        host_parts = [part for part in domain.split('.') if part and part not in {'www'}]
        if host_parts:
            candidates.append(host_parts[0])
        if len(host_parts) >= 2:
            candidates.append(host_parts[-2])
    for candidate in candidates:
        normalized = normalize_alias(candidate)
        if normalized and normalized not in GENERIC_ALIAS_STOPWORDS and len(normalized) >= 3:
            aliases.add(normalized)
    return aliases


def resolve_citations(text: str, source_links):
    matches = []
    seen = set()
    url_index = {normalize_url(link.get('href')): link for link in source_links if link.get('href')}

    for url in extract_url_like_refs(text):
        normalized = normalize_url(url)
        link = url_index.get(normalized) or {'href': url, 'text': url}
        key = normalize_url(link.get('href'))
        if key and key not in seen:
            seen.add(key)
            matches.append(link)

    mentioned_domains = set(extract_domain_mentions(text))
    normalized_text = normalize_alias(text)
    for link in source_links:
        href = str(link.get('href') or '').strip()
        key = normalize_url(href)
        if not key or key in seen:
            continue
        domain = domain_of(href)
        aliases = aliases_for_link(link)
        if domain and domain in mentioned_domains:
            seen.add(key)
            matches.append(link)
            continue
        if any(alias and alias in normalized_text for alias in aliases):
            seen.add(key)
            matches.append(link)
    return matches


def build_source_page_excerpts(provider: str, source_links):
    enable = os.environ.get('AGENT_REACH_SOURCE_JINA_ENABLE', '0') == '1'
    top_n = max(0, int(os.environ.get('AGENT_REACH_SOURCE_JINA_TOP_N', '0') or '0'))
    timeout_sec = max(1, int(os.environ.get('AGENT_REACH_SOURCE_JINA_TIMEOUT_SEC', '15') or '15'))
    if not enable or top_n <= 0 or provider != 'deepseek':
        return [], {
            'enabled': enable,
            'topN': top_n,
            'attempted': 0,
            'succeeded': 0,
            'provider': 'jina',
        }

    excerpts = []
    attempted = 0
    succeeded = 0
    for link in source_links[:top_n]:
        href = str(link.get('href') or '').strip()
        if not href:
            continue
        attempted += 1
        excerpt = fetch_jina_excerpt(href, timeout_sec)
        if excerpt:
            succeeded += 1
            excerpts.append({
                'url': href,
                'text': str(link.get('text') or href).strip(),
                'domain': domain_of(href),
                'excerpt': excerpt,
                'fetchedVia': 'jina',
            })

    return excerpts, {
        'enabled': enable,
        'topN': top_n,
        'attempted': attempted,
        'succeeded': succeeded,
        'provider': 'jina',
    }


def build_citations_by_finding(core_items, source_links, source_page_excerpts, answer_text: str = ''):
    excerpt_by_url = {normalize_url(item.get('url')): item for item in source_page_excerpts if item.get('url')}
    site_url_pairs = extract_source_site_url_pairs(answer_text)
    citations = []
    for idx, item in enumerate(core_items, start=1):
        raw_text = str(item.get('raw') or item.get('cleaned') or '').strip()
        cleaned = str(item.get('cleaned') or '').strip()
        matched_links = resolve_citations(raw_text, source_links)
        if not matched_links:
            hint_urls = [clean_url(url) for url in (item.get('sourceHints') or []) if clean_url(url)]
            hint_norms = {normalize_url(url) for url in hint_urls if normalize_url(url)}
            matched_links = [link for link in source_links if normalize_url(link.get('href')) in hint_norms]
        if len(matched_links) > 1:
            filtered = []
            for link in matched_links:
                href = str(link.get('href') or '').strip()
                if any(is_parent_url(href, other.get('href')) for other in matched_links if other is not link):
                    continue
                filtered.append(link)
            matched_links = filtered or matched_links
        matched_links = uniq_dicts(matched_links, lambda link: normalize_url(link.get('href')))

        best_pair = choose_best_site_pair_for_finding(raw_text or cleaned, site_url_pairs, matched_links)
        if best_pair:
            best_norm = best_pair['urlNorm']
            best_links = [link for link in matched_links if normalize_url(link.get('href')) == best_norm]
            if best_links:
                matched_links = best_links

        matched_urls = uniq(link.get('href') for link in matched_links if link.get('href'))
        matched_domains = uniq(domain_of(url) for url in matched_urls if url)
        matched_texts = uniq(link.get('text') for link in matched_links if link.get('text'))
        supporting = []
        for url in matched_urls[:3]:
            excerpt = excerpt_by_url.get(normalize_url(url))
            if excerpt:
                supporting.append({
                    'url': url,
                    'domain': excerpt.get('domain'),
                    'excerpt': excerpt.get('excerpt'),
                })
        citations.append({
            'index': idx,
            'finding': cleaned,
            'sourceUrls': matched_urls,
            'sourceDomains': matched_domains,
            'sourceTexts': matched_texts,
            'supportingSourceExcerpts': supporting,
        })
    return citations


def backfill_link_texts_from_source_sites(source_links, source_sites):
    site_pool = [(site, normalize_alias(site)) for site in source_sites if normalize_alias(site)]
    for link in source_links:
        text = str(link.get('text') or '').strip()
        href = str(link.get('href') or '').strip()
        if text and text != href:
            continue
        link_aliases = aliases_for_link(link)
        matched_site = next((site for site, alias in site_pool if alias in link_aliases), '')
        if matched_site:
            link['text'] = matched_site
    return source_links


def choose_best_site_pair_for_finding(text: str, site_url_pairs, matched_links):
    raw_text = str(text or '').strip()
    if not raw_text or not site_url_pairs or not matched_links:
        return None
    normalized_text = normalize_alias(raw_text)
    matched_norms = {normalize_url(link.get('href')) for link in matched_links if link.get('href')}
    candidates = []
    for pair in site_url_pairs:
        if pair['urlNorm'] not in matched_norms:
            continue
        score = 0
        if pair['siteAlias'] and pair['siteAlias'] in normalized_text:
            score += 10
        if pair['site'] and pair['site'] in raw_text:
            score += 8
        score += url_path_depth(pair['url']) * 2
        if not is_generic_source_url(pair['url']):
            score += 2
        candidates.append((score, pair))
    if not candidates:
        return None
    candidates.sort(key=lambda item: (-item[0], -url_path_depth(item[1]['url']), item[1]['url']))
    return candidates[0][1]


def prioritize_output_source_links(source_links, answer_text: str, citations_by_finding):
    links = uniq_dicts(source_links or [], lambda item: normalize_url(item.get('href')))
    site_url_pairs = extract_source_site_url_pairs(answer_text)
    if len(site_url_pairs) < 3:
        return links

    norm_to_link = OrderedDict()
    for link in links:
        norm = normalize_url(link.get('href'))
        if norm and norm not in norm_to_link:
            norm_to_link[norm] = link

    ordered_norms = []
    for pair in site_url_pairs:
        if pair['urlNorm'] not in ordered_norms:
            ordered_norms.append(pair['urlNorm'])
    for citation in citations_by_finding or []:
        for url in citation.get('sourceUrls') or []:
            norm = normalize_url(url)
            if norm and norm not in ordered_norms:
                ordered_norms.append(norm)

    prioritized = []
    for norm in ordered_norms:
        pair = next((item for item in site_url_pairs if item['urlNorm'] == norm), None)
        link = norm_to_link.get(norm)
        if link:
            if pair and pair.get('site'):
                link = dict(link)
                link['text'] = pair['site']
            prioritized.append(link)
            continue
        if pair:
            prioritized.append({'href': pair['url'], 'text': pair['site']})

    return uniq_dicts(prioritized, lambda item: normalize_url(item.get('href')))


def classify_uncertainty_item(text: str):
    cleaned = normalize_space(text).strip()
    if not cleaned or is_empty_uncertainty_text(cleaned):
        return None
    lowered = cleaned.lower()
    kinds = []
    if any(token in cleaned for token in CONFLICT_TOKENS):
        kinds.append('conflict')
    if any(token in cleaned for token in STALENESS_TOKENS) or re.search(r'\b20\d{2}\b', cleaned):
        kinds.append('stalenessRisk')
    if any(token in cleaned for token in COVERAGE_GAP_TOKENS):
        kinds.append('coverageGap')
    if not kinds:
        if '无统一标准' in cleaned or '差异较大' in cleaned or '依赖' in cleaned:
            kinds.append('coverageGap')
        else:
            kinds.append('generalUncertainty')
    return {
        'text': cleaned,
        'kinds': uniq(kinds),
        'severity': 'medium' if ('conflict' in kinds or 'stalenessRisk' in kinds) else 'low',
    }


def build_uncertainty_structured(uncertainties, citations_by_finding):
    entries = []
    for item in uncertainties or []:
        classified = classify_uncertainty_item(item)
        if classified:
            entries.append(classified)

    conflicts = []
    staleness_risks = []
    coverage_gaps = []
    general = []
    for item in entries:
        if 'conflict' in item['kinds']:
            conflicts.append(item)
        if 'stalenessRisk' in item['kinds']:
            staleness_risks.append(item)
        if 'coverageGap' in item['kinds']:
            coverage_gaps.append(item)
        if item['kinds'] == ['generalUncertainty']:
            general.append(item)

    finding_gaps = []
    for citation in citations_by_finding or []:
        if not (citation.get('sourceUrls') or []):
            finding_gaps.append({
                'findingIndex': citation.get('index'),
                'finding': citation.get('finding'),
                'reason': 'no-linked-source',
            })

    if finding_gaps:
        coverage_gaps.append({
            'text': '部分 finding 未能对齐到明确 sourceUrls，来源映射仍有缺口。',
            'kinds': ['coverageGap'],
            'severity': 'medium',
            'affectedFindings': finding_gaps,
        })

    return {
        'conflicts': conflicts,
        'stalenessRisks': staleness_risks,
        'coverageGaps': coverage_gaps,
        'general': general,
        'hasMaterialUncertainty': bool(conflicts or staleness_risks or coverage_gaps or general),
    }


def main(path: str):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    answer_text = str(data.get('answerText') or '').strip()
    parsed_answer = parse_answer(answer_text)
    core_items = parsed_answer.get('core') or []
    evidence_items = parsed_answer.get('evidence') or []
    uncertainty_items = parsed_answer.get('uncertainty') or []

    status = str(data.get('status') or '').strip().upper()
    failure = data.get('failure') or {}
    failure_code = str(failure.get('code') or ((data.get('verdict') or {}).get('failure') or {}).get('code') or '').strip().upper()
    blocked_or_error_page = status in {'BLOCKED', 'FAIL'} and (
        failure_code.startswith('F-L0-HTTP') or
        failure_code.startswith('F-L0-CAPTCHA') or
        failure_code.startswith('F-L1-AUTH')
    )

    core_findings = [item.get('cleaned') for item in core_items if item.get('cleaned')][:5]
    evidence_points = [item.get('cleaned') for item in evidence_items if item.get('cleaned')][:5]
    uncertainties = [item.get('cleaned') for item in uncertainty_items if item.get('cleaned')][:5]

    result_evidence_points, evidence_excerpts = extract_evidence_from_results(data.get('results') or [])
    if not blocked_or_error_page:
        if result_evidence_points:
            evidence_points = uniq(result_evidence_points + evidence_points)[:5]
        elif not evidence_points:
            derived = []
            for item in data.get('results') or []:
                title = str(item.get('title') or '').strip()
                summary = str(item.get('summary') or '').strip()
                evidence_text = str(item.get('evidenceText') or '').strip()
                if title and evidence_text:
                    derived.append(f'{title}：{evidence_text[:280]}')
                elif title and summary:
                    derived.append(f'{title}：{summary}')
                elif title:
                    derived.append(title)
            evidence_points = uniq(derived)[:5]

    channel = str(data.get('channel') or '').strip()
    summary = str(data.get('summary') or '').strip().lower()
    route = [channel] if channel else []
    if channel == 'exa-search-api' and ('deepseek' in summary or data.get('status') == 'FALLBACK'):
        route = ['deepseek-smart-search', 'exa-search-api']

    if channel == 'exa-search-api':
        provider = 'exa'
    elif 'deepseek' in channel:
        provider = 'deepseek'
    else:
        provider = 'unknown'

    source_sites, _ = extract_source_metadata(answer_text)
    links = normalize_source_links(data.get('sourceLinks') or [], answer_text)
    links = backfill_link_texts_from_source_sites(links, source_sites)
    source_page_excerpts, source_jina_diag = build_source_page_excerpts(provider, links)
    citations_by_finding = build_citations_by_finding(core_items, links, source_page_excerpts, answer_text)
    links = prioritize_output_source_links(links, answer_text, citations_by_finding)
    source_domains = uniq(domain_of(item.get('href')) for item in links if item.get('href'))
    uncertainty_structured = build_uncertainty_structured(uncertainties, citations_by_finding)

    prefer_parsed_fields = provider == 'deepseek'
    final_core_findings = uniq(core_findings if prefer_parsed_fields and core_findings else (data.get('coreFindings') or core_findings))[:5]
    final_evidence_points = uniq(evidence_points if prefer_parsed_fields and evidence_points else (data.get('evidencePoints') or evidence_points))[:5]
    final_evidence_excerpts = evidence_excerpts if prefer_parsed_fields and evidence_excerpts else (data.get('evidenceExcerpts') or evidence_excerpts)
    final_uncertainties = uniq(uncertainties if prefer_parsed_fields and uncertainties else (data.get('uncertainties') or uncertainties))[:5]

    if blocked_or_error_page:
        answer_text = ''
        links = []
        source_page_excerpts = []
        citations_by_finding = []
        source_domains = []
        final_core_findings = []
        final_evidence_points = []
        final_evidence_excerpts = []
        final_uncertainties = uniq([
            item for item in [str(data.get('summary') or '').strip(), str(failure.get('detail') or '').strip()] if item
        ])[:3]
        uncertainty_structured = {
            'conflicts': [],
            'stalenessRisks': [],
            'coverageGaps': [],
            'general': [{'text': item, 'kinds': ['runtimeBlocked'], 'severity': 'high'} for item in final_uncertainties],
            'hasMaterialUncertainty': True,
        }

    search_diagnostics = {
        'enrichment': data.get('enrichment') or {},
        'searchType': data.get('searchType'),
        'requestId': data.get('requestId'),
    }
    search_diagnostics['enrichment'] = dict(search_diagnostics.get('enrichment') or {})
    search_diagnostics['enrichment']['sourceJina'] = source_jina_diag

    data['answerText'] = answer_text or None
    data['results'] = [] if blocked_or_error_page else (data.get('results') or [])
    data['sourceLinks'] = links
    data['normalizedContractVersion'] = 'research-v1'
    data['searchDiagnostics'] = search_diagnostics
    data['normalizedAt'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    data['provider'] = provider
    data['route'] = route
    data['fallbackUsed'] = data.get('status') == 'FALLBACK'
    data['sourceCount'] = len(links)
    data['sourceDomains'] = source_domains
    data['coreFindings'] = final_core_findings
    data['evidencePoints'] = final_evidence_points
    data['evidenceExcerpts'] = final_evidence_excerpts
    data['uncertainties'] = final_uncertainties
    data['uncertaintyStructured'] = uncertainty_structured
    data['sourcePageExcerpts'] = source_page_excerpts
    data['citationsByFinding'] = citations_by_finding

    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit('usage: normalize-research-output.py <json-file>')
    main(sys.argv[1])
