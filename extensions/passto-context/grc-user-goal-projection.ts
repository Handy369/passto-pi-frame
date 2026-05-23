import type {
  GoalNodeAtomicity,
  GoalNodePhase,
  UserGoalExecutionState,
  UserGoalNode,
  UserGoalRelationState,
  UserGoalTreeDocument,
  XNode,
  XNodeCommit,
  XNodeFacet,
  XNodeModelDocument,
} from "./types.ts";
import { applyCompletionClosure } from "./grc-completion-closure.ts";
import {
  buildDefaultUserGoalSource,
  mapExecutionStateToLegacyStatus,
  normalizeUserGoalNode,
} from "./grc-user-goal-normalization.ts";
import {
  buildProjectionXNode,
  buildXNodeModelSkeleton,
  enrichXNodeModels,
  reopenXNodeModelRoot,
} from "./grc-x-node-model.ts";

export type GoalRelation =
  | "new_root"
  | "new_sibling_of_focus"
  | "new_child_of_focus"
  | "update_current_focus"
  | "switch_focus_to_existing"
  | "complete_current_focus"
  | "no_goal_change";

export interface OutputSpec {
  kind: string;
  summary?: string;
  acceptance?: string[];
}

export interface GoalRelationDecision {
  relation: GoalRelation;
  focusUserGoalIdBefore: string | null;
  targetUserGoalId: string | null;
  targetXNodeModelId: string | null;
  targetXNodeId: string | null;
  parentUserGoalId: string | null;
  producesNewUserGoal: boolean;
  shouldCreateXNodeModel: boolean;
  expectedOutput?: OutputSpec;
  outputLocation?: string;
  methodRef?: string;
  requiredParameterRefs?: string[];
  evidence: string[];
  confidence: "low" | "medium" | "high";
}

export type UserGoalProjectionOp =
  | CreateUserGoalOp
  | UpdateUserGoalOp
  | SwitchFocusUserGoalOp
  | CompleteUserGoalOp
  | ReopenUserGoalOp
  | MigrateUserGoalOp
  | SplitUserGoalOp
  | MergeUserGoalsOp;

export interface CreateUserGoalOp {
  action: "create_user_goal";
  id?: string;
  parentId?: string | null;
  assertion: string;
  executionState?: UserGoalExecutionState;
  xNodeModelId?: string | null;
}

export interface UpdateUserGoalOp {
  action: "update_user_goal";
  id: string;
  assertion?: string;
  executionState?: UserGoalExecutionState;
  relationState?: UserGoalRelationState;
}

export interface SwitchFocusUserGoalOp {
  action: "switch_focus_user_goal";
  id: string | null;
}

export interface CompleteUserGoalOp {
  action: "complete_user_goal";
  id: string;
}

export interface ReopenUserGoalOp {
  action: "reopen_user_goal";
  id: string;
  executionState?: Exclude<UserGoalExecutionState, "completed">;
}

export interface MigrateUserGoalOp {
  action: "migrate_user_goal";
  fromId: string;
  to: {
    id?: string;
    assertion: string;
  };
  reason?: string;
}

export interface SplitUserGoalOp {
  action: "split_user_goal";
  sourceId: string;
  goals: Array<{
    id?: string;
    assertion: string;
  }>;
}

export interface MergeUserGoalsOp {
  action: "merge_user_goals";
  sourceIds: string[];
  targetId: string;
}

export type XNodeModelOp =
  | PatchXNodeModelOp
  | AddXNodeOp
  | PatchXNodeOp
  | CompleteXNodeOp
  | SwitchFocusXNodeOp;

export interface PatchXNodeModelOp {
  action: "patch_xnode_model";
  userGoalId: string;
  currentFocusXNodeId?: string | null;
}

export interface AddXNodeOp {
  action: "add_xnode";
  userGoalId: string;
  id?: string;
  parentId?: string | null;
  assertion: string;
  atomicity?: GoalNodeAtomicity;
  phase?: GoalNodePhase;
}

export interface PatchXNodeOp {
  action: "patch_xnode";
  userGoalId: string;
  id: string;
  assertion?: string;
  atomicity?: GoalNodeAtomicity;
  phase?: GoalNodePhase;
  status?: XNode["status"];
  why?: XNodeFacet;
  what?: XNodeFacet;
  flow?: XNodeFacet;
  structure?: XNodeFacet;
  runtimeProof?: XNodeFacet;
}

