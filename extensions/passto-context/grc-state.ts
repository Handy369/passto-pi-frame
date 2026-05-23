/**
 * PasstoContext runtime state machine
 * Minimal state management for the Generator-Reflector-Curator lifecycle.
 *
 * The current top-level operator control surface is `runtimeMode = on | off`.
 * Legacy `manualMode` values are only read during restore and mapped into `runtimeMode`.
 */

import type { CertaintyAssessment, GRCState, GoalStateAny, GoalStateSignal, GoalTransitionSummary, ReflectorDiagnosis, RuntimeDraftGoalState, RuntimeMode, RuntimeProvisionalOverlay, RuntimeProofRecord, RuntimeProofSignal, SubagentStatus, SummaryEntry, UserGoalTreeDocument, XNodeModelDocument, XNodePolicyProjection } from "./types.ts";
import { getCurrentPolicyProjectionFromSidecars } from "./grc-policy-surface.ts";
import { enrichXNodeModels, selectCurrentXNodeModel } from "./grc-x-node-model.ts";
import { normalizeReflectorDiagnosis } from "./grc-reflector-diagnosis.ts";
import { applyCompletionClosure } from "./grc-completion-closure.ts";
import { getEffectiveObjectStateFromGRCState } from "./grc-provisional-overlay.ts";

export function createInitialGRCState(): GRCState {
  return {
    mode: "normal",
    runtimeMode: "on",
    turnCount: 0,
    totalAgentRounds: 0,
    currentAgentRound: 0,
    currentTurnRound: 0,
    grcCycleCount: 0,
    reflector: {
      status: "idle",
      lastAdvice: null,
      lastDiagnosis: null,
      processedUpToTurn: 0,
      processedUpToAgentRound: 0,
      lastReflectedAgentRound: 0,
    },
    curator: {
      status: "idle",
      lastSummary: null,
      lastSummaryEntry: null,
      lastGoalState: null,
      lastUserGoalTree: null,
      lastXNodeModels: [],
      runtimeDraftGoalState: null,
      runtimeProvisionalOverlay: null,
      lastSignal: null,
      lastCertaintyAssessment: null,
      lastPolicyProjection: null,
      latestRuntimeProof: null,
      latestProofSignals: null,
      latestGoalTransition: null,
      summaryCache: [],
      processedUpToTurn: 0,
      processedUpToAgentRound: 0,
      lastCuratedAgentRound: 0,
      principlesExtracted: 0,
    },
    activatedAtTurn: null,
    lastGrcTriggerTurn: 0,
  };
}

export function startAgentRound(state: GRCState): GRCState {
  return {
    ...state,
    currentAgentRound: state.totalAgentRounds + 1,
    currentTurnRound: 0,
  };
}

export function incrementTurnRound(state: GRCState): GRCState {
  return {
    ...state,
    currentTurnRound: state.currentTurnRound + 1,
  };
}

export function finishAgentRound(state: GRCState): GRCState {
  const totalAgentRounds = state.totalAgentRounds + 1;
  return {
    ...state,
    turnCount: totalAgentRounds,
    totalAgentRounds,
    currentTurnRound: 0,
  };
}

export function transitionToGRC(state: GRCState, currentTurn: number): GRCState {
  return {
    ...state,
    mode: "grc",
    grcCycleCount: state.grcCycleCount + 1,
    activatedAtTurn: currentTurn,
    lastGrcTriggerTurn: currentTurn,
    reflector: {
      ...state.reflector,
      status: "idle",
    },
    curator: {
      ...state.curator,
      status: "idle",
    },
  };
}

export function updateReflectorStatus(
  state: GRCState,
  status: SubagentStatus,
  advice?: string | null,
  processedUpToTurn?: number,
  processedUpToAgentRound?: number,
  lastReflectedAgentRound?: number,
  diagnosis?: ReflectorDiagnosis | null,
): GRCState {
  return {
    ...state,
    reflector: {
      status,
      lastAdvice: advice !== undefined ? advice : state.reflector.lastAdvice,
      lastDiagnosis: diagnosis !== undefined ? diagnosis : state.reflector.lastDiagnosis,
      processedUpToTurn: processedUpToTurn ?? state.reflector.processedUpToTurn,
      processedUpToAgentRound: processedUpToAgentRound ?? state.reflector.processedUpToAgentRound,
      lastReflectedAgentRound: lastReflectedAgentRound ?? state.reflector.lastReflectedAgentRound,
    },
  };
}

