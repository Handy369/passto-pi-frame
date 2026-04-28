// Phase 1A: Minimal planner state shape and factory.

import type { PlannerNormalizedInput, PlannerState, PlannerArtifactRef, PlannerRunId, PlannerTaskId } from "./contracts.ts";

export interface PlannerRunState extends PlannerState {}

export function createInitialPlannerState(
  runId: PlannerRunId,
  taskId: PlannerTaskId,
  input: PlannerNormalizedInput,
): PlannerRunState {
  return {
    runId,
    taskId,
    phase: "intake",
    input,
    artifacts: [],
    completedSteps: [],
    summary: "Planner state initialized",
    status: "running",
  };
}
