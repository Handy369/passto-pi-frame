import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeBuilderInput } from "../builder/input.ts";
import { createInitialBuilderState } from "../builder/state.ts";
import { runBuilderWorkflow } from "../builder/workflow.ts";

test("runBuilderWorkflow completes the initial executor-backed path", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "passto-builder-workflow-"));
  const input = normalizeBuilderInput({
    goal: "demo",
    task: "write note",
    cwd,
    expectedOutputs: ["note.md"],
  });

  const snapshots = [];
  const finalState = await runBuilderWorkflow(createInitialBuilderState(input), (state) => {
    snapshots.push({ phase: state.phase, status: state.status, currentAction: state.currentAction });
  });
  assert.equal(finalState.phase, "summarize");
  assert.equal(finalState.status, "completed");
  assert.ok(finalState.artifacts.length >= 3);
  assert.ok(finalState.completedItems.includes("execute"));
  assert.ok(finalState.completedItems.includes("verify"));
  assert.ok(finalState.completedItems.includes("workspace-note"));
  assert.ok(snapshots.length >= 5);
});
