// Phase 1A: Minimal planner result shape and factory.

import type { PlannerResult, PlannerArtifactRef } from "./contracts.ts";

export interface PlannerRunResult extends PlannerResult {}

export function toPlannerResult(params: {
  finalStatus: PlannerResult["finalStatus"];
  resultSummary: string;
  producedArtifacts?: PlannerArtifactRef[];
  remainingWork?: string[];
  handoffNote?: string;
  failureReason?: string;
  primaryRunId?: string;
}): PlannerRunResult {
  return {
    finalStatus: params.finalStatus,
    resultSummary: params.resultSummary,
    producedArtifacts: params.producedArtifacts ?? [],
    remainingWork: params.remainingWork ?? [],
    handoffNote: params.handoffNote ?? "",
    failureReason: params.failureReason,
    primaryRunId: params.primaryRunId,
  };
}
