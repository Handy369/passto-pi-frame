import type {
  CertaintyAssessment,
  CuratorResult,
  DraftDisposition,
  DraftGoalOp,
  GoalNode,
  GoalNodeAtomicity,
  GoalNodePhase,
  GoalStateAny,
  GoalStateDocument,
  GoalStateSignal,
  GoalTreeDocument,
  GoalTreeMigration,
  CuratorAuditAdvice,
  RuntimeProofRecord,
  RuntimeProofSignal,
  SummaryEntry,
  UserGoalNode,
  UserGoalTreeDocument,
  XNode,
  XNodeFacet,
  XNodeModelDocument,
  XNodePolicyProjection,
} from "./types.ts";
import { parseDraftGoalOp } from "./grc-draft-goal.ts";
import type { CuratorReconciliationOp } from "./grc-curator-reconciliation.ts";
import type { XNodeModelOp } from "./grc-user-goal-projection.ts";

export function parseCuratorOutput(raw: string): CuratorResult | null {
  const text = raw.trim();
  const parsedPayload = extractCuratorPayload(text);
  const summary = stripTrailingStructuredTail(text).trim();
  const hasMarkdownEnvelope = text.includes("## 目标") || text.includes("## 已完成");

  if (!parsedPayload && !hasMarkdownEnvelope) {
    return null;
  }

  const summaryGoal = parsedPayload?.summaryEntry?.summary.goal?.trim() ?? "";
  const summaryCompleted = parsedPayload?.summaryEntry?.summary.completed ?? [];
  const completedSection = extractListSection(summary, "已完成");

  return {
    summary,
    summaryEntry: parsedPayload?.summaryEntry ?? null,
    goalState: parsedPayload?.goalState ?? null,
    userGoalTree: parsedPayload?.userGoalTree ?? null,
    xNodeModels: parsedPayload?.xNodeModels ?? null,
    reconciliationOps: parsedPayload?.reconciliationOps ?? null,
    reconciliationWarnings: parsedPayload?.reconciliationWarnings ?? [],
    auditAdvice: parsedPayload?.auditAdvice ?? null,
    lastPolicyProjection: parsedPayload?.lastPolicyProjection ?? null,
    signal: parsedPayload?.signal ?? null,
    closureEvidence: parsedPayload?.closureEvidence ?? [],
    certaintyAssessment: parsedPayload?.certaintyAssessment ?? null,
    latestRuntimeProof: parsedPayload?.latestRuntimeProof ?? null,
    latestProofSignals: parsedPayload?.latestProofSignals ?? null,
    draftGoalOp: parsedPayload?.draftGoalOp ?? null,
    draftDispositions: parsedPayload?.draftDispositions ?? null,
    sections: {
      goal: extractSection(summary, "目标") || summaryGoal,
      completed: completedSection.length > 0 ? completedSection : summaryCompleted,
      decisions: extractListSection(summary, "关键决策"),
      files: extractListSection(summary, "修改的文件"),
      status: extractSection(summary, "当前状态"),
      nextSteps: extractListSection(summary, "下一步"),
      warnings: extractListSection(summary, "注意事项"),
    },
  };
}

function extractCuratorPayload(text: string): {
  signal: GoalStateSignal | null;
  closureEvidence: string[];
  summaryEntry: SummaryEntry | null;
  goalState: GoalStateAny | null;
  userGoalTree: UserGoalTreeDocument | null;
  xNodeModels: XNodeModelDocument[] | null;
  reconciliationOps: CuratorReconciliationOp[] | null;
  reconciliationWarnings: string[];
  auditAdvice: CuratorAuditAdvice | null;
  lastPolicyProjection: XNodePolicyProjection | null;
  certaintyAssessment: CertaintyAssessment | null;
  latestRuntimeProof: RuntimeProofRecord | null;
  latestProofSignals: RuntimeProofSignal[] | null;
  draftGoalOp: DraftGoalOp | null;
  draftDispositions: DraftDisposition[] | null;
} | null {
  const completeFenceMatch = text.match(/```json\s*([\s\S]*?)```\s*$/);
  const jsonText = completeFenceMatch?.[1]?.trim() ?? extractRecoverableTrailingJson(text);
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    return {
      signal: parseGoalStateSignal(parsed.signal),
      closureEvidence: parseStringArray(parsed.closureEvidence),
      summaryEntry: parseSummaryEntry(parsed.summaryEntry),
      goalState: parseGoalTreeDocument(parsed.goalState) ?? parseGoalStateDocument(parsed.goalState),
      userGoalTree: parseUserGoalTreeDocument(parsed.userGoalTree),
      xNodeModels: parseXNodeModels(parsed.xNodeModels),
      reconciliationOps: parseCuratorReconciliationOps(parsed.reconciliationOps),
      reconciliationWarnings: parseStringArray(parsed.reconciliationWarnings),
      auditAdvice: parseCuratorAuditAdvice(parsed.auditAdvice),
      lastPolicyProjection: parseXNodePolicyProjection(parsed.lastPolicyProjection),
      certaintyAssessment: parseCertaintyAssessment(parsed.certaintyAssessment),
      latestRuntimeProof: parseRuntimeProofRecord(parsed.latestRuntimeProof),
      latestProofSignals: parseRuntimeProofSignals(parsed.latestProofSignals),
      draftGoalOp: parseDraftGoalOp(parsed.draftGoalOp),
      draftDispositions: parseDraftDispositions(parsed.draftDispositions),
    };
  } catch {
    return null;
  }
}

