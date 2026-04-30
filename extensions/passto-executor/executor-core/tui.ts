import { Container, Text, type Theme } from "@mariozechner/pi-tui";
import type { ExecutorRunResult } from "./result.ts";

function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

function summarizeFinalText(text: string | undefined): string {
  if (!text) return "";
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return "";
  const paragraphs = normalized.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const firstParagraph = paragraphs[0] ?? normalized;
  const firstLine = firstParagraph.split("\n").map((item) => item.trim()).find(Boolean);
  return firstLine ?? firstParagraph;
}

function formatTokens(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
  if (count < 1000000) return `${Math.round(count / 1000)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

function formatElapsedFromEvents(result: ExecutorRunResult): string | null {
  const started = result.events.find((e) => e.type === "run.started")?.timestamp;
  const ended = [...result.events].reverse().find((e) => e.type === "run.completed" || e.type === "run.failed")?.timestamp;
  if (!started || !ended) return null;
  const ms = Date.parse(ended) - Date.parse(started);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatToolPreview(toolName: string | undefined, rawArgs: string | undefined): string | undefined {
  if (!toolName) return undefined;
  if (!rawArgs) return toolName;
  try {
    const args = JSON.parse(rawArgs) as Record<string, unknown>;
    if (toolName === "read") {
      const path = typeof args.path === "string" ? args.path : "...";
      const offset = typeof args.offset === "number" ? args.offset : undefined;
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      if (offset !== undefined || limit !== undefined) {
        const start = offset ?? 1;
        const end = limit !== undefined ? start + limit - 1 : undefined;
        return `read ${path}:${start}${end ? `-${end}` : ""}`;
      }
      return `read ${path}`;
    }
    if (toolName === "bash") {
      const command = typeof args.command === "string" ? args.command : "...";
      return `bash ${truncate(command, 120)}`;
    }
    if (toolName === "ls") {
      return `ls ${typeof args.path === "string" ? args.path : "."}`;
    }
    if (toolName === "edit" || toolName === "write") {
      return `${toolName} ${typeof args.path === "string" ? args.path : "..."}`;
    }
    return `${toolName} ${truncate(rawArgs, 120)}`;
  } catch {
    return `${toolName} ${truncate(rawArgs, 120)}`;
  }
}

function latestToolCall(result: ExecutorRunResult): { toolName?: string; perspective?: string } {
  const toolEvent = [...result.events].reverse().find((e) => e.type === "tool.called");
  if (!toolEvent || toolEvent.type !== "tool.called") return {};
  return { toolName: toolEvent.toolName, perspective: toolEvent.perspective };
}

export function renderExecutorToolCall(args: Record<string, unknown>, theme: Theme): Text {
  const invocation = (args.invocation ?? {}) as Record<string, unknown>;
  const hints = (invocation.hints ?? {}) as Record<string, unknown>;
  const modelName = typeof hints.preferredModel === "string" ? hints.preferredModel : undefined;
  const firstLine = modelName
    ? `${theme.fg("toolTitle", "passto-executor")} ${theme.fg("muted", `| ${modelName}`)}`
    : theme.fg("toolTitle", "passto-executor");
  return new Text(firstLine, 0, 0);
}

export function renderExecutorToolResult(
  result: { content: Array<{ type: string; text?: string }>; details?: unknown },
  _expanded: { expanded: boolean; isPartial: boolean },
  theme: Theme,
): Container | Text {
  const details = result.details as ExecutorRunResult | undefined;
  if (!details) {
    return new Text(result.content[0]?.text ?? "(no output)", 0, 0);
  }

  const box = new Container();
  const title = details.display?.title || "passto-executor";
  const active = details.display?.activeAgentLabel || title;
  const activeModelName = details.display?.activeModelName;
  const activeThinkingLevel = details.display?.activeThinkingLevel;
  const elapsed = formatElapsedFromEvents(details);
  const runVerb = details.status === "completed" ? "completed" : details.status === "failed" ? "failed" : "running";
  const runningLine = `${title}${activeThinkingLevel ? ` | thinking: ${activeThinkingLevel}` : ""} ${runVerb}${elapsed ? ` · ${elapsed}` : ""}`;
  const usage = details.usage;
  const usageLine = `usage: ↑${formatTokens(usage.input)} ↓${formatTokens(usage.output)} R${formatTokens(usage.cacheRead)} $${usage.cost.toFixed(4)}${usage.contextTokens ? ` ${((usage.contextTokens / 922000) * 100).toFixed(1)}%/${formatTokens(922000)}` : ""}`;
  const toolCalls = details.events.filter((e) => e.type === "tool.called").length;
  const turns = details.usage.turns;
  const stateLine = `state: ${toolCalls} tools-call | ${turns} turns`;
  const lastMessage = truncate(details.display?.lastMessage || details.summaryText || "(no output)", 220);
  const finalSummary = truncate(summarizeFinalText(details.display?.finalSummary || details.summaryText || ""), 220);
  const currentToolPreview = formatToolPreview(details.display?.currentTool, details.display?.currentToolArgsPreview);
  const lastTool = latestToolCall(details);
  const fallbackToolPreview = lastTool.toolName ? `${lastTool.toolName}${lastTool.perspective ? ` (${lastTool.perspective})` : ""}` : undefined;
  const nowLine = currentToolPreview ? `Now: ${currentToolPreview}` : fallbackToolPreview ? `Now: ${fallbackToolPreview}` : undefined;

  const headerLine = activeModelName
    ? `passto-executor | ${activeModelName}`
    : "passto-executor";

  box.addChild(new Text(theme.fg("toolTitle", headerLine), 0, 0));
  box.addChild(new Text(theme.fg("accent", runningLine), 0, 0));
  box.addChild(new Text(theme.fg("dim", usageLine), 0, 0));
  box.addChild(new Text(theme.fg("dim", "-----------------------------------------"), 0, 0));
  box.addChild(new Text(theme.fg("dim", stateLine), 0, 0));
  box.addChild(new Text(theme.fg("toolOutput", `Last: ${lastMessage}`), 0, 0));
  if (nowLine) box.addChild(new Text(theme.fg("muted", nowLine), 0, 0));
  if (finalSummary && details.status !== "failed") box.addChild(new Text(theme.fg("toolOutput", finalSummary), 0, 0));
  if (finalSummary && details.status === "failed") box.addChild(new Text(theme.fg("error", finalSummary), 0, 0));
  return box;
}
