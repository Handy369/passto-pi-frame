import type { GoalNode, GoalStateAny, GoalStateDocument, GoalTreeDocument, UserGoalNode, UserGoalTreeDocument, XNodeModelDocument } from "./types.ts";
import { isGoalTreeDocument } from "./grc-goal-tree.ts";
import { applyCompletionClosure } from "./grc-completion-closure.ts";
import { buildDefaultUserGoalSource, normalizeUserGoalNode } from "./grc-user-goal-normalization.ts";

export function deriveUserGoalTreeFromGoalState(goalState: GoalStateAny | null): UserGoalTreeDocument | null {
  if (!goalState) return null;

  return isGoalTreeDocument(goalState)
    ? deriveUserGoalTreeFromV2(goalState)
    : deriveUserGoalTreeFromV1(goalState);
}

export function selectCurrentUserGoal(userGoalTree: UserGoalTreeDocument | null): UserGoalNode | null {
  if (!userGoalTree || !userGoalTree.currentFocusUserGoalId) return null;
  return userGoalTree.userGoals.find((goal) => goal.id === userGoalTree.currentFocusUserGoalId) ?? null;
}

export function finalizeUserGoalTreeCompletion(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[] | null | undefined,
): UserGoalTreeDocument | null {
  return applyCompletionClosure(userGoalTree, xNodeModels).userGoalTree;
}

export function summarizeUserGoalTree(
  userGoalTree: UserGoalTreeDocument | null,
): { active: number; completed: number; focus: string | null } | null {
  if (!userGoalTree) return null;

  const completed = userGoalTree.userGoals.filter((goal) => goal.status === "completed").length;
  return {
    active: userGoalTree.userGoals.length - completed,
    completed,
    focus: selectCurrentUserGoal(userGoalTree)?.assertion ?? null,
  };
}

function deriveUserGoalTreeFromV1(goalState: GoalStateDocument): UserGoalTreeDocument {
  const activeGoals: UserGoalNode[] = goalState.active.map((goal) => normalizeUserGoalNode({
    id: goal.id,
    parentId: null,
    assertion: goal.assertion,
    status: "planning",
    xNodeModelId: buildXNodeModelId(goal.id),
    sinceRound: goal.sinceRound,
    lastTouchedRound: goal.lastConfirmedRound,
  }, {
    reviewState: "curator_reviewed",
    relationState: "active",
    source: buildDefaultUserGoalSource({
      createdBy: "migration",
      lastUpdatedBy: "migration",
      sourceAgentRound: goalState.agentRound,
    }),
  }));

  const completedGoals: UserGoalNode[] = goalState.completed.map((goal) => normalizeUserGoalNode({
    id: goal.id,
    parentId: null,
    assertion: goal.assertion,
    status: "completed",
    xNodeModelId: buildXNodeModelId(goal.id),
    sinceRound: goal.completedAtRound,
    lastTouchedRound: goal.completedAtRound,
    completedAtRound: goal.completedAtRound,
  }, {
    reviewState: "curator_reviewed",
    relationState: "active",
    source: buildDefaultUserGoalSource({
      createdBy: "migration",
      lastUpdatedBy: "migration",
      sourceAgentRound: goalState.agentRound,
    }),
  }));

  const allGoals = [...activeGoals, ...completedGoals];
  const currentFocusUserGoalId = goalState.active[0]?.id ?? null;

  return {
    version: 1,
    agentRound: goalState.agentRound,
    updatedAt: goalState.updatedAt,
    currentFocusUserGoalId,
    rootUserGoalIds: allGoals.filter((goal) => goal.parentId === null && goal.status !== "completed").map((goal) => goal.id),
    userGoals: allGoals,
  };
}

function deriveUserGoalTreeFromV2(goalTree: GoalTreeDocument): UserGoalTreeDocument {
  const nodeById = new Map(goalTree.nodes.map((node) => [node.id, node]));
  const rootGoals = goalTree.nodes.filter((node) => node.parentId === null);

  const userGoals = rootGoals.map((node) => toUserGoalNode(node));
  const currentFocusUserGoalId = resolveFocusUserGoalId(goalTree.currentFocusGoalId, nodeById);

  return {
    version: 1,
    agentRound: goalTree.agentRound,
    updatedAt: goalTree.updatedAt,
    currentFocusUserGoalId,
    rootUserGoalIds: userGoals.filter((goal) => goal.status !== "completed").map((goal) => goal.id),
    userGoals,
  };
}

function toUserGoalNode(node: GoalNode): UserGoalNode {
  return normalizeUserGoalNode({
    id: node.id,
    parentId: null,
    assertion: node.assertion,
    status: mapGoalNodeToUserGoalStatus(node),
    xNodeModelId: buildXNodeModelId(node.id),
    sinceRound: node.sinceRound,
    lastTouchedRound: node.lastTouchedRound,
    completedAtRound: node.completedAtRound,
  }, {
    executionState: mapGoalNodeToUserGoalExecutionState(node),
    reviewState: "curator_reviewed",
    relationState: "active",
    source: buildDefaultUserGoalSource({
      createdBy: "migration",
      lastUpdatedBy: "migration",
      sourceAgentRound: node.lastTouchedRound,
    }),
  });
}

function mapGoalNodeToUserGoalExecutionState(node: GoalNode): UserGoalNode["executionState"] {
  if (node.status === "completed" || node.phase === "complete") {
    return "completed";
  }

  if (node.phase === "testing") {
    return "testing";
  }

  if (node.phase === "pending_acceptance") {
    return "pending_acceptance";
  }

  if (node.phase === "execute") {
    return "executing";
  }

  if (node.phase === "plan" || node.phase === "plan_insufficient") {
    return "planning";
  }

  return "identified";
}

function mapGoalNodeToUserGoalStatus(node: GoalNode): UserGoalNode["status"] {
  if (node.status === "completed" || node.phase === "complete") {
    return "completed";
  }

  if (node.phase === "execute" || node.phase === "testing" || node.phase === "pending_acceptance") {
    return "executing";
  }

  if (node.phase === "plan" || node.phase === "plan_insufficient") {
    return "planning";
  }

  return "identified";
}

function resolveFocusUserGoalId(currentFocusGoalId: string | null, nodeById: Map<string, GoalNode>): string | null {
  if (!currentFocusGoalId) return null;

  let cursor = nodeById.get(currentFocusGoalId) ?? null;
  while (cursor?.parentId) {
    cursor = nodeById.get(cursor.parentId) ?? null;
  }

  return cursor?.id ?? null;
}

function buildXNodeModelId(userGoalId: string): string {
  return `xnode-${userGoalId}`;
}
