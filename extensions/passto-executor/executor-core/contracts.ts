import { verifyRalphLoop } from "../../pi-subagent/ralph-verification.ts";

export type ExecutionContractName = "ralph-loop";

export interface ContractVerificationResult {
  name: string;
  satisfied: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface ContractVerifier {
  name: ExecutionContractName;
  verify(params: {
    rawEvents?: unknown[];
    task: string;
    cwd: string;
  }): ContractVerificationResult;
}

export const ralphLoopContractVerifier: ContractVerifier = {
  name: "ralph-loop",
  verify(params) {
    const result = verifyRalphLoop(params);
    return {
      name: "ralph-loop",
      satisfied: result.contractSatisfied,
      reason: result.reason,
      details: {
        ralphStartObserved: result.ralphStartObserved,
        ralphDoneObserved: result.ralphDoneObserved,
        ralphStateFileFound: result.ralphStateFileFound,
        ralphIterationAdvanced: result.ralphIterationAdvanced,
        ralphTaskFileUpdated: result.ralphTaskFileUpdated,
        ralphStateFilePath: result.ralphStateFilePath,
        ralphTaskFilePath: result.ralphTaskFilePath,
      },
    };
  },
};

export function parseExecutionContractName(raw: unknown): ExecutionContractName | null {
  return raw === "ralph-loop" ? "ralph-loop" : null;
}
