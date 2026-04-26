import type { SubagentProgress } from "../../lib/passto-agent-runtime/index.ts";
import type { SingleResult } from "./types.js";

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
}

export function formatElapsedMs(elapsedMs: number | undefined): string | null {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

export function formatRunningSummary(r: SingleResult): string {
  const parts: string[] = [];
  if (r.phase && r.phase !== "done") parts.push(r.phase);
  const elapsed = formatElapsedMs(r.elapsedMs);
  if (elapsed) parts.push(elapsed);
  if (r.currentTool) parts.push(`tool=${r.currentTool}`);
  return parts.join(" · ") || "running";
}

export function formatRecentActivityLine(activity: string): string {
  if (!activity.startsWith("tool: ")) return activity;

  const match = /^tool:\s+([^\s]+)\s+(\{.*\})$/s.exec(activity);
  if (!match) return activity;

  const [, toolName, rawArgs] = match;

  try {
    const args = JSON.parse(rawArgs) as Record<string, unknown>;
    if (toolName === "read") {
      const path = typeof args.path === "string" ? args.path : "...";
      const offset = typeof args.offset === "number" ? args.offset : undefined;
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      if (offset !== undefined || limit !== undefined) {
        const start = offset ?? 1;
        const end = limit !== undefined ? start + limit - 1 : undefined;
        return `→ read ${path}:${start}${end ? `-${end}` : ""}`;
      }
      return `→ read ${path}`;
    }
    if (toolName === "bash") {
      const command = typeof args.command === "string" ? truncate(args.command, 80) : "...";
      return `→ bash ${command}`;
    }
    if (toolName === "write" || toolName === "edit" || toolName === "ls" || toolName === "find" || toolName === "grep") {
      const path = typeof args.path === "string" ? args.path : typeof args.file_path === "string" ? args.file_path : undefined;
      return path ? `→ ${toolName} ${path}` : `→ ${toolName}`;
    }
    return `→ ${toolName}`;
  } catch {
    return activity;
  }
}

export function getRecentActivityPreview(r: SingleResult, maxItems = 2): string[] {
  return (r.recentActivity ?? []).slice(-maxItems).map(formatRecentActivityLine);
}

export function buildRunningPreviewLines(r: SingleResult, maxActivityItems = 3): string[] {
  const lines = [formatRunningSummary(r)];
  if (r.lastAssistantText) lines.push(`last: ${r.lastAssistantText}`);
  lines.push(...getRecentActivityPreview(r, maxActivityItems));
  return lines;
}

export function buildProgressUpdateText(
  progress: Pick<SubagentProgress, "phase" | "elapsedMs" | "currentTool" | "lastAssistantText" | "recentActivity">,
  maxActivityItems = 2,
): string {
  const summaryParts = [progress.phase || "running"];
  const elapsed = formatElapsedMs(progress.elapsedMs);
  if (elapsed) summaryParts.push(elapsed);
  if (progress.currentTool) summaryParts.push(`tool=${progress.currentTool}`);

  const lines = [summaryParts.join(" · ")];
  if (progress.lastAssistantText) lines.push(`last: ${progress.lastAssistantText}`);
  const recent = (progress.recentActivity ?? []).slice(-maxActivityItems).map(formatRecentActivityLine);
  if (recent.length > 0) lines.push(...recent);
  return lines.join("\n");
}
