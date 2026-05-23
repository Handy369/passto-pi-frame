import type { CuratorArtifactEntry, GRCState, ReflectorArtifactEntry } from './types.ts';
import { parseDraftGoalOp } from './grc-draft-goal.ts';
import { normalizeCuratorArtifactAgentRound } from './grc-curator-normalizer.ts';
import { normalizeReflectorAssetCandidates } from './grc-reflector-assets.ts';
import { normalizeReflectorDiagnosis } from './grc-reflector-diagnosis.ts';
import { pushSummaryCacheEntry, setCuratorObjectSidecars, setRuntimeProvisionalOverlay, updateCuratorStatus, updateReflectorStatus } from './grc-state.ts';

export interface RestoreReplayResult {
  state: GRCState;
  curatorArtifactsRejected: number;
  restoredCuratorArtifactRounds: number[];
  reflectorArtifactsRejected: number;
  restoredReflectorArtifactRounds: number[];
}

export function parseCuratorArtifactEntry(data: unknown): CuratorArtifactEntry | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Partial<CuratorArtifactEntry>;
  if (typeof value.agentRound !== 'number') return null;
  if (typeof value.recordedAt !== 'string') return null;
  if (typeof value.processedUpToUserTurn !== 'number') return null;

  return {
    customType: 'grc-curator-artifact',
    agentRound: value.agentRound,
    recordedAt: value.recordedAt,
    processedUpToUserTurn: value.processedUpToUserTurn,
    summary: typeof value.summary === 'string' || value.summary === null ? (value.summary ?? null) : null,
    summaryEntry: value.summaryEntry && typeof value.summaryEntry === 'object' ? value.summaryEntry : null,
    goalState: value.goalState && typeof value.goalState === 'object' ? value.goalState : null,
    userGoalTree: value.userGoalTree && typeof value.userGoalTree === 'object' ? value.userGoalTree as CuratorArtifactEntry['userGoalTree'] : null,
    xNodeModels: Array.isArray(value.xNodeModels) ? value.xNodeModels as CuratorArtifactEntry['xNodeModels'] : null,
    reconciliationOps: Array.isArray(value.reconciliationOps) ? value.reconciliationOps as CuratorArtifactEntry['reconciliationOps'] : null,
    reconciliationWarnings: Array.isArray(value.reconciliationWarnings) ? value.reconciliationWarnings.filter((item): item is string => typeof item === 'string') : [],
    auditAdvice: value.auditAdvice && typeof value.auditAdvice === 'object' ? value.auditAdvice as CuratorArtifactEntry['auditAdvice'] : null,
    signal: value.signal && typeof value.signal === 'object' ? value.signal : null,
    certaintyAssessment: value.certaintyAssessment && typeof value.certaintyAssessment === 'object' ? value.certaintyAssessment as CuratorArtifactEntry['certaintyAssessment'] : null,
    lastPolicyProjection: value.lastPolicyProjection && typeof value.lastPolicyProjection === 'object' ? value.lastPolicyProjection as CuratorArtifactEntry['lastPolicyProjection'] : null,
    latestRuntimeProof: value.latestRuntimeProof && typeof value.latestRuntimeProof === 'object' ? value.latestRuntimeProof as CuratorArtifactEntry['latestRuntimeProof'] : null,
    latestProofSignals: Array.isArray(value.latestProofSignals) ? value.latestProofSignals as CuratorArtifactEntry['latestProofSignals'] : null,
    draftGoalOp: parseDraftGoalOp(value.draftGoalOp),
    draftDispositions: Array.isArray(value.draftDispositions) ? value.draftDispositions as CuratorArtifactEntry['draftDispositions'] : null,
    runtimeProvisionalOverlay: value.runtimeProvisionalOverlay && typeof value.runtimeProvisionalOverlay === 'object' ? value.runtimeProvisionalOverlay as CuratorArtifactEntry['runtimeProvisionalOverlay'] : null,
    latestGoalTransition: value.latestGoalTransition && typeof value.latestGoalTransition === 'object' ? value.latestGoalTransition as CuratorArtifactEntry['latestGoalTransition'] : null,
  };
}

export function parseReflectorArtifactEntry(data: unknown): ReflectorArtifactEntry | null {
  if (!data || typeof data !== 'object') return null;
  const value = data as Partial<ReflectorArtifactEntry>;
  if (typeof value.agentRound !== 'number') return null;
  if (typeof value.recordedAt !== 'string') return null;

  return {
    customType: 'grc-reflector-artifact',
    agentRound: value.agentRound,
    recordedAt: value.recordedAt,
    diagnosis: value.diagnosis === null ? null : normalizeReflectorDiagnosis(value.diagnosis) ?? null,
    advice: typeof value.advice === 'string' || value.advice === null ? (value.advice ?? null) : null,
    principleOps: Array.isArray(value.principleOps) ? value.principleOps.filter((item) => !!item) as ReflectorArtifactEntry['principleOps'] : [],
    assetCandidates: normalizeReflectorAssetCandidates(value.assetCandidates),
  };
}

