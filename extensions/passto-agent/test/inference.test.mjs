import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPasstoAgentDraftFromText, setPasstoAgentMarkdownExtractor } from "../index.ts";

test("missing markdown input path does not fail draft construction", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "passto-agent-missing-md-"));
  const draft = await buildPasstoAgentDraftFromText("Implement the feature using ./docs/spec.md", cwd);
  assert.equal(draft.stage, "builder");
  assert.equal(draft.inputs.length, 1);
  assert.equal(draft.inputs[0]?.path, path.join(cwd, "docs/spec.md"));
});

test("extractor failure falls back without throwing", async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "passto-agent-extractor-fail-"));
  const docPath = path.join(cwd, "plan.md");
  fs.writeFileSync(docPath, "# Notes\nNo structured headings", "utf-8");

  setPasstoAgentMarkdownExtractor(async () => {
    throw new Error("extractor failed");
  });

  const draft = await buildPasstoAgentDraftFromText(`Implement using ${docPath}`, cwd);
  setPasstoAgentMarkdownExtractor(undefined);

  assert.equal(draft.stage, "builder");
  assert.ok(draft.constraints.includes("Keep the task within the requested scope"));
});
