// Phase 1A: Minimal input normalization for passto-planner.

import type { PlannerNormalizedInput, PlannerRawInput } from "./contracts.ts";

export interface NormalizedPlannerInput extends PlannerNormalizedInput {}

export function normalizePlannerInput(raw: PlannerRawInput): NormalizedPlannerInput {
  return {
    goal: String(raw.goal ?? "").trim(),
    cwd: String(raw.cwd ?? process.cwd()).trim(),
    constraints: Array.isArray(raw.constraints) ? raw.constraints.filter((c): c is string => typeof c === "string") : [],
    expectedOutputs: Array.isArray(raw.expectedOutputs) ? raw.expectedOutputs.filter((o): o is string => typeof o === "string") : [],
    todolist: Array.isArray(raw.todolist) ? raw.todolist.filter((t): t is string => typeof t === "string") : [],
    stage: typeof raw.stage === "string" ? raw.stage : "default",
    metadata: Object.fromEntries(
      Object.entries(raw).filter(
        ([key]) => !["goal", "cwd", "constraints", "expectedOutputs", "todolist", "stage"].includes(key),
      ),
    ),
  };
}
