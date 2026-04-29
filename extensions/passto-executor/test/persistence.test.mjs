import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FileExecutorRunStore, buildRunManifest } from "../executor-core/run-store.ts";
import { readRunIndex } from "../executor-core/store/run-index.ts";

function createManifest(runId = "run-persist") {
  return buildRunManifest({
    runId,
    invocation: {
      taskId: "demo",
      stage: "builder",
      role: "builder",
      task: { title: "Demo", description: "Run demo" },
      expectedOutput: { todolist: [], checklist: [] },
      constraints: [],
      inputs: [],
      hints: {},
      execution: { mode: "single", contract: undefined },
    },
    perspective: "builder",
    workspace: { projectName: "pi-sandbox", projectRoot: "/tmp/project" },
    runtimePolicy: { mode: "single", completionPolicy: "process-exit" },
  });
}

test("FileExecutorRunStore lists runs and summarizes stored status", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-persist-"));
  const store = new FileExecutorRunStore({ rootDir });

  await store.createRun("run-a", createManifest("run-a"));
  await store.writeResult("run-a", {
    runId: "run-a",
    status: "completed",
    summaryText: "done a",
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 2, turns: 1 },
    updatedAt: "t1",
  });

  await store.createRun("run-b", createManifest("run-b"));
  await store.writeFailure("run-b", {
    runId: "run-b",
    status: "failed",
    summaryText: "boom b",
    usage: { input: 1, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 1, turns: 1 },
    failure: { reason: "error", errorMessage: "boom" },
    updatedAt: "t2",
  });

  const runs = await store.listRuns();
  const statuses = await store.getRunStatuses();
  const index = await readRunIndex(rootDir);

  assert.deepEqual(runs.map((item) => item.runId), ["run-a", "run-b"]);
  assert.equal(statuses.length, 2);
  assert.equal(statuses[0]?.status, "completed");
  assert.equal(statuses[1]?.status, "failed");
  assert.equal(index.length, 2);
  assert.equal(index[0]?.status, "completed");
  assert.equal(index[1]?.status, "failed");
});
