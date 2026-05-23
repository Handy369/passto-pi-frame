import type { CuratorResult, DraftDisposition, GoalNode, GoalStateAny, GoalTreeDocument, UserGoalTreeDocument, XNodeModelDocument } from './types.ts';
import { isGoalTreeDocument } from './grc-goal-tree.ts';
import { applyCuratorReconciliationOps } from './grc-curator-reconciliation.ts';

export type CuratorGoalStateRejectionReason =
  | 'summary-goal-without-active'
  | 'existing-active-cleared-without-closure'
  | 'phase-regression-without-evidence'
  | 'atomicity-flip-without-evidence';

export function getCuratorGoalStateRejectionReasons(
  previousGoalState: GoalStateAny | null,
  result: CuratorResult | null,
): CuratorGoalStateRejectionReason[] {
  if (!result) return [];

  const effectiveNextGoalState = applyDraftDispositionsToGoalState(result.goalState, result.draftDispositions ?? null);
  const hasClosureEvidence = result.closureEvidence.length > 0;
  const summaryGoal = result.summaryEntry?.summary.goal.trim() ?? '';
  const previousActive = extractProtectedActiveCount(previousGoalState, result.draftDispositions ?? null);
  const nextActive = extractActiveCount(effectiveNextGoalState);
  const reasons: CuratorGoalStateRejectionReason[] = [];

  const violatesSummaryGoalContract =
    summaryGoal.length > 0 &&
    !hasClosureEvidence &&
    (!effectiveNextGoalState || nextActive === 0);

  const violatesExistingActiveClosureContract =
    previousActive > 0 &&
    !hasClosureEvidence &&
    !!effectiveNextGoalState &&
    nextActive === 0;

  if (violatesSummaryGoalContract) {
    reasons.push('summary-goal-without-active');
  }

  if (violatesExistingActiveClosureContract) {
    reasons.push('existing-active-cleared-without-closure');
  }

  if (isGoalTreeDocument(previousGoalState) && isGoalTreeDocument(effectiveNextGoalState)) {
    const extra = getGoalTreeRegressionReasons(previousGoalState, effectiveNextGoalState, result.closureEvidence);
    reasons.push(...extra);
  }

  return reasons;
}

export function reconcileCuratorGoalState(
  previousGoalState: GoalStateAny | null,
  result: CuratorResult | null,
  objectContext?: { userGoalTree: UserGoalTreeDocument | null; xNodeModels: XNodeModelDocument[]; agentRound: number; nowIso: string },
): CuratorResult | null {
  if (!result) return null;

  const rejectionReasons = getCuratorGoalStateRejectionReasons(previousGoalState, result);
  if (rejectionReasons.length === 0) {
    const reconciledSidecars = objectContext && result.reconciliationOps?.length
      ? applyCuratorReconciliationOps({
          current: objectContext,
          reconciliationOps: result.reconciliationOps,
          sourceAgentRound: objectContext.agentRound,
          nowIso: objectContext.nowIso,
        })
      : null;
    return {
      ...result,
      goalState: applyDraftDispositionsToGoalState(result.goalState, result.draftDispositions ?? null),
      userGoalTree: reconciledSidecars?.userGoalTree ?? result.userGoalTree,
      xNodeModels: reconciledSidecars?.xNodeModels ?? result.xNodeModels,
      reconciliationWarnings: reconciledSidecars?.warnings ?? result.reconciliationWarnings ?? [],
    };
  }

  return {
    ...result,
    summaryEntry: null,
    goalState: null,
    signal: null,
    certaintyAssessment: null,
    draftDispositions: null,
  };
}

function extractActiveCount(goalState: GoalStateAny | null): number {
  if (!goalState) return 0;
  if (isGoalTreeDocument(goalState)) {
    return goalState.nodes.filter((node) => node.status === 'active' || node.status === 'suspended').length;
  }
  return goalState.active.length;
}

function extractProtectedActiveCount(
  goalState: GoalStateAny | null,
  draftDispositions: DraftDisposition[] | null,
): number {
  return extractActiveCount(applyDiscardDraftsToGoalState(goalState, draftDispositions));
}

