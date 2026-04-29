import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { analyzePasstoAgentDraft } from "../src/analysis.ts";
import { buildPasstoAgentDraftFromText, completePasstoAgentDraftWithUi, runPasstoAgentWithUi, setPasstoAgentMarkdownExtractor } from "../index.ts";
import { createPasstoAgentMemoryUiAdapter } from "../index.ts";

test("analyzePasstoAgentDraft maps stage required_parameters into field resolutions", async () => {
  const draft = {
    ...(await buildPasstoAgentDraftFromText("Implement the requested feature", "/tmp/demo-project")),
    todolist: [],
    checklist: [],
  };
  const analysis = analyzePasstoAgentDraft(draft);
  assert.deepEqual(analysis.stageInfo.requiredParameters, [
    "project.cwd",
    "stage",
    "expected_output.todolist",
    "expected_output.checklist",
  ]);
  assert.deepEqual(analysis.confirmationRequired, ["cwd", "goal", "stage"]);
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "cwd" && item.status === "provided"));
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "expected_output.todolist" && item.status === "required-user-input"));
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "expected_output.checklist" && item.status === "required-user-input"));
});

test("analyzePasstoAgentDraft infers executor.type preferred_role builder constraints and explicit inputs", async () => {
  const draft = await buildPasstoAgentDraftFromText("Implement the requested feature using ./docs/spec.md and /tmp/demo.ts", "/tmp/demo-project");
  const analysis = analyzePasstoAgentDraft(draft);
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "executor.type" && item.status === "inferred"));
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "hints.preferred_role" && item.status === "inferred"));
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "constraints" && item.status === "provided"));
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "inputs" && item.status === "inferred"));
  assert.equal(draft.inputs.length, 2);
});

test("optional inferred fields are non-blocking and do not require confirmation", async () => {
  const draft = await buildPasstoAgentDraftFromText("Implement the requested feature using ./docs/spec.md", "/tmp/demo-project");
  const analysis = analyzePasstoAgentDraft(draft);

  assert.deepEqual(analysis.confirmationRequired, ["cwd", "goal", "stage"]);
  assert.ok(!analysis.missingFields.includes("executor.type"));
  assert.ok(!analysis.missingFields.includes("inputs"));
  assert.ok(!analysis.missingFields.includes("constraints"));
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "executor.type" && item.status === "inferred"));
  assert.ok(analysis.fieldResolutions.some((item) => item.field === "inputs" && item.status === "inferred"));
});

test("markdown inputs can contribute constraints todo and checklist via extractor", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "passto-agent-derive-"));
  const docPath = path.join(cwd, "ralph-loop.md");
  fs.writeFileSync(docPath, `# Random Heading\nSome execution doc text.`, "utf-8");

  setPasstoAgentMarkdownExtractor(async () => ({
    constraints: ["Do not modify unrelated files"],
    todolist: ["Implement the selected change"],
    checklist: ["Stay within requested scope"],
  }));

  const draft = await buildPasstoAgentDraftFromText(`Implement the requested feature using ${docPath}`, cwd);
  setPasstoAgentMarkdownExtractor(undefined);

  assert.ok(draft.constraints.includes("Do not modify unrelated files"));
  assert.ok(draft.todolist.includes("Implement the selected change"));
  assert.ok(draft.checklist.includes("Stay within requested scope"));
});

test("completePasstoAgentDraftWithUi confirms only critical fields and preserves inferred optional fields", async () => {
  const draft = await buildPasstoAgentDraftFromText("Implement the requested feature", "/tmp/demo-project");
  const ui = createPasstoAgentMemoryUiAdapter({
    confirm: [true, true, true],
  });

  const completed = await completePasstoAgentDraftWithUi(draft, ui);
  assert.equal(completed.stage, "builder");
  assert.equal(completed.cwd, "/tmp/demo-project");
  assert.equal(completed.goal, "Implement the requested feature");
  assert.ok(completed.executorType);
  assert.ok(completed.constraints.length > 0);
});

test("completePasstoAgentDraftWithUi can re-ask when confirmation is rejected", async () => {
  const draft = await buildPasstoAgentDraftFromText("Review exported API", "/tmp/demo-project");
  const ui = createPasstoAgentMemoryUiAdapter({
    prompt: ["/tmp/updated-project", "Review exported API carefully"],
    choose: ["reviewer"],
    confirm: [false, false, false],
  });

  const completed = await completePasstoAgentDraftWithUi(draft, ui);
  assert.equal(completed.cwd, "/tmp/updated-project");
  assert.equal(completed.goal, "Review exported API carefully");
  assert.equal(completed.stage, "reviewer");
});

test("completePasstoAgentDraftWithUi fills todo/checklist via multiselect-style input", async () => {
  const draft = {
    ...(await buildPasstoAgentDraftFromText("Implement the requested feature", "/tmp/demo-project")),
    todolist: [],
    checklist: [],
  };
  const ui = createPasstoAgentMemoryUiAdapter({
    multiselect: [["Execute the requested work", "Add validation"], ["Keep scope", "Do not touch unrelated files"]],
    confirm: [true, true, true],
  });

  const completed = await completePasstoAgentDraftWithUi(draft, ui);
  assert.ok(completed.taskTitle);
  assert.deepEqual(completed.todolist, ["Execute the requested work", "Add validation"]);
  assert.deepEqual(completed.checklist, ["Keep scope", "Do not touch unrelated files"]);
});

test("runPasstoAgentWithUi completes interactive flow and writes task-doc", async () => {
  const ui = createPasstoAgentMemoryUiAdapter({
    confirm: [true, true, true],
  });

  const result = await runPasstoAgentWithUi({
    input: "Implement the requested feature using ./docs/spec.md",
    cwd: "/tmp/passto-agent-ui-demo",
    execute: false,
    ui,
  });

  assert.equal(result.stage, "builder");
  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, false);
  assert.deepEqual(result.confirmationRequired, []);
});
