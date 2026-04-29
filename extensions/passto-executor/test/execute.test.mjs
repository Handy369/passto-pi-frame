import test from "node:test";
import assert from "node:assert/strict";
import { executeResolvedContext } from "../executor-core/execute.ts";
import { InMemoryExecutorRunStore } from "../executor-core/run-store.ts";
import { NoopSandboxManager } from "../executor-core/sandbox.ts";

function createContext(mode = "sequential", runtimeOverrides = {}) {
  return {
    runId: "run-seq",
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
    role: "builder",
    memory: [],
    skills: [],
    extensions: [],
    modelPolicy: {},
    outputPolicy: { format: "markdown", instructions: [] },
    runtimePolicy: { mode, completionPolicy: "process-exit", ...runtimeOverrides },
    workspace: { projectRoot: "/tmp/project" },
    perspectives: [
      { name: "builder", task: "build" },
      { name: "reviewer", task: "review" },
    ],
  };
}

test("executeResolvedContext runs sequential perspectives and aggregates results", async () => {
  const seen = [];
  const store = new InMemoryExecutorRunStore();
  const result = await executeResolvedContext(createContext("sequential"), {
    runId: "run-seq",
    agent: "default",
    runStore: store,
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      seen.push(params.prompt);
      return {
        runId: `child-${seen.length}`,
        exitCode: 0,
        success: true,
        messages: [],
        stderr: "",
        rawEvents: [],
        usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 3, turns: 1 },
        finalOutputText: `done:${params.prompt}`,
        progress: { phase: "done" },
        provenance: {
          reviewedBySubagent: true,
          subagentMode: "spawn",
          transport: "pi-cli-json",
          runtimeVersion: "stub",
        },
      };
    },
  });

  assert.deepEqual(seen, ["build", "review"]);
  assert.equal(result.status, "completed");
  assert.equal(result.perspectiveResults.length, 2);
  assert.match(result.summaryText, /builder: done:build/);
  assert.equal(result.usage.input, 2);
  assert.equal((await store.getRunResult("run-seq"))?.status, "completed");
});

test("executeResolvedContext stops sequential execution on failure", async () => {
  const seen = [];
  const result = await executeResolvedContext(createContext("sequential"), {
    runId: "run-fail-stop",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      seen.push(params.prompt);
      const failed = params.prompt === "build";
      return {
        runId: `child-${seen.length}`,
        exitCode: failed ? 1 : 0,
        success: !failed,
        messages: [],
        stderr: failed ? "boom" : "",
        rawEvents: [],
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 2, turns: 1 },
        stopReason: failed ? "error" : undefined,
        errorMessage: failed ? "boom" : undefined,
        finalOutputText: failed ? "" : `done:${params.prompt}`,
        progress: { phase: failed ? "error" : "done" },
        provenance: {
          reviewedBySubagent: true,
          subagentMode: "spawn",
          transport: "pi-cli-json",
          runtimeVersion: "stub",
        },
      };
    },
  });

  assert.deepEqual(seen, ["build"]);
  assert.equal(result.status, "failed");
  assert.equal(result.perspectiveResults.length, 1);
});

test("executeResolvedContext runs parallel perspectives and aggregates all results", async () => {
  const seen = [];
  const result = await executeResolvedContext(createContext("parallel"), {
    runId: "run-parallel",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      seen.push(params.prompt);
      await new Promise((resolve) => setTimeout(resolve, params.prompt === "build" ? 15 : 1));
      return {
        runId: `child-${params.prompt}`,
        exitCode: 0,
        success: true,
        messages: [],
        stderr: "",
        rawEvents: [],
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 2, turns: 1 },
        finalOutputText: `done:${params.prompt}`,
        progress: { phase: "done" },
        provenance: {
          reviewedBySubagent: true,
          subagentMode: "spawn",
          transport: "pi-cli-json",
          runtimeVersion: "stub",
        },
      };
    },
  });

  assert.equal(seen.length, 2);
  assert.equal(result.status, "completed");
  assert.equal(result.perspectiveResults.length, 2);
  assert.match(result.summaryText, /builder: done:build/);
  assert.match(result.summaryText, /reviewer: done:review/);
});

test("executeResolvedContext shapes Ralph loop child runs toward process-exit and ralph-executor", async () => {
  let observedAgent = "";
  let observedCompletionPolicy = "";
  let observedIdleTimeoutMs = 0;
  let observedTerminateGraceMs = 0;

  const context = createContext("single", { timeoutMs: 2222 });
  context.contract = { name: "ralph-loop" };
  context.perspectives = [{ name: "builder", task: "run ralph loop" }];

  const result = await executeResolvedContext(context, {
    runId: "run-ralph-shaped",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      observedAgent = params.agent;
      observedCompletionPolicy = params.executionPolicy?.completionPolicy ?? "";
      observedIdleTimeoutMs = params.executionPolicy?.idleTimeoutMs ?? 0;
      observedTerminateGraceMs = params.executionPolicy?.terminateGraceMs ?? 0;
      return {
        runId: "child-ralph",
        exitCode: 0,
        success: true,
        messages: [],
        stderr: "",
        rawEvents: [],
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 2, turns: 1 },
        finalOutputText: "done:ralph",
        progress: { phase: "done" },
        provenance: {
          reviewedBySubagent: true,
          subagentMode: "spawn",
          transport: "pi-cli-json",
          runtimeVersion: "stub",
        },
      };
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(observedAgent, "ralph-executor");
  assert.equal(observedCompletionPolicy, "process-exit");
  assert.equal(observedIdleTimeoutMs, 60000);
  assert.equal(observedTerminateGraceMs, 10000);
});

test("executeResolvedContext respects bounded parallel concurrency", async () => {
  let active = 0;
  let maxActive = 0;

  const result = await executeResolvedContext(createContext("parallel", { maxConcurrency: 1 }), {
    runId: "run-parallel-bounded",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, params.prompt === "build" ? 10 : 1));
      active -= 1;
      return {
        runId: `child-${params.prompt}`,
        exitCode: 0,
        success: true,
        messages: [],
        stderr: "",
        rawEvents: [],
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 2, turns: 1 },
        finalOutputText: `done:${params.prompt}`,
        progress: { phase: "done" },
        provenance: {
          reviewedBySubagent: true,
          subagentMode: "spawn",
          transport: "pi-cli-json",
          runtimeVersion: "stub",
        },
      };
    },
  });

  assert.equal(result.status, "completed");
  assert.equal(result.perspectiveResults.length, 2);
  assert.equal(maxActive, 1);
});
