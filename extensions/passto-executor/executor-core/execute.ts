import { assembleExecutorContext } from "./assembly.ts";
import type { ExecutorInvocation } from "./invocation.ts";
import { buildAggregatedExecutorRunResult, type ExecutorRunResult } from "./result.ts";
import { buildRunManifest, InMemoryExecutorRunStore, resultToStoredRecord, type ExecutorRunStore } from "./run-store.ts";
import { ensurePasstoProjectWorkspace } from "./project-workspace.ts";
import { runExecutorChild, type ExecutorChildResult, type RunExecutorChildParams } from "./runtime.ts";
import { NoopSandboxManager, type SandboxManager } from "./sandbox.ts";
import type { ResolvedExecutorRunContext } from "./context.ts";
import { assertSupportedExecutionMode, planPerspectiveExecution } from "./orchestration.ts";
import { executePlannedItemsInParallel, executePlannedItemsSequentially } from "./execution/execute-plan.ts";

export interface ExecuteInvocationOptions {
  runId: string;
  agent: string;
  extensions?: string[];
  contract?: string;
  runStore?: ExecutorRunStore;
  sandboxManager?: SandboxManager;
  childRunner?: (params: RunExecutorChildParams) => Promise<ExecutorChildResult>;
  onChildProgress?: (update: {
    runId: string;
    perspective: string;
    progress: ExecutorChildResult["progress"] & { usage?: ExecutorChildResult["usage"] };
  }) => void;
}


export async function executeResolvedContext(context: ResolvedExecutorRunContext, options: ExecuteInvocationOptions): Promise<ExecutorRunResult> {
  const runStore = options.runStore ?? new InMemoryExecutorRunStore();
  const sandboxManager = options.sandboxManager ?? new NoopSandboxManager();
  const childRunner = options.childRunner ?? runExecutorChild;
  const plan = planPerspectiveExecution(context);
  assertSupportedExecutionMode(plan.mode, plan.dagValidation);
  await ensurePasstoProjectWorkspace(context.workspace.projectRoot);

  await runStore.createRun(options.runId, buildRunManifest({
    runId: options.runId,
    invocation: context.invocation,
    perspective: plan.items.map((item) => item.perspective.name).join(","),
    workspace: context.workspace,
    runtimePolicy: context.runtimePolicy,
    modelPolicy: context.modelPolicy,
    policyProvenance: context.policyProvenance,
  }));

  const executed = context.runtimePolicy.mode === "parallel" || context.runtimePolicy.mode === "dag"
    ? await executePlannedItemsInParallel({
        runId: options.runId,
        context,
        options,
        runStore,
        sandboxManager,
        childRunner,
      })
    : await executePlannedItemsSequentially({
        runId: options.runId,
        context,
        options,
        runStore,
        sandboxManager,
        childRunner,
      });

  const result = buildAggregatedExecutorRunResult({
    runId: options.runId,
    perspectiveResults: executed.perspectiveResults,
    events: executed.events,
    modelPolicy: context.modelPolicy,
    runtimePolicy: context.runtimePolicy,
    policyProvenance: context.policyProvenance,
  });

  if (result.status === "completed") await runStore.writeResult(options.runId, resultToStoredRecord(result));
  else await runStore.writeFailure(options.runId, resultToStoredRecord(result));

  return result;
}

export async function executeInvocation(invocation: ExecutorInvocation, options: ExecuteInvocationOptions): Promise<ExecutorRunResult> {
  const context = assembleExecutorContext(invocation, { runId: options.runId });
  return executeResolvedContext(context, options);
}
