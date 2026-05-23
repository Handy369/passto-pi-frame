import { selectCurrentXNode } from "./grc-x-node-policy.ts";
import type { RuntimeProofRecord, RuntimeProofSignal, XNode, XNodeModelDocument } from "./types.ts";

export interface PlanCertaintyRuntimeProofInput {
  targetXNodeId: string;
  atRound: number;
  uncertainty: string;
  parameterRequest: string;
  providerUsed: string;
  parallelSubagents?: Array<{ task: string; resultSummary: string; evidence?: string[] }>;
  evidenceExtracted: string[];
  certaintyDelta: string[];
  stateWrite: string;
  exitDecision: string;
  documentProof?: boolean;
}

export interface DirectAnswerFastPathProofInput {
  userInputSummary: string;
  reasonNoXNodeNeeded: string;
  answerOrActionSummary: string;
  evidence?: string[];
  atRound?: number;
}

export function buildPlanCertaintyRuntimeProof(input: PlanCertaintyRuntimeProofInput): RuntimeProofRecord {
  const parallelEvidence = (input.parallelSubagents ?? []).flatMap((subagent, index) => [
    `parallelSubagent[${index + 1}].task: ${subagent.task}`,
    `parallelSubagent[${index + 1}].resultSummary: ${subagent.resultSummary}`,
    ...(subagent.evidence ?? []).map((item) => `parallelSubagent[${index + 1}].evidence: ${item}`),
  ]);

  const stateWriteSucceeded = !/failed|失败|未写入|待持久化/i.test(input.stateWrite);
  const proofStatus = derivePlanCertaintyProofStatus(input, stateWriteSucceeded);

  return {
    targetXNodeId: input.targetXNodeId,
    atRound: input.atRound,
    resultSummary: `plan-certainty-improvement completed with exitDecision=${input.exitDecision}`,
    proofMode: "mixed",
    proofStatus,
    evidence: [
      `uncertainty: ${input.uncertainty}`,
      `parameterRequest: ${input.parameterRequest}`,
      `providerUsed: ${input.providerUsed}`,
      ...parallelEvidence,
      ...input.evidenceExtracted.map((item) => `evidenceExtracted: ${item}`),
      ...input.certaintyDelta.map((item) => `certaintyDelta: ${item}`),
      `stateWrite: ${input.stateWrite}`,
      `exitDecision: ${input.exitDecision}`,
    ],
    verificationMethod: [
      "检查 uncertainty → parameter request → acquisition → evidence → certainty delta → state write → exit decision 证据链",
      "若使用并行 subagent / provider，检查各子任务结果是否已汇合到统一判断",
      ...(input.documentProof ? ["文档 proof 场景允许使用 mixed/passed 表示设计与实施计划证据链已闭合"] : []),
    ],
  };
}

export function derivePlanCertaintyProofSignals(record: RuntimeProofRecord): RuntimeProofSignal[] {
  const signalTypes = selectPlanCertaintySignalTypes(record);
  return signalTypes.map((type) => ({
    id: `proof-${record.targetXNodeId}-${record.atRound}-${type}`,
    targetXNodeId: record.targetXNodeId,
    atRound: record.atRound,
    type,
    message: buildPlanCertaintySignalMessage(record, type),
    suggestedNextStepType: type === "runtime-proof-failed" || type === "runtime-proof-partial" || type === "runtime-proof-missing" || type === "runtime-proof-conflicted"
      ? "run_tests"
      : undefined,
    evidence: record.evidence,
  }));
}

function derivePlanCertaintyProofStatus(
  input: PlanCertaintyRuntimeProofInput,
  stateWriteSucceeded: boolean,
): RuntimeProofRecord["proofStatus"] {
  if (/failed|失败|未通过/i.test(input.exitDecision)) return "failed";
  if (!stateWriteSucceeded) return "partial";
  if (/missing|缺失|不足|blocked|阻塞|open|uncertain|不完整/i.test(input.exitDecision)) return "partial";
  if (input.documentProof) return "passed";
  return "passed";
}

function selectPlanCertaintySignalTypes(record: RuntimeProofRecord): RuntimeProofSignal["type"][] {
  const evidenceText = record.evidence.join("\n");
  if (record.proofStatus === "failed") return ["runtime-proof-failed"];
  if (record.proofStatus === "missing") return ["runtime-proof-missing"];

  const signals: RuntimeProofSignal["type"][] = [];
  if (record.proofStatus === "partial") signals.push("runtime-proof-partial");
  if (/failed|失败|未写入|待持久化|conflict|冲突/i.test(evidenceText)) signals.push("runtime-proof-conflicted");
  return [...new Set(signals)];
}

function buildPlanCertaintySignalMessage(record: RuntimeProofRecord, type: RuntimeProofSignal["type"]): string {
  switch (type) {
    case "runtime-proof-failed":
      return `plan-certainty-improvement proof failed for ${record.targetXNodeId}; inspect evidence chain before continuing.`;
    case "runtime-proof-missing":
      return `plan-certainty-improvement proof is missing for ${record.targetXNodeId}; collect runtime proof before continuing.`;
    case "runtime-proof-conflicted":
      return `plan-certainty-improvement proof has conflicted or unpersisted state write for ${record.targetXNodeId}; emit ProposedXNodeModelPatch if needed.`;
    case "runtime-proof-partial":
      return `plan-certainty-improvement proof is partial for ${record.targetXNodeId}; strengthen evidence or state write before exit.`;
  }
}

