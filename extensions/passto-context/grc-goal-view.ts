import type { DraftGoalOp, GoalNodePhase, GoalStateAny, GoalStateDocument, GoalTreeDocument, UserGoalTreeDocument, XNodeModelDocument } from "./types.js";
import { isGoalTreeDocument } from "./grc-goal-tree.ts";
import { selectCurrentXNodeModel } from "./grc-x-node-model.ts";

const MAX_RECENT_MIGRATIONS = 3;

export interface GoalViewFocusItem {
  id: string;
  assertion: string;
  status: "active" | "suspended" | "completed";
  signal?: "explicit" | "inferred" | "draft";
  atomicity?: "atomic" | "composite" | "undecided";
  phase?: GoalNodePhase;
}

export interface GoalViewSiblingItem {
  id: string;
  assertion: string;
  signal?: "explicit" | "inferred" | "draft";
  phase?: GoalNodePhase;
}

export interface GoalViewMigrationItem {
  fromGoalId: string | null;
  toGoalId: string;
  reason: string;
  atRound: number;
}

export interface GoalViewModel {
  currentFocusGoalId: string | null;
  focusPath: GoalViewFocusItem[];
  siblingActiveGoals: GoalViewSiblingItem[];
  focusChildren: Array<{ id: string; assertion: string; status: "active" | "suspended" | "completed"; signal?: "explicit" | "inferred" | "draft"; phase?: GoalNodePhase }>;
  recentMigrations: GoalViewMigrationItem[];
  recentCompletedGoals: Array<{ id: string; assertion: string; completedAtRound: number }>;
  updatedRound: number;
}

const MAX_SIBLING_ACTIVE_GOALS = 3;

export function buildGoalViewModel(
  goalState: GoalStateAny | null,
  options?: { maxSiblingActiveGoals?: number; maxRecentMigrations?: number; maxRecentCompletedGoals?: number },
): GoalViewModel | null {
  if (!goalState) return null;
  return isGoalTreeDocument(goalState)
    ? buildGoalViewModelFromTree(goalState, options)
    : buildGoalViewModelFromV1(goalState, options);
}

export function buildGoalViewModelFromObjectSidecars(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
  options?: { maxSiblingActiveGoals?: number; maxRecentMigrations?: number; maxRecentCompletedGoals?: number },
): GoalViewModel | null {
  if (!userGoalTree || xNodeModels.length === 0) return null;

  const maxSiblingActiveGoals = Math.max(0, options?.maxSiblingActiveGoals ?? MAX_SIBLING_ACTIVE_GOALS);
  const maxRecentCompletedGoals = Math.max(0, options?.maxRecentCompletedGoals ?? 3);
  const focusUserGoal = userGoalTree.currentFocusUserGoalId
    ? userGoalTree.userGoals.find((goal) => goal.id === userGoalTree.currentFocusUserGoalId) ?? null
    : null;
  const currentModel = selectCurrentXNodeModel(userGoalTree, xNodeModels);
  const nodeById = currentModel ? new Map(currentModel.nodes.map((node) => [node.id, node])) : null;
  const focusNode = currentModel?.currentFocusXNodeId && nodeById
    ? nodeById.get(currentModel.currentFocusXNodeId) ?? null
    : currentModel?.nodes.find((node) => node.id === currentModel.userGoalId) ?? currentModel?.nodes[0] ?? null;

  const focusPath: GoalViewFocusItem[] = [];
  let cursor = focusNode;
  while (cursor && nodeById) {
    focusPath.unshift({
      id: cursor.id,
      assertion: cursor.assertion,
      status: cursor.status,
      atomicity: cursor.atomicity,
      phase: cursor.phase,
      signal: cursor.id === currentModel?.userGoalId ? 'explicit' : 'inferred',
    });
    cursor = cursor.parentId ? nodeById.get(cursor.parentId) ?? null : null;
  }

  const siblingActiveGoals = focusUserGoal
    ? userGoalTree.userGoals
      .filter((goal) => goal.id !== focusUserGoal.id && goal.parentId === focusUserGoal.parentId && goal.executionState !== 'completed' && goal.status !== 'completed')
      .sort((a, b) => b.lastTouchedRound - a.lastTouchedRound)
      .slice(0, maxSiblingActiveGoals)
      .map((goal) => ({ id: goal.id, assertion: goal.assertion, signal: 'explicit' as const, phase: currentModel?.nodes[0]?.phase }))
    : [];

  const focusChildren = focusNode && currentModel
    ? currentModel.nodes
      .filter((node) => node.parentId === focusNode.id)
      .sort((a, b) => a.order - b.order)
      .map((node) => ({ id: node.id, assertion: node.assertion, status: node.status, signal: 'inferred' as const, phase: node.phase }))
    : [];

  const recentCompletedGoals = collectRecentCompletedGoalsFromObjectSidecars(userGoalTree, currentModel, maxRecentCompletedGoals);

  return {
    currentFocusGoalId: focusNode?.id ?? focusUserGoal?.id ?? null,
    focusPath,
    siblingActiveGoals,
    focusChildren,
    recentMigrations: [],
    recentCompletedGoals,
    updatedRound: Math.max(userGoalTree.agentRound, currentModel?.agentRound ?? userGoalTree.agentRound),
  };
}

