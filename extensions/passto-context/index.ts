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

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { ensureConfigExists } from "./config.js";
import { createCompactionHandler } from "./compaction.js";
import { createMemoryManager } from "./memory.js";
import { createContextTracker } from "./context-tracker.js";
import { createLogger, getSessionDisplayName } from "./utils.js";
import type { PasstoContextConfig } from "./types.js";

// =============================================================================
// Module State (module-level singleton for the extension lifetime)
// =============================================================================

let config: PasstoContextConfig | null = null;
let logger: ReturnType<typeof createLogger> | null = null;
let compaction: ReturnType<typeof createCompactionHandler> | null = null;
let memory: ReturnType<typeof createMemoryManager> | null = null;
let tracker: ReturnType<typeof createContextTracker> | null = null;
let sessionDisplayName = "unknown";

// =============================================================================
// Default Export
// =============================================================================

export default function (pi: ExtensionAPI) {
  // ===========================================================================
  // Session Start
  // ===========================================================================

  pi.on("session_start", async (_event, ctx) => {
    try {
      // Load or create configuration
      config = await ensureConfigExists();
      logger = createLogger(config.logLevel);

      // Initialize modules
      compaction = createCompactionHandler(config.compaction, logger);

      if (config.memory.enabled) {
        memory = createMemoryManager(config.memory, logger);
        // Get session file path for session isolation
        const sessionFile = ctx.sessionManager.getSessionFile();
        sessionDisplayName = getSessionDisplayName(sessionFile);
        await memory.init(sessionFile);
      }

      if (config.tracking.enabled) {
        tracker = createContextTracker(config.tracking, logger);
        tracker.reset();

        // Restore any persisted state from previous session
        for (const entry of ctx.sessionManager.getBranch()) {
          if (entry.type === "custom" && (entry as Record<string, unknown>).customType === "passto-context-state") {
            const data = (entry as Record<string, unknown>).data as Parameters<ReturnType<typeof createContextTracker>["restore"]>[0];
            if (data) {
              tracker.restore(data);
            }
          }
        }
      }

      logger?.info("PasstoContext loaded");

      // Notify user
      if (ctx.hasUI) {
        ctx.ui.notify("PasstoContext ready", "info");
      }
    } catch (err) {
      // Init failure should not break Pi
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
      const result = await compaction.handleCompaction(event, ctx);

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
    if (!config?.memory.enabled || !memory) {
      return;
    }

    try {
      // Search for relevant memories
      const memories = memory.search(event.prompt, 5);

      if (memories.length === 0) {
        return;
      }

      // Format injection text within token budget
      const injection = memory.formatForInjection(memories, config.memory.maxInjectionTokens);

      if (!injection) {
        return;
      }

      // Append to system prompt
      const separator = "\n\n--- Relevant Context from Memory ---\n";
      const newSystemPrompt = event.systemPrompt + separator + injection;

      logger?.debug(`Injected ${memories.length} memories (${injection.length} chars)`);

      return {
        systemPrompt: newSystemPrompt,
      };
    } catch (err) {
      logger?.error("Memory injection failed:", err);
      return;
    }
  });

  // ===========================================================================
  // Turn End (Context Tracking)
  // ===========================================================================

  pi.on("turn_end", async (event, ctx) => {
    if (!config?.tracking.enabled || !tracker) {
      return;
    }

    try {
      tracker.onTurnEnd(event as Parameters<typeof tracker.onTurnEnd>[0], ctx);

      // Update widget if enabled
      if (config.tracking.showWidget && ctx.hasUI) {
        const status = tracker.formatStatus();
        ctx.ui.setWidget("passto-context", [status]);
      }

      // Persist state every 5 turns
      const state = tracker.getState();
      if (state.turnCount > 0 && state.turnCount % 5 === 0) {
        pi.appendEntry("passto-context-state", state);
        logger?.debug(`Persisted state at turn ${state.turnCount}`);
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
        const status = tracker.formatStatus();
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
    try {
      // Persist final state
      if (tracker) {
        pi.appendEntry("passto-context-state", tracker.getState());
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

      logger?.info("PasstoContext shutdown");
    } catch (err) {
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
}
