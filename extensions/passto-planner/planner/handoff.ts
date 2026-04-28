// Phase 1A: Minimal planner handoff shape and factory.

import type { PlannerHandoff, PlannerArtifactRef, PlannerRunId } from "./contracts.ts";

export function createPlannerHandoff(params: {
  from: string;
  to: string;
  runId: PlannerRunId;
  resultSummary: string;
  artifacts?: PlannerArtifactRef[];
  nextSteps?: string[];
  metadata?: Record<string, unknown>;
}): PlannerHandoff {
  return {
    from: params.from,
    to: params.to,
    runId: params.runId,
    resultSummary: params.resultSummary,
    artifacts: params.artifacts ?? [],
    nextSteps: params.nextSteps ?? [],
    metadata: params.metadata,
  };
}