function extractRecoverableTrailingJson(text: string): string | null {
  const fenceIndex = text.lastIndexOf('```json');
  if (fenceIndex < 0) return null;

  const tail = text.slice(fenceIndex + '```json'.length);
  const firstBrace = tail.indexOf('{');
  if (firstBrace < 0) return null;

  const jsonCandidate = tail.slice(firstBrace);
  return extractFirstBalancedJsonObject(jsonCandidate);
}

function extractFirstBalancedJsonObject(text: string): string | null {
  let depth = 0;
  let inString = false;
  let escaping = false;
  let started = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (!started) {
      if (ch === '{') {
        started = true;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (ch === '\\') {
        escaping = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') {
      depth += 1;
      continue;
    }

    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(0, i + 1).trim();
      }
    }
  }

  return null;
}

function parseGoalStateSignal(raw: unknown): GoalStateSignal | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const type = typeof value.type === "string" ? value.type : "";
  const confidence = typeof value.confidence === "number" ? value.confidence : 0;
  const evidence = typeof value.evidence === "string" ? value.evidence.trim() : "";
  if (!["advance", "correct", "supplement", "continue", "clarify", "confirm-draft", "revise-draft", "discard-draft"].includes(type)) return null;
  return {
    type: type as GoalStateSignal["type"],
    confidence,
    evidence,
  };
}

function parseSummaryEntry(raw: unknown): SummaryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const agentRound = typeof value.agentRound === "number" ? value.agentRound : 0;
  const summary = value.summary && typeof value.summary === "object" ? value.summary as Record<string, unknown> : null;
  if (!summary) return null;
  return {
    agentRound,
    timestamp: new Date().toISOString(),
    summary: {
      goal: typeof summary.goal === "string" ? summary.goal.trim() : "",
      completed: parseStringArray(summary.completed),
      keyDecisions: parseStringArray(summary.keyDecisions),
      filesChanged: parseFilesChanged(summary.filesChanged),
      status: typeof summary.status === "string" ? summary.status.trim() : "",
      blockers: parseStringArray(summary.blockers),
    },
    sessionPointers:
      value.sessionPointers && typeof value.sessionPointers === "object"
        ? { searchQuery: typeof (value.sessionPointers as Record<string, unknown>).searchQuery === "string" ? String((value.sessionPointers as Record<string, unknown>).searchQuery) : undefined }
        : undefined,
  };
}

function parseGoalStateDocument(raw: unknown): GoalStateDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const version = value.version === 1 ? 1 : null;
  const agentRound = typeof value.agentRound === "number" ? value.agentRound : 0;
  if (version !== 1) return null;
  return {
    version,
    agentRound,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    active: parseGoalStateActiveItems(value.active),
    completed: parseGoalStateCompletedItems(value.completed),
    migrations: parseGoalStateMigrations(value.migrations),
    prunedCount: typeof value.prunedCount === "number" ? value.prunedCount : 0,
  };
}

function parseGoalTreeDocument(raw: unknown): GoalTreeDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== 2) return null;
  return {
    version: 2,
    agentRound: typeof value.agentRound === "number" ? value.agentRound : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    rootGoalIds: parseStringArray(value.rootGoalIds),
    currentFocusGoalId: typeof value.currentFocusGoalId === "string" ? value.currentFocusGoalId.trim() : null,
    nodes: parseGoalNodes(value.nodes),
    migrations: parseGoalTreeMigrations(value.migrations),
    lastSignal: parseGoalStateSignal(value.lastSignal),
    prunedCount: typeof value.prunedCount === "number" ? value.prunedCount : 0,
  };
}