export function updateCuratorStatus(
  state: GRCState,
  status: SubagentStatus,
  summary?: string | null,
  processedUpToTurn?: number,
  principlesExtracted?: number,
  summaryEntry?: SummaryEntry | null,
  goalState?: GoalStateAny | null,
  runtimeDraftGoalStateOrSummaryCache?: RuntimeDraftGoalState | null | SummaryEntry[],
  summaryCacheOrSignal?: SummaryEntry[] | GoalStateSignal | null,
  signalOrCertaintyAssessment?: GoalStateSignal | CertaintyAssessment | null,
  certaintyAssessmentOrProcessedUpToAgentRound?: CertaintyAssessment | number | null,
  processedUpToAgentRoundOrLastCuratedAgentRound?: number,
  lastCuratedAgentRoundOrLatestGoalTransition?: number | GoalTransitionSummary | null,
  latestGoalTransitionArg?: GoalTransitionSummary | null,
): GRCState {
  const runtimeDraftGoalState = Array.isArray(runtimeDraftGoalStateOrSummaryCache)
    ? undefined
    : runtimeDraftGoalStateOrSummaryCache;
  const summaryCache = Array.isArray(runtimeDraftGoalStateOrSummaryCache)
    ? runtimeDraftGoalStateOrSummaryCache
    : (Array.isArray(summaryCacheOrSignal) ? summaryCacheOrSignal : undefined);
  const signal = !Array.isArray(summaryCacheOrSignal) && summaryCacheOrSignal && typeof summaryCacheOrSignal === 'object' && 'type' in summaryCacheOrSignal
    ? summaryCacheOrSignal as GoalStateSignal | null
    : (signalOrCertaintyAssessment && typeof signalOrCertaintyAssessment === 'object' && 'type' in signalOrCertaintyAssessment
      ? signalOrCertaintyAssessment as GoalStateSignal | null
      : undefined);
  const certaintyAssessment = signalOrCertaintyAssessment && typeof signalOrCertaintyAssessment === 'object' && 'dimensions' in signalOrCertaintyAssessment
    ? signalOrCertaintyAssessment as CertaintyAssessment | null
    : (certaintyAssessmentOrProcessedUpToAgentRound && typeof certaintyAssessmentOrProcessedUpToAgentRound === 'object' && 'dimensions' in certaintyAssessmentOrProcessedUpToAgentRound
      ? certaintyAssessmentOrProcessedUpToAgentRound as CertaintyAssessment | null
      : undefined);
  const processedUpToAgentRound = typeof certaintyAssessmentOrProcessedUpToAgentRound === 'number'
    ? certaintyAssessmentOrProcessedUpToAgentRound
    : processedUpToAgentRoundOrLastCuratedAgentRound;
  const lastCuratedAgentRound = typeof lastCuratedAgentRoundOrLatestGoalTransition === 'number'
    ? lastCuratedAgentRoundOrLatestGoalTransition
    : undefined;
  const latestGoalTransition = typeof lastCuratedAgentRoundOrLatestGoalTransition === 'object' && lastCuratedAgentRoundOrLatestGoalTransition !== null && 'label' in lastCuratedAgentRoundOrLatestGoalTransition
    ? lastCuratedAgentRoundOrLatestGoalTransition as GoalTransitionSummary | null
    : latestGoalTransitionArg;

  return {
    ...state,
    curator: {
      status,
      lastSummary: summary !== undefined ? summary : state.curator.lastSummary,
      lastSummaryEntry: summaryEntry !== undefined ? summaryEntry : state.curator.lastSummaryEntry,
      lastGoalState: goalState !== undefined ? goalState : state.curator.lastGoalState,
      lastUserGoalTree: state.curator.lastUserGoalTree ?? null,
      lastXNodeModels: state.curator.lastXNodeModels ?? [],
      runtimeDraftGoalState: runtimeDraftGoalState !== undefined ? runtimeDraftGoalState : (state.curator.runtimeDraftGoalState ?? null),
      runtimeProvisionalOverlay: state.curator.runtimeProvisionalOverlay ?? null,
      lastSignal: signal !== undefined ? signal : state.curator.lastSignal,
      lastCertaintyAssessment: certaintyAssessment !== undefined ? certaintyAssessment : state.curator.lastCertaintyAssessment,
      lastPolicyProjection: state.curator.lastPolicyProjection ?? null,
      latestRuntimeProof: state.curator.latestRuntimeProof ?? null,
      latestProofSignals: state.curator.latestProofSignals ?? null,
      latestGoalTransition: latestGoalTransition !== undefined ? latestGoalTransition : state.curator.latestGoalTransition,
      summaryCache: summaryCache ?? state.curator.summaryCache,
      processedUpToTurn: processedUpToTurn ?? state.curator.processedUpToTurn,
      processedUpToAgentRound: processedUpToAgentRound ?? state.curator.processedUpToAgentRound,
      lastCuratedAgentRound: lastCuratedAgentRound ?? state.curator.lastCuratedAgentRound,
      principlesExtracted: principlesExtracted ?? state.curator.principlesExtracted,
    },
  };
}

