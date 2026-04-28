import test from "node:test";
import assert from "node:assert/strict";
import { planPerspectiveExecution, assertSupportedExecutionMode } from "../executor-core/orchestration.ts";
import { buildAggregatedExecutorRunResult, buildExecutorPerspectiveResult } from "../executor-core/result.ts";

function createContext(mode = "single") {
  return {
    runId: "run-orch",
    invocation: {
      sourceTaskDocPath: "/tmp/task.md",
      project: { name: "demo", cwd: "/tmp/project" },
      stage: "builder",
      task: { description: "do work" },
      expectedOutput: { todolist: ["one"], checklist: ["two"] },
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
      { name: "reviewer", task: "review" },
    ],
  };
}

test("planPerspectiveExecution preserves perspective order mode dependencies and concurrency", () => {
  const context = createContext("sequential");
  context.perspectives[1].dependsOn = ["builder"];
  const plan = planPerspectiveExecution(context);
  assert.equal(plan.mode, "sequential");
  assert.equal(plan.maxConcurrency, 2);
  assert.equal(plan.items.length, 2);
  assert.equal(plan.items[0]?.perspective.name, "builder");
  assert.equal(plan.items[1]?.order, 1);
  assert.deepEqual(plan.items[1]?.dependsOn, ["builder"]);
});

test("assertSupportedExecutionMode allows single sequential and parallel", () => {
  assert.doesNotThrow(() => assertSupportedExecutionMode("single"));
  assert.doesNotThrow(() => assertSupportedExecutionMode("sequential"));
  assert.doesNotThrow(() => assertSupportedExecutionMode("parallel"));
});

test("assertSupportedExecutionMode allows valid dag mode", () => {
  assert.doesNotThrow(() => assertSupportedExecutionMode("dag", { ok: true, errors: [] }));
});

test("buildAggregatedExecutorRunResult combines perspective summaries and usage", () => {
  const first = buildExecutorPerspectiveResult({
    perspective: "builder",
    childResult: {
      runId: "child-1",
      exitCode: 0,
      success: true,
      messages: [],
      stderr: "",
      rawEvents: [],
      usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 3, turns: 1 },
      finalOutputText: "done build",
      progress: { phase: "done" },
      provenance: {
        reviewedBySubagent: true,
        subagentMode: "spawn",
        transport: "pi-cli-json",
        runtimeVersion: "stub",
      },
    },
  });
  const second = buildExecutorPerspectiveResult({
    perspective: "reviewer",
    childResult: {
      runId: "child-2",
      exitCode: 0,
      success: true,
      messages: [],
      stderr: "",
      rawEvents: [],
      usage: { input: 2, output: 3, cacheRead: 0, cacheWrite: 0, cost: 0.2, contextTokens: 5, turns: 1 },
      finalOutputText: "done review",
      progress: { phase: "done" },
      provenance: {
        reviewedBySubagent: true,
        subagentMode: "spawn",
        transport: "pi-cli-json",
        runtimeVersion: "stub",
      },
    },
  });

  const aggregated = buildAggregatedExecutorRunResult({
    runId: "run-agg",
    perspectiveResults: [first, second],
    events: [],
  });

  assert.equal(aggregated.status, "completed");
  assert.match(aggregated.summaryText, /builder: done build/);
  assert.match(aggregated.summaryText, /reviewer: done review/);
  assert.equal(aggregated.usage.input, 3);
  assert.equal(aggregated.usage.output, 5);
});
