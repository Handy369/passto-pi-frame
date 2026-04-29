import type { ExecutorInvocation } from "./invocation.ts";
import type { TaskDocThinking } from "./task-doc.ts";

export interface ExecutorMemoryRef {
  kind: "file" | "doc" | "note" | "inline";
  path?: string;
  content?: string;
  label?: string;
  required?: boolean;
}

export interface ExecutorModelPolicy {
  primary?: string;
  fallback?: string[];
  preset?: string;
  thinking?: TaskDocThinking;
}

export interface ExecutorOutputPolicy {
  format?: "text" | "markdown" | "json" | "mixed";
  schemaName?: string;
  instructions?: string[];
  requiredArtifacts?: string[];
}

export interface ExecutorRuntimePolicy {
  mode: "single" | "parallel" | "sequential" | "dag";
  maxConcurrency?: number;
  completionPolicy?: "agent-end" | "process-exit";
  idleTimeoutMs?: number;
  timeoutMs?: number;
  terminateGraceMs?: number;
  preserveSandboxOnFailure?: boolean;
  sandboxCleanupPolicy?: "always" | "on-success" | "on-failure" | "never";
}

export interface ExecutorPerspectiveSpec {
  name: string;
  agent?: string;
  role?: string;
  task: string;
  skills?: string[];
  extensions?: string[];
  memory?: ExecutorMemoryRef[];
  constraints?: string[];
  dependsOn?: string[];
  contract?: {
    name: string;
    config?: Record<string, unknown>;
  };
  runtimeOptions?: Partial<ExecutorRuntimePolicy>;
}

export interface ResolvedExecutorRunContext {
  runId: string;
  invocation: ExecutorInvocation;
  role?: string;
  memory: ExecutorMemoryRef[];
  skills: string[];
  extensions: string[];
  modelPolicy: ExecutorModelPolicy;
  outputPolicy: ExecutorOutputPolicy;
  runtimePolicy: ExecutorRuntimePolicy;
  workspace: {
    projectRoot: string;
    sandboxRoot?: string;
    baseRef?: string;
  };
  contract?: {
    name: string;
    config?: Record<string, unknown>;
  };
  perspectives: ExecutorPerspectiveSpec[];
}
