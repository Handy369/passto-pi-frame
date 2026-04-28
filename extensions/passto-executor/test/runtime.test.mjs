import test from "node:test";
import assert from "node:assert/strict";
import { buildRunExecutorChildParams } from "../executor-core/execution/runtime-param-builder.ts";

function createContext() {
  return {
    runId: "run-1",
    invocation: {
      sourceTaskDocPath: "/tmp/task.md",
      project: { name: "demo", cwd: "/tmp/project" },
      stage: "builder",
      task: { description: "do work" },
      expectedOutput: { todolist: [], checklist: [] },
      constraints: [],
      inputs: [],
      mode: "sequential",
    },
    role: "builder",
    memory: [],
    skills: [],
    extensions: [],
    modelPolicy: {},
    outputPolicy: { format: "markdown", instructions: [] },
    runtimePolicy: {
      mode: "sequential",
      completionPolicy: "process-exit",
      idleTimeoutMs: 1000,
      timeoutMs: 2000,
      terminateGraceMs: 300,
    },
    workspace: { projectRoot: "/tmp/project" },
    perspectives: [],
  };
}

test("buildRunExecutorChildParams maps base runtime policy and defaults", () => {
  const params = buildRunExecutorChildParams({
    context: createContext(),
    perspective: { name: "builder", task: "build" },
    defaultAgent: "default",
    defaultExtensions: ["ext-a"],
    cwd: "/tmp/sandbox",
  });

  assert.equal(params.agent, "default");
  assert.equal(params.prompt, "build");
  assert.equal(params.cwd, "/tmp/sandbox");
  assert.deepEqual(params.extensions, ["ext-a"]);
  assert.deepEqual(params.executionPolicy, {
    completionPolicy: "process-exit",
    idleTimeoutMs: 1000,
    timeoutMs: 2000,
    terminateGraceMs: 300,
  });
});

test("buildRunExecutorChildParams lets perspective runtime options override run defaults", () => {
  const params = buildRunExecutorChildParams({
    context: createContext(),
    perspective: {
      name: "reviewer",
      task: "review",
      agent: "reviewer-agent",
      extensions: ["ext-b"],
      runtimeOptions: {
        completionPolicy: "agent-end",
        idleTimeoutMs: 5000,
        timeoutMs: 9000,
      },
    },
    defaultAgent: "default",
    defaultExtensions: ["ext-a"],
    cwd: "/tmp/sandbox-review",
  });

  assert.equal(params.agent, "reviewer-agent");
  assert.deepEqual(params.extensions, ["ext-b"]);
  assert.deepEqual(params.executionPolicy, {
    completionPolicy: "process-exit",
    idleTimeoutMs: 5000,
    timeoutMs: 9000,
    terminateGraceMs: 300,
  });
});

test("buildRunExecutorChildParams shapes Ralph loop runs toward ralph-executor and process-exit lifecycle", () => {
  const context = createContext();
  context.runtimePolicy = {
    mode: "single",
    timeoutMs: 2000,
  };

  const params = buildRunExecutorChildParams({
    context,
    perspective: { name: "builder", task: "run ralph", contract: { name: "ralph-loop" } },
    defaultAgent: "default",
    defaultExtensions: ["ext-a"],
    cwd: "/tmp/sandbox-ralph",
    contract: "ralph-loop",
  });

  assert.equal(params.agent, "ralph-executor");
  assert.deepEqual(params.extensions, ["ext-a"]);
  assert.deepEqual(params.executionPolicy, {
    completionPolicy: "process-exit",
    idleTimeoutMs: 60000,
    timeoutMs: 2000,
    terminateGraceMs: 10000,
  });
});
