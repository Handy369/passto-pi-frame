import { isGoalTreeDocument } from "./grc-goal-tree.ts";
import { selectCurrentXNodeModel } from "./grc-x-node-model.ts";
import type { GoalStateAny, UserGoalTreeDocument, XNodeModelDocument } from "./types.ts";

export interface GoalStateSnapshotSummary {
  version: 1 | 2;
  active: number;
  completed: number;
  migrations: number;
  pruned: number;
  updatedRound: number;
  nodes?: number;
}

export function summarizeGoalState(goalState: GoalStateAny | null): GoalStateSnapshotSummary | null {
  if (!goalState) return null;

  if (isGoalTreeDocument(goalState)) {
    const active = goalState.nodes.filter((node) => node.status !== "completed").length;
    const completed = goalState.nodes.filter((node) => node.status === "completed").length;

    return {
      version: 2,
      active,
      completed,
      migrations: goalState.migrations.length,
      pruned: goalState.prunedCount,
      updatedRound: goalState.agentRound,
      nodes: goalState.nodes.length,
    };
  }

  return {
    version: 1,
    active: goalState.active.length,
    completed: goalState.completed.length,
    migrations: goalState.migrations.length,
    pruned: goalState.prunedCount,
    updatedRound: goalState.agentRound,
  };
}

export function summarizeGoalStateFromObjectSidecars(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
): GoalStateSnapshotSummary | null {
  if (!userGoalTree) return null;

  const currentModel = selectCurrentXNodeModel(userGoalTree, xNodeModels);
  const activeUserGoals = userGoalTree.userGoals.filter((goal) => goal.executionState !== 'completed' && goal.status !== 'completed').length;
  const completedUserGoals = userGoalTree.userGoals.filter((goal) => goal.executionState === 'completed' || goal.status === 'completed').length;

  return {
    version: 2,
    active: activeUserGoals,
    completed: completedUserGoals,
    migrations: 0,
    pruned: 0,
    updatedRound: Math.max(userGoalTree.agentRound, currentModel?.agentRound ?? userGoalTree.agentRound),
    nodes: currentModel?.nodes.length,
  };
}

export function getGoalStateOpenAssertions(goalState: GoalStateAny | null, limit = Infinity): string[] {
  if (!goalState) return [];

  const safeLimit = Math.max(0, limit);
  const assertions = isGoalTreeDocument(goalState)
    ? goalState.nodes
      .filter((node) => node.status !== "completed")
      .sort((a, b) => a.order - b.order)
      .map((node) => node.assertion)
    : goalState.active.map((item) => item.assertion);

  return dedupePreservingOrder(assertions).slice(0, safeLimit);
}

export function getGoalStateOpenAssertionsFromObjectSidecars(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
  limit = Infinity,
): string[] {
  if (!userGoalTree) return [];

  const safeLimit = Math.max(0, limit);
  const currentModel = selectCurrentXNodeModel(userGoalTree, xNodeModels);
  const modelAssertions = (currentModel?.nodes ?? [])
    .filter((node) => node.status !== 'completed')
    .sort((a, b) => a.order - b.order)
    .map((node) => node.assertion);
  const siblingAssertions = userGoalTree.userGoals
    .filter((goal) => goal.executionState !== 'completed' && goal.status !== 'completed' && goal.id !== userGoalTree.currentFocusUserGoalId)
    .sort((a, b) => b.lastTouchedRound - a.lastTouchedRound)
    .map((goal) => goal.assertion);

  return dedupePreservingOrder([...modelAssertions, ...siblingAssertions]).slice(0, safeLimit);
}

function dedupePreservingOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    deduped.push(item);
  }

  return deduped;
}
