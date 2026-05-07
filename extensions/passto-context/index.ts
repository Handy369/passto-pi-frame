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
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ensureConfigExists } from "./config.js";
import { createCompactionHandler } from "./compaction.js";
import { createMemoryManager } from "./memory.js";
import { createContextTracker } from "./context-tracker.js";
import { createLogger, expandHome, getSessionDisplayName } from "./utils.js";
import {
  clearRunningSubagentStatuses,
  createInitialGRCState,
  forceActivateGRC,
  incrementTurn,
  markGRCTriggered,
  restoreGRCState,
  serializeGRCState,
  setGRCManualMode,
  shouldTriggerGRC,
  shouldTriggerNextCycle,
  transitionToGRC,
  updateCuratorStatus,
  updateReflectorStatus,
} from "./grc-state.js";
import { buildBaseGRCPrompt, buildReflectionSteerPrompt, buildReflectorInjection } from "./grc-prompts.js";
import { executeCurator, executeReflector, serializeConversation } from "./grc-subagent.js";
import { createPrinciplesManager, formatPrinciplesForInjection } from "./grc-principles.js";
import { optimizeContextMessages } from "./grc-context-manager.js";
import type { GRCState, PasstoContextConfig, SessionState } from "./types.js";

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

function formatManualModeLabel(grcState: GRCState | null): string {
  switch (grcState?.manualMode) {
    case "forced-on":
      return "forced-on";
    case "forced-off":
      return "forced-off";
    case "auto":
    default:
      return "auto";
  }
}

function formatWidgetStatus(state: SessionState | null, grcState: GRCState | null): string {
  const parts: string[] = [];
  const turnCount = state?.turnCount ?? grcState?.turnCount ?? 0;
  parts.push(`T:${turnCount}`);

  if (state && state.filesModified.length > 0) {
    parts.push(`📝${state.filesModified.length}`);
  }

  const startTime = state?.startTime ?? Date.now();
  const elapsed = Math.round((Date.now() - startTime) / 60000);
  parts.push(`⏱${elapsed}m`);

  if (grcState?.mode === "grc") {
    parts.push(`◆ R:${statusChar(grcState.reflector.status)} C:${statusChar(grcState.curator.status)}`);
  }

  return parts.join(" | ");
}

function setTransientGRCStatus(ctx: ExtensionContext, text: string): void {
  if (!sessionActive) return;

  try {
    if (!ctx.hasUI) return;
    ctx.ui.setStatus("grc", text);
  } catch {
    return;
  }

  setTimeout(() => {
    if (!sessionActive) return;
    try {
      ctx.ui.setStatus("grc", undefined);
    } catch {
      // Ignore UI teardown races during shutdown/reload.
    }
  }, 5000);
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
}

function isMissingAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
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

// =============================================================================
// Default Export
// =============================================================================

