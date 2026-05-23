import type {
  GoalNode,
  GoalNodeAtomicity,
  GoalNodePhase,
  GoalStateAny,
  GoalStateDocument,
  GoalTreeDocument,
  UserGoalExecutionState,
  UserGoalNode,
  UserGoalTreeDocument,
  XNode,
  XNodeFacet,
  XNodeModelDocument,
} from "./types.ts";
import { isGoalTreeDocument } from "./grc-goal-tree.ts";
import { deriveRuntimeProofRecord, deriveRuntimeProofSignals } from "./grc-runtime-proof.ts";
import { deriveXNodePolicyProjection } from "./grc-x-node-policy.ts";
import { applyXNodeModelCompletion } from "./grc-completion-closure.ts";

export function deriveXNodeModelsFromGoalState(
  goalState: GoalStateAny | null,
  userGoalTree: UserGoalTreeDocument | null,
): XNodeModelDocument[] {
  if (!goalState || !userGoalTree) return [];

  return isGoalTreeDocument(goalState)
    ? deriveXNodeModelsFromV2(goalState, userGoalTree)
    : deriveXNodeModelsFromV1(goalState, userGoalTree);
}

export function selectCurrentXNodeModel(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
): XNodeModelDocument | null {
  const focusUserGoalId = userGoalTree?.currentFocusUserGoalId;
  if (!focusUserGoalId) return null;
  return xNodeModels.find((model) => model.userGoalId === focusUserGoalId) ?? null;
}

export function enrichXNodeModel(model: XNodeModelDocument): XNodeModelDocument {
  return attachLatestPolicyProjection(applyXNodeModelCompletion(normalizeXNodeModelIdentity(model)));
}

function normalizeXNodeModelIdentity(model: XNodeModelDocument): XNodeModelDocument {
  const existingId = typeof model.id === "string" && model.id.trim() ? model.id.trim() : null;
  return {
    ...model,
    id: existingId ?? buildXNodeModelId(model.userGoalId),
  };
}

function buildXNodeModelId(userGoalId: string): string {
  return `xnode-${userGoalId}`;
}

export function enrichXNodeModels(xNodeModels: XNodeModelDocument[] | null | undefined): XNodeModelDocument[] {
  return Array.isArray(xNodeModels)
    ? xNodeModels.filter((item): item is XNodeModelDocument => !!item && typeof item === "object").map(enrichXNodeModel)
    : [];
}

function deriveXNodeModelsFromV1(
  goalState: GoalStateDocument,
  userGoalTree: UserGoalTreeDocument,
): XNodeModelDocument[] {
  const activeNodes = goalState.active.map((goal) => ({
    id: goal.id,
    assertion: goal.assertion,
    status: goal.status,
    atomicity: "undecided" as const,
    phase: goal.status === "active" ? "plan" as const : "plan_insufficient" as const,
    sinceRound: goal.sinceRound,
    lastTouchedRound: goal.lastConfirmedRound,
    completedAtRound: undefined,
    priority: 0,
    order: 0,
  }));

  const completedNodes = goalState.completed.map((goal) => ({
    id: goal.id,
    assertion: goal.assertion,
    status: "completed" as const,
    atomicity: "undecided" as const,
    phase: "complete" as const,
    sinceRound: goal.completedAtRound,
    lastTouchedRound: goal.completedAtRound,
    completedAtRound: goal.completedAtRound,
    priority: 0,
    order: 0,
  }));

  return userGoalTree.userGoals.map((userGoal) => {
    const source = [...activeNodes, ...completedNodes].find((node) => node.id === userGoal.id);
    if (!source) {
      return attachLatestPolicyProjection(
        buildSingleNodeModel(userGoalTree.agentRound, userGoalTree.updatedAt, userGoal.id, userGoal.assertion, userGoal.status === "completed"),
      );
    }

    return attachLatestPolicyProjection({
      version: 1,
      id: userGoal.xNodeModelId ?? buildXNodeModelId(userGoal.id),
      userGoalId: userGoal.id,
      agentRound: goalState.agentRound,
      updatedAt: goalState.updatedAt,
      currentFocusXNodeId: source.status === "completed" ? null : source.id,
      rootXNodeIds: [source.id],
      nodes: [toXNode(source)],
    });
  });
}

function deriveXNodeModelsFromV2(
  goalTree: GoalTreeDocument,
  userGoalTree: UserGoalTreeDocument,
): XNodeModelDocument[] {
  const nodeById = new Map(goalTree.nodes.map((node) => [node.id, node]));

  return userGoalTree.userGoals.map((userGoal) => {
    const root = nodeById.get(userGoal.id);
    if (!root) {
      return attachLatestPolicyProjection(
        buildSingleNodeModel(goalTree.agentRound, goalTree.updatedAt, userGoal.id, userGoal.assertion, userGoal.status === "completed"),
      );
    }

    const subtree = collectSubtree(goalTree.nodes, userGoal.id);
    const focusNodeId = resolveFocusWithinSubtree(goalTree.currentFocusGoalId, subtree);

    return attachLatestPolicyProjection({
      version: 1,
      id: userGoal.xNodeModelId ?? buildXNodeModelId(userGoal.id),
      userGoalId: userGoal.id,
      agentRound: goalTree.agentRound,
      updatedAt: goalTree.updatedAt,
      currentFocusXNodeId: focusNodeId,
      rootXNodeIds: [userGoal.id],
      nodes: subtree.map((node) => toXNode(node)),
    });
  });
}

