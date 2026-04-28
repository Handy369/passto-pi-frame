// Phase 1B.2: Minimal planner runner boundary.
// Owns raw-input entry concerns (normalization, run boundary shaping)
// and delegates workflow phase progression to workflow.ts.

import type { PlannerRawInput, PlannerResult } from "./contracts.ts";
import { normalizePlannerInput } from "./input.ts";
import { runPlannerWorkflow } from "./workflow.ts";
import { createPlannerHandoff } from "./handoff.ts";

export type PlannerRunnerOutput = {
  result: PlannerResult;
  handoff: ReturnType<typeof createPlannerHandoff>;
  runId: string;
};

/**
 * Minimal planner runner entry point.
 *
 * Takes raw planner input, normalizes it, and delegates to the workflow layer.
 * This is the thin boundary between the tool entry path and the planner workflow.
 */
export async function runPlannerRunner(input: PlannerRawInput): Promise<PlannerRunnerOutput> {
  const normalized = normalizePlannerInput(input);
  const workflowOutput = await runPlannerWorkflow(normalized);

  return {
    result: workflowOutput.result,
    handoff: workflowOutput.handoff,
    runId: workflowOutput.runId,
  };
}
