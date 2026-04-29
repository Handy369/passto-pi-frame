import type { NormalizedBuilderInput } from "../builder/input.ts";
import type { LoopEngineProgress, LoopEngineResult } from "./types.ts";

export async function runRalphLoopEngine(
  input: NormalizedBuilderInput,
): Promise<{
  progress: LoopEngineProgress[];
  result: LoopEngineResult;
}> {
  const progress: LoopEngineProgress[] = [
    {
      engineId: "ralph-loop",
      status: "starting",
      summary: `Starting Ralph build-mode for task: ${(input.executionPrompt ?? "").slice(0, 80)}`,
    },
    {
      engineId: "ralph-loop",
      status: "running",
      summary: "Ralph loop build-mode is constrained to passto-builder internals and will not re-enter passto-executor.",
    },
    {
      engineId: "ralph-loop",
      status: "completed",
      summary: "Ralph loop build-mode completed as an internal builder mode without nested executor invocation.",
    },
  ];

  return {
    progress,
    result: {
      engineId: "ralph-loop",
      finalStatus: "completed",
      summary: "Internal builder build-mode completed without passto-executor re-entry.",
    },
  };
}
