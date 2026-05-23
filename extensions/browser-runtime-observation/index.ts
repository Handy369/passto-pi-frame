import * as fs from "node:fs";
import * as path from "node:path";
import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  OBSERVATION_MODES,
  buildFallbackSummary,
  buildRecommendedToolCalls,
  extractModeEvidence,
  type ObservationEvidence,
  type ObservationMode,
  type RecommendedToolCallTemplate,
} from "./mode-evidence";
import { buildPendingVerdict, evaluateBudgets, type RuntimeBudgetConfig } from "./budget-verdict";

const ACTION_KINDS = ["navigate", "click", "type", "wait", "select-page", "screenshot"] as const;
const STATE_ENTRY_TYPE = "browser-runtime-observation-state";
const CHROME_DEVTOOLS_SERVER_HINTS = ["mcp__chrome-devtools-mcp", "chrome-devtools-mcp", "chrome-devtools"] as const;
const AGENT_BROWSER_TOOL_HINTS = ["agent-browser"] as const;
const CHROME_DEVTOOLS_CORE_TOOLS = [
  "list_pages",
  "new_page",
  "navigate_page",
  "select_page",
  "wait_for",
  "take_snapshot",
  "take_screenshot",
  "list_console_messages",
  "get_console_message",
  "list_network_requests",
  "get_network_request",
  "evaluate_script",
  "lighthouse_audit",
  "performance_start_trace",
  "performance_stop_trace",
  "take_memory_snapshot",
] as const;

type CapabilityStatus =
  | "ready_for_runtime_execution"
  | "ready_via_agent_browser"
  | "blocked_missing_devtools_tool";
type RequestStatus =
  | "queued"
  | "running"
  | "completed"
  | "blocked_missing_devtools_tool"
  | "failed_no_evidence";

interface CapabilitySnapshot {
  detectedChromeDevtoolsTools: string[];
  status: CapabilityStatus;
  checkedAt: string;
}

interface ObservationRequestState {
  id: string;
  createdAt: string;
  updatedAt: string;
  cwd: string;
  target: string;
  mode: ObservationMode;
  actions: Array<{ kind: string; value?: string; timeoutMs?: number }>;
  budgets: RuntimeBudgetConfig;
  artifactDir: string;
  capability: CapabilitySnapshot;
  status: RequestStatus;
  executionAdapterWired: true;
  evidence: ObservationEvidence[];
  summary?: string;
  nextStep?: string;
}

interface ExtensionStateSnapshot {
  requests: ObservationRequestState[];
}

let state: ExtensionStateSnapshot = { requests: [] };

function isChromeDevtoolsCompatibleToolName(name: string): boolean {
  if (CHROME_DEVTOOLS_SERVER_HINTS.some((hint) => name.includes(hint))) {
    return true;
  }

  if (CHROME_DEVTOOLS_CORE_TOOLS.includes(name as (typeof CHROME_DEVTOOLS_CORE_TOOLS)[number])) {
    return true;
  }

  return CHROME_DEVTOOLS_CORE_TOOLS.some((toolName) => name.endsWith(`__${toolName}`));
}

function isAgentBrowserToolName(name: string): boolean {
  return AGENT_BROWSER_TOOL_HINTS.some((hint) => name.includes(hint));
}

