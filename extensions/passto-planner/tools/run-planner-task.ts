// Phase 1B.2: run-planner-task tool entry point.
// Routes through the planner runner layer (runner.ts -> workflow.ts).
// Preserves the existing PlannerTaskResponse shape for external callers.

import type { PlannerRawInput, PlannerResult } from "../planner/contracts.ts";
import { runPlannerRunner } from "../planner/runner.ts";
import { createPlannerHandoff } from "../planner/handoff.ts";

export type PlannerTaskResponse = {
  result: PlannerResult;
  handoff: ReturnType<typeof createPlannerHandoff>;
  runId: string;
  sessionId: string;
  planningDir?: string;
};

export async function runPlannerTask(input: PlannerRawInput): Promise<PlannerTaskResponse> {
  const runnerOutput = await runPlannerRunner(input);

  // Re-wrap into the existing PlannerTaskResponse shape.
  return {
    result: runnerOutput.result,
    handoff: runnerOutput.handoff,
    runId: runnerOutput.runId,
    sessionId: runnerOutput.sessionId,
    planningDir: runnerOutput.planningDir,
  };
}
