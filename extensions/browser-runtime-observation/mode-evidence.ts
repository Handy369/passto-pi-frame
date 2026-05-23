import * as path from "node:path";

export const OBSERVATION_MODES = ["dom", "console-network", "lighthouse", "accessibility", "performance", "memory"] as const;

export type ObservationMode = (typeof OBSERVATION_MODES)[number];
export type EvidenceMetric = string | number | boolean | null;

export interface ObservationEvidence {
  toolName: string;
  input: unknown;
  contentText: string;
  details: unknown;
  isError: boolean;
  capturedAt: string;
}

export interface RecommendedToolCallTemplate {
  toolName: string;
  reason: string;
  params: Record<string, unknown>;
}

export interface NormalizedModeEvidence {
  mode: ObservationMode;
  toolNames: string[];
  highlights: string[];
  artifacts: Record<string, string>;
  metrics: Record<string, EvidenceMetric>;
  missingSignals: string[];
}

interface TemplateRequestLike {
  target: string;
  mode: ObservationMode;
  artifactDir: string;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown, key: string): string | undefined {
  const record = asRecord(value);
  return typeof record?.[key] === "string" ? (record[key] as string) : undefined;
}

function getNumber(value: unknown, key: string): number | undefined {
  const record = asRecord(value);
  return typeof record?.[key] === "number" ? (record[key] as number) : undefined;
}

function getBoolean(value: unknown, key: string): boolean | undefined {
  const record = asRecord(value);
  return typeof record?.[key] === "boolean" ? (record[key] as boolean) : undefined;
}

function getInputPath(evidence: ObservationEvidence | undefined, key = "filePath"): string | undefined {
  return getString(evidence?.input, key);
}

function getDetailsPath(evidence: ObservationEvidence | undefined, key = "filePath"): string | undefined {
  return getString(evidence?.details, key);
}

function readLastEvidence(evidence: ObservationEvidence[], ...toolFamilies: string[]): ObservationEvidence | undefined {
  return [...evidence].reverse().find((item) => toolFamilies.some((toolFamily) => item.toolName === toolFamily || item.toolName.endsWith(`__${toolFamily}`)));
}

function unique(items: string[]): string[] {
  return [...new Set(items)];
}

function parseText(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[1];
}

