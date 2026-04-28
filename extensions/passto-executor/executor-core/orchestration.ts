import type { ResolvedExecutorRunContext, ExecutorPerspectiveSpec } from "./context.ts";
import { validateExecutionDag, type DagValidationResult } from "./dag.ts";

export interface PlannedPerspectiveExecution {
  perspective: ExecutorPerspectiveSpec;
  order: number;
  dependsOn: string[];
}

export interface ExecutorExecutionPlan {
  mode: ResolvedExecutorRunContext["runtimePolicy"]["mode"];
  maxConcurrency?: number;
  items: PlannedPerspectiveExecution[];
  dagValidation?: DagValidationResult;
}

export function planPerspectiveExecution(context: ResolvedExecutorRunContext): ExecutorExecutionPlan {
  const items = context.perspectives.map((perspective, order) => ({
    perspective,
    order,
    dependsOn: [...(perspective.dependsOn ?? [])],
  }));

  return {
    mode: context.runtimePolicy.mode,
    maxConcurrency: context.runtimePolicy.maxConcurrency,
    items,
    dagValidation: validateExecutionDag(items),
  };
}

export function assertSupportedExecutionMode(mode: ResolvedExecutorRunContext["runtimePolicy"]["mode"], dagValidation?: DagValidationResult): void {
  if (mode === "dag" && dagValidation && !dagValidation.ok) {
    throw new Error(`Executor mode 'dag' requires a valid dependency graph. DAG validation failed: ${dagValidation.errors.join("; ")}`);
  }
}