export interface CompleteXNodeOp {
  action: "complete_xnode";
  userGoalId: string;
  id: string;
}

export interface SwitchFocusXNodeOp {
  action: "switch_focus_xnode";
  userGoalId: string;
  id: string | null;
}

export interface ApplyUserGoalProjectionInput {
  current: {
    userGoalTree: UserGoalTreeDocument | null;
    xNodeModels: XNodeModelDocument[];
  };
  goalRelationDecision?: GoalRelationDecision;
  userGoalOps: UserGoalProjectionOp[];
  xNodeModelOps?: XNodeModelOp[];
  focus?: {
    currentFocusUserGoalId?: string | null;
    currentFocusXNodeId?: string | null;
  };
  source: "generator" | "curator" | "restore" | "migration";
  sourceAgentRound: number;
  sourceUserTurnId?: string;
  nowIso: string;
  idempotencyKey?: string;
}

export interface ApplyUserGoalProjectionResult {
  userGoalTree: UserGoalTreeDocument;
  xNodeModels: XNodeModelDocument[];
  warnings: string[];
}

interface WorkingState {
  userGoalTree: UserGoalTreeDocument;
  xNodeModels: XNodeModelDocument[];
  warnings: string[];
  input: ApplyUserGoalProjectionInput;
}

export function applyUserGoalProjectionToObjectState(input: ApplyUserGoalProjectionInput): ApplyUserGoalProjectionResult {
  const working: WorkingState = {
    userGoalTree: normalizeInitialUserGoalTree(input),
    xNodeModels: enrichXNodeModels(input.current.xNodeModels ?? []),
    warnings: [],
    input,
  };

  validateGoalRelationDecision(working);

  for (const op of input.userGoalOps) {
    applyUserGoalOp(working, op);
  }

  for (const op of input.xNodeModelOps ?? []) {
    applyXNodeModelOp(working, op);
  }

  applyExplicitFocus(working);
  ensureOpenUserGoalsHaveXNodeModels(working);
  ensureFocusIntegrity(working);

  const closed = applyCompletionClosure(working.userGoalTree, enrichXNodeModels(working.xNodeModels));
  return {
    userGoalTree: closed.userGoalTree ?? working.userGoalTree,
    xNodeModels: closed.xNodeModels,
    warnings: working.warnings,
  };
}

function normalizeInitialUserGoalTree(input: ApplyUserGoalProjectionInput): UserGoalTreeDocument {
  const source = buildDefaultUserGoalSource({
    createdBy: input.source,
    lastUpdatedBy: input.source,
    sourceAgentRound: input.sourceAgentRound,
    sourceUserTurnId: input.sourceUserTurnId,
  });
  const existing = input.current.userGoalTree;
  if (!existing) {
    return {
      version: 1,
      agentRound: input.sourceAgentRound,
      updatedAt: input.nowIso,
      currentFocusUserGoalId: null,
      rootUserGoalIds: [],
      userGoals: [],
    };
  }

  return {
    ...existing,
    agentRound: input.sourceAgentRound,
    updatedAt: input.nowIso,
    userGoals: existing.userGoals.map((goal) => normalizeUserGoalNode(goal, {
      reviewState: input.source === "generator" ? "generator_projected" : "curator_reviewed",
      relationState: "active",
      source,
    })),
  };
}

