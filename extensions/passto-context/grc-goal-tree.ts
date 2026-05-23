import type {
  GoalNode,
  GoalStateAny,
  GoalStateDocument,
  GoalTreeDocument,
  GoalTreeMigration,
} from "./types.ts";

export function isGoalTreeDocument(value: unknown): value is GoalTreeDocument {
  return !!value && typeof value === "object" && (value as { version?: unknown }).version === 2;
}

export function ensureGoalTreeDocument(goalState: GoalStateAny | null): GoalTreeDocument | null {
  if (!goalState) {
    return createEmptyGoalTreeDocument();
  }
  if (isGoalTreeDocument(goalState)) return goalState;
  return upgradeGoalStateToTree(goalState);
}

export function createEmptyGoalTreeDocument(): GoalTreeDocument {
  return {
    version: 2,
    agentRound: 0,
    updatedAt: new Date(0).toISOString(),
    rootGoalIds: [],
    currentFocusGoalId: null,
    nodes: [],
    migrations: [],
    prunedCount: 0,
  };
}

export function upgradeGoalStateToTree(v1: GoalStateDocument): GoalTreeDocument {
  const nodes: GoalNode[] = [];
  let order = 0;

  for (const item of v1.active) {
    nodes.push({
      id: item.id,
      parentId: null,
      assertion: item.assertion,
      kind: "goal",
      status: item.status,
      signal: item.signal,
      atomicity: "undecided",
      phase: item.status === "active" ? "plan" : "plan_insufficient",
      sinceRound: item.sinceRound,
      lastTouchedRound: item.lastConfirmedRound,
      lastConfirmedRound: item.lastConfirmedRound,
      priority: 0,
      order: order++,
    });
  }

  for (const item of v1.completed) {
    nodes.push({
      id: item.id,
      parentId: null,
      assertion: item.assertion,
      kind: "goal",
      status: "completed",
      signal: "inferred",
      atomicity: "undecided",
      phase: "complete",
      sinceRound: item.completedAtRound,
      lastTouchedRound: item.completedAtRound,
      lastConfirmedRound: item.completedAtRound,
      completedAtRound: item.completedAtRound,
      priority: 0,
      order: order++,
    });
  }

  const migrations: GoalTreeMigration[] = v1.migrations.map((migration, index) => ({
    id: `migration-${index + 1}`,
    fromGoalId: migration.from || null,
    toGoalId: migration.to,
    type: "refine",
    atRound: migration.atRound,
    triggerSignal: "continue",
    reason: migration.reason,
  }));

  return {
    version: 2,
    agentRound: v1.agentRound,
    updatedAt: v1.updatedAt,
    rootGoalIds: nodes.filter((node) => node.parentId === null && node.status !== "completed").map((node) => node.id),
    currentFocusGoalId: selectFocusGoalId(v1),
    nodes,
    migrations,
    prunedCount: v1.prunedCount,
  };
}

export function downgradeTreeToGoalState(tree: GoalTreeDocument): GoalStateDocument {
  return {
    version: 1,
    agentRound: tree.agentRound,
    updatedAt: tree.updatedAt,
    active: tree.nodes
      .filter((node) => node.status === "active" || node.status === "suspended")
      .map((node) => ({
        id: node.id,
        assertion: node.assertion,
        status: node.status as "active" | "suspended",
        sinceRound: node.sinceRound,
        lastConfirmedRound: node.lastConfirmedRound,
        signal: node.signal === "draft" ? "inferred" : node.signal,
      })),
    completed: tree.nodes
      .filter((node) => node.status === "completed")
      .map((node) => ({
        id: node.id,
        assertion: node.assertion,
        completedAtRound: node.completedAtRound ?? node.lastConfirmedRound,
      })),
    migrations: tree.migrations.map((migration) => ({
      from: migration.fromGoalId ?? "",
      to: migration.toGoalId,
      atRound: migration.atRound,
      reason: migration.reason,
    })),
    prunedCount: tree.prunedCount,
  };
}

function selectFocusGoalId(v1: GoalStateDocument): string | null {
  if (v1.active.length === 0) return null;

  return [...v1.active]
    .sort((a, b) => {
      if (b.lastConfirmedRound !== a.lastConfirmedRound) return b.lastConfirmedRound - a.lastConfirmedRound;
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      return b.sinceRound - a.sinceRound;
    })[0]?.id ?? null;
}
