import type {
  UserGoalExecutionState,
  UserGoalNode,
  UserGoalRelationState,
  UserGoalReviewState,
  UserGoalSource,
} from "./types.ts";

export interface UserGoalNormalizationDefaults {
  executionState?: UserGoalExecutionState;
  reviewState?: UserGoalReviewState;
  relationState?: UserGoalRelationState;
  source?: UserGoalSource;
}

export function normalizeUserGoalNode(
  goal: UserGoalNode,
  defaults: UserGoalNormalizationDefaults = {},
): UserGoalNode {
  const executionState = goal.executionState ?? defaults.executionState ?? inferExecutionStateFromLegacyStatus(goal.status);
  const status = mapExecutionStateToLegacyStatus(executionState);
  const reviewState = goal.reviewState ?? defaults.reviewState ?? "curator_reviewed";
  const relationState = goal.relationState ?? defaults.relationState ?? "active";
  const source = goal.source ?? defaults.source;

  return {
    ...goal,
    status,
    executionState,
    reviewState,
    relationState,
    ...(source ? { source } : {}),
  };
}

export function normalizeUserGoalNodes(
  goals: UserGoalNode[],
  defaults: UserGoalNormalizationDefaults = {},
): UserGoalNode[] {
  return goals.map((goal) => normalizeUserGoalNode(goal, defaults));
}

export function mapExecutionStateToLegacyStatus(executionState: UserGoalExecutionState): UserGoalNode["status"] {
  if (executionState === "completed") return "completed";
  if (executionState === "executing" || executionState === "testing" || executionState === "pending_acceptance") return "executing";
  if (executionState === "planning") return "planning";
  return "identified";
}

export function inferExecutionStateFromLegacyStatus(status: UserGoalNode["status"]): UserGoalExecutionState {
  if (status === "completed") return "completed";
  if (status === "executing") return "executing";
  if (status === "planning") return "planning";
  return "identified";
}

export function buildDefaultUserGoalSource(input: {
  createdBy: UserGoalSource["createdBy"];
  lastUpdatedBy?: UserGoalSource["lastUpdatedBy"];
  sourceAgentRound?: number;
  sourceUserTurnId?: string;
  evidenceEntryIds?: string[];
}): UserGoalSource {
  return {
    createdBy: input.createdBy,
    lastUpdatedBy: input.lastUpdatedBy ?? input.createdBy,
    ...(input.sourceAgentRound !== undefined ? { sourceAgentRound: input.sourceAgentRound } : {}),
    ...(input.sourceUserTurnId !== undefined ? { sourceUserTurnId: input.sourceUserTurnId } : {}),
    ...(input.evidenceEntryIds !== undefined ? { evidenceEntryIds: input.evidenceEntryIds } : {}),
  };
}