function validateGoalRelationDecision(working: WorkingState): void {
  const decision = working.input.goalRelationDecision;
  if (!decision) return;

  const hasCreateUserGoal = working.input.userGoalOps.some((op) => op.action === "create_user_goal");
  if (!decision.producesNewUserGoal && hasCreateUserGoal) {
    working.warnings.push(`goal-relation-decision mismatch producesNewUserGoal=false op=create_user_goal relation=${decision.relation}`);
  }

  if (decision.producesNewUserGoal && !hasCreateUserGoal) {
    working.warnings.push(`goal-relation-decision mismatch producesNewUserGoal=true op=create_user_goal missing relation=${decision.relation}`);
  }

  if (!decision.shouldCreateXNodeModel && decision.producesNewUserGoal) {
    working.warnings.push(`goal-relation-decision mismatch shouldCreateXNodeModel=false producesNewUserGoal=true relation=${decision.relation}`);
  }

  if (decision.targetUserGoalId && !working.userGoalTree.userGoals.some((goal) => goal.id === decision.targetUserGoalId)) {
    const createsTarget = working.input.userGoalOps.some((op) => op.action === "create_user_goal" && op.id === decision.targetUserGoalId);
    if (!createsTarget) {
      working.warnings.push(`goal-relation-decision unresolved targetUserGoalId=${decision.targetUserGoalId} relation=${decision.relation}`);
    }
  }

  if (decision.targetXNodeModelId) {
    const targetModelExists = working.xNodeModels.some((model) => model.id === decision.targetXNodeModelId);
    const createsTargetModel = working.input.userGoalOps.some((op) => op.action === "create_user_goal" && buildXNodeModelId(op.id ?? buildStableId("goal", op.assertion, working.userGoalTree.userGoals.length + 1)) === decision.targetXNodeModelId);
    if (!targetModelExists && !createsTargetModel) {
      working.warnings.push(`goal-relation-decision unresolved targetXNodeModelId=${decision.targetXNodeModelId} relation=${decision.relation}`);
    }
  }
}

function applyUserGoalOp(working: WorkingState, op: UserGoalProjectionOp): void {
  switch (op.action) {
    case "create_user_goal":
      applyCreateUserGoal(working, op);
      return;
    case "update_user_goal":
      updateUserGoal(working, op.id, (goal) => ({
        ...goal,
        ...(op.assertion !== undefined ? { assertion: op.assertion } : {}),
        ...(op.executionState !== undefined ? { executionState: op.executionState, status: mapExecutionStateToLegacyStatus(op.executionState) } : {}),
        ...(op.relationState !== undefined ? { relationState: op.relationState } : {}),
      }), op.action);
      if (op.assertion !== undefined) patchRootXNodeAssertion(working, op.id, op.assertion);
      return;
    case "switch_focus_user_goal":
      working.userGoalTree = { ...working.userGoalTree, currentFocusUserGoalId: op.id };
      return;
    case "complete_user_goal":
      updateUserGoal(working, op.id, (goal) => ({
        ...goal,
        executionState: "completed",
        status: "completed",
        completedAtRound: goal.completedAtRound ?? working.input.sourceAgentRound,
      }));
      return;
    case "reopen_user_goal":
      updateUserGoal(working, op.id, (goal) => {
        const executionState = op.executionState ?? "executing";
        return {
          ...goal,
          executionState,
          status: mapExecutionStateToLegacyStatus(executionState),
          relationState: "reopened",
          completedAtRound: undefined,
        };
      });
      reopenXNodeModel(working, op.id, op.executionState ?? "executing");
      return;
    case "migrate_user_goal":
      updateUserGoal(working, op.fromId, (goal) => ({ ...goal, relationState: "migrated" }));
      applyCreateUserGoal(working, { action: "create_user_goal", id: op.to.id, assertion: op.to.assertion });
      return;
    case "split_user_goal":
      updateUserGoal(working, op.sourceId, (goal) => ({ ...goal, relationState: "split" }));
      for (const goal of op.goals) {
        applyCreateUserGoal(working, { action: "create_user_goal", id: goal.id, assertion: goal.assertion });
      }
      return;
    case "merge_user_goals":
      for (const sourceId of op.sourceIds) {
        if (sourceId !== op.targetId) updateUserGoal(working, sourceId, (goal) => ({ ...goal, relationState: "merged" }));
      }
      working.userGoalTree = { ...working.userGoalTree, currentFocusUserGoalId: op.targetId };
      return;
  }
}

