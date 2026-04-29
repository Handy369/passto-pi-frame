// Phase 1B.3 (Step 4): Minimal nested-execution seam extended for real research tasks.
// Defines request/result contracts with task-level granularity for planner sub-tasks.

// ── Task Kinds ──────────────────────────────────────────────────────

export type NestedTaskKind = "research-environment" | "research-web" | "research-codebase";

// ── Task Spec ───────────────────────────────────────────────────────

export interface NestedTaskSpec {
  id: string;
  kind: NestedTaskKind;
  title: string;
  prompt: string;
  metadata?: Record<string, unknown>;
}

// ── Task Result ─────────────────────────────────────────────────────

export interface NestedTaskResult {
  id: string;
  kind: NestedTaskKind;
  status: "success" | "failed" | "partial";
  summary: string;
  outputText: string;
  failureReason?: string;
  metadata?: Record<string, unknown>;
}

// ── Strategy / Status Types ─────────────────────────────────────────

export type NestedExecutionStrategy = "placeholder" | "subagent" | "executor";
export type NestedExecutionStatus = "inactive" | "ready" | "running" | "completed" | "failed";

// ── Request / Result ────────────────────────────────────────────────

export interface NestedExecutionRequest {
  runId: string;
  goal: string;
  phase: string;
  strategy: NestedExecutionStrategy;
  tasks?: NestedTaskSpec[];
  maxConcurrency?: number;
  metadata?: Record<string, unknown>;
}

export interface NestedExecutionResult {
  active: boolean;
  status: NestedExecutionStatus;
  strategy: NestedExecutionStrategy;
  summary: string;
  taskResults?: NestedTaskResult[];
  nextAction?: string;
  metadata?: Record<string, unknown>;
}

// ── Placeholder Helpers ─────────────────────────────────────────────

export function createNestedExecutionPlaceholderRequest(params: {
  runId: string;
  goal: string;
  phase: string;
  metadata?: Record<string, unknown>;
}): NestedExecutionRequest {
  return {
    runId: params.runId,
    goal: params.goal,
    phase: params.phase,
    strategy: "placeholder",
    metadata: params.metadata,
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────

export async function runNestedPlannerExecution(
  request: NestedExecutionRequest,
): Promise<NestedExecutionResult> {
  if (request.strategy === "subagent" && request.tasks?.length) {
    // Delegate to the real subagent runner.
    const { runSubagentTasks } = await import("./nested-execution-subagent.ts");
    return runSubagentTasks(request);
  }

  // Fallback: placeholder behavior.
  return {
    active: false,
    status: "inactive",
    strategy: request.strategy,
    summary: "Nested execution seam is defined but not active for this strategy.",
    nextAction: "Use strategy='subagent' with tasks[] to run real nested execution.",
    metadata: {
      runId: request.runId,
      phase: request.phase,
      goal: request.goal,
      placeholder: true,
      ...(request.metadata ?? {}),
    },
  };
}