function collectRecentCompletedGoalsFromObjectSidecars(
  userGoalTree: UserGoalTreeDocument,
  currentModel: XNodeModelDocument | null,
  maxRecentCompletedGoals: number,
): Array<{ id: string; assertion: string; completedAtRound: number }> {
  const seen = new Set<string>();
  const completed: Array<{ id: string; assertion: string; completedAtRound: number }> = [];

  for (const node of currentModel?.nodes ?? []) {
    if (node.status !== 'completed') continue;
    if (seen.has(node.id)) continue;
    seen.add(node.id);
    completed.push({
      id: node.id,
      assertion: node.assertion,
      completedAtRound: node.completedAtRound ?? node.lastTouchedRound,
    });
  }

  for (const goal of userGoalTree.userGoals) {
    if (goal.executionState !== 'completed' && goal.status !== 'completed') continue;
    if (seen.has(goal.id)) continue;
    seen.add(goal.id);
    completed.push({
      id: goal.id,
      assertion: goal.assertion,
      completedAtRound: goal.completedAtRound ?? goal.lastTouchedRound,
    });
  }

  return completed
    .sort((a, b) => b.completedAtRound - a.completedAtRound)
    .slice(0, maxRecentCompletedGoals);
}

function buildGoalViewModelFromV1(
  goalState: GoalStateDocument,
  options?: { maxSiblingActiveGoals?: number; maxRecentMigrations?: number; maxRecentCompletedGoals?: number },
): GoalViewModel | null {
  const maxSiblingActiveGoals = Math.max(0, options?.maxSiblingActiveGoals ?? MAX_SIBLING_ACTIVE_GOALS);
  const maxRecentMigrations = Math.max(0, options?.maxRecentMigrations ?? MAX_RECENT_MIGRATIONS);
  const maxRecentCompletedGoals = Math.max(0, options?.maxRecentCompletedGoals ?? 3);

  const focusGoal = selectFocusGoal(goalState);
  const currentFocusGoalId = focusGoal?.id ?? null;

  const focusPath = focusGoal
    ? [{ id: focusGoal.id, assertion: focusGoal.assertion, status: focusGoal.status, signal: focusGoal.signal }]
    : [];

  const siblingActiveGoals = goalState.active
    .filter((item) => item.id !== currentFocusGoalId)
    .sort((a, b) => b.lastConfirmedRound - a.lastConfirmedRound)
    .slice(0, maxSiblingActiveGoals)
    .map((item) => ({ id: item.id, assertion: item.assertion, signal: item.signal }));

  const recentMigrations = goalState.migrations
    .slice(-maxRecentMigrations)
    .map((migration) => ({
      fromGoalId: migration.from || null,
      toGoalId: migration.to,
      reason: migration.reason,
      atRound: migration.atRound,
    }));

  const recentCompletedGoals = goalState.completed
    .slice(-maxRecentCompletedGoals)
    .map((item) => ({
      id: item.id,
      assertion: item.assertion,
      completedAtRound: item.completedAtRound,
    }));

  return {
    currentFocusGoalId,
    focusPath,
    siblingActiveGoals,
    focusChildren: [],
    recentMigrations,
    recentCompletedGoals,
    updatedRound: goalState.agentRound,
  };
}

