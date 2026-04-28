import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { Type } from "typebox";
import {
  executeCallerRequest,
  executeLegacyRequest,
  legacyRequestToExecuteOptions,
  legacyRequestToInvocation,
  type ExecutorCallerRequest,
  type LegacySubagentLikeRequest,
} from "./compatibility/index.ts";

interface ExecutorCardView {
  runId: string;
  status: string;
  toolCalls: number;
  elapsedMs: number;
  maxDurationMs?: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  contextTokens: number;
  cost?: number;
  turns: number;
  maxTurns?: number;
  lastToolSummary?: string;
  nowToolSummary?: string;
}

export { taskDocToInvocation, type ExecutorInvocation } from "./executor-core/invocation.ts";
export { assembleExecutorContext } from "./executor-core/assembly.ts";
export { executeInvocation } from "./executor-core/execute.ts";
export { executeTaskDoc } from "./executor-core/task-entry.ts";
export type { ResolvedExecutorRunContext, ExecutorRuntimePolicy } from "./executor-core/context.ts";
export type { ExecutorRunResult } from "./executor-core/result.ts";
export type { SandboxCleanupPolicy } from "./executor-core/sandbox.ts";
export {
  callerRequestToExecuteOptions,
  callerRequestToInvocation,
  callerRequestToRuntimePolicy,
  legacyRequestToRuntimePolicy,
  executeCallerRequest,
  executeLegacyRequest as executeExecutorLegacyRequest,
  type CallerExecuteRequestOptions,
  type LegacyExecuteRequestOptions,
} from "./compatibility/index.ts";

const ExecutorCallerInputSchema = Type.Object({
  goal: Type.String({ description: "Caller goal to be bridged into builder execution." }),
  cwd: Type.Optional(Type.String({ description: "Working directory for the run. Defaults to current cwd." })),
  todolist: Type.Optional(Type.Array(Type.String(), { description: "Optional task decomposition list." })),
  outputs: Type.Optional(Type.Array(Type.String(), { description: "Expected outputs to produce." })),
  prompts: Type.Optional(Type.Array(Type.String(), { description: "Additional prompts for executor bridge expansion." })),
  constraints: Type.Optional(Type.Array(Type.String(), { description: "Optional execution constraints." })),
  stage: Type.Optional(Type.String({ description: "Business or execution stage label." })),
  agent: Type.Optional(Type.String({ description: "Runtime agent profile name or markdown profile path." })),
  extensions: Type.Optional(Type.Array(Type.String(), { description: "Extra child extensions to inject." })),
  preferredModel: Type.Optional(Type.String({ description: "Preferred model for runtime execution." })),
  preferredThinking: Type.Optional(Type.Union([
    Type.Literal("low"),
    Type.Literal("medium"),
    Type.Literal("high"),
  ], { description: "Preferred thinking depth." })),
  mode: Type.Optional(Type.Union([
    Type.Literal("single"),
    Type.Literal("sequential"),
    Type.Literal("parallel"),
    Type.Literal("dag"),
  ], { description: "Execution mode." })),
  maxConcurrency: Type.Optional(Type.Number({ description: "Maximum concurrency for executor scheduling." })),
  idleTimeoutMs: Type.Optional(Type.Number({ description: "Max idle time before intervention." })),
  timeoutMs: Type.Optional(Type.Number({ description: "Maximum total runtime before forced termination." })),
  terminateGraceMs: Type.Optional(Type.Number({ description: "Grace period between SIGTERM and SIGKILL." })),
});

function extractAssistantText(message: { content?: unknown[] } | undefined): string | undefined {
  const content = message?.content;
  if (!Array.isArray(content)) return undefined;
  let lastText: string | undefined;
  for (const part of content) {
    if (!part || typeof part !== "object" || (part as { type?: unknown }).type !== "text") continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) lastText = text;
  }
  return lastText;
}

