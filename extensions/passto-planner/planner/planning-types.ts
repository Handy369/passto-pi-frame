// Phase 1A: Minimal planning type definitions.
// Extends planner contracts with phase-specific shapes.

export type PlanStepStatus = "pending" | "in_progress" | "done" | "skipped" | "blocked";

export interface PlanStep {
  id: string;
  description: string;
  status: PlanStepStatus;
  output?: string;
}

export interface PlanDefinition {
  runId: string;
  steps: PlanStep[];
  phase: string;
  summary: string;
}

export interface PlanningContext {
  cwd: string;
  goal: string;
  constraints: string[];
  expectedOutputs: string[];
}

export type PlanningMode = "single" | "iterative" | "parallel";
