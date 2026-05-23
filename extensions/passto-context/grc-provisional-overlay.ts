import { applyCompletionClosure } from "./grc-completion-closure.ts";
import type {
  DraftDisposition,
  DraftGoalOp,
  GoalStateAny,
  GoalTreeDocument,
  GRCState,
  RuntimeProvisionalOverlay,
  RuntimeProvisionalUserGoalState,
  RuntimeProvisionalXNodeState,
  UserGoalNode,
  UserGoalTreeDocument,
  XNode,
  XNodeModelDocument,
} from "./types.ts";
import { deriveUserGoalTreeFromGoalState } from "./grc-user-goal-tree.ts";
import { deriveXNodeModelsFromGoalState, enrichXNodeModel, enrichXNodeModels } from "./grc-x-node-model.ts";
import { applyDraftDispositionsToGoalState } from "./grc-curator-guard.ts";

export interface EffectiveObjectState {
  userGoalTree: UserGoalTreeDocument | null;
  xNodeModels: XNodeModelDocument[];
}

export function buildRuntimeProvisionalOverlayFromDraftGoalOp(input: {
  draftGoalOp: DraftGoalOp | null;
  currentAgentRound: number;
  confirmedGoalState?: GoalStateAny | null;
  confirmedUserGoalTree?: UserGoalTreeDocument | null;
  confirmedXNodeModels?: XNodeModelDocument[] | null;
}): RuntimeProvisionalOverlay | null {
  const { draftGoalOp, currentAgentRound } = input;
  if (!draftGoalOp || draftGoalOp.action !== "create" || !draftGoalOp.goal?.assertion) {
    return null;
  }

  const confirmedGoalState = input.confirmedGoalState ?? null;
  const confirmedUserGoalTree = input.confirmedUserGoalTree
    ?? deriveUserGoalTreeFromGoalState(confirmedGoalState)
    ?? createEmptyUserGoalTree(Math.max(0, currentAgentRound - 1));
  const confirmedXNodeModels = enrichXNodeModels(input.confirmedXNodeModels ?? deriveXNodeModelsFromGoalState(confirmedGoalState, confirmedUserGoalTree));

  const parentUserGoalId = resolveParentUserGoalId(confirmedUserGoalTree, draftGoalOp.goal.parentGoalId);
  if (draftGoalOp.goal.parentGoalId !== undefined && draftGoalOp.goal.parentGoalId !== null && !parentUserGoalId) {
    return null;
  }

  const draftId = buildDraftNodeId(currentAgentRound, parentUserGoalId);
  const updatedAt = new Date().toISOString();
  const nextUserGoal = buildProvisionalUserGoal({
    id: draftId,
    parentId: parentUserGoalId,
    assertion: draftGoalOp.goal.assertion,
    currentAgentRound,
    atomicity: draftGoalOp.goal.atomicity,
    phase: draftGoalOp.goal.phase,
  });

  const baseUserGoals = confirmedUserGoalTree.userGoals.filter((goal) => goal.id !== draftId);
  const nextUserGoalTree: UserGoalTreeDocument = {
    ...confirmedUserGoalTree,
    agentRound: currentAgentRound,
    updatedAt,
    currentFocusUserGoalId: parentUserGoalId ? parentUserGoalId : draftId,
    rootUserGoalIds: rebuildRootUserGoalIds([...baseUserGoals, nextUserGoal]),
    userGoals: [...baseUserGoals, nextUserGoal],
    completion: null,
  };

  const nextXNodeModel = buildProvisionalXNodeModel({
    userGoalId: draftId,
    currentAgentRound,
    updatedAt,
    assertion: draftGoalOp.goal.assertion,
    phase: draftGoalOp.goal.phase,
    atomicity: draftGoalOp.goal.atomicity,
  });
  const nextXNodeModels = confirmedXNodeModels.filter((model) => model.userGoalId !== draftId);

  return {
    sourceAgentRound: currentAgentRound,
    createdAt: updatedAt,
    source: "generator",
    userGoalState: {
      baseUserGoalTreeRound: confirmedUserGoalTree.agentRound ?? null,
      sourceAgentRound: currentAgentRound,
      createdAt: updatedAt,
      userGoalTree: nextUserGoalTree,
      source: "generator",
    } satisfies RuntimeProvisionalUserGoalState,
    xNodeState: {
      baseXNodeModelRound: confirmedXNodeModels.find((model) => model.userGoalId === draftId)?.agentRound ?? null,
      sourceAgentRound: currentAgentRound,
      createdAt: updatedAt,
      xNodeModel: nextXNodeModel,
      source: "generator",
    } satisfies RuntimeProvisionalXNodeState,
  };
}

