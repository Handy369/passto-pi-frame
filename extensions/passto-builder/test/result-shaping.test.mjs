import test from "node:test";
import assert from "node:assert/strict";
import { toBuilderResult } from "../builder/result.ts";

test("toBuilderResult includes artifact summary and executor context linkage", () => {
  const result = toBuilderResult({
    input: {
      goal: "demo",
      task: "write note",
      cwd: "/tmp/project",
      expectedOutputs: ["note.md"],
      checklist: [],
      executionEngine: "ralph-loop",
    },
    phase: "summarize",
    status: "completed",
    currentAction: "Summarizing",
    todoList: ["Produce output: note.md"],
    checklist: [],
    completedItems: ["execute", "verify", "workspace-note"],
    artifacts: [
      {
        type: "executor-bridge-request",
        runId: "builder-9",
        metadata: {
          executorType: "passto-builder",
          executionEngine: "ralph-loop",
          projectName: "passto-ai-frame",
          cwd: "/tmp/project",
        },
      },
      {
        type: "workspace-note",
        path: "/tmp/project/builder-output/implementation-note.md",
        runId: "builder-9",
        metadata: {
          executorType: "passto-builder",
          executionEngine: "ralph-loop",
          projectName: "passto-ai-frame",
          cwd: "/tmp/project",
        },
      },
    ],
    blockers: [],
    needsAttention: false,
    summary: "Builder completed initial workflow path",
  });

  assert.equal(result.primaryRunId, "builder-9");
  assert.equal(result.executorContext?.executorType, "passto-builder");
  assert.equal(result.artifactSummary?.executorBridgeRunId, "builder-9");
  assert.equal(result.artifactSummary?.primaryWorkspacePath, "/tmp/project/builder-output/implementation-note.md");
  assert.ok(result.bootstrapReport);
  assert.equal(result.bootstrapReport?.title, "demo");
});
