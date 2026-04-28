import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { Type } from "typebox";
import {
  executeLegacyRequest,
  legacyRequestToExecuteOptions,
  legacyRequestToInvocation,
  type LegacySubagentLikeRequest,
} from "./compatibility/index.ts";

interface ExecutorCardView {
  runId: string;
  status: string;
  toolCalls: number;
  elapsedMs: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  finalOutputText?: string;
  latestToolResult?: { toolName: string; text?: string };
}

export { taskDocToInvocation, type ExecutorInvocation } from "./executor-core/invocation.ts";
export { assembleExecutorContext } from "./executor-core/assembly.ts";
export { executeInvocation } from "./executor-core/execute.ts";
export { executeTaskDoc } from "./executor-core/task-entry.ts";
export type { ResolvedExecutorRunContext, ExecutorRuntimePolicy } from "./executor-core/context.ts";
export type { ExecutorRunResult } from "./executor-core/result.ts";
export type { SandboxCleanupPolicy } from "./executor-core/sandbox.ts";
export {
  legacyRequestToRuntimePolicy,
  executeLegacyRequest as executeExecutorLegacyRequest,
  type LegacyExecuteRequestOptions,
} from "./compatibility/index.ts";

const LegacyRequestSchema = Type.Object({
  agent: Type.Optional(Type.String({ description: "Runtime agent profile name or markdown profile path." })),
  task: Type.String({ description: "Task description for the delegated execution." }),
  cwd: Type.String({ description: "Working directory for the run." }),
  extensions: Type.Optional(Type.Array(Type.String(), { description: "Extra child extensions to inject." })),
  executionContract: Type.Optional(Type.String({ description: "Optional execution contract, e.g. ralph-loop." })),
  completionPolicy: Type.Optional(Type.String({ description: "Completion policy: agent-end or process-exit." })),
  idleTimeoutMs: Type.Optional(Type.Number({ description: "Max idle time before intervention." })),
  terminateGraceMs: Type.Optional(Type.Number({ description: "Grace period between SIGTERM and SIGKILL." })),
});

function extractLastAssistantTextBeforeAgentEnd(child: { rawEvents?: unknown[]; finalOutputText?: string }) {
  const rawEvents = Array.isArray(child.rawEvents) ? child.rawEvents : [];
  let lastAssistantText: string | undefined;

  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    const typed = event as { type?: unknown; message?: { role?: unknown; content?: unknown[] } };
    if (typed.type === "agent_end") break;
    const message = typed.message;
    if (!message || message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part && typeof part === "object" && (part as { type?: unknown }).type === "text") {
        const text = (part as { text?: unknown }).text;
        if (typeof text === "string" && text.trim()) lastAssistantText = text;
      }
    }
  }

  return lastAssistantText ?? child.finalOutputText;
}

function extractToolResults(child: { rawEvents?: unknown[] }) {
  const rawEvents = Array.isArray(child.rawEvents) ? child.rawEvents : [];
  const toolResults: Array<{ toolName: string; text?: string }> = [];

  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    const typed = event as { type?: unknown; message?: { content?: unknown[] } };
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

function countToolCalls(child: { rawEvents?: unknown[] }) {
  const rawEvents = Array.isArray(child.rawEvents) ? child.rawEvents : [];
  return rawEvents.filter((event) => {
    if (!event || typeof event !== "object") return false;
    const typed = event as { type?: unknown };
    return typed.type === "tool_execution_start" || typed.type === "tool_result_end";
  }).length;
}

function getLastItem<T>(items: T[] | undefined): T | undefined {
  return Array.isArray(items) && items.length > 0 ? items[items.length - 1] : undefined;
}

function buildExecutorCardView(result: Awaited<ReturnType<typeof executeLegacyRequest>>): ExecutorCardView {
  const children = result.perspectiveResults.map((item) => item.child).filter((child) => child !== undefined);
  const latestChild = getLastItem(children);
  const latestToolResult = latestChild ? getLastItem(extractToolResults(latestChild)) : undefined;
  const finalOutputText = latestChild ? extractLastAssistantTextBeforeAgentEnd(latestChild) : undefined;
  const elapsedMs = children.reduce((sum, child) => sum + (child?.progress.elapsedMs ?? 0), 0);
  const toolCalls = children.reduce((sum, child) => sum + (child ? countToolCalls(child) : 0), 0);
  const inputTokens = children.reduce((sum, child) => sum + (child?.usage.input ?? 0), 0);
  const outputTokens = children.reduce((sum, child) => sum + (child?.usage.output ?? 0), 0);
  const cacheHitTokens = children.reduce((sum, child) => sum + (child?.usage.cacheRead ?? 0), 0);

  return {
    runId: result.runId,
    status: result.status,
    toolCalls,
    elapsedMs,
    inputTokens,
    outputTokens,
    cacheHitTokens,
    finalOutputText,
    latestToolResult,
  };
}

function renderExecutorCard(view: ExecutorCardView) {
  const lines = [
    `🧱 passto-executor · ${view.status}`,
    `toolCalls=${view.toolCalls} · elapsed=${(Math.max(0, view.elapsedMs) / 1000).toFixed(1)}s`,
    `input=${view.inputTokens} · output=${view.outputTokens} · cacheHit=${view.cacheHitTokens}`,
  ];

  if (view.finalOutputText) lines.push(`final: ${view.finalOutputText}`);
  if (view.latestToolResult) {
    lines.push(`latest tool: ${view.latestToolResult.toolName}${view.latestToolResult.text ? ` → ${view.latestToolResult.text}` : ""}`);
  }

  return lines;
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
        usage?: { input: number; output: number; cacheRead: number };
      };
    }) {
      state.status = update.progress.phase ?? state.status;
      state.elapsedMs = Math.max(state.elapsedMs, update.progress.elapsedMs ?? 0);
      state.inputTokens = Math.max(state.inputTokens, update.progress.usage?.input ?? 0);
      state.outputTokens = Math.max(state.outputTokens, update.progress.usage?.output ?? 0);
      state.cacheHitTokens = Math.max(state.cacheHitTokens, update.progress.usage?.cacheRead ?? 0);
      if (update.progress.lastAssistantText) state.finalOutputText = update.progress.lastAssistantText;
      if (update.progress.currentTool) {
        state.toolCalls += 1;
        state.latestToolResult = { toolName: update.progress.currentTool };
      }
      const latestActivity = getLastItem(update.progress.recentActivity);
      if (latestActivity?.startsWith("tool_result: ")) {
        const payload = latestActivity.slice("tool_result: ".length);
        const splitIndex = payload.indexOf(" ");
        state.latestToolResult = splitIndex === -1
          ? { toolName: payload }
          : { toolName: payload.slice(0, splitIndex), text: payload.slice(splitIndex + 1) };
      }
    },
    finalize(status: string, formatted: ReturnType<typeof formatExecutorResult>) {
      state.status = status;
      const latestPerspective = getLastItem(formatted.perspectives);
      if (latestPerspective?.finalOutputText) state.finalOutputText = latestPerspective.finalOutputText;
      if (latestPerspective?.latestToolResult) state.latestToolResult = latestPerspective.latestToolResult;
      state.toolCalls = formatted.perspectives.reduce((sum, item) => sum + (item.toolCallCount ?? 0), 0);
      state.inputTokens = formatted.usage.input;
      state.outputTokens = formatted.usage.output;
      state.cacheHitTokens = formatted.usage.cacheRead;
    },
  };
}