function attachLatestPolicyProjection(model: XNodeModelDocument): XNodeModelDocument {
  const completionAwareModel = applyXNodeModelCompletion(model);
  const latestRuntimeProof = deriveRuntimeProofRecord(completionAwareModel);
  return {
    ...completionAwareModel,
    latestPolicyProjection: deriveXNodePolicyProjection(completionAwareModel),
    latestRuntimeProof,
    latestProofSignals: deriveRuntimeProofSignals(completionAwareModel, latestRuntimeProof),
  };
}

export function buildXNodeModelSkeleton(input: {
  userGoal: UserGoalNode;
  agentRound: number;
  nowIso: string;
}): XNodeModelDocument {
  const completed = input.userGoal.executionState === "completed" || input.userGoal.status === "completed";
  const rootNode = buildXNode({
    id: input.userGoal.id,
    parentId: null,
    assertion: input.userGoal.assertion,
    status: completed ? "completed" : "active",
    atomicity: "undecided",
    phase: completed ? "complete" : "plan",
    agentRound: input.agentRound,
    completedAtRound: completed ? input.agentRound : undefined,
    priority: 0,
    order: 0,
  });

  return enrichXNodeModel({
    version: 1,
    id: input.userGoal.xNodeModelId ?? buildXNodeModelId(input.userGoal.id),
    userGoalId: input.userGoal.id,
    agentRound: input.agentRound,
    updatedAt: input.nowIso,
    currentFocusXNodeId: completed ? null : rootNode.id,
    rootXNodeIds: [rootNode.id],
    nodes: [rootNode],
  });
}

export function buildProjectionXNode(input: {
  id: string;
  parentId: string | null;
  assertion: string;
  status: XNode["status"];
  atomicity: GoalNodeAtomicity;
  phase: GoalNodePhase;
  agentRound: number;
  completedAtRound?: number;
  priority: number;
  order: number;
}): XNode {
  return buildXNode(input);
}

export function reopenXNodeModelRoot(
  model: XNodeModelDocument,
  input: {
    executionState: Exclude<UserGoalExecutionState, "completed">;
    agentRound: number;
    updatedAt: string;
  },
): XNodeModelDocument {
  const rootId = model.rootXNodeIds[0] ?? model.nodes[0]?.id ?? model.userGoalId;
  const reopenedPhase = mapExecutionStateToXNodePhase(input.executionState);
  return enrichXNodeModel({
    ...model,
    agentRound: input.agentRound,
    updatedAt: input.updatedAt,
    currentFocusXNodeId: rootId,
    nodes: model.nodes.map((node) => node.id === rootId
      ? {
          ...node,
          status: "active" as const,
          phase: reopenedPhase,
          completedAtRound: undefined,
          lastTouchedRound: input.agentRound,
        }
      : node),
  });
}

function mapExecutionStateToXNodePhase(executionState: Exclude<UserGoalExecutionState, "completed">): GoalNodePhase {
  if (executionState === "testing") return "testing";
  if (executionState === "pending_acceptance") return "pending_acceptance";
  if (executionState === "executing") return "execute";
  return "plan";
}

function buildSingleNodeModel(
  agentRound: number,
  updatedAt: string,
  userGoalId: string,
  assertion: string,
  completed: boolean,
): XNodeModelDocument {
  return {
    version: 1,
    id: buildXNodeModelId(userGoalId),
    userGoalId,
    agentRound,
    updatedAt,
    currentFocusXNodeId: completed ? null : userGoalId,
    rootXNodeIds: [userGoalId],
    nodes: [toXNode({
      id: userGoalId,
      parentId: null,
      assertion,
      status: completed ? "completed" : "active",
      atomicity: "undecided",
      phase: completed ? "complete" : "plan",
      sinceRound: agentRound,
      lastTouchedRound: agentRound,
      completedAtRound: completed ? agentRound : undefined,
      priority: 0,
      order: 0,
    })],
  };
}

