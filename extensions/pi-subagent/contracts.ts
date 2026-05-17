export type ExecutionContract = "ralph-loop";

export interface RalphLoopContractResult {
  executionContract: "ralph-loop";
  contractSatisfied: boolean;
  reason?: string;
  ralphStartObserved?: boolean;
  ralphDoneObserved?: boolean;
  ralphStateFileFound?: boolean;
  ralphIterationAdvanced?: boolean;
  ralphTaskFileUpdated?: boolean;
  ralphStateFilePath?: string;
  ralphTaskFilePath?: string;
}

export type ExecutionContractResult = RalphLoopContractResult;

export function parseExecutionContract(raw: unknown): ExecutionContract | null {
  if (raw === undefined) return null;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "ralph-loop") return "ralph-loop";
  return null;
}
