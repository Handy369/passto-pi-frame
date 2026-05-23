import type { GRCState, XNodeFacet, XNodePolicyProjection } from "./types.ts";
import {
  type ApplyUserGoalProjectionInput,
  type ApplyUserGoalProjectionResult,
  applyUserGoalProjectionToObjectState,
} from "./grc-user-goal-projection.ts";
import { getEffectiveObjectState, serializeGRCState, setCuratorObjectSidecars } from "./grc-state.ts";

interface TypeSchemaFactory {
  Object: (properties: Record<string, unknown>, options?: Record<string, unknown>) => unknown;
  Array: (items: unknown, options?: Record<string, unknown>) => unknown;
  Optional: (schema: unknown) => unknown;
  Union: (schemas: unknown[]) => unknown;
  Literal: (value: string) => unknown;
  String: (options?: Record<string, unknown>) => unknown;
  Boolean: () => unknown;
  Null: () => unknown;
}

export function createApplyUserGoalProjectionToolParams(Type: TypeSchemaFactory): unknown {
  const userGoalActionSchema = Type.Union([
    Type.Literal("create_user_goal"),
    Type.Literal("update_user_goal"),
    Type.Literal("switch_focus_user_goal"),
    Type.Literal("complete_user_goal"),
    Type.Literal("reopen_user_goal"),
    Type.Literal("migrate_user_goal"),
    Type.Literal("split_user_goal"),
    Type.Literal("merge_user_goals"),
  ]);
  const xNodeActionSchema = Type.Union([
    Type.Literal("patch_xnode_model"),
    Type.Literal("add_xnode"),
    Type.Literal("patch_xnode"),
    Type.Literal("complete_xnode"),
    Type.Literal("switch_focus_xnode"),
  ]);
  const projectionSourceSchema = Type.Union([
    Type.Literal("generator"),
    Type.Literal("curator"),
    Type.Literal("restore"),
    Type.Literal("migration"),
  ]);
  const goalRelationSchema = Type.Union([
    Type.Literal("new_root"),
    Type.Literal("new_sibling_of_focus"),
    Type.Literal("new_child_of_focus"),
    Type.Literal("update_current_focus"),
    Type.Literal("switch_focus_to_existing"),
    Type.Literal("complete_current_focus"),
    Type.Literal("no_goal_change"),
  ]);
  const confidenceSchema = Type.Union([
    Type.Literal("low"),
    Type.Literal("medium"),
    Type.Literal("high"),
  ]);

  return Type.Object({
    goalRelationDecision: Type.Optional(Type.Object({
      relation: goalRelationSchema,
      focusUserGoalIdBefore: Type.Union([Type.String(), Type.Null()]),
      targetUserGoalId: Type.Union([Type.String(), Type.Null()]),
      targetXNodeModelId: Type.Union([Type.String(), Type.Null()]),
      targetXNodeId: Type.Union([Type.String(), Type.Null()]),
      parentUserGoalId: Type.Union([Type.String(), Type.Null()]),
      producesNewUserGoal: Type.Boolean(),
      shouldCreateXNodeModel: Type.Boolean(),
      expectedOutput: Type.Optional(Type.Object({}, { additionalProperties: true })),
      outputLocation: Type.Optional(Type.String()),
      methodRef: Type.Optional(Type.String()),
      requiredParameterRefs: Type.Optional(Type.Array(Type.String())),
      evidence: Type.Array(Type.String()),
      confidence: confidenceSchema,
    }, { additionalProperties: false, description: "LLM-owned GoalRelationDecision. Scripts only validate consistency and persist projection ops." })),
    userGoalOps: Type.Array(Type.Object({
      action: userGoalActionSchema,
    }, { additionalProperties: true }), { description: "UserGoalProjectionOp[] to apply to the current object state." }),
    xNodeModelOps: Type.Optional(Type.Array(Type.Object({
      action: xNodeActionSchema,
    }, { additionalProperties: true }), { description: "Optional XNodeModelOp[] for incremental x-node state updates." })),
    focus: Type.Optional(Type.Object({
      currentFocusUserGoalId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      currentFocusXNodeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    }, { additionalProperties: false })),
    source: Type.Optional(projectionSourceSchema),
    sourceUserTurnId: Type.Optional(Type.String()),
    idempotencyKey: Type.Optional(Type.String()),
  }, { additionalProperties: false });
}

export interface ApplyUserGoalProjectionToolParamsValue {
  goalRelationDecision?: ApplyUserGoalProjectionInput["goalRelationDecision"];
  userGoalOps: unknown[];
  xNodeModelOps?: unknown[];
  focus?: {
    currentFocusUserGoalId?: string | null;
    currentFocusXNodeId?: string | null;
  };
  source?: "generator" | "curator" | "restore" | "migration";
  sourceUserTurnId?: string;
  idempotencyKey?: string;
}

