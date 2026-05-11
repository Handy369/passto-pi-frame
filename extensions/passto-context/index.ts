/**
 * PasstoContext - Smart Context Management for Pi CLI
 *
 * A Pi extension that provides:
 * - Smart Compaction: AI-powered structured session summaries
 * - Memory Injection: Automatic relevant context before each prompt
 * - Context Tracking: Real-time session state monitoring
 *
 * Usage:
 *   Legacy install path: ~/.pi/agent/extensions/passto-context/index.ts
 *   Pi auto-discovers and loads it.
 */

import * as fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ensureConfigExists, getConfigFilePath } from "./config.js";
import { createCompactionHandler } from "./compaction.js";
import { createMemoryManager } from "./memory.js";
import { createContextTracker } from "./context-tracker.js";
import { createLogger, estimateTokens, expandHome, formatCompactK, getSessionDisplayName } from "./utils.js";
import {
  clearRunningSubagentStatuses,
  createInitialGRCState,
  finishAgentRound,
  incrementTurnRound,
  pushSummaryCacheEntry,
  restoreGRCState,
  serializeGRCState,
  setRuntimeMode,
  startAgentRound,
  updateCuratorStatus,
  updateReflectorStatus,
} from "./grc-state.js";
import { buildBaseGRCPrompt, buildGoalStateInjection, buildReflectorInjection, buildSummaryCacheInjection } from "./grc-prompts.js";
import { buildReflectorGoalContext } from "./grc-goal-context.js";
import { executeCurator, executeReflector, serializeConversation } from "./grc-subagent.js";
import { createPrinciplesManager, formatPrinciplesForInjection } from "./grc-principles.js";
import { parseCuratorArtifactEntry, restoreCuratorStateFromBranchEntries } from "./grc-restore.ts";
import { getCuratorGoalStateRejectionReasons, reconcileCuratorGoalState } from "./grc-curator-guard.ts";
import { formatPTCStatus } from "./ptc-status.ts";
import { appendWidgetNotice, getVisibleWidgetNotice, type WidgetNoticeState } from "./widget-status.ts";
import {
  getCurrentAgentRoundEntries,
  getLatestUserMessageText,
  getPreviousAgentRoundEntries,
  getRecentAgentRoundMessages,
  getSlidingWindowAgentRoundMessages,
  mergeRecentAgentRoundMessagesWithContext,
  serializeCurrentAgentRoundConversation,
  serializePreviousAgentRoundConversation,
} from "./grc-context-manager.js";
import type { AgentRoundBoundaryEntry, CuratorArtifactEntry, GRCState, PasstoContextConfig, PrincipleItem, SessionState } from "./types.js";

// =============================================================================
// Module State (module-level singleton for the extension lifetime)
// =============================================================================

let config: PasstoContextConfig | null = null;
let logger: ReturnType<typeof createLogger> | null = null;
let compaction: ReturnType<typeof createCompactionHandler> | null = null;
let memory: ReturnType<typeof createMemoryManager> | null = null;
let tracker: ReturnType<typeof createContextTracker> | null = null;
let grcState: GRCState | null = null;
let principles: ReturnType<typeof createPrinciplesManager> | null = null;
let sessionDisplayName = "unknown";
let reflectorPromise: Promise<void> | null = null;
let curatorPromise: Promise<void> | null = null;
let sessionActive = false;
let sessionGeneration = 0;
let widgetRefreshCtx: ExtensionContext | null = null;
let widgetTicker: ReturnType<typeof setInterval> | null = null;
let reflectorStartedAt: number | null = null;
let curatorStartedAt: number | null = null;
let widgetNotice: WidgetNoticeState | null = null;
let orchestrationSuspended = false;
let orchestrationReason = "";
let currentRun: CurrentRunState = createInitialCurrentRunState();

type GRCJobTargets = "reflector" | "curator";
type PostRoundJobTargets = "reflector";

type CurrentRunState = {
  active: boolean;
  startedAt: number | null;
  turnCount: number;
  stuckReflectorTriggered: boolean;
  stuckReflectorDelivered: boolean;
};

type MidRunDebugPhase =
  | "triggered"
  | "finished-no-advice"
  | "finished-after-agent-end"
  | "duplicate-delivery-skipped"
  | "delivered"
  | "failed";

type MidRunDebugEntry = {
  phase: MidRunDebugPhase;
  recordedAt: string;
  sessionGeneration: number;
  runTurn: number;
  threshold: number | null;
  agentRound: number;
  userTurns: number;
  currentRunActive: boolean;
  stuckReflectorDelivered: boolean;
  processedUpToUserTurn?: number;
  adviceChars?: number;
  missingAuth?: boolean;
  error?: string;
};

function createInitialCurrentRunState(): CurrentRunState {
  return {
    active: false,
    startedAt: null,
    turnCount: 0,
    stuckReflectorTriggered: false,
    stuckReflectorDelivered: false,
  };
}

function getCurrentUserTurnCount(): number {
  return tracker?.getState().turnCount ?? 0;
}

function formatErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getMidRunThreshold(): number | null {
  return config?.grc.midRunTurnThreshold ?? null;
}

function appendMidRunDebugEntry(pi: ExtensionAPI, entry: MidRunDebugEntry): void {
  try {
    pi.appendEntry("grc-mid-run-debug", entry);
  } catch (err) {
    logger?.warn("Failed to persist grc-mid-run-debug entry:", err);
  }
}

function getPostRoundTargets(_state: GRCState, _grcConfig: PasstoContextConfig["grc"]): PostRoundJobTargets {
  return "reflector";
}

function formatJobTargetsLabel(targets: GRCJobTargets | PostRoundJobTargets): string {
  switch (targets) {
    case "reflector":
      return "反思";
    case "curator":
      return "梳理";
    default:
      return "反思";
  }
}

