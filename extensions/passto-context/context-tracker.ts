/**
 * PasstoContext Context Tracker
 * Tracks session state: turns, tokens, files modified, tools used, etc.
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { AgentEndEvent, TurnEndEvent } from "@mariozechner/pi-coding-agent";
import type { SessionState, TrackingConfig } from "./types.js";
import type { Logger } from "./types.js";

// Pi Message types (from @mariozechner/pi-ai and @mariozechner/pi-agent-core)
interface PiMessage {
  role?: string;
  content: Array<{ type?: string; text?: string; name?: string; id?: string; arguments?: string | Record<string, unknown>; source?: unknown }>;
  toolName?: string;
  toolCallId?: string;
  thinking?: string;
  errorMessage?: string;
  stopReason?: string;
  model?: string;
  usage?: { input?: number; output?: number; cacheRead?: number; cacheWrite?: number; totalTokens?: number; cost?: { total: number } };
}

// =============================================================================
// State Management
// =============================================================================

/**
 * Create a fresh session state
 */
function createInitialState(): SessionState {
  return {
    turnCount: 0,
    tokenUsage: null,
    filesModified: [],
    toolsUsed: {},
    keyDecisions: [],
    errors: [],
    startTime: Date.now(),
  };
}

// =============================================================================
// Key Decision Extraction
// =============================================================================

/**
 * Keywords that indicate a decision was made
 */
const DECISION_KEYWORDS = [
  // English
  "decided", "decision", "choose", "chose", "selected", "option",
  "adopted", "implemented", "using", "going with", "went with",
  "decided to", "agreed to", "will use", "opted for",
  // Chinese
  "决定", "采用", "选择", "使用", "实现", "采纳",
  "已决定", "已采用", "已选择",
];