export function applyDraftDispositionsToGoalState(
  goalState: GoalStateAny | null,
  draftDispositions: DraftDisposition[] | null,
): GoalStateAny | null {
  if (!goalState || !isGoalTreeDocument(goalState) || !draftDispositions || draftDispositions.length === 0) {
    return goalState;
  }

  let nodes = goalState.nodes.map((node) => ({ ...node }));
  let currentFocusGoalId = goalState.currentFocusGoalId;

  for (const disposition of draftDispositions) {
    const draftNode = nodes.find((node) => node.id === disposition.goalId);
    if (!draftNode) continue;

    const subtreeIds = collectSubtreeIds(nodes, disposition.goalId);
    const subtreeDisposition = disposition.subtreeDisposition
      ?? (disposition.action === 'discard-draft' ? 'discard-subtree' : 'keep-subtree');

    if (disposition.action === 'discard-draft' && subtreeDisposition === 'discard-subtree') {
      nodes = nodes.filter((node) => !subtreeIds.has(node.id));
      if (currentFocusGoalId && subtreeIds.has(currentFocusGoalId)) {
        currentFocusGoalId = null;
      }
      continue;
    }

    nodes = nodes.map((node) => {
      if (node.id !== disposition.goalId) return node;
      return {
        ...node,
        assertion: disposition.revisedAssertion?.trim() ? disposition.revisedAssertion.trim() : node.assertion,
        parentId: disposition.revisedParentGoalId !== undefined ? disposition.revisedParentGoalId : node.parentId,
        signal: node.signal === 'draft' ? 'inferred' : node.signal,
      } satisfies GoalNode;
    });

    if (subtreeDisposition === 'reparent-subtree' && disposition.revisedParentGoalId !== undefined) {
      nodes = nodes.map((node) => node.id === disposition.goalId ? { ...node, parentId: disposition.revisedParentGoalId } : node);
    }

    if (subtreeDisposition === 'merge-into-existing' && disposition.mergeTargetGoalId) {
      nodes = nodes
        .filter((node) => node.id !== disposition.goalId)
        .map((node) => {
          if (!subtreeIds.has(node.id)) return node;
          if (node.parentId === disposition.goalId) {
            return { ...node, parentId: disposition.mergeTargetGoalId } satisfies GoalNode;
          }
          return node;
        });
      if (currentFocusGoalId === disposition.goalId) {
        currentFocusGoalId = disposition.mergeTargetGoalId;
      }
    }

    if (disposition.nodeEdits && disposition.nodeEdits.length > 0) {
      const editMap = new Map(disposition.nodeEdits.map((edit) => [edit.goalId, edit]));
      const removeIds = new Set(
        disposition.nodeEdits
          .filter((edit) => edit.action === 'remove')
          .map((edit) => edit.goalId),
      );
      if (removeIds.size > 0) {
        const expandedRemoveIds = new Set<string>();
        for (const removeId of removeIds) {
          for (const id of collectSubtreeIds(nodes, removeId)) {
            expandedRemoveIds.add(id);
          }
        }
        nodes = nodes.filter((node) => !expandedRemoveIds.has(node.id));
        if (currentFocusGoalId && expandedRemoveIds.has(currentFocusGoalId)) {
          currentFocusGoalId = null;
        }
      }

      nodes = nodes.map((node) => {
        const edit = editMap.get(node.id);
        if (!edit || edit.action !== 'update') return node;
        return {
          ...node,
          assertion: edit.newAssertion?.trim() ? edit.newAssertion.trim() : node.assertion,
          parentId: edit.newParentId !== undefined ? edit.newParentId : node.parentId,
          phase: edit.newPhase ?? node.phase,
          atomicity: edit.newAtomicity ?? node.atomicity,
          order: edit.newOrder ?? node.order,
        } satisfies GoalNode;
      });
    }

    if (disposition.newCurrentFocusGoalId !== undefined) {
      currentFocusGoalId = disposition.newCurrentFocusGoalId;
    }
  }

  const rootGoalIds = nodes
    .filter((node) => node.parentId === null && node.status !== 'completed')
    .map((node) => node.id);
  currentFocusGoalId = selectFocusGoalId(nodes, currentFocusGoalId);

  return {
    ...goalState,
    rootGoalIds,
    currentFocusGoalId,
    nodes,
  };
}

