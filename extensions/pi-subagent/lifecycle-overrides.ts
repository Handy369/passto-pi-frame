import { getContractLifecycleConfig } from "../../lib/passto-agent-runtime/config.ts";

export function resolveLifecycleOverrides(
  executionContract: string | undefined,
  overrides: {
    completionPolicy?: string;
    idleTimeoutMs?: number;
    terminateGraceMs?: number;
  },
) {
  const runtimeDefaults = getContractLifecycleConfig(executionContract);
  return {
    completionPolicy:
      overrides.completionPolicy === "agent-end" || overrides.completionPolicy === "process-exit"
        ? overrides.completionPolicy
        : runtimeDefaults.completionPolicy,
    idleTimeoutMs: overrides.idleTimeoutMs ?? runtimeDefaults.idleTimeoutMs,
    terminateGraceMs: overrides.terminateGraceMs ?? runtimeDefaults.terminateGraceMs,
  };
}