/**
 * @deprecated Legacy draft/provisional compatibility helper. V2.0 mainline effective state no longer applies runtime provisional overlay.
 */
export function applyRuntimeProvisionalOverlay(
  confirmedUserGoalTree: UserGoalTreeDocument | null,
  confirmedXNodeModels: XNodeModelDocument[] | null | undefined,
  overlay: RuntimeProvisionalOverlay | null | undefined,
): EffectiveObjectState {
  const baseXNodeModels = enrichXNodeModels(confirmedXNodeModels ?? []);
  const overlaidUserGoalTree = overlay?.userGoalState?.userGoalTree ?? confirmedUserGoalTree ?? null;
  const overlaidXNodeModels = overlay?.xNodeState?.xNodeModel
    ? upsertXNodeModel(baseXNodeModels, overlay.xNodeState.xNodeModel)
    : baseXNodeModels;

  return applyCompletionClosure(overlaidUserGoalTree, overlaidXNodeModels);
}

export function getEffectiveObjectStateFromGRCState(state: GRCState | null): EffectiveObjectState {
  if (!state) return { userGoalTree: null, xNodeModels: [] };
  return applyCompletionClosure(
    state.curator.lastUserGoalTree ?? null,
    enrichXNodeModels(state.curator.lastXNodeModels ?? []),
  );
}

export function applyDraftDispositionsToRuntimeProvisionalOverlay(
  overlay: RuntimeProvisionalOverlay | null,
  draftDispositions: DraftDisposition[] | null,
): RuntimeProvisionalOverlay | null {
  if (!overlay || !draftDispositions || draftDispositions.length === 0) return overlay;

  let nextOverlay = overlay;
  const xNodeDraftDispositions = draftDispositions.filter((item) => item.goalId === overlay.xNodeState?.xNodeModel.userGoalId);
  if (nextOverlay.xNodeState?.xNodeModel && xNodeDraftDispositions.length > 0) {
    nextOverlay = {
      ...nextOverlay,
      xNodeState: {
        ...nextOverlay.xNodeState,
        xNodeModel: applyDraftDispositionsToXNodeModel(nextOverlay.xNodeState.xNodeModel, xNodeDraftDispositions),
      },
    };
  }

  if (nextOverlay.userGoalState?.userGoalTree) {
    nextOverlay = {
      ...nextOverlay,
      userGoalState: {
        ...nextOverlay.userGoalState,
        userGoalTree: applyDraftDispositionsToUserGoalTree(nextOverlay.userGoalState.userGoalTree, draftDispositions),
      },
    };
  }

  nextOverlay = reconcileOverlayProofTargets(nextOverlay, draftDispositions);

  if (isOverlayEmpty(nextOverlay)) return null;
  return nextOverlay;
}

