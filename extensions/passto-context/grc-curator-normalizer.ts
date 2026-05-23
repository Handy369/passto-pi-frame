import { isGoalTreeDocument } from './grc-goal-tree.ts';
import type { CertaintyAssessment, CuratorArtifactEntry, CuratorResult, GoalStateAny, RuntimeProofRecord, RuntimeProofSignal, SummaryEntry, UserGoalTreeDocument, XNodeModelDocument } from './types.ts';

export function normalizeCuratorResultAgentRound(
  result: CuratorResult | null,
  targetAgentRound: number,
): CuratorResult | null {
  if (!result) {
    return null;
  }

  const normalizedGoalState = normalizeGoalStateAgentRound(result.goalState, targetAgentRound);
  const normalizedUserGoalTree = normalizeUserGoalTreeAgentRound(result.userGoalTree ?? null, targetAgentRound);
  const normalizedXNodeModels = normalizeXNodeModelsAgentRound(result.xNodeModels ?? null, targetAgentRound);
  const normalizedPolicyProjection = result.lastPolicyProjection
    ? {
        ...result.lastPolicyProjection,
        derivedAtRound: targetAgentRound,
      }
    : null;
  const fallbackFocusModel = selectProofFallbackXNodeModel(normalizedXNodeModels, normalizedUserGoalTree, normalizedPolicyProjection);
  const normalizedRuntimeProof = normalizeRuntimeProofRecord(
    result.latestRuntimeProof ?? fallbackFocusModel?.latestRuntimeProof ?? null,
    targetAgentRound,
  );
  const normalizedProofSignals = normalizeRuntimeProofSignals(
    result.latestProofSignals
      ?? fallbackFocusModel?.latestProofSignals
      ?? buildFallbackRuntimeProofSignals(normalizedRuntimeProof, targetAgentRound),
    targetAgentRound,
  );

  return {
    ...result,
    summaryEntry: normalizeSummaryEntryAgentRound(result.summaryEntry, targetAgentRound),
    goalState: normalizedGoalState,
    userGoalTree: normalizedUserGoalTree,
    xNodeModels: normalizedXNodeModels,
    reconciliationOps: result.reconciliationOps ?? null,
    reconciliationWarnings: result.reconciliationWarnings ?? [],
    auditAdvice: result.auditAdvice ?? null,
    lastPolicyProjection: normalizedPolicyProjection,
    closureEvidence: Array.isArray(result.closureEvidence) ? result.closureEvidence : [],
    certaintyAssessment: normalizeCertaintyAssessment(
      result.certaintyAssessment ?? null,
      normalizedPolicyProjection,
      fallbackFocusModel?.latestPolicyProjection ?? null,
      normalizedGoalState,
    ),
    latestRuntimeProof: normalizedRuntimeProof,
    latestProofSignals: normalizedProofSignals,
    draftGoalOp: result.draftGoalOp ?? null,
    draftDispositions: result.draftDispositions ?? null,
  };
}

export function normalizeCuratorArtifactAgentRound(
  artifact: CuratorArtifactEntry,
): CuratorArtifactEntry {
  const normalizedGoalState = normalizeGoalStateAgentRound(artifact.goalState, artifact.agentRound);
  const normalizedUserGoalTree = normalizeUserGoalTreeAgentRound(artifact.userGoalTree ?? null, artifact.agentRound);
  const normalizedXNodeModels = normalizeXNodeModelsAgentRound(artifact.xNodeModels ?? null, artifact.agentRound);
  const normalizedPolicyProjection = artifact.lastPolicyProjection
    ? {
        ...artifact.lastPolicyProjection,
        derivedAtRound: artifact.agentRound,
      }
    : null;
  const fallbackFocusModel = selectProofFallbackXNodeModel(normalizedXNodeModels, normalizedUserGoalTree, normalizedPolicyProjection);

  return {
    ...artifact,
    summaryEntry: normalizeSummaryEntryAgentRound(artifact.summaryEntry, artifact.agentRound),
    goalState: normalizedGoalState,
    userGoalTree: normalizedUserGoalTree,
    xNodeModels: normalizedXNodeModels,
    reconciliationOps: artifact.reconciliationOps ?? null,
    reconciliationWarnings: artifact.reconciliationWarnings ?? [],
    auditAdvice: artifact.auditAdvice ?? null,
    certaintyAssessment: normalizeCertaintyAssessment(
      artifact.certaintyAssessment ?? null,
      normalizedPolicyProjection,
      fallbackFocusModel?.latestPolicyProjection ?? null,
      normalizedGoalState,
    ),
    lastPolicyProjection: normalizedPolicyProjection,
    latestRuntimeProof: artifact.latestRuntimeProof
      ? {
          ...artifact.latestRuntimeProof,
          atRound: artifact.agentRound,
        }
      : null,
    latestProofSignals: artifact.latestProofSignals?.map((signal) => ({
      ...signal,
      atRound: artifact.agentRound,
    })) ?? null,
  };
}

