// ============================================================
// agent-web-search-pro v2 — Search Round (Candidate Discovery)
// ============================================================
// Executes search via providers and shapes output into the v2
// SearchRoundOutput format with recommendedToBrowse.

import type {
  SearchRoundOutput,
  SearchCandidate,
  RecommendedPage,
  SearchRequestMeta,
  SearchResultPayload,
  ProviderName,
  SearchSource,
} from "../types.js";
import { callTavilySearch } from "../providers/tavily.js";
import { callJinaReader } from "../providers/jina-reader.js";
import { buildPayload } from "../utils/results.js";
import { buildProgressText } from "../utils/progress.js";
import { MAX_DEEP_READ_RESULTS } from "../providers/config.js";

/**
 * Apply deep read to top search candidates.
 * Enriches snippets with actual page content from Jina Reader.
 */
async function applyDeepRead(
  results: SearchSource[],
  request: SearchRequestMeta,
  onUpdate?: (message: string, details?: Record<string, unknown>) => void,
): Promise<{ enrichedResults: SearchSource[]; deepReadCount: number }> {
  if (results.length === 0 || !request.deepRead) {
    return { enrichedResults: results, deepReadCount: 0 };
  }

  const targets = results.slice(0, MAX_DEEP_READ_RESULTS);
  let deepReadCount = 0;
  const enrichedResults: SearchSource[] = [];

  for (const item of results) {
    const target = targets.find((c) => c.url === item.url);
    if (!target) {
      enrichedResults.push(item);
      continue;
    }

    const readResult = await callJinaReader(target.url);
    if (readResult.error) {
      enrichedResults.push(item);
      continue;
    }

    deepReadCount += 1;
    enrichedResults.push({
      ...item,
      title: readResult.title || item.title,
      snippet: readResult.snippet || item.snippet,
      source: readResult.via ? `${item.source || "tavily"}+${readResult.via}` : item.source,
      deepReadApplied: true,
    });
  }

  return { enrichedResults, deepReadCount };
}

/**
 * Score and rank candidates for browsing recommendation.
 * Uses snippet length, score, and deep-read enrichment as signals.
 */
function scoreForBrowsing(candidate: SearchCandidate): number {
  let score = 0;
  if (candidate.score !== undefined) score += candidate.score * 40;
  score += Math.min(candidate.snippet.length / 10, 30);
  if (candidate.deepReadApplied) score += 20;
  if (candidate.source?.includes("+")) score += 10; // enriched
  return score;
}

/**
 * Select top candidates for browsing recommendation.
 */
function selectForBrowsing(candidates: SearchCandidate[], limit = 3): RecommendedPage[] {
  const scored = candidates
    .filter((c) => c.url && c.title)
    .map((c) => ({
      ...c,
      browseScore: scoreForBrowsing(c),
    }))
    .sort((a, b) => b.browseScore - a.browseScore)
    .slice(0, limit);

  return scored.map((c) => ({
    url: c.url,
    title: c.title,
    snippet: c.snippet,
    reason: c.deepReadApplied
      ? "已增强阅读，内容质量较高"
      : `相关性评分 ${c.score?.toFixed(2) ?? "N/A"}`,
    score: c.browseScore,
  }));
}

/**
 * Execute a search round and return v2-shaped output.
 */
