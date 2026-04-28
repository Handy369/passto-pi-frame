// Phase 1B.1: Minimal planner workflow skeleton.
// Extracts scaffold execution shaping into the workflow layer.
// This module owns phase progression and returns result + handoff data.
// It does NOT implement runner.ts or nested-execution.ts.

import type {
  PlannerNormalizedInput,
  PlannerResult,
  PlannerArtifactRef,
  PlanningPhase,
} from "./contracts.ts";
import { createInitialPlannerState } from "./state.ts";
import { toPlannerResult } from "./result.ts";
import { createPlannerHandoff } from "./handoff.ts";

export interface PlannerWorkflowOutput {
  result: PlannerResult;
  handoff: ReturnType<typeof createPlannerHandoff>;
  runId: string;
}

// Ordered macro phases for the scaffold workflow.
const SCAFFOLD_PHASES: PlanningPhase[] = ["intake", "analysis", "synthesis", "output"];

/**
 * Minimal planner workflow entry point.
 *
 * Takes normalized planner input, advances through scaffold phases,
 * and returns a PlannerWorkflowOutput containing the result and handoff.
 *
 * This is intentionally thin — it extracts the execution shaping that
 * previously lived directly in run-planner-task into a dedicated workflow layer.
 */
export async function runPlannerWorkflow(
  input: PlannerNormalizedInput,
): Promise<PlannerWorkflowOutput> {
  const runId = `planner-${Date.now()}`;
  const state = createInitialPlannerState(runId, "phase-1b-workflow", input);

  // Advance through scaffold phases.
  for (const phase of SCAFFOLD_PHASES) {
    state.phase = phase;
    state.completedSteps.push(phase);
  }

  state.status = "completed";

  const producedArtifacts: PlannerArtifactRef[] = [
    {
      type: "planner-workflow-scaffold",
      summary: "Phase 1B planner workflow skeleton executed",
    },
  ];

  const result = toPlannerResult({
    finalStatus: "success",
    resultSummary: "Phase 1B planner workflow skeleton initialized",
    producedArtifacts,
    remainingWork: [
      "Implement planner runner entry point",
      "Add nested-execution support",
      "Build planner test suite",
    ],
    handoffNote: "Phase 1B workflow skeleton complete. Ready for runner implementation.",
    primaryRunId: runId,
  });

  const handoff = createPlannerHandoff({
    from: "planner-workflow",
    to: "planner-runner",
    runId,
    resultSummary: result.resultSummary,
    artifacts: producedArtifacts,
    nextSteps: result.remainingWork,
  });

  return { result, handoff, runId };
}
