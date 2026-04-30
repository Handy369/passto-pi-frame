import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export { taskDocToInvocation, type ExecutorInvocation } from "./executor-core/invocation.ts";
export { assembleExecutorContext } from "./executor-core/assembly.ts";
export { executeInvocation } from "./executor-core/execute.ts";
export { executeTaskDoc } from "./executor-core/task-entry.ts";
export {
  getExecutorStagesDir,
  listExecutorStageRegistry,
  listExecutorStageNames,
  isKnownExecutorStage,
  getExecutorStageDocPath,
} from "./executor-core/stage-registry.ts";
export type { ResolvedExecutorRunContext, ExecutorRuntimePolicy } from "./executor-core/context.ts";
export type { ExecutorRunResult } from "./executor-core/result.ts";
export type { SandboxCleanupPolicy } from "./executor-core/sandbox.ts";
export {
  legacyRequestToInvocation,
  legacyRequestToRuntimePolicy,
  legacyRequestToExecuteOptions,
  executeLegacyRequest,
  type LegacySubagentLikeRequest,
  type LegacyExecuteRequestOptions,
} from "./compatibility/index.ts";

export default function (_pi: ExtensionAPI) {
  // Internal-only extension: passto-executor currently exposes a code API surface
  // for sibling extensions but does not register command/tool surfaces for Pi.
}