function extractAgentEndMessages(child: { rawEvents?: unknown[]; finalOutputText?: string }) {
  const rawEvents = Array.isArray(child.rawEvents) ? child.rawEvents : [];
  const messages: string[] = [];
  let pendingLastAssistantText: string | undefined;

  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    const typed = event as { type?: unknown; message?: { role?: unknown; content?: unknown[] }; messages?: Array<{ role?: unknown; content?: unknown[] }> };

    if (typed.message?.role === "assistant") {
      const text = extractAssistantText(typed.message);
      if (text) pendingLastAssistantText = text;
    }

    if (typed.type === "agent_end") {
      let agentEndText = pendingLastAssistantText;
      if (Array.isArray(typed.messages)) {
        for (let index = typed.messages.length - 1; index >= 0; index -= 1) {
          const message = typed.messages[index];
          if (message?.role !== "assistant") continue;
          const text = extractAssistantText(message);
          if (text) {
            agentEndText = text;
            break;
          }
        }
      }
      if (agentEndText) messages.push(agentEndText);
      pendingLastAssistantText = undefined;
    }
  }

  if (messages.length === 0 && child.finalOutputText) messages.push(child.finalOutputText);
  return messages;
}

function extractLastAssistantTextBeforeAgentEnd(child: { rawEvents?: unknown[]; finalOutputText?: string }) {
  return getLastItem(extractAgentEndMessages(child)) ?? child.finalOutputText;
}

function extractToolResults(child: { rawEvents?: unknown[] }) {
  const rawEvents = Array.isArray(child.rawEvents) ? child.rawEvents : [];
  const toolResults: Array<{ toolName: string; text?: string }> = [];

  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    const typed = event as {
      type?: unknown;
      toolName?: unknown;
      result?: { content?: unknown[] };
      message?: { content?: unknown[] };
      isError?: unknown;
    };

    if (typed.type === "tool_execution_end" && typeof typed.toolName === "string") {
      let text: string | undefined;
      const content = typed.result?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "text") continue;
          const value = (item as { text?: unknown }).text;
          if (typeof value === "string" && value.trim()) {
            text = value.trim();
            break;
          }
        }
      }
      toolResults.push({ toolName: typed.toolName, text });
      continue;
    }

    if (typed.type !== "tool_result_end") continue;

    let toolName = "unknown";
    let text: string | undefined;
    const content = typed.message?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object" || (part as { type?: unknown }).type !== "toolResult") continue;
        const toolPart = part as { toolName?: unknown; content?: unknown[] };
        if (typeof toolPart.toolName === "string") toolName = toolPart.toolName;
        if (Array.isArray(toolPart.content)) {
          for (const item of toolPart.content) {
            if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "text") continue;
            const value = (item as { text?: unknown }).text;
            if (typeof value === "string") {
              text = value;
              break;
            }
          }
        }
        break;
      }
    }

    toolResults.push({ toolName, text });
  }

  return toolResults;
}

function extractToolCalls(child: { rawEvents?: unknown[] }) {
  const rawEvents = Array.isArray(child.rawEvents) ? child.rawEvents : [];
  const toolCalls: string[] = [];

  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    const typed = event as { type?: unknown; toolName?: unknown };
    if (typed.type === "tool_execution_start" && typeof typed.toolName === "string") {
      toolCalls.push(typed.toolName);
    }
  }

  return toolCalls;
}

function countToolCalls(child: { rawEvents?: unknown[] }) {
  return extractToolCalls(child).length;
}