function normalizeSummaryEntryAgentRound(
  summaryEntry: SummaryEntry | null,
  targetAgentRound: number,
): SummaryEntry | null {
  if (!summaryEntry) {
    return null;
  }

  return {
    ...summaryEntry,
    agentRound: targetAgentRound,
  };
}

function normalizeGoalStateAgentRound(
  goalState: GoalStateAny | null,
  targetAgentRound: number,
): GoalStateAny | null {
  if (!goalState) {
    return null;
  }

  return {
    ...goalState,
    agentRound: targetAgentRound,
  };
}

function normalizeUserGoalTreeAgentRound(
  userGoalTree: UserGoalTreeDocument | null,
  targetAgentRound: number,
): UserGoalTreeDocument | null {
  if (!userGoalTree) return null;
  return {
    ...userGoalTree,
    agentRound: targetAgentRound,
  };
}

function normalizeXNodeModelsAgentRound(
  xNodeModels: XNodeModelDocument[] | null,
  targetAgentRound: number,
): XNodeModelDocument[] | null {
  if (!xNodeModels) return null;
  return xNodeModels.map((model) => ({
    ...model,
    agentRound: targetAgentRound,
    latestRuntimeProof: model.latestRuntimeProof
      ? { ...model.latestRuntimeProof, atRound: targetAgentRound }
      : model.latestRuntimeProof,
    latestProofSignals: model.latestProofSignals?.map((signal) => ({ ...signal, atRound: targetAgentRound })),
    latestPolicyProjection: model.latestPolicyProjection
      ? { ...model.latestPolicyProjection, derivedAtRound: targetAgentRound }
      : model.latestPolicyProjection,
  }));
}

function normalizeRuntimeProofRecord(
  proofRecord: RuntimeProofRecord | null,
  targetAgentRound: number,
): RuntimeProofRecord | null {
  if (!proofRecord) return null;
  return {
    ...proofRecord,
    atRound: targetAgentRound,
  };
}

function normalizeRuntimeProofSignals(
  proofSignals: RuntimeProofSignal[] | null,
  targetAgentRound: number,
): RuntimeProofSignal[] | null {
  if (!proofSignals) return null;
  return proofSignals.map((signal, index) => ({
    ...signal,
    id: normalizeRuntimeProofSignalId(signal, targetAgentRound, index),
    atRound: targetAgentRound,
  }));
}

function selectProofFallbackXNodeModel(
  xNodeModels: XNodeModelDocument[] | null,
  userGoalTree: UserGoalTreeDocument | null,
  lastPolicyProjection: CuratorResult["lastPolicyProjection"],
): XNodeModelDocument | null {
  if (!xNodeModels?.length) return null;

  if (userGoalTree?.currentFocusUserGoalId) {
    const focusedModel = xNodeModels.find((model) => model.userGoalId === userGoalTree.currentFocusUserGoalId);
    if (focusedModel) return focusedModel;
  }

  if (lastPolicyProjection?.xNodeId) {
    const projectedModel = xNodeModels.find((model) => model.currentFocusXNodeId === lastPolicyProjection.xNodeId);
    if (projectedModel) return projectedModel;
  }

  return xNodeModels.find((model) => Boolean(model.latestRuntimeProof) || Boolean(model.latestProofSignals?.length)) ?? xNodeModels[0] ?? null;
}

