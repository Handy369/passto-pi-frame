import type { BuilderResult } from "./contracts.ts";
import type { BuilderRunState } from "./state.ts";
import { summarizeBuilderArtifacts } from "./provenance.ts";

export function toBuilderResult(state: BuilderRunState): BuilderResult {
  const finalStatus = state.blockers.length > 0 ? "blocked" : "success";
  const primaryArtifact = state.artifacts.find((artifact) => artifact.runId);
  const artifactSummary = summarizeBuilderArtifacts(state.artifacts);
  const verificationArtifact = state.artifacts.find((artifact) => artifact.type === "verification-summary");
  const verificationSummary = verificationArtifact?.summary;
  const remainingWork = state.todoList.filter((item) => !state.completedItems.includes(item));
  const handoffNote = state.blockers.length > 0
    ? "Builder stopped with blockers; review blockers and resume or revise task."
    : "Builder completed initial workflow path.";

  return {
    finalStatus,
    resultSummary: state.summary,
    producedArtifacts: state.artifacts,
    artifactSummary,
    remainingWork,
    handoffNote,
    verificationSummary,
    verificationReport: verificationArtifact
      ? {
          verifiedArtifactType: typeof verificationArtifact.metadata?.verifiedArtifactType === "string"
            ? verificationArtifact.metadata.verifiedArtifactType
            : undefined,
          verifiedPath: typeof verificationArtifact.metadata?.verifiedPath === "string"
            ? verificationArtifact.metadata.verifiedPath
            : undefined,
          verificationMode: "exists-check",
          summary: verificationArtifact.summary ?? "Verification completed",
        }
      : undefined,
    failureReason: state.blockers.length > 0 ? state.blockers.join("; ") : undefined,
    primaryRunId: primaryArtifact?.runId,
    bootstrapReport: {
      title: state.input.goal,
      finalStatus,
      summary: state.summary,
      primaryRunId: primaryArtifact?.runId,
      artifactSummary,
      handoffNote,
      remainingWork,
      verificationSummary,
    },
    executorContext: primaryArtifact?.metadata
      ? {
          executorType: typeof primaryArtifact.metadata.executorType === "string" ? primaryArtifact.metadata.executorType : undefined,
          executionEngine: typeof primaryArtifact.metadata.executionEngine === "string" ? primaryArtifact.metadata.executionEngine : undefined,
          projectName: typeof primaryArtifact.metadata.projectName === "string" ? primaryArtifact.metadata.projectName : undefined,
          cwd: typeof primaryArtifact.metadata.cwd === "string" ? primaryArtifact.metadata.cwd : undefined,
        }
      : undefined,
  };
}
