export interface SandboxMetadata {
  runId: string;
  perspective: string;
  projectRoot: string;
  strategy: string;
  sandboxRoot: string;
  sandboxBase?: string;
  repoRoot?: string;
  worktreeRoot?: string;
  sourceRef?: string;
  createdAt: string;
  cleanupPolicy: SandboxCleanupPolicy;
  preserveOnFailure?: boolean;
}

export type SandboxCleanupPolicy = "always" | "on-success" | "on-failure" | "never";

export interface SandboxHandle {
  perspective: string;
  root: string;
  metadata: SandboxMetadata;
  cleanup(result?: { success: boolean }): Promise<void>;
}

export interface SandboxCreateParams {
  runId: string;
  perspective: string;
  projectRoot: string;
  preserveOnFailure?: boolean;
  cleanupPolicy?: SandboxCleanupPolicy;
  strategy?: string;
}

export interface SandboxManager {
  createPerspectiveSandbox(params: SandboxCreateParams): Promise<SandboxHandle>;
}

export class NoopSandboxManager implements SandboxManager {
  async createPerspectiveSandbox(params: SandboxCreateParams): Promise<SandboxHandle> {
    const cleanupPolicy = params.cleanupPolicy ?? "always";
    return {
      perspective: params.perspective,
      root: params.projectRoot,
      metadata: {
        runId: params.runId,
        perspective: params.perspective,
        projectRoot: params.projectRoot,
        strategy: "noop",
        sandboxRoot: params.projectRoot,
        createdAt: new Date().toISOString(),
        cleanupPolicy,
        preserveOnFailure: params.preserveOnFailure,
      },
      async cleanup(): Promise<void> {
        return;
      },
    };
  }
}