function buildGoalViewModelFromTree(
  goalTree: GoalTreeDocument,
  options?: { maxSiblingActiveGoals?: number; maxRecentMigrations?: number; maxRecentCompletedGoals?: number },
): GoalViewModel | null {
  const maxSiblingActiveGoals = Math.max(0, options?.maxSiblingActiveGoals ?? MAX_SIBLING_ACTIVE_GOALS);
  const maxRecentMigrations = Math.max(0, options?.maxRecentMigrations ?? MAX_RECENT_MIGRATIONS);
  const maxRecentCompletedGoals = Math.max(0, options?.maxRecentCompletedGoals ?? 3);
  const nodeById = new Map(goalTree.nodes.map((node) => [node.id, node]));
  const focus = goalTree.currentFocusGoalId ? nodeById.get(goalTree.currentFocusGoalId) ?? null : null;

  const focusPath: GoalViewFocusItem[] = [];
  let cursor = focus;
  while (cursor) {
    focusPath.unshift({
      id: cursor.id,
      assertion: cursor.assertion,
      status: cursor.status,
      atomicity: cursor.atomicity,
      phase: cursor.phase,
      signal: cursor.signal,
    });
    cursor = cursor.parentId ? nodeById.get(cursor.parentId) ?? null : null;
  }

  const siblingActiveGoals = focus
    ? goalTree.nodes
      .filter((node) => node.id !== focus.id && node.parentId === focus.parentId && (node.status === "active" || node.status === "suspended"))
      .sort((a, b) => b.lastConfirmedRound - a.lastConfirmedRound)
      .slice(0, maxSiblingActiveGoals)
      .map((node) => ({ id: node.id, assertion: node.assertion, signal: node.signal, phase: node.phase }))
    : [];

  const focusChildren = focus
    ? goalTree.nodes
      .filter((node) => node.parentId === focus.id)
      .sort((a, b) => a.order - b.order)
      .map((node) => ({ id: node.id, assertion: node.assertion, status: node.status, signal: node.signal, phase: node.phase }))
    : [];

  const recentMigrations = goalTree.migrations
    .slice(-maxRecentMigrations)
    .map((migration) => ({
      fromGoalId: migration.fromGoalId,
      toGoalId: migration.toGoalId,
      reason: migration.reason,
      atRound: migration.atRound,
    }));

  const recentCompletedGoals = goalTree.nodes
    .filter((node) => node.status === "completed")
    .slice(-maxRecentCompletedGoals)
    .map((node) => ({
      id: node.id,
      assertion: node.assertion,
      completedAtRound: node.completedAtRound ?? node.lastConfirmedRound,
    }));

  return {
    currentFocusGoalId: focus?.id ?? null,
    focusPath,
    siblingActiveGoals,
    focusChildren,
    recentMigrations,
    recentCompletedGoals,
    updatedRound: goalTree.agentRound,
  };
}

function selectFocusGoal(goalState: GoalStateDocument): GoalStateDocument["active"][number] | null {
  if (goalState.active.length === 0) return null;

  return [...goalState.active]
    .sort((a, b) => {
      if (b.lastConfirmedRound !== a.lastConfirmedRound) {
        return b.lastConfirmedRound - a.lastConfirmedRound;
      }
      if (a.status !== b.status) {
        return a.status === "active" ? -1 : 1;
      }
      return b.sinceRound - a.sinceRound;
    })[0] ?? null;
}