function applyDiscardDraftsToGoalState(
  goalState: GoalStateAny | null,
  draftDispositions: DraftDisposition[] | null,
): GoalStateAny | null {
  if (!goalState || !isGoalTreeDocument(goalState) || !draftDispositions || draftDispositions.length === 0) {
    return goalState;
  }

  let nodes = goalState.nodes.map((node) => ({ ...node }));
  for (const disposition of draftDispositions) {
    if (disposition.action !== 'discard-draft') continue;
    const target = nodes.find((node) => node.id === disposition.goalId);
    if (!target || target.signal !== 'draft') continue;
    const subtreeDisposition = disposition.subtreeDisposition ?? 'discard-subtree';
    if (subtreeDisposition !== 'discard-subtree') continue;
    nodes = nodes.filter((node) => !collectSubtreeIds(nodes, disposition.goalId).has(node.id));
  }

  const rootGoalIds = nodes
    .filter((node) => node.parentId === null && node.status !== 'completed')
    .map((node) => node.id);
  const currentFocusGoalId = selectFocusGoalId(nodes, goalState.currentFocusGoalId);

  return {
    ...goalState,
    rootGoalIds,
    currentFocusGoalId,
    nodes,
  };
}

function collectSubtreeIds(nodes: GoalNode[], goalId: string): Set<string> {
  const removeIds = new Set<string>();
  const queue = [goalId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (removeIds.has(currentId)) continue;
    removeIds.add(currentId);
    for (const node of nodes) {
      if (node.parentId === currentId) {
        queue.push(node.id);
      }
    }
  }

  return removeIds;
}

function selectFocusGoalId(nodes: GoalNode[], currentFocusGoalId: string | null): string | null {
  if (currentFocusGoalId && nodes.some((node) => node.id === currentFocusGoalId)) {
    return currentFocusGoalId;
  }

  return [...nodes]
    .filter((node) => node.status === 'active' || node.status === 'suspended')
    .sort((a, b) => {
      if (b.lastConfirmedRound !== a.lastConfirmedRound) return b.lastConfirmedRound - a.lastConfirmedRound;
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.sinceRound - a.sinceRound;
    })[0]?.id ?? null;
}

function getGoalTreeRegressionReasons(
  previousGoalState: GoalTreeDocument,
  nextGoalState: GoalTreeDocument,
  closureEvidence: string[],
): CuratorGoalStateRejectionReason[] {
  const reasons: CuratorGoalStateRejectionReason[] = [];
  const evidenceText = closureEvidence.join(' ');
  const prevById = new Map(previousGoalState.nodes.map((node) => [node.id, node]));

  for (const nextNode of nextGoalState.nodes) {
    const prevNode = prevById.get(nextNode.id);
    if (!prevNode) continue;

    const phaseRegressed = phaseRank(nextNode.phase) < phaseRank(prevNode.phase);
    if (phaseRegressed && !evidenceText) {
      reasons.push('phase-regression-without-evidence');
      break;
    }
  }

  for (const nextNode of nextGoalState.nodes) {
    const prevNode = prevById.get(nextNode.id);
    if (!prevNode) continue;
    const flipped = prevNode.atomicity !== 'undecided' && nextNode.atomicity !== prevNode.atomicity;
    if (flipped && !evidenceText) {
      reasons.push('atomicity-flip-without-evidence');
      break;
    }
  }

  return reasons;
}

function phaseRank(phase: GoalTreeDocument['nodes'][number]['phase']): number {
  switch (phase) {
    case 'plan': return 1;
    case 'plan_insufficient': return 2;
    case 'execute': return 3;
    case 'testing': return 4;
    case 'pending_acceptance': return 5;
    case 'complete': return 6;
    default: return 0;
  }
}
