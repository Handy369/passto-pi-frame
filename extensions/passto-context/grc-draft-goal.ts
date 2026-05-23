import type { DraftGoalOp, GoalNode, GoalTreeDocument } from "./types.ts";

function isGoalNodeKind(value: unknown): value is GoalNode["kind"] {
  return value === "goal" || value === "subgoal" || value === "branch";
}

function isGoalNodePhase(value: unknown): value is GoalNode["phase"] {
  return value === "plan" || value === "plan_insufficient" || value === "execute" || value === "testing" || value === "pending_acceptance" || value === "complete";
}

function isGoalNodeAtomicity(value: unknown): value is GoalNode["atomicity"] {
  return value === "atomic" || value === "composite" || value === "undecided";
}

export function parseDraftGoalOp(raw: unknown): DraftGoalOp | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const action = value.action;
  if (!["create", "refine-current-draft", "no-op"].includes(String(action))) return null;

  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  const goalRaw = value.goal;
  const goal = goalRaw && typeof goalRaw === "object"
    ? normalizeDraftGoal(goalRaw as Record<string, unknown>)
    : undefined;

  if (action === "create") {
    if (!goal || !goal.assertion) return null;
    return {
      action: "create",
      goal,
      reason,
    };
  }

  return {
    action: action as DraftGoalOp["action"],
    goal,
    reason,
  };
}

function normalizeDraftGoal(value: Record<string, unknown>): DraftGoalOp["goal"] | undefined {
  const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
  if (!assertion) return undefined;

  return {
    assertion,
    kind: isGoalNodeKind(value.kind) ? value.kind : undefined,
    parentGoalId:
      typeof value.parentGoalId === "string"
        ? value.parentGoalId.trim()
        : value.parentGoalId === null
          ? null
          : undefined,
    atomicity: isGoalNodeAtomicity(value.atomicity) ? value.atomicity : undefined,
    phase: isGoalNodePhase(value.phase) ? value.phase : undefined,
  };
}

export function extractDraftGoalOpFromText(text: string): DraftGoalOp | null {
  const trimmed = text.trim();
  const fencedMatches = [...trimmed.matchAll(/```json\s*([\s\S]*?)```/g)];
  for (let index = fencedMatches.length - 1; index >= 0; index -= 1) {
    const block = fencedMatches[index]?.[1];
    if (!block) continue;
    const parsed = tryParseDraftGoalContainer(block);
    if (parsed) return parsed;
  }

  const tailObject = trimmed.match(/\{[\s\S]*"draftGoalOp"[\s\S]*\}\s*$/);
  if (tailObject?.[0]) {
    return tryParseDraftGoalContainer(tailObject[0]);
  }

  return null;
}

function tryParseDraftGoalContainer(raw: string): DraftGoalOp | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parseDraftGoalOp(parsed.draftGoalOp ?? null);
  } catch {
    return null;
  }
}

export function applyDraftGoalOpToGoalTree(
  baseGoalState: GoalTreeDocument,
  draftGoalOp: DraftGoalOp | null,
  currentAgentRound: number,
): GoalTreeDocument {
  if (!draftGoalOp || draftGoalOp.action !== "create" || !draftGoalOp.goal) {
    return baseGoalState;
  }

  const parentGoalId = draftGoalOp.goal.parentGoalId;
  const parentExists = parentGoalId === null || baseGoalState.nodes.some((node) => node.id === parentGoalId);
  if (!parentExists) {
    return baseGoalState;
  }

  const siblingOrderBase = baseGoalState.nodes
    .filter((node) => node.parentId === (parentGoalId ?? null))
    .reduce((max, node) => Math.max(max, node.order), -1);
  const childCount = baseGoalState.nodes.filter((node) => node.id.startsWith(`draft-${currentAgentRound}-`)).length + 1;
  const kind = draftGoalOp.goal.kind ?? (parentGoalId === null ? "goal" : "subgoal");
  const newNode: GoalNode = {
    id: `draft-${currentAgentRound}-${parentGoalId === null ? "root" : "child"}-${childCount}`,
    parentId: parentGoalId ?? null,
    assertion: draftGoalOp.goal.assertion,
    kind,
    status: "active",
    signal: "draft",
    atomicity: draftGoalOp.goal.atomicity ?? "undecided",
    phase: draftGoalOp.goal.phase ?? "plan",
    sinceRound: currentAgentRound,
    lastTouchedRound: currentAgentRound,
    lastConfirmedRound: currentAgentRound,
    priority: 0,
    order: siblingOrderBase + 1,
  };

  const nodes = [...baseGoalState.nodes, newNode];
  const rootGoalIds = nodes.filter((node) => node.parentId === null && node.status !== "completed").map((node) => node.id);

  return {
    ...baseGoalState,
    agentRound: currentAgentRound,
    updatedAt: new Date().toISOString(),
    rootGoalIds,
    currentFocusGoalId: newNode.id,
    nodes,
  };
}