function applyCreateUserGoal(working: WorkingState, op: CreateUserGoalOp): void {
  const id = op.id ?? buildStableId("goal", op.assertion, working.userGoalTree.userGoals.length + 1);
  if (working.userGoalTree.userGoals.some((goal) => goal.id === id)) {
    working.warnings.push(`create_user_goal skipped duplicate id=${id}`);
    return;
  }

  const executionState = op.executionState ?? "identified";
  const goal = normalizeUserGoalNode({
    id,
    parentId: op.parentId ?? null,
    assertion: op.assertion,
    status: mapExecutionStateToLegacyStatus(executionState),
    executionState,
    reviewState: working.input.source === "generator" ? "generator_projected" : "curator_reviewed",
    relationState: "active",
    source: buildDefaultUserGoalSource({
      createdBy: working.input.source,
      lastUpdatedBy: working.input.source,
      sourceAgentRound: working.input.sourceAgentRound,
      sourceUserTurnId: working.input.sourceUserTurnId,
    }),
    xNodeModelId: op.xNodeModelId ?? buildXNodeModelId(id),
    sinceRound: working.input.sourceAgentRound,
    lastTouchedRound: working.input.sourceAgentRound,
  });

  working.userGoalTree = {
    ...working.userGoalTree,
    currentFocusUserGoalId: id,
    rootUserGoalIds: rebuildRootUserGoalIds([...working.userGoalTree.userGoals, goal]),
    userGoals: [...working.userGoalTree.userGoals, goal],
  };
  upsertXNodeModel(working, buildXNodeModelSkeleton({
    userGoal: goal,
    agentRound: working.input.sourceAgentRound,
    nowIso: working.input.nowIso,
  }));
}

function applyXNodeModelOp(working: WorkingState, op: XNodeModelOp): void {
  switch (op.action) {
    case "patch_xnode_model":
      patchXNodeModel(working, op.userGoalId, (model) => ({
        ...model,
        currentFocusXNodeId: op.currentFocusXNodeId !== undefined ? op.currentFocusXNodeId : model.currentFocusXNodeId,
      }));
      return;
    case "add_xnode":
      patchXNodeModel(working, op.userGoalId, (model) => {
        const id = op.id ?? buildStableId("xnode", op.assertion, model.nodes.length + 1);
        if (model.nodes.some((node) => node.id === id)) {
          working.warnings.push(`add_xnode skipped duplicate id=${id}`);
          return model;
        }
        const node = buildProjectionXNode({
          id,
          parentId: op.parentId ?? model.currentFocusXNodeId ?? model.rootXNodeIds[0] ?? null,
          assertion: op.assertion,
          status: "active",
          atomicity: op.atomicity ?? "undecided",
          phase: op.phase ?? "plan",
          agentRound: working.input.sourceAgentRound,
          priority: 0,
          order: model.nodes.length,
        });
        return {
          ...model,
          currentFocusXNodeId: id,
          rootXNodeIds: node.parentId ? model.rootXNodeIds : [...model.rootXNodeIds, id],
          nodes: [...model.nodes, node],
        };
      });
      return;
    case "patch_xnode":
      patchXNode(working, op.userGoalId, op.id, (node) => ({
        ...node,
        ...(op.assertion !== undefined ? { assertion: op.assertion } : {}),
        ...(op.atomicity !== undefined ? { atomicity: op.atomicity } : {}),
        ...(op.phase !== undefined ? { phase: op.phase } : {}),
        ...(op.status !== undefined ? { status: op.status } : {}),
        ...(op.why !== undefined ? { why: op.why } : {}),
        ...(op.what !== undefined ? { what: op.what } : {}),
        ...(op.flow !== undefined ? { flow: op.flow } : {}),
        ...(op.structure !== undefined ? { structure: op.structure } : {}),
        ...(op.runtimeProof !== undefined ? { runtimeProof: op.runtimeProof } : {}),
        lastTouchedRound: working.input.sourceAgentRound,
      }));
      return;
    case "complete_xnode":
      completeXNodeWithCommit(working, op.userGoalId, op.id);
      return;
    case "switch_focus_xnode":
      patchXNodeModel(working, op.userGoalId, (model) => ({ ...model, currentFocusXNodeId: op.id }));
      return;
  }
}

function updateUserGoal(
  working: WorkingState,
  id: string,
  update: (goal: UserGoalNode) => UserGoalNode,
  action?: UserGoalProjectionOp["action"],
): void {
  let found = false;
  const source = buildDefaultUserGoalSource({
    createdBy: working.input.source,
    lastUpdatedBy: working.input.source,
    sourceAgentRound: working.input.sourceAgentRound,
    sourceUserTurnId: working.input.sourceUserTurnId,
  });
  const userGoals = working.userGoalTree.userGoals.map((goal) => {
    if (goal.id !== id) return goal;
    found = true;
    return normalizeUserGoalNode({
      ...update(goal),
      lastTouchedRound: working.input.sourceAgentRound,
      source: goal.source ? { ...goal.source, lastUpdatedBy: working.input.source, sourceAgentRound: working.input.sourceAgentRound } : source,
    });
  });
  if (!found) {
    working.warnings.push(action
      ? `identity-resolution missing userGoalId=${id} action=${action}`
      : `user goal not found id=${id}`);
    return;
  }
  working.userGoalTree = {
    ...working.userGoalTree,
    userGoals,
    rootUserGoalIds: rebuildRootUserGoalIds(userGoals),
  };
}

