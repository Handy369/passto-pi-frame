import type { BuilderArtifactRef, BuilderArtifactSummary, BuilderResult } from "./contracts.ts";

export function summarizeBuilderArtifacts(artifacts: BuilderArtifactRef[]): BuilderArtifactSummary {
  const byType: Record<string, number> = {};
  for (const artifact of artifacts) {
    byType[artifact.type] = (byType[artifact.type] ?? 0) + 1;
  }

  const primaryWorkspacePath = artifacts.find((artifact) => artifact.type === "workspace-note")?.path;
  const executorBridgeRunId = artifacts.find((artifact) => artifact.type === "executor-bridge-request")?.runId;

  return {
    total: artifacts.length,
    byType,
    primaryWorkspacePath,
    executorBridgeRunId,
  };
}

export function createBuilderManualSummary(result: BuilderResult) {
  return {
    finalStatus: result.finalStatus,
    summary: result.resultSummary,
    primaryRunId: result.primaryRunId,
    executorContext: result.executorContext,
    artifactSummary: result.artifactSummary ?? summarizeBuilderArtifacts(result.producedArtifacts),
    verificationSummary: result.verificationSummary,
    verificationReport: result.verificationReport,
    handoffNote: result.handoffNote,
    remainingWork: result.remainingWork,
    bootstrapReport: result.bootstrapReport,
  };
}

export function formatBuilderHandoffText(result: BuilderResult): string {
  const summary = createBuilderManualSummary(result);
  const lines = [
    `final status: ${summary.finalStatus}`,
    `summary: ${summary.summary}`,
    `primary run id: ${summary.primaryRunId ?? "(none)"}`,
    `executor: ${summary.executorContext?.executorType ?? "(unknown)"}`,
    `execution engine: ${summary.executorContext?.executionEngine ?? "(unknown)"}`,
    `project: ${summary.executorContext?.projectName ?? "(unknown)"}`,
    `cwd: ${summary.executorContext?.cwd ?? "(unknown)"}`,
    `artifact total: ${summary.artifactSummary.total}`,
    `primary workspace path: ${summary.artifactSummary.primaryWorkspacePath ?? "(none)"}`,
    `executor bridge run id: ${summary.artifactSummary.executorBridgeRunId ?? "(none)"}`,
    `handoff note: ${summary.handoffNote}`,
  ];

  if (summary.verificationSummary) {
    lines.push(`verification: ${summary.verificationSummary}`);
  }
  if (summary.verificationReport?.verifiedArtifactType) {
    lines.push(`verified artifact type: ${summary.verificationReport.verifiedArtifactType}`);
  }
  if (summary.verificationReport?.verifiedPath) {
    lines.push(`verified path: ${summary.verificationReport.verifiedPath}`);
  }

  if (summary.remainingWork.length > 0) {
    lines.push(`remaining work: ${summary.remainingWork.join("; ")}`);
  }

  return lines.join("\n");
}

export function formatBuilderBootstrapReportText(result: BuilderResult): string {
  const summary = createBuilderManualSummary(result);
  const report = summary.bootstrapReport;
  const lines = [
    "BOOTSTRAP REPORT",
    `title: ${report?.title ?? "(untitled)"}`,
    `final status: ${summary.finalStatus}`,
    `summary: ${summary.summary}`,
    `primary run id: ${summary.primaryRunId ?? "(none)"}`,
    `artifact total: ${summary.artifactSummary.total}`,
    `primary workspace path: ${summary.artifactSummary.primaryWorkspacePath ?? "(none)"}`,
  ];

  if (summary.verificationSummary) {
    lines.push(`verification: ${summary.verificationSummary}`);
  }
  if (summary.verificationReport?.verifiedPath) {
    lines.push(`verified path: ${summary.verificationReport.verifiedPath}`);
  }

  lines.push(`handoff note: ${summary.handoffNote}`);

  if (summary.remainingWork.length > 0) {
    lines.push(`remaining work: ${summary.remainingWork.join("; ")}`);
  }

  return lines.join("\n");
}