function collectSubtree(nodes: GoalTreeDocument["nodes"], rootId: string): GoalNode[] {
  const childrenByParent = new Map<string | null, GoalNode[]>();
  for (const node of nodes) {
    const key = node.parentId ?? null;
    const bucket = childrenByParent.get(key) ?? [];
    bucket.push(node);
    childrenByParent.set(key, bucket);
  }

  const root = nodes.find((node) => node.id === rootId);
  if (!root) return [];

  const result: GoalNode[] = [];
  const stack: GoalNode[] = [root];

  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    const children = (childrenByParent.get(current.id) ?? []).slice().sort((a, b) => b.order - a.order);
    for (const child of children) {
      stack.push(child);
    }
  }

  return result.sort((a, b) => {
    if (a.parentId === b.parentId) return a.order - b.order;
    return a.order - b.order;
  });
}

function resolveFocusWithinSubtree(currentFocusGoalId: string | null, subtree: GoalNode[]): string | null {
  const firstOpenNodeId = subtree.find((node) => node.status !== "completed")?.id ?? null;

  if (!currentFocusGoalId) return firstOpenNodeId;
  if (subtree.some((node) => node.id === currentFocusGoalId)) return currentFocusGoalId;
  return firstOpenNodeId;
}

function toXNode(node: {
  id: string;
  parentId?: string | null;
  assertion: string;
  status: "active" | "suspended" | "completed";
  atomicity: GoalNode["atomicity"];
  phase: GoalNode["phase"];
  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;
  priority: number;
  order: number;
}): XNode {
  return {
    ...buildXNode({
      id: node.id,
      parentId: node.parentId ?? null,
      assertion: node.assertion,
      status: node.status,
      atomicity: node.atomicity,
      phase: node.phase,
      agentRound: node.sinceRound,
      completedAtRound: node.completedAtRound,
      priority: node.priority,
      order: node.order,
    }),
    structure: buildFacet("derived from GoalState compatibility layer", "partial"),
    runtimeProof: buildRuntimeProofFacet(node.phase, node.status),
    sinceRound: node.sinceRound,
    lastTouchedRound: node.lastTouchedRound,
  };
}

function buildXNode(input: {
  id: string;
  parentId: string | null;
  assertion: string;
  status: XNode["status"];
  atomicity: GoalNodeAtomicity;
  phase: GoalNodePhase;
  agentRound: number;
  completedAtRound?: number;
  priority: number;
  order: number;
}): XNode {
  return {
    id: input.id,
    parentId: input.parentId,
    assertion: input.assertion,
    status: input.status,
    atomicity: input.atomicity,
    phase: input.phase,
    why: buildFacet(input.assertion, "partial"),
    what: buildFacet(input.assertion, "partial"),
    flow: buildFacet(`phase=${input.phase}; atomicity=${input.atomicity}`, "partial"),
    structure: buildFacet("created by UserGoalProjection object-first path", "partial"),
    runtimeProof: buildProjectionRuntimeProofFacet(input.phase, input.status),
    sinceRound: input.agentRound,
    lastTouchedRound: input.agentRound,
    completedAtRound: input.completedAtRound,
    priority: input.priority,
    order: input.order,
  };
}

function buildFacet(summary: string, confidence: XNodeFacet["confidence"]): XNodeFacet {
  return { summary, confidence };
}

function buildProjectionRuntimeProofFacet(
  phase: GoalNodePhase,
  status: XNode["status"],
): XNodeFacet {
  if (status === "completed" || phase === "complete") {
    return {
      summary: "projection-created x-node is completed, but fresh acceptance/runtime proof may still need confirmation",
      confidence: "partial",
      method: ["必要时回看完成证据，并补用户验收或 fresh runtime proof"],
    };
  }

  if (phase === "plan" || phase === "plan_insufficient") {
    return {
      summary: "plan-stage x-node should improve target certainty before requiring runtime proof",
      confidence: "partial",
      method: ["先闭合 why/what/flow/structure，再进入实现或测试证明"],
    };
  }

  return {
    summary: "projection-created x-node has no runtime proof yet",
    confidence: "open",
    method: ["补充可执行的 runtime proof、测试或人工验收步骤"],
  };
}

function buildRuntimeProofFacet(
  phase: GoalNode["phase"],
  status: GoalNode["status"],
): XNodeFacet {
  if (status === "completed" || phase === "complete") {
    return {
      summary: "compatibility layer infers completed work, but fresh acceptance/runtime proof may still need confirmation",
      confidence: "partial",
      method: ["必要时回看完成证据，并补用户验收或 fresh runtime proof"],
    };
  }

  if (phase === "testing") {
    return {
      summary: "current focus is already in testing phase; minimum proof should be collected now",
      confidence: "partial",
      method: ["运行最小相关测试、构建或 runtime proof"],
    };
  }

  if (phase === "pending_acceptance") {
    return {
      summary: "implementation appears done, but user acceptance / final proof is still pending",
      confidence: "partial",
      method: ["整理现有证据并请求用户验收"],
    };
  }

  return {
    summary: "no first-class runtime proof has been recovered yet from compatibility GoalState",
    confidence: "open",
    method: ["补充可执行的 runtime proof、测试或人工验收步骤"],
  };
}
