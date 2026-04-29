import type { BuilderInput, BuilderResult, BuilderStateSnapshot } from "./contracts.ts";
import { normalizeBuilderInput } from "./input.ts";
import { createInitialBuilderState } from "./state.ts";
import { toBuilderStateSnapshot } from "./status.ts";
import { toBuilderResult } from "./result.ts";
import { runBuilderWorkflow } from "./workflow.ts";
import type { BuilderWorkflowServices } from "./test-seams.ts";

export type BuilderRunResponse = {
  snapshots: BuilderStateSnapshot[];
  result: BuilderResult;
};

function assertBuilderInvocationAllowed(input: BuilderInput): void {
  if (input.invocationSource !== "passto-executor") {
    throw new Error(
      "run_builder_task must not be used as a top-level execution entry. Invoke builder runs through passto-executor instead.",
    );
  }
}

export async function runBuilder(
  input: BuilderInput,
  services: BuilderWorkflowServices = {},
): Promise<BuilderRunResponse> {
  assertBuilderInvocationAllowed(input);
  const normalized = normalizeBuilderInput(input);
  const state = createInitialBuilderState(normalized);
  const snapshots: BuilderStateSnapshot[] = [toBuilderStateSnapshot(state)];

  state.phase = "prepare";
  state.status = "preparing";
  state.currentAction = "Preparing builder run";
  state.summary = "Builder run initialization complete";
  snapshots.push(toBuilderStateSnapshot(state));

  const finalState = await runBuilderWorkflow(state, (nextState) => {
    snapshots.push(toBuilderStateSnapshot(nextState));
  }, services);
  snapshots.push(toBuilderStateSnapshot(finalState));
  return {
    snapshots,
    result: toBuilderResult(finalState),
  };
}