function applyDraftDispositionsToUserGoalTree(
  userGoalTree: UserGoalTreeDocument,
  draftDispositions: DraftDisposition[],
): UserGoalTreeDocument {
  let userGoals = userGoalTree.userGoals.map((goal) => ({ ...goal }));
  let currentFocusUserGoalId = userGoalTree.currentFocusUserGoalId;

  for (const disposition of draftDispositions) {
    const index = userGoals.findIndex((goal) => goal.id === disposition.goalId);
    if (index === -1) continue;
    const goal = userGoals[index]!;

    if (disposition.action === "discard-draft") {
      userGoals.splice(index, 1);
      if (currentFocusUserGoalId === disposition.goalId) {
        currentFocusUserGoalId = goal.parentId ?? null;
      }
      continue;
    }

    userGoals[index] = {
      ...goal,
      assertion: disposition.revisedAssertion?.trim() || goal.assertion,
      parentId: disposition.revisedParentGoalId !== undefined ? disposition.revisedParentGoalId : goal.parentId,
      status: disposition.action === "confirm-draft"
        ? (goal.status === "identified" ? "planning" : goal.status)
        : goal.status,
      lastTouchedRound: Math.max(goal.lastTouchedRound, userGoalTree.agentRound),
    };
  }

  return {
    ...userGoalTree,
    currentFocusUserGoalId,
    rootUserGoalIds: rebuildRootUserGoalIds(userGoals),
    userGoals,
    completion: null,
  };
}

function applyDraftDispositionsToXNodeModel(
  xNodeModel: XNodeModelDocument,
  draftDispositions: DraftDisposition[],
): XNodeModelDocument {
  const goalState: GoalTreeDocument = {
    version: 2,
    agentRound: xNodeModel.agentRound,
    updatedAt: xNodeModel.updatedAt,
    rootGoalIds: [...xNodeModel.rootXNodeIds],
    currentFocusGoalId: xNodeModel.currentFocusXNodeId,
    nodes: xNodeModel.nodes.map((node) => ({
      id: node.id,
      parentId: node.parentId,
      assertion: node.assertion,
      kind: node.parentId === null ? "goal" : "subgoal",
      status: node.status,
      signal: node.id === xNodeModel.userGoalId ? "draft" : "inferred",
      atomicity: node.atomicity,
      phase: node.phase,
      sinceRound: node.sinceRound,
      lastTouchedRound: node.lastTouchedRound,
      lastConfirmedRound: node.lastTouchedRound,
      completedAtRound: node.completedAtRound,
      priority: node.priority,
      order: node.order,
    })),
    migrations: [],
    prunedCount: 0,
  };

  const nextGoalState = applyDraftDispositionsToGoalState(goalState, draftDispositions);
  if (!nextGoalState || !("version" in nextGoalState) || nextGoalState.version !== 2) {
    return xNodeModel;
  }

  const nextTree = nextGoalState as GoalTreeDocument;
  if (nextTree.nodes.length === 0) {
    return enrichXNodeModel({
      ...xNodeModel,
      currentFocusXNodeId: null,
      rootXNodeIds: [],
      nodes: [],
    });
  }

  const nextNodes = nextTree.nodes.map((node) => toProvisionalXNode(node));
  return enrichXNodeModel({
    ...xNodeModel,
    agentRound: nextTree.agentRound,
    updatedAt: nextTree.updatedAt,
    currentFocusXNodeId: nextTree.currentFocusGoalId,
    rootXNodeIds: [...nextTree.rootGoalIds],
    nodes: nextNodes,
  });
}

function toProvisionalXNode(node: GoalTreeDocument["nodes"][number]): XNode {
  return {
    id: node.id,
    parentId: node.parentId,
    assertion: node.assertion,
    status: node.status,
    atomicity: node.atomicity,
    phase: node.phase,
    why: { summary: node.assertion, confidence: "partial" },
    what: { summary: node.assertion, confidence: "partial" },
    flow: { summary: `phase=${node.phase}; atomicity=${node.atomicity}`, confidence: "partial" },
    structure: { summary: "runtime provisional overlay", confidence: "partial" },
    runtimeProof: { summary: "provisional overlay has not been curator-confirmed yet", confidence: "open" },
    sinceRound: node.sinceRound,
    lastTouchedRound: node.lastTouchedRound,
    completedAtRound: node.completedAtRound,
    priority: node.priority,
    order: node.order,
  };
}

