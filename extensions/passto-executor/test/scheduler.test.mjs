import test from "node:test";
import assert from "node:assert/strict";
import { mapWithConcurrency } from "../executor-core/scheduler.ts";

test("mapWithConcurrency preserves input order while respecting concurrency bound", async () => {
  let active = 0;
  let maxActive = 0;

  const results = await mapWithConcurrency([30, 5, 20, 1], 2, async (delay, index) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, delay));
    active -= 1;
    return `done-${index}`;
  });

  assert.deepEqual(results, ["done-0", "done-1", "done-2", "done-3"]);
  assert.equal(maxActive, 2);
});

test("mapWithConcurrency rejects invalid limits", async () => {
  await assert.rejects(() => mapWithConcurrency([1], 0, async (value) => value), /Invalid concurrency limit/);
});