function parseGoalNodes(raw: unknown): GoalNode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      const parentId = typeof value.parentId === "string" ? value.parentId.trim() : value.parentId === null ? null : null;
      const kind = value.kind === "subgoal" || value.kind === "branch" ? value.kind : value.kind === "goal" ? "goal" : "goal";
      const status = value.status === "suspended" || value.status === "completed" ? value.status : value.status === "active" ? "active" : null;
      const signal = value.signal === "inferred" || value.signal === "draft" ? value.signal : value.signal === "explicit" ? "explicit" : null;
      const atomicity = value.atomicity === "atomic" || value.atomicity === "composite" ? value.atomicity : value.atomicity === "undecided" ? "undecided" : "undecided";
      const phase = value.phase === "plan_insufficient" || value.phase === "execute" || value.phase === "testing" || value.phase === "pending_acceptance" || value.phase === "complete" ? value.phase : "plan";
      if (!id || !assertion || !status || !signal) return null;
      const sinceRound = typeof value.sinceRound === "number" ? value.sinceRound : 0;
      const lastTouchedRound = typeof value.lastTouchedRound === "number" ? value.lastTouchedRound : sinceRound;
      const lastConfirmedRound = typeof value.lastConfirmedRound === "number" ? value.lastConfirmedRound : lastTouchedRound;
      const completedAtRound = typeof value.completedAtRound === "number" ? value.completedAtRound : undefined;
      const priority = typeof value.priority === "number" ? value.priority : 0;
      const order = typeof value.order === "number" ? value.order : index;
      return {
        id,
        parentId,
        assertion,
        kind,
        status,
        signal,
        atomicity,
        phase,
        sinceRound,
        lastTouchedRound,
        lastConfirmedRound,
        completedAtRound,
        priority,
        order,
      } satisfies GoalNode;
    })
    .filter((item): item is GoalNode => !!item);
}

function parseGoalTreeMigrations(raw: unknown): GoalTreeMigration[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const toGoalId = typeof value.toGoalId === "string" ? value.toGoalId.trim() : "";
      const reason = typeof value.reason === "string" ? value.reason.trim() : "";
      const type = value.type === "create" || value.type === "refine" || value.type === "split" || value.type === "pivot" || value.type === "resume" || value.type === "complete" ? value.type : null;
      const triggerSignal = parseGoalStateSignal({ type: value.triggerSignal, confidence: 1, evidence: "" })?.type ?? null;
      if (!toGoalId || !reason || !type || !triggerSignal) return null;
      return {
        id: typeof value.id === "string" ? value.id.trim() : `migration-${index + 1}`,
        fromGoalId: typeof value.fromGoalId === "string" ? value.fromGoalId.trim() : value.fromGoalId === null ? null : null,
        toGoalId,
        type,
        atRound: typeof value.atRound === "number" ? value.atRound : 0,
        triggerSignal,
        reason,
      } satisfies GoalTreeMigration;
    })
    .filter((item): item is GoalTreeMigration => !!item);
}

function parseCertaintyAssessment(raw: unknown): CertaintyAssessment | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const dims = value.dimensions as Record<string, unknown> | undefined;
  const isDim = (v: unknown): v is "closed" | "open" | "partial" => v === "closed" || v === "open" || v === "partial";
  if (!dims || !isDim(dims.why) || !isDim(dims.what) || !isDim(dims.flow) || !isDim(dims.structure) || !isDim(dims.runtimeProof)) {
    return null;
  }
  const nextStepType = value.nextStepType;
  if (!["plan_repair", "generate_children", "execute_atomic_work", "run_tests", "seek_acceptance", "upward_regression"].includes(String(nextStepType))) {
    return null;
  }
  return {
    dimensions: {
      why: dims.why,
      what: dims.what,
      flow: dims.flow,
      structure: dims.structure,
      runtimeProof: dims.runtimeProof,
    },
    keyGaps: parseStringArray(value.keyGaps),
    nextStepType: nextStepType as CertaintyAssessment["nextStepType"],
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
  };
}

function parseUserGoalTreeDocument(raw: unknown): UserGoalTreeDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return null;
  return {
    version: 1,
    agentRound: typeof value.agentRound === "number" ? value.agentRound : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    currentFocusUserGoalId: typeof value.currentFocusUserGoalId === "string" ? value.currentFocusUserGoalId.trim() : value.currentFocusUserGoalId === null ? null : null,
    rootUserGoalIds: parseStringArray(value.rootUserGoalIds),
    userGoals: parseUserGoalNodes(value.userGoals),
    completion: parseUserGoalTreeCompletion(value.completion),
  };
}

function parseUserGoalNodes(raw: unknown): UserGoalNode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      const status = value.status;
      if (!id || !assertion || !["identified", "planning", "executing", "completed"].includes(String(status))) return null;
      const executionState = parseUserGoalExecutionState(value.executionState);
      const reviewState = parseUserGoalReviewState(value.reviewState);
      const relationState = parseUserGoalRelationState(value.relationState);
      return {
        id,
        parentId: typeof value.parentId === "string" ? value.parentId.trim() : value.parentId === null ? null : null,
        assertion,
        status: status as UserGoalNode["status"],
        ...(executionState ? { executionState } : {}),
        ...(reviewState ? { reviewState } : {}),
        ...(relationState ? { relationState } : {}),
        source: parseUserGoalSource(value.source),
        xNodeModelId: typeof value.xNodeModelId === "string" ? value.xNodeModelId.trim() : value.xNodeModelId === null ? null : null,
        sinceRound: typeof value.sinceRound === "number" ? value.sinceRound : 0,
        lastTouchedRound: typeof value.lastTouchedRound === "number" ? value.lastTouchedRound : 0,
        completedAtRound: typeof value.completedAtRound === "number" ? value.completedAtRound : undefined,
      } satisfies UserGoalNode;
    })
    .filter((item): item is UserGoalNode => !!item);
}

