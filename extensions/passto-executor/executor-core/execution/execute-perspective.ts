import { mapChildRawEventsToExecutorEvents, type ExecutorEvent } from "../events.ts";
import { buildExecutorPerspectiveResult, type ExecutorPerspectiveResult } from "../result.ts";
import type { ExecutorRunStore } from "../run-store.ts";
import type { RunExecutorChildParams, ExecutorChildResult } from "../runtime.ts";
import type { SandboxManager } from "../sandbox.ts";
import type { ResolvedExecutorRunContext, ExecutorPerspectiveSpec } from "../context.ts";
import { buildRunExecutorChildParams } from "./runtime-param-builder.ts";
import { verifyExecutionContract } from "./contract-verification.ts";

export interface ExecutePerspectiveParams {
  runId: string;
  perspective: ExecutorPerspectiveSpec;
  context: ResolvedExecutorRunContext;
  agent: string;
  extensions?: string[];
  sandboxManager: SandboxManager;
  childRunner: (params: RunExecutorChildParams) => Promise<ExecutorChildResult>;
  contract?: string;
  runStore: ExecutorRunStore;
}

export async function executePerspective(params: ExecutePerspectiveParams): Promise<{ perspectiveResult: ExecutorPerspectiveResult; events: ExecutorEvent[] }> {
  const sandbox = await params.sandboxManager.createPerspectiveSandbox({
    runId: params.runId,
    perspective: params.perspective.name,
    projectRoot: params.context.workspace.projectRoot,
    preserveOnFailure: params.context.runtimePolicy.preserveSandboxOnFailure,
    cleanupPolicy: params.context.runtimePolicy.sandboxCleanupPolicy,
  });

  let childSucceeded = false;

  try {
    const childResult = await params.childRunner(buildRunExecutorChildParams({
      context: params.context,
      perspective: params.perspective,
      defaultAgent: params.agent,
      defaultExtensions: params.extensions,
      cwd: sandbox.root,
      contract: params.contract,
    }));
    childSucceeded = childResult.success;

    const events = mapChildRawEventsToExecutorEvents({
      runId: params.runId,
      perspective: params.perspective.name,
      rawEvents: childResult.rawEvents,
      stopReason: childResult.stopReason,
      success: childResult.success,
      phase: childResult.progress.phase,
    });
    for (const event of events) await params.runStore.appendEvent(params.runId, event);

    const contract = verifyExecutionContract(
      params.contract ?? params.perspective.contract?.name,
      params.perspective.task,
      sandbox.root,
      childResult.rawEvents,
    );

    return {
      perspectiveResult: buildExecutorPerspectiveResult({
        perspective: params.perspective.name,
        childResult,
        contract,
      }),
      events,
    };
  } finally {
    await sandbox.cleanup({ success: childSucceeded });
  }
}