async function fsMkdirSafe(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

function statusChar(status: GRCState["reflector"]["status"]): string {
  switch (status) {
    case "running":
      return "⟳";
    case "done":
      return "✓";
    case "failed":
      return "✗";
    case "idle":
    default:
      return "·";
  }
}

function appendAgentRoundBoundary(pi: ExtensionAPI): void {
  if (!grcState) return;

  const entry: AgentRoundBoundaryEntry = {
    customType: "passto-round-boundary",
    agentRound: grcState.currentAgentRound,
    totalCompletedAgentRounds: grcState.totalAgentRounds,
    userTurnsAtStart: getCurrentUserTurnCount(),
    createdAt: new Date().toISOString(),
  };

  try {
    pi.appendEntry("passto-round-boundary", entry);
  } catch (err) {
    logger?.warn("Failed to persist passto-round-boundary entry:", err);
  }
}

function appendCuratorArtifactEntry(pi: ExtensionAPI, entry: CuratorArtifactEntry): void {
  try {
    pi.appendEntry("grc-curator-artifact", entry);
  } catch (err) {
    logger?.warn("Failed to persist grc-curator-artifact entry:", err);
  }
}

function terminalFileLink(filePath: string, label = filePath): string {
  try {
    const href = pathToFileURL(filePath).href;
    return `\u001b]8;;${href}\u0007${label}\u001b]8;;\u0007`;
  } catch {
    return label;
  }
}

function estimateSessionMemoryFootprint(): { sizeLabel: string; tokenLabel: string } {
  if (!memory || !config?.memory.enabled) {
    return { sizeLabel: "0", tokenLabel: "0" };
  }

  const items = memory.list();
  if (items.length === 0) {
    return { sizeLabel: "0", tokenLabel: "0" };
  }

  const serialized = items
    .map((item) => [`# ${item.type}:${item.id}`, item.tags.join(","), item.content].filter(Boolean).join("\n"))
    .join("\n\n");

  const bytes = new TextEncoder().encode(serialized).length;
  const tokens = estimateTokens(serialized);
  const sizeLabel = formatCompactK(bytes);
  const tokenLabel = tokens >= 1024 ? `${(tokens / 1024).toFixed(1)}kT` : `${tokens}T`;
  return { sizeLabel, tokenLabel };
}

function formatSubagentRuntime(status: GRCState["reflector"]["status"], startedAt: number | null): string {
  if (status === "running" && startedAt) {
    const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    return `${seconds}s`;
  }
  if (status === "done") return "✓";
  if (status === "failed") return "✗";
  return "0";
}

function getRecentHintCountForDisplay(item: PrincipleItem, days: number): number {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return (item.metadata.hintTimestamps ?? []).filter((iso) => {
    const value = new Date(iso).getTime();
    return Number.isFinite(value) && value >= threshold;
  }).length;
}

function summarizePrincipleOps(ops: Array<{ op: "create" | "reuse" | "merge" | "conflict" }>): string {
  const counts = { create: 0, reuse: 0, merge: 0, conflict: 0 };
  for (const op of ops) {
    counts[op.op] += 1;
  }
  return `create=${counts.create}, reuse=${counts.reuse}, merge=${counts.merge}, conflict=${counts.conflict}`;
}

function syncWidgetTicker(): void {
  const hasVisibleNotice = Boolean(getVisibleWidgetNotice(widgetNotice, config?.grc.widgetNoticeMaxChars ?? 24));
  const shouldTick = Boolean(
    sessionActive
    && widgetRefreshCtx?.hasUI
    && config?.tracking.showWidget
    && (
      getEffectiveReflectorStatus() === "running"
      || getEffectiveCuratorStatus() === "running"
      || hasVisibleNotice
    ),
  );

  if (shouldTick) {
    if (!widgetTicker) {
      widgetTicker = setInterval(() => {
        if (!widgetRefreshCtx) return;
        refreshWidget(widgetRefreshCtx);
      }, 1000);
    }
    return;
  }

  if (widgetTicker) {
    clearInterval(widgetTicker);
    widgetTicker = null;
  }
}

function getContextUsageLabel(ctx: Pick<ExtensionContext, "getContextUsage"> | null | undefined): string {
  const usage = ctx?.getContextUsage?.();
  const tokens = usage?.tokens ?? 0;
  if (tokens <= 0) return "0";
  const compact = formatCompactK(tokens);
  return compact.endsWith("K") ? compact.toLowerCase() : compact;
}

function formatMidRunReflectorState(run: CurrentRunState): string {
  if (!run.active) return "idle";
  if (run.stuckReflectorDelivered) return "delivered";
  if (run.stuckReflectorTriggered) return "pending";
  return "no";
}

function getEffectiveReflectorStatus(): GRCState["reflector"]["status"] {
  if (reflectorPromise || reflectorStartedAt) return "running";
  return grcState?.reflector.status ?? "idle";
}

function getEffectiveCuratorStatus(): GRCState["curator"]["status"] {
  if (curatorPromise || curatorStartedAt) return "running";
  return grcState?.curator.status ?? "idle";
}

function formatWidgetStatus(ctx: ExtensionContext, state: SessionState | null, grcState: GRCState | null): string {
  if (grcState?.runtimeMode === "off") {
    return "PTC:off";
  }

  const parts: string[] = [];

  const runLabel = currentRun.active ? `Run:${currentRun.turnCount}` : "Run:0";
  const contextUsageLabel = getContextUsageLabel(ctx);
  parts.push(`${runLabel} ${contextUsageLabel}`);

  const memoryFootprint = estimateSessionMemoryFootprint();
  parts.push(`记:${memoryFootprint.sizeLabel}`);
  parts.push(`思:${formatSubagentRuntime(getEffectiveReflectorStatus(), reflectorStartedAt)}`);
  parts.push(`理:${formatSubagentRuntime(getEffectiveCuratorStatus(), curatorStartedAt)}`);

  const baseStatus = parts.join(" | ");
  return appendWidgetNotice(baseStatus, widgetNotice, config?.grc.widgetNoticeMaxChars ?? 24);
}

function refreshWidget(ctx: ExtensionContext): void {
  widgetRefreshCtx = ctx;
  syncWidgetTicker();
  if (!ctx.hasUI || !config?.tracking.showWidget) return;
  try {
    const status = formatWidgetStatus(ctx, tracker?.getState() ?? null, grcState);
    ctx.ui.setWidget("passto-context", [status]);
  } catch {
    // Ignore UI refresh races.
  }
}

function setTransientGRCStatus(ctx: ExtensionContext, text: string): void {
  if (!sessionActive) return;
  logger?.info(`[widget-note] ${text}`);
  widgetNotice = {
    text,
    expiresAt: Date.now() + 5000,
  };
  refreshWidget(ctx);
}

function resetModuleState(): void {
  sessionActive = false;
  config = null;
  logger = null;
  compaction = null;
  memory = null;
  tracker = null;
  grcState = null;
  principles = null;
  sessionDisplayName = "unknown";
  reflectorPromise = null;
  curatorPromise = null;
  widgetRefreshCtx = null;
  reflectorStartedAt = null;
  curatorStartedAt = null;
  widgetNotice = null;
  if (widgetTicker) {
    clearInterval(widgetTicker);
    widgetTicker = null;
  }
  orchestrationSuspended = false;
  orchestrationReason = "";
  currentRun = createInitialCurrentRunState();
}

function isMissingAuthError(err: unknown): boolean {
  const message = formatErrorMessage(err);
  return /no api key|auth failed|g?rc model not found/i.test(message);
}

async function safeNotify(ctx: Pick<ExtensionContext, "hasUI" | "ui">, message: string, level: "info" | "warning" | "error"): Promise<void> {
  try {
    if (!ctx.hasUI) return;
    ctx.ui.notify(message, level);
  } catch {
    // Ignore UI teardown races during shutdown/reload.
  }
}

async function waitForBackgroundJobs(timeoutMs: number, logger: ReturnType<typeof createLogger> | null): Promise<void> {
  const running = [reflectorPromise, curatorPromise].filter(Boolean) as Promise<void>[];
  if (running.length === 0) return;

  const timeout = new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

  const settled = Promise.allSettled(running).then(() => undefined);
  await Promise.race([settled, timeout]);

  if ([reflectorPromise, curatorPromise].some(Boolean)) {
    logger?.warn(`Background GRC jobs did not settle within ${timeoutMs}ms; continuing shutdown`);
  }
}

function detectExternalOrchestrator(ctx: ExtensionContext): { suspended: boolean; reason: string } {
  if (!config) {
    return { suspended: false, reason: "" };
  }

  const prefixes = config.grc.orchestratorToolPrefixes ?? [];
  if (prefixes.length === 0) {
    return { suspended: false, reason: "" };
  }

  const branch = ctx.sessionManager.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i];
    if (entry.type !== "message") continue;
    const message = entry.message as { toolName?: string; content?: Array<{ type?: string; name?: string }> } | undefined;
    const toolNames = new Set<string>();
    if (message?.toolName) {
      toolNames.add(message.toolName);
    }
    for (const block of message?.content ?? []) {
      if (block?.type === "toolCall" && typeof block.name === "string") {
        toolNames.add(block.name);
      }
    }

    for (const toolName of toolNames) {
      const matchedPrefix = prefixes.find((prefix) => toolName.startsWith(prefix));
      if (matchedPrefix) {
        return {
          suspended: true,
          reason: `检测到外部编排流程：${toolName}`,
        };
      }
    }
  }

  return { suspended: false, reason: "" };
}

function updateOrchestrationSuspension(ctx: ExtensionContext): void {
  const previousSuspended = orchestrationSuspended;
  const previousReason = orchestrationReason;
  const detected = detectExternalOrchestrator(ctx);
  const changed = previousSuspended !== detected.suspended || previousReason !== detected.reason;
  orchestrationSuspended = detected.suspended;
  orchestrationReason = detected.reason;

  if (!changed) return;

  if (orchestrationSuspended) {
    logger?.debug(`Orchestrator guard engaged: ${orchestrationReason}`);
    setTransientGRCStatus(ctx, "检测到编排流程，GRC 已让行");
    return;
  }

  logger?.debug("Orchestrator guard released");
}

