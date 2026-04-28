import type { ResolvedExecutorRunContext } from "../context.ts";
import { planPerspectiveExecution } from "../orchestration.ts";
import { buildAggregateProgressEvent, buildPerspectiveSkippedEvent, buildPerspectiveWaitingEvent, type ExecutorEvent } from "../events.ts";
import type { ExecutorPerspectiveResult } from "../result.ts";
import type { ExecutorRunStore } from "../run-store.ts";
import type { RunExecutorChildParams, ExecutorChildResult } from "../runtime.ts";
import type { SandboxManager } from "../sandbox.ts";
import type { ExecuteInvocationOptions } from "../execute.ts";
import { executePerspective } from "./execute-perspective.ts";

export interface ExecutePlannedItemsParams {
  runId: string;
  context: ResolvedExecutorRunContext;
  options: ExecuteInvocationOptions;
  runStore: ExecutorRunStore;
  sandboxManager: SandboxManager;
  childRunner: (params: RunExecutorChildParams) => Promise<ExecutorChildResult>;
}

function buildSkippedPerspectiveResult(params: {
  perspective: string;
  reason: string;
}): ExecutorPerspectiveResult {
  return {
    perspective: params.perspective,
    status: "skipped",
    summaryText: `skipped: ${params.reason}`,
    skipReason: params.reason,
  };
}

function buildProgressSnapshot(params: {
  runId: string;
  states: Map<string, "waiting" | "running" | "completed" | "failed" | "skipped">;
  total: number;
}): ExecutorEvent {
  let completed = 0;
  let active = 0;
  let waiting = 0;
  let failed = 0;
  let skipped = 0;

  for (const state of params.states.values()) {
    if (state === "completed") completed += 1;
    else if (state === "running") active += 1;
    else if (state === "waiting") waiting += 1;
    else if (state === "failed") failed += 1;
    else if (state === "skipped") skipped += 1;
  }

  return buildAggregateProgressEvent({
    runId: params.runId,
    completed,
    total: params.total,
    active,
    waiting,
    failed,
    skipped,
  });
}

async function appendRunEvent(runStore: ExecutorRunStore, runId: string, event: ExecutorEvent): Promise<void> {
  await runStore.appendEvent(runId, event);
}

export async function executePlannedItemsSequentially(params: ExecutePlannedItemsParams): Promise<{ perspectiveResults: ExecutorPerspectiveResult[]; events: ExecutorEvent[] }> {
  const plan = planPerspectiveExecution(params.context);
  const perspectiveResults: ExecutorPerspectiveResult[] = [];
  const events: ExecutorEvent[] = [];

  for (const item of plan.items) {
    const executed = await executePerspective({
      runId: params.runId,
      perspective: item.perspective,
      context: params.context,
      agent: params.options.agent,
      extensions: params.options.extensions,
      sandboxManager: params.sandboxManager,
      childRunner: params.childRunner,
      contract: params.options.contract,
      runStore: params.runStore,
    });
    perspectiveResults.push(executed.perspectiveResult);
    events.push(...executed.events);

    if (params.context.runtimePolicy.mode === "single") break;
    if (executed.perspectiveResult.status === "failed" && params.context.runtimePolicy.mode === "sequential") break;
  }

  return { perspectiveResults, events };
}