function reconcileOverlayProofTargets(
  overlay: RuntimeProvisionalOverlay,
  draftDispositions: DraftDisposition[],
): RuntimeProvisionalOverlay {
  const xNodeState = overlay.xNodeState;
  if (!xNodeState?.xNodeModel) {
    return overlay;
  }

  let xNodeModel = xNodeState.xNodeModel;
  const nodeIds = new Set(xNodeModel.nodes.map((node) => node.id));

  const remapTarget = (targetXNodeId: string): string | null => {
    let currentTarget = targetXNodeId;

    for (const disposition of draftDispositions) {
      const subtreeIds = collectDraftDispositionSubtreeIds(xNodeModel.nodes, disposition.goalId);
      const subtreeDisposition = disposition.subtreeDisposition
        ?? (disposition.action === 'discard-draft' ? 'discard-subtree' : 'keep-subtree');

      if (subtreeDisposition === 'merge-into-existing' && disposition.mergeTargetGoalId && currentTarget === disposition.goalId) {
        currentTarget = disposition.mergeTargetGoalId;
        continue;
      }

      if (disposition.action === 'discard-draft' && subtreeDisposition === 'discard-subtree' && subtreeIds.has(currentTarget)) {
        return null;
      }

      if (disposition.nodeEdits?.some((edit) => edit.action === 'remove' && collectDraftDispositionSubtreeIds(xNodeModel.nodes, edit.goalId).has(currentTarget))) {
        return null;
      }
    }

    if (nodeIds.has(currentTarget)) {
      return currentTarget;
    }

    return xNodeModel.currentFocusXNodeId && nodeIds.has(xNodeModel.currentFocusXNodeId)
      ? xNodeModel.currentFocusXNodeId
      : xNodeModel.nodes[0]?.id ?? null;
  };

  const currentProof = xNodeModel.latestRuntimeProof ?? null;
  const nextProofTarget = currentProof ? remapTarget(currentProof.targetXNodeId) : null;
  const nextSignals = xNodeModel.latestProofSignals
    ?.map((signal) => {
      const nextTarget = remapTarget(signal.targetXNodeId);
      return nextTarget
        ? { ...signal, targetXNodeId: nextTarget }
        : null;
    })
    .filter((signal): signal is NonNullable<typeof signal> => Boolean(signal));

  xNodeModel = enrichXNodeModel({
    ...xNodeModel,
    latestRuntimeProof: currentProof && nextProofTarget
      ? { ...currentProof, targetXNodeId: nextProofTarget }
      : undefined,
    latestProofSignals: nextSignals && nextSignals.length > 0 ? nextSignals : undefined,
  });

  return {
    ...overlay,
    xNodeState: {
      ...xNodeState,
      xNodeModel,
    },
  };
}

function collectDraftDispositionSubtreeIds(nodes: XNode[], rootId: string): Set<string> {
  const ids = new Set<string>();
  const queue = [rootId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (ids.has(currentId)) continue;
    ids.add(currentId);
    for (const node of nodes) {
      if (node.parentId === currentId) {
        queue.push(node.id);
      }
    }
  }

  return ids;
}

function buildProvisionalUserGoal(input: {
  id: string;
  parentId: string | null;
  assertion: string;
  currentAgentRound: number;
  atomicity?: string;
  phase?: string;
}): UserGoalNode {
  return {
    id: input.id,
    parentId: input.parentId,
    assertion: input.assertion,
    status: inferUserGoalStatus(input.phase),
    xNodeModelId: `xnode-${input.id}`,
    sinceRound: input.currentAgentRound,
    lastTouchedRound: input.currentAgentRound,
  };
}

