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
  sessionId: string;
  planningDir?: string;
};

/**
 * Minimal planner runner entry point.
 *
 * Takes raw planner input, normalizes it, and delegates to the workflow layer.
 * This is the thin boundary between the tool entry path and the planner workflow.
 */
export async function runPlannerRunner(input: PlannerRawInput): Promise<PlannerRunnerOutput> {
  const normalized = normalizePlannerInput(input);
  normalized.metadata = {
    ...normalized.metadata,
    planningDir: typeof input.metadata?.planningDir === "string" ? input.metadata.planningDir : undefined,
    target: typeof input.metadata?.target === "string" ? input.metadata.target : input.goal,
    currentStep: typeof input.metadata?.currentStep === "number" ? input.metadata.currentStep : undefined,
    totalSteps: typeof input.metadata?.totalSteps === "number" ? input.metadata.totalSteps : undefined,
  };
  const workflowOutput = await runPlannerWorkflow(normalized);

  return {
    result: workflowOutput.result,
    handoff: workflowOutput.handoff,
    runId: workflowOutput.runId,
    sessionId: workflowOutput.sessionId,
    planningDir: workflowOutput.planningDir,
  };
}