function parseUserGoalExecutionState(raw: unknown): UserGoalNode["executionState"] | null {
  return ["identified", "planning", "executing", "testing", "pending_acceptance", "completed"].includes(String(raw))
    ? raw as UserGoalNode["executionState"]
    : null;
}

function parseUserGoalReviewState(raw: unknown): UserGoalNode["reviewState"] | null {
  return ["generator_projected", "curator_reviewed", "user_confirmed"].includes(String(raw))
    ? raw as UserGoalNode["reviewState"]
    : null;
}

function parseUserGoalRelationState(raw: unknown): UserGoalNode["relationState"] | null {
  return ["active", "revised", "superseded", "merged", "split", "migrated", "discarded", "reopened"].includes(String(raw))
    ? raw as UserGoalNode["relationState"]
    : null;
}

function parseUserGoalSource(raw: unknown): UserGoalNode["source"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const createdBy = value.createdBy;
  const lastUpdatedBy = value.lastUpdatedBy;
  if (!["generator", "curator", "restore", "migration"].includes(String(createdBy))) return undefined;
  if (!["generator", "curator", "user", "system", "restore", "migration"].includes(String(lastUpdatedBy))) return undefined;
  return {
    createdBy: createdBy as NonNullable<UserGoalNode["source"]>["createdBy"],
    lastUpdatedBy: lastUpdatedBy as NonNullable<UserGoalNode["source"]>["lastUpdatedBy"],
    sourceUserTurnId: typeof value.sourceUserTurnId === "string" ? value.sourceUserTurnId.trim() : undefined,
    sourceAgentRound: typeof value.sourceAgentRound === "number" ? value.sourceAgentRound : undefined,
    evidenceEntryIds: parseStringArray(value.evidenceEntryIds),
  };
}

function parseUserGoalTreeCompletion(raw: unknown): UserGoalTreeDocument["completion"] {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  return {
    treeComplete: Boolean(value.treeComplete),
    completedUserGoalIds: parseStringArray(value.completedUserGoalIds),
    openUserGoalIds: parseStringArray(value.openUserGoalIds),
    nextFocusUserGoalId: typeof value.nextFocusUserGoalId === "string" ? value.nextFocusUserGoalId.trim() : value.nextFocusUserGoalId === null ? null : null,
  };
}

function parseXNodeModels(raw: unknown): XNodeModelDocument[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((item) => parseXNodeModelDocument(item))
    .filter((item): item is XNodeModelDocument => !!item);
}

function parseCuratorReconciliationOps(raw: unknown): CuratorReconciliationOp[] | null {
  if (!Array.isArray(raw)) return null;
  const ops = raw
    .map((item) => parseCuratorReconciliationOp(item))
    .filter((item): item is CuratorReconciliationOp => !!item);
  return ops.length > 0 ? ops : [];
}

function parseCuratorReconciliationOp(raw: unknown): CuratorReconciliationOp | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const action = value.action;
  const targetUserGoalId = typeof value.targetUserGoalId === "string" ? value.targetUserGoalId.trim() : "";

  switch (action) {
    case "mark_reviewed":
      return targetUserGoalId ? { action, targetUserGoalId } : null;
    case "revise_user_goal": {
      const patch = parseUserGoalPatch(value.patch);
      return targetUserGoalId && patch ? { action, targetUserGoalId, patch } : null;
    }
    case "supersede_user_goal": {
      const reason = typeof value.reason === "string" ? value.reason.trim() : "";
      const successorUserGoalId = typeof value.successorUserGoalId === "string" ? value.successorUserGoalId.trim() : undefined;
      return targetUserGoalId && reason ? { action, targetUserGoalId, reason, successorUserGoalId } : null;
    }
    case "discard_user_goal": {
      const reason = typeof value.reason === "string" ? value.reason.trim() : "";
      return targetUserGoalId && reason ? { action, targetUserGoalId, reason } : null;
    }
    case "merge_user_goals": {
      const sourceUserGoalIds = parseStringArray(value.sourceUserGoalIds);
      const mergeTargetUserGoalId = typeof value.targetUserGoalId === "string" ? value.targetUserGoalId.trim() : "";
      return sourceUserGoalIds.length > 0 && mergeTargetUserGoalId ? { action, sourceUserGoalIds, targetUserGoalId: mergeTargetUserGoalId } : null;
    }
    case "split_user_goal": {
      const sourceUserGoalId = typeof value.sourceUserGoalId === "string" ? value.sourceUserGoalId.trim() : "";
      const newGoals = parseSplitNewGoals(value.newGoals);
      return sourceUserGoalId && newGoals.length > 0 ? { action, sourceUserGoalId, newGoals } : null;
    }
    case "advance_execution_state": {
      const executionState = parseUserGoalExecutionState(value.executionState);
      return targetUserGoalId && executionState ? { action, targetUserGoalId, executionState } : null;
    }
    case "update_xnode_model": {
      const xNodeModelOps = parseXNodeModelOps(value.xNodeModelOps, targetUserGoalId);
      return targetUserGoalId && xNodeModelOps.length > 0 ? { action, targetUserGoalId, xNodeModelOps } : null;
    }
    case "adjust_focus":
      return {
        action,
        currentFocusUserGoalId: typeof value.currentFocusUserGoalId === "string" ? value.currentFocusUserGoalId.trim() : value.currentFocusUserGoalId === null ? null : undefined,
        currentFocusXNodeId: typeof value.currentFocusXNodeId === "string" ? value.currentFocusXNodeId.trim() : value.currentFocusXNodeId === null ? null : undefined,
      };
    default:
      return null;
  }
}