export default function (pi: ExtensionAPI) {
  function startGRCBackgroundJobs(ctx: ExtensionContext, targets: "both" | "reflector" | "curator" = "both"): void {
    if (!config || !logger || !grcState || !sessionActive) {
      return;
    }

    const needReflector = targets === "both" || targets === "reflector";
    const needCurator = targets === "both" || targets === "curator";

    if ((needReflector && reflectorPromise) || (needCurator && curatorPromise)) {
      return;
    }

    const generation = sessionGeneration;

    const conversation = serializeConversation(ctx.sessionManager.getBranch(), {
      maxTokens: 16000,
      preserveFirstUserMessage: true,
      preserveRecentTurns: config.grc.curatorKeepRecentTurns,
      includeToolResults: true,
      toolResultMaxChars: 1000,
    });

    if (!conversation.trim()) {
      logger.warn("Skipped GRC background jobs: empty serialized conversation");
      return;
    }

    if (needReflector) {
      grcState = updateReflectorStatus(grcState, "running");
      reflectorPromise = executeReflector(conversation, ctx, config.grc, logger)
        .then((result) => {
          if (!grcState || !sessionActive || generation !== sessionGeneration) return;
          if (!result || !result.hasSubstantiveContent) {
            grcState = updateReflectorStatus(grcState, "done", null, grcState.turnCount);
            logger?.info("Reflector finished (no substantive advice)");
            return;
          }
          grcState = updateReflectorStatus(grcState, "done", result.advice, grcState.turnCount);
          logger?.info("Reflector finished");
          setTransientGRCStatus(ctx, "◆ Reflector ready");
        })
        .catch((err) => {
          if (!grcState || generation !== sessionGeneration) return;
          grcState = updateReflectorStatus(grcState, "failed");
          logger?.warn("Reflector failed:", err);
          if (isMissingAuthError(err)) {
            logger?.warn("Reflector disabled for this cycle due to missing model auth/config");
            void safeNotify(ctx, "Reflector 不可用：缺少模型配置或 API Key，本轮已跳过。", "warning");
          }
        })
        .finally(() => {
          reflectorPromise = null;
        });
    }

    if (needCurator) {
      grcState = updateCuratorStatus(grcState, "running");
      curatorPromise = executeCurator(conversation, ctx, config.grc, logger)
        .then((result) => {
          if (!grcState || !sessionActive || generation !== sessionGeneration) return;
          if (!result) {
            grcState = updateCuratorStatus(grcState, "done", null, grcState.turnCount, 0);
            return;
          }
          grcState = updateCuratorStatus(
            grcState,
            "done",
            result.summary,
            grcState.turnCount,
            result.principles.length,
          );
          logger?.info("Curator finished");

          if (principles && result.principles.length > 0) {
            void principles
              .addMany(result.principles, {
                source: `${sessionDisplayName}-turn-${grcState.turnCount}`,
                maxCount: config.grc.maxPrinciples,
              })
              .then((savedCount) => {
                if (savedCount > 0) {
                  logger?.info(`Saved ${savedCount} principles`);
                }
              })
              .catch((err) => {
                logger?.warn("Failed to save principles:", err);
              });
          }

          setTransientGRCStatus(ctx, `◆ Curator ready (${result.principles.length} principles)`);
        })
        .catch((err) => {
          if (!grcState || generation !== sessionGeneration) return;
          grcState = updateCuratorStatus(grcState, "failed");
          logger?.warn("Curator failed:", err);
          if (isMissingAuthError(err)) {
            logger?.warn("Curator disabled for this cycle due to missing model auth/config");
            void safeNotify(ctx, "Curator 不可用：缺少模型配置或 API Key，本轮已跳过。", "warning");
          }
        })
        .finally(() => {
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
      logger = createLogger(config.logLevel);

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
      }

      // Ensure GRC directories exist
      await fsMkdirSafe(expandHome(config.grc.principlesDir));
      await principles.load(expandHome(config.grc.principlesDir));
      const pruned = await principles.prune(config.grc.maxPrinciples);
      if (pruned > 0) {
        logger?.info(`Pruned ${pruned} overflow principles during session start`);
      }

      if (grcState) {
        grcState = clearRunningSubagentStatuses(grcState);
      }

      logger?.info("PasstoContext loaded");
      logger?.debug("GRC state initialized:", grcState);

      // Notify user
      if (ctx.hasUI) {
        ctx.ui.notify("PasstoContext ready", "info");
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
    if (!config?.compaction.enabled || !compaction) {
      return; // Let Pi use default compaction
    }

    try {
      const curatorSummary =
        config.grc.enabled &&
        grcState?.manualMode !== "forced-off" &&
        grcState?.mode === "grc" &&
        grcState.curator.status === "done" &&
        grcState.curator.lastSummary
          ? grcState.curator.lastSummary
          : undefined;

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

  pi.on("before_agent_start", async (event, _ctx) => {
    if (!config) {
      return;
    }

    try {
      let systemPrompt = event.systemPrompt;

      const grcPromptEnabled = config.grc.enabled && grcState?.manualMode !== "forced-off";
      if (grcPromptEnabled) {
        systemPrompt += `\n\n${buildBaseGRCPrompt()}`;
      }

      if (grcState?.mode === "grc" && grcState.reflector.status === "done" && grcState.reflector.lastAdvice) {
        const reflectorInjection = buildReflectorInjection(grcState.reflector.lastAdvice);
        if (reflectorInjection) {
          systemPrompt += `\n${reflectorInjection}`;
        }
      }

      if (grcPromptEnabled && principles && config.grc.maxPrinciplesInjection > 0) {
        const relevantPrinciples = principles.search(event.prompt, config.grc.maxPrinciplesInjection);
        if (relevantPrinciples.length > 0) {
          const injection = formatPrinciplesForInjection(relevantPrinciples);
          if (injection) {
            systemPrompt += `\n\n${injection}`;
            logger?.debug(`Injected ${relevantPrinciples.length} principles (${injection.length} chars)`);
            void principles.markUsed(relevantPrinciples).catch((err) => {
              logger?.warn("Failed to update principle usage:", err);
            });
          }
        }
      }

      if (config.memory.enabled && memory) {
        const memories = memory.search(event.prompt, 5);
        if (memories.length > 0) {
          const injection = memory.formatForInjection(memories, config.memory.maxInjectionTokens);
          if (injection) {
            systemPrompt += `\n\n${injection}`;
            logger?.debug(`Injected ${memories.length} memories (${injection.length} chars)`);
          }
        }
      }

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

  pi.on("context", async (event, _ctx) => {
    if (!config || !grcState) {
      return;
    }

    try {
      if (grcState.manualMode === "forced-off") {
        return;
      }

      if (grcState.curator.processedUpToTurn <= 0) {
        return;
      }

      if (grcState.mode !== "grc" || grcState.curator.status !== "done" || !grcState.curator.lastSummary) {
        return;
      }

      const messages = optimizeContextMessages(event.messages, {
        summary: grcState.curator.lastSummary,
        processedUpToTurn: grcState.curator.processedUpToTurn,
        keepRecentTurns: config.grc.curatorKeepRecentTurns,
      });

      if (messages !== event.messages) {
        logger?.info(
          `Context optimized using curator summary: ${event.messages.length} -> ${messages.length} messages (processedUpToTurn=${grcState.curator.processedUpToTurn}, keepRecentTurns=${config.grc.curatorKeepRecentTurns})`,
        );
        return { messages };
      }
      return;
    } catch (err) {
      logger?.error("Context optimization failed:", err);
      return;
    }
  });

  // ===========================================================================
  // Turn End (Context Tracking)
  // ===========================================================================

  pi.on("turn_end", async (event, ctx) => {
    if (!config) {
      return;
    }

    try {
      if (config.tracking.enabled && tracker) {
        tracker.onTurnEnd(event as Parameters<typeof tracker.onTurnEnd>[0], ctx);

        // Update widget if enabled
        if (config.tracking.showWidget && ctx.hasUI) {
          const status = formatWidgetStatus(tracker.getState(), grcState);
          ctx.ui.setWidget("passto-context", [status]);
        }

        // Persist tracker state every 5 turns
        const state = tracker.getState();
        if (state.turnCount > 0 && state.turnCount % 5 === 0) {
          pi.appendEntry("passto-context-state", state);
          logger?.debug(`Persisted state at turn ${state.turnCount}`);
        }
      }

      if (grcState) {
        grcState = incrementTurn(grcState);

        if (shouldTriggerGRC(grcState, config.grc)) {
          grcState = transitionToGRC(grcState, grcState.turnCount);
          logger?.info(`GRC activated at turn ${grcState.turnCount}`);

          pi.sendMessage(
            {
              customType: "grc-reflection-steer",
              content: buildReflectionSteerPrompt(),
              display: false,
            },
            { deliverAs: "steer" },
          );

          startGRCBackgroundJobs(ctx);

          setTransientGRCStatus(ctx, "◆ GRC activated");
        } else if (shouldTriggerNextCycle(grcState, config.grc)) {
          grcState = markGRCTriggered(grcState, grcState.turnCount);
          logger?.info(`GRC cycle ${grcState.grcCycleCount} triggered at turn ${grcState.turnCount}`);
          startGRCBackgroundJobs(ctx);
        }

        if (grcState.turnCount > 0 && grcState.turnCount % 5 === 0) {
          pi.appendEntry("grc-state", serializeGRCState(grcState));
          logger?.debug(`Persisted GRC state at turn ${grcState.turnCount}`);
        }
      }
    } catch (err) {
      logger?.error("Turn tracking failed:", err);
    }
  });

  // ===========================================================================
  // Agent End
  // ===========================================================================

  pi.on("agent_end", async (event, ctx) => {
    if (!config?.tracking.enabled || !tracker) {
      return;
    }

    try {
      tracker.onAgentEnd(event as Parameters<typeof tracker.onAgentEnd>[0], ctx);

      // Update widget with final state
      if (config.tracking.showWidget && ctx.hasUI) {
        const status = formatWidgetStatus(tracker.getState(), grcState);
        ctx.ui.setWidget("passto-context", [status]);
      }
    } catch (err) {
      logger?.error("Agent end tracking failed:", err);
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

      // Persist final state
      if (tracker) {
        pi.appendEntry("passto-context-state", tracker.getState());
      }
      if (grcState) {
        pi.appendEntry("grc-state", serializeGRCState(grcState));
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
   * /ctx - Show session status, manage memories
   */
  pi.registerCommand("ctx", {
    description: "PasstoContext: show session status, manage memories",
    handler: async (args, ctx) => {
      // No args → show status
      if (!args || args.trim() === "") {
        return handleCtxStatus(ctx);
      }

      const parts = args.trim().split(/\s+/);
      const subcommand = parts[0]?.toLowerCase();
      const rest = parts.slice(1).join(" ");

      switch (subcommand) {
        case "status":
          return handleCtxStatus(ctx);
        case "save":
          return handleCtxSave(ctx, rest);
        case "search":
          return handleCtxSearch(ctx, rest);
        case "forget":
          return handleCtxForget(ctx, rest);
        case "list":
          return handleCtxList(ctx);
        case "config":
          return handleCtxConfig(ctx);
        case "inject":
          return handleCtxInject(ctx, rest);
        default:
          ctx.ui.notify(
            `Unknown subcommand: ${subcommand}\n\n` +
              "Available: status, save [tag], search <query>, forget <id>, list, config, inject <query>",
            "warning",
          );
      }
    },
  });

  pi.registerCommand("pta", {
    description: "PasstoContext GRC control panel",
    handler: async (args, ctx) => {
      await handlePTACommand(args, ctx);
    },
  });

  pi.registerCommand("PTA", {
    description: "PasstoContext GRC control panel",
    handler: async (args, ctx) => {
      await handlePTACommand(args, ctx);
    },
  });

  // ===========================================================================
  // Command Handlers
  // ===========================================================================

  function handleCtxStatus(ctx: ExtensionCommandContext): void {
    if (!tracker || !config) {
      ctx.ui.notify("PasstoContext not initialized", "warning");
      return;
    }

    const state = tracker.getState();
    let text = `## PasstoContext Status\n\n`;

    text += `- **Session**: \`${sessionDisplayName}\`\n`;
    text += `- **Turns**: ${state.turnCount}\n`;

    if (state.tokenUsage) {
      text += `- **Tokens**: ${state.tokenUsage.current.toLocaleString()}`;
      if (state.tokenUsage.limit) {
        text += ` / ${state.tokenUsage.limit.toLocaleString()}`;
        const pct = Math.round((state.tokenUsage.current / state.tokenUsage.limit) * 100);
        text += ` (${pct}%)`;
      }
      text += "\n";
    }

    text += `- **Files modified**: ${state.filesModified.length}\n`;
    if (state.filesModified.length > 0) {
      for (const f of state.filesModified.slice(-10)) {
        text += `  - \`${f}\`\n`;
      }
    }

    if (Object.keys(state.toolsUsed).length > 0) {
      text += `- **Tools used**: ${Object.entries(state.toolsUsed)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t, c]) => `${t} (${c}x)`)
        .join(", ")}\n`;
    }

    const elapsed = Math.round((Date.now() - state.startTime) / 60000);
    text += `- **Duration**: ${elapsed} minute${elapsed !== 1 ? "s" : ""}\n`;

    if (memory && config.memory.enabled) {
      text += `\n- **Memory items**: ${memory.list().length}\n`;
    }

    ctx.ui.notify(text, "info");
  }

  async function handleCtxSave(ctx: ExtensionCommandContext, tag: string): Promise<void> {
    if (!memory || !config?.memory.enabled) {
      ctx.ui.notify("Memory is disabled", "warning");
      return;
    }

    const tagToUse = tag || "manual";

    // Get current session state as summary
    let summary = "";
    if (tracker) {
      summary = tracker.formatForInjection();
    }

    if (!summary) {
      ctx.ui.notify("No session context to save", "warning");
      return;
    }

    try {
      const id = await memory.save({
        type: "note",
        tags: [tagToUse],
        content: summary,
      });
      ctx.ui.notify(`Memory saved: \`${id}\``, "success");
    } catch (err) {
      ctx.ui.notify(`Failed to save memory: ${err}`, "error");
    }
  }

  function handleCtxSearch(ctx: ExtensionCommandContext, query: string): void {
    if (!memory || !config?.memory.enabled) {
      ctx.ui.notify("Memory is disabled", "warning");
      return;
    }

    if (!query) {
      ctx.ui.notify("Usage: /ctx search <query>", "warning");
      return;
    }

    const results = memory.search(query, 10);

    if (results.length === 0) {
      ctx.ui.notify(`No memories found for: "${query}"`, "info");
      return;
    }

    let text = `## Memory Search: "${query}" (${results.length} results)\n\n`;
    for (const item of results) {
      const scoreStr = item.score !== undefined ? ` (score: ${item.score.toFixed(2)})` : "";
      text += `### ${item.id}${scoreStr}\n`;
      text += `Type: ${item.type} | Tags: ${item.tags.join(", ") || "none"}\n`;
      text += `${item.content.slice(0, 200)}${item.content.length > 200 ? "..." : ""}\n\n`;
    }

    ctx.ui.notify(text, "info");
  }

  async function handleCtxForget(ctx: ExtensionCommandContext, id: string): Promise<void> {
    if (!memory || !config?.memory.enabled) {
      ctx.ui.notify("Memory is disabled", "warning");
      return;
    }

    if (!id) {
      ctx.ui.notify("Usage: /ctx forget <id>", "warning");
      return;
    }

    const ok = await memory.forget(id);
    if (ok) {
      ctx.ui.notify(`Memory deleted: \`${id}\``, "success");
    } else {
      ctx.ui.notify(`Memory not found: \`${id}\``, "warning");
    }
  }

  function handleCtxList(ctx: ExtensionCommandContext): void {
    if (!memory || !config?.memory.enabled) {
      ctx.ui.notify("Memory is disabled", "warning");
      return;
    }

    const all = memory.list();

    if (all.length === 0) {
      ctx.ui.notify("No memories saved yet. Use `/ctx save <tag>` to save the current context.", "info");
      return;
    }

    let text = `## Saved Memories (${all.length})\n\n`;
    for (const item of all.slice(0, 20)) {
      const date = new Date(item.created).toLocaleDateString();
      text += `### ${item.id}\n`;
      text += `Type: ${item.type} | Tags: ${item.tags.join(", ") || "none"} | Date: ${date}\n`;
      text += `${item.content.slice(0, 150)}${item.content.length > 150 ? "..." : ""}\n\n`;
    }

    if (all.length > 20) {
      text += `\n_Showing 20 of ${all.length} memories. Use \`/ctx search\` to find specific ones._`;
    }

    ctx.ui.notify(text, "info");
  }

  function handleCtxConfig(ctx: ExtensionCommandContext): void {
    if (!config) {
      ctx.ui.notify("PasstoContext not initialized", "warning");
      return;
    }

    ctx.ui.notify(`## PasstoContext Config\n\n\`\`\`json\n${JSON.stringify(config, null, 2)}\n\`\`\``, "info");
  }

  async function handleCtxInject(ctx: ExtensionCommandContext, query: string): Promise<void> {
    if (!memory || !config?.memory.enabled) {
      ctx.ui.notify("Memory is disabled", "warning");
      return;
    }

    if (!query) {
      ctx.ui.notify("Usage: /ctx inject <query>", "warning");
      return;
    }

    const results = memory.search(query, 3);
    if (results.length === 0) {
      ctx.ui.notify(`No relevant memories found for: "${query}"`, "info");
      return;
    }

    const injection = memory.formatForInjection(results, config.memory.maxInjectionTokens);

    // Show what would be injected and offer to send as a message
    let preview = `## Would inject:\n\n${injection}\n\n`;
    preview += "Use \`/ctx inject\` from \`before_agent_start\` — injecting directly is not possible from a command.";

    ctx.ui.notify(preview, "info");
  }

  async function handlePTACommand(args: string | undefined, ctx: ExtensionCommandContext): Promise<void> {
    const input = args?.trim() ?? "";
    if (!input) {
      handlePTAStatus(ctx);
      return;
    }

    const parts = input.split(/\s+/);
    const subcommand = parts[0]?.toLowerCase();
    const rest = parts.slice(1).join(" ");

    switch (subcommand) {
      case "status":
        handlePTAStatus(ctx);
        return;
      case "on":
        await handlePTAOn(ctx);
        return;
      case "off":
        await handlePTAOff(ctx);
        return;
      case "reflect":
        await handlePTAReflect(ctx);
        return;
      case "curate":
        await handlePTACurate(ctx);
        return;
      case "principles":
        handlePTAPrinciples(ctx, rest);
        return;
      case "config":
        handlePTAConfig(ctx);
        return;
      default:
        ctx.ui.notify(
          "Usage: /pta [status|on|off|reflect|curate|principles [query]|config]",
          "warning",
        );
    }
  }

  function handlePTAStatus(ctx: ExtensionCommandContext): void {
    if (!config || !grcState) {
      ctx.ui.notify("PasstoContext GRC not initialized", "warning");
      return;
    }

    const trackerState = tracker?.getState();
    const principleCount = principles?.count() ?? 0;
    const currentUsage = ctx.getContextUsage();

    let text = "## PTA / GRC Status\n\n";
    text += `- **Session**: \`${sessionDisplayName}\`\n`;
    text += `- **Enabled**: ${config.grc.enabled ? "yes" : "no"}\n`;
    text += `- **Manual mode**: ${formatManualModeLabel(grcState)}\n`;
    text += `- **Current mode**: ${grcState.mode}\n`;
    text += `- **User turns**: ${trackerState?.turnCount ?? grcState.turnCount}\n`;
    text += `- **GRC turns**: ${grcState.turnCount}\n`;
    text += `- **GRC cycles**: ${grcState.grcCycleCount}\n`;
    text += `- **Activated at turn**: ${grcState.activatedAtTurn ?? "N/A"}\n`;
    text += `- **Last trigger turn**: ${grcState.lastGrcTriggerTurn}\n`;
    text += `- **Reflector**: ${grcState.reflector.status} (processedUpToTurn=${grcState.reflector.processedUpToTurn})\n`;
    text += `- **Curator**: ${grcState.curator.status} (processedUpToTurn=${grcState.curator.processedUpToTurn}, principles=${grcState.curator.principlesExtracted})\n`;
    text += `- **Principles stored**: ${principleCount}\n`;

    if (currentUsage?.tokens != null) {
      text += `- **Context usage**: ${currentUsage.tokens.toLocaleString()} / ${currentUsage.contextWindow.toLocaleString()}`;
      if (currentUsage.percent != null) {
        text += ` (${Math.round(currentUsage.percent)}%)`;
      }
      text += "\n";
    }

    if (grcState.reflector.lastAdvice) {
      text += `\n### Latest Reflector Advice\n${grcState.reflector.lastAdvice}\n`;
    }

    if (grcState.curator.lastSummary) {
      text += `\n### Latest Curator Summary\n${grcState.curator.lastSummary.slice(0, 1200)}`;
      if (grcState.curator.lastSummary.length > 1200) {
        text += "\n...";
      }
      text += "\n";
    }

    ctx.ui.notify(text, "info");
  }

  async function handlePTAOn(ctx: ExtensionCommandContext): Promise<void> {
    if (!grcState) {
      ctx.ui.notify("PasstoContext GRC not initialized", "warning");
      return;
    }

    const wasRunning = grcState.reflector.status === "running" || grcState.curator.status === "running";
    grcState = forceActivateGRC(grcState);
    pi.appendEntry("grc-state", serializeGRCState(grcState));

    if (!wasRunning) {
      pi.sendMessage(
        {
          customType: "grc-reflection-steer",
          content: buildReflectionSteerPrompt(),
          display: false,
        },
        { deliverAs: "steer" },
      );
      startGRCBackgroundJobs(ctx);
    }

    setTransientGRCStatus(ctx, "◆ GRC forced on");
    ctx.ui.notify("GRC 已强制开启。", "info");
  }

  async function handlePTAOff(ctx: ExtensionCommandContext): Promise<void> {
    if (!grcState) {
      ctx.ui.notify("PasstoContext GRC not initialized", "warning");
      return;
    }

    grcState = setGRCManualMode(grcState, "forced-off");
    pi.appendEntry("grc-state", serializeGRCState(grcState));
    setTransientGRCStatus(ctx, "◆ GRC forced off");
    ctx.ui.notify("GRC 已停用。自动触发和周期运行将暂停。", "info");
  }

  async function handlePTAReflect(ctx: ExtensionCommandContext): Promise<void> {
    if (!config || !grcState) {
      ctx.ui.notify("PasstoContext GRC not initialized", "warning");
      return;
    }
    if (reflectorPromise) {
      ctx.ui.notify("Reflector is already running", "warning");
      return;
    }

    if (grcState.mode !== "grc") {
      grcState = forceActivateGRC(grcState);
    }

    grcState = updateReflectorStatus(grcState, "idle");
    startGRCBackgroundJobs(ctx, "reflector");
    ctx.ui.notify("Reflector 已手动触发。", "info");
  }

  async function handlePTACurate(ctx: ExtensionCommandContext): Promise<void> {
    if (!config || !grcState) {
      ctx.ui.notify("PasstoContext GRC not initialized", "warning");
      return;
    }
    if (curatorPromise) {
      ctx.ui.notify("Curator is already running", "warning");
      return;
    }

    if (grcState.mode !== "grc") {
      grcState = forceActivateGRC(grcState);
    }

    grcState = updateCuratorStatus(grcState, "idle");
    startGRCBackgroundJobs(ctx, "curator");
    ctx.ui.notify("Curator 已手动触发。", "info");
  }

  function handlePTAPrinciples(ctx: ExtensionCommandContext, query: string): void {
    if (!principles) {
      ctx.ui.notify("Principles manager not initialized", "warning");
      return;
    }

    const trimmed = query.trim();
    const results = trimmed ? principles.search(trimmed, 10) : principles.list().slice(0, 20);

    if (results.length === 0) {
      ctx.ui.notify(trimmed ? `No principles found for: \"${trimmed}\"` : "No principles stored yet", "info");
      return;
    }

    let text = trimmed
      ? `## Principles Search: \"${trimmed}\" (${results.length})\n\n`
      : `## Principles (${principles.count()})\n\n`;

    for (const item of results) {
      const scoreText = item.score != null ? ` | score=${item.score.toFixed(2)}` : "";
      const hitText = item.metadata.hitCount != null ? ` | hits=${item.metadata.hitCount}` : "";
      text += `### ${item.id}\n`;
      text += `Tags: ${item.tags.join(", ") || "none"}${scoreText}${hitText}\n`;
      text += `${item.content.slice(0, 220)}${item.content.length > 220 ? "..." : ""}\n\n`;
    }

    ctx.ui.notify(text, "info");
  }

  function handlePTAConfig(ctx: ExtensionCommandContext): void {
    if (!config) {
      ctx.ui.notify("PasstoContext not initialized", "warning");
      return;
    }

    ctx.ui.notify(`## PTA / GRC Config\n\n\`\`\`json\n${JSON.stringify(config.grc, null, 2)}\n\`\`\``, "info");
  }
}