function formatExecutorResult(result: Awaited<ReturnType<typeof executeLegacyRequest>>) {
  return {
    status: result.status,
    runId: result.runId,
    summaryText: result.summaryText,
    perspectives: result.perspectiveResults.map((item) => ({
      perspective: item.perspective,
      status: item.status,
      finalOutputText: item.child ? extractLastAssistantTextBeforeAgentEnd(item.child) : undefined,
      latestToolResult: item.child ? getLastItem(extractToolResults(item.child)) : undefined,
      toolCallCount: item.child ? countToolCalls(item.child) : 0,
      elapsedMs: item.child?.progress.elapsedMs,
    })),
    usage: result.usage,
    failure: result.failure,
  };
}

export default function (pi: ExtensionAPI) {
  pi.registerCommand("passto-executor", {
    description: "Run a bounded passto-executor task from a JSON legacy-style request.",
    handler: async (args, ctx) => {
      const raw = args.trim();
      if (!raw) {
        ctx.ui?.notify("Usage: /passto-executor <JSON LegacySubagentLikeRequest>", "warning");
        return;
      }

      try {
        const request = JSON.parse(raw) as LegacySubagentLikeRequest;
        const runId = randomUUID();
        const realtimeCard = createRealtimeExecutorCard(runId, "starting");
        const result = await executeLegacyRequest(request, legacyRequestToExecuteOptions(request, {
          runId,
          agent: request.agent ?? "default",
          onChildProgress(update) {
            realtimeCard.applyProgress(update);
          },
        }));
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
    description: "Execute a bounded passto-executor task using the compatibility legacy request shape.",
    parameters: LegacyRequestSchema,
    async execute(_id, params, _signal, onUpdate) {
      const request = params as LegacySubagentLikeRequest;
      const runId = randomUUID();
      const realtimeCard = createRealtimeExecutorCard(runId, "starting");
      onUpdate?.({ content: [{ type: "text", text: renderExecutorCard(realtimeCard.snapshot()).join("\n") }] });
      const result = await executeLegacyRequest(request, legacyRequestToExecuteOptions(request, {
        runId,
        agent: request.agent ?? "default",
        onChildProgress(update) {
          realtimeCard.applyProgress(update);
          const rendered = renderExecutorCard(realtimeCard.snapshot()).join("\n");
          onUpdate?.({ content: [{ type: "text", text: rendered }] });
        },
      }));
      const formatted = formatExecutorResult(result);
      realtimeCard.finalize(formatted.status, formatted);
      const rendered = renderExecutorCard(realtimeCard.snapshot()).join("\n");
      onUpdate?.({ content: [{ type: "text", text: rendered }] });
      return {
        content: [{ type: "text", text: rendered }],
        details: {
          invocation: legacyRequestToInvocation(request),
          result: formatted,
          card: realtimeCard.snapshot(),
        },
      };
    },
  });
}
