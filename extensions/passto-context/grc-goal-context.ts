import type { GoalStateDocument, ReflectorGoalContext } from "./types.js";
import { buildGoalViewModel } from "./grc-goal-view.ts";

export function buildReflectorGoalContext(goalState: GoalStateDocument | null): ReflectorGoalContext | null {
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
