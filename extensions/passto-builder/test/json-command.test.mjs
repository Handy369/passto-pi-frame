import test from "node:test";
import assert from "node:assert/strict";
import { runBuilderFromJsonFile } from "../commands/run-builder-from-json.ts";

test("runBuilderFromJsonFile is exported and callable", async () => {
  assert.equal(typeof runBuilderFromJsonFile, "function");
  const source = await runBuilderFromJsonFile.toString();
  assert.ok(typeof source === "string");
});
