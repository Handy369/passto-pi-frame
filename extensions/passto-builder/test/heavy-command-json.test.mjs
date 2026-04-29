import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatBuilderCommandResult, runBuilderCommand } from "../commands/run-builder.ts";
import { runBuilderFromJsonFile } from "../commands/run-builder-from-json.ts";

test.skip("heavy: runBuilderCommand returns builder response with real workspace artifact", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "passto-builder-command-"));
  const response = await runBuilderCommand({
    goal: "command path",
    task: "write a command-path note",
    cwd,
    expectedOutputs: ["command-note.md"],
  });

  assert.equal(response.result.finalStatus, "success");
  const note = response.result.producedArtifacts.find((item) => item.type === "workspace-note");
  assert.ok(note?.path);
  const content = await readFile(note.path, "utf8");
  assert.match(content, /command path/);

  const formatted = formatBuilderCommandResult(response);
  assert.equal(formatted.finalStatus, "success");
  assert.ok(formatted.artifactCount >= 1);
});

test.skip("heavy: runBuilderFromJsonFile loads builder input and returns formatted output", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "passto-builder-json-"));
  const jsonPath = join(cwd, "builder-input.json");
  await writeFile(jsonPath, JSON.stringify({
    goal: "json path",
    task: "write a json-path note",
    cwd,
    expectedOutputs: ["json-note.md"],
  }, null, 2), "utf8");

  const result = await runBuilderFromJsonFile(jsonPath);
  assert.equal(result.input.goal, "json path");
  assert.equal(result.response.result.finalStatus, "success");
  const note = result.response.result.producedArtifacts.find((item) => item.type === "workspace-note");
  assert.ok(note?.path);
});