function buildToolHistogram(toolNames: string[]) {
  const counts = new Map<string, number>();
  for (const toolName of toolNames) counts.set(toolName, (counts.get(toolName) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([toolName, count]) => ({ toolName, count }))
    .sort((a, b) => b.count - a.count || a.toolName.localeCompare(b.toolName));
}

function formatToolHistogram(toolHistogram: Array<{ toolName: string; count: number }>) {
  return toolHistogram.map((item) => `${item.toolName}×${item.count}`).join("，");
}

function countAgentEnds(child: { rawEvents?: unknown[] }) {
  const rawEvents = Array.isArray(child.rawEvents) ? child.rawEvents : [];
  return rawEvents.reduce((sum, event) => {
    if (!event || typeof event !== "object") return sum;
    const typed = event as { type?: unknown };
    return typed.type === "agent_end" ? sum + 1 : sum;
  }, 0);
}

function getLastItem<T>(items: T[] | undefined): T | undefined {
  return Array.isArray(items) && items.length > 0 ? items[items.length - 1] : undefined;
}

function summarizeToolResult(result: { toolName: string; text?: string } | undefined, fallbackStatus?: string) {
  if (result?.text) return `${result.toolName} → ${result.text}`;
  if (result?.toolName) return result.toolName;
  return fallbackStatus;
}

function extractRecentToolResultSummaryFromActivity(activity: string[] | undefined) {
  const items = Array.isArray(activity) ? activity : [];
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (typeof item !== "string" || !item.startsWith("tool_result: ")) continue;
    return item.slice("tool_result: ".length);
  }
  return undefined;
}

function buildExecutorCardView(result: Awaited<ReturnType<typeof executeLegacyRequest>>): ExecutorCardView {
  const children = result.perspectiveResults.map((item) => item.child).filter((child) => child !== undefined);
  const latestChild = getLastItem(children);
  const latestToolResult = latestChild ? getLastItem(extractToolResults(latestChild)) : undefined;
  const elapsedMs = children.reduce((sum, child) => sum + (child?.progress.elapsedMs ?? 0), 0);
  const toolNames = children.flatMap((child) => child ? extractToolCalls(child) : []);
  const toolCalls = toolNames.length;
  const inputTokens = children.reduce((sum, child) => sum + (child?.usage.input ?? 0), 0);
  const outputTokens = children.reduce((sum, child) => sum + (child?.usage.output ?? 0), 0);
  const cacheHitTokens = children.reduce((sum, child) => sum + (child?.usage.cacheRead ?? 0), 0);
  const contextTokens = children.reduce((sum, child) => sum + (child?.usage.contextTokens ?? 0), 0);
  const turns = children.reduce((sum, child) => sum + (child?.usage.turns ?? 0), 0);
  const cost = children.reduce((sum, child) => sum + (child?.usage.cost ?? 0), 0);
  const lastToolSummary = summarizeToolResult(latestToolResult, result.status === "completed" ? "success" : "fail");
  const nowToolSummary = latestChild?.progress.currentTool
    ? `${latestChild.progress.currentTool}${latestChild.progress.currentToolArgsPreview ? ` → ${latestChild.progress.currentToolArgsPreview}` : ""}`
    : undefined;

  return {
    runId: result.runId,
    status: result.status,
    toolCalls,
    elapsedMs,
    inputTokens,
    outputTokens,
    cacheHitTokens,
    contextTokens,
    cost,
    turns,
    lastToolSummary,
    nowToolSummary,
  };
}

function formatCompactCount(value: number | undefined): string {
  const amount = Math.max(0, value ?? 0);
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(amount));
}