function patchRootXNodeAssertion(working: WorkingState, userGoalId: string, assertion: string): void {
  patchXNode(working, userGoalId, userGoalId, (node) => ({ ...node, assertion, lastTouchedRound: working.input.sourceAgentRound }));
}

function reopenXNodeModel(
  working: WorkingState,
  userGoalId: string,
  executionState: Exclude<UserGoalExecutionState, "completed">,
): void {
  patchXNodeModel(working, userGoalId, (model) => reopenXNodeModelRoot(model, {
    executionState,
    agentRound: working.input.sourceAgentRound,
    updatedAt: working.input.nowIso,
  }));
}

function patchXNodeModel(
  working: WorkingState,
  userGoalId: string,
  update: (model: XNodeModelDocument) => XNodeModelDocument,
): void {
  const index = working.xNodeModels.findIndex((model) => model.userGoalId === userGoalId);
  if (index < 0) {
    working.warnings.push(`x-node model not found userGoalId=${userGoalId}`);
    return;
  }
  const nextModels = working.xNodeModels.slice();
  nextModels[index] = update({ ...nextModels[index]!, agentRound: working.input.sourceAgentRound, updatedAt: working.input.nowIso });
  working.xNodeModels = enrichXNodeModels(nextModels);
}

function completeXNodeWithCommit(working: WorkingState, userGoalId: string, xNodeId: string): void {
  patchXNodeModel(working, userGoalId, (model) => {
    let completedNode: XNode | null = null;
    const nodes = model.nodes.map((node) => {
      if (node.id !== xNodeId) return node;
      completedNode = {
        ...node,
        status: "completed",
        phase: "complete",
        completedAtRound: node.completedAtRound ?? working.input.sourceAgentRound,
        lastTouchedRound: working.input.sourceAgentRound,
      };
      return completedNode;
    });

    if (!completedNode) {
      working.warnings.push(`x-node not found id=${xNodeId}`);
      return { ...model, nodes };
    }

    const nextOpenXNodeId = nodes.find((node) => node.status !== "completed" && node.phase !== "complete")?.id ?? null;
    const proofRef = model.latestRuntimeProof && model.latestRuntimeProof.targetXNodeId === xNodeId
      ? [model.latestRuntimeProof]
      : [];
    const commit: XNodeCommit = {
      commitId: buildXNodeCommitId(userGoalId, model.id, xNodeId, working.input.sourceAgentRound, model.commitLog?.length ?? 0),
      userGoalId,
      xNodeModelId: model.id,
      xNodeId,
      resultStatus: "completed",
      outputRefs: [],
      proofRefs: proofRef,
      statePatch: {
        status: "completed",
        phase: "complete",
        nextFocusXNodeId: nextOpenXNodeId,
        updatedFacets: {
          runtimeProof: completedNode.runtimeProof,
        },
      },
      evidence: [
        `complete_xnode userGoalId=${userGoalId} xNodeId=${xNodeId}`,
        ...(proofRef.length > 0 ? proofRef.flatMap((proof) => proof.evidence) : []),
      ],
    };

    return {
      ...model,
      nodes,
      currentFocusXNodeId: nextOpenXNodeId,
      commitLog: [...(model.commitLog ?? []), commit],
    };
  });
}

function buildXNodeCommitId(userGoalId: string, xNodeModelId: string, xNodeId: string, agentRound: number, index: number): string {
  return `commit-${userGoalId}-${xNodeModelId}-${xNodeId}-${agentRound}-${index + 1}`;
}

function patchXNode(
  working: WorkingState,
  userGoalId: string,
  xNodeId: string,
  update: (node: XNode) => XNode,
): void {
  patchXNodeModel(working, userGoalId, (model) => {
    let found = false;
    const nodes = model.nodes.map((node) => {
      if (node.id !== xNodeId) return node;
      found = true;
      return update(node);
    });
    if (!found) working.warnings.push(`x-node not found id=${xNodeId}`);
    return { ...model, nodes };
  });
}

