// Phase 1B.3: Minimal nested-execution seam.
// Defines future-facing request/result contracts without invoking real nested orchestration.

export type NestedExecutionStrategy = "placeholder" | "subagent" | "executor";
export type NestedExecutionStatus = "inactive" | "ready" | "running" | "completed" | "failed";

export interface NestedExecutionRequest {
  runId: string;
  goal: string;
  phase: string;
  strategy: NestedExecutionStrategy;
  metadata?: Record<string, unknown>;
}

export interface NestedExecutionResult {
  active: boolean;
  status: NestedExecutionStatus;
  strategy: NestedExecutionStrategy;
  summary: string;
  nextAction?: string;
  metadata?: Record<string, unknown>;
}

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

export async function runNestedPlannerExecution(
  request: NestedExecutionRequest,
): Promise<NestedExecutionResult> {
  return {
    active: false,
    status: "inactive",
    strategy: request.strategy,
    summary: "Nested execution seam is defined but not active in Phase 1B.3.",
    nextAction: "Implement real nested orchestration in a later phase.",
    metadata: {
      runId: request.runId,
      phase: request.phase,
      goal: request.goal,
      placeholder: true,
      ...(request.metadata ?? {}),
    },
  };
}