function isRuntimeEnabled(): boolean {
  return grcState?.runtimeMode !== "off";
}

function isGRCAutoProcessingAllowed(): boolean {
  return isRuntimeEnabled() && !orchestrationSuspended;
}

async function openConfigInSystemEditor(filePath: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const platform = process.platform;

  const command =
    platform === "darwin"
      ? { cmd: "open", args: [filePath] }
      : platform === "win32"
        ? { cmd: "cmd", args: ["/c", "start", "", filePath] }
        : { cmd: "xdg-open", args: [filePath] };

  return await new Promise((resolve) => {
    try {
      const child = spawn(command.cmd, command.args, {
        detached: true,
        stdio: "ignore",
      });

      child.once("error", (err) => {
        resolve({ ok: false, reason: formatErrorMessage(err) });
      });

      child.once("spawn", () => {
        child.unref();
        resolve({ ok: true });
      });
    } catch (err) {
      resolve({ ok: false, reason: formatErrorMessage(err) });
    }
  });
}

// =============================================================================
// Default Export
// =============================================================================

export default function (pi: ExtensionAPI) {
  function startMidRunReflector(ctx: ExtensionContext): void {
    if (!config || !logger || !grcState || !sessionActive) {
      logger?.debug("Skipped mid-run Reflector: extension state not ready");
      return;
    }
    if (!isRuntimeEnabled()) {
      logger?.debug("Skipped mid-run Reflector: runtimeMode=off");
      return;
    }
    if (!currentRun.active) {
      logger?.debug("Skipped mid-run Reflector: no active run");
      return;
    }
    if (orchestrationSuspended) {
      logger?.debug(`Skipped mid-run Reflector due to orchestrator guard: ${orchestrationReason || "unknown"}`);
      return;
    }
    if (reflectorPromise) {
      logger?.debug("Skipped mid-run Reflector: Reflector already running");
      return;
    }

    const generation = sessionGeneration;
    const agentRoundAtStart = grcState.currentAgentRound;
    const runTurnAtStart = currentRun.turnCount;
    const userTurnAtStart = getCurrentUserTurnCount();
    const conversation = serializeConversation(ctx.sessionManager.getBranch(), {
      maxTokens: 16000,
      preserveFirstUserMessage: true,
      preserveRecentTurns: Math.max(1, config.grc.keepRecentAgentRounds),
      includeToolResults: true,
      toolResultMaxChars: 1000,
    });
    const reflectorGoalState = grcState.curator.lastGoalState;
    const reflectorGoalContext = buildReflectorGoalContext(reflectorGoalState);

    if (!conversation.trim()) {
      logger?.warn("Skipped mid-run Reflector: empty serialized conversation");
      return;
    }

    logger?.debug(
      `Mid-run stuck detected (runTurn=${runTurnAtStart}, threshold=${config.grc.midRunTurnThreshold}, agentRound=${agentRoundAtStart}, turnRound=${grcState.currentTurnRound}, userTurns=${userTurnAtStart}) -> starting Reflector`,
    );
    appendMidRunDebugEntry(pi, {
      phase: "triggered",
      recordedAt: new Date().toISOString(),
      sessionGeneration: generation,
      runTurn: runTurnAtStart,
      threshold: getMidRunThreshold(),
      agentRound: agentRoundAtStart,
      userTurns: userTurnAtStart,
      currentRunActive: currentRun.active,
      stuckReflectorDelivered: currentRun.stuckReflectorDelivered,
    });

    reflectorStartedAt = Date.now();
    grcState = updateReflectorStatus(grcState, "running");
    refreshWidget(ctx);

    reflectorPromise = executeReflector(conversation, reflectorGoalState, reflectorGoalContext, ctx, config.grc, logger)
      .then((result) => {
        if (!grcState || !sessionActive || generation !== sessionGeneration || !isRuntimeEnabled()) return;
        const processedUserTurns = Math.max(grcState.reflector.processedUpToTurn, userTurnAtStart);
        const processedAgentRound = Math.max(grcState.reflector.processedUpToAgentRound, agentRoundAtStart);
        if (!result || !result.hasSubstantiveContent) {
          grcState = updateReflectorStatus(grcState, "done", null, processedUserTurns, processedAgentRound, agentRoundAtStart);
          reflectorStartedAt = null;
          appendMidRunDebugEntry(pi, {
            phase: "finished-no-advice",
            recordedAt: new Date().toISOString(),
            sessionGeneration: generation,
            runTurn: runTurnAtStart,
            threshold: getMidRunThreshold(),
            agentRound: agentRoundAtStart,
            userTurns: userTurnAtStart,
            currentRunActive: currentRun.active,
            stuckReflectorDelivered: currentRun.stuckReflectorDelivered,
            processedUpToUserTurn: processedUserTurns,
          });
          logger?.debug(
            `Mid-run Reflector finished (no substantive advice, runTurn=${runTurnAtStart}, processedUpToAgentRound=${processedAgentRound}, hasGoalState=${Boolean(reflectorGoalState)}, hasGoalContext=${Boolean(reflectorGoalContext)})`,
          );
          refreshWidget(ctx);
          return;
        }

        grcState = updateReflectorStatus(grcState, "done", result.advice, processedUserTurns, processedAgentRound, agentRoundAtStart);
        reflectorStartedAt = null;

        if (!currentRun.active) {
          appendMidRunDebugEntry(pi, {
            phase: "finished-after-agent-end",
            recordedAt: new Date().toISOString(),
            sessionGeneration: generation,
            runTurn: runTurnAtStart,
            threshold: getMidRunThreshold(),
            agentRound: agentRoundAtStart,
            userTurns: userTurnAtStart,
            currentRunActive: currentRun.active,
            stuckReflectorDelivered: currentRun.stuckReflectorDelivered,
            processedUpToUserTurn: processedUserTurns,
            adviceChars: result.advice.length,
          });
          logger?.debug("Mid-run Reflector finished after agent_end; steer skipped");
          refreshWidget(ctx);
          return;
        }
        if (currentRun.stuckReflectorDelivered) {
          appendMidRunDebugEntry(pi, {
            phase: "duplicate-delivery-skipped",
            recordedAt: new Date().toISOString(),
            sessionGeneration: generation,
            runTurn: runTurnAtStart,
            threshold: getMidRunThreshold(),
            agentRound: agentRoundAtStart,
            userTurns: userTurnAtStart,
            currentRunActive: currentRun.active,
            stuckReflectorDelivered: currentRun.stuckReflectorDelivered,
            processedUpToUserTurn: processedUserTurns,
            adviceChars: result.advice.length,
          });
          logger?.debug("Mid-run Reflector advice already delivered; skipping duplicate steer");
          refreshWidget(ctx);
          return;
        }

        pi.sendMessage(
          {
            customType: "grc-mid-run-reflection-steer",
            content: buildReflectorInjection(result.advice),
            display: false,
          },
          { deliverAs: "steer" },
        );
        currentRun.stuckReflectorDelivered = true;
        appendMidRunDebugEntry(pi, {
          phase: "delivered",
          recordedAt: new Date().toISOString(),
          sessionGeneration: generation,
          runTurn: runTurnAtStart,
          threshold: getMidRunThreshold(),
          agentRound: agentRoundAtStart,
          userTurns: userTurnAtStart,
          currentRunActive: currentRun.active,
          stuckReflectorDelivered: currentRun.stuckReflectorDelivered,
          processedUpToUserTurn: processedUserTurns,
          adviceChars: result.advice.length,
        });
        setTransientGRCStatus(ctx, "运行中反思已注入");
        logger?.debug(`Mid-run Reflector delivered via steer (runTurn=${runTurnAtStart}, adviceChars=${result.advice.length}, hasGoalState=${Boolean(reflectorGoalState)}, hasGoalContext=${Boolean(reflectorGoalContext)})`);
        refreshWidget(ctx);
      })
      .catch((err) => {
        if (!grcState || generation !== sessionGeneration || !isRuntimeEnabled()) return;
        grcState = updateReflectorStatus(grcState, "failed");
        reflectorStartedAt = null;
        appendMidRunDebugEntry(pi, {
          phase: "failed",
          recordedAt: new Date().toISOString(),
          sessionGeneration: generation,
          runTurn: runTurnAtStart,
          threshold: getMidRunThreshold(),
          agentRound: agentRoundAtStart,
          userTurns: userTurnAtStart,
          currentRunActive: currentRun.active,
          stuckReflectorDelivered: currentRun.stuckReflectorDelivered,
          missingAuth: isMissingAuthError(err),
          error: formatErrorMessage(err),
        });
        logger?.warn("Mid-run Reflector failed:", err);
        refreshWidget(ctx);
        if (isMissingAuthError(err)) {
          logger?.warn("Mid-run Reflector disabled for this cycle due to missing model auth/config");
          void safeNotify(ctx, "运行中 Reflector 不可用：缺少模型配置或 API Key，本轮已跳过。", "warning");
        }
      })
      .finally(() => {
        logger?.debug("Mid-run Reflector promise cleared");
        reflectorPromise = null;
      });
  }

  function startGRCBackgroundJobs(ctx: ExtensionContext, targets: GRCJobTargets = "reflector"): void {
    if (!config || !logger || !grcState || !sessionActive || !principles) {
      logger?.debug("Skipped GRC background jobs: extension state not ready", {
        hasConfig: Boolean(config),
        hasLogger: Boolean(logger),
        hasGRCState: Boolean(grcState),
        hasPrinciples: Boolean(principles),
        sessionActive,
        targets,
      });
      return;
    }
    if (!isRuntimeEnabled()) {
      logger?.debug(`Skipped GRC background jobs: runtimeMode=off (targets=${targets})`);
      return;
    }
    if (!isGRCAutoProcessingAllowed()) {
      logger?.debug(`Skipped GRC background jobs due to orchestrator guard (targets=${targets}, reason=${orchestrationReason || "unknown"})`);
      return;
    }

    const needReflector = targets === "reflector";
    const needCurator = targets === "curator";

    if ((needReflector && reflectorPromise) || (needCurator && curatorPromise)) {
      logger?.info(
        `Skipped GRC background jobs because subagent is already running (targets=${targets}, reflectorRunning=${Boolean(reflectorPromise)}, curatorRunning=${Boolean(curatorPromise)})`,
      );
      return;
    }

    const generation = sessionGeneration;
    const currentAgentRound = grcState.currentAgentRound;
    const targetPreviousAgentRound = grcState.totalAgentRounds;
    const userTurnAtStart = getCurrentUserTurnCount();

    const branch = ctx.sessionManager.getBranch();
    const reflectorConversation = serializeConversation(branch, {
      maxTokens: 16000,
      preserveFirstUserMessage: true,
      preserveRecentTurns: Math.max(1, config.grc.keepRecentAgentRounds),
      includeToolResults: true,
      toolResultMaxChars: 1000,
    });
    const previousRoundConversation = serializePreviousAgentRoundConversation(branch, (entries) =>
      serializeConversation(entries, {
        maxTokens: 16000,
        preserveFirstUserMessage: true,
        preserveRecentTurns: Math.max(1, config.grc.keepRecentAgentRounds),
        includeToolResults: true,
        toolResultMaxChars: 1000,
      })
    );
    const currentUserMessage = getLatestUserMessageText(branch);
    const previousAgentRoundMessageCount = getPreviousAgentRoundEntries(branch).length;
    const reflectorGoalState = grcState.curator.lastGoalState;
    const reflectorGoalContext = buildReflectorGoalContext(reflectorGoalState);

    logger?.debug(
      `Preparing GRC background jobs (targets=${targets}, generation=${generation}, currentAgentRound=${currentAgentRound}, targetPreviousAgentRound=${targetPreviousAgentRound}, turnRound=${grcState.currentTurnRound}, userTurns=${userTurnAtStart}, mode=${grcState.mode}, runtimeMode=${grcState.runtimeMode}, reflectorConversationChars=${reflectorConversation.length}, previousRoundConversationChars=${previousRoundConversation.length}, previousAgentRoundMessages=${previousAgentRoundMessageCount}, currentUserMessageChars=${currentUserMessage.length}, hasGoalState=${Boolean(reflectorGoalState)}, hasGoalContext=${Boolean(reflectorGoalContext)})`,
    );

    if (needReflector && !reflectorConversation.trim()) {
      logger.warn("Skipped Reflector: empty serialized conversation");
      return;
    }

    if (needCurator && !previousRoundConversation.trim()) {
      logger?.debug("Skipped Curator: no previous agent-round conversation available");
      return;
    }

    if (needCurator && !currentUserMessage.trim()) {
      logger?.debug("Skipped Curator: missing current user message");
      return;
    }

    if (needReflector) {
      logger?.debug(`Starting Reflector (agentRound=${currentAgentRound}, userTurns=${userTurnAtStart}, generation=${generation})`);
      reflectorStartedAt = Date.now();
      grcState = updateReflectorStatus(grcState, "running");
      refreshWidget(ctx);
      reflectorPromise = executeReflector(reflectorConversation, reflectorGoalState, reflectorGoalContext, ctx, config.grc, logger)
        .then((result) => {
          if (!grcState || !sessionActive || generation !== sessionGeneration || !isRuntimeEnabled()) return;
          const processedUserTurns = Math.max(grcState.reflector.processedUpToTurn, userTurnAtStart);
          const processedAgentRound = Math.max(grcState.reflector.processedUpToAgentRound, currentAgentRound);
          if (!result || !result.hasSubstantiveContent) {
            grcState = updateReflectorStatus(grcState, "done", null, processedUserTurns, processedAgentRound, currentAgentRound);
            reflectorStartedAt = null;
            logger?.debug(`Reflector finished (no substantive advice, processedUpToAgentRound=${processedAgentRound}, hasGoalState=${Boolean(reflectorGoalState)}, hasGoalContext=${Boolean(reflectorGoalContext)})`);
            refreshWidget(ctx);
            return;
          }
          grcState = updateReflectorStatus(grcState, "done", result.advice, processedUserTurns, processedAgentRound, currentAgentRound);
          reflectorStartedAt = null;
          logger?.debug(`Reflector finished (adviceChars=${result.advice.length}, principleOps=${result.principleOps.length}, processedUpToAgentRound=${processedAgentRound}, hasGoalState=${Boolean(reflectorGoalState)}, hasGoalContext=${Boolean(reflectorGoalContext)})`);

          if (result.principleOps.length > 0) {
            void principles
              .applyPrincipleOps(result.principleOps, {
                source: `${sessionDisplayName}-agent-${currentAgentRound}`,
                hardMaxCount: Math.max(config.grc.maxPrinciples, 200),
              })
              .then(({ changed, deleted }) => {
                const diagnostics = principles.getDiagnostics();
                logger?.debug(
                  `Applied ${result.principleOps.length} reflector principle ops (changed=${changed}, deleted=${deleted}, totals=${summarizePrincipleOps(result.principleOps)}, cumulativeCreate=${diagnostics.audit.effects.created}, cumulativeReuse=${diagnostics.audit.effects.reused}, cumulativeMerge=${diagnostics.audit.effects.merged}, cumulativeConflict=${diagnostics.audit.effects.conflicted})`,
                );
              })
              .catch((err) => {
                logger?.warn("Failed to apply reflector principle ops:", err);
              });
          }

          setTransientGRCStatus(ctx, result.principleOps.length > 0 ? `反思完成 + 原则${result.principleOps.length}条` : "反思完成");
          refreshWidget(ctx);
        })
        .catch((err) => {
          if (!grcState || generation !== sessionGeneration || !isRuntimeEnabled()) return;
          grcState = updateReflectorStatus(grcState, "failed");
          reflectorStartedAt = null;
          logger?.warn("Reflector failed:", err);
          refreshWidget(ctx);
          if (isMissingAuthError(err)) {
            logger?.warn("Reflector disabled for this cycle due to missing model auth/config");
            void safeNotify(ctx, "Reflector 不可用：缺少模型配置或 API Key，本轮已跳过。", "warning");
          }
        })
        .finally(() => {
          logger?.debug("Reflector promise cleared");
          reflectorPromise = null;
        });
    }

    if (needCurator) {
      logger?.debug(`Starting Curator (targetPreviousAgentRound=${targetPreviousAgentRound}, currentAgentRound=${currentAgentRound}, userTurns=${userTurnAtStart}, generation=${generation})`);
      curatorStartedAt = Date.now();
      grcState = updateCuratorStatus(grcState, "running");
      refreshWidget(ctx);
      curatorPromise = executeCurator(
        previousRoundConversation,
        currentUserMessage,
        ctx,
        config.grc,
        logger,
        undefined,
        grcState.curator.lastGoalState,
        targetPreviousAgentRound,
      )
        .then((result) => {
          if (!grcState || !sessionActive || generation !== sessionGeneration || !isRuntimeEnabled()) return;
          const processedUserTurns = Math.max(grcState.curator.processedUpToTurn, userTurnAtStart);
          const processedAgentRound = Math.max(grcState.curator.processedUpToAgentRound, targetPreviousAgentRound);
          if (!result) {
            grcState = updateCuratorStatus(grcState, "done", null, processedUserTurns, 0, undefined, undefined, undefined, undefined, processedAgentRound, targetPreviousAgentRound);
            curatorStartedAt = null;
            refreshWidget(ctx);
            return;
          }
          const rejectionReasons = getCuratorGoalStateRejectionReasons(grcState.curator.lastGoalState, result);
          if (rejectionReasons.length > 0) {
            logger?.debug(
              `Curator structured payload rejected (reasons=${rejectionReasons.join(",")}, previousActive=${grcState.curator.lastGoalState?.active.length ?? 0}, hasGoalState=${Boolean(result.goalState)}, nextActive=${result.goalState?.active.length ?? 0}, hasSummaryEntry=${Boolean(result.summaryEntry)}, summaryGoal=${JSON.stringify(result.summaryEntry?.summary.goal ?? "")}, closureEvidence=${result.closureEvidence.length})`,
            );
          }
          const reconciledResult = reconcileCuratorGoalState(grcState.curator.lastGoalState, result);
          const normalizedSummaryEntry = reconciledResult?.summaryEntry ?? null;
          const normalizedGoalState = reconciledResult?.goalState ?? null;
          const normalizedSignal = reconciledResult?.signal ?? null;
          let nextState = updateCuratorStatus(
            grcState,
            "done",
            reconciledResult?.summary ?? result.summary,
            processedUserTurns,
            0,
            normalizedSummaryEntry ?? undefined,
            normalizedGoalState ?? undefined,
            undefined,
            normalizedSignal ?? undefined,
            processedAgentRound,
            targetPreviousAgentRound,
          );
          if (normalizedSummaryEntry) {
            const pushed = pushSummaryCacheEntry(nextState, normalizedSummaryEntry, config.grc.summaryCacheSize);
            nextState = pushed.state;
            if (pushed.evicted) {
              logger?.debug(`SummaryCache evicted round ${pushed.evicted.agentRound} due to maxSize=${config.grc.summaryCacheSize}`);
            }
          }
          grcState = nextState;
          appendCuratorArtifactEntry(pi, {
            customType: "grc-curator-artifact",
            agentRound: targetPreviousAgentRound,
            recordedAt: new Date().toISOString(),
            processedUpToUserTurn: processedUserTurns,
            summary: reconciledResult?.summary ?? result.summary,
            summaryEntry: normalizedSummaryEntry,
            goalState: normalizedGoalState,
            signal: reconciledResult?.signal ?? result.signal,
          });
          curatorStartedAt = null;
          logger?.debug(
            `Curator finished (summaryChars=${result.summary.length}, hasSummaryEntry=${Boolean(normalizedSummaryEntry)}, summaryCache=${grcState.curator.summaryCache.length}, hasGoalState=${Boolean(normalizedGoalState)}, signal=${normalizedSignal?.type ?? "none"}, processedUpToAgentRound=${processedAgentRound})`,
          );

          setTransientGRCStatus(ctx, normalizedGoalState ? "梳理完成 + 目标更新" : "梳理完成");
          refreshWidget(ctx);
        })
        .catch((err) => {
          if (!grcState || generation !== sessionGeneration || !isRuntimeEnabled()) return;
          grcState = updateCuratorStatus(grcState, "failed");
          curatorStartedAt = null;
          logger?.warn("Curator failed:", err);
          refreshWidget(ctx);
          if (isMissingAuthError(err)) {
            logger?.warn("Curator disabled for this cycle due to missing model auth/config");
            void safeNotify(ctx, "Curator 不可用：缺少模型配置或 API Key，本轮已跳过。", "warning");
          }
        })
        .finally(() => {
          logger?.debug("Curator promise cleared");
          curatorPromise = null;
        });
    }
  }
  // ===========================================================================
  // Session Start
  // ===========================================================================

  pi.on("session_start", async (_event, ctx) => {
    try {
      // Load or create configuration
      sessionActive = true;
      sessionGeneration += 1;
      config = await ensureConfigExists();
      logger = createLogger(config.logLevel, config.logEnabled);

      // Initialize modules
      compaction = createCompactionHandler(config.compaction, logger);
      grcState = createInitialGRCState();

      if (config.memory.enabled) {
        memory = createMemoryManager(config.memory, logger);
        // Get session file path for session isolation
        const sessionFile = ctx.sessionManager.getSessionFile();
        sessionDisplayName = getSessionDisplayName(sessionFile);
        await memory.init(sessionFile);
      }

      principles = createPrinciplesManager(logger);

      if (config.tracking.enabled) {
        tracker = createContextTracker(config.tracking, logger);
        tracker.reset();
      }

      // Restore any persisted state from previous session
      const curatorArtifacts: CuratorArtifactEntry[] = [];
      let curatorArtifactsRejected = 0;
      for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type === "custom" && entry.customType === "passto-context-state") {
          const data = entry.data as Parameters<ReturnType<typeof createContextTracker>["restore"]>[0] | undefined;
          if (data && tracker) {
            tracker.restore(data);
          }
        }

        if (entry.type === "custom" && entry.customType === "grc-state") {
          grcState = restoreGRCState(entry.data);
        }

        if (entry.type === "custom" && entry.customType === "grc-curator-artifact") {
          const parsed = parseCuratorArtifactEntry(entry.data);
          if (parsed) {
            curatorArtifacts.push(parsed);
          } else {
            curatorArtifactsRejected += 1;
          }
        }

      }

      // Ensure GRC directories exist
      await fsMkdirSafe(expandHome(config.grc.principlesDir));
      await principles.load(expandHome(config.grc.principlesDir));
      const pruned = await principles.prune(config.grc.maxPrinciples);
      if (pruned > 0) {
        logger?.info(`Pruned ${pruned} overflow principles during session start`);
      }

      const restoreResult = restoreCuratorStateFromBranchEntries(grcState, ctx.sessionManager.getBranch() as Array<{ type?: string; customType?: string; data?: unknown }>, config.grc.summaryCacheSize);
      grcState = restoreResult.state;
      curatorArtifactsRejected = restoreResult.curatorArtifactsRejected;
      if (restoreResult.restoredCuratorArtifactRounds.length > 0) {
        const restoredRounds = restoreResult.restoredCuratorArtifactRounds.join(",");
        const goalStateRound = grcState.curator.lastGoalState?.agentRound ?? "none";
        logger?.info(
          `Restored ${restoreResult.restoredCuratorArtifactRounds.length} curator artifacts from branch history (rejected=${curatorArtifactsRejected}, summaryCacheRounds=${restoredRounds}, goalStateRound=${goalStateRound})`,
        );
      } else if (curatorArtifactsRejected > 0) {
        logger?.warn(`Skipped ${curatorArtifactsRejected} invalid curator artifacts during restore`);
      }


      if (grcState) {
        grcState = clearRunningSubagentStatuses(grcState);
      }

      logger?.info("PasstoContext loaded");
      logger?.info(
        `Config loaded (logEnabled=${config.logEnabled}, logLevel=${config.logLevel}, memory=${config.memory.enabled}, tracking=${config.tracking.enabled}, grc=${config.grc.enabled})`,
      );
      logger?.debug("GRC state initialized:", grcState);

      updateOrchestrationSuspension(ctx);

      // Keep startup notify, but avoid runtime shared-notification noise.
      if (ctx.hasUI) {
        ctx.ui.notify("PasstoContext ready", "info");
        refreshWidget(ctx);
      }
    } catch (err) {
      // Init failure should not break Pi
      resetModuleState();
      console.error("[PasstoContext] Init failed:", err);
    }
  });

  // ===========================================================================
  // Before Compaction (Smart Compression)
  // ===========================================================================

  pi.on("session_before_compact", async (event, ctx) => {
    if (!config?.compaction.enabled || !compaction || !isRuntimeEnabled()) {
      return; // Let Pi use default compaction
    }

    try {
      const curatorSummary =
        config.grc.enabled &&
        !orchestrationSuspended &&
        grcState?.curator.status === "done" &&
        grcState.curator.lastSummary
          ? grcState.curator.lastSummary
          : undefined;

      logger?.debug(
        `session_before_compact: using ${curatorSummary ? "curator-summary" : "pi-default"} path (runtimeMode=${grcState?.runtimeMode ?? "n/a"}, grcEnabled=${config.grc.enabled}, suspended=${orchestrationSuspended}, mode=${grcState?.mode ?? "n/a"}, curatorStatus=${grcState?.curator.status ?? "n/a"})`,
      );

      if (!curatorSummary) {
        return undefined;
      }

      const result = await compaction.handleCompaction(event, ctx, {
        curatorSummary,
      });

      if (result) {
        // Save summary to memory
        if (memory && config.memory.enabled) {
          try {
            await memory.saveSessionSummary(result.compaction.summary, ["auto-saved", "compaction"]);
          } catch (memErr) {
            logger?.warn("Failed to save compaction summary to memory:", memErr);
          }
        }

        logger?.info("Smart compaction completed");
        return result;
      }

      // result is undefined — compaction handler fell back to default
      return undefined;
    } catch (err) {
      logger?.error("Compaction failed, falling back to default:", err);
      return undefined;
    }
  });

  // ===========================================================================
  // Before Agent Start (Memory Injection)
  // ===========================================================================

  pi.on("before_agent_start", async (event, ctx) => {
    if (!config) {
      return;
    }

    try {
      updateOrchestrationSuspension(ctx);

      if (!isRuntimeEnabled()) {
        logger?.debug("before_agent_start skipped runtime injections: runtimeMode=off");
        return;
      }

      if (grcState && !curatorPromise) {
        const curatorAutoEnabled = config.grc.enabled;
        if (curatorAutoEnabled && isGRCAutoProcessingAllowed()) {
          startGRCBackgroundJobs(ctx, "curator");
        }
      }

      let systemPrompt = event.systemPrompt;
      const injectionDiagnostics: string[] = [];

      const grcPromptEnabled = config.grc.enabled && !orchestrationSuspended;
      if (grcPromptEnabled) {
        systemPrompt += `\n\n${buildBaseGRCPrompt()}`;
        injectionDiagnostics.push("base-grc");
      } else {
        injectionDiagnostics.push(
          `base-grc:skip(grcEnabled=${config.grc.enabled}, suspended=${orchestrationSuspended}, runtimeMode=${grcState?.runtimeMode ?? "n/a"})`,
        );
      }

      if (grcPromptEnabled && grcState?.curator.lastGoalState) {
        const goalStateInjection = buildGoalStateInjection(grcState.curator.lastGoalState, config.grc.maxGoalStateActive);
        if (goalStateInjection) {
          systemPrompt += `\n\n${goalStateInjection}`;
          injectionDiagnostics.push(`goal-state(${goalStateInjection.length} chars)`);
        }
      } else {
        injectionDiagnostics.push(`goal-state:skip(enabled=${grcPromptEnabled}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)})`);
      }

      if (grcPromptEnabled && grcState && grcState.curator.summaryCache.length > 0) {
        const injectedSummaryCacheRounds = grcState.curator.summaryCache
          .filter((entry) => entry.agentRound <= Math.max(0, grcState.currentAgentRound - config.grc.keepRecentAgentRounds))
          .map((entry) => entry.agentRound);
        const summaryCacheInjection = buildSummaryCacheInjection(
          grcState.curator.summaryCache,
          config.grc.summaryCacheSize,
          config.grc.keepRecentAgentRounds,
        );
        if (summaryCacheInjection) {
          systemPrompt += `\n\n${summaryCacheInjection}`;
          injectionDiagnostics.push(`summary-cache(${injectedSummaryCacheRounds.join(",") || "none"}/${summaryCacheInjection.length} chars)`);
        } else {
          injectionDiagnostics.push(`summary-cache:skip-all-overlap(total=${grcState.curator.summaryCache.length}, keepRecentAgentRounds=${config.grc.keepRecentAgentRounds})`);
        }
      } else {
        injectionDiagnostics.push(`summary-cache:skip(enabled=${grcPromptEnabled}, size=${grcState?.curator.summaryCache.length ?? 0})`);
      }

      if (grcState?.mode === "grc" && grcState.reflector.status === "done" && grcState.reflector.lastAdvice) {
        const reflectorInjection = buildReflectorInjection(grcState.reflector.lastAdvice);
        if (reflectorInjection) {
          systemPrompt += `\n${reflectorInjection}`;
          injectionDiagnostics.push(`reflector(${reflectorInjection.length} chars)`);
        }
      } else {
        injectionDiagnostics.push(
          `reflector:skip(mode=${grcState?.mode ?? "n/a"}, status=${grcState?.reflector.status ?? "n/a"}, hasAdvice=${Boolean(grcState?.reflector.lastAdvice)})`,
        );
      }

      if (grcPromptEnabled && principles && config.grc.maxPrinciplesInjection > 0) {
        const injectablePrinciples = principles.listInjectable(config.grc.maxPrinciplesInjection);
        if (injectablePrinciples.length > 0) {
          const injection = formatPrinciplesForInjection(injectablePrinciples);
          if (injection) {
            systemPrompt += `\n\n${injection}`;
            logger?.debug(`Injected ${injectablePrinciples.length} principles (${injection.length} chars)`);
            injectionDiagnostics.push(`principles(${injectablePrinciples.length}/${injection.length} chars)`);
            void principles.markUsed(injectablePrinciples).catch((err) => {
              logger?.warn("Failed to update principle usage:", err);
            });
          }
        } else {
          injectionDiagnostics.push("principles:0");
        }
      } else {
        injectionDiagnostics.push(
          `principles:skip(enabled=${Boolean(principles)}, max=${config.grc.maxPrinciplesInjection}, grcPromptEnabled=${grcPromptEnabled})`,
        );
      }

      if (config.memory.enabled && memory) {
        const memories = memory.search(event.prompt, 5);
        if (memories.length > 0) {
          const injection = memory.formatForInjection(memories, config.memory.maxInjectionTokens);
          if (injection) {
            systemPrompt += `\n\n${injection}`;
            logger?.debug(`Injected ${memories.length} memories (${injection.length} chars)`);
            injectionDiagnostics.push(`memories(${memories.length}/${injection.length} chars)`);
          }
        } else {
          injectionDiagnostics.push("memories:0");
        }
      } else {
        injectionDiagnostics.push(`memories:skip(enabled=${config.memory.enabled}, manager=${Boolean(memory)})`);
      }

      logger?.debug(
        `before_agent_start injection summary: ${injectionDiagnostics.join(" | ")} | state(mode=${grcState?.mode ?? "n/a"}, runtimeMode=${grcState?.runtimeMode ?? "n/a"}, hasGoalState=${Boolean(grcState?.curator.lastGoalState)}, summaryCache=${grcState?.curator.summaryCache.length ?? 0}, lastSignal=${grcState?.curator.lastSignal?.type ?? "none"}, reflector=${grcState?.reflector.status ?? "n/a"}, curator=${grcState?.curator.status ?? "n/a"})`,
      );

      if (systemPrompt !== event.systemPrompt) {
        return { systemPrompt };
      }
      return;
    } catch (err) {
      logger?.error("before_agent_start injection failed:", err);
      return;
    }
  });

  // ===========================================================================
  // Context Optimization
  // ===========================================================================

  pi.on("context", async (event, ctx) => {
    if (!config || !grcState) {
      return;
    }

    try {
      updateOrchestrationSuspension(ctx);
      if (!isRuntimeEnabled()) {
        logger?.debug("Skipped context optimization (runtimeMode=off)");
        return;
      }
      if (orchestrationSuspended) {
        logger?.debug(
          `Skipped context optimization (runtimeMode=${grcState.runtimeMode}, suspended=${orchestrationSuspended}, reason=${orchestrationReason || "n/a"})`,
        );
        return;
      }

      if (grcState.mode !== "grc") {
        logger?.debug(`Skipped context optimization (mode=${grcState.mode})`);
        return;
      }

      const contextWindow = ctx.model?.contextWindow ?? null;

      const branchMessages = contextWindow && contextWindow > 0
        ? getSlidingWindowAgentRoundMessages(
            ctx.sessionManager.getBranch(),
            config.grc.keepRecentAgentRounds,
            contextWindow,
            config.grc.maxContextPercent,
          )
        : getRecentAgentRoundMessages(
            ctx.sessionManager.getBranch(),
            config.grc.keepRecentAgentRounds,
          );

      const messages = branchMessages.length > 0
        ? mergeRecentAgentRoundMessagesWithContext(branchMessages, event.messages)
        : event.messages;
      const strategy = contextWindow && contextWindow > 0
        ? "min-rounds+percent-threshold-window+event-tail"
        : (branchMessages.length > 0 ? "recent-agent-rounds+event-tail" : "event-messages");

      if (messages !== event.messages) {
        logger?.info(
          `Context optimized using ${strategy}: ${event.messages.length} -> ${messages.length} messages (keepRecentAgentRounds=${config.grc.keepRecentAgentRounds}, maxContextPercent=${config.grc.maxContextPercent}, contextWindow=${contextWindow ?? "unknown"}, processedUpToAgentRound=${grcState.curator.processedUpToAgentRound}, hasGoalState=${Boolean(grcState.curator.lastGoalState)}, summaryCache=${grcState.curator.summaryCache.length})`,
        );
        return { messages };
      }

      logger?.debug(
        `Context optimization no-op (strategy=${strategy}, keepRecentAgentRounds=${config.grc.keepRecentAgentRounds}, maxContextPercent=${config.grc.maxContextPercent}, contextWindow=${contextWindow ?? "unknown"}, hasGoalState=${Boolean(grcState.curator.lastGoalState)}, summaryCache=${grcState.curator.summaryCache.length})`,
      );
      return;
    } catch (err) {
      logger?.error("Context optimization failed:", err);
      return;
    }
  });

  // ===========================================================================
  // Agent Start
  // ===========================================================================

  pi.on("agent_start", async (_event, ctx) => {
    currentRun = {
      active: true,
      startedAt: Date.now(),
      turnCount: 0,
      stuckReflectorTriggered: false,
      stuckReflectorDelivered: false,
    };

    if (grcState) {
      grcState = startAgentRound(grcState);
      appendAgentRoundBoundary(pi);
      logger?.debug(
        `Agent round started (currentAgentRound=${grcState.currentAgentRound}, totalCompleted=${grcState.totalAgentRounds})`,
      );
    } else {
      logger?.debug("Run started without GRC state");
    }

    refreshWidget(ctx);
  });

  // ===========================================================================
  // Turn End (Context Tracking)
  // ===========================================================================

  pi.on("turn_end", async (event, ctx) => {
    if (!config) {
      return;
    }

    try {
      updateOrchestrationSuspension(ctx);
      if (currentRun.active) {
        currentRun.turnCount += 1;
      }
      if (grcState) {
        grcState = incrementTurnRound(grcState);
      }

      logger?.debug(
        `turn_end received (trackerEnabled=${config.tracking.enabled}, suspended=${orchestrationSuspended}, agentRound=${grcState?.currentAgentRound ?? "n/a"}, turnRound=${grcState?.currentTurnRound ?? "n/a"}, runTurn=${currentRun.active ? currentRun.turnCount : "n/a"})`,
      );

      if (isRuntimeEnabled() && config.tracking.enabled && tracker) {
        tracker.onTurnEnd(event as Parameters<typeof tracker.onTurnEnd>[0], ctx);

        // Persist tracker state every 5 user turns
        const state = tracker.getState();
        if (state.turnCount > 0 && state.turnCount % 5 === 0) {
          pi.appendEntry("passto-context-state", state);
          logger?.debug(`Persisted tracker state at userTurn ${state.turnCount}`);
        }
      }

      refreshWidget(ctx);

      if (
        isRuntimeEnabled()
        && currentRun.active
        && !currentRun.stuckReflectorTriggered
        && currentRun.turnCount >= config.grc.midRunTurnThreshold
        && !reflectorPromise
        && !orchestrationSuspended
      ) {
        currentRun.stuckReflectorTriggered = true;
        startMidRunReflector(ctx);
      }
    } catch (err) {
      logger?.error("Turn tracking failed:", err);
    }
  });

  // ===========================================================================
  // Agent End
  // ===========================================================================

  pi.on("agent_end", async (event, ctx) => {
    if (!config) {
      return;
    }

    try {
      updateOrchestrationSuspension(ctx);

      if (isRuntimeEnabled() && config.tracking.enabled && tracker) {
        tracker.onAgentEnd(event as Parameters<typeof tracker.onAgentEnd>[0], ctx);
      }

      currentRun = createInitialCurrentRunState();

      if (grcState) {
        grcState = finishAgentRound(grcState);
        const currentUserTurns = getCurrentUserTurnCount();
        logger?.debug(
          `agent_end received (completedAgentRounds=${grcState.totalAgentRounds}, currentAgentRound=${grcState.currentAgentRound}, userTurns=${currentUserTurns}, mode=${grcState.mode}, runtimeMode=${grcState.runtimeMode}, suspended=${orchestrationSuspended})`,
        );

        const autoAllowed = isGRCAutoProcessingAllowed();
        const processingEnabled = isRuntimeEnabled() && config.grc.enabled;

        if (!autoAllowed) {
          logger?.debug(`Skipped post-round jobs due to orchestrator guard: ${orchestrationReason || "unknown"}`);
          refreshWidget(ctx);
        } else if (!processingEnabled) {
          logger?.debug(
            `Skipped post-round jobs (grcEnabled=${config.grc.enabled}, runtimeMode=${grcState.runtimeMode})`,
          );
        } else {
          if (grcState.mode !== "grc") {
            grcState = {
              ...grcState,
              mode: "grc",
              activatedAtTurn: grcState.activatedAtTurn ?? grcState.totalAgentRounds,
            };
          }

          const targets = getPostRoundTargets(grcState, config.grc);
          logger?.debug(
            `Post-round jobs scheduled (targets=${targets}, completedAgentRounds=${grcState.totalAgentRounds})`,
          );
          startGRCBackgroundJobs(ctx, targets);
          setTransientGRCStatus(ctx, "已启动 post-round Reflector");
        }

        if (grcState.totalAgentRounds > 0 && grcState.totalAgentRounds % 5 === 0) {
          pi.appendEntry("grc-state", serializeGRCState(grcState));
          logger?.debug(`Persisted GRC state at totalAgentRounds=${grcState.totalAgentRounds}`);
        }
      }

      refreshWidget(ctx);
    } catch (err) {
      logger?.error("Agent end processing failed:", err);
    }
  });

  // ===========================================================================
  // Session Shutdown (Cleanup)
  // ===========================================================================

  pi.on("session_shutdown", async (_event, _ctx) => {
    sessionActive = false;
    sessionGeneration += 1;
    try {
      await waitForBackgroundJobs(1500, logger);

      if (grcState) {
        grcState = clearRunningSubagentStatuses(grcState);
      }
      reflectorStartedAt = null;
      curatorStartedAt = null;
      syncWidgetTicker();

      // Persist final state
      if (tracker) {
        pi.appendEntry("passto-context-state", tracker.getState());
        logger?.debug("Persisted passto-context-state during shutdown");
      }
      if (grcState) {
        pi.appendEntry("grc-state", serializeGRCState(grcState));
        logger?.debug("Persisted grc-state during shutdown");
      }

      // Cleanup old memories
      if (memory && config?.memory.enabled) {
        try {
          const removed = await memory.cleanup(config.memory.maxMemoryAgeDays, config.memory.maxMemoryFiles);
          if (removed > 0) {
            logger?.info(`Cleaned up ${removed} expired memories`);
          }
        } catch (err) {
          logger?.error("Memory cleanup failed:", err);
        }
      }

      if (principles && config) {
        try {
          const removed = await principles.prune(config.grc.maxPrinciples);
          if (removed > 0) {
            logger?.info(`Pruned ${removed} overflow principles during shutdown`);
          }
        } catch (err) {
          logger?.error("Principles cleanup failed:", err);
        }
      }

      logger?.info("PasstoContext shutdown");
      await logger?.flush?.();
      resetModuleState();
    } catch (err) {
      resetModuleState();
      console.error("[PasstoContext] Shutdown error:", err);
    }
  });

  // ===========================================================================
  // Commands
  // ===========================================================================

  /**
   * /ptc - PasstoContext minimal control surface
   */
  pi.registerCommand("ptc", {
    description: "PasstoContext 控制台：status / on / off / config",
    handler: async (args, ctx) => {
      const input = args?.trim() ?? "";
      if (!input) {
        handlePTCStatus(ctx);
        return;
      }

      const parts = input.split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();

      switch (subcommand) {
        case "status":
          handlePTCStatus(ctx);
          return;
        case "on":
          await handlePTCOn(ctx);
          return;
        case "off":
          await handlePTCOff(ctx);
          return;
        case "config":
          await handlePTCConfig(ctx);
          return;
        default:
          ctx.ui.notify("Usage: /ptc [status|on|off|config]", "warning");
      }
    },
  });

  // ===========================================================================
  // Command Handlers
  // ===========================================================================

  function handlePTCStatus(ctx: ExtensionCommandContext): void {
    if (!config || !grcState) {
      ctx.ui.notify("PasstoContext not initialized", "warning");
      return;
    }

    const principleCount = principles?.count() ?? 0;
    const currentUsage = ctx.getContextUsage();
    const summaryCacheRounds = grcState.curator.summaryCache.map((entry) => entry.agentRound);
    const latestSummaryEntry = grcState.curator.lastSummaryEntry;
    const latestArtifactRound = latestSummaryEntry?.agentRound ?? grcState.curator.lastGoalState?.agentRound ?? null;
    const state = tracker?.getState() ?? null;

    const contextUsageLabel = currentUsage?.tokens != null
      ? `${currentUsage.tokens.toLocaleString()} / ${currentUsage.contextWindow.toLocaleString()}${currentUsage.percent != null ? ` (${Math.round(currentUsage.percent)}%)` : ""}`
      : null;

    const text = formatPTCStatus({
      sessionDisplayName,
      configFileLabel: terminalFileLink(getConfigFilePath()),
      runtimeModeLabel: grcState.runtimeMode,
      memoryEnabled: config.memory.enabled,
      trackingEnabled: config.tracking.enabled,
      widgetEnabled: config.tracking.showWidget,
      grcEnabled: config.grc.enabled,
      currentMode: grcState.mode,
      currentAgentRound: grcState.currentAgentRound,
      currentTurnRound: grcState.currentTurnRound,
      reflectorStatus: grcState.reflector.status,
      lastReflectedAgentRound: grcState.reflector.lastReflectedAgentRound,
      curatorStatus: grcState.curator.status,
      lastCuratedAgentRound: grcState.curator.lastCuratedAgentRound,
      summaryCacheRounds,
      lastSignalLabel: grcState.curator.lastSignal
        ? `${grcState.curator.lastSignal.type} (confidence=${grcState.curator.lastSignal.confidence})`
        : "none",
      latestCuratorArtifactRound: latestArtifactRound,
      principlesStored: principleCount,
      orchestratorGuardLabel: orchestrationSuspended ? `suspended (${orchestrationReason})` : "active",
      contextUsageLabel,
      sessionTurnCount: state?.turnCount ?? 0,
      filesModifiedCount: state?.filesModified.length ?? 0,
      latestReflectorAdvice: grcState.reflector.lastAdvice,
      latestCuratorSummary: grcState.curator.lastSummary,
      goalStateSnapshot: grcState.curator.lastGoalState
        ? {
            active: grcState.curator.lastGoalState.active.length,
            completed: grcState.curator.lastGoalState.completed.length,
            migrations: grcState.curator.lastGoalState.migrations.length,
            pruned: grcState.curator.lastGoalState.prunedCount,
            updatedRound: grcState.curator.lastGoalState.agentRound,
          }
        : null,
    });

    ctx.ui.notify(text, "info");
  }

  async function handlePTCOn(ctx: ExtensionCommandContext): Promise<void> {
    if (!grcState || !config) {
      ctx.ui.notify("PasstoContext not initialized", "warning");
      return;
    }

    updateOrchestrationSuspension(ctx);
    grcState = setRuntimeMode(grcState, "on");
    pi.appendEntry("grc-state", serializeGRCState(grcState));
    refreshWidget(ctx);

    if (orchestrationSuspended) {
      setTransientGRCStatus(ctx, "检测到编排流程，PTC 已让行");
      ctx.ui.notify(`PasstoContext 已开启，但当前检测到外部编排流程：${orchestrationReason}`, "info");
      return;
    }

    if (!reflectorPromise && !curatorPromise && config.grc.enabled) {
      startGRCBackgroundJobs(ctx, getPostRoundTargets(grcState, config.grc));
    }

    setTransientGRCStatus(ctx, "PTC 已开启");
    ctx.ui.notify("PasstoContext 已开启。运行时功能将按配置文件生效。", "info");
  }

  async function handlePTCOff(ctx: ExtensionCommandContext): Promise<void> {
    if (!grcState) {
      ctx.ui.notify("PasstoContext not initialized", "warning");
      return;
    }

    grcState = setRuntimeMode(grcState, "off");
    reflectorStartedAt = null;
    curatorStartedAt = null;
    widgetNotice = null;
    pi.appendEntry("grc-state", serializeGRCState(grcState));
    refreshWidget(ctx);
    ctx.ui.notify("PasstoContext 已关闭。memory 注入、GRC、context 优化、自定义 compaction 与后台任务均已停用。", "info");
  }

  async function handlePTCConfig(ctx: ExtensionCommandContext): Promise<void> {
    if (!config) {
      ctx.ui.notify("PasstoContext not initialized", "warning");
      return;
    }

    const configPath = getConfigFilePath();
    const result = await openConfigInSystemEditor(configPath);
    if (result.ok) {
      ctx.ui.notify("已打开 PasstoContext 配置文件。", "info");
      return;
    }

    ctx.ui.notify(`打开配置文件失败：${result.reason}\n${terminalFileLink(configPath)}`, "error");
  }
}
