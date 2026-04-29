import { assembleExecutorContext } from "../executor-core/assembly.ts";
import { executeResolvedContext, type ExecuteInvocationOptions } from "../executor-core/execute.ts";
import type { ExecutorInvocation } from "../executor-core/invocation.ts";
import type { TaskDocInput, TaskDocThinking } from "../executor-core/task-doc.ts";
import type { ExecutorRuntimePolicy } from "../executor-core/context.ts";

export interface LegacySubagentLikeRequest {
  task: string;
  cwd: string;
  agent?: string;
  role?: string;
  mode?: "single" | "parallel" | "sequential" | "dag";
  title?: string;
  constraints?: string[];
  checklist?: string[];
  todolist?: string[];
  extensions?: string[];
  preferredModel?: string;
  preferredThinking?: "low" | "medium" | "high";
  inputs?: TaskDocInput[];
  completionPolicy?: ExecutorRuntimePolicy["completionPolicy"];
  idleTimeoutMs?: number;
  timeoutMs?: number;
  terminateGraceMs?: number;
  sandboxCleanupPolicy?: ExecutorRuntimePolicy["sandboxCleanupPolicy"];
  preserveSandboxOnFailure?: boolean;
  maxConcurrency?: number;
}

export interface LegacyExecuteRequestOptions extends Omit<ExecuteInvocationOptions, "extensions"> {
  extensions?: string[];
}

export function legacyRequestToInvocation(request: LegacySubagentLikeRequest): ExecutorInvocation {
  return {
    sourceTaskDocPath: "compatibility://legacy-subagent-like-request",
    caller: {
      type: "legacy-subagent-like-request",
      name: request.agent ?? request.role ?? "legacy-caller",
    },
    project: {
      name: "compatibility-project",
      cwd: request.cwd,
    },
    stage: request.role === "reviewer" ? "reviewer" : "builder",
    executorType: request.role,
    task: {
      title: request.title ?? "Compatibility invocation",
      description: request.task,
    },
    expectedOutput: {
      todolist: [...(request.todolist ?? [])],
      checklist: [...(request.checklist ?? [])],
    },
    constraints: [...(request.constraints ?? [])],
    inputs: [...(request.inputs ?? [])],
    hints: {
      preferredModel: request.preferredModel,
      preferredThinking: request.preferredThinking,
      preferredRole: request.role,
    },
    mode: request.mode ?? "single",
  };
}

export function legacyRequestToRuntimePolicy(request: LegacySubagentLikeRequest): Partial<ExecutorRuntimePolicy> {
  return {
    mode: request.mode,
    maxConcurrency: request.maxConcurrency,
    completionPolicy: request.completionPolicy,
    idleTimeoutMs: request.idleTimeoutMs,
    timeoutMs: request.timeoutMs,
    terminateGraceMs: request.terminateGraceMs,
    sandboxCleanupPolicy: request.sandboxCleanupPolicy,
    preserveSandboxOnFailure: request.preserveSandboxOnFailure,
  };
}

export function legacyRequestToExecuteOptions(
  request: LegacySubagentLikeRequest,
  options: LegacyExecuteRequestOptions,
): ExecuteInvocationOptions {
  return {
    ...options,
    extensions: request.extensions ?? options.extensions,
  };
}

export async function executeLegacyRequest(
  request: LegacySubagentLikeRequest,
  options: LegacyExecuteRequestOptions,
) {
  const invocation = legacyRequestToInvocation(request);
  const context = assembleExecutorContext(invocation, {
    runId: options.runId,
    defaultRuntimePolicy: legacyRequestToRuntimePolicy(request),
  });

  return executeResolvedContext(context, legacyRequestToExecuteOptions(request, options));
}
