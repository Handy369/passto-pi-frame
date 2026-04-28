import { assembleExecutorContext } from "../executor-core/assembly.ts";
import { executeResolvedContext, type ExecuteInvocationOptions } from "../executor-core/execute.ts";
import { FileExecutorRunStore, getExecutorWorkspaceRoot } from "../executor-core/run-store.ts";
import type { ExecutorInvocation } from "../executor-core/invocation.ts";
import type { TaskDocInput, TaskDocThinking } from "../executor-core/task-doc.ts";
import type { ExecutorRuntimePolicy } from "../executor-core/context.ts";
import { buildBuilderExecutionPrompt, callerRequestToBuilderInput, type ExecutorCallerRequest } from "./builder-input-bridge.ts";

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

export type CallerExecuteRequestOptions = LegacyExecuteRequestOptions;

const SMALL_TIMEOUT_MS = 8 * 60 * 1000;
const MEDIUM_TIMEOUT_MS = 15 * 60 * 1000;
const LARGE_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_AUTO_TIMEOUT_MS = 25 * 60 * 1000;

const COMPLEXITY_KEYWORDS = [
  "refactor",
  "scaffold",
  "implement",
  "migrate",
  "workflow",
  "builder",
  "planner",
  "nested",
  "test",
  "commit",
];

function clampTimeoutMs(value: number) {
  return Math.max(SMALL_TIMEOUT_MS, Math.min(MAX_AUTO_TIMEOUT_MS, Math.floor(value)));
}

export function estimateExecutorTimeoutMs(request: ExecutorCallerRequest): number {
  if (typeof request.timeoutMs === "number" && Number.isFinite(request.timeoutMs) && request.timeoutMs > 0) {
    return clampTimeoutMs(request.timeoutMs);
  }

  let score = 0;
  const todoCount = request.todolist?.length ?? 0;
  const outputCount = request.outputs?.length ?? 0;
  const constraintCount = request.constraints?.length ?? 0;
  const promptCount = request.prompts?.length ?? 0;
  const text = [request.goal, ...(request.prompts ?? []), request.stage ?? "", ...(request.outputs ?? [])]
    .join("\n")
    .toLowerCase();

  if (todoCount >= 3) score += 1;
  if (todoCount >= 5) score += 1;
  if (outputCount >= 3) score += 1;
  if (constraintCount >= 4) score += 1;
  if (promptCount >= 3) score += 1;
  if (request.mode && request.mode !== "single") score += 1;
  if (COMPLEXITY_KEYWORDS.some((keyword) => text.includes(keyword))) score += 2;

  if (score >= 4) return clampTimeoutMs(LARGE_TIMEOUT_MS);
  if (score >= 2) return clampTimeoutMs(MEDIUM_TIMEOUT_MS);
  return clampTimeoutMs(SMALL_TIMEOUT_MS);
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
  options: LegacyExecuteRequestOptions = {},
): ExecuteInvocationOptions {
  return {
    ...options,
    extensions: request.extensions ?? options.extensions,
    runStore: options.runStore ?? new FileExecutorRunStore({
      rootDir: getExecutorWorkspaceRoot(request.cwd),
    }),
  };
}

export function callerRequestToInvocation(request: ExecutorCallerRequest): ExecutorInvocation {
  const cwd = request.cwd ?? process.cwd();
  const builderInput = callerRequestToBuilderInput(request);
  return {
    sourceTaskDocPath: "compatibility://caller-request",
    caller: {
      type: "caller-request",
      name: request.agent ?? "default",
    },
    project: {
      name: "compatibility-project",
      cwd,
    },
    stage: "builder",
    executorType: "passto-builder",
    task: {
      title: request.goal,
      description: [
        "You must invoke the `run_builder_task` tool from `passto-builder` with the exact BuilderInput JSON below.",
        "Use passto-builder as the actual implementation path. Do not manually implement outside the builder workflow.",
        "After the builder run completes, return a concise summary including final status, primary run id, produced artifacts, and blockers if any.",
        "",
        "BuilderInput JSON:",
        JSON.stringify(builderInput, null, 2),
      ].join("\n"),
    },
    expectedOutput: {
      todolist: [...(request.todolist ?? [])],
      checklist: [...(request.outputs ?? [])],
    },
    constraints: [...(request.constraints ?? [])],
    inputs: [...(request.inputs ?? [])],
    hints: {
      preferredModel: request.preferredModel,
      preferredThinking: request.preferredThinking,
      preferredRole: "builder",
    },
    mode: request.mode ?? "single",
  };
}

export function callerRequestToRuntimePolicy(request: ExecutorCallerRequest): Partial<ExecutorRuntimePolicy> {
  return {
    mode: request.mode,
    maxConcurrency: request.maxConcurrency,
    idleTimeoutMs: request.idleTimeoutMs,
    timeoutMs: estimateExecutorTimeoutMs(request),
    terminateGraceMs: request.terminateGraceMs,
    completionPolicy: "process-exit",
  };
}

export function callerRequestToExecuteOptions(
  request: ExecutorCallerRequest,
  options: CallerExecuteRequestOptions = {},
): ExecuteInvocationOptions {
  const cwd = request.cwd ?? process.cwd();
  return {
    ...options,
    agent: request.agent ?? options.agent,
    extensions: request.extensions ?? options.extensions,
    runStore: options.runStore ?? new FileExecutorRunStore({
      rootDir: getExecutorWorkspaceRoot(cwd),
    }),
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

export async function executeCallerRequest(
  request: ExecutorCallerRequest,
  options: CallerExecuteRequestOptions = {},
) {
  const invocation = callerRequestToInvocation(request);
  const context = assembleExecutorContext(invocation, {
    runId: options.runId,
    defaultRuntimePolicy: callerRequestToRuntimePolicy(request),
  });
  return executeResolvedContext(context, callerRequestToExecuteOptions(request, options));
}
