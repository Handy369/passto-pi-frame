import type { CuratorArtifactEntry, CuratorResult, GoalStateDocument, SummaryEntry } from './types.ts';

export function normalizeCuratorResultAgentRound(
  result: CuratorResult | null,
  targetAgentRound: number,
): CuratorResult | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    summaryEntry: normalizeSummaryEntryAgentRound(result.summaryEntry, targetAgentRound),
    goalState: normalizeGoalStateAgentRound(result.goalState, targetAgentRound),
    closureEvidence: Array.isArray(result.closureEvidence) ? result.closureEvidence : [],
  };
}

export function normalizeCuratorArtifactAgentRound(
  artifact: CuratorArtifactEntry,
): CuratorArtifactEntry {
  return {
    ...artifact,
    summaryEntry: normalizeSummaryEntryAgentRound(artifact.summaryEntry, artifact.agentRound),
    goalState: normalizeGoalStateAgentRound(artifact.goalState, artifact.agentRound),
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
  goalState: GoalStateDocument | null,
  targetAgentRound: number,
): GoalStateDocument | null {
  if (!goalState) {
    return null;
  }

  return {
    ...goalState,
    agentRound: targetAgentRound,
  };
}