export function pushSummaryCacheEntry(
  state: GRCState,
  entry: SummaryEntry,
  maxSize: number,
): { state: GRCState; evicted: SummaryEntry | null } {
  const deduped = state.curator.summaryCache.filter((item) => item.agentRound !== entry.agentRound);
  const combined = [...deduped, entry];
  const safeMax = Math.max(1, maxSize);
  const evictedCount = Math.max(0, combined.length - safeMax);
  const evicted = evictedCount > 0 ? combined[0] ?? null : null;
  const next = combined.slice(-safeMax);
  return {
    state: {
      ...state,
      curator: {
        ...state.curator,
        summaryCache: next,
      },
    },
    evicted,
  };
}

export function clearRunningSubagentStatuses(state: GRCState): GRCState {
  return {
    ...state,
    reflector: {
      ...state.reflector,
      status: state.reflector.status === "running" ? "idle" : state.reflector.status,
    },
    curator: {
      ...state.curator,
      status: state.curator.status === "running" ? "idle" : state.curator.status,
    },
  };
}

export function setRuntimeMode(state: GRCState, runtimeMode: RuntimeMode): GRCState {
  if (runtimeMode === "off") {
    return {
      ...clearRunningSubagentStatuses(state),
      runtimeMode,
      mode: "normal",
    };
  }

  return {
    ...state,
    runtimeMode,
  };
}

export function serializeGRCState(state: GRCState): GRCState {
  return JSON.parse(JSON.stringify(state)) as GRCState;
}

