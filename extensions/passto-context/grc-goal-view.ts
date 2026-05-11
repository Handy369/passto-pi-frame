import type { GoalStateDocument } from "./types.js";

const MAX_RECENT_MIGRATIONS = 3;

export interface GoalViewFocusItem {
  id: string;
  assertion: string;
  status: "active" | "suspended" | "completed";
}

export interface GoalViewSiblingItem {
  id: string;
  assertion: string;
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
  recentMigrations: GoalViewMigrationItem[];
  recentCompletedGoals: Array<{ id: string; assertion: string; completedAtRound: number }>;
  updatedRound: number;
}

const MAX_SIBLING_ACTIVE_GOALS = 3;

export function buildGoalViewModel(
  goalState: GoalStateDocument | null,
  options?: { maxSiblingActiveGoals?: number; maxRecentMigrations?: number; maxRecentCompletedGoals?: number },
): GoalViewModel | null {
  if (!goalState) return null;

  const maxSiblingActiveGoals = Math.max(0, options?.maxSiblingActiveGoals ?? MAX_SIBLING_ACTIVE_GOALS);
  const maxRecentMigrations = Math.max(0, options?.maxRecentMigrations ?? MAX_RECENT_MIGRATIONS);
  const maxRecentCompletedGoals = Math.max(0, options?.maxRecentCompletedGoals ?? 3);

  const focusGoal = selectFocusGoal(goalState);
  const currentFocusGoalId = focusGoal?.id ?? null;

  const focusPath = focusGoal
    ? [{ id: focusGoal.id, assertion: focusGoal.assertion, status: focusGoal.status }]
    : [];

  const siblingActiveGoals = goalState.active
    .filter((item) => item.id !== currentFocusGoalId)
    .sort((a, b) => b.lastConfirmedRound - a.lastConfirmedRound)
    .slice(0, maxSiblingActiveGoals)
    .map((item) => ({ id: item.id, assertion: item.assertion }));

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
    recentMigrations,
    recentCompletedGoals,
    updatedRound: goalState.agentRound,
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
