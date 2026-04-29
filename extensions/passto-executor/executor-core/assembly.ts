import {
  getDefaultLifecycleConfig,
  getExecutorContractConfig,
  getExecutorDefaults,
  getExecutorModelPolicyConfig,
  getExecutorStageConfig,
  getExecutorTimeoutHeuristicsConfig,
  type ExecutorThinking,
} from "../../../lib/passto-agent-runtime/config.ts";
import type {
  ResolvedExecutorRunContext,
  ExecutorMemoryRef,
  ExecutorPerspectiveSpec,
  ExecutorRuntimePolicy,
  ExecutorPolicyProvenance,
  ExecutorPolicySource,
} from "./context.ts";
import type { ExecutorInvocation } from "./invocation.ts";

export interface ExecutorAssemblyOptions {
  runId: string;
  defaultRuntimePolicy?: Partial<ExecutorRuntimePolicy>;
}

export interface ExecutorPolicyProvenance {
  preferredModel?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
  preferredThinking?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
  mode?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
  completionPolicy?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
  idleTimeoutMs?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
  timeoutMs?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
  terminateGraceMs?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
  maxConcurrency?: "caller" | "invocation" | "perspective" | "stage" | "contract" | "executor-default" | "runtime-default";
}

function toMemoryRef(input: ExecutorInvocation["inputs"][number]): ExecutorMemoryRef {
  return {
    kind: input.kind === "artifact" ? "doc" : input.kind,
    path: input.path,
    content: input.content,
    label: input.label,
    required: input.required,
  };
}

function hasOwnValue<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

function chooseWithProvenance<T>(
  entries: Array<{ source: ExecutorPolicySource; value: T | undefined | null }>,
): { value: T | undefined; source?: ExecutorPolicySource } {
  for (const entry of entries) {
    if (hasOwnValue(entry.value)) return { value: entry.value, source: entry.source };
  }
  return { value: undefined };
}

