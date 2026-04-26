// ============================================================
// agent-web-search-pro v2 — Tavily Search Provider
// ============================================================
import type { SearchCandidate, SearchRequestMeta } from "../types.js";
import { getProviderSettings } from "./config.js";
import { fetchWithTimeout, normalizeErrorMessage } from "./http.js";

export async function callTavilySearch(request: SearchRequestMeta): Promise<{
  candidates: SearchCandidate[];
  answer?: string;
  error?: string;
  degraded: boolean;
  responseTimeMs?: number;
}> {
  const { tavilyApiKey } = await getProviderSettings();
  if (!tavilyApiKey) {
    return { candidates: [], degraded: true, error: "Missing Tavily API key" };
  }

  const startedAt = Date.now();
  const query = `${request.query ?? ""}${request.site ? ` site:${request.site}` : ""}`.trim();

  try {
    const response = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tavilyApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        search_depth: request.deepRead ? "advanced" : "basic",
        max_results: request.limit,
        include_answer: true,
        include_images: false,
        topic: "general",
      }),
    });

    if (!response.ok) {
      let message = response.statusText;
      try {
        const errorData: any = await response.json();
        message = errorData?.detail?.error || errorData?.error || message;
      } catch {}
      return { candidates: [], degraded: true, error: message, responseTimeMs: Date.now() - startedAt };
    }

    const data: any = await response.json();
    const candidates: SearchCandidate[] = Array.isArray(data?.results)
      ? data.results
          .filter((item: any) => item?.url)
          .map((item: any) => ({
            title: item.title?.trim() || item.url || "Untitled",
            url: item.url || "",
            snippet: item.content?.trim()?.slice(0, 240),
            source: "tavily",
            score: typeof item.score === "number" ? item.score : undefined,
          }))
      : [];

    const answer = typeof data?.answer === "string" ? data.answer.trim() : undefined;
    return { candidates, answer, degraded: false, responseTimeMs: Date.now() - startedAt };
  } catch (error) {
    return { candidates: [], degraded: true, error: normalizeErrorMessage(error), responseTimeMs: Date.now() - startedAt };
  }
}
