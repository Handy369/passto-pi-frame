import type { UserGoalExecutionState, UserGoalNode, UserGoalTreeDocument, XNode, XNodeModelDocument, XNodeModelCompletion, UserGoalTreeCompletion } from "./types.ts";
import { mapExecutionStateToLegacyStatus, normalizeUserGoalNode } from "./grc-user-goal-normalization.ts";

export function applyCompletionClosure(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[] | null | undefined,
): { userGoalTree: UserGoalTreeDocument | null; xNodeModels: XNodeModelDocument[] } {
  const normalizedModels = Array.isArray(xNodeModels)
    ? xNodeModels.filter((item): item is XNodeModelDocument => !!item && typeof item === "object").map(applyXNodeModelCompletion)
    : [];

  if (!userGoalTree) {
    return {
      userGoalTree: null,
      xNodeModels: normalizedModels,
    };
  }

  const modelByUserGoalId = new Map(normalizedModels.map((model) => [model.userGoalId, model]));
  const normalizedUserGoals = userGoalTree.userGoals.map((goal) => applyUserGoalCompletion(goal, modelByUserGoalId.get(goal.id) ?? null));
  const openGoals = normalizedUserGoals.filter((goal) => goal.executionState !== "completed");
  const nextFocusUserGoalId = resolveNextFocusUserGoalId(userGoalTree.currentFocusUserGoalId, openGoals);
  const completion: UserGoalTreeCompletion = {
    treeComplete: openGoals.length === 0,
    completedUserGoalIds: normalizedUserGoals.filter((goal) => goal.status === "completed").map((goal) => goal.id),
    openUserGoalIds: openGoals.map((goal) => goal.id),
    nextFocusUserGoalId,
  };

  return {
    userGoalTree: {
      ...userGoalTree,
      currentFocusUserGoalId: completion.treeComplete ? null : nextFocusUserGoalId,
      rootUserGoalIds: normalizedUserGoals
        .filter((goal) => goal.parentId === null && goal.executionState !== "completed")
        .map((goal) => goal.id),
      userGoals: normalizedUserGoals,
      completion,
    },
    xNodeModels: normalizedModels,
  };
}

export function applyXNodeModelCompletion(xNodeModel: XNodeModelDocument): XNodeModelDocument {
  const completion = deriveXNodeModelCompletion(xNodeModel);
  if (!completion) {
    return {
      ...xNodeModel,
      completion: null,
    };
  }

  return {
    ...xNodeModel,
    currentFocusXNodeId: completion.modelComplete ? null : resolveEffectiveFocusXNodeId(xNodeModel, completion),
    completion,
  };
}

export function deriveXNodeModelCompletion(xNodeModel: XNodeModelDocument | null): XNodeModelCompletion | null {
  if (!xNodeModel || xNodeModel.nodes.length === 0) return null;

  const completedNodeCount = xNodeModel.nodes.filter(isXNodeComplete).length;
  const openNodes = xNodeModel.nodes.filter((node) => !isXNodeComplete(node));
  const modelComplete = openNodes.length === 0;
  const currentFocusNode = xNodeModel.currentFocusXNodeId
    ? xNodeModel.nodes.find((node) => node.id === xNodeModel.currentFocusXNodeId) ?? null
    : null;
  const currentFocusStillOpen = currentFocusNode ? !isXNodeComplete(currentFocusNode) : false;
  const nextOpenXNodeId = currentFocusStillOpen ? currentFocusNode!.id : (openNodes[0]?.id ?? null);

  return {
    localComplete: currentFocusNode ? isXNodeComplete(currentFocusNode) : modelComplete,
    modelComplete,
    completedNodeCount,
    openNodeCount: openNodes.length,
    nextOpenXNodeId,
  };
}

export function isXNodeComplete(node: Pick<XNode, "status" | "phase">): boolean {
  return node.status === "completed" || node.phase === "complete";
}

function applyUserGoalCompletion(goal: UserGoalNode, xNodeModel: XNodeModelDocument | null): UserGoalNode {
  const normalizedGoal = normalizeUserGoalNode(goal);
  const modelComplete = xNodeModel?.completion?.modelComplete ?? false;
  const executionState: UserGoalExecutionState = normalizedGoal.executionState === "completed" || modelComplete
    ? "completed"
    : normalizedGoal.executionState ?? "identified";
  const completed = executionState === "completed";

  return {
    ...normalizedGoal,
    executionState,
    status: mapExecutionStateToLegacyStatus(executionState),
    completedAtRound: completed
      ? (normalizedGoal.completedAtRound ?? xNodeModel?.agentRound ?? normalizedGoal.lastTouchedRound)
      : undefined,
  };
}

function resolveNextFocusUserGoalId(
  currentFocusUserGoalId: string | null,
  openGoals: UserGoalNode[],
): string | null {
  if (currentFocusUserGoalId && openGoals.some((goal) => goal.id === currentFocusUserGoalId)) {
    return currentFocusUserGoalId;
  }

  return openGoals[0]?.id ?? null;
}

function resolveEffectiveFocusXNodeId(
  xNodeModel: XNodeModelDocument,
  completion: XNodeModelCompletion,
): string | null {
  if (completion.modelComplete) return null;
  if (xNodeModel.currentFocusXNodeId) {
    const focusNode = xNodeModel.nodes.find((node) => node.id === xNodeModel.currentFocusXNodeId) ?? null;
    if (focusNode && !isXNodeComplete(focusNode)) {
      return focusNode.id;
    }
  }
  return completion.nextOpenXNodeId;
}
