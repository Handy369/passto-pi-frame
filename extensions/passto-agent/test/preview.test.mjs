import test from "node:test";
import assert from "node:assert/strict";
import { runPasstoAgentWithUi } from "../index.ts";
import { buildPasstoAgentDraftFromText } from "../index.ts";
import { createPasstoAgentUiAdapter } from "../index.ts";

test("task preview separates user-provided fields from inferred optional fields", async () => {
  const previewCalls = [];
  const ui = createPasstoAgentUiAdapter({
    async choose() {
      throw new Error("choose should not be called");
    },
    async multiselect() {
      throw new Error("multiselect should not be called");
    },
    async prompt() {
      throw new Error("prompt should not be called");
    },
    async confirm() {
      return true;
    },
    preview(payload) {
      previewCalls.push(payload);
    },
  });

  const result = await runPasstoAgentWithUi({
    input: "Implement the requested feature using ./docs/spec.md",
    cwd: "/tmp/passto-agent-preview-demo",
    execute: false,
    ui,
  });

  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, false);
  assert.equal(previewCalls.length, 1);
  assert.equal(previewCalls[0]?.title, "Task preview");
  assert.match(previewCalls[0]?.message ?? "", /## User-provided/);
  assert.match(previewCalls[0]?.message ?? "", /## Inferred optional fields/);
  assert.match(previewCalls[0]?.message ?? "", /cwd:/);
  assert.match(previewCalls[0]?.message ?? "", /goal:/);
  assert.match(previewCalls[0]?.message ?? "", /stage:/);
  assert.match(previewCalls[0]?.message ?? "", /executor\.type/i);
  assert.match(previewCalls[0]?.message ?? "", /inputs:/i);
  assert.match(previewCalls[0]?.message ?? "", /do not require confirmation/i);
});

test("preview renderer includes inferred optional sections", async () => {
  const draft = await buildPasstoAgentDraftFromText("Implement the requested feature using ./docs/spec.md", "/tmp/passto-agent-preview-draft");
  assert.ok(draft.executorType);
  assert.ok(draft.inputs.length > 0);
});
