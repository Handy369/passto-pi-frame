// Phase 1B.1: run-planner-task tool entry point.
// Routes through the planner workflow layer (workflow.ts).
// Preserves the existing PlannerTaskResponse shape for external callers.

import type { PlannerRawInput, PlannerResult } from "../planner/contracts.ts";
import { normalizePlannerInput } from "../planner/input.ts";
import { createPlannerHandoff } from "../planner/handoff.ts";
import { runPlannerWorkflow } from "../planner/workflow.ts";

export type PlannerTaskResponse = {
  result: PlannerResult;
  handoff: ReturnType<typeof createPlannerHandoff>;
};

export async function runPlannerTask(input: PlannerRawInput): Promise<PlannerTaskResponse> {
  const normalized = normalizePlannerInput(input);
  const workflowOutput = await runPlannerWorkflow(normalized);

  // Re-wrap into the existing PlannerTaskResponse shape.
  return {
    result: workflowOutput.result,
    handoff: workflowOutput.handoff,
  };
}