export async function executeSearchRound(
  request: SearchRequestMeta,
  onUpdate?: (message: string, details?: Record<string, unknown>) => void,
): Promise<{ payload: SearchResultPayload; v2Output: SearchRoundOutput }> {
  const startedAt = Date.now();

  // URL read mode → use Jina Reader directly
  if (request.mode === "read-url") {
    const targetUrl = request.url;
    if (!targetUrl) {
      const legacyPayload = buildPayload({
        mode: request.mode,
        provider: "degraded",
        summary: "缺少 URL，无法进入网页阅读模式。",
        results: [],
        citations: [],
        degraded: true,
        error: "Missing URL",
        request,
      });
      const v2Output: SearchRoundOutput = {
        searchMeta: { query: "", engines: [], deepRead: false, timestamp: new Date().toISOString() },
        webResults: [],
        recommendedToBrowse: [],
        researchStatus: "degraded",
      };
      return { payload: legacyPayload, v2Output };
    }

    const readResult = await callJinaReader(targetUrl);
    const readStartedAt = Date.now();
    if (readResult.error) {
      const legacyPayload = buildPayload({
        mode: request.mode,
        provider: "degraded",
        summary: `网页读取失败：${readResult.error}`,
        results: [],
        citations: [],
        degraded: true,
        error: readResult.error,
        request,
        responseTimeMs: Date.now() - startedAt,
      });
      const v2Output: SearchRoundOutput = {
        searchMeta: { query: "", engines: [], deepRead: false, timestamp: new Date().toISOString() },
        webResults: [],
        recommendedToBrowse: [],
        researchStatus: "degraded",
      };
      return { payload: legacyPayload, v2Output };
    }

    const provider: ProviderName = readResult.via === "curl-jina-reader" ? "curl-jina-reader" : "jina-reader";
    const candidate: SearchCandidate = {
      title: readResult.title,
      url: targetUrl,
      snippet: readResult.snippet,
      source: provider,
      deepReadApplied: true,
    };

    const legacyPayload = buildPayload({
      mode: request.mode,
      provider,
      summary: `已读取目标网页，返回正文摘录${readResult.snippet.length >= 500 ? "（已截断预览）" : ""}。`,
      results: [{ title: readResult.title, url: targetUrl, snippet: readResult.snippet, source: provider, deepReadApplied: true }],
      citations: [{ title: readResult.title, url: targetUrl }],
      degraded: false,
      request,
      responseTimeMs: Date.now() - startedAt,
      deepReadCount: 1,
    });

    const v2Output: SearchRoundOutput = {
      searchMeta: {
        query: targetUrl,
        engines: [provider],
        deepRead: true,
        timestamp: new Date().toISOString(),
        responseTimeMs: Date.now() - readStartedAt,
      },
      webResults: [candidate],
      recommendedToBrowse: [{
        url: targetUrl,
        title: readResult.title,
        snippet: readResult.snippet,
        reason: "URL 阅读模式，已完整读取",
        score: 100,
      }],
      researchStatus: "has_candidates",
    };

    return { payload: legacyPayload, v2Output };
  }

  // Search mode → use Tavily
  onUpdate?.(buildProgressText({ stage: "正在执行搜索", mode: request.mode, query: request.query, site: request.site }), { phase: "search" });

  const tavilyResult = await callTavilySearch(request);
  const responseTimeMs = Date.now() - startedAt;

  if (tavilyResult.degraded) {
    const legacyPayload = buildPayload({
      mode: request.mode,
      provider: "degraded",
      summary: `Tavily 搜索不可用：${tavilyResult.error ?? "未知错误"}`,
      results: [],
      citations: [],
      degraded: true,
      error: tavilyResult.error,
      request,
      responseTimeMs,
    });
    const v2Output: SearchRoundOutput = {
      searchMeta: {
        query: request.query ?? "",
        engines: ["tavily"],
        siteFilter: request.site,
        deepRead: request.deepRead,
        timestamp: new Date().toISOString(),
        responseTimeMs,
      },
      webResults: [],
      recommendedToBrowse: [],
      researchStatus: "degraded",
    };
    return { payload: legacyPayload, v2Output };
  }

  // Convert Tavily candidates to SearchSource for legacy compat
  let results: SearchSource[] = tavilyResult.candidates.map((c) => ({
    title: c.title,
    url: c.url,
    snippet: c.snippet,
    source: c.source,
    score: c.score,
  }));

  let deepReadCount = 0;
  if (request.deepRead && results.length > 0) {
    const { enrichedResults, deepReadCount: dc } = await applyDeepRead(results, request, onUpdate);
    results = enrichedResults;
    deepReadCount = dc;
  }

  const candidates: SearchCandidate[] = results.map((r) => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet ?? "",
    source: r.source,
    score: r.score,
    deepReadApplied: r.deepReadApplied,
  }));

  const recommendedToBrowse = selectForBrowsing(candidates);

  const provider: ProviderName = deepReadCount > 0 ? "hybrid" : "tavily";
  const summary = tavilyResult.answer
    ? tavilyResult.answer
    : results.length > 0
      ? `已通过 ${provider} 获取 ${results.length} 条结果。`
      : "搜索已执行，但未返回结果。";

  const legacyPayload = buildPayload({
    mode: request.mode,
    provider,
    summary: deepReadCount > 0 ? `${summary}；已对前 ${deepReadCount} 条结果执行网页阅读增强。` : summary,
    results,
    citations: results.map((r) => ({ title: r.title, url: r.url })),
    degraded: false,
    request,
    responseTimeMs,
    deepReadCount: deepReadCount > 0 ? deepReadCount : undefined,
  });

  const v2Output: SearchRoundOutput = {
    searchMeta: {
      query: request.query ?? "",
      engines: ["tavily"],
      siteFilter: request.site,
      deepRead: request.deepRead,
      timestamp: new Date().toISOString(),
      responseTimeMs,
    },
    webResults: candidates,
    recommendedToBrowse,
    researchStatus: candidates.length > 0 ? "has_candidates" : "no_results",
  };

  return { payload: legacyPayload, v2Output };
}