function detectChromeDevtoolsTools(pi: ExtensionAPI): CapabilitySnapshot {
  const allToolNames = pi.getAllTools().map((tool) => tool.name);
  const detectedChromeDevtoolsTools = allToolNames.filter((name) => isChromeDevtoolsCompatibleToolName(name));
  const detectedAgentBrowserTools = allToolNames.filter((name) => isAgentBrowserToolName(name));

  const status: CapabilityStatus =
    detectedChromeDevtoolsTools.length > 0
      ? "ready_for_runtime_execution"
      : detectedAgentBrowserTools.length > 0
        ? "ready_via_agent_browser"
        : "blocked_missing_devtools_tool";

  return {
    detectedChromeDevtoolsTools,
    status,
    checkedAt: new Date().toISOString(),
  };
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function makeRequestId(): string {
  return `bro-${safeTimestamp()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveArtifactDir(cwd: string, requestedDir: string | undefined): string {
  if (requestedDir && requestedDir.trim().length > 0) {
    return path.resolve(cwd, requestedDir);
  }
  return path.resolve(cwd, ".artifacts", "browser-runtime-observation", safeTimestamp());
}

function contentToText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");
}

function currentActiveRequest(): ObservationRequestState | undefined {
  return [...state.requests].reverse().find((request) => request.status === "queued" || request.status === "running");
}

function updateRequest(request: ObservationRequestState): void {
  state = {
    requests: state.requests.map((candidate) => (candidate.id === request.id ? request : candidate)),
  };
}

function persistState(pi: ExtensionAPI): void {
  pi.appendEntry(STATE_ENTRY_TYPE, state);
}

function writeArtifacts(request: ObservationRequestState): void {
  ensureDir(request.artifactDir);

  const requestFile = path.join(request.artifactDir, "request.json");
  const resultFile = path.join(request.artifactDir, "result.json");
  const evidenceFile = path.join(request.artifactDir, "evidence.json");
  const verdictFile = path.join(request.artifactDir, "verdict.json");
  const recommendedToolCalls = buildRecommendedToolCalls(request);
  const normalizedEvidence = extractModeEvidence(request.mode, request.target, request.evidence);
  const verdict = request.status === "completed" || request.status === "failed_no_evidence" ? evaluateBudgets(request.budgets, normalizedEvidence) : buildPendingVerdict();

  const requestPayload = {
    schemaVersion: "browser-runtime-observation.v1",
    id: request.id,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    cwd: request.cwd,
    target: request.target,
    mode: request.mode,
    actions: request.actions,
    budgets: request.budgets,
    capability: request.capability,
    recommendedToolCalls,
    notes: [
      "This artifact is produced by the browser-runtime-observation extension.",
      "Execution uses asynchronous orchestration: high-level request -> steering -> low-level tool results -> finalize.",
      "recommendedToolCalls contains mode-specific chrome-devtools-mcp style parameter templates.",
    ],
  };

  const resultPayload = {
    schemaVersion: "browser-runtime-observation-result.v1",
    id: request.id,
    status: request.status,
    checkedAt: request.capability.checkedAt,
    executionAdapterWired: request.executionAdapterWired,
    summary: request.summary ?? buildFallbackSummary(request.target, normalizedEvidence),
    observations: request.evidence,
    normalizedEvidence,
    verdict,
    recommendedToolCalls,
    artifacts: {
      requestFile,
      resultFile,
      evidenceFile,
      verdictFile,
    },
    detectedChromeDevtoolsTools: request.capability.detectedChromeDevtoolsTools,
    nextStep: request.nextStep ?? null,
  };

  const verdictPayload = {
    schemaVersion: "browser-runtime-observation-verdict.v1",
    id: request.id,
    target: request.target,
    mode: request.mode,
    status: verdict.status,
    summary: verdict.summary,
    checks: verdict.checks,
    budgets: request.budgets,
    artifacts: {
      requestFile,
      resultFile,
      evidenceFile,
      verdictFile,
    },
    evaluatedAt: verdict.evaluatedAt,
  };

  fs.writeFileSync(requestFile, JSON.stringify(requestPayload, null, 2), "utf-8");
  fs.writeFileSync(resultFile, JSON.stringify(resultPayload, null, 2), "utf-8");
  fs.writeFileSync(evidenceFile, JSON.stringify(request.evidence, null, 2), "utf-8");
  fs.writeFileSync(verdictFile, JSON.stringify(verdictPayload, null, 2), "utf-8");
}

function formatCapabilityText(snapshot: CapabilitySnapshot): string {
  const active = currentActiveRequest();
  const lines = [
    `browser-runtime-observation status: ${snapshot.status}`,
    `checkedAt: ${snapshot.checkedAt}`,
    `detectedChromeDevtoolsTools: ${snapshot.detectedChromeDevtoolsTools.length}`,
  ];

  if (snapshot.detectedChromeDevtoolsTools.length > 0) {
    lines.push(...snapshot.detectedChromeDevtoolsTools.map((name) => `- ${name}`));
  } else {
    lines.push("- none");
  }

  if (active) {
    lines.push(`activeRequest: ${active.id} (${active.status})`);
    lines.push(`activeArtifactDir: ${active.artifactDir}`);
  }

  return lines.join("\n");
}

function formatRecommendedToolCalls(templates: RecommendedToolCallTemplate[]): string {
  if (templates.length === 0) return "- none";
  return templates
    .map((template, index) => {
      const templateBody = JSON.stringify({ toolName: template.toolName, params: template.params }, null, 2);
      return `${index + 1}. ${template.reason}\n${templateBody}`;
    })
    .join("\n\n");
}

function buildModeSpecificInstruction(request: ObservationRequestState): string {
  const templates = buildRecommendedToolCalls(request);
  return [
    `Recommended DevTools flow for mode=${request.mode}:`,
    formatRecommendedToolCalls(templates),
    "Collect only the minimal runtime evidence needed for the current mode. Reuse the suggested artifact file paths when possible.",
  ].join("\n\n");
}

function buildSteeringContent(request: ObservationRequestState): string {
  const availableTools = request.capability.detectedChromeDevtoolsTools.map((name) => `- ${name}`).join("\n");
  const actionsText = request.actions.length > 0 ? JSON.stringify(request.actions, null, 2) : "[]";
  const doneMarker = `[browser-runtime-observation:${request.id}:done]`;

  return [
    "A browser runtime observation request is now active.",
    `requestId: ${request.id}`,
    `target: ${request.target}`,
    `mode: ${request.mode}`,
    `artifactDir: ${request.artifactDir}`,
    "availableChromeDevtoolsCompatibleTools:",
    availableTools || "- none",
    "requestedActions:",
    actionsText,
    buildModeSpecificInstruction(request),
    "Use one or more of the listed Chrome DevTools-compatible tools now. Prefer the real chrome-devtools-mcp tool family when available.",
    `After collecting enough evidence, finish your assistant response with the exact marker ${doneMarker} followed by a concise summary.`,
  ].join("\n\n");
}

function buildAgentBrowserFallbackSummary(mode: ObservationMode, target: string): string {
  return [
    `Browser runtime observation request for ${target} (${mode}) cannot continue inside this tool in the current runtime.`,
    "No Chrome DevTools-compatible low-level tool is registered, but agent-browser appears to be available.",
    "Use the agent-browser skill / CLI path for lightweight browser execution, or register a Chrome DevTools-compatible provider if you need native DevTools evidence collection.",
  ].join(" ");
}

function buildBlockedSummary(mode: ObservationMode, target: string): string {
  return [
    `Browser runtime observation request for ${target} (${mode}) is blocked.`,
    "No Chrome DevTools-compatible tool is currently registered in this Pi runtime.",
    "The high-level request and artifact contract were created, but no low-level execution path is available.",
  ].join(" ");
}

function restoreState(ctx: ExtensionContext): void {
  state = { requests: [] };
  const latest = [...ctx.sessionManager.getBranch()]
    .reverse()
    .find((entry) => entry.type === "custom" && entry.customType === STATE_ENTRY_TYPE);

  if (latest && "data" in latest && latest.data && typeof latest.data === "object") {
    const candidate = latest.data as ExtensionStateSnapshot;
    if (Array.isArray(candidate.requests)) {
      state = candidate;
    }
  }
}

function finalizeRequest(request: ObservationRequestState, assistantSummary?: string): ObservationRequestState {
  const normalizedEvidence = extractModeEvidence(request.mode, request.target, request.evidence);
  const verdict = evaluateBudgets(request.budgets, normalizedEvidence);
  const completedRequest: ObservationRequestState = {
    ...request,
    updatedAt: new Date().toISOString(),
    status: request.evidence.length > 0 ? "completed" : "failed_no_evidence",
    summary:
      assistantSummary?.trim() ||
      (request.evidence.length > 0
        ? buildFallbackSummary(request.target, normalizedEvidence)
        : `No Chrome DevTools-compatible evidence was collected for ${request.target} (${request.mode}).`),
    nextStep:
      request.evidence.length > 0
        ? verdict.status === "FAIL"
          ? `Runtime budgets failed. Review verdict.json plus failed checks: ${verdict.checks.filter((check) => check.status === "FAIL").map((check) => check.name).join(", ") || "unknown"}.`
          : normalizedEvidence.missingSignals.length > 0
            ? `Review artifacts plus missing signals: ${normalizedEvidence.missingSignals.join(", ")}.`
            : verdict.status === "PASS"
              ? "Runtime budgets passed. Review verdict.json, result.json, and evidence.json for normalized runtime proof."
              : "Review artifacts/request.json, artifacts/result.json, evidence.json, and verdict.json for normalized runtime proof."
        : "Retry after ensuring the agent actually invoked a compatible low-level browser tool.",
  };

  return completedRequest;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx);
  });

  pi.on("tool_result", async (event) => {
    if (!isChromeDevtoolsCompatibleToolName(event.toolName)) return undefined;

    const request = currentActiveRequest();
    if (!request) return undefined;

    const evidence: ObservationEvidence = {
      toolName: event.toolName,
      input: event.input,
      contentText: contentToText(event.content as Array<{ type: string; text?: string }>),
      details: event.details,
      isError: event.isError,
      capturedAt: new Date().toISOString(),
    };

    const updatedRequest: ObservationRequestState = {
      ...request,
      updatedAt: new Date().toISOString(),
      status: "running",
      evidence: [...request.evidence, evidence],
      summary: `Collected ${request.evidence.length + 1} Chrome DevTools-compatible tool result(s) for ${request.target} (${request.mode}).`,
      nextStep: "Wait for the assistant to finish its runtime summary so the request can be finalized.",
    };

    updateRequest(updatedRequest);
    writeArtifacts(updatedRequest);
    persistState(pi);
    return undefined;
  });

  pi.on("agent_end", async (event) => {
    const request = currentActiveRequest();
    if (!request) return;

    const lastAssistant = [...event.messages]
      .reverse()
      .find((message) => message.role === "assistant");

    const assistantSummary = lastAssistant?.content
      ?.filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    const finalized = finalizeRequest(request, assistantSummary);
    updateRequest(finalized);
    writeArtifacts(finalized);
    persistState(pi);
  });

  pi.registerTool({
    name: "browser_runtime_capability_status",
    label: "Browser Runtime Capability Status",
    description: "Inspect whether the current Pi runtime has Chrome DevTools-compatible browser observation tools available, and whether only agent-browser fallback is present.",
    promptSnippet: "Check whether Chrome DevTools-compatible browser runtime observation tools are available in the current Pi runtime.",
    promptGuidelines: [
      "Use browser_runtime_capability_status before browser_runtime_observe when runtime availability is uncertain.",
      "Use browser_runtime_capability_status to verify whether the current Pi runtime has Chrome DevTools-compatible tools registered.",
      "If the status reports ready_via_agent_browser, prefer routing the task to the agent-browser skill instead of invoking browser_runtime_observe.",
    ],
    parameters: Type.Object({}),
    async execute() {
      const snapshot = detectChromeDevtoolsTools(pi);
      return {
        content: [{ type: "text", text: formatCapabilityText(snapshot) }],
        details: {
          ...snapshot,
          activeRequest: currentActiveRequest() ?? null,
        },
      };
    },
  });

  pi.registerTool({
    name: "browser_runtime_observe",
    label: "Browser Runtime Observe",
    description: "Create a high-level browser runtime observation request, steer the agent toward Chrome DevTools-compatible low-level tools, collect matching tool results, and persist normalized artifacts. Do not use this tool when only agent-browser is available.",
    promptSnippet: "Create a browser runtime observation request with asynchronous low-level tool orchestration and normalized artifacts.",
    promptGuidelines: [
      "Use browser_runtime_observe when a browser-facing task needs runtime technical evidence such as DOM, console, network, Lighthouse, accessibility, performance, or memory proof.",
      "Use browser_runtime_observe to create a normalized observation request and artifact scaffold before gathering low-level browser evidence.",
      "If browser_runtime_observe reports a ready runtime, continue by using the suggested Chrome DevTools-compatible low-level tools until the observation is complete.",
      "If capability is only ready_via_agent_browser, stop using this tool and route to the agent-browser skill / CLI path instead.",
    ],
    parameters: Type.Object({
      target: Type.String({ description: "URL, route, or runtime target description to observe" }),
      mode: StringEnum(OBSERVATION_MODES, { description: "Observation mode: dom | console-network | lighthouse | accessibility | performance | memory" }),
      actions: Type.Optional(
        Type.Array(
          Type.Object({
            kind: StringEnum(ACTION_KINDS, { description: "Action kind: navigate | click | type | wait | select-page | screenshot" }),
            value: Type.Optional(Type.String({ description: "Selector, URL, text, or freeform action payload" })),
            timeoutMs: Type.Optional(Type.Number({ description: "Optional timeout in milliseconds" })),
          }),
        ),
      ),
      artifactDir: Type.Optional(Type.String({ description: "Optional artifact directory. Defaults to .artifacts/browser-runtime-observation/<timestamp> under the current cwd." })),
      budgets: Type.Optional(
        Type.Object({
          maxConsoleErrors: Type.Optional(Type.Number({ description: "Optional console error budget" })),
          maxConsoleWarnings: Type.Optional(Type.Number({ description: "Optional console warning budget" })),
          maxConsoleIssues: Type.Optional(Type.Number({ description: "Optional console issues budget" })),
          maxFailedRequests: Type.Optional(Type.Number({ description: "Optional failed request budget" })),
          minAccessibilityScore: Type.Optional(Type.Number({ description: "Optional minimum accessibility score" })),
          minSeoScore: Type.Optional(Type.Number({ description: "Optional minimum SEO score" })),
          minBestPracticesScore: Type.Optional(Type.Number({ description: "Optional minimum best-practices score" })),
          lighthousePerformanceMin: Type.Optional(Type.Number({ description: "Legacy Lighthouse performance minimum score. Currently emitted as SKIP because chrome-devtools-mcp lighthouse_audit excludes performance." })),
          maxLcpMs: Type.Optional(Type.Number({ description: "Optional maximum LCP in milliseconds" })),
          maxCls: Type.Optional(Type.Number({ description: "Optional maximum CLS" })),
          maxInpMs: Type.Optional(Type.Number({ description: "Optional maximum INP in milliseconds" })),
          maxTotalBlockingTimeMs: Type.Optional(Type.Number({ description: "Optional maximum total blocking time in milliseconds" })),
          maxRetainedSizeMb: Type.Optional(Type.Number({ description: "Optional maximum retained heap size in megabytes" })),
        }),
      ),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const active = currentActiveRequest();
      if (active) {
        throw new Error(`Another browser runtime observation is still active: ${active.id}`);
      }

      const capability = detectChromeDevtoolsTools(pi);
      if (capability.status === "ready_via_agent_browser") {
        throw new Error(
          "browser_runtime_observe requires Chrome DevTools-compatible low-level tools. This runtime only exposes agent-browser fallback. Route the task to the agent-browser skill / CLI path, or restore/register the browser-observe / chrome-devtools-mcp toolchain before retrying.",
        );
      }

      const artifactDir = resolveArtifactDir(ctx.cwd, params.artifactDir);
      ensureDir(artifactDir);

      const request: ObservationRequestState = {
        id: makeRequestId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cwd: ctx.cwd,
        target: params.target,
        mode: params.mode,
        actions: params.actions ?? [],
        budgets: params.budgets ?? {},
        artifactDir,
        capability,
        status: capability.status === "ready_for_runtime_execution" ? "queued" : "blocked_missing_devtools_tool",
        executionAdapterWired: true,
        evidence: [],
        summary:
          capability.status === "ready_for_runtime_execution"
            ? `Browser runtime observation request ${params.target} (${params.mode}) queued. Waiting for Chrome DevTools-compatible low-level tool results.`
            : capability.status === "ready_via_agent_browser"
              ? buildAgentBrowserFallbackSummary(params.mode, params.target)
              : buildBlockedSummary(params.mode, params.target),
        nextStep:
          capability.status === "ready_for_runtime_execution"
            ? "Low-level Chrome DevTools-compatible tools will be invoked in the next agent step."
            : capability.status === "ready_via_agent_browser"
              ? "Route this task to the agent-browser skill / CLI path, or enable a Chrome DevTools-compatible tool before retrying browser_runtime_observe."
              : "Register or enable a Chrome DevTools-compatible tool in the current Pi runtime, then retry.",
      };

      state = { requests: [...state.requests, request] };
      writeArtifacts(request);
      persistState(pi);

      if (capability.status === "ready_for_runtime_execution") {
        pi.sendMessage(
          {
            customType: "browser-runtime-observation-steer",
            content: buildSteeringContent(request),
            display: true,
            details: {
              requestId: request.id,
              target: request.target,
              mode: request.mode,
              artifactDir: request.artifactDir,
            },
          },
          { deliverAs: "steer", triggerTurn: false },
        );
      }

      return {
        content: [{ type: "text", text: request.summary }],
        details: {
          requestId: request.id,
          target: request.target,
          mode: request.mode,
          artifactDir: request.artifactDir,
          capability,
          executionAdapterWired: true,
          requestFile: path.join(request.artifactDir, "request.json"),
          resultFile: path.join(request.artifactDir, "result.json"),
          evidenceFile: path.join(request.artifactDir, "evidence.json"),
          verdictFile: path.join(request.artifactDir, "verdict.json"),
          recommendedToolCalls: buildRecommendedToolCalls(request),
          nextStep: request.nextStep,
        },
      };
    },
  });

  pi.registerCommand("browser-observe-status", {
    description: "Show browser runtime observation capability status for the current Pi runtime.",
    handler: async (_args, ctx) => {
      const snapshot = detectChromeDevtoolsTools(pi);
      if (ctx.hasUI) {
        ctx.ui.notify(formatCapabilityText(snapshot), snapshot.status === "ready_for_runtime_execution" ? "success" : "warning");
      }
    },
  });
}
