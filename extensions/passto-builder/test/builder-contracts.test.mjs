import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBuilderInput } from "../builder/input.ts";

test("normalizeBuilderInput requires goal, cwd, and task", () => {
  assert.throws(() => normalizeBuilderInput({ cwd: "/tmp", expectedOutputs: [] }), /goal/);
  assert.throws(() => normalizeBuilderInput({ goal: "x", expectedOutputs: [] }), /cwd/);
  assert.throws(() => normalizeBuilderInput({ goal: "x", cwd: "/tmp", expectedOutputs: [] }), /task/);
});

test("normalizeBuilderInput accepts taskPackage tasks", () => {
  const normalized = normalizeBuilderInput({
    goal: "demo",
    cwd: "/tmp/project",
    expectedOutputs: ["note"],
    taskPackage: {
      tasks: ["step one", "step two"],
    },
  });

  assert.match(normalized.task, /step one/);
  assert.equal(normalized.executionEngine, "ralph-loop");
});