export interface ApplyUserGoalProjectionToolEnv {
  getState: () => GRCState | null;
  setState: (state: GRCState) => void;
  appendState: (state: GRCState) => void;
  nowIso?: () => string;
}

export interface ApplyUserGoalProjectionToolExecutionResult {
  text: string;
  details: {
    userGoalTree: ApplyUserGoalProjectionResult["userGoalTree"];
    xNodeModels: ApplyUserGoalProjectionResult["xNodeModels"];
    warnings: string[];
    latestPolicyProjection: XNodePolicyProjection | null;
  };
}

export function executeApplyUserGoalProjectionTool(
  params: ApplyUserGoalProjectionToolParamsValue,
  env: ApplyUserGoalProjectionToolEnv,
): ApplyUserGoalProjectionToolExecutionResult {
  const state = env.getState();
  if (!state) {
    return {
      text: "PasstoContext not initialized; applyUserGoalProjection skipped.",
      details: {
        userGoalTree: {
          version: 1,
          agentRound: 0,
          updatedAt: env.nowIso?.() ?? new Date().toISOString(),
          currentFocusUserGoalId: null,
          rootUserGoalIds: [],
          userGoals: [],
        },
        xNodeModels: [],
        warnings: ["grc-state-not-initialized"],
        latestPolicyProjection: null,
      },
    };
  }

  const effectiveObjectState = getEffectiveObjectState(state);
  const projectionInput: ApplyUserGoalProjectionInput = {
    current: effectiveObjectState,
    goalRelationDecision: params.goalRelationDecision,
    userGoalOps: params.userGoalOps as ApplyUserGoalProjectionInput["userGoalOps"],
    xNodeModelOps: params.xNodeModelOps as ApplyUserGoalProjectionInput["xNodeModelOps"],
    focus: params.focus,
    source: params.source ?? "generator",
    sourceAgentRound: state.currentAgentRound || state.totalAgentRounds || 0,
    sourceUserTurnId: params.sourceUserTurnId,
    nowIso: env.nowIso?.() ?? new Date().toISOString(),
    idempotencyKey: params.idempotencyKey,
  };

  const result = applyUserGoalProjectionToObjectState(projectionInput);
  const nextState = setCuratorObjectSidecars(state, {
    userGoalTree: result.userGoalTree,
    xNodeModels: result.xNodeModels,
  });
  env.setState(nextState);
  env.appendState(serializeGRCState(nextState));

  return {
    text: formatApplyUserGoalProjectionResult(result, nextState.curator.lastPolicyProjection ?? null),
    details: {
      userGoalTree: result.userGoalTree,
      xNodeModels: result.xNodeModels,
      warnings: result.warnings,
      latestPolicyProjection: nextState.curator.lastPolicyProjection ?? null,
    },
  };
}

function formatApplyUserGoalProjectionResult(
  result: ApplyUserGoalProjectionResult,
  latestPolicyProjection: XNodePolicyProjection | null,
): string {
  const currentGoal = result.userGoalTree.userGoals.find((goal) => goal.id === result.userGoalTree.currentFocusUserGoalId) ?? null;
  const lines = [
    "applyUserGoalProjection applied.",
    `userGoals=${result.userGoalTree.userGoals.length}, xNodeModels=${result.xNodeModels.length}`,
    `currentFocusUserGoalId=${result.userGoalTree.currentFocusUserGoalId ?? "none"}`,
  ];

  if (currentGoal) {
    lines.push(`currentGoal=${currentGoal.assertion}`);
  }

  if (latestPolicyProjection) {
    lines.push(`nextStep=${latestPolicyProjection.nextStepType} confidence=${latestPolicyProjection.confidence}`);
  }

  const proofFacet = selectFocusedRuntimeProofFacet(result, latestPolicyProjection?.xNodeId ?? null);
  if (proofFacet) {
    lines.push(`runtimeProof=${proofFacet.confidence}: ${proofFacet.summary}`);
  }

  if (result.warnings.length > 0) {
    lines.push(`warnings=${result.warnings.join("; ")}`);
  }

  return lines.join("\n");
}

function selectFocusedRuntimeProofFacet(
  result: ApplyUserGoalProjectionResult,
  focusedXNodeId: string | null,
): XNodeFacet | null {
  if (!focusedXNodeId) return null;
  for (const model of result.xNodeModels) {
    const node = model.nodes.find((item) => item.id === focusedXNodeId);
    if (node) return node.runtimeProof;
  }
  return null;
}
