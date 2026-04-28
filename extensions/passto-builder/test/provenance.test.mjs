import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBuilderArtifacts, createBuilderManualSummary, formatBuilderHandoffText } from "../builder/provenance.ts";

test("summarizeBuilderArtifacts groups artifacts and finds primary links", () => {
  const summary = summarizeBuilderArtifacts([
    { type: "executor-bridge-request", runId: "builder-1" },
    { type: "workspace-note", path: "/tmp/project/note.md" },
    { type: "builder-summary", summary: "done" },
    { type: "workspace-note", path: "/tmp/project/note-2.md" },
  ]);

  assert.equal(summary.total, 4);
  assert.equal(summary.byType["workspace-note"], 2);
  assert.equal(summary.executorBridgeRunId, "builder-1");
  assert.equal(summary.primaryWorkspacePath, "/tmp/project/note.md");
});

test("createBuilderManualSummary produces frame-usable summary shape", () => {
  const source = {
    finalStatus: "success",
    resultSummary: "Builder completed",
    producedArtifacts: [
      { type: "executor-bridge-request", runId: "builder-2" },
      { type: "workspace-note", path: "/tmp/project/note.md" },
    ],
    artifactSummary: {
      total: 2,
      byType: { "executor-bridge-request": 1, "workspace-note": 1 },
      executorBridgeRunId: "builder-2",
      primaryWorkspacePath: "/tmp/project/note.md",
    },
    remainingWork: [],
    handoffNote: "done",
    verificationSummary: "Verified workspace note exists",
    primaryRunId: "builder-2",
    bootstrapReport: {
      title: "demo",
      finalStatus: "success",
      summary: "Builder completed",
      primaryRunId: "builder-2",
      artifactSummary: {
        total: 2,
        byType: { "executor-bridge-request": 1, "workspace-note": 1 },
        executorBridgeRunId: "builder-2",
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
  };
  const summary = createBuilderManualSummary(source);

  assert.equal(summary.finalStatus, "success");
  assert.equal(summary.primaryRunId, "builder-2");
  assert.equal(summary.artifactSummary.executorBridgeRunId, "builder-2");
  assert.equal(summary.artifactSummary.primaryWorkspacePath, "/tmp/project/note.md");
  assert.ok(summary.bootstrapReport);

  const handoffText = formatBuilderHandoffText(source);
  assert.match(handoffText, /final status: success/);
  assert.match(handoffText, /primary run id: builder-2/);
  assert.match(handoffText, /executor: passto-builder/);
  assert.match(handoffText, /primary workspace path: \/tmp\/project\/note.md/);
});
