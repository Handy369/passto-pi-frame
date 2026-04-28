import type { ContractVerificationResult } from "../contracts.ts";
import { parseExecutionContractName, ralphLoopContractVerifier } from "../contracts.ts";

export function verifyExecutionContract(rawContract: string | undefined, task: string, cwd: string, rawEvents: unknown[]): ContractVerificationResult | undefined {
  const name = parseExecutionContractName(rawContract);
  if (!name) return undefined;
  if (name === "ralph-loop") {
    return ralphLoopContractVerifier.verify({ rawEvents, task, cwd });
  }
  return undefined;
}