export async function executePlannedItemsInParallel(params: ExecutePlannedItemsParams): Promise<{ perspectiveResults: ExecutorPerspectiveResult[]; events: ExecutorEvent[] }> {
  const plan = planPerspectiveExecution(params.context);
  const concurrency = plan.maxConcurrency ?? (plan.items.length || 1);
  const pending = [...plan.items];
  const perspectiveResults: ExecutorPerspectiveResult[] = [];
  const events: ExecutorEvent[] = [];
  const states = new Map<string, "waiting" | "running" | "completed" | "failed" | "skipped">();
  const resultsByPerspective = new Map<string, ExecutorPerspectiveResult>();
  const waitingEventSent = new Set<string>();

  for (const item of pending) {
    states.set(item.perspective.name, item.dependsOn.length > 0 ? "waiting" : "waiting");
  }

  function getRunnableItems() {
    return pending.filter((item) => {
      if (resultsByPerspective.has(item.perspective.name)) return false;
      const state = states.get(item.perspective.name);
      if (state !== "waiting") return false;
      return item.dependsOn.every((dependency) => resultsByPerspective.get(dependency)?.status === "completed");
    });
  }

  function getFailedDependencies(item: typeof pending[number]): string[] {
    return item.dependsOn.filter((dependency) => {
      const status = resultsByPerspective.get(dependency)?.status;
      return status === "failed" || status === "skipped";
    });
  }

  async function recordEvent(event: ExecutorEvent): Promise<void> {
    events.push(event);
    await appendRunEvent(params.runStore, params.runId, event);
  }

  async function recordProgress(): Promise<void> {
    await recordEvent(buildProgressSnapshot({ runId: params.runId, states, total: plan.items.length }));
  }

  async function emitWaitingEvents(): Promise<void> {
    for (const item of pending) {
      if (resultsByPerspective.has(item.perspective.name)) continue;
      if (item.dependsOn.length === 0) continue;
      const unmet = item.dependsOn.filter((dependency) => resultsByPerspective.get(dependency)?.status !== "completed");
      if (unmet.length === 0) continue;
      if (waitingEventSent.has(item.perspective.name)) continue;
      waitingEventSent.add(item.perspective.name);
      await recordEvent(buildPerspectiveWaitingEvent({
        runId: params.runId,
        perspective: item.perspective.name,
        waitingOn: unmet,
      }));
    }
  }

  async function markSkippedDependents(): Promise<void> {
    let changed = true;
    while (changed) {
      changed = false;
      for (const item of pending) {
        if (resultsByPerspective.has(item.perspective.name)) continue;
        const failedDependencies = getFailedDependencies(item);
        if (failedDependencies.length === 0) continue;
        const reason = `required dependency failed or was skipped: ${failedDependencies.join(", ")}`;
        const result = buildSkippedPerspectiveResult({ perspective: item.perspective.name, reason });
        resultsByPerspective.set(item.perspective.name, result);
        perspectiveResults.push(result);
        states.set(item.perspective.name, "skipped");
        await recordEvent(buildPerspectiveSkippedEvent({
          runId: params.runId,
          perspective: item.perspective.name,
          reason,
        }));
        changed = true;
      }
    }
  }

  await emitWaitingEvents();
  await recordProgress();

  while (resultsByPerspective.size < plan.items.length) {
    await markSkippedDependents();

    const runnable = getRunnableItems();
    if (runnable.length === 0) {
      if (resultsByPerspective.size === plan.items.length) break;
      const unresolved = pending
        .filter((item) => !resultsByPerspective.has(item.perspective.name))
        .map((item) => item.perspective.name);
      throw new Error(`DAG scheduler stalled with unresolved perspectives: ${unresolved.join(", ")}`);
    }

    const batch = runnable.slice(0, concurrency);
    for (const item of batch) states.set(item.perspective.name, "running");
    await recordProgress();

    const executedBatch = await Promise.all(batch.map(async (item) => {
      const executed = await executePerspective({
        runId: params.runId,
        perspective: item.perspective,
        context: params.context,
        agent: params.options.agent,
        extensions: params.options.extensions,
        sandboxManager: params.sandboxManager,
        childRunner: params.childRunner,
        contract: params.options.contract,
        runStore: params.runStore,
      });
      return { item, executed };
    }));

    for (const { item, executed } of executedBatch) {
      resultsByPerspective.set(item.perspective.name, executed.perspectiveResult);
      perspectiveResults.push(executed.perspectiveResult);
      states.set(item.perspective.name, executed.perspectiveResult.status);
      events.push(...executed.events);
    }

    await markSkippedDependents();
    await emitWaitingEvents();
    await recordProgress();
  }

  const orderedPerspectiveResults = plan.items
    .map((item) => resultsByPerspective.get(item.perspective.name))
    .filter((item): item is ExecutorPerspectiveResult => Boolean(item));

  return {
    perspectiveResults: orderedPerspectiveResults,
    events,
  };
}
