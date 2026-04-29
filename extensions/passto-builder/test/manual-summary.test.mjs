import test from "node:test";
import assert from "node:assert/strict";
import { createBuilderManualSummary } from "../builder/provenance.ts";

test("createBuilderManualSummary carries verification summary and bootstrap report", () => {
  const summary = createBuilderManualSummary({
    finalStatus: "success",
    resultSummary: "Builder completed",
    producedArtifacts: [
      { type: "executor-bridge-request", runId: "builder-13" },
      { type: "workspace-note", path: "/tmp/project/note.md" },
      { type: "verification-summary", summary: "Verified workspace note exists at /tmp/project/note.md" },
    ],
    artifactSummary: {
      total: 3,
      byType: { "executor-bridge-request": 1, "workspace-note": 1, "verification-summary": 1 },
      executorBridgeRunId: "builder-13",
      primaryWorkspacePath: "/tmp/project/note.md",
    },
    remainingWork: [],
    handoffNote: "done",
    verificationSummary: "Verified workspace note exists at /tmp/project/note.md",
    primaryRunId: "builder-13",
    bootstrapReport: {
      title: "verify demo",
      finalStatus: "success",
      summary: "Builder completed",
      primaryRunId: "builder-13",
      artifactSummary: {
        total: 3,
        byType: { "executor-bridge-request": 1, "workspace-note": 1, "verification-summary": 1 },
        executorBridgeRunId: "builder-13",
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

  assert.equal(summary.verificationSummary, "Verified workspace note exists at /tmp/project/note.md");
  assert.ok(summary.bootstrapReport);
  assert.equal(summary.bootstrapReport?.title, "verify demo");
});
