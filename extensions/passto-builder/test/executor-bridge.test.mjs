import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBuilderInput } from "../builder/input.ts";
import { buildExecutorBridgeRequest } from "../executor-bridge/passto-executor-bridge.ts";

test("buildExecutorBridgeRequest maps builder input into executor invocation", () => {
  const input = normalizeBuilderInput({
    goal: "demo",
    task: "write a note",
    cwd: "/tmp/project",
    expectedOutputs: ["note.md"],
    checklist: [{ id: "c1", text: "write note" }],
  });

  const request = buildExecutorBridgeRequest(input);
  assert.equal(request.invocation.executorType, "passto-builder");
  assert.equal(request.invocation.project.cwd, "/tmp/project");
  assert.deepEqual(request.invocation.expectedOutput.todolist, ["note.md"]);
  assert.deepEqual(request.invocation.expectedOutput.checklist, ["write note"]);
  assert.equal(request.metadata.executorType, "passto-builder");
  assert.equal(request.metadata.projectName, "passto-ai-frame");
  assert.equal(request.metadata.executionEngine, "ralph-loop");
});
