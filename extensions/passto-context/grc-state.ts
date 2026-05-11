/**
 * PasstoContext runtime state machine
 * Minimal state management for the Generator-Reflector-Curator lifecycle.
 *
 * The current top-level operator control surface is `runtimeMode = on | off`.
 * Legacy `manualMode` values are only read during restore and mapped into `runtimeMode`.
 */

import type { GRCState, GoalStateDocument, GoalStateSignal, ReflectorDiagnosis, RuntimeMode, SubagentStatus, SummaryEntry } from "./types.ts";
import { normalizeReflectorDiagnosis } from "./grc-reflector-diagnosis.ts";

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
      lastSignal: null,
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
  goalState?: GoalStateDocument | null,
  summaryCache?: SummaryEntry[],
  signal?: GoalStateSignal | null,
  processedUpToAgentRound?: number,
  lastCuratedAgentRound?: number,
): GRCState {
  return {
    ...state,
    curator: {
      status,
      lastSummary: summary !== undefined ? summary : state.curator.lastSummary,
      lastSummaryEntry: summaryEntry !== undefined ? summaryEntry : state.curator.lastSummaryEntry,
      lastGoalState: goalState !== undefined ? goalState : state.curator.lastGoalState,
      lastSignal: signal !== undefined ? signal : state.curator.lastSignal,
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
          ? obj.curator.lastGoalState as GoalStateDocument
          : initial.curator.lastGoalState,
      lastSignal:
        obj.curator?.lastSignal && typeof obj.curator.lastSignal === "object"
          ? obj.curator.lastSignal as GoalStateSignal
          : initial.curator.lastSignal,
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