function parseUserGoalPatch(raw: unknown): Partial<Pick<UserGoalNode, "assertion" | "executionState" | "relationState" | "reviewState">> | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const assertion = typeof value.assertion === "string" ? value.assertion.trim() : undefined;
  const executionState = parseUserGoalExecutionState(value.executionState) ?? undefined;
  const reviewState = parseUserGoalReviewState(value.reviewState) ?? undefined;
  const relationState = parseUserGoalRelationState(value.relationState) ?? undefined;
  const patch = {
    ...(assertion ? { assertion } : {}),
    ...(executionState ? { executionState } : {}),
    ...(reviewState ? { reviewState } : {}),
    ...(relationState ? { relationState } : {}),
  };
  return Object.keys(patch).length > 0 ? patch : null;
}

function parseSplitNewGoals(raw: unknown): Array<{ id?: string; assertion: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      if (!assertion) return null;
      const id = typeof value.id === "string" ? value.id.trim() : undefined;
      return { ...(id ? { id } : {}), assertion };
    })
    .filter((item): item is { id?: string; assertion: string } => !!item);
}

function parseXNodeModelOps(raw: unknown, targetUserGoalId: string): XNodeModelOp[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => parseXNodeModelOp(item, targetUserGoalId))
    .filter((item): item is XNodeModelOp => !!item);
}

function parseXNodeModelOp(raw: unknown, targetUserGoalId: string): XNodeModelOp | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const action = value.action;
  const userGoalId = typeof value.userGoalId === "string" ? value.userGoalId.trim() : targetUserGoalId;
  if (!userGoalId) return null;

  switch (action) {
    case "patch_xnode_model":
      return {
        action,
        userGoalId,
        currentFocusXNodeId: typeof value.currentFocusXNodeId === "string" ? value.currentFocusXNodeId.trim() : value.currentFocusXNodeId === null ? null : undefined,
      };
    case "add_xnode": {
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      if (!assertion) return null;
      return {
        action,
        userGoalId,
        id: typeof value.id === "string" ? value.id.trim() : undefined,
        parentId: typeof value.parentId === "string" ? value.parentId.trim() : value.parentId === null ? null : undefined,
        assertion,
        atomicity: parseGoalNodeAtomicity(value.atomicity) ?? undefined,
        phase: parseGoalNodePhase(value.phase) ?? undefined,
      };
    }
    case "patch_xnode": {
      const id = typeof value.id === "string" ? value.id.trim() : "";
      if (!id) return null;
      const status = ["active", "suspended", "completed"].includes(String(value.status)) ? value.status as XNode["status"] : undefined;
      return {
        action,
        userGoalId,
        id,
        assertion: typeof value.assertion === "string" ? value.assertion.trim() : undefined,
        atomicity: parseGoalNodeAtomicity(value.atomicity) ?? undefined,
        phase: parseGoalNodePhase(value.phase) ?? undefined,
        status,
        why: value.why !== undefined ? parseXNodeFacet(value.why) : undefined,
        what: value.what !== undefined ? parseXNodeFacet(value.what) : undefined,
        flow: value.flow !== undefined ? parseXNodeFacet(value.flow) : undefined,
        structure: value.structure !== undefined ? parseXNodeFacet(value.structure) : undefined,
        runtimeProof: value.runtimeProof !== undefined ? parseXNodeFacet(value.runtimeProof) : undefined,
      };
    }
    case "complete_xnode": {
      const id = typeof value.id === "string" ? value.id.trim() : "";
      return id ? { action, userGoalId, id } : null;
    }
    case "switch_focus_xnode":
      return {
        action,
        userGoalId,
        id: typeof value.id === "string" ? value.id.trim() : value.id === null ? null : null,
      };
    default:
      return null;
  }
}

