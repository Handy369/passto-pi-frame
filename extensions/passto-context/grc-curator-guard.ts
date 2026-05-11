import type { CuratorResult, GoalStateDocument } from './types.ts';

export type CuratorGoalStateRejectionReason =
  | 'summary-goal-without-active'
  | 'existing-active-cleared-without-closure';

export function getCuratorGoalStateRejectionReasons(
  previousGoalState: GoalStateDocument | null,
  result: CuratorResult | null,
): CuratorGoalStateRejectionReason[] {
  if (!result) return [];

  const nextGoalState = result.goalState;
  const nextActive = nextGoalState?.active ?? [];
  const hasClosureEvidence = result.closureEvidence.length > 0;
  const summaryGoal = result.summaryEntry?.summary.goal.trim() ?? '';
  const previousActive = previousGoalState?.active ?? [];
  const reasons: CuratorGoalStateRejectionReason[] = [];

  const violatesSummaryGoalContract =
    summaryGoal.length > 0 &&
    !hasClosureEvidence &&
    (!nextGoalState || nextActive.length === 0);

  const violatesExistingActiveClosureContract =
    previousActive.length > 0 &&
    !hasClosureEvidence &&
    !!nextGoalState &&
    nextActive.length === 0;

  if (violatesSummaryGoalContract) {
    reasons.push('summary-goal-without-active');
  }

  if (violatesExistingActiveClosureContract) {
    reasons.push('existing-active-cleared-without-closure');
  }

  return reasons;
}

export function reconcileCuratorGoalState(
  previousGoalState: GoalStateDocument | null,
  result: CuratorResult | null,
): CuratorResult | null {
  if (!result) return null;

  const rejectionReasons = getCuratorGoalStateRejectionReasons(previousGoalState, result);
  if (rejectionReasons.length === 0) {
    return result;
  }

  return {
    ...result,
    summaryEntry: null,
    goalState: null,
    signal: null,
  };
}
