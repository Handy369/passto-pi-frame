// ============================================================
// agent-web-search-pro v2 — Progress Message Utilities
// ============================================================

export function buildProgressText(input: {
  stage: string;
  mode?: string;
  query?: string;
  url?: string;
  site?: string;
  provider?: string;
  resultCount?: number;
  citationsCount?: number;
  evidenceStatus?: string;
  degraded?: boolean;
  shouldNotInferFacts?: boolean;
}): string {
  const lines = [
    `web-search-pro · ${input.stage}`,
    `- mode: ${input.mode ?? ""}`,
    `- query: ${input.query ?? ""}`,
    `- url: ${input.url ?? ""}`,
    `- site: ${input.site ?? ""}`,
    `- provider: ${input.provider ?? ""}`,
  ];

  if (input.resultCount !== undefined) lines.push(`- resultCount: ${input.resultCount}`);
  if (input.citationsCount !== undefined) lines.push(`- citationsCount: ${input.citationsCount}`);
  if (input.evidenceStatus) lines.push(`- evidenceStatus: ${input.evidenceStatus}`);
  if (input.degraded !== undefined) lines.push(`- degraded: ${input.degraded ? "yes" : "no"}`);
  if (input.shouldNotInferFacts !== undefined) lines.push(`- shouldNotInferFacts: ${input.shouldNotInferFacts ? "yes" : "no"}`);

  return lines.join("\n");
}