function parseNumber(text: string, pattern: RegExp): number | undefined {
  const match = text.match(pattern);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function metricNumber(primary: number | undefined, fallback: number | undefined): number | null {
  return primary ?? fallback ?? null;
}

function metricString(primary: string | undefined, fallback: string | undefined): string | null {
  return primary ?? fallback ?? null;
}

function createBase(mode: ObservationMode, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  return {
    mode,
    toolNames: unique(evidence.map((item) => item.toolName)),
    highlights: [],
    artifacts: {},
    metrics: {},
    missingSignals: [],
  };
}

function addArtifact(target: Record<string, string>, key: string, value: string | undefined): void {
  if (value) {
    target[key] = value;
  }
}

function extractDomEvidence(target: string, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  const normalized = createBase("dom", evidence);
  const snapshot = readLastEvidence(evidence, "take_snapshot");
  const navigate = readLastEvidence(evidence, "navigate_page", "new_page");
  const snapshotText = snapshot?.contentText ?? "";
  const title = metricString(getString(snapshot?.details, "title"), parseText(snapshotText, /RootWebArea\s+"([^"]+)"/));
  const url = metricString(parseText(snapshotText, /url="([^"]+)"/), getString(navigate?.input, "url") ?? target);
  const headingCount = (snapshotText.match(/\bheading\b/g) ?? []).length;
  const hasMain = /\bmain\b/i.test(snapshotText);

  normalized.metrics = {
    title,
    url,
    headingCount,
    hasMain,
    snapshotCaptured: Boolean(snapshot),
  };

  addArtifact(normalized.artifacts, "snapshotFilePath", getInputPath(snapshot));

  if (title) normalized.highlights.push(`title=${title}`);
  if (url) normalized.highlights.push(`url=${url}`);
  normalized.highlights.push(`headingCount=${headingCount}`);
  normalized.highlights.push(`hasMain=${hasMain}`);

  if (!snapshot) normalized.missingSignals.push("take_snapshot result missing");
  return normalized;
}

function extractConsoleNetworkEvidence(target: string, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  const normalized = createBase("console-network", evidence);
  const navigate = readLastEvidence(evidence, "navigate_page", "new_page");
  const consoleMessages = readLastEvidence(evidence, "list_console_messages");
  const networkRequests = readLastEvidence(evidence, "list_network_requests");

  const consoleErrors = metricNumber(getNumber(consoleMessages?.details, "errors"), parseNumber(consoleMessages?.contentText ?? "", /(\d+)\s+errors?/i));
  const consoleWarnings = metricNumber(getNumber(consoleMessages?.details, "warnings"), parseNumber(consoleMessages?.contentText ?? "", /(\d+)\s+warnings?/i));
  const consoleIssues = metricNumber(getNumber(consoleMessages?.details, "issues"), parseNumber(consoleMessages?.contentText ?? "", /(\d+)\s+issues?/i));
  const successfulRequests = metricNumber(getNumber(networkRequests?.details, "successfulRequests"), parseNumber(networkRequests?.contentText ?? "", /(\d+)\s+successful/i));
  const failedRequests = metricNumber(getNumber(networkRequests?.details, "failedRequests"), parseNumber(networkRequests?.contentText ?? "", /(\d+)\s+failed\s+requests?/i));

  normalized.metrics = {
    target,
    navigatedUrl: metricString(getString(navigate?.input, "url"), target),
    consoleErrors,
    consoleWarnings,
    consoleIssues,
    successfulRequests,
    failedRequests,
  };

  normalized.highlights.push(`consoleErrors=${consoleErrors ?? "unknown"}`);
  normalized.highlights.push(`consoleWarnings=${consoleWarnings ?? "unknown"}`);
  normalized.highlights.push(`failedRequests=${failedRequests ?? "unknown"}`);
  normalized.highlights.push(`successfulRequests=${successfulRequests ?? "unknown"}`);

  if (!consoleMessages) normalized.missingSignals.push("list_console_messages result missing");
  if (!networkRequests) normalized.missingSignals.push("list_network_requests result missing");
  return normalized;
}

function extractLighthouseEvidence(mode: ObservationMode, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  const normalized = createBase(mode, evidence);
  const audit = readLastEvidence(evidence, "lighthouse_audit");
  const snapshot = readLastEvidence(evidence, "take_snapshot");
  const snapshotText = snapshot?.contentText ?? "";

  const accessibility = metricNumber(getNumber(audit?.details, "accessibility"), parseNumber(audit?.contentText ?? "", /accessibility\s*=\s*([\d.]+)/i));
  const seo = metricNumber(getNumber(audit?.details, "seo"), parseNumber(audit?.contentText ?? "", /seo\s*=\s*([\d.]+)/i));
  const bestPractices = metricNumber(getNumber(audit?.details, "bestPractices"), parseNumber(audit?.contentText ?? "", /bestPractices\s*=\s*([\d.]+)/i));

  normalized.metrics = {
    accessibility,
    seo,
    bestPractices,
    title: metricString(getString(snapshot?.details, "title"), parseText(snapshotText, /RootWebArea\s+"([^"]+)"/)),
  };

  addArtifact(normalized.artifacts, "auditOutputDir", getString(audit?.input, "outputDirPath") ?? getDetailsPath(audit, "outputDirPath"));
  addArtifact(normalized.artifacts, "snapshotFilePath", getInputPath(snapshot));

  normalized.highlights.push(`accessibility=${accessibility ?? "unknown"}`);
  normalized.highlights.push(`seo=${seo ?? "unknown"}`);
  normalized.highlights.push(`bestPractices=${bestPractices ?? "unknown"}`);

  if (!audit) normalized.missingSignals.push("lighthouse_audit result missing");
  return normalized;
}

function extractAccessibilityEvidence(target: string, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  const normalized = extractLighthouseEvidence("accessibility", evidence);
  const snapshot = readLastEvidence(evidence, "take_snapshot");
  const evaluate = readLastEvidence(evidence, "evaluate_script");
  const snapshotText = snapshot?.contentText ?? "";
  const landmarkCount = (snapshotText.match(/\b(main|nav|header|footer|aside)\b/gi) ?? []).length;
  const url = metricString(parseText(snapshotText, /url="([^"]+)"/), target);
  const lang = metricString(getString(evaluate?.details, "lang"), parseText(evaluate?.contentText ?? "", /lang[:=]\s*([a-zA-Z-]+)/i));

  normalized.metrics = {
    ...normalized.metrics,
    url,
    landmarkCount,
    lang,
    snapshotCaptured: Boolean(snapshot),
    evaluateScriptUsed: Boolean(evaluate),
  };

  if (url) normalized.highlights.push(`url=${url}`);
  normalized.highlights.push(`landmarkCount=${landmarkCount}`);
  if (lang) normalized.highlights.push(`lang=${lang}`);

  if (!snapshot) normalized.missingSignals.push("take_snapshot result missing");
  return normalized;
}

function extractPerformanceEvidence(target: string, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  const normalized = createBase("performance", evidence);
  const navigate = readLastEvidence(evidence, "navigate_page", "new_page");
  const traceStart = readLastEvidence(evidence, "performance_start_trace");
  const traceStop = readLastEvidence(evidence, "performance_stop_trace");
  const networkRequests = readLastEvidence(evidence, "list_network_requests");

  const lcpMs = metricNumber(getNumber(traceStart?.details, "lcpMs") ?? getNumber(traceStop?.details, "lcpMs"), parseNumber(`${traceStart?.contentText ?? ""}\n${traceStop?.contentText ?? ""}`, /lcp\s*=\s*([\d.]+)/i));
  const cls = metricNumber(getNumber(traceStart?.details, "cls") ?? getNumber(traceStop?.details, "cls"), parseNumber(`${traceStart?.contentText ?? ""}\n${traceStop?.contentText ?? ""}`, /cls\s*=\s*([\d.]+)/i));
  const inpMs = metricNumber(getNumber(traceStart?.details, "inpMs") ?? getNumber(traceStop?.details, "inpMs"), parseNumber(`${traceStart?.contentText ?? ""}\n${traceStop?.contentText ?? ""}`, /inp\s*=\s*([\d.]+)/i));
  const totalBlockingTimeMs = metricNumber(getNumber(traceStart?.details, "totalBlockingTimeMs") ?? getNumber(traceStop?.details, "totalBlockingTimeMs"), parseNumber(`${traceStart?.contentText ?? ""}\n${traceStop?.contentText ?? ""}`, /tbt\s*=\s*([\d.]+)/i));
  const failedRequests = metricNumber(getNumber(networkRequests?.details, "failedRequests"), parseNumber(networkRequests?.contentText ?? "", /(\d+)\s+failed\s+requests?/i));

  normalized.metrics = {
    target,
    navigatedUrl: metricString(getString(navigate?.input, "url"), target),
    traceCaptured: Boolean(traceStart || traceStop),
    lcpMs,
    cls,
    inpMs,
    totalBlockingTimeMs,
    failedRequests,
  };

  addArtifact(normalized.artifacts, "traceFilePath", getInputPath(traceStart) ?? getInputPath(traceStop));

  normalized.highlights.push(`traceCaptured=${Boolean(traceStart || traceStop)}`);
  if (lcpMs !== null) normalized.highlights.push(`lcpMs=${lcpMs}`);
  if (cls !== null) normalized.highlights.push(`cls=${cls}`);
  if (inpMs !== null) normalized.highlights.push(`inpMs=${inpMs}`);
  if (failedRequests !== null) normalized.highlights.push(`failedRequests=${failedRequests}`);

  if (!traceStart && !traceStop) normalized.missingSignals.push("performance trace result missing");
  return normalized;
}

function extractMemoryEvidence(target: string, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  const normalized = createBase("memory", evidence);
  const navigate = readLastEvidence(evidence, "navigate_page", "new_page");
  const memorySnapshot = readLastEvidence(evidence, "take_memory_snapshot");

  const heapNodes = metricNumber(getNumber(memorySnapshot?.details, "heapNodes"), parseNumber(memorySnapshot?.contentText ?? "", /heapNodes\s*=\s*([\d.]+)/i));
  const retainedSizeMb = metricNumber(getNumber(memorySnapshot?.details, "retainedSizeMb"), parseNumber(memorySnapshot?.contentText ?? "", /retainedSizeMb\s*=\s*([\d.]+)/i));
  const snapshotCaptured = Boolean(memorySnapshot);

  normalized.metrics = {
    target,
    navigatedUrl: metricString(getString(navigate?.input, "url"), target),
    snapshotCaptured,
    heapNodes,
    retainedSizeMb,
  };

  addArtifact(normalized.artifacts, "heapSnapshotFilePath", getInputPath(memorySnapshot));

  normalized.highlights.push(`snapshotCaptured=${snapshotCaptured}`);
  if (heapNodes !== null) normalized.highlights.push(`heapNodes=${heapNodes}`);
  if (retainedSizeMb !== null) normalized.highlights.push(`retainedSizeMb=${retainedSizeMb}`);

  if (!memorySnapshot) normalized.missingSignals.push("take_memory_snapshot result missing");
  return normalized;
}

export function buildRecommendedToolCalls(request: TemplateRequestLike): RecommendedToolCallTemplate[] {
  switch (request.mode) {
    case "dom":
      return [
        {
          toolName: "navigate_page",
          reason: "Open the target URL in the selected page context.",
          params: { url: request.target, type: "url" },
        },
        {
          toolName: "take_snapshot",
          reason: "Capture the DOM / accessibility tree structure for runtime proof.",
          params: { filePath: path.join(request.artifactDir, "snapshot.json"), verbose: true },
        },
      ];
    case "console-network":
      return [
        {
          toolName: "navigate_page",
          reason: "Open the target URL before collecting console and network evidence.",
          params: { url: request.target, type: "url" },
        },
        {
          toolName: "list_console_messages",
          reason: "Collect the current console error / warning surface.",
          params: { types: ["error", "warn"], pageIdx: 0, pageSize: 100, includePreservedMessages: true },
        },
        {
          toolName: "list_network_requests",
          reason: "Collect recent network outcomes for the selected page.",
          params: { pageIdx: 0, pageSize: 100, includePreservedRequests: true },
        },
      ];
    case "lighthouse":
      return [
        {
          toolName: "navigate_page",
          reason: "Open the target URL before the Lighthouse audit.",
          params: { url: request.target, type: "url" },
        },
        {
          toolName: "lighthouse_audit",
          reason: "Collect Lighthouse summary scores and reports.",
          params: { mode: "navigation", device: "desktop", outputDirPath: path.join(request.artifactDir, "lighthouse") },
        },
      ];
    case "accessibility":
      return [
        {
          toolName: "navigate_page",
          reason: "Open the target URL before accessibility checks.",
          params: { url: request.target, type: "url" },
        },
        {
          toolName: "take_snapshot",
          reason: "Capture semantic structure from the accessibility tree.",
          params: { filePath: path.join(request.artifactDir, "a11y-snapshot.json"), verbose: true },
        },
        {
          toolName: "lighthouse_audit",
          reason: "Collect accessibility-oriented Lighthouse findings.",
          params: { mode: "snapshot", device: "desktop", outputDirPath: path.join(request.artifactDir, "accessibility") },
        },
        {
          toolName: "evaluate_script",
          reason: "Collect a tiny page-level accessibility metadata snapshot.",
          params: { function: '() => ({ title: document.title, lang: document.documentElement.lang || null })' },
        },
      ];
    case "performance":
      return [
        {
          toolName: "navigate_page",
          reason: "Open the target URL before collecting a trace.",
          params: { url: request.target, type: "url" },
        },
        {
          toolName: "performance_start_trace",
          reason: "Capture a navigation trace with minimal performance metrics.",
          params: { reload: true, autoStop: true, filePath: path.join(request.artifactDir, "trace.json") },
        },
        {
          toolName: "list_network_requests",
          reason: "Correlate trace evidence with failed network requests.",
          params: { pageIdx: 0, pageSize: 100, includePreservedRequests: true },
        },
      ];
    case "memory":
      return [
        {
          toolName: "navigate_page",
          reason: "Open the target URL before taking a heap snapshot.",
          params: { url: request.target, type: "url" },
        },
        {
          toolName: "take_memory_snapshot",
          reason: "Capture a heap snapshot artifact for memory analysis.",
          params: { filePath: path.join(request.artifactDir, "memory.heapsnapshot") },
        },
      ];
    default:
      return [];
  }
}

export function extractModeEvidence(mode: ObservationMode, target: string, evidence: ObservationEvidence[]): NormalizedModeEvidence {
  switch (mode) {
    case "dom":
      return extractDomEvidence(target, evidence);
    case "console-network":
      return extractConsoleNetworkEvidence(target, evidence);
    case "lighthouse":
      return extractLighthouseEvidence("lighthouse", evidence);
    case "accessibility":
      return extractAccessibilityEvidence(target, evidence);
    case "performance":
      return extractPerformanceEvidence(target, evidence);
    case "memory":
      return extractMemoryEvidence(target, evidence);
    default:
      return createBase(mode, evidence);
  }
}

export function buildFallbackSummary(target: string, normalized: NormalizedModeEvidence): string {
  const highlights = normalized.highlights.length > 0 ? normalized.highlights.join(", ") : "no highlights extracted";
  const missing = normalized.missingSignals.length > 0 ? ` Missing: ${normalized.missingSignals.join(", ")}.` : "";
  return `Collected ${normalized.toolNames.length} Chrome DevTools-compatible tool family result(s) for ${target} (${normalized.mode}). Highlights: ${highlights}.${missing}`;
}