function parseXNodeModelDocument(raw: unknown): XNodeModelDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const userGoalId = typeof value.userGoalId === "string" ? value.userGoalId.trim() : "";
  if (value.version !== 1 || !userGoalId) return null;
  const id = typeof value.id === "string" && value.id.trim() ? value.id.trim() : `xnode-${userGoalId}`;
  return {
    version: 1,
    id,
    userGoalId,
    agentRound: typeof value.agentRound === "number" ? value.agentRound : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    currentFocusXNodeId: typeof value.currentFocusXNodeId === "string" ? value.currentFocusXNodeId.trim() : value.currentFocusXNodeId === null ? null : null,
    rootXNodeIds: parseStringArray(value.rootXNodeIds),
    nodes: parseXNodes(value.nodes),
    latestPolicyProjection: parseXNodePolicyProjection(value.latestPolicyProjection),
    latestRuntimeProof: parseRuntimeProofRecord(value.latestRuntimeProof),
    latestProofSignals: parseRuntimeProofSignals(value.latestProofSignals) ?? undefined,
    completion: parseXNodeModelCompletion(value.completion),
  };
}

function parseXNodes(raw: unknown): XNode[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      const status = value.status;
      const atomicity = parseGoalNodeAtomicity(value.atomicity);
      const phase = parseGoalNodePhase(value.phase);
      if (!id || !assertion || !status || !atomicity || !phase || !["active", "suspended", "completed"].includes(String(status))) return null;
      return {
        id,
        parentId: typeof value.parentId === "string" ? value.parentId.trim() : value.parentId === null ? null : null,
        assertion,
        status: status as XNode["status"],
        atomicity,
        phase,
        why: parseXNodeFacet(value.why),
        what: parseXNodeFacet(value.what),
        flow: parseXNodeFacet(value.flow),
        structure: parseXNodeFacet(value.structure),
        runtimeProof: parseXNodeFacet(value.runtimeProof),
        sinceRound: typeof value.sinceRound === "number" ? value.sinceRound : 0,
        lastTouchedRound: typeof value.lastTouchedRound === "number" ? value.lastTouchedRound : 0,
        completedAtRound: typeof value.completedAtRound === "number" ? value.completedAtRound : undefined,
        priority: typeof value.priority === "number" ? value.priority : 0,
        order: typeof value.order === "number" ? value.order : index,
      } satisfies XNode;
    })
    .filter((item): item is XNode => !!item);
}

function parseXNodeFacet(raw: unknown): XNodeFacet {
  if (!raw || typeof raw !== "object") {
    return { summary: "", confidence: "open" };
  }
  const value = raw as Record<string, unknown>;
  const confidence = value.confidence;
  return {
    summary: typeof value.summary === "string" ? value.summary.trim() : "",
    confidence: confidence === "closed" || confidence === "partial" || confidence === "open" ? confidence : "open",
    evidence: parseStringArray(value.evidence),
    method: parseStringArray(value.method),
  };
}

function parseXNodeModelCompletion(raw: unknown): XNodeModelDocument["completion"] {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  return {
    localComplete: Boolean(value.localComplete),
    modelComplete: Boolean(value.modelComplete),
    completedNodeCount: typeof value.completedNodeCount === "number" ? value.completedNodeCount : 0,
    openNodeCount: typeof value.openNodeCount === "number" ? value.openNodeCount : 0,
    nextOpenXNodeId: typeof value.nextOpenXNodeId === "string" ? value.nextOpenXNodeId.trim() : value.nextOpenXNodeId === null ? null : null,
  };
}

function parseXNodePolicyProjection(raw: unknown): XNodePolicyProjection | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const dims = value.dimensions as Record<string, unknown> | undefined;
  const isDim = (v: unknown): v is "closed" | "open" | "partial" => v === "closed" || v === "open" || v === "partial";
  const nextStepType = value.nextStepType;
  const xNodeId = typeof value.xNodeId === "string" ? value.xNodeId.trim() : "";
  if (!xNodeId || !dims || !isDim(dims.why) || !isDim(dims.what) || !isDim(dims.flow) || !isDim(dims.structure) || !isDim(dims.runtimeProof)) {
    return null;
  }
  if (![
    "plan_repair",
    "generate_children",
    "execute_atomic_work",
    "run_tests",
    "seek_acceptance",
    "upward_regression",
  ].includes(String(nextStepType))) {
    return null;
  }
  return {
    xNodeId,
    derivedAtRound: typeof value.derivedAtRound === "number" ? value.derivedAtRound : 0,
    dimensions: {
      why: dims.why,
      what: dims.what,
      flow: dims.flow,
      structure: dims.structure,
      runtimeProof: dims.runtimeProof,
    },
    keyGaps: parseStringArray(value.keyGaps),
    nextStepType: nextStepType as XNodePolicyProjection["nextStepType"],
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    guidance: parseStringArray(value.guidance),
  };
}

