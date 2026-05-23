import type {
  UserGoalExecutionState,
  UserGoalNode,
  UserGoalRelationState,
  UserGoalTreeDocument,
  XNodeModelDocument,
} from "./types.ts";
import {
  applyUserGoalProjectionToObjectState,
  type UserGoalProjectionOp,
  type XNodeModelOp,
} from "./grc-user-goal-projection.ts";

export type CuratorReconciliationOp =
  | MarkReviewedOp
  | ReviseUserGoalOp
  | SupersedeUserGoalOp
  | DiscardUserGoalOp
  | MergeUserGoalsReconciliationOp
  | SplitUserGoalReconciliationOp
  | AdvanceExecutionStateOp
  | UpdateXNodeModelOp
  | AdjustFocusOp;

export interface MarkReviewedOp {
  action: "mark_reviewed";
  targetUserGoalId: string;
}

export interface ReviseUserGoalOp {
  action: "revise_user_goal";
  targetUserGoalId: string;
  patch: Partial<Pick<UserGoalNode, "assertion" | "executionState" | "relationState" | "reviewState">>;
}

export interface SupersedeUserGoalOp {
  action: "supersede_user_goal";
  targetUserGoalId: string;
  successorUserGoalId?: string;
  reason: string;
}

export interface DiscardUserGoalOp {
  action: "discard_user_goal";
  targetUserGoalId: string;
  reason: string;
}

export interface MergeUserGoalsReconciliationOp {
  action: "merge_user_goals";
  sourceUserGoalIds: string[];
  targetUserGoalId: string;
}

export interface SplitUserGoalReconciliationOp {
  action: "split_user_goal";
  sourceUserGoalId: string;
  newGoals: Array<{ id?: string; assertion: string }>;
}

export interface AdvanceExecutionStateOp {
  action: "advance_execution_state";
  targetUserGoalId: string;
  executionState: UserGoalExecutionState;
}

export interface UpdateXNodeModelOp {
  action: "update_xnode_model";
  targetUserGoalId: string;
  xNodeModelOps: XNodeModelOp[];
}

export interface AdjustFocusOp {
  action: "adjust_focus";
  currentFocusUserGoalId?: string | null;
  currentFocusXNodeId?: string | null;
}

export interface ApplyCuratorReconciliationInput {
  current: {
    userGoalTree: UserGoalTreeDocument | null;
    xNodeModels: XNodeModelDocument[];
  };
  reconciliationOps: CuratorReconciliationOp[];
  sourceAgentRound: number;
  nowIso: string;
}

export interface ApplyCuratorReconciliationResult {
  userGoalTree: UserGoalTreeDocument | null;
  xNodeModels: XNodeModelDocument[];
  warnings: string[];
}

export function applyCuratorReconciliationOps(input: ApplyCuratorReconciliationInput): ApplyCuratorReconciliationResult {
  if (input.reconciliationOps.length === 0) {
    return {
      userGoalTree: input.current.userGoalTree,
      xNodeModels: input.current.xNodeModels,
      warnings: [],
    };
  }

  const userGoalOps: UserGoalProjectionOp[] = [];
  const xNodeModelOps: XNodeModelOp[] = [];
  const warnings: string[] = [];
  let focus: { currentFocusUserGoalId?: string | null; currentFocusXNodeId?: string | null } | undefined;

  for (const op of input.reconciliationOps) {
    switch (op.action) {
      case "mark_reviewed":
        userGoalOps.push({ action: "update_user_goal", id: op.targetUserGoalId, relationState: "active" });
        break;
      case "revise_user_goal":
        userGoalOps.push({
          action: "update_user_goal",
          id: op.targetUserGoalId,
          assertion: op.patch.assertion,
          executionState: op.patch.executionState,
          relationState: op.patch.relationState ?? (op.patch.assertion ? "revised" : undefined),
        });
        break;
      case "supersede_user_goal":
        userGoalOps.push({ action: "update_user_goal", id: op.targetUserGoalId, relationState: "superseded" });
        if (op.successorUserGoalId) {
          userGoalOps.push({ action: "switch_focus_user_goal", id: op.successorUserGoalId });
        }
        break;
      case "discard_user_goal":
        userGoalOps.push({ action: "update_user_goal", id: op.targetUserGoalId, relationState: "discarded" });
        break;
      case "merge_user_goals":
        userGoalOps.push({ action: "merge_user_goals", sourceIds: op.sourceUserGoalIds, targetId: op.targetUserGoalId });
        break;
      case "split_user_goal":
        userGoalOps.push({ action: "split_user_goal", sourceId: op.sourceUserGoalId, goals: op.newGoals });
        break;
      case "advance_execution_state":
        if (op.executionState === "completed") {
          userGoalOps.push({ action: "complete_user_goal", id: op.targetUserGoalId });
        } else {
          userGoalOps.push({ action: "update_user_goal", id: op.targetUserGoalId, executionState: op.executionState });
        }
        break;
      case "update_xnode_model":
        xNodeModelOps.push(...op.xNodeModelOps);
        break;
      case "adjust_focus":
        focus = {
          currentFocusUserGoalId: op.currentFocusUserGoalId,
          currentFocusXNodeId: op.currentFocusXNodeId,
        };
        break;
      default:
        assertNever(op);
    }
  }

  if (!input.current.userGoalTree && userGoalOps.length === 0) {
    return {
      userGoalTree: null,
      xNodeModels: input.current.xNodeModels,
      warnings: ["reconciliationOps ignored because userGoalTree is missing", ...warnings],
    };
  }

  const result = applyUserGoalProjectionToObjectState({
    current: input.current,
    userGoalOps,
    xNodeModelOps,
    focus,
    source: "curator",
    sourceAgentRound: input.sourceAgentRound,
    nowIso: input.nowIso,
  });

  return {
    userGoalTree: markReviewed(result.userGoalTree, input.reconciliationOps, input.sourceAgentRound),
    xNodeModels: result.xNodeModels,
    warnings: [...warnings, ...result.warnings],
  };
}

function markReviewed(
  userGoalTree: UserGoalTreeDocument,
  ops: CuratorReconciliationOp[],
  sourceAgentRound: number,
): UserGoalTreeDocument {
  const reviewedIds = new Set<string>();
  for (const op of ops) {
    if ("targetUserGoalId" in op) reviewedIds.add(op.targetUserGoalId);
    if (op.action === "merge_user_goals") {
      reviewedIds.add(op.targetUserGoalId);
      for (const id of op.sourceUserGoalIds) reviewedIds.add(id);
    }
    if (op.action === "split_user_goal") reviewedIds.add(op.sourceUserGoalId);
  }

  if (reviewedIds.size === 0) return userGoalTree;

  return {
    ...userGoalTree,
    userGoals: userGoalTree.userGoals.map((goal) => {
      if (!reviewedIds.has(goal.id)) return goal;
      return {
        ...goal,
        reviewState: "curator_reviewed",
        lastTouchedRound: Math.max(goal.lastTouchedRound, sourceAgentRound),
        source: goal.source
          ? { ...goal.source, lastUpdatedBy: "curator", sourceAgentRound }
          : { createdBy: "curator", lastUpdatedBy: "curator", sourceAgentRound },
      };
    }),
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled reconciliation op: ${JSON.stringify(value)}`);
}