function formatCompactCost(value: number | undefined): string {
  const amount = Math.max(0, value ?? 0);
  if (amount >= 100) return amount.toFixed(0);
  if (amount >= 1) return amount.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  if (amount >= 0.01) return amount.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return amount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function formatContextWindowUsage(contextTokens: number, maxContextTokens = 922_000): string {
  const percent = maxContextTokens > 0 ? (contextTokens / maxContextTokens) * 100 : 0;
  return `${percent.toFixed(1)}%/${formatCompactCount(maxContextTokens)}`;
}

function renderExecutorCard(view: ExecutorCardView) {
  const elapsedSeconds = (Math.max(0, view.elapsedMs) / 1000).toFixed(1);
  const statusLabel = view.status === "completed" || view.status === "done"
    ? "complete"
    : view.status === "running"
      ? "running"
      : view.status === "starting"
        ? "starting"
        : view.status === "error" || view.status === "failed"
          ? "failed"
          : view.status;
  const durationSuffix = view.maxDurationMs ? ` / ${Math.round(view.maxDurationMs / 1000)}s` : "";
  const turnSuffix = view.maxTurns ? ` / ${view.maxTurns}` : "";

  return [
    `passto-executor ${statusLabel} · ${elapsedSeconds}s${durationSuffix}`,
    `useage:↑${formatCompactCount(view.inputTokens)} ↓${formatCompactCount(view.outputTokens)} R${formatCompactCount(view.cacheHitTokens)} $${formatCompactCost(view.cost)} ${formatContextWindowUsage(view.contextTokens)}`,
    `state: ${view.toolCalls} tools-call ｜ ${view.turns} turns${turnSuffix}`,
    `Last: ${view.lastToolSummary ?? (view.status === "completed" ? "success" : "fail")}`,
    `Now: ${view.nowToolSummary ?? (view.status === "completed" ? "complete" : "idle")}`,
  ];
}

function createRealtimeExecutorCard(runId: string, status: string) {
  const state: ExecutorCardView = {
    runId,
    status,
    toolCalls: 0,
    elapsedMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheHitTokens: 0,
    contextTokens: 0,
    turns: 0,
  };

  return {
    snapshot() {
      return { ...state };
    },
    applyProgress(update: {
      perspective: string;
      progress: {
        phase?: string;
        elapsedMs?: number;
        currentTool?: string;
        lastAssistantText?: string;
        recentActivity?: string[];
        usage?: { input: number; output: number; cacheRead: number; contextTokens?: number; cost?: number; turns?: number };
      };
    }) {
      state.status = update.progress.phase ?? state.status;
      state.elapsedMs = Math.max(state.elapsedMs, update.progress.elapsedMs ?? 0);
      state.inputTokens = Math.max(state.inputTokens, update.progress.usage?.input ?? 0);
      state.outputTokens = Math.max(state.outputTokens, update.progress.usage?.output ?? 0);
      state.cacheHitTokens = Math.max(state.cacheHitTokens, update.progress.usage?.cacheRead ?? 0);
      state.contextTokens = Math.max(state.contextTokens, update.progress.usage?.contextTokens ?? 0);
      state.cost = Math.max(state.cost ?? 0, update.progress.usage?.cost ?? 0);
      state.turns = Math.max(state.turns, update.progress.usage?.turns ?? 0);
      if (update.progress.currentTool) {
        if (!state.nowToolSummary?.startsWith(`${update.progress.currentTool}`)) state.toolCalls += 1;
        state.nowToolSummary = update.progress.currentToolArgsPreview
          ? `${update.progress.currentTool} → ${update.progress.currentToolArgsPreview}`
          : update.progress.currentTool;
      }
      const latestActivity = getLastItem(update.progress.recentActivity);
      const recentToolResultSummary = extractRecentToolResultSummaryFromActivity(update.progress.recentActivity);
      if (recentToolResultSummary) {
        state.lastToolSummary = recentToolResultSummary;
        state.nowToolSummary = recentToolResultSummary;
      }
    },
    finalize(status: string, formatted: ReturnType<typeof formatExecutorResult>) {
      state.status = status;
      state.toolCalls = formatted.perspectives.reduce((sum, item) => sum + (item.toolCallCount ?? 0), 0);
      state.inputTokens = formatted.usage.input;
      state.outputTokens = formatted.usage.output;
      state.cacheHitTokens = formatted.usage.cacheRead;
      state.contextTokens = formatted.usage.contextTokens;
      state.cost = formatted.usage.cost;
      state.turns = formatted.usage.turns;
      const latestPerspective = getLastItem(formatted.perspectives);
      state.lastToolSummary = latestPerspective?.lastToolSummary
        ?? state.lastToolSummary
        ?? latestPerspective?.latestToolResult?.toolName
        ?? (formatted.status === "completed" ? "success" : "fail");
      state.nowToolSummary = formatted.status === "completed"
        ? "complete"
        : formatted.status === "failed"
          ? "fail"
          : (latestPerspective?.nowToolSummary ?? state.nowToolSummary ?? "idle");
      state.maxDurationMs = latestPerspective?.maxDurationMs;
      state.maxTurns = latestPerspective?.maxTurns;
    },
  };
}

function formatExecutorResult(result: Awaited<ReturnType<typeof executeLegacyRequest>>) {
  return {
    status: result.status,
    runId: result.runId,
    summaryText: result.summaryText,
    perspectives: result.perspectiveResults.map((item) => {
      const toolCalls = item.child ? extractToolCalls(item.child) : [];
      const latestToolResult = item.child ? getLastItem(extractToolResults(item.child)) : undefined;
      const recentToolResultSummary = extractRecentToolResultSummaryFromActivity(item.child?.progress.recentActivity);
      return {
        perspective: item.perspective,
        status: item.status,
        latestToolResult,
        lastToolSummary: recentToolResultSummary
          ?? summarizeToolResult(latestToolResult, item.status === "completed" ? "success" : "fail"),
        nowToolSummary: item.status === "completed"
          ? "complete"
          : item.child?.progress.currentTool
            ? `${item.child.progress.currentTool}${item.child.progress.currentToolArgsPreview ? ` → ${item.child.progress.currentToolArgsPreview}` : ""}`
            : "idle",
        toolCallCount: toolCalls.length,
        toolCalls,
        maxDurationMs: undefined,
        maxTurns: undefined,
      };
    }),
    usage: result.usage,
    failure: result.failure,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("passto-executor", {
    description: "Run a bounded passto-executor task from a caller-oriented JSON request.",
    handler: async (args, ctx) => {
      const raw = args.trim();
      if (!raw) {
        ctx.ui?.notify("Usage: /passto-executor <JSON ExecutorCallerRequest>", "warning");
        return;
      }

      try {
        const request = JSON.parse(raw) as ExecutorCallerRequest;
        const runId = randomUUID();
        const realtimeCard = createRealtimeExecutorCard(runId, "starting");
        const result = await executeCallerRequest(request, {
          runId,
          agent: request.agent ?? "default",
          onChildProgress(update) {
            realtimeCard.applyProgress(update);
          },
        });
        const formatted = formatExecutorResult(result);
        realtimeCard.finalize(formatted.status, formatted);
        ctx.ui?.notify(`Executor completed: ${formatted.status}`, formatted.status === "completed" ? "info" : "warning");
        pi.sendUserMessage(renderExecutorCard(realtimeCard.snapshot()).join("\n"), { deliverAs: "assistant" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ctx.ui?.notify(`passto-executor failed: ${message}`, "error");
      }
    },
  });

  pi.registerTool({
    name: "run_executor_task",
    label: "Run executor task",
    description: "Execute a bounded passto-executor task using the caller-oriented request shape.",
    parameters: ExecutorCallerInputSchema,
    async execute(_id, params, _signal, onUpdate) {
      const request = params as ExecutorCallerRequest;
      const runId = randomUUID();
      const realtimeCard = createRealtimeExecutorCard(runId, "starting");
      onUpdate?.({ content: [{ type: "text", text: renderExecutorCard(realtimeCard.snapshot()).join("\n") }] });
      const result = await executeCallerRequest(request, {
        runId,
        agent: request.agent ?? "default",
        onChildProgress(update) {
          realtimeCard.applyProgress(update);
          const rendered = renderExecutorCard(realtimeCard.snapshot()).join("\n");
          onUpdate?.({ content: [{ type: "text", text: rendered }] });
        },
      });
      const formatted = formatExecutorResult(result);
      realtimeCard.finalize(formatted.status, formatted);
      const rendered = renderExecutorCard(realtimeCard.snapshot()).join("\n");
      onUpdate?.({ content: [{ type: "text", text: rendered }] });
      return {
        content: [{ type: "text", text: rendered }],
        details: {
          invocation: request,
          result: formatted,
          card: realtimeCard.snapshot(),
        },
      };
    },
  });
}