function parseGoalNodeAtomicity(raw: unknown): GoalNodeAtomicity | null {
  return raw === "atomic" || raw === "composite" || raw === "undecided" ? raw : null;
}

function parseGoalNodePhase(raw: unknown): GoalNodePhase | null {
  return raw === "plan" || raw === "plan_insufficient" || raw === "execute" || raw === "testing" || raw === "pending_acceptance" || raw === "complete"
    ? raw
    : null;
}

function parseRuntimeProofRecord(raw: unknown): RuntimeProofRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const targetXNodeId = typeof value.targetXNodeId === "string" ? value.targetXNodeId.trim() : "";
  const atRound = typeof value.atRound === "number" ? value.atRound : 0;
  const resultSummary = typeof value.resultSummary === "string" ? value.resultSummary.trim() : "";
  const proofMode = value.proofMode;
  const proofStatus = value.proofStatus;
  if (!targetXNodeId || !resultSummary) return null;
  if (!["tests", "runtime", "human-check", "self-proof", "mixed"].includes(String(proofMode))) return null;
  if (!["passed", "failed", "partial", "missing"].includes(String(proofStatus))) return null;
  return {
    targetXNodeId,
    atRound,
    resultSummary,
    proofMode: proofMode as RuntimeProofRecord["proofMode"],
    proofStatus: proofStatus as RuntimeProofRecord["proofStatus"],
    evidence: parseStringArray(value.evidence),
    verificationMethod: parseStringArray(value.verificationMethod),
  };
}

function parseRuntimeProofSignals(raw: unknown): RuntimeProofSignal[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : `proof-signal-${index + 1}`;
      const targetXNodeId = typeof value.targetXNodeId === "string" ? value.targetXNodeId.trim() : "";
      const atRound = typeof value.atRound === "number" ? value.atRound : 0;
      const type = value.type;
      const message = typeof value.message === "string" ? value.message.trim() : "";
      const suggestedNextStepType = value.suggestedNextStepType;
      if (!targetXNodeId || !message) return null;
      if (!["runtime-proof-failed", "runtime-proof-partial", "runtime-proof-missing", "runtime-proof-conflicted"].includes(String(type))) return null;
      if (suggestedNextStepType !== undefined && !["plan_repair", "generate_children", "execute_atomic_work", "run_tests", "seek_acceptance", "upward_regression"].includes(String(suggestedNextStepType))) {
        return null;
      }
      return {
        id,
        targetXNodeId,
        atRound,
        type: type as RuntimeProofSignal["type"],
        message,
        suggestedNextStepType: suggestedNextStepType as RuntimeProofSignal["suggestedNextStepType"],
        evidence: parseStringArray(value.evidence),
      };
    })
    .filter((item): item is RuntimeProofSignal => !!item);
}

