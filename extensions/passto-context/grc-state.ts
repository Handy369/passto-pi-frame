/**
 * PasstoContext GRC State Machine
 * Minimal state management for Generator-Reflector-Curator lifecycle
 */

import type { GRCConfig, GRCState, GRCManualMode, SubagentStatus } from "./types.js";

export function createInitialGRCState(): GRCState {
  return {
    mode: "normal",
    manualMode: "auto",
    turnCount: 0,
    grcCycleCount: 0,
    reflector: {
      status: "idle",
      lastAdvice: null,
      processedUpToTurn: 0,
    },
    curator: {
      status: "idle",
      lastSummary: null,
      processedUpToTurn: 0,
      principlesExtracted: 0,
    },
    activatedAtTurn: null,
    lastGrcTriggerTurn: 0,
  };
}

export function incrementTurn(state: GRCState): GRCState {
  return {
    ...state,
    turnCount: state.turnCount + 1,
  };
}

export function shouldTriggerGRC(state: GRCState, config: GRCConfig): boolean {
  if (state.manualMode === "forced-off") return false;
  if (state.manualMode === "forced-on") return state.mode !== "grc";
  if (!config.enabled) return false;
  if (state.mode === "grc") return false;
  return state.turnCount >= config.grcTurnThreshold;
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
): GRCState {
  return {
    ...state,
    reflector: {
      status,
      lastAdvice: advice !== undefined ? advice : state.reflector.lastAdvice,
      processedUpToTurn: processedUpToTurn ?? state.reflector.processedUpToTurn,
    },
  };
}

export function updateCuratorStatus(
  state: GRCState,
  status: SubagentStatus,
  summary?: string | null,
  processedUpToTurn?: number,
  principlesExtracted?: number,
): GRCState {
  return {
    ...state,
    curator: {
      status,
      lastSummary: summary !== undefined ? summary : state.curator.lastSummary,
      processedUpToTurn: processedUpToTurn ?? state.curator.processedUpToTurn,
      principlesExtracted: principlesExtracted ?? state.curator.principlesExtracted,
    },
  };
}

export function shouldTriggerNextCycle(state: GRCState, config: GRCConfig): boolean {
  if (state.manualMode === "forced-off") return false;
  if (state.manualMode !== "forced-on" && !config.enabled) return false;
  if (state.mode !== "grc") return false;
  if (state.reflector.status === "running" || state.curator.status === "running") return false;
  return state.turnCount - state.lastGrcTriggerTurn >= config.grcCooldownTurns;
}

export function markGRCTriggered(state: GRCState, currentTurn: number): GRCState {
  return {
    ...state,
    grcCycleCount: state.grcCycleCount + 1,
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

export function setGRCManualMode(state: GRCState, manualMode: GRCManualMode): GRCState {
  if (manualMode === "forced-off") {
    return {
      ...clearRunningSubagentStatuses(state),
      manualMode,
      mode: "normal",
    };
  }

  return {
    ...state,
    manualMode,
  };
}

export function forceActivateGRC(state: GRCState): GRCState {
  const withManualMode = setGRCManualMode(state, "forced-on");
  if (withManualMode.mode === "grc") {
    return withManualMode;
  }
  return transitionToGRC(withManualMode, withManualMode.turnCount);
}

export function serializeGRCState(state: GRCState): GRCState {
  return JSON.parse(JSON.stringify(state)) as GRCState;
}

export function restoreGRCState(data: unknown): GRCState {
  const initial = createInitialGRCState();
  if (!data || typeof data !== "object") return initial;

  const obj = data as Partial<GRCState>;
  return clearRunningSubagentStatuses({
    mode: obj.mode === "grc" ? "grc" : "normal",
    manualMode: isManualMode(obj.manualMode) ? obj.manualMode : initial.manualMode,
    turnCount: typeof obj.turnCount === "number" ? obj.turnCount : initial.turnCount,
    grcCycleCount: typeof obj.grcCycleCount === "number" ? obj.grcCycleCount : initial.grcCycleCount,
    reflector: {
      status: isSubagentStatus(obj.reflector?.status) ? obj.reflector!.status : initial.reflector.status,
      lastAdvice: typeof obj.reflector?.lastAdvice === "string" || obj.reflector?.lastAdvice === null
        ? (obj.reflector?.lastAdvice ?? null)
        : initial.reflector.lastAdvice,
      processedUpToTurn:
        typeof obj.reflector?.processedUpToTurn === "number"
          ? obj.reflector.processedUpToTurn
          : initial.reflector.processedUpToTurn,
    },
    curator: {
      status: isSubagentStatus(obj.curator?.status) ? obj.curator!.status : initial.curator.status,
      lastSummary: typeof obj.curator?.lastSummary === "string" || obj.curator?.lastSummary === null
        ? (obj.curator?.lastSummary ?? null)
        : initial.curator.lastSummary,
      processedUpToTurn:
        typeof obj.curator?.processedUpToTurn === "number"
          ? obj.curator.processedUpToTurn
          : initial.curator.processedUpToTurn,
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

function isManualMode(value: unknown): value is GRCManualMode {
  return value === "auto" || value === "forced-on" || value === "forced-off";
}