export function restoreGRCState(data: unknown): GRCState {
  const initial = createInitialGRCState();
  if (!data || typeof data !== "object") return initial;

  const obj = data as Partial<GRCState> & { manualMode?: unknown };
  const runtimeMode = isRuntimeMode(obj.runtimeMode)
    ? obj.runtimeMode
    : mapLegacyManualModeToRuntimeMode(obj.manualMode);

  return clearRunningSubagentStatuses({
    mode: obj.mode === "grc" ? "grc" : "normal",
    runtimeMode,
    turnCount: typeof obj.turnCount === "number" ? obj.turnCount : initial.turnCount,
    totalAgentRounds:
      typeof obj.totalAgentRounds === "number"
        ? obj.totalAgentRounds
        : (typeof obj.turnCount === "number" ? obj.turnCount : initial.totalAgentRounds),
    currentAgentRound:
      typeof obj.currentAgentRound === "number" ? obj.currentAgentRound : initial.currentAgentRound,
    currentTurnRound:
      typeof obj.currentTurnRound === "number" ? obj.currentTurnRound : initial.currentTurnRound,
    grcCycleCount: typeof obj.grcCycleCount === "number" ? obj.grcCycleCount : initial.grcCycleCount,
    reflector: {
      status: isSubagentStatus(obj.reflector?.status) ? obj.reflector!.status : initial.reflector.status,
      lastAdvice: typeof obj.reflector?.lastAdvice === "string" || obj.reflector?.lastAdvice === null
        ? (obj.reflector?.lastAdvice ?? null)
        : initial.reflector.lastAdvice,
      lastDiagnosis:
        obj.reflector?.lastDiagnosis === null
          ? null
          : normalizeReflectorDiagnosis(obj.reflector?.lastDiagnosis) ?? initial.reflector.lastDiagnosis,
      processedUpToTurn:
        typeof obj.reflector?.processedUpToTurn === "number"
          ? obj.reflector.processedUpToTurn
          : initial.reflector.processedUpToTurn,
      processedUpToAgentRound:
        typeof obj.reflector?.processedUpToAgentRound === "number"
          ? obj.reflector.processedUpToAgentRound
          : initial.reflector.processedUpToAgentRound,
      lastReflectedAgentRound:
        typeof obj.reflector?.lastReflectedAgentRound === "number"
          ? obj.reflector.lastReflectedAgentRound
          : initial.reflector.lastReflectedAgentRound,
    },
    curator: {
      status: isSubagentStatus(obj.curator?.status) ? obj.curator!.status : initial.curator.status,
      lastSummary: typeof obj.curator?.lastSummary === "string" || obj.curator?.lastSummary === null
        ? (obj.curator?.lastSummary ?? null)
        : initial.curator.lastSummary,
      lastSummaryEntry:
        obj.curator?.lastSummaryEntry && typeof obj.curator.lastSummaryEntry === "object"
          ? obj.curator.lastSummaryEntry as SummaryEntry
          : initial.curator.lastSummaryEntry,
      lastGoalState:
        obj.curator?.lastGoalState && typeof obj.curator.lastGoalState === "object"
          ? obj.curator.lastGoalState as GoalStateAny
          : initial.curator.lastGoalState,
      lastUserGoalTree:
        obj.curator?.lastUserGoalTree && typeof obj.curator.lastUserGoalTree === "object"
          ? obj.curator.lastUserGoalTree as UserGoalTreeDocument
          : initial.curator.lastUserGoalTree,
      lastXNodeModels:
        Array.isArray(obj.curator?.lastXNodeModels)
          ? obj.curator.lastXNodeModels.filter((item): item is XNodeModelDocument => !!item && typeof item === "object")
          : initial.curator.lastXNodeModels,
      runtimeDraftGoalState: restoreRuntimeDraftGoalState(obj.curator?.runtimeDraftGoalState) ?? initial.curator.runtimeDraftGoalState,
      runtimeProvisionalOverlay: restoreRuntimeProvisionalOverlay(obj.curator?.runtimeProvisionalOverlay) ?? initial.curator.runtimeProvisionalOverlay,
      lastSignal:
        obj.curator?.lastSignal && typeof obj.curator.lastSignal === "object"
          ? obj.curator.lastSignal as GoalStateSignal
          : initial.curator.lastSignal,
      lastCertaintyAssessment:
        obj.curator?.lastCertaintyAssessment && typeof obj.curator.lastCertaintyAssessment === "object"
          ? obj.curator.lastCertaintyAssessment as CertaintyAssessment
          : initial.curator.lastCertaintyAssessment,
      lastPolicyProjection:
        obj.curator?.lastPolicyProjection && typeof obj.curator.lastPolicyProjection === "object"
          ? obj.curator.lastPolicyProjection as XNodePolicyProjection
          : deriveStoredPolicyProjection(
              obj.curator?.lastUserGoalTree && typeof obj.curator.lastUserGoalTree === "object"
                ? obj.curator.lastUserGoalTree as UserGoalTreeDocument
                : initial.curator.lastUserGoalTree ?? null,
              Array.isArray(obj.curator?.lastXNodeModels)
                ? obj.curator.lastXNodeModels.filter((item): item is XNodeModelDocument => !!item && typeof item === "object")
                : initial.curator.lastXNodeModels ?? [],
            ),
      latestRuntimeProof:
        obj.curator?.latestRuntimeProof && typeof obj.curator.latestRuntimeProof === "object"
          ? obj.curator.latestRuntimeProof as RuntimeProofRecord
          : initial.curator.latestRuntimeProof,
      latestProofSignals:
        Array.isArray(obj.curator?.latestProofSignals)
          ? obj.curator.latestProofSignals.filter((item): item is RuntimeProofSignal => !!item && typeof item === "object")
          : initial.curator.latestProofSignals,
      latestGoalTransition:
        obj.curator?.latestGoalTransition && typeof obj.curator.latestGoalTransition === "object"
          ? obj.curator.latestGoalTransition as GoalTransitionSummary
          : initial.curator.latestGoalTransition,
      summaryCache:
        Array.isArray(obj.curator?.summaryCache)
          ? obj.curator.summaryCache.filter((item): item is SummaryEntry => !!item && typeof item === "object")
          : initial.curator.summaryCache,
      processedUpToTurn:
        typeof obj.curator?.processedUpToTurn === "number"
          ? obj.curator.processedUpToTurn
          : initial.curator.processedUpToTurn,
      processedUpToAgentRound:
        typeof obj.curator?.processedUpToAgentRound === "number"
          ? obj.curator.processedUpToAgentRound
          : initial.curator.processedUpToAgentRound,
      lastCuratedAgentRound:
        typeof obj.curator?.lastCuratedAgentRound === "number"
          ? obj.curator.lastCuratedAgentRound
          : initial.curator.lastCuratedAgentRound,
      principlesExtracted:
        typeof obj.curator?.principlesExtracted === "number"
          ? obj.curator.principlesExtracted
          : initial.curator.principlesExtracted,
    },
    activatedAtTurn:
      typeof obj.activatedAtTurn === "number" || obj.activatedAtTurn === null
        ? (obj.activatedAtTurn ?? null)
        : initial.activatedAtTurn,
    lastGrcTriggerTurn:
      typeof obj.lastGrcTriggerTurn === "number" ? obj.lastGrcTriggerTurn : initial.lastGrcTriggerTurn,
  });
}

