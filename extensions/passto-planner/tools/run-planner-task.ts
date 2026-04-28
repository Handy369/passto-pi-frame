// Phase 1A: Minimal run-planner-task tool entry point.
// Provides the entry path for planner task execution.

import type { PlannerRawInput, PlannerResult, PlannerArtifactRef } from "../planner/contracts.ts";
import { normalizePlannerInput } from "../planner/input.ts";
import { createInitialPlannerState } from "../planner/state.ts";
import { toPlannerResult } from "../planner/result.ts";
import { createPlannerHandoff } from "../planner/handoff.ts";

export type PlannerTaskResponse = {
  result: PlannerResult;
  handoff: ReturnType<typeof createPlannerHandoff>;
};

export async function runPlannerTask(input: PlannerRawInput): Promise<PlannerTaskResponse> {
  const normalized = normalizePlannerInput(input);
  const runId = `planner-${Date.now()}`;
  const state = createInitialPlannerState(runId, "phase-1a-scaffold", normalized);

  // Phase 1A: Minimal scaffold - no full execution path yet.
  // Future phases will wire workflow, runner, and nested-execution here.
  state.phase = "output";
  state.completedSteps.push("intake", "analysis", "synthesis", "output");

  const producedArtifacts: PlannerArtifactRef[] = [
    {
      type: "planner-scaffold",
      summary: "Phase 1A core planner scaffold created",
    },
  ];

  const result = toPlannerResult({
    finalStatus: "success",
    resultSummary: "Phase 1A planner scaffold initialized",
    producedArtifacts,
    remainingWork: [
      "Implement planner workflow orchestration",
      "Implement planner runner entry point",
      "Add nested-execution support",
      "Build planner test suite",
    ],
    handoffNote: "Phase 1A scaffold complete. Ready for Phase 1B workflow implementation.",
    primaryRunId: runId,
  });

  const handoff = createPlannerHandoff({
    from: "planner-scaffold",
    to: "planner-workflow",
    runId,
    resultSummary: result.resultSummary,
    artifacts: producedArtifacts,
    nextSteps: result.remainingWork,
  });

  return { result, handoff };
}
