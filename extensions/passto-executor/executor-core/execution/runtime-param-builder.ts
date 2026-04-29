import { getContractLifecycleConfig } from "../../../../lib/passto-agent-runtime/config.ts";
import type { ResolvedExecutorRunContext, ExecutorPerspectiveSpec } from "../context.ts";
import type { RunExecutorChildParams } from "../runtime.ts";

export interface BuildRunExecutorChildParamsInput {
  context: ResolvedExecutorRunContext;
  perspective: ExecutorPerspectiveSpec;
  defaultAgent: string;
  defaultExtensions?: string[];
  cwd: string;
  contract?: string;
}

export function buildRunExecutorChildParams(input: BuildRunExecutorChildParamsInput): RunExecutorChildParams {
  const perspectivePolicy = input.perspective.runtimeOptions;
  const contractName = input.contract ?? input.perspective.contract?.name ?? input.context.contract?.name;
  const contractLifecycle = getContractLifecycleConfig(contractName);

  return {
    agent: input.perspective.agent ?? (contractName === "ralph-loop" ? "ralph-executor" : input.defaultAgent),
    prompt: input.perspective.task,
    cwd: input.cwd,
    extensions: input.perspective.extensions ?? input.defaultExtensions,
    executionPolicy: {
      completionPolicy: contractLifecycle.completionPolicy ?? "process-exit",
      idleTimeoutMs: perspectivePolicy?.idleTimeoutMs
        ?? input.context.runtimePolicy.idleTimeoutMs
        ?? contractLifecycle.idleTimeoutMs,
      timeoutMs: perspectivePolicy?.timeoutMs ?? input.context.runtimePolicy.timeoutMs,
      terminateGraceMs: perspectivePolicy?.terminateGraceMs
        ?? input.context.runtimePolicy.terminateGraceMs
        ?? contractLifecycle.terminateGraceMs,
    },
  };
}
