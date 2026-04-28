import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalizeBuilderInput } from "../builder/input.ts";
import { createInitialBuilderState } from "../builder/state.ts";
import { runBuilderWorkflow } from "../builder/workflow.ts";

test("verify phase records verification artifact and completed item", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "passto-builder-verify-"));
  const input = normalizeBuilderInput({
    goal: "verify demo",
    task: "write note",
    cwd,
    expectedOutputs: ["note.md"],
  });

  const finalState = await runBuilderWorkflow(createInitialBuilderState(input));
  const verificationArtifact = finalState.artifacts.find((item) => item.type === "verification-summary");
  assert.ok(verificationArtifact);
  assert.ok(finalState.completedItems.includes("verify"));
  assert.equal(verificationArtifact?.metadata?.verifiedArtifactType, "workspace-note");
  assert.equal(verificationArtifact?.metadata?.verifiedPath, finalState.artifacts.find((item) => item.type === "workspace-note")?.path);
  assert.match(finalState.summary, /Builder workflow completed/);
});
