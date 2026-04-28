import test from "node:test";
import assert from "node:assert/strict";
import { readTaskDoc } from "../executor-core/task-doc.ts";
import { taskDocToInvocation } from "../executor-core/invocation.ts";
import { assembleExecutorContext } from "../executor-core/assembly.ts";
import { buildExecutorRunResult } from "../executor-core/result.ts";
import { mapChildRawEventsToExecutorEvents } from "../executor-core/events.ts";
import { buildRunManifest, InMemoryExecutorRunStore } from "../executor-core/run-store.ts";
import { NoopSandboxManager } from "../executor-core/sandbox.ts";
import { TempCopySandboxManager } from "../executor-core/sandbox/temp-copy-sandbox.ts";
import { executeInvocation } from "../executor-core/execute.ts";
import { loadTaskDocInvocation } from "../executor-core/task-entry.ts";

const sampleTaskPath = new URL("../examples/phase1-sample.task.md", import.meta.url);
const failureTaskPath = new URL("../examples/phase1-failure.task.md", import.meta.url);

test("taskDocToInvocation maps task body and checklist", () => {
  const invocation = taskDocToInvocation(readTaskDoc(sampleTaskPath));
  assert.equal(invocation.stage, "builder");
  assert.equal(invocation.task.title, "Bootstrap passto-executor skeleton");
  assert.equal(invocation.expectedOutput.checklist.length, 2);
  assert.match(invocation.task.description, /Phase 1 skeleton/i);
});

test("assembleExecutorContext applies Phase 1 defaults", () => {
  const invocation = taskDocToInvocation(readTaskDoc(sampleTaskPath));
  const context = assembleExecutorContext(invocation, { runId: "test-run" });
  assert.equal(context.runId, "test-run");
  assert.equal(context.runtimePolicy.mode, "single");
  assert.equal(context.runtimePolicy.completionPolicy, "process-exit");
  assert.equal(context.workspace.projectRoot, "/Users/handy/dev/pi-sandbox");
  assert.equal(context.perspectives.length, 1);
});

test("buildExecutorRunResult shapes single-perspective result", () => {
  const result = buildExecutorRunResult({
    runId: "run-1",
    perspective: "builder",
    childResult: {
      runId: "run-1",
      exitCode: 0,
      success: true,
      messages: [],
      stderr: "",
      rawEvents: [],
      usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 3, turns: 1 },
      finalOutputText: "done",
      progress: {},
      provenance: {
        reviewedBySubagent: true,
        subagentMode: "spawn",
        transport: "pi-cli-json",
        runtimeVersion: "test",
      },
    },
    events: [{ type: "run.completed", runId: "run-1", timestamp: new Date().toISOString() }],
  });
  assert.equal(result.status, "completed");
  assert.equal(result.summaryText, "builder: done");
  assert.equal(result.perspectiveResults.length, 1);
});

test("mapChildRawEventsToExecutorEvents emits lifecycle and tool events", () => {
  const events = mapChildRawEventsToExecutorEvents({
    runId: "run-2",
    perspective: "builder",
    phase: "done",
    success: true,
    rawEvents: [
      { type: "tool_execution_start", toolName: "read" },
      { type: "tool_execution_end", toolName: "read" },
    ],
  });
  assert.equal(events[0].type, "run.started");
  assert.equal(events[1].type, "perspective.started");
  assert.ok(events.some((event) => event.type === "tool.called"));
  assert.ok(events.some((event) => event.type === "tool.completed"));
  assert.equal(events.at(-1)?.type, "run.completed");
});

test("InMemoryExecutorRunStore records typed manifests events and results", async () => {
  const store = new InMemoryExecutorRunStore();
  await store.createRun("run-3", buildRunManifest({
    runId: "run-3",
    invocation: {
      taskId: "demo",
      stage: "builder",
      role: "builder",
      task: { title: "Demo", description: "Demo task" },
      expectedOutput: { todolist: ["one"], checklist: ["two"] },
      constraints: [],
      inputs: [],
      hints: {},
      execution: { mode: "single", contract: undefined },
    },
    perspective: "builder",
    workspace: { projectName: "demo", projectRoot: "/tmp/project" },
    runtimePolicy: {
      mode: "single",
      completionPolicy: "process-exit",
      idleTimeoutMs: 60000,
      timeoutMs: 300000,
      terminateGraceMs: 1000,
    },
  }));
  await store.appendEvent("run-3", { type: "run.started", runId: "run-3", timestamp: "t1" });
  await store.writeResult("run-3", {
    runId: "run-3",
    status: "completed",
    summaryText: "done",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
    updatedAt: "t2",
  });
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.manifests.get("run-3")?.runId, "run-3");
  assert.equal(snapshot.events.get("run-3")?.length, 1);
  assert.equal(snapshot.events.get("run-3")?.[0]?.event.type, "run.started");
  assert.equal(snapshot.results.get("run-3")?.status, "completed");
});

test("NoopSandboxManager returns project-root sandbox handle", async () => {
  const manager = new NoopSandboxManager();
  const handle = await manager.createPerspectiveSandbox({
    runId: "run-5",
    perspective: "builder",
    projectRoot: "/tmp/project",
  });
  assert.equal(handle.perspective, "builder");
  assert.equal(handle.root, "/tmp/project");
  await handle.cleanup();
});

test("loadTaskDocInvocation reads second sample task", () => {
  const { taskDoc, invocation } = loadTaskDocInvocation(failureTaskPath.pathname);
  assert.equal(taskDoc.frontmatter.taskId, "phase1-failure");
  assert.equal(invocation.stage, "reviewer");
  assert.match(invocation.task.description, /second frontmatter shape/i);
});

test("executeInvocation supports stubbed child runner for end-to-end skeleton path", async () => {
  const invocation = taskDocToInvocation(readTaskDoc(sampleTaskPath));
  const store = new InMemoryExecutorRunStore();
  const projectRoot = "/Users/handy/dev/pi-sandbox/extensions/passto-executor";
  let observedCwd = "";
  const result = await executeInvocation({
    ...invocation,
    project: { ...invocation.project, cwd: projectRoot },
  }, {
    runId: "run-e2e",
    agent: "default",
    runStore: store,
    sandboxManager: new TempCopySandboxManager(),
    childRunner: async (params) => {
      observedCwd = params.cwd;
      return {
        runId: "child-run",
        exitCode: 0,
        success: true,
        messages: [],
        stderr: "",
        rawEvents: [
          { type: "tool_execution_start", toolName: "read" },
          { type: "tool_execution_end", toolName: "read" },
        ],
        usage: { input: 5, output: 6, cacheRead: 0, cacheWrite: 0, cost: 0.2, contextTokens: 11, turns: 1 },
        stopReason: undefined,
        errorMessage: undefined,
        finalOutputText: `stubbed: ${params.prompt.slice(0, 20)}`,
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
  assert.match(result.summaryText, /^passto-builder-mini: stubbed:/);
  assert.ok(result.events.some((event) => event.type === "tool.called"));
  assert.notEqual(observedCwd, projectRoot);
  const snapshot = store.getSnapshot();
  assert.equal(snapshot.manifests.get("run-e2e")?.perspective, "passto-builder-mini");
  assert.equal(snapshot.results.get("run-e2e")?.status, "completed");
});
