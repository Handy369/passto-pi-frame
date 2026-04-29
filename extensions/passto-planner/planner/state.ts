// Phase 1A: Minimal planner state shape and factory.

import type { PlannerNormalizedInput, PlannerState, PlannerRunId, PlannerTaskId } from "./contracts.ts";

export interface PlannerRunState extends PlannerState {}

export function createInitialPlannerState(
  runId: PlannerRunId,
  taskId: PlannerTaskId,
  input: PlannerNormalizedInput,
  options: {
    sessionId?: string;
    planningDir?: string;
    currentStep?: number;
    totalSteps?: number;
  } = {},
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
    sessionId: options.sessionId,
    planningDir: options.planningDir,
    currentStep: options.currentStep,
    totalSteps: options.totalSteps,
    history: options.currentStep
      ? [{ step: options.currentStep, at: new Date().toISOString(), action: "start" }]
      : [],
  };
}