function buildProvisionalXNodeModel(input: {
  userGoalId: string;
  currentAgentRound: number;
  updatedAt: string;
  assertion: string;
  phase?: string;
  atomicity?: string;
}): XNodeModelDocument {
  return enrichXNodeModel({
    version: 1,
    id: `xnode-${input.userGoalId}`,
    userGoalId: input.userGoalId,
    agentRound: input.currentAgentRound,
    updatedAt: input.updatedAt,
    currentFocusXNodeId: input.userGoalId,
    rootXNodeIds: [input.userGoalId],
    nodes: [
      {
        id: input.userGoalId,
        parentId: null,
        assertion: input.assertion,
        status: "active",
        atomicity: (input.atomicity === "atomic" || input.atomicity === "composite" || input.atomicity === "undecided") ? input.atomicity : "undecided",
        phase: isGoalNodePhase(input.phase) ? input.phase : "plan",
        why: { summary: input.assertion, confidence: "partial" },
        what: { summary: input.assertion, confidence: "partial" },
        flow: { summary: `phase=${isGoalNodePhase(input.phase) ? input.phase : "plan"}; atomicity=${(input.atomicity === "atomic" || input.atomicity === "composite" || input.atomicity === "undecided") ? input.atomicity : "undecided"}`, confidence: "partial" },
        structure: { summary: "runtime provisional overlay", confidence: "partial" },
        runtimeProof: { summary: "provisional overlay has not been curator-confirmed yet", confidence: "open" },
        sinceRound: input.currentAgentRound,
        lastTouchedRound: input.currentAgentRound,
        priority: 0,
        order: 0,
      },
    ],
  });
}

function upsertXNodeModel(models: XNodeModelDocument[], nextModel: XNodeModelDocument): XNodeModelDocument[] {
  return [...models.filter((model) => model.userGoalId !== nextModel.userGoalId), enrichXNodeModel(nextModel)];
}

function resolveParentUserGoalId(userGoalTree: UserGoalTreeDocument, requestedParentGoalId: string | null | undefined): string | null {
  if (requestedParentGoalId === null || requestedParentGoalId === undefined) return null;
  if (userGoalTree.userGoals.some((goal) => goal.id === requestedParentGoalId)) {
    return requestedParentGoalId;
  }
  return null;
}

function rebuildRootUserGoalIds(userGoals: UserGoalNode[]): string[] {
  return userGoals.filter((goal) => goal.parentId === null && goal.status !== "completed").map((goal) => goal.id);
}

function buildDraftNodeId(currentAgentRound: number, parentUserGoalId: string | null): string {
  return `draft-${currentAgentRound}-${parentUserGoalId ? "child" : "root"}-1`;
}

function inferUserGoalStatus(phase: string | undefined): UserGoalNode["status"] {
  if (phase === "execute" || phase === "testing" || phase === "pending_acceptance") return "executing";
  if (phase === "complete") return "completed";
  if (phase === "plan" || phase === "plan_insufficient") return "planning";
  return "identified";
}

function createEmptyUserGoalTree(agentRound: number): UserGoalTreeDocument {
  return {
    version: 1,
    agentRound,
    updatedAt: new Date().toISOString(),
    currentFocusUserGoalId: null,
    rootUserGoalIds: [],
    userGoals: [],
    completion: null,
  };
}

function isGoalNodePhase(value: unknown): value is GoalTreeDocument["nodes"][number]["phase"] {
  return value === "plan" || value === "plan_insufficient" || value === "execute" || value === "testing" || value === "pending_acceptance" || value === "complete";
}

function isOverlayEmpty(overlay: RuntimeProvisionalOverlay): boolean {
  const userGoalCount = overlay.userGoalState?.userGoalTree.userGoals.length ?? 0;
  const xNodeCount = overlay.xNodeState?.xNodeModel.nodes.length ?? 0;
  return userGoalCount === 0 && xNodeCount === 0;
}
