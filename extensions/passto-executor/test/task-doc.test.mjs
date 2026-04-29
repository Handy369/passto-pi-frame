import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskDoc, readTaskDoc } from "../executor-core/task-doc.ts";

const validMinimalPath = new URL("./fixtures/valid-minimal.task.md", import.meta.url);
const validMultiPath = new URL("./fixtures/valid-multiperspective.task.md", import.meta.url);
const invalidMissingSchemaPath = new URL("./fixtures/invalid-missing-schema.task.md", import.meta.url);
const invalidBadInputsPath = new URL("./fixtures/invalid-bad-inputs.task.md", import.meta.url);

test("readTaskDoc parses minimal valid fixture", () => {
  const taskDoc = readTaskDoc(validMinimalPath);
  assert.equal(taskDoc.frontmatter.taskId, "valid-minimal");
  assert.equal(taskDoc.frontmatter.project.cwd, "/tmp/project");
  assert.equal(taskDoc.frontmatter.expectedOutput.todolist[0], "Do one thing");
});

test("readTaskDoc parses richer valid fixture with inputs and hints", () => {
  const taskDoc = readTaskDoc(validMultiPath);
  assert.equal(taskDoc.frontmatter.stage, "reviewer");
  assert.equal(taskDoc.frontmatter.inputs?.length, 2);
  assert.equal(taskDoc.frontmatter.inputs?.[0]?.kind, "file");
  assert.equal(taskDoc.frontmatter.inputs?.[1]?.kind, "inline");
  assert.equal(taskDoc.frontmatter.inputs?.[1]?.content, "review the exported API");
  assert.equal(taskDoc.frontmatter.hints?.preferredThinking, "medium");
});

test("readTaskDoc rejects fixture missing schema_version", () => {
  assert.throws(
    () => readTaskDoc(invalidMissingSchemaPath),
    /schema_version is required/,
  );
});

test("readTaskDoc rejects invalid input kind", () => {
  assert.throws(
    () => readTaskDoc(invalidBadInputsPath),
    /inputs\[0\]\.kind is invalid/,
  );
});

test("readTaskDoc rejects unknown stage not in passto-executor stage registry", () => {
  const bad = `---\nschema_version: "1"\nproject:\n  name: "x"\n  cwd: "/tmp/x"\nstage: "unknown"\nexpected_output:\n  todolist:\n    - "a"\n  checklist:\n    - "b"\n---\nbody`;
  assert.throws(
    () => parseTaskDoc(bad, "/tmp/unknown.task.md"),
    /stage must match a registered passto-executor stage/,
  );
});