export function buildDirectAnswerFastPathProof(input: DirectAnswerFastPathProofInput): RuntimeProofRecord {
  return {
    targetXNodeId: "direct-answer-fast-path",
    atRound: input.atRound ?? 0,
    resultSummary: `Direct answer fast path used: ${input.answerOrActionSummary}`,
    proofMode: "self-proof",
    proofStatus: "passed",
    evidence: [
      `userInputSummary: ${input.userInputSummary}`,
      `reasonNoXNodeNeeded: ${input.reasonNoXNodeNeeded}`,
      `answerOrActionSummary: ${input.answerOrActionSummary}`,
      ...(input.evidence ?? []),
    ],
    verificationMethod: [
      "确认该请求是简单高确定性目的，不依赖项目上下文、多步决策、状态写入或 runtime proof",
      "确认未展开递归 xNodeModel，已直接回答或执行最小动作",
    ],
  };
}

export function deriveRuntimeProofRecord(xNodeModel: XNodeModelDocument | null): RuntimeProofRecord | null {
  if (!xNodeModel) return null;

  const focusNode = selectCurrentXNode(xNodeModel);
  if (!focusNode) return null;

  const proofStatus = deriveProofStatus(focusNode);

  return {
    targetXNodeId: focusNode.id,
    atRound: xNodeModel.agentRound,
    resultSummary: buildProofSummary(focusNode),
    proofMode: deriveProofMode(focusNode, proofStatus),
    proofStatus,
    evidence: [focusNode.runtimeProof.summary, ...(focusNode.runtimeProof.evidence ?? [])].filter(Boolean),
    verificationMethod: focusNode.runtimeProof.method?.length
      ? [...focusNode.runtimeProof.method]
      : buildVerificationMethodFallback(focusNode),
  };
}

export function deriveRuntimeProofSignals(
  xNodeModel: XNodeModelDocument | null,
  proofRecord?: RuntimeProofRecord | null,
): RuntimeProofSignal[] {
  if (!xNodeModel) return [];

  const focusNode = selectCurrentXNode(xNodeModel);
  const record = proofRecord ?? deriveRuntimeProofRecord(xNodeModel);
  if (!focusNode || !record) return [];

  const signalType = mapProofStatusToSignalType(record.proofStatus);
  if (!signalType) return [];

  return [{
    id: `proof-${record.targetXNodeId}-${record.atRound}-${signalType}`,
    targetXNodeId: record.targetXNodeId,
    atRound: record.atRound,
    type: signalType,
    message: buildSignalMessage(focusNode, record),
    suggestedNextStepType: signalType === "runtime-proof-missing" || signalType === "runtime-proof-partial"
      ? "run_tests"
      : undefined,
    evidence: record.evidence,
  }];
}

function deriveProofMode(
  focusNode: XNode,
  proofStatus: RuntimeProofRecord["proofStatus"],
): RuntimeProofRecord["proofMode"] {
  if (proofStatus === "missing") return "self-proof";

  const explicitText = [...(focusNode.runtimeProof.evidence ?? []), ...(focusNode.runtimeProof.method ?? [])]
    .join(" ")
    .toLowerCase();

  if (!explicitText.trim()) return "self-proof";
  if (explicitText.includes("test")) return "tests";
  if (explicitText.includes("runtime") || explicitText.includes("browser") || explicitText.includes("session")) return "runtime";
  if (explicitText.includes("accept") || explicitText.includes("人工") || explicitText.includes("验收")) return "human-check";
  return "self-proof";
}

function deriveProofStatus(focusNode: XNode): RuntimeProofRecord["proofStatus"] {
  if (focusNode.status === "completed" || focusNode.phase === "complete" || focusNode.phase === "pending_acceptance") {
    return focusNode.runtimeProof.confidence === "open" ? "partial" : "passed";
  }

  if (focusNode.phase === "testing") {
    return focusNode.runtimeProof.confidence === "closed" ? "passed" : "partial";
  }

  if (focusNode.runtimeProof.confidence === "closed") return "passed";
  if (focusNode.runtimeProof.confidence === "partial") return "partial";
  return "missing";
}

function buildProofSummary(focusNode: XNode): string {
  return `x-node ${focusNode.id} proof status derived from phase=${focusNode.phase} / confidence=${focusNode.runtimeProof.confidence}`;
}

function buildVerificationMethodFallback(focusNode: XNode): string[] {
  if (focusNode.phase === "testing") {
    return ["运行最小相关测试或 runtime proof，确认当前焦点产物是否成立"];
  }

  if (focusNode.phase === "pending_acceptance") {
    return ["整理现有证据并请求用户验收 / 确认"];
  }

  return ["补充可执行的 runtime proof、测试或人工验收步骤"];
}

function mapProofStatusToSignalType(
  proofStatus: RuntimeProofRecord["proofStatus"],
): RuntimeProofSignal["type"] | null {
  switch (proofStatus) {
    case "failed":
      return "runtime-proof-failed";
    case "partial":
      return "runtime-proof-partial";
    case "missing":
      return "runtime-proof-missing";
    default:
      return null;
  }
}

function buildSignalMessage(focusNode: XNode, proofRecord: RuntimeProofRecord): string {
  switch (proofRecord.proofStatus) {
    case "failed":
      return `当前焦点 ${focusNode.assertion} 的 proof 未通过，应先修复再继续。`;
    case "partial":
      return `当前焦点 ${focusNode.assertion} 的 proof 仍不完整，应优先补强验证证据。`;
    case "missing":
      return `当前焦点 ${focusNode.assertion} 缺少可消费的 proof 记录，应先补运行态或测试证据。`;
    default:
      return `当前焦点 ${focusNode.assertion} 的 proof 状态存在缺口。`;
  }
}
