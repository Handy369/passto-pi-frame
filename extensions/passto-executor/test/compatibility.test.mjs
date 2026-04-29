import test from "node:test";
import assert from "node:assert/strict";
import {
  executeLegacyRequest,
  legacyRequestToExecuteOptions,
  legacyRequestToInvocation,
  legacyRequestToRuntimePolicy,
} from "../compatibility/legacy-invocation-adapter.ts";
import { assembleExecutorContext } from "../executor-core/assembly.ts";
import { executeInvocation } from "../executor-core/execute.ts";
import { NoopSandboxManager } from "../executor-core/sandbox.ts";

test("legacyRequestToInvocation maps a legacy-style request into ExecutorInvocation", () => {
  const invocation = legacyRequestToInvocation({
    task: "review the API surface",
    cwd: "/tmp/project",
    role: "reviewer",
    mode: "parallel",
    title: "Legacy review",
    checklist: ["Check API stability"],
    todolist: ["Inspect exports"],
    constraints: ["Do not edit files"],
    preferredModel: "demo-model",
    preferredThinking: "medium",
    inputs: [{ kind: "inline", content: "legacy brief", label: "brief" }],
  });

  assert.equal(invocation.sourceTaskDocPath, "compatibility://legacy-subagent-like-request");
  assert.equal(invocation.stage, "reviewer");
  assert.equal(invocation.mode, "parallel");
  assert.equal(invocation.task.title, "Legacy review");
  assert.equal(invocation.expectedOutput.checklist[0], "Check API stability");
  assert.equal(invocation.hints?.preferredThinking, "medium");
  assert.equal(invocation.inputs[0]?.kind, "inline");
});

test("legacyRequestToRuntimePolicy maps legacy execution options into runtime policy overrides", () => {
  const runtimePolicy = legacyRequestToRuntimePolicy({
    task: "compat task",
    cwd: "/tmp/project",
    mode: "dag",
    maxConcurrency: 3,
    completionPolicy: "agent-end",
    idleTimeoutMs: 1000,
    timeoutMs: 5000,
    terminateGraceMs: 250,
    sandboxCleanupPolicy: "on-failure",
    preserveSandboxOnFailure: true,
  });

  assert.equal(runtimePolicy.mode, "dag");
  assert.equal(runtimePolicy.maxConcurrency, 3);
  assert.equal(runtimePolicy.completionPolicy, "agent-end");
  assert.equal(runtimePolicy.sandboxCleanupPolicy, "on-failure");
  assert.equal(runtimePolicy.preserveSandboxOnFailure, true);
});

test("legacyRequestToExecuteOptions lets request extensions feed execution options", () => {
  const executeOptions = legacyRequestToExecuteOptions({
    task: "compat task",
    cwd: "/tmp/project",
    extensions: ["ext-a"],
  }, {
    runId: "compat-run",
    agent: "default",
  });

  assert.deepEqual(executeOptions.extensions, ["ext-a"]);
  assert.equal(executeOptions.runId, "compat-run");
});

test("legacyRequestToInvocation output can assemble into executor context", () => {
  const invocation = legacyRequestToInvocation({
    task: "build the feature",
    cwd: "/tmp/project",
    role: "builder",
  });
  const context = assembleExecutorContext(invocation, { runId: "compat-run" });

  assert.equal(context.runId, "compat-run");
  assert.equal(context.workspace.projectRoot, "/tmp/project");
  assert.equal(context.runtimePolicy.mode, "single");
  assert.equal(context.perspectives.length, 1);
});

test("legacy-style request can execute through passto-executor", async () => {
  const invocation = legacyRequestToInvocation({
    task: "compatibility execution task",
    cwd: "/tmp/project",
    role: "builder",
    title: "Compat execution",
  });

  const result = await executeInvocation(invocation, {
    runId: "compat-exec",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => ({
      runId: "compat-child",
      exitCode: 0,
      success: true,
      messages: [],
      stderr: "",
      rawEvents: [],
      usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 2, turns: 1 },
      finalOutputText: `done:${params.prompt}`,
      progress: { phase: "done" },
      provenance: {
        reviewedBySubagent: true,
        subagentMode: "spawn",
        transport: "pi-cli-json",
        runtimeVersion: "stub",
      },
    }),
  });

  assert.equal(result.status, "completed");
  assert.match(result.summaryText, /builder: done:compatibility execution task/);
});

test("executeLegacyRequest preserves compatibility spine while applying runtime and extension options", async () => {
  let observedExtensions;
  let observedPrompt = "";

  const result = await executeLegacyRequest({
    task: "compatibility helper task",
    cwd: "/tmp/project",
    role: "builder",
    mode: "parallel",
    extensions: ["compat-ext"],
    completionPolicy: "agent-end",
    idleTimeoutMs: 1234,
    timeoutMs: 5678,
    terminateGraceMs: 90,
    sandboxCleanupPolicy: "never",
    preserveSandboxOnFailure: true,
  }, {
    runId: "compat-helper-run",
    agent: "default",
    sandboxManager: new NoopSandboxManager(),
    childRunner: async (params) => {
      observedExtensions = params.extensions;
      observedPrompt = params.prompt;
      assert.equal(params.executionPolicy?.completionPolicy, "process-exit");
      assert.equal(params.executionPolicy?.idleTimeoutMs, 1234);
      assert.equal(params.executionPolicy?.timeoutMs, 5678);
      assert.equal(params.executionPolicy?.terminateGraceMs, 90);
      return {
        runId: "compat-helper-child",
        exitCode: 0,
        success: true,
        messages: [],
        stderr: "",
        rawEvents: [],
        usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 2, turns: 1 },
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
  assert.deepEqual(observedExtensions, ["compat-ext"]);
  assert.equal(observedPrompt, "compatibility helper task");
  assert.match(result.summaryText, /builder: done:compatibility helper task/);
});