function applyExplicitFocus(working: WorkingState): void {
  if (working.input.focus?.currentFocusUserGoalId !== undefined) {
    working.userGoalTree = {
      ...working.userGoalTree,
      currentFocusUserGoalId: working.input.focus.currentFocusUserGoalId,
    };
  }
  const focusUserGoalId = working.userGoalTree.currentFocusUserGoalId;
  if (focusUserGoalId && working.input.focus?.currentFocusXNodeId !== undefined) {
    patchXNodeModel(working, focusUserGoalId, (model) => ({
      ...model,
      currentFocusXNodeId: working.input.focus!.currentFocusXNodeId!,
    }));
  }
}

function ensureOpenUserGoalsHaveXNodeModels(working: WorkingState): void {
  for (const goal of working.userGoalTree.userGoals) {
    const normalizedGoal = normalizeUserGoalNode(goal);
    if (normalizedGoal.executionState === "completed") continue;
    const expectedModelId = normalizedGoal.xNodeModelId ?? buildXNodeModelId(normalizedGoal.id);
    const model = working.xNodeModels.find((item) => item.userGoalId === normalizedGoal.id || item.id === expectedModelId);
    if (!model) {
      working.warnings.push(`identity-resolution missing xNodeModelId=${expectedModelId} userGoalId=${normalizedGoal.id}`);
      continue;
    }
    if (normalizedGoal.xNodeModelId && model.id !== normalizedGoal.xNodeModelId) {
      working.warnings.push(`identity-resolution mismatched xNodeModelId=${normalizedGoal.xNodeModelId} modelId=${model.id} userGoalId=${normalizedGoal.id}`);
    }
    if (model.userGoalId !== normalizedGoal.id) {
      working.warnings.push(`identity-resolution mismatched userGoalId=${normalizedGoal.id} model.userGoalId=${model.userGoalId} xNodeModelId=${model.id}`);
    }
  }
}

function ensureFocusIntegrity(working: WorkingState): void {
  const focusUserGoalId = working.userGoalTree.currentFocusUserGoalId;
  if (focusUserGoalId && !working.userGoalTree.userGoals.some((goal) => goal.id === focusUserGoalId)) {
    working.warnings.push(`currentFocusUserGoalId not found id=${focusUserGoalId}`);
    working.userGoalTree = { ...working.userGoalTree, currentFocusUserGoalId: firstOpenUserGoalId(working.userGoalTree) };
  }

  const model = working.xNodeModels.find((item) => item.userGoalId === working.userGoalTree.currentFocusUserGoalId);
  if (model?.currentFocusXNodeId && !model.nodes.some((node) => node.id === model.currentFocusXNodeId)) {
    working.warnings.push(`currentFocusXNodeId not found id=${model.currentFocusXNodeId}`);
    patchXNodeModel(working, model.userGoalId, (nextModel) => ({
      ...nextModel,
      currentFocusXNodeId: nextModel.nodes.find((node) => node.status !== "completed")?.id ?? null,
    }));
  }

  working.userGoalTree = {
    ...working.userGoalTree,
    rootUserGoalIds: rebuildRootUserGoalIds(working.userGoalTree.userGoals),
  };
}

function upsertXNodeModel(working: WorkingState, nextModel: XNodeModelDocument): void {
  const rest = working.xNodeModels.filter((model) => model.userGoalId !== nextModel.userGoalId);
  working.xNodeModels = enrichXNodeModels([...rest, nextModel]);
}

function rebuildRootUserGoalIds(userGoals: UserGoalNode[]): string[] {
  return userGoals
    .filter((goal) => goal.parentId === null && normalizeUserGoalNode(goal).executionState !== "completed")
    .map((goal) => goal.id);
}

function firstOpenUserGoalId(userGoalTree: UserGoalTreeDocument): string | null {
  return userGoalTree.userGoals.find((goal) => normalizeUserGoalNode(goal).executionState !== "completed")?.id ?? null;
}

function buildXNodeModelId(userGoalId: string): string {
  return `xnode-${userGoalId}`;
}

function buildStableId(prefix: string, assertion: string, ordinal: number): string {
  const slug = assertion
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "item";
  return `${prefix}-${slug}-${ordinal}`;
}
