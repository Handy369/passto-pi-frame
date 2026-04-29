import test from "node:test";
import assert from "node:assert/strict";
import { assertSupportedExecutionMode, planPerspectiveExecution } from "../executor-core/orchestration.ts";
import { validateExecutionDag } from "../executor-core/dag.ts";

function createContext(mode = "parallel") {
  return {
    runId: "run-advanced",
    invocation: {
      sourceTaskDocPath: "/tmp/task.md",
      project: { name: "demo", cwd: "/tmp/project" },
      stage: "builder",
      task: { description: "do work" },
      expectedOutput: { todolist: [], checklist: [] },
      constraints: [],
      inputs: [],
      mode,
    },
    memory: [],
    skills: [],
    extensions: [],
    modelPolicy: {},
    outputPolicy: {},
    runtimePolicy: { mode, completionPolicy: "process-exit", maxConcurrency: 2 },
    workspace: { projectRoot: "/tmp/project" },
    perspectives: [
      { name: "builder", task: "build" },
      { name: "reviewer", task: "review", dependsOn: ["builder"] },
    ],
  };
}

test("planPerspectiveExecution carries dependency metadata and concurrency settings", () => {
  const plan = planPerspectiveExecution(createContext());
  assert.equal(plan.mode, "parallel");
  assert.equal(plan.maxConcurrency, 2);
  assert.deepEqual(plan.items[1]?.dependsOn, ["builder"]);
});

test("validateExecutionDag accepts a simple dependency graph", () => {
  const plan = planPerspectiveExecution(createContext());
  const validation = validateExecutionDag(plan.items);
  assert.equal(validation.ok, true);
  assert.deepEqual(validation.errors, []);
});

test("validateExecutionDag rejects cycles and missing dependencies", () => {
  const plan = planPerspectiveExecution({
    ...createContext(),
    perspectives: [
      { name: "builder", task: "build", dependsOn: ["reviewer"] },
      { name: "reviewer", task: "review", dependsOn: ["missing", "builder"] },
    ],
  });

  const validation = validateExecutionDag(plan.items);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => /unknown perspective 'missing'/.test(error)));
  assert.ok(validation.errors.some((error) => /Dependency cycle detected/.test(error)));
});

test("assertSupportedExecutionMode rejects invalid dag graphs with validation context", () => {
  const invalidDag = validateExecutionDag([
    { perspective: { name: "builder", task: "build" }, order: 0, dependsOn: ["builder"] },
  ]);
  assert.throws(
    () => assertSupportedExecutionMode("dag", invalidDag),
    /DAG validation failed: .*cannot depend on itself/,
  );
});

test("assertSupportedExecutionMode allows valid dag mode", () => {
  assert.doesNotThrow(
    () => assertSupportedExecutionMode("dag", { ok: true, errors: [] }),
  );
});
