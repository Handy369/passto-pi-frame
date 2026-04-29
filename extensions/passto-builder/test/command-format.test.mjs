import test from "node:test";
import assert from "node:assert/strict";
import { formatBuilderCommandResult } from "../commands/run-builder.ts";

test("formatBuilderCommandResult exposes bootstrap report and handoff text", () => {
  const formatted = formatBuilderCommandResult({
    result: {
      finalStatus: "success",
      resultSummary: "Builder completed",
      producedArtifacts: [
        { type: "executor-bridge-request", runId: "builder-11" },
        { type: "workspace-note", path: "/tmp/project/note.md" },
      ],
      artifactSummary: {
        total: 2,
        byType: { "executor-bridge-request": 1, "workspace-note": 1 },
        executorBridgeRunId: "builder-11",
        primaryWorkspacePath: "/tmp/project/note.md",
      },
      remainingWork: [],
      handoffNote: "done",
      verificationSummary: "Verified workspace note exists",
      primaryRunId: "builder-11",
      bootstrapReport: {
        title: "demo",
        finalStatus: "success",
        summary: "Builder completed",
        primaryRunId: "builder-11",
        artifactSummary: {
          total: 2,
          byType: { "executor-bridge-request": 1, "workspace-note": 1 },
          executorBridgeRunId: "builder-11",
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
    },
    snapshots: [
      { phase: "prepare", status: "preparing", currentAction: "prep", todoList: [], checklist: [], completedItems: [], artifacts: [], blockers: [], needsAttention: false, summary: "prep" },
    ],
  });

  assert.equal(formatted.finalStatus, "success");
  assert.equal(formatted.primaryRunId, "builder-11");
  assert.ok(formatted.bootstrapReport);
  assert.match(formatted.handoffText, /primary run id: builder-11/);
  assert.match(formatted.bootstrapReportText, /BOOTSTRAP REPORT/);
});
