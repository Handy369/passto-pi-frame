import type { GoalStateAny, GoalTransitionSummary, UserGoalTreeDocument, XNodeModelDocument } from './types.ts';
import { isGoalTreeDocument } from './grc-goal-tree.ts';
import { buildGoalViewModel, buildGoalViewModelFromObjectSidecars } from './grc-goal-view.ts';
import { selectCurrentXNodeModel } from './grc-x-node-model.ts';

type GoalRecord = {
  id: string;
  assertion: string;
  status: 'active' | 'suspended' | 'completed';
  parentId: string | null;
};

export function summarizeGoalTransition(
  previousGoalState: GoalStateAny | null,
  nextGoalState: GoalStateAny | null,
): GoalTransitionSummary | null {
  if (!nextGoalState) return null;

  const previousFocus = getFocusGoal(previousGoalState);
  const nextFocus = getFocusGoal(nextGoalState);
  const previousFocusInNextState = previousFocus ? findGoalRecord(nextGoalState, previousFocus.id) : null;

  const focusCompleted = Boolean(previousFocus && previousFocusInNextState?.status === 'completed');
  const focusIdChanged = Boolean(nextFocus && (!previousFocus || nextFocus.id !== previousFocus.id));
  const assertionRewritten = Boolean(
    previousFocus
    && nextFocus
    && previousFocus.id === nextFocus.id
    && previousFocus.assertion !== nextFocus.assertion,
  );
  const relation = classifyFocusRelation(previousFocus, nextFocus);

  if (focusCompleted && focusIdChanged && nextFocus) {
    const label = relation === 'parent'
      ? `子目标完成，回到父目标: ${nextFocus.assertion}`
      : relation === 'sibling'
        ? `子目标完成，切到兄弟目标: ${nextFocus.assertion}`
        : `目标完成/改变为: ${nextFocus.assertion}`;
    return {
      label,
      completedAssertion: previousFocus?.assertion ?? null,
      currentAssertion: nextFocus.assertion,
    };
  }

  if (focusCompleted && previousFocus) {
    return {
      label: `目标完成: ${previousFocus.assertion}`,
      completedAssertion: previousFocus.assertion,
      currentAssertion: nextFocus?.assertion ?? null,
    };
  }

  if (assertionRewritten && nextFocus) {
    return {
      label: `目标改写为: ${nextFocus.assertion}`,
      completedAssertion: null,
      currentAssertion: nextFocus.assertion,
    };
  }

  if (focusIdChanged && nextFocus) {
    const label = relation === 'parent'
      ? `回到父目标: ${nextFocus.assertion}`
      : relation === 'sibling'
        ? `切到兄弟目标: ${nextFocus.assertion}`
        : `目标改变为: ${nextFocus.assertion}`;
    return {
      label,
      completedAssertion: null,
      currentAssertion: nextFocus.assertion,
    };
  }

  return null;
}

