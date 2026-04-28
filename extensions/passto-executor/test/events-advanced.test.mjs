import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAggregateProgressEvent,
  buildPerspectiveSkippedEvent,
  buildPerspectiveWaitingEvent,
  mapChildRawEventsToExecutorEvents,
} from "../executor-core/events.ts";

test("buildPerspectiveWaitingEvent and buildPerspectiveSkippedEvent shape orchestration events", () => {
  const waiting = buildPerspectiveWaitingEvent({ runId: "run-1", perspective: "reviewer", waitingOn: ["builder"] });
  const skipped = buildPerspectiveSkippedEvent({ runId: "run-1", perspective: "reviewer", reason: "dependency failed" });

  assert.equal(waiting.type, "perspective.waiting");
  assert.deepEqual(waiting.waitingOn, ["builder"]);
  assert.equal(skipped.type, "perspective.skipped");
  assert.equal(skipped.reason, "dependency failed");
});

test("buildAggregateProgressEvent shapes aggregate progress snapshots", () => {
  const event = buildAggregateProgressEvent({
    runId: "run-2",
    completed: 1,
    total: 3,
    active: 1,
    waiting: 1,
    failed: 0,
    skipped: 0,
  });

  assert.equal(event.type, "run.aggregate-progress");
  assert.equal(event.completed, 1);
  assert.equal(event.total, 3);
});

test("mapChildRawEventsToExecutorEvents still emits lifecycle and tool events", () => {
  const events = mapChildRawEventsToExecutorEvents({
    runId: "run-3",
    perspective: "builder",
    phase: "done",
    success: true,
    rawEvents: [
      { type: "tool_execution_start", toolName: "read" },
      { type: "tool_execution_end", toolName: "read" },
    ],
  });

  assert.ok(events.some((event) => event.type === "run.started"));
  assert.ok(events.some((event) => event.type === "perspective.completed"));
  assert.ok(events.some((event) => event.type === "tool.called"));
});
