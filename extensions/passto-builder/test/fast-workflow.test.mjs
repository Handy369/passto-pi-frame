import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBuilderInput } from "../builder/input.ts";
import { createInitialBuilderState } from "../builder/state.ts";
import { runBuilderWorkflow } from "../builder/workflow.ts";

test("runBuilderWorkflow supports lightweight seams for faster workflow-level tests", async () => {
  const input = normalizeBuilderInput({
    goal: "fast seam demo",
    task: "write seam note",
    cwd: "/tmp/fast-workflow",
    expectedOutputs: ["seam-note.md"],
  });

  const state = createInitialBuilderState(input);
  const finalState = await runBuilderWorkflow(state, undefined, {
    bridgeRequestFactory: () => ({
      runId: "bridge-fast-1",
      agent: "default",
      metadata: {
        executorType: "passto-builder",
        projectName: "passto-ai-frame",
        cwd: input.cwd,
        executionEngine: "ralph-loop",
      },
      invocation: {
        sourceTaskDocPath: "builder:bridge-fast-1",
        project: { name: "passto-ai-frame", cwd: input.cwd },
        stage: "builder",
        task: { description: input.task },
        expectedOutput: { todolist: input.expectedOutputs, checklist: [] },
        constraints: [],
        inputs: [],
      },
    }),
    executorInvoker: async () => ({
      runId: "bridge-fast-1",
      status: "completed",
      summaryText: "fast seam executor result",
      perspectiveResults: [],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
      events: [],
    }),
    workspaceNoteWriter: async () => ({
      type: "workspace-note",
      path: "/tmp/fast-workflow/builder-output/implementation-note.md",
      summary: "fake note writer used",
      metadata: { relativePath: "builder-output/implementation-note.md" },
    }),
  });

  assert.equal(finalState.status, "completed");
  assert.ok(finalState.artifacts.some((item) => item.type === "workspace-note"));
  assert.ok(finalState.artifacts.some((item) => item.runId === "bridge-fast-1"));
});
