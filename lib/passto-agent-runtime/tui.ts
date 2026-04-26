import { renderProgressContent, summarizeProgress } from "./progress.ts";
import type { SubagentProgress, SubagentRunResult } from "./types.ts";

export function renderProgressDetails(progress: SubagentProgress): Record<string, unknown> {
  return {
    runId: progress.runId,
    phase: progress.phase,
    elapsedMs: progress.elapsedMs,
    currentTool: progress.currentTool,
    currentToolArgsPreview: progress.currentToolArgsPreview,
    usage: progress.usage,
    stopReason: progress.stopReason,
    errorMessage: progress.errorMessage,
    exitCode: progress.exitCode,
    recentActivity: progress.recentActivity,
  };
}

export function renderProgressUpdate(progress: SubagentProgress) {
  return {
    content: renderProgressContent(progress),
    details: renderProgressDetails(progress),
  };
}

export function renderFinalResult(result: SubagentRunResult) {
  const summary = result.finalOutputText?.trim() || result.errorMessage || result.stderr.trim() || summarizeProgress(result.progress);
  return {
    content: [{ type: "text" as const, text: summary }],
    details: {
      runId: result.runId,
      success: result.success,
      exitCode: result.exitCode,
      stopReason: result.stopReason,
      errorMessage: result.errorMessage,
      usage: result.usage,
      provenance: result.provenance,
      artifacts: result.artifacts,
    },
  };
}
