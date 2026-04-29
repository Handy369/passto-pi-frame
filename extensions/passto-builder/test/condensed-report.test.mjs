import test from "node:test";
import assert from "node:assert/strict";
import { formatBuilderBootstrapReportText } from "../builder/provenance.ts";

test("formatBuilderBootstrapReportText returns condensed bootstrap report text", () => {
  const text = formatBuilderBootstrapReportText({
    finalStatus: "success",
    resultSummary: "Builder completed",
    producedArtifacts: [
      { type: "executor-bridge-request", runId: "builder-12" },
      { type: "workspace-note", path: "/tmp/project/note.md" },
    ],
    artifactSummary: {
      total: 2,
      byType: { "executor-bridge-request": 1, "workspace-note": 1 },
      executorBridgeRunId: "builder-12",
      primaryWorkspacePath: "/tmp/project/note.md",
    },
    remainingWork: [],
    handoffNote: "done",
    verificationSummary: "Verified workspace note exists",
    primaryRunId: "builder-12",
    bootstrapReport: {
      title: "demo",
      finalStatus: "success",
      summary: "Builder completed",
      primaryRunId: "builder-12",
      artifactSummary: {
        total: 2,
        byType: { "executor-bridge-request": 1, "workspace-note": 1 },
        executorBridgeRunId: "builder-12",
        primaryWorkspacePath: "/tmp/project/note.md",
      },
      handoffNote: "done",
      remainingWork: [],
    },
    executorContext: {
      executorType: "passto-builder",
      executionEngine: "ralph-loop",
      projectName: "passto-ai-frame",
      cwd: "/tmp/project",
    },
  });

  assert.match(text, /BOOTSTRAP REPORT/);
  assert.match(text, /title: demo/);
  assert.match(text, /final status: success/);
  assert.match(text, /primary run id: builder-12/);
});
