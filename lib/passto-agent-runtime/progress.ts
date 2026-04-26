import { emptyUsage, type ChildAgentEvent, type SubagentProgress } from "./types.ts";

const MAX_ACTIVITY = 8;

function clip(text: string | undefined, max = 160): string | undefined {
  if (!text) return text;
  const single = text.replace(/\s+/g, " ").trim();
  if (single.length <= max) return single;
  return `${single.slice(0, max - 3)}...`;
}

function pushActivity(progress: SubagentProgress, text: string): void {
  if (!text.trim()) return;
  progress.recentActivity.push(text);
  if (progress.recentActivity.length > MAX_ACTIVITY) progress.recentActivity.shift();
}

export function createInitialProgress(runId: string): SubagentProgress {
  const now = Date.now();
  return {
    runId,
    phase: "starting",
    startedAt: now,
    updatedAt: now,
    elapsedMs: 0,
    recentActivity: [],
    usage: emptyUsage(),
  };
}

export function applyEventToProgress(progress: SubagentProgress, event: ChildAgentEvent): SubagentProgress {
  progress.updatedAt = Date.now();
  progress.elapsedMs = Math.max(0, progress.updatedAt - progress.startedAt);
  if (progress.phase === "starting") progress.phase = "running";

  switch (event.type) {
    case "assistant":
      progress.lastAssistantText = clip(event.text);
      pushActivity(progress, `assistant: ${clip(event.text, 80)}`);
      break;
    case "tool_call":
      progress.currentTool = event.toolName;
      progress.currentToolArgsPreview = clip(event.argsPreview, 120);
      pushActivity(progress, `tool: ${event.toolName}${event.argsPreview ? ` ${clip(event.argsPreview, 60)}` : ""}`);
      break;
    case "tool_result":
      pushActivity(progress, `tool_result: ${event.toolName}${event.text ? ` ${clip(event.text, 60)}` : ""}`);
      break;
    case "usage":
      progress.usage = event.usage;
      break;
    case "status":
      progress.stopReason = event.stopReason;
      progress.errorMessage = event.errorMessage;
      if (event.errorMessage) progress.phase = "error";
      break;
    case "stderr":
      pushActivity(progress, `stderr: ${clip(event.text, 80)}`);
      break;
    case "done":
      progress.exitCode = event.exitCode;
      progress.phase = event.exitCode === 0 && !progress.errorMessage ? "done" : "error";
      break;
  }

  return progress;
}

export function summarizeProgress(progress: SubagentProgress): string {
  const tool = progress.currentTool ? ` · tool=${progress.currentTool}` : "";
  const turns = progress.usage.turns ? ` · turns=${progress.usage.turns}` : "";
  const elapsed = ` · ${Math.max(0, progress.elapsedMs / 1000).toFixed(1)}s`;
  const status = progress.errorMessage ? ` · error=${clip(progress.errorMessage, 80)}` : progress.stopReason ? ` · stop=${progress.stopReason}` : "";
  return `${progress.runId} ${progress.phase}${tool}${turns}${elapsed}${status}`;
}

export function renderProgressContent(progress: SubagentProgress): Array<{ type: "text"; text: string }> {
  const lines = [summarizeProgress(progress)];
  if (progress.lastAssistantText) lines.push(`last: ${progress.lastAssistantText}`);
  if (progress.recentActivity.length > 0) lines.push(...progress.recentActivity.slice(-4));
  return [{ type: "text", text: lines.join("\n") }];
}