export function summarizeGoalTransitionFromObjectSidecars(
  previousUserGoalTree: UserGoalTreeDocument | null,
  previousXNodeModels: XNodeModelDocument[],
  nextUserGoalTree: UserGoalTreeDocument | null,
  nextXNodeModels: XNodeModelDocument[],
): GoalTransitionSummary | null {
  const previousView = buildGoalViewModelFromObjectSidecars(previousUserGoalTree, previousXNodeModels);
  const nextView = buildGoalViewModelFromObjectSidecars(nextUserGoalTree, nextXNodeModels);
  if (!nextView) return null;

  const previousFocus = getObjectSidecarFocusGoal(previousUserGoalTree, previousXNodeModels, previousView?.currentFocusGoalId ?? null);
  const nextFocus = getObjectSidecarFocusGoal(nextUserGoalTree, nextXNodeModels, nextView.currentFocusGoalId);
  const previousFocusInNextState = previousFocus
    ? findObjectSidecarGoalRecord(nextUserGoalTree, nextXNodeModels, previousFocus.id)
    : null;

  const focusCompleted = Boolean(previousFocus && previousFocusInNextState?.status === 'completed');
  const focusIdChanged = Boolean(nextFocus && (!previousFocus || nextFocus.id !== previousFocus.id));
  const assertionRewritten = Boolean(previousFocus && nextFocus && previousFocus.id === nextFocus.id && previousFocus.assertion !== nextFocus.assertion);
  const relation = classifyFocusRelation(previousFocus, nextFocus);

  if (focusCompleted && focusIdChanged && nextFocus) {
    const label = relation === 'parent'
      ? `子目标完成，回到父目标: ${nextFocus.assertion}`
      : relation === 'sibling'
        ? `子目标完成，切到兄弟目标: ${nextFocus.assertion}`
        : `目标完成/改变为: ${nextFocus.assertion}`;
    return {
      label,
      completedAssertion: previousFocus?.assertion ?? null,
      currentAssertion: nextFocus.assertion,
    };
  }

  if (focusCompleted && previousFocus) {
    return {
      label: `目标完成: ${previousFocus.assertion}`,
      completedAssertion: previousFocus.assertion,
      currentAssertion: nextFocus?.assertion ?? null,
    };
  }

  if (assertionRewritten && nextFocus) {
    return {
      label: `目标改写为: ${nextFocus.assertion}`,
      completedAssertion: null,
      currentAssertion: nextFocus.assertion,
    };
  }

  if (focusIdChanged && nextFocus) {
    const label = relation === 'parent'
      ? `回到父目标: ${nextFocus.assertion}`
      : relation === 'sibling'
        ? `切到兄弟目标: ${nextFocus.assertion}`
        : `目标改变为: ${nextFocus.assertion}`;
    return {
      label,
      completedAssertion: null,
      currentAssertion: nextFocus.assertion,
    };
  }

  return null;
}

function getObjectSidecarFocusGoal(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
  focusId: string | null,
): GoalRecord | null {
  if (!focusId) return null;
  return findObjectSidecarGoalRecord(userGoalTree, xNodeModels, focusId);
}

function findObjectSidecarGoalRecord(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
  goalId: string,
): GoalRecord | null {
  const currentModel = selectCurrentXNodeModel(userGoalTree, xNodeModels);
  const xNode = currentModel?.nodes.find((node) => node.id === goalId);
  if (xNode) {
    return {
      id: xNode.id,
      assertion: xNode.assertion,
      status: xNode.status,
      parentId: xNode.parentId,
    };
  }

  const userGoal = userGoalTree?.userGoals.find((goal) => goal.id === goalId);
  if (userGoal) {
    return {
      id: userGoal.id,
      assertion: userGoal.assertion,
      status: userGoal.status === 'completed' ? 'completed' : 'active',
      parentId: userGoal.parentId,
    };
  }

  return null;
}

function getFocusGoal(goalState: GoalStateAny | null): GoalRecord | null {
  const view = buildGoalViewModel(goalState);
  if (!view || view.focusPath.length === 0) return null;
  const focus = view.focusPath[view.focusPath.length - 1] ?? null;
  if (!focus) return null;
  return findGoalRecord(goalState, focus.id);
}

function findGoalRecord(goalState: GoalStateAny | null, goalId: string): GoalRecord | null {
  if (!goalState) return null;

  if (isGoalTreeDocument(goalState)) {
    const node = goalState.nodes.find((item) => item.id === goalId);
    return node
      ? { id: node.id, assertion: node.assertion, status: node.status, parentId: node.parentId }
      : null;
  }

  const active = goalState.active.find((item) => item.id === goalId);
  if (active) {
    return {
      id: active.id,
      assertion: active.assertion,
      status: active.status,
      parentId: null,
    };
  }

  const completed = goalState.completed.find((item) => item.id === goalId);
  if (completed) {
    return {
      id: completed.id,
      assertion: completed.assertion,
      status: 'completed',
      parentId: null,
    };
  }

  return null;
}

function classifyFocusRelation(
  previousFocus: GoalRecord | null,
  nextFocus: GoalRecord | null,
): 'parent' | 'sibling' | 'other' {
  if (!previousFocus || !nextFocus) return 'other';
  if (previousFocus.parentId && nextFocus.id === previousFocus.parentId) return 'parent';
  if (previousFocus.parentId && previousFocus.parentId === nextFocus.parentId) return 'sibling';
  return 'other';
}
