export type ExecutorEvent =
  | { type: "run.started"; runId: string; timestamp: string }
  | { type: "run.progress"; runId: string; timestamp: string; phase?: string }
  | { type: "run.aggregate-progress"; runId: string; timestamp: string; completed: number; total: number; active: number; waiting: number; failed: number; skipped: number }
  | { type: "run.completed"; runId: string; timestamp: string }
  | { type: "run.failed"; runId: string; timestamp: string; reason?: string }
  | { type: "perspective.started"; runId: string; perspective: string; timestamp: string }
  | { type: "perspective.waiting"; runId: string; perspective: string; timestamp: string; waitingOn: string[] }
  | { type: "perspective.progress"; runId: string; perspective: string; timestamp: string; phase?: string }
  | { type: "perspective.completed"; runId: string; perspective: string; timestamp: string }
  | { type: "perspective.failed"; runId: string; perspective: string; timestamp: string; reason?: string }
  | { type: "perspective.skipped"; runId: string; perspective: string; timestamp: string; reason: string }
  | { type: "tool.called"; runId: string; perspective: string; toolName: string; timestamp: string }
  | { type: "tool.completed"; runId: string; perspective: string; toolName: string; timestamp: string };

function createTimestamp(): string {
  return new Date().toISOString();
}

export function buildPerspectiveWaitingEvent(params: { runId: string; perspective: string; waitingOn: string[] }): ExecutorEvent {
  return {
    type: "perspective.waiting",
    runId: params.runId,
    perspective: params.perspective,
    timestamp: createTimestamp(),
    waitingOn: [...params.waitingOn],
  };
}

export function buildPerspectiveSkippedEvent(params: { runId: string; perspective: string; reason: string }): ExecutorEvent {
  return {
    type: "perspective.skipped",
    runId: params.runId,
    perspective: params.perspective,
    timestamp: createTimestamp(),
    reason: params.reason,
  };
}

export function buildAggregateProgressEvent(params: { runId: string; completed: number; total: number; active: number; waiting: number; failed: number; skipped: number }): ExecutorEvent {
  return {
    type: "run.aggregate-progress",
    runId: params.runId,
    timestamp: createTimestamp(),
    completed: params.completed,
    total: params.total,
    active: params.active,
    waiting: params.waiting,
    failed: params.failed,
    skipped: params.skipped,
  };
}

export function mapChildRawEventsToExecutorEvents(params: {
  runId: string;
  perspective: string;
  rawEvents?: unknown[];
  stopReason?: string;
  success?: boolean;
  phase?: string;
}): ExecutorEvent[] {
  const timestamp = createTimestamp();
  const events: ExecutorEvent[] = [
    { type: "run.started", runId: params.runId, timestamp },
    { type: "perspective.started", runId: params.runId, perspective: params.perspective, timestamp },
  ];

  if (params.phase) {
    events.push(
      { type: "run.progress", runId: params.runId, timestamp, phase: params.phase },
      { type: "perspective.progress", runId: params.runId, perspective: params.perspective, timestamp, phase: params.phase },
    );
  }

  for (const event of params.rawEvents ?? []) {
    if (!event || typeof event !== "object") continue;
    const typed = event as { type?: unknown; toolName?: unknown };
    if (typed.type === "tool_execution_start" && typeof typed.toolName === "string") {
      events.push({ type: "tool.called", runId: params.runId, perspective: params.perspective, toolName: typed.toolName, timestamp });
    }
    if (typed.type === "tool_execution_end" && typeof typed.toolName === "string") {
      events.push({ type: "tool.completed", runId: params.runId, perspective: params.perspective, toolName: typed.toolName, timestamp });
    }
  }

  events.push(
    params.success
      ? { type: "perspective.completed", runId: params.runId, perspective: params.perspective, timestamp }
      : { type: "perspective.failed", runId: params.runId, perspective: params.perspective, timestamp, reason: params.stopReason },
  );
  events.push(
    params.success
      ? { type: "run.completed", runId: params.runId, timestamp }
      : { type: "run.failed", runId: params.runId, timestamp, reason: params.stopReason },
  );
  return events;
}
