import type { CuratorArtifactEntry, GRCState, ReflectorArtifactEntry } from './types.ts';
import { normalizeCuratorArtifactAgentRound } from './grc-curator-normalizer.ts';
import { normalizeReflectorAssetCandidates } from './grc-reflector-assets.ts';
import { normalizeReflectorDiagnosis } from './grc-reflector-diagnosis.ts';
import { pushSummaryCacheEntry, updateCuratorStatus, updateReflectorStatus } from './grc-state.ts';

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
    signal: value.signal && typeof value.signal === 'object' ? value.signal : null,
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
    );
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
