import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatBuilderToolResult, runBuilderTask } from "../tools/run-builder-task.ts";

assert.equal(typeof formatBuilderToolResult, "function");

test.skip("runBuilderTask returns builder response with snapshots", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "passto-builder-tool-"));
  const response = await runBuilderTask({
    goal: "tool path",
    task: "write a tool-path note",
    cwd,
    expectedOutputs: ["tool-note.md"],
  });

  assert.ok(response.snapshots.length >= 6);
  assert.equal(response.result.finalStatus, "success");
  const formatted = formatBuilderToolResult(response);
  assert.equal(formatted.result.finalStatus, "success");
  assert.ok(formatted.snapshots.length >= 6);
  assert.equal(formatted.result.executorContext?.executionEngine, "ralph-loop");
});
