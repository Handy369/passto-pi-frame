import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runRalphLoopEngine } from "../loop-engine/ralph-loop-engine.ts";
import { runBuilder } from "../builder/runner.ts";
import { normalizeBuilderInput } from "../builder/input.ts";

test("runRalphLoopEngine maps executor result into loop result and progress", async () => {
  const input = normalizeBuilderInput({
    goal: "demo",
    task: "write a note",
    cwd: "/tmp/project",
    expectedOutputs: ["note.md"],
  });

  const loop = await runRalphLoopEngine(input, async () => ({
    runId: "run-1",
    status: "completed",
    summaryText: "builder: note written",
    perspectiveResults: [],
    usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 1 },
    events: [],
  }));

  assert.equal(loop.result.finalStatus, "completed");
  assert.equal(loop.progress.length, 3);
  assert.match(loop.result.summary, /note written/);
});

test("runBuilder returns frame-usable snapshots and final result", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "passto-builder-"));
  const result = await runBuilder({
    goal: "demo builder run",
    task: "write a summary note",
    cwd,
    expectedOutputs: ["summary.md"],
    checklist: [{ id: "c1", text: "write summary" }],
  });

  assert.ok(result.snapshots.length >= 6);
  assert.equal(result.result.finalStatus, "success");
  assert.ok(Array.isArray(result.result.producedArtifacts));
  assert.match(result.result.handoffNote, /Builder completed|Builder stopped/);
  assert.match(result.result.primaryRunId ?? "", /^builder-/);
  assert.equal(result.result.executorContext?.executorType, "passto-builder");
  assert.equal(result.result.executorContext?.executionEngine, "ralph-loop");
  assert.equal(result.result.executorContext?.projectName, "passto-ai-frame");
  assert.equal(result.result.executorContext?.cwd, cwd);
  assert.ok(result.result.artifactSummary);
  assert.ok(result.result.artifactSummary.total >= 3);
  assert.equal(result.result.artifactSummary.byType["workspace-note"], 1);

  const noteArtifact = result.result.producedArtifacts.find((item) => item.type === "workspace-note");
  assert.ok(noteArtifact?.path);
  const content = await readFile(noteArtifact.path, "utf8");
  assert.match(content, /demo builder run/);
  assert.match(content, /passto-builder vertical slice/);
});