function containsDecision(text: string): boolean {
  const lower = text.toLowerCase();
  return DECISION_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function extractDecisionsFromThinking(thinking: string | undefined): string[] {
  if (!thinking) return [];
  const decisions: string[] = [];
  const lines = thinking.split("\n");

  for (const line of lines) {
    if (containsDecision(line) && line.trim().length > 20 && line.trim().length < 300) {
      decisions.push(line.trim());
    }
  }

  return decisions.slice(0, 10); // Keep at most 10 decisions
}

// =============================================================================
// File Extraction
// =============================================================================

function extractPath(args: Record<string, unknown> | string | undefined): string | null {
  if (!args) return null;

  let obj: Record<string, unknown>;
  if (typeof args === "string") {
    try {
      obj = JSON.parse(args);
    } catch {
      return null;
    }
  } else {
    obj = args;
  }

  // Check common path fields
  return (
    (obj["path"] as string) ||
    (obj["file_path"] as string) ||
    (obj["filePath"] as string) ||
    (obj["target"] as string) ||
    null
  );
}

/**
 * Extract file paths from tool results
 */
function extractFilesFromToolResults(toolResults: PiMessage[]): string[] {
  const files: string[] = [];
  const fileTools = new Set(["write", "edit", "delete", "move"]);

  for (const msg of toolResults) {
    if (msg.role !== "toolResult") continue;
    if (!msg.toolName || !fileTools.has(msg.toolName)) continue;

    let args: Record<string, unknown> | string | undefined;
    if (typeof msg.content[0] === "object" && msg.content[0] !== null) {
      const block = msg.content[0] as Record<string, unknown>;
      args = block.arguments as Record<string, unknown>;
    }

    const path = extractPath(args);
    if (path && !files.includes(path)) {
      files.push(path);
    }
  }

  return files;
}

// =============================================================================
// Error Extraction
// =============================================================================

/**
 * Extract error messages from tool results
 */
function extractErrorsFromToolResults(toolResults: PiMessage[]): string[] {
  const errors: string[] = [];

  for (const msg of toolResults) {
    if (msg.role !== "toolResult") continue;

    // Check if this is an error result
    if (msg.errorMessage) {
      errors.push(msg.errorMessage.slice(0, 200));
      continue;
    }

    // Check content for error indicators
    for (const block of msg.content) {
      if (typeof block === "object" && block !== null) {
        const b = block as Record<string, unknown>;
        if (b.type === "text" && typeof b.text === "string") {
          const text = b.text.toLowerCase();
          if (
            text.includes("error:") ||
            text.includes("exception:") ||
            text.includes("failed:") ||
            text.includes("cannot") ||
            text.includes("ENOENT") ||
            text.includes("SyntaxError") ||
            text.includes("ReferenceError")
          ) {
            const trimmed = b.text.trim().slice(0, 200);
            if (!errors.includes(trimmed)) {
              errors.push(trimmed);
            }
          }
        }
      }
    }
  }

  return errors;
}

// =============================================================================
// Context Tracker
// =============================================================================

export interface ContextTracker {
  onTurnEnd(event: TurnEndEvent, ctx: ExtensionContext): void;
  onAgentEnd(event: AgentEndEvent, ctx: ExtensionContext): void;
  getState(): SessionState;
  reset(): void;
  restore(state: SessionState): void;
  formatStatus(): string;
  formatForInjection(): string;
}

export function createContextTracker(config: TrackingConfig, logger: Logger): ContextTracker {
  let state: SessionState = createInitialState();

  return {
    /**
     * Handle turn_end event
     */
    onTurnEnd(event: TurnEndEvent, _ctx: ExtensionContext) {
      if (!config.enabled) return;

      state.turnCount++;

      // Extract assistant message
      const assistantMsg = event.message as PiMessage | undefined;
      if (!assistantMsg) return;

      // Extract thinking for decisions
      if (assistantMsg.thinking) {
        const decisions = extractDecisionsFromThinking(assistantMsg.thinking);
        for (const d of decisions) {
          if (!state.keyDecisions.includes(d)) {
            state.keyDecisions.push(d);
          }
        }
        // Keep only last 20 decisions
        if (state.keyDecisions.length > 20) {
          state.keyDecisions = state.keyDecisions.slice(-20);
        }
      }

      // Extract tool usage and files from tool results
      if (event.toolResults) {
        for (const tr of event.toolResults) {
          const toolMsg = tr as PiMessage;
          if (toolMsg.toolName) {
            state.toolsUsed[toolMsg.toolName] = (state.toolsUsed[toolMsg.toolName] || 0) + 1;
          }
        }

        const newFiles = extractFilesFromToolResults(event.toolResults as PiMessage[]);
        for (const f of newFiles) {
          if (!state.filesModified.includes(f)) {
            state.filesModified.push(f);
          }
        }

        const newErrors = extractErrorsFromToolResults(event.toolResults as PiMessage[]);
        for (const e of newErrors) {
          if (!state.errors.includes(e)) {
            state.errors.push(e);
          }
        }
        // Keep only last 10 errors
        if (state.errors.length > 10) {
          state.errors = state.errors.slice(-10);
        }
      }

      logger.debug(
        `Turn ${state.turnCount}: ${Object.keys(state.toolsUsed).length} tools, ${state.filesModified.length} files`,
      );
    },

    /**
     * Handle agent_end event
     */
    onAgentEnd(_event: AgentEndEvent, ctx: ExtensionContext) {
      if (!config.enabled) return;

      // Update token usage from context
      try {
        const usage = ctx.getContextUsage?.();
        if (usage) {
          state.tokenUsage = {
            current: usage.tokens,
            limit: usage.limit ?? 200000,
          };
        }
      } catch {
        // getContextUsage may not be available in all contexts
      }
    },

    /**
     * Get current state
     */
    getState(): SessionState {
      return { ...state };
    },

    /**
     * Reset state for a new session
     */
    reset() {
      state = createInitialState();
      logger.debug("Session state reset");
    },

    /**
     * Restore state from persisted data
     */
    restore(persistedState: SessionState) {
      // Don't restore turn count (start fresh in new session)
      // But keep files modified and decisions as context
      state.filesModified = persistedState.filesModified || [];
      state.keyDecisions = persistedState.keyDecisions || [];
      state.errors = persistedState.errors || [];
      logger.debug(`Restored ${state.filesModified.length} files, ${state.keyDecisions.length} decisions`);
    },

    /**
     * Format state as a compact status line for widget
     */
    formatStatus(): string {
      const parts: string[] = [];

      parts.push(`T:${state.turnCount}`);

      if (state.tokenUsage) {
        const pct = Math.round((state.tokenUsage.current / state.tokenUsage.limit) * 100);
        parts.push(`${pct}%`);
      }

      if (state.filesModified.length > 0) {
        parts.push(`📝${state.filesModified.length}`);
      }

      if (state.errors.length > 0) {
        parts.push(`⚠️${state.errors.length}`);
      }

      const elapsed = Math.round((Date.now() - state.startTime) / 60000);
      parts.push(`⏱${elapsed}m`);

      return parts.join(" | ");
    },

    /**
     * Format state as context text for LLM injection
     */
    formatForInjection(): string {
      const lines: string[] = [];

      lines.push("## Current Session Context");

      if (state.turnCount > 0) {
        lines.push(`- **Turns**: ${state.turnCount}`);
      }

      if (state.tokenUsage) {
        lines.push(
          `- **Token usage**: ${state.tokenUsage.current.toLocaleString()} / ${state.tokenUsage.limit.toLocaleString()}`,
        );
      }

      if (state.filesModified.length > 0) {
        lines.push(`- **Files modified** (${state.filesModified.length}):`);
        for (const f of state.filesModified.slice(-20)) {
          lines.push(`  - ${f}`);
        }
      }

      if (Object.keys(state.toolsUsed).length > 0) {
        lines.push("- **Tools used**:");
        for (const [tool, count] of Object.entries(state.toolsUsed).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
          lines.push(`  - ${tool}: ${count}x`);
        }
      }

      if (state.keyDecisions.length > 0) {
        lines.push("- **Key decisions made**:");
        for (const d of state.keyDecisions.slice(-5)) {
          const truncated = d.length > 100 ? d.slice(0, 100) + "..." : d;
          lines.push(`  - ${truncated}`);
        }
      }

      if (state.errors.length > 0) {
        lines.push("- **Errors encountered**:");
        for (const e of state.errors.slice(-3)) {
          const truncated = e.length > 100 ? e.slice(0, 100) + "..." : e;
          lines.push(`  - ${truncated}`);
        }
      }

      const elapsed = Math.round((Date.now() - state.startTime) / 60000);
      lines.push(`- **Session duration**: ${elapsed} minutes`);

      return lines.join("\n");
    },
  };
}
