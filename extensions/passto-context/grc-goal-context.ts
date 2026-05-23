import type { GoalStateAny, ReflectorGoalContext, UserGoalTreeDocument, XNodeModelDocument } from "./types.js";
import { buildGoalViewModel, buildGoalViewModelFromObjectSidecars } from "./grc-goal-view.ts";

export function buildReflectorGoalContext(goalState: GoalStateAny | null): ReflectorGoalContext | null {
  const view = buildGoalViewModel(goalState);
  if (!view) return null;

  return {
    currentFocusGoalId: view.currentFocusGoalId,
    focusPath: view.focusPath,
    siblingActiveGoals: view.siblingActiveGoals,
    recentMigrations: view.recentMigrations.map((migration) => ({
      fromGoalId: migration.fromGoalId,
      toGoalId: migration.toGoalId,
      reason: migration.reason,
    })),
  };
}

export function buildReflectorGoalContextFromObjectSidecars(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
): ReflectorGoalContext | null {
  const view = buildGoalViewModelFromObjectSidecars(userGoalTree, xNodeModels);
  if (!view) return null;

  return {
    currentFocusGoalId: view.currentFocusGoalId,
    focusPath: view.focusPath,
    siblingActiveGoals: view.siblingActiveGoals,
    recentMigrations: view.recentMigrations.map((migration) => ({
      fromGoalId: migration.fromGoalId,
      toGoalId: migration.toGoalId,
      reason: migration.reason,
    })),
  };
}