function buildFallbackRuntimeProofSignals(
  proofRecord: RuntimeProofRecord | null,
  targetAgentRound: number,
): RuntimeProofSignal[] | null {
  if (!proofRecord || proofRecord.proofStatus === 'passed') {
    return null;
  }

  const type = mapProofStatusToSignalType(proofRecord.proofStatus);
  if (!type) {
    return null;
  }

  return [{
    id: buildRuntimeProofSignalId(proofRecord.targetXNodeId, targetAgentRound, type),
    targetXNodeId: proofRecord.targetXNodeId,
    atRound: targetAgentRound,
    type,
    message: buildRuntimeProofSignalMessage(proofRecord),
    suggestedNextStepType: type === 'runtime-proof-missing' || type === 'runtime-proof-partial' ? 'run_tests' : undefined,
    evidence: proofRecord.evidence,
  }];
}

function normalizeRuntimeProofSignalId(
  signal: RuntimeProofSignal,
  targetAgentRound: number,
  index: number,
): string {
  const trimmedId = signal.id?.trim();
  if (trimmedId) {
    return trimmedId;
  }
  return buildRuntimeProofSignalId(signal.targetXNodeId, targetAgentRound, signal.type, index);
}

function buildRuntimeProofSignalId(
  targetXNodeId: string,
  atRound: number,
  type: RuntimeProofSignal['type'],
  index = 0,
): string {
  return `proof-${targetXNodeId}-${atRound}-${type}${index > 0 ? `-${index + 1}` : ''}`;
}

function mapProofStatusToSignalType(
  proofStatus: RuntimeProofRecord['proofStatus'],
): RuntimeProofSignal['type'] | null {
  switch (proofStatus) {
    case 'failed':
      return 'runtime-proof-failed';
    case 'partial':
      return 'runtime-proof-partial';
    case 'missing':
      return 'runtime-proof-missing';
    default:
      return null;
  }
}

function buildRuntimeProofSignalMessage(
  proofRecord: RuntimeProofRecord,
): string {
  switch (proofRecord.proofStatus) {
    case 'failed':
      return `x-node ${proofRecord.targetXNodeId} 的 proof 未通过，应先修复再继续。`;
    case 'partial':
      return `x-node ${proofRecord.targetXNodeId} 的 proof 仍不完整，应优先补强验证证据。`;
    case 'missing':
      return `x-node ${proofRecord.targetXNodeId} 缺少可消费的 proof 记录，应先补运行态或测试证据。`;
    default:
      return `x-node ${proofRecord.targetXNodeId} 的 proof 存在缺口。`;
  }
}

function normalizeCertaintyAssessment(
  certaintyAssessment: CertaintyAssessment | null,
  policyProjection: CuratorResult['lastPolicyProjection'] | null,
  fallbackModelPolicyProjection: XNodeModelDocument['latestPolicyProjection'] | null,
  goalState: GoalStateAny | null,
): CertaintyAssessment | null {
  if (certaintyAssessment) {
    return certaintyAssessment;
  }

  const effectivePolicyProjection = policyProjection ?? fallbackModelPolicyProjection ?? null;
  if (effectivePolicyProjection) {
    return {
      dimensions: { ...effectivePolicyProjection.dimensions },
      keyGaps: [...effectivePolicyProjection.keyGaps],
      nextStepType: effectivePolicyProjection.nextStepType,
      confidence: effectivePolicyProjection.confidence,
    };
  }

  if (!goalState || !isGoalTreeDocument(goalState)) {
    return null;
  }

  return {
    dimensions: {
      why: 'partial',
      what: 'partial',
      flow: 'open',
      structure: 'partial',
      runtimeProof: 'open',
    },
    keyGaps: ['Curator 未显式产出 certaintyAssessment，且缺少 object policy，已回填保守默认值'],
    nextStepType: 'plan_repair',
    confidence: 0.3,
  };
}
