import type { BuilderInput } from "../builder/contracts.ts";
import {
  createBuilderManualSummary,
  formatBuilderBootstrapReportText,
  formatBuilderHandoffText,
} from "../builder/provenance.ts";
import { runBuilder } from "../builder/runner.ts";

export async function runBuilderTask(input: BuilderInput) {
  return runBuilder({
    ...input,
    invocationSource: input.invocationSource ?? "direct-tool",
  });
}

export function formatBuilderToolResult(result: Awaited<ReturnType<typeof runBuilder>>) {
  return {
    result: result.result,
    bootstrapReport: result.result.bootstrapReport,
    bootstrapReportText: formatBuilderBootstrapReportText(result.result),
    manualSummary: createBuilderManualSummary(result.result),
    handoffText: formatBuilderHandoffText(result.result),
    snapshots: result.snapshots,
  };
}