function restoreRuntimeDraftGoalState(raw: unknown): RuntimeDraftGoalState | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const goalState = value.goalState;
  if (!goalState || typeof goalState !== "object" || (goalState as { version?: unknown }).version !== 2) {
    return null;
  }

  return {
    baseGoalStateRound: typeof value.baseGoalStateRound === "number" ? value.baseGoalStateRound : null,
    sourceAgentRound: typeof value.sourceAgentRound === "number" ? value.sourceAgentRound : 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    goalState: goalState as RuntimeDraftGoalState["goalState"],
    source: value.source === "generator" ? "generator" : "generator",
  };
}

function restoreRuntimeProvisionalOverlay(raw: unknown): RuntimeProvisionalOverlay | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const userGoalState = value.userGoalState;
  const xNodeState = value.xNodeState;
  const normalizedUserGoalState = userGoalState && typeof userGoalState === "object"
    ? normalizeRuntimeProvisionalUserGoalState(userGoalState as Record<string, unknown>)
    : null;
  const normalizedXNodeState = xNodeState && typeof xNodeState === "object"
    ? normalizeRuntimeProvisionalXNodeState(xNodeState as Record<string, unknown>)
    : null;
  if (!normalizedUserGoalState && !normalizedXNodeState) return null;
  return {
    sourceAgentRound: typeof value.sourceAgentRound === "number" ? value.sourceAgentRound : 0,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    source: value.source === "generator" ? "generator" : "generator",
    userGoalState: normalizedUserGoalState,
    xNodeState: normalizedXNodeState,
  };
}

function normalizeRuntimeProvisionalUserGoalState(raw: Record<string, unknown>): RuntimeProvisionalOverlay["userGoalState"] {
  const userGoalTree = raw.userGoalTree;
  if (!userGoalTree || typeof userGoalTree !== "object" || (userGoalTree as { version?: unknown }).version !== 1) return null;
  return {
    baseUserGoalTreeRound: typeof raw.baseUserGoalTreeRound === "number" ? raw.baseUserGoalTreeRound : null,
    sourceAgentRound: typeof raw.sourceAgentRound === "number" ? raw.sourceAgentRound : 0,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    userGoalTree: userGoalTree as UserGoalTreeDocument,
    source: raw.source === "generator" ? "generator" : "generator",
  };
}

