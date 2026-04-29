import type { BuilderInput } from "../builder/contracts.ts";
import {
  createBuilderManualSummary,
  formatBuilderBootstrapReportText,
  formatBuilderHandoffText,
} from "../builder/provenance.ts";
import { runBuilder } from "../builder/runner.ts";

export async function runBuilderCommand(input: BuilderInput) {
  return runBuilder(input);
}

export function formatBuilderCommandResult(result: Awaited<ReturnType<typeof runBuilder>>) {
  return {
    finalStatus: result.result.finalStatus,
    summary: result.result.resultSummary,
    primaryRunId: result.result.primaryRunId,
    executorContext: result.result.executorContext,
    bootstrapReport: result.result.bootstrapReport,
    artifactSummary: createBuilderManualSummary(result.result).artifactSummary,
    artifactCount: result.result.producedArtifacts.length,
    bootstrapReportText: formatBuilderBootstrapReportText(result.result),
    handoffText: formatBuilderHandoffText(result.result),
    snapshots: result.snapshots.map((snapshot) => ({
      phase: snapshot.phase,
      status: snapshot.status,
      summary: snapshot.summary,
    })),
  };
}
