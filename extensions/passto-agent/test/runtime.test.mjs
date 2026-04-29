import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listAvailablePasstoAgentStages, runPasstoAgent, setPasstoAgentMarkdownExtractor } from "../index.ts";

test("listAvailablePasstoAgentStages exposes passto-executor registry", () => {
  const stages = listAvailablePasstoAgentStages();
  assert.deepEqual(stages, ["builder", "operator", "reviewer"]);
});

test("runPasstoAgent creates a builder task-doc from natural language input", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "passto-agent-"));
  const result = await runPasstoAgent({
    input: "Implement the requested feature using ./docs/spec.md and /tmp/demo.ts",
    cwd,
    execute: false,
  });

  assert.equal(result.stage, "builder");
  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, true);
  assert.deepEqual(result.confirmationRequired, ["cwd", "goal", "stage"]);
  assert.ok(result.taskDocPath.endsWith(".md"));
  assert.ok(fs.existsSync(result.taskDocPath));

  const raw = fs.readFileSync(result.taskDocPath, "utf-8");
  assert.match(raw, /stage: "builder"/);
  assert.match(raw, /Implement the requested feature using \.\/docs\/spec\.md and \/tmp\/demo\.ts/);
  assert.match(raw, /inputs:/);
  assert.match(raw, /spec\.md/);
  assert.match(raw, /demo\.ts/);
});

test("runPasstoAgent uses LLM-style extractor for explicit markdown input when provided", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "passto-agent-md-derive-"));
  const docPath = path.join(cwd, "ralph-loop.md");
  fs.writeFileSync(docPath, `# Random Heading\nSome execution doc text.`, "utf-8");

  setPasstoAgentMarkdownExtractor(async () => ({
    constraints: ["Do not modify unrelated files"],
    todolist: ["Implement the selected change"],
    checklist: ["Stay within requested scope"],
  }));

  const result = await runPasstoAgent({
    input: `Implement the requested feature using ${docPath}`,
    cwd,
    execute: false,
  });

  setPasstoAgentMarkdownExtractor(undefined);

  const raw = fs.readFileSync(result.taskDocPath, "utf-8");
  assert.match(raw, /Do not modify unrelated files/);
  assert.match(raw, /Implement the selected change/);
  assert.match(raw, /Stay within requested scope/);
});

test("runPasstoAgent accepts an existing markdown task-doc path", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "passto-agent-md-"));
  const taskPath = path.join(cwd, "reviewer-task.md");
  fs.writeFileSync(taskPath, `---
schema_version: "1"
project:
  name: "demo"
  cwd: ${JSON.stringify(cwd)}
stage: "reviewer"
expected_output:
  todolist:
    - "Review"
  checklist:
    - "Stay scoped"
inputs:
  - kind: "file"
    path: ${JSON.stringify(path.join(cwd, "src/index.ts"))}
    required: true
---
Review this work.\n`, "utf-8");

  const result = await runPasstoAgent({
    input: taskPath,
    cwd,
    execute: false,
  });

  assert.equal(result.stage, "reviewer");
  assert.equal(result.taskDocPath, taskPath);
  assert.deepEqual(result.confirmationRequired, ["cwd", "goal", "stage"]);
});

test("runPasstoAgent only executes after explicit cwd/goal/stage confirmation", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "passto-agent-confirm-"));
  const result = await runPasstoAgent({
    input: "Implement the requested feature",
    cwd,
    execute: true,
  });

  assert.equal(result.executed, false);
  assert.equal(result.needsConfirmation, true);
  assert.deepEqual(result.confirmationRequired, ["cwd", "goal", "stage"]);
});
