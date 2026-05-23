import { deriveXNodePolicyProjection } from "./grc-x-node-policy.ts";
import { selectCurrentXNodeModel } from "./grc-x-node-model.ts";
import type { CertaintyAssessment, GRCState, UserGoalTreeDocument, XNodeModelDocument, XNodePolicyProjection } from "./types.ts";

export interface RuntimeSurfacePolicySnapshot {
  nextStepType: XNodePolicyProjection["nextStepType"];
  confidence: number;
  runtimeProof: XNodePolicyProjection["dimensions"]["runtimeProof"];
  keyGaps: string[];
  source: "x-node-policy" | "certainty-assessment";
}

export function getCurrentPolicyProjectionFromSidecars(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
): XNodePolicyProjection | null {
  const currentModel = selectCurrentXNodeModel(userGoalTree, xNodeModels);
  if (!currentModel) return null;
  return currentModel.latestPolicyProjection ?? deriveXNodePolicyProjection(currentModel);
}

export function getRuntimeSurfacePolicySnapshot(grcState: GRCState | null): RuntimeSurfacePolicySnapshot | null {
  if (!grcState) return null;

  const confirmedPolicyProjection = getCurrentPolicyProjectionFromSidecars(
    grcState.curator.lastUserGoalTree ?? null,
    grcState.curator.lastXNodeModels ?? [],
  );
  const currentPolicyProjection = grcState.curator.lastPolicyProjection ?? confirmedPolicyProjection;

  if (currentPolicyProjection) {
    return {
      nextStepType: currentPolicyProjection.nextStepType,
      confidence: currentPolicyProjection.confidence,
      runtimeProof: currentPolicyProjection.dimensions.runtimeProof,
      keyGaps: currentPolicyProjection.keyGaps,
      source: "x-node-policy",
    };
  }

  const certaintyAssessment = grcState.curator.lastCertaintyAssessment;
  if (!certaintyAssessment) return null;

  return projectFromCertaintyAssessment(certaintyAssessment);
}

function projectFromCertaintyAssessment(certaintyAssessment: CertaintyAssessment): RuntimeSurfacePolicySnapshot {
  return {
    nextStepType: certaintyAssessment.nextStepType,
    confidence: certaintyAssessment.confidence,
    runtimeProof: certaintyAssessment.dimensions.runtimeProof,
    keyGaps: certaintyAssessment.keyGaps,
    source: "certainty-assessment",
  };
}