function hasUsableObjectSidecars(artifact: CuratorArtifactEntry): boolean {
  return Boolean(artifact.userGoalTree?.userGoals?.length && artifact.xNodeModels?.length);
}

export function replayCuratorArtifacts(state: GRCState, artifacts: CuratorArtifactEntry[], maxSize: number): GRCState {
  let nextState = updateCuratorStatus(
    state,
    state.curator.status,
    null,
    0,
    state.curator.principlesExtracted,
    null,
    null,
    [],
    null,
    null,
    undefined,
  );

  for (const artifact of artifacts) {
    const normalizedArtifact = normalizeCuratorArtifactAgentRound(artifact);
    nextState = updateCuratorStatus(
      nextState,
      'done',
      normalizedArtifact.summary,
      normalizedArtifact.processedUpToUserTurn,
      nextState.curator.principlesExtracted,
      normalizedArtifact.summaryEntry,
      normalizedArtifact.goalState,
      undefined,
      normalizedArtifact.signal,
      normalizedArtifact.certaintyAssessment ?? null,
      normalizedArtifact.agentRound,
      undefined,
      normalizedArtifact.agentRound,
      normalizedArtifact.latestGoalTransition ?? null,
    );
    if (hasUsableObjectSidecars(normalizedArtifact)) {
      nextState = setCuratorObjectSidecars(nextState, {
        userGoalTree: normalizedArtifact.userGoalTree ?? null,
        xNodeModels: normalizedArtifact.xNodeModels ?? [],
        lastPolicyProjection: normalizedArtifact.lastPolicyProjection ?? undefined,
        latestRuntimeProof: normalizedArtifact.latestRuntimeProof ?? undefined,
        latestProofSignals: normalizedArtifact.latestProofSignals ?? undefined,
      });
    }
    nextState = setRuntimeProvisionalOverlay(nextState, normalizedArtifact.runtimeProvisionalOverlay ?? null);
    if (normalizedArtifact.summaryEntry) {
      nextState = pushSummaryCacheEntry(nextState, normalizedArtifact.summaryEntry, maxSize).state;
    }
  }

  return nextState;
}

export function replayReflectorArtifacts(state: GRCState, artifacts: ReflectorArtifactEntry[]): GRCState {
  let nextState = state;

  for (const artifact of artifacts) {
    nextState = updateReflectorStatus(
      nextState,
      'done',
      artifact.advice,
      undefined,
      artifact.agentRound,
      artifact.agentRound,
      artifact.diagnosis,
    );
  }

  return nextState;
}

export function restoreCuratorStateFromBranchEntries(
  baseState: GRCState,
  entries: Array<{ type?: string; customType?: string; data?: unknown }>,
  maxSize: number,
): RestoreReplayResult {
  let state = baseState;
  const curatorArtifacts: CuratorArtifactEntry[] = [];
  const reflectorArtifacts: ReflectorArtifactEntry[] = [];
  let curatorArtifactsRejected = 0;
  let reflectorArtifactsRejected = 0;

  for (const entry of entries) {
    if (entry.type === 'custom' && entry.customType === 'grc-curator-artifact') {
      const parsed = parseCuratorArtifactEntry(entry.data);
      if (parsed) curatorArtifacts.push(parsed);
      else curatorArtifactsRejected += 1;
    }

    if (entry.type === 'custom' && entry.customType === 'grc-reflector-artifact') {
      const parsed = parseReflectorArtifactEntry(entry.data);
      if (parsed) reflectorArtifacts.push(parsed);
      else reflectorArtifactsRejected += 1;
    }
  }

  if (curatorArtifacts.length > 0) {
    state = replayCuratorArtifacts(state, curatorArtifacts, maxSize);
  }

  if (reflectorArtifacts.length > 0) {
    state = replayReflectorArtifacts(state, reflectorArtifacts);
  }

  return {
    state,
    curatorArtifactsRejected,
    restoredCuratorArtifactRounds: curatorArtifacts.map((item) => item.agentRound),
    reflectorArtifactsRejected,
    restoredReflectorArtifactRounds: reflectorArtifacts.map((item) => item.agentRound),
  };
}
