import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { executeResolvedContext } from "../executor-core/execute.ts";
import { FileExecutorRunStore, InMemoryExecutorRunStore } from "../executor-core/run-store.ts";
import { NoopSandboxManager } from "../executor-core/sandbox.ts";

function createDagContext(perspectives, runtimeOverrides = {}) {
  return {
    runId: "run-dag",
    invocation: {
      sourceTaskDocPath: "/tmp/task.md",
      project: { name: "demo", cwd: "/tmp/project" },
      stage: "builder",
      task: { description: "do work" },
      expectedOutput: { todolist: [], checklist: [] },
      constraints: [],
      inputs: [],
      mode: "dag",
    },
    role: "builder",
    memory: [],
    skills: [],
    extensions: [],
    modelPolicy: {},
    outputPolicy: { format: "markdown", instructions: [] },
    runtimePolicy: { mode: "dag", completionPolicy: "process-exit", maxConcurrency: 2, ...runtimeOverrides },
    workspace: { projectRoot: "/tmp/project" },
    perspectives,
  };
}

function makeSuccessResult(prompt) {
  return {
    runId: `child-${prompt}`,
    exitCode: 0,
    success: true,
    messages: [],
    stderr: "",
    rawEvents: [],
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 2, turns: 1 },
    finalOutputText: `done:${prompt}`,
    progress: { phase: "done" },
    provenance: {
      reviewedBySubagent: true,
      subagentMode: "spawn",
      transport: "pi-cli-json",
      runtimeVersion: "stub",
    },
  };
}

test("executeResolvedContext runs a linear dag in dependency order", async () => {
  const seen = [];
  const result = await executeResolvedContext(createDagContext([
    { name: "builder", task: "build" },
    { name: "reviewer", task: "review", dependsOn: ["builder"] },
    { name: "shipper", task: "ship", dependsOn: ["reviewer"] },
  ]), {
    runId: "run-dag-linear",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      seen.push(params.prompt);
      return makeSuccessResult(params.prompt);
    },
  });

  assert.deepEqual(seen, ["build", "review", "ship"]);
  assert.equal(result.status, "completed");
  assert.deepEqual(result.perspectiveResults.map((item) => item.status), ["completed", "completed", "completed"]);
});

test("executeResolvedContext runs diamond dag with bounded concurrency", async () => {
  let active = 0;
  let maxActive = 0;
  const started = [];

  const result = await executeResolvedContext(createDagContext([
    { name: "builder", task: "build" },
    { name: "docs", task: "docs", dependsOn: ["builder"] },
    { name: "tests", task: "tests", dependsOn: ["builder"] },
    { name: "reviewer", task: "review", dependsOn: ["docs", "tests"] },
  ], { maxConcurrency: 2 }), {
    runId: "run-dag-diamond",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      started.push(params.prompt);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, params.prompt === "build" ? 10 : 5));
      active -= 1;
      return makeSuccessResult(params.prompt);
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.perspectiveResults.length, 4);
  assert.equal(maxActive, 2);
  assert.equal(started[0], "build");
  assert.ok(started.indexOf("docs") > 0);
  assert.ok(started.indexOf("tests") > 0);
  assert.equal(started.at(-1), "review");
});

test("executeResolvedContext skips downstream nodes after upstream failure and emits dag events", async () => {
  const store = new InMemoryExecutorRunStore();
  const result = await executeResolvedContext(createDagContext([
    { name: "builder", task: "build" },
    { name: "reviewer", task: "review", dependsOn: ["builder"] },
    { name: "shipper", task: "ship", dependsOn: ["reviewer"] },
  ]), {
    runId: "run-dag-failure",
    agent: "default",
    runStore: store,
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      if (params.prompt === "build") {
        return {
          ...makeSuccessResult(params.prompt),
          exitCode: 1,
          success: false,
          stderr: "boom",
          stopReason: "error",
          errorMessage: "boom",
          finalOutputText: "",
          progress: { phase: "error" },
        };
      }
      return makeSuccessResult(params.prompt);
    },
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(
    result.perspectiveResults.map((item) => ({ perspective: item.perspective, status: item.status })),
    [
      { perspective: "builder", status: "failed" },
      { perspective: "reviewer", status: "skipped" },
      { perspective: "shipper", status: "skipped" },
    ],
  );
  assert.match(result.summaryText, /reviewer: skipped:/);
  assert.equal(result.usage.input, 1);
  assert.equal(result.usage.output, 1);
  assert.ok(result.events.some((event) => event.type === "perspective.waiting" && event.perspective === "reviewer"));
  assert.ok(result.events.some((event) => event.type === "perspective.skipped" && event.perspective === "reviewer"));
  assert.ok(result.events.some((event) => event.type === "run.aggregate-progress"));

  const storedEvents = await store.getRunEvents("run-dag-failure");
  assert.ok(storedEvents.some((record) => record.event.type === "perspective.skipped"));
});

test("executeResolvedContext persists failed dag results and skip events to file run store", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-dag-store-"));
  const store = new FileExecutorRunStore({ rootDir });

  const result = await executeResolvedContext(createDagContext([
    { name: "builder", task: "build" },
    { name: "reviewer", task: "review", dependsOn: ["builder"] },
  ]), {
    runId: "run-dag-file-failure",
    agent: "default",
    runStore: store,
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      if (params.prompt === "build") {
        return {
          ...makeSuccessResult(params.prompt),
          exitCode: 1,
          success: false,
          stderr: "boom",
          stopReason: "error",
          errorMessage: "boom",
          finalOutputText: "",
          progress: { phase: "error" },
        };
      }
      return makeSuccessResult(params.prompt);
    },
  });

  assert.equal(result.status, "failed");
  const storedResult = await store.getRunResult("run-dag-file-failure");
  const storedEvents = await store.getRunEvents("run-dag-file-failure");
  assert.equal(storedResult?.status, "failed");
  assert.ok(storedResult?.summaryText.includes("reviewer: skipped:"));
  assert.ok(storedEvents.some((record) => record.event.type === "perspective.skipped"));
  assert.ok(storedEvents.some((record) => record.event.type === "run.aggregate-progress"));
});

test("executeResolvedContext rejects invalid dag graphs before execution", async () => {
  await assert.rejects(
    () => executeResolvedContext(createDagContext([
      { name: "builder", task: "build", dependsOn: ["builder"] },
    ]), {
      runId: "run-dag-invalid",
      agent: "default",
      sandboxManager: new NoopSandboxManager(),
      childRunner: async (params) => makeSuccessResult(params.prompt),
    }),
    /requires a valid dependency graph/,
  );
});
