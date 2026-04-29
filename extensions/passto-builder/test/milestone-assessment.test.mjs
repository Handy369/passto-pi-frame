import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("bootstrap milestone assessment documents milestone as met", async () => {
  const content = await readFile(new URL("../BOOTSTRAP_MILESTONE_ASSESSMENT.md", import.meta.url), "utf8");
  assert.match(content, /The first meaningful bootstrap milestone is satisfied/);
  assert.match(content, /Status: \*\*met\*\*/);
});
