// ============================================================
// agent-web-search-pro v2 — Output Formatting Utilities
// ============================================================
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateHead } from "@mariozechner/pi-coding-agent";
import type { SearchResultPayload } from "../types.js";

export function formatCommandResult(payload: SearchResultPayload): string {
  const lines: string[] = [];
  lines.push(`🔎 模式: ${payload.request.mode}`);
  lines.push(`🧠 Provider: ${payload.provider}`);
  if (payload.request.query) lines.push(`📝 查询: ${payload.request.query}`);
  if (payload.request.url) lines.push(`🌐 URL: ${payload.request.url}`);
  if (payload.request.site) lines.push(`🏷️ Site: ${payload.request.site}`);
  lines.push(`📊 结果数: ${payload.resultCount}`);
  lines.push(`🧾 引用数: ${payload.citationsCount}`);
  lines.push(`🛡️ Evidence: ${payload.evidenceStatus}`);
  if (payload.deepReadCount) lines.push(`📖 Deep Read: ${payload.deepReadCount}`);
  lines.push(`📌 摘要: ${payload.summary}`);
  if (payload.shouldNotInferFacts && payload.antiHallucinationWarning) lines.push(`⛔ ${payload.antiHallucinationWarning}`);
  lines.push("");
  if (payload.results.length > 0) {
    lines.push("Top Results:");
    payload.results.slice(0, 5).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title}`);
      lines.push(`   ${item.url}`);
      if (item.snippet) lines.push(`   ${item.snippet.slice(0, 220)}`);
    });
  } else {
    lines.push("Top Results: []");
  }
  if (payload.degraded) {
    lines.push("");
    lines.push(`⚠️ 降级: ${payload.error ?? "provider degraded"}`);
  }
  return lines.join("\n");
}

export function formatTextResult(payload: SearchResultPayload): string {
  const lines: string[] = [];
  lines.push("request:");
  lines.push(`- mode: ${payload.request.mode}`);
  lines.push(`- query: ${payload.request.query ?? ""}`);
  lines.push(`- url: ${payload.request.url ?? ""}`);
  lines.push(`- site: ${payload.request.site ?? ""}`);
  lines.push(`- language: ${payload.request.language ?? ""}`);
  lines.push(`- limit: ${payload.request.limit}`);
  lines.push(`- deepRead: ${payload.request.deepRead ? "true" : "false"}`);
  lines.push(`- sort: ${payload.request.sort ?? ""}`);
  lines.push("");
  lines.push("execution:");
  lines.push(`- provider: ${payload.provider}`);
  lines.push(`- degraded: ${payload.degraded ? "yes" : "no"}`);
  lines.push(`- evidenceStatus: ${payload.evidenceStatus}`);
  lines.push(`- authoritative: ${payload.authoritative ? "yes" : "no"}`);
  lines.push(`- shouldNotInferFacts: ${payload.shouldNotInferFacts ? "yes" : "no"}`);
  if (payload.responseTimeMs !== undefined) lines.push(`- responseTimeMs: ${payload.responseTimeMs}`);
  if (payload.deepReadCount !== undefined) lines.push(`- deepReadCount: ${payload.deepReadCount}`);
  if (payload.error) lines.push(`- error: ${payload.error}`);
  if (payload.antiHallucinationWarning) lines.push(`- antiHallucinationWarning: ${payload.antiHallucinationWarning}`);
  lines.push("");
  lines.push("response:");
  lines.push(`- summary: ${payload.summary}`);
  lines.push(`- resultCount: ${payload.resultCount}`);
  lines.push(`- citationsCount: ${payload.citationsCount}`);
  lines.push("");
  lines.push("topResults:");
  if (payload.topResultsPreview.length > 0) lines.push(...payload.topResultsPreview.map((line) => `- ${line}`));
  else lines.push("- []");
  lines.push("");
  lines.push("citations:");
  if (payload.citations.length > 0) lines.push(...payload.citations.slice(0, 5).map((cite) => `- ${cite.title} -> ${cite.url}`));
  else lines.push("- []");
  return lines.join("\n");
}

export function formatTruncatedResult(text: string): string {
  const truncated = truncateHead(text, { maxLines: DEFAULT_MAX_LINES, maxBytes: DEFAULT_MAX_BYTES });
  return truncated.truncated ? `${truncated.text}\n\n[truncated: output exceeded maxLines/maxBytes]` : truncated.text;
}
