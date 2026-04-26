// ============================================================
// agent-web-search-pro v2 — Request Utilities
// ============================================================
import type { SearchMode, SearchRequestMeta } from "../types.js";

function isLikelyUrl(value?: string): boolean {
  return !!value && /^https?:\/\//i.test(value.trim());
}

export function detectMode(params: { query?: string; url?: string; site?: string }): SearchMode {
  if (params.url || isLikelyUrl(params.query)) return "read-url";
  if (params.site) return "site-search";
  return "search";
}

export function buildRequestMeta(input: {
  mode: SearchMode;
  query?: string;
  url?: string;
  site?: string;
  language?: string;
  limit?: number;
  deepRead?: boolean;
  sort?: string;
}): SearchRequestMeta {
  const normalizedUrl = input.url ?? (isLikelyUrl(input.query) ? input.query?.trim() : undefined);
  const normalizedQuery = normalizedUrl ? undefined : input.query?.trim();
  return {
    mode: input.mode,
    query: normalizedQuery,
    url: normalizedUrl,
    site: input.site?.trim() || undefined,
    language: input.language?.trim() || undefined,
    limit: Math.max(1, Math.min(10, input.limit ?? 5)),
    deepRead: Boolean(input.deepRead),
    sort: input.sort?.trim() || undefined,
  };
}
