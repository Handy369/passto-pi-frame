import type { BuilderArtifactRef } from "./contracts.ts";
import type { BuilderRunState } from "./state.ts";
import type { BuilderExecutorBridgeRequest, BuilderExecutorInvoker } from "../executor-bridge/passto-executor-bridge.ts";

export type BuilderWorkflowServices = {
  executorInvoker?: BuilderExecutorInvoker;
  bridgeRequestFactory?: (state: BuilderRunState) => BuilderExecutorBridgeRequest;
  workspaceNoteWriter?: (params: {
    cwd: string;
    relativePath?: string;
    title: string;
    lines: string[];
  }) => Promise<BuilderArtifactRef>;
};
