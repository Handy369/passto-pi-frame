import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildRunManifest,
  FileExecutorRunStore,
  InMemoryExecutorRunStore,
  resultToStoredRecord,
} from "../executor-core/run-store.ts";

function createManifest(runId = "run-store-test") {
  return buildRunManifest({
    runId,
    invocation: {
      taskId: "demo",
      stage: "builder",
      role: "builder",
      task: { title: "Demo", description: "Run demo" },
      expectedOutput: { todolist: ["one"], checklist: ["two"] },
      constraints: [],
      inputs: [],
      hints: {},
      execution: { mode: "single", contract: undefined },
    },
    perspective: "builder",
    workspace: { projectName: "pi-sandbox", projectRoot: "/tmp/project" },
    runtimePolicy: {
      mode: "single",
      completionPolicy: "process-exit",
      idleTimeoutMs: 60000,
      timeoutMs: 300000,
      terminateGraceMs: 1000,
    },
  });
}

test("InMemoryExecutorRunStore readback returns typed manifest events and results", async () => {
  const store = new InMemoryExecutorRunStore();
  await store.createRun("run-typed", createManifest("run-typed"));
  await store.appendEvent("run-typed", { type: "run.started", runId: "run-typed", timestamp: "t1" });
  await store.writeResult("run-typed", {
    runId: "run-typed",
    status: "completed",
    summaryText: "done",
    usage: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0, cost: 0.1, contextTokens: 3, turns: 1 },
    updatedAt: "t2",
  });

  const manifest = await store.getRunManifest("run-typed");
  const events = await store.getRunEvents("run-typed");
  const result = await store.getRunResult("run-typed");
  const runs = await store.listRuns?.();
  const statuses = await store.getRunStatuses?.();

  assert.equal(manifest?.runId, "run-typed");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.event.type, "run.started");
  assert.equal(result?.status, "completed");
  assert.deepEqual(runs, [{ runId: "run-typed", createdAt: manifest?.createdAt }]);
  assert.equal(statuses?.[0]?.status, "completed");
});

test("FileExecutorRunStore persists manifest events and result files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-store-"));
  const store = new FileExecutorRunStore({ rootDir });

  await store.createRun("run-file", createManifest("run-file"));
  await store.appendEvent("run-file", { type: "run.started", runId: "run-file", timestamp: "t1" });
  await store.writeResult("run-file", {
    runId: "run-file",
    status: "completed",
    summaryText: "done",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 2, turns: 1 },
    updatedAt: "t2",
  });

  const manifest = await store.getRunManifest("run-file");
  const events = await store.getRunEvents("run-file");
  const result = await store.getRunResult("run-file");

  assert.equal(manifest?.perspective, "builder");
  assert.equal(events.length, 1);
  assert.equal(events[0]?.event.type, "run.started");
  assert.equal(result?.summaryText, "done");

  const runDir = path.join(rootDir, "run-file");
  assert.equal(typeof await fs.readFile(path.join(runDir, "manifest.json"), "utf-8"), "string");
  assert.equal(typeof await fs.readFile(path.join(runDir, "events.jsonl"), "utf-8"), "string");
  assert.equal(typeof await fs.readFile(path.join(runDir, "result.json"), "utf-8"), "string");
});

test("resultToStoredRecord produces typed failure payload", () => {
  const stored = resultToStoredRecord({
    runId: "run-fail",
    status: "failed",
    summaryText: "boom",
    perspectiveResults: [],
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 },
    events: [],
    failure: { reason: "error", errorMessage: "boom" },
  });

  assert.equal(stored.runId, "run-fail");
  assert.equal(stored.status, "failed");
  assert.equal(stored.failure?.errorMessage, "boom");
  assert.ok("updatedAt" in stored);
});
