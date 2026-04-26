// ============================================================
// agent-web-search-pro v2 — Result Utilities
// ============================================================
import type { SearchSource, SearchResultPayload, ProviderName, SearchMode, SearchRequestMeta } from "../types.js";

export function dedupeResults(results: SearchSource[]): SearchSource[] {
  const seen = new Set<string>();
  const deduped: SearchSource[] = [];
  for (const item of results) {
    const key = (item.url || item.title || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

export function toPreviewLines(results: SearchSource[]): string[] {
  return results.slice(0, 3).map((item, index) => {
    const snippet = item.snippet ? ` — ${item.snippet.slice(0, 120)}` : "";
    const deepReadMark = item.deepReadApplied ? " [deep-read]" : "";
    return `${index + 1}. ${item.title} (${item.url})${deepReadMark}${snippet}`;
  });
}

export function applyEvidenceFlags(payload: SearchResultPayload): SearchResultPayload {
  const evidenceStatus = payload.citations.length > 0
    ? payload.degraded ? "partial" : "sufficient"
    : "none";
  const shouldNotInferFacts = evidenceStatus === "none";
  const authoritative = evidenceStatus === "sufficient" && !payload.degraded;
  const antiHallucinationWarning = shouldNotInferFacts
    ? "No reliable citations were retrieved. Do NOT infer factual claims such as specs, release date, price, or product existence from this result alone."
    : undefined;

  return {
    ...payload,
    evidenceStatus,
    shouldNotInferFacts,
    authoritative,
    antiHallucinationWarning,
  };
}

export function buildPayload(base: Omit<SearchResultPayload, "resultCount" | "citationsCount" | "topResultsPreview" | "evidenceStatus" | "shouldNotInferFacts" | "authoritative">): SearchResultPayload {
  const results = dedupeResults(base.results);
  const citations = dedupeResults(base.citations.map((item) => ({ title: item.title, url: item.url }))).map((item) => ({
    title: item.title,
    url: item.url,
  }));

  return applyEvidenceFlags({
    ...base,
    results,
    citations,
    resultCount: results.length,
    citationsCount: citations.length,
    topResultsPreview: toPreviewLines(results),
  });
}
