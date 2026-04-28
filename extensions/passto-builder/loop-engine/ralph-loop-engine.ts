import type { NormalizedBuilderInput } from "../builder/input.ts";
import {
  buildExecutorBridgeRequest,
  executeBuilderThroughPasstoExecutor,
  type BuilderExecutorInvoker,
} from "../executor-bridge/passto-executor-bridge.ts";
import type { LoopEngineProgress, LoopEngineResult } from "./types.ts";

export async function runRalphLoopEngine(
  input: NormalizedBuilderInput,
  invoker?: BuilderExecutorInvoker,
): Promise<{
  progress: LoopEngineProgress[];
  result: LoopEngineResult;
}> {
  const bridgeRequest = buildExecutorBridgeRequest(input);
  const progress: LoopEngineProgress[] = [
    {
      engineId: "ralph-loop",
      status: "starting",
      summary: `Starting Ralph loop for task: ${input.task.slice(0, 80)}`,
    },
    {
      engineId: "ralph-loop",
      status: "running",
      summary: `Prepared executor bridge request for cwd ${bridgeRequest.cwd}`,
    },
  ];

  const executorResult = await executeBuilderThroughPasstoExecutor(input, invoker);
  progress.push({
    engineId: "ralph-loop",
    status: executorResult.status === "failed" ? "failed" : "completed",
    summary: `Executor run ${executorResult.runId} finished with status ${executorResult.status}`,
  });

  return {
    progress,
    result: {
      engineId: "ralph-loop",
      finalStatus: executorResult.status === "failed" ? "failed" : "completed",
      summary: executorResult.summaryText,
    },
  };
}