function resolveExecutorPolicies(
  invocation: ExecutorInvocation,
  perspective: ExecutorPerspectiveSpec,
  options: ExecutorAssemblyOptions,
) {
  const defaultLifecycle = getDefaultLifecycleConfig();
  const executorDefaults = getExecutorDefaults();
  const executorModelPolicy = getExecutorModelPolicyConfig();
  const stageConfig = getExecutorStageConfig(invocation.stage);
  const contractName = perspective.contract?.name;
  const contractConfig = getExecutorContractConfig(contractName);
  const roleDefaults = invocation.hints?.preferredRole
    ? executorModelPolicy.roleDefaults?.[invocation.hints.preferredRole]
    : undefined;
  const callerPolicy = options.defaultRuntimePolicy;
  const perspectivePolicy = perspective.runtimeOptions;

  const preferredModel = chooseWithProvenance<string>([
    { source: "caller", value: callerPolicy && invocation.hints?.preferredModel ? invocation.hints.preferredModel : undefined },
    { source: "invocation", value: invocation.hints?.preferredModel },
    { source: "perspective", value: undefined },
    { source: "stage", value: stageConfig.preferredModel },
    { source: "contract", value: contractConfig.preferredModel },
    { source: "executor-default", value: roleDefaults?.preferredModel ?? executorModelPolicy.defaultModel },
  ]);

  const preferredThinking = chooseWithProvenance<ExecutorThinking>([
    { source: "caller", value: callerPolicy && invocation.hints?.preferredThinking ? invocation.hints.preferredThinking : undefined },
    { source: "invocation", value: invocation.hints?.preferredThinking },
    { source: "perspective", value: undefined },
    { source: "stage", value: stageConfig.preferredThinking },
    { source: "contract", value: contractConfig.preferredThinking },
    { source: "executor-default", value: roleDefaults?.preferredThinking ?? executorDefaults.preferredThinking },
  ]);

  const mode = chooseWithProvenance<ExecutorRuntimePolicy["mode"]>([
    { source: "caller", value: callerPolicy?.mode },
    { source: "invocation", value: invocation.mode },
    { source: "perspective", value: perspectivePolicy?.mode },
    { source: "stage", value: stageConfig.mode },
    { source: "contract", value: contractConfig.mode },
    { source: "executor-default", value: executorDefaults.mode },
    { source: "runtime-default", value: "single" },
  ]);

  const completionPolicy = chooseWithProvenance<ExecutorRuntimePolicy["completionPolicy"]>([
    { source: "caller", value: callerPolicy?.completionPolicy },
    { source: "invocation", value: undefined },
    { source: "perspective", value: perspectivePolicy?.completionPolicy },
    { source: "stage", value: stageConfig.completionPolicy },
    { source: "contract", value: contractConfig.completionPolicy },
    { source: "executor-default", value: executorDefaults.completionPolicy },
    { source: "runtime-default", value: defaultLifecycle.completionPolicy ?? "process-exit" },
  ]);

  const idleTimeoutMs = chooseWithProvenance<number>([
    { source: "caller", value: callerPolicy?.idleTimeoutMs },
    { source: "invocation", value: undefined },
    { source: "perspective", value: perspectivePolicy?.idleTimeoutMs },
    { source: "stage", value: stageConfig.idleTimeoutMs },
    { source: "contract", value: contractConfig.idleTimeoutMs },
    { source: "executor-default", value: executorDefaults.idleTimeoutMs },
    { source: "runtime-default", value: defaultLifecycle.idleTimeoutMs },
  ]);

  const timeoutMs = chooseWithProvenance<number>([
    { source: "caller", value: callerPolicy?.timeoutMs },
    { source: "invocation", value: undefined },
    { source: "perspective", value: perspectivePolicy?.timeoutMs },
    { source: "stage", value: stageConfig.timeoutMs },
    { source: "contract", value: contractConfig.timeoutMs },
    { source: "executor-default", value: executorDefaults.timeoutMs },
  ]);

  const terminateGraceMs = chooseWithProvenance<number>([
    { source: "caller", value: callerPolicy?.terminateGraceMs },
    { source: "invocation", value: undefined },
    { source: "perspective", value: perspectivePolicy?.terminateGraceMs },
    { source: "stage", value: stageConfig.terminateGraceMs },
    { source: "contract", value: contractConfig.terminateGraceMs },
    { source: "executor-default", value: executorDefaults.terminateGraceMs },
    { source: "runtime-default", value: defaultLifecycle.terminateGraceMs },
  ]);

  const maxConcurrency = chooseWithProvenance<number>([
    { source: "caller", value: callerPolicy?.maxConcurrency },
    { source: "invocation", value: undefined },
    { source: "perspective", value: perspectivePolicy?.maxConcurrency },
    { source: "stage", value: stageConfig.maxConcurrency },
    { source: "contract", value: contractConfig.maxConcurrency },
    { source: "executor-default", value: executorDefaults.maxConcurrency },
  ]);

  return {
    modelPolicy: {
      primary: preferredModel.value,
      fallback: roleDefaults?.fallbackModels ?? executorModelPolicy.fallbackModels,
      thinking: preferredThinking.value,
    },
    runtimePolicy: {
      ...callerPolicy,
      mode: mode.value ?? "single",
      completionPolicy: completionPolicy.value ?? "process-exit",
      idleTimeoutMs: idleTimeoutMs.value,
      timeoutMs: timeoutMs.value,
      terminateGraceMs: terminateGraceMs.value,
      maxConcurrency: maxConcurrency.value,
      sandboxCleanupPolicy: callerPolicy?.sandboxCleanupPolicy ?? executorDefaults.sandboxCleanupPolicy,
      preserveSandboxOnFailure: callerPolicy?.preserveSandboxOnFailure ?? executorDefaults.preserveSandboxOnFailure,
    },
    policyProvenance: {
      preferredModel: preferredModel.source,
      preferredThinking: preferredThinking.source,
      mode: mode.source,
      completionPolicy: completionPolicy.source,
      idleTimeoutMs: idleTimeoutMs.source,
      timeoutMs: timeoutMs.source,
      terminateGraceMs: terminateGraceMs.source,
      maxConcurrency: maxConcurrency.source,
    } satisfies ExecutorPolicyProvenance,
  };
}

export function assembleExecutorContext(invocation: ExecutorInvocation, options: ExecutorAssemblyOptions): ResolvedExecutorRunContext {
  const perspective: ExecutorPerspectiveSpec = {
    name: invocation.executorType || invocation.stage,
    role: invocation.hints?.preferredRole,
    task: invocation.task.description,
    memory: invocation.inputs.map(toMemoryRef),
    constraints: [...invocation.constraints],
  };

  const resolved = resolveExecutorPolicies(invocation, perspective, options);

  return {
    runId: options.runId,
    invocation,
    role: invocation.hints?.preferredRole,
    memory: invocation.inputs.map(toMemoryRef),
    skills: [],
    extensions: [],
    modelPolicy: resolved.modelPolicy,
    outputPolicy: {
      format: "markdown",
      instructions: [...invocation.expectedOutput.checklist],
    },
    runtimePolicy: resolved.runtimePolicy,
    workspace: {
      projectRoot: invocation.project.cwd,
    },
    perspectives: [perspective],
    policyProvenance: resolved.policyProvenance,
  };
}

export { getExecutorTimeoutHeuristicsConfig };
