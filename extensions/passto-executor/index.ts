import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import {
  executeLegacyRequest,
  legacyRequestToExecuteOptions,
  legacyRequestToInvocation,
  type LegacySubagentLikeRequest,
} from "./compatibility/index.ts";

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
  agent: Type.String({ description: "Runtime agent profile name or markdown profile path." }),
  task: Type.String({ description: "Task description for the delegated execution." }),
  cwd: Type.String({ description: "Working directory for the run." }),
  extensions: Type.Optional(Type.Array(Type.String(), { description: "Extra child extensions to inject." })),
  executionContract: Type.Optional(Type.String({ description: "Optional execution contract, e.g. ralph-loop." })),
  completionPolicy: Type.Optional(Type.String({ description: "Completion policy: agent-end or process-exit." })),
  idleTimeoutMs: Type.Optional(Type.Number({ description: "Max idle time before intervention." })),
  terminateGraceMs: Type.Optional(Type.Number({ description: "Grace period between SIGTERM and SIGKILL." })),
});

function formatExecutorResult(result: Awaited<ReturnType<typeof executeLegacyRequest>>) {
  return {
    status: result.status,
    runId: result.runId,
    summaryText: result.summaryText,
    perspectiveResults: result.perspectiveResults,
    events: result.events,
    failure: result.failure,
    usage: result.usage,
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
        const result = await executeLegacyRequest(request, legacyRequestToExecuteOptions(request));
        const formatted = formatExecutorResult(result);
        ctx.ui?.notify(`Executor completed: ${formatted.status}`, formatted.status === "completed" ? "info" : "warning");
        pi.sendUserMessage(JSON.stringify(formatted, null, 2), { deliverAs: "assistant" });
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
    async execute(_id, params) {
      const request = params as LegacySubagentLikeRequest;
      const result = await executeLegacyRequest(request, legacyRequestToExecuteOptions(request));
      const formatted = formatExecutorResult(result);
      return {
        content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
        details: {
          invocation: legacyRequestToInvocation(request),
          result: formatted,
        },
      };
    },
  });
}