function parseDraftDispositions(raw: unknown): DraftDisposition[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const goalId = typeof value.goalId === "string" ? value.goalId.trim() : "";
      const action = value.action;
      if (!goalId || !["confirm-draft", "revise-draft", "discard-draft"].includes(String(action))) return null;

      const subtreeDisposition = value.subtreeDisposition;
      const normalizedSubtreeDisposition = ["keep-subtree", "reparent-subtree", "merge-into-existing", "discard-subtree", "rewrite-subtree"].includes(String(subtreeDisposition))
        ? subtreeDisposition as DraftDisposition["subtreeDisposition"]
        : undefined;

      const nodeEdits = Array.isArray(value.nodeEdits)
        ? value.nodeEdits
            .map((edit) => {
              if (!edit || typeof edit !== "object") return null;
              const editValue = edit as Record<string, unknown>;
              const editGoalId = typeof editValue.goalId === "string" ? editValue.goalId.trim() : "";
              const editAction = editValue.action;
              if (!editGoalId || !["update", "remove"].includes(String(editAction))) return null;
              const newPhase = editValue.newPhase;
              const newAtomicity = editValue.newAtomicity;
              return {
                goalId: editGoalId,
                action: editAction as "update" | "remove",
                newAssertion: typeof editValue.newAssertion === "string" ? editValue.newAssertion.trim() : undefined,
                newParentId:
                  typeof editValue.newParentId === "string"
                    ? editValue.newParentId.trim()
                    : editValue.newParentId === null
                      ? null
                      : undefined,
                newPhase: ["plan", "plan_insufficient", "execute", "testing", "pending_acceptance", "complete"].includes(String(newPhase))
                  ? newPhase as DraftDisposition["nodeEdits"][number]["newPhase"]
                  : undefined,
                newAtomicity: ["atomic", "composite", "undecided"].includes(String(newAtomicity))
                  ? newAtomicity as DraftDisposition["nodeEdits"][number]["newAtomicity"]
                  : undefined,
                newOrder: typeof editValue.newOrder === "number" ? editValue.newOrder : undefined,
              };
            })
            .filter(Boolean)
        : undefined;

      return {
        goalId,
        action: action as DraftDisposition["action"],
        revisedAssertion: typeof value.revisedAssertion === "string" ? value.revisedAssertion.trim() : undefined,
        revisedParentGoalId:
          typeof value.revisedParentGoalId === "string"
            ? value.revisedParentGoalId.trim()
            : value.revisedParentGoalId === null
              ? null
              : undefined,
        subtreeDisposition: normalizedSubtreeDisposition,
        mergeTargetGoalId: typeof value.mergeTargetGoalId === "string" ? value.mergeTargetGoalId.trim() : undefined,
        nodeEdits: nodeEdits && nodeEdits.length > 0 ? nodeEdits : undefined,
        newCurrentFocusGoalId:
          typeof value.newCurrentFocusGoalId === "string"
            ? value.newCurrentFocusGoalId.trim()
            : value.newCurrentFocusGoalId === null
              ? null
              : undefined,
        evidence: typeof value.evidence === "string" ? value.evidence.trim() : "",
      } satisfies DraftDisposition;
    })
    .filter((item): item is DraftDisposition => !!item);
}

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function parseCuratorAuditAdvice(raw: unknown): CuratorAuditAdvice | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const advice: CuratorAuditAdvice = {
    advisoryOnly: true,
    parentAlignmentWarning: typeof value.parentAlignmentWarning === "string" ? value.parentAlignmentWarning.trim() : null,
    possibleGoalMisclassification: typeof value.possibleGoalMisclassification === "string" ? value.possibleGoalMisclassification.trim() : null,
    suggestedRecovery: typeof value.suggestedRecovery === "string" ? value.suggestedRecovery.trim() : null,
  };
  if (!advice.parentAlignmentWarning && !advice.possibleGoalMisclassification && !advice.suggestedRecovery) return null;
  return advice;
}

function parseFilesChanged(raw: unknown): SummaryEntry["summary"]["filesChanged"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const path = typeof value.path === "string" ? value.path.trim() : "";
      const action = typeof value.action === "string" ? value.action : "";
      if (!path || !["read", "edit", "write", "bash"].includes(action)) return null;
      return { path, action: action as SummaryEntry["summary"]["filesChanged"][number]["action"] };
    })
    .filter((item): item is SummaryEntry["summary"]["filesChanged"][number] => !!item);
}

function parseGoalStateActiveItems(raw: unknown): GoalStateDocument["active"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      const status = value.status === "suspended" ? "suspended" : value.status === "active" ? "active" : null;
      const sinceRound = typeof value.sinceRound === "number" ? value.sinceRound : 0;
      const lastConfirmedRound = typeof value.lastConfirmedRound === "number" ? value.lastConfirmedRound : sinceRound;
      const signal = value.signal === "inferred" ? "inferred" : value.signal === "explicit" ? "explicit" : null;
      if (!id || !assertion || !status || !signal) return null;
      return { id, assertion, status, sinceRound, lastConfirmedRound, signal };
    })
    .filter((item): item is GoalStateDocument["active"][number] => !!item);
}

function parseGoalStateCompletedItems(raw: unknown): GoalStateDocument["completed"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      const completedAtRound = typeof value.completedAtRound === "number" ? value.completedAtRound : 0;
      if (!id || !assertion) return null;
      return { id, assertion, completedAtRound };
    })
    .filter((item): item is GoalStateDocument["completed"][number] => !!item);
}

function parseGoalStateMigrations(raw: unknown): GoalStateDocument["migrations"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const from = typeof value.from === "string" ? value.from.trim() : "";
      const to = typeof value.to === "string" ? value.to.trim() : "";
      const atRound = typeof value.atRound === "number" ? value.atRound : 0;
      const reason = typeof value.reason === "string" ? value.reason.trim() : "";
      if (!from || !to || !reason) return null;
      return { from, to, atRound, reason };
    })
    .filter((item): item is GoalStateDocument["migrations"][number] => !!item);
}

function stripTrailingStructuredTail(text: string): string {
  if (/\n?```json\s*[\s\S]*?```\s*$/.test(text)) {
    return text.replace(/\n?```json\s*[\s\S]*?```\s*$/, "").trim();
  }

  return text.replace(/\n?```json\s*[\s\S]*$/, "").trim();
}

function extractSection(text: string, title: string): string {
  const pattern = new RegExp(`## ${escapeRegExp(title)}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractListSection(text: string, title: string): string[] {
  const section = extractSection(text, title);
  if (!section) return [];

  return section
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
