import type { ContractVerificationResult } from "./contracts.ts";
import type { ExecutorEvent } from "./events.ts";
import type { ExecutorChildResult } from "./runtime.ts";

export interface ExecutorPerspectiveResult {
  perspective: string;
  status: "completed" | "failed" | "skipped";
  summaryText: string;
  child?: ExecutorChildResult;
  contract?: ContractVerificationResult;
  skipReason?: string;
}

export interface ExecutorRunResult {
  runId: string;
  status: "completed" | "failed";
  summaryText: string;
  perspectiveResults: ExecutorPerspectiveResult[];
  usage: ExecutorChildResult["usage"];
  events: ExecutorEvent[];
  contract?: ContractVerificationResult;
  failure?: {
    reason?: string;
    errorMessage?: string;
  };
  display?: {
    title: string;
    activeAgentLabel?: string;
    activeModelName?: string;
    activeThinkingLevel?: string;
    lastMessage?: string;
    currentTool?: string;
    currentToolArgsPreview?: string;
    finalSummary?: string;
  };
}

function summarizeChildResult(childResult: ExecutorChildResult): string {
  return childResult.finalOutputText || childResult.errorMessage || childResult.stderr || "(no output)";
}

export function buildExecutorPerspectiveResult(params: {
  perspective: string;
  childResult: ExecutorChildResult;
  contract?: ContractVerificationResult;
}): ExecutorPerspectiveResult {
  return {
    perspective: params.perspective,
    status: params.childResult.success ? "completed" : "failed",
    summaryText: summarizeChildResult(params.childResult),
    child: params.childResult,
    contract: params.contract,
  };
}

function aggregateUsage(perspectiveResults: ExecutorPerspectiveResult[]): ExecutorChildResult["usage"] {
  return perspectiveResults.reduce<ExecutorChildResult["usage"]>((acc, item) => ({
    input: acc.input + (item.child?.usage.input ?? 0),
    output: acc.output + (item.child?.usage.output ?? 0),
    cacheRead: acc.cacheRead + (item.child?.usage.cacheRead ?? 0),
    cacheWrite: acc.cacheWrite + (item.child?.usage.cacheWrite ?? 0),
    cost: acc.cost + (item.child?.usage.cost ?? 0),
    contextTokens: acc.contextTokens + (item.child?.usage.contextTokens ?? 0),
    turns: acc.turns + (item.child?.usage.turns ?? 0),
  }), {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    contextTokens: 0,
    turns: 0,
  });
}

export function buildExecutorRunResult(params: {
  runId: string;
  perspective: string;
  childResult: ExecutorChildResult;
  events: ExecutorEvent[];
  contract?: ContractVerificationResult;
}): ExecutorRunResult {
  return buildAggregatedExecutorRunResult({
    runId: params.runId,
    perspectiveResults: [buildExecutorPerspectiveResult(params)],
    events: params.events,
  });
}

export function buildAggregatedExecutorRunResult(params: {
  runId: string;
  perspectiveResults: ExecutorPerspectiveResult[];
  events: ExecutorEvent[];
}): ExecutorRunResult {
  const failedPerspective = params.perspectiveResults.find((item) => item.status === "failed");
  const status = failedPerspective ? "failed" : "completed";
  const summaryText = params.perspectiveResults.map((item) => `${item.perspective}: ${item.summaryText}`).join("\n");
  const primaryPerspective = params.perspectiveResults[0];
  const displayTitle = primaryPerspective?.perspective || "passto-executor";
  const displayLastMessage = primaryPerspective?.child?.progress.lastAssistantText
    || primaryPerspective?.child?.finalOutputText
    || primaryPerspective?.summaryText;
  const activeAgentLabel = primaryPerspective?.child?.progress.activeAgentLabel;
  const activeModelName = primaryPerspective?.child?.progress.activeModelName;
  const activeThinkingLevel = primaryPerspective?.child?.progress.activeThinkingLevel;
  const currentTool = primaryPerspective?.child?.progress.currentTool;
  const currentToolArgsPreview = primaryPerspective?.child?.progress.currentToolArgsPreview;
  const finalSummary = primaryPerspective?.child?.finalOutputText || primaryPerspective?.summaryText;

  return {
    runId: params.runId,
    status,
    summaryText,
    perspectiveResults: params.perspectiveResults,
    usage: aggregateUsage(params.perspectiveResults),
    events: params.events,
    contract: params.perspectiveResults.length === 1 ? params.perspectiveResults[0]?.contract : undefined,
    failure: failedPerspective
      ? {
          reason: failedPerspective.child?.stopReason,
          errorMessage: failedPerspective.child?.errorMessage,
        }
      : undefined,
    display: {
      title: displayTitle,
      activeAgentLabel,
      activeModelName,
      activeThinkingLevel,
      lastMessage: displayLastMessage,
      currentTool,
      currentToolArgsPreview,
      finalSummary,
    },
  };
}