function normalizeRuntimeProvisionalXNodeState(raw: Record<string, unknown>): RuntimeProvisionalOverlay["xNodeState"] {
  const xNodeModel = raw.xNodeModel;
  if (!xNodeModel || typeof xNodeModel !== "object" || (xNodeModel as { version?: unknown }).version !== 1) return null;
  return {
    baseXNodeModelRound: typeof raw.baseXNodeModelRound === "number" ? raw.baseXNodeModelRound : null,
    sourceAgentRound: typeof raw.sourceAgentRound === "number" ? raw.sourceAgentRound : 0,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
    xNodeModel: xNodeModel as XNodeModelDocument,
    source: raw.source === "generator" ? "generator" : "generator",
  };
}

export function setRuntimeDraftGoalState(state: GRCState, runtimeDraftGoalState: RuntimeDraftGoalState | null): GRCState {
  return {
    ...state,
    curator: {
      ...state.curator,
      runtimeDraftGoalState,
    },
  };
}

export function setRuntimeProvisionalOverlay(state: GRCState, runtimeProvisionalOverlay: RuntimeProvisionalOverlay | null): GRCState {
  return {
    ...state,
    curator: {
      ...state.curator,
      runtimeProvisionalOverlay,
    },
  };
}

export function clearRuntimeDraftGoalState(state: GRCState): GRCState {
  return setRuntimeDraftGoalState(state, null);
}

export function clearRuntimeProvisionalOverlay(state: GRCState): GRCState {
  return setRuntimeProvisionalOverlay(state, null);
}

export function setCuratorObjectSidecars(
  state: GRCState,
  payload: {
    userGoalTree?: UserGoalTreeDocument | null;
    xNodeModels?: XNodeModelDocument[];
    lastPolicyProjection?: XNodePolicyProjection | null;
    latestRuntimeProof?: RuntimeProofRecord | null;
    latestProofSignals?: RuntimeProofSignal[] | null;
  },
): GRCState {
  const rawUserGoalTree = payload.userGoalTree !== undefined ? payload.userGoalTree : (state.curator.lastUserGoalTree ?? null);
  const rawXNodeModels = payload.xNodeModels !== undefined
    ? enrichXNodeModels(payload.xNodeModels)
    : enrichXNodeModels(state.curator.lastXNodeModels ?? []);
  const { userGoalTree: lastUserGoalTree, xNodeModels: lastXNodeModels } = applyCompletionClosure(rawUserGoalTree, rawXNodeModels);
  const currentFocusModel = selectCurrentXNodeModel(lastUserGoalTree, lastXNodeModels);
  return {
    ...state,
    curator: {
      ...state.curator,
      lastUserGoalTree,
      lastXNodeModels,
      lastPolicyProjection: payload.lastPolicyProjection !== undefined
        ? payload.lastPolicyProjection
        : deriveStoredPolicyProjection(lastUserGoalTree, lastXNodeModels),
      latestRuntimeProof: payload.latestRuntimeProof !== undefined
        ? payload.latestRuntimeProof
        : currentFocusModel?.latestRuntimeProof ?? state.curator.latestRuntimeProof ?? null,
      latestProofSignals: payload.latestProofSignals !== undefined
        ? payload.latestProofSignals
        : currentFocusModel?.latestProofSignals ?? state.curator.latestProofSignals ?? null,
    },
  };
}

export function getEffectiveGoalState(state: GRCState | null): GoalStateAny | null {
  if (!state) return null;
  return state.curator.runtimeDraftGoalState?.goalState ?? state.curator.lastGoalState ?? null;
}

export function getEffectiveObjectState(state: GRCState | null): {
  userGoalTree: UserGoalTreeDocument | null;
  xNodeModels: XNodeModelDocument[];
} {
  return getEffectiveObjectStateFromGRCState(state);
}

function deriveStoredPolicyProjection(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
): XNodePolicyProjection | null {
  return getCurrentPolicyProjectionFromSidecars(userGoalTree, xNodeModels);
}

function isSubagentStatus(value: unknown): value is SubagentStatus {
  return value === "idle" || value === "running" || value === "done" || value === "failed";
}

function isRuntimeMode(value: unknown): value is RuntimeMode {
  return value === "on" || value === "off";
}

function mapLegacyManualModeToRuntimeMode(value: unknown): RuntimeMode {
  if (value === "forced-off") return "off";
  if (value === "auto" || value === "forced-on") return "on";
  return "on";
}
