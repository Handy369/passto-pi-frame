/**
 * PasstoContext Smart Compaction
 * Replaces the default Pi compaction with an AI-powered structured summary
 */

import type { ExtensionContext, SessionBeforeCompactEvent } from "@mariozechner/pi-coding-agent";
import { complete } from "@mariozechner/pi-ai";
import type { CompactionConfig, CompactionResult } from "./types.js";
import type { Logger } from "./types.js";
import { estimateTokens } from "./utils.js";

interface GRCCompactionOptions {
  curatorSummary?: string | null;
}

interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
  strategy?: "llm-summary" | "curator-summary";
}

// =============================================================================
// Compaction Handler
// =============================================================================

export interface CompactionHandler {
  /**
   * Handle the session_before_compact event
   * Returns the custom compaction or undefined to fall back to default
   */
  handleCompaction(
    event: SessionBeforeCompactEvent,
    ctx: ExtensionContext,
    options?: GRCCompactionOptions,
  ): Promise<{ compaction: CompactionResult } | undefined>;
}

export function createCompactionHandler(config: CompactionConfig, logger: Logger): CompactionHandler {
  return {
    async handleCompaction(
      event: SessionBeforeCompactEvent,
      ctx: ExtensionContext,
      options?: GRCCompactionOptions,
    ): Promise<{ compaction: CompactionResult } | undefined> {
      const { preparation, signal } = event;
      const { messagesToSummarize, turnPrefixMessages, previousSummary, tokensBefore, firstKeptEntryId, fileOps } =
        preparation;

      logger.info(
        `Compaction triggered: ${tokensBefore} tokens, ${messagesToSummarize.length} messages to summarize`,
      );

      const details = buildCompactionDetails(fileOps);

      if (options?.curatorSummary?.trim()) {
        logger.info("Using curator summary for compaction");
        return {
          compaction: {
            summary: options.curatorSummary.trim(),
            firstKeptEntryId,
            tokensBefore,
            details: {
              ...details,
              strategy: "curator-summary",
            } satisfies CompactionDetails,
          },
        };
      }

      // Build conversation text
      const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
      const conversationText = buildConversationText(allMessages);

      if (!conversationText.trim()) {
        logger.warn("No conversation text to summarize");
        return undefined;
      }

      // Build summarization prompt
      const summaryPrompt = buildSummaryPrompt(conversationText, previousSummary);

      const availableModels = ctx.modelRegistry.getAvailable();

      // Try primary model first, then fallback
      const models = [
        { provider: config.modelProvider, id: config.model },
        ...(config.fallbackModel && config.fallbackProvider
          ? [{ provider: config.fallbackProvider, id: config.fallbackModel }]
          : []),
      ];

      let lastError: string | null = null;

      for (const { provider, id: modelId } of models) {
        const modelLabel = `${provider}/${modelId}`;
        try {
          if (signal?.aborted) {
            logger.info("Compaction was aborted, falling back to default");
            return undefined;
          }

          // Prefer exact match (provider + id), then fall back to id-only match.
          let model = ctx.modelRegistry.find(provider, modelId);
          if (!model) {
            model = availableModels.find((m) => m.id === modelId || m.name === modelId);
            if (model) {
              logger.warn(
                `Model ${modelLabel} not found, using ${model.provider}/${model.id} (matched by id/name).`,
              );
            }
          }

          if (!model) {
            lastError = `Model ${modelLabel} not found`;
            logger.warn(lastError);
            continue;
          }

          const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
          if (!auth.ok) {
            lastError = `Auth failed for ${model.provider}/${model.id}: ${auth.error}`;
            logger.warn(lastError);
            continue;
          }
          if (!auth.apiKey) {
            lastError = `No API key for ${model.provider}/${model.id}`;
            logger.warn(lastError);
            continue;
          }

          logger.debug(`Calling ${model.provider}/${model.id} for summary (${estimateTokens(summaryPrompt)} tokens)`);

          const response = await complete(
            model,
            {
              messages: [
                {
                  role: "user" as const,
                  content: [{ type: "text" as const, text: summaryPrompt }],
                  timestamp: Date.now(),
                },
              ],
            },
            {
              apiKey: auth.apiKey,
              headers: auth.headers,
              maxTokens: config.maxSummaryTokens,
              signal,
            },
          );

          const summary = response.content
            .filter((c): c is { type: "text"; text: string } => c.type === "text")
            .map((c) => c.text)
            .join("\n")
            .trim();

          if (!summary) {
            lastError = "Empty summary response";
            logger.warn(`${modelLabel}: ${lastError}`);
            continue;
          }

          logger.info(`Compaction summary generated (${summary.length} chars)`);

          return {
            compaction: {
              summary,
              firstKeptEntryId,
              tokensBefore,
              details: {
                ...details,
                strategy: "llm-summary",
              } satisfies CompactionDetails,
            },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          lastError = `LLM call failed for ${modelLabel}: ${msg}`;
          logger.warn(lastError);

          if (signal?.aborted) {
            logger.info("Compaction was aborted, falling back to default");
            return undefined;
          }

          continue;
        }
      }

      logger.error(`All compaction models failed. Last error: ${lastError}. Falling back to default.`);
      return undefined;
    },
  };
}

// =============================================================================
// Prompt Building
// =============================================================================

function buildSummaryPrompt(conversationText: string, previousSummary: string | undefined): string {
  const previousContext = previousSummary
    ? `\n## Previous Session Summary\n\nThe following is a summary of an earlier session. Use it as context for understanding the current conversation.\n\n${previousSummary}\n\n--- End of Previous Summary ---\n`
    : "";

  return `${previousContext}You are a conversation summarizer. Create a structured summary of this conversation that captures all information needed to continue the work effectively.

Output format: Use the exact Markdown structure below. Fill in each section. If a section has no information, write "None" or "N/A".

## Goals
- What is the user trying to accomplish?

## Completed
- Tasks/steps that have been finished (be specific)

## Key Decisions
- Important decisions made and the reasoning behind them

## Files Modified
- List of files changed and what was done to each

## In Progress
- Current work that is not yet complete

## Blockers & Issues
- Any errors encountered, blockers, or open questions

## Next Steps
- What should be done next to continue the work?

<conversation>
${conversationText}
</conversation>`;
}

// =============================================================================
// Conversation Text Builder
// =============================================================================

type ContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
  id?: string;
};

function extractTextFromContent(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as ContentBlock;
    if (b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
    }
  }
  return parts;
}

function extractToolCalls(content: unknown): Array<{ name: string; args: string }> {
  if (!Array.isArray(content)) return [];

  const calls: Array<{ name: string; args: string }> = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as ContentBlock;
    if (b.type === "toolCall" && typeof b.name === "string") {
      let argsStr = "";
      if (typeof b.arguments === "string") {
        argsStr = b.arguments;
      } else if (b.arguments && typeof b.arguments === "object") {
        try {
          argsStr = JSON.stringify(b.arguments);
        } catch {
          argsStr = String(b.arguments);
        }
      }
      calls.push({ name: b.name, args: argsStr });
    }
  }
  return calls;
}

function buildCompactionDetails(fileOps: {
  read?: Set<string>;
  edited?: Set<string>;
  written?: Set<string>;
}): CompactionDetails {
  const modified = new Set<string>();
  for (const file of fileOps.edited ?? []) modified.add(file);
  for (const file of fileOps.written ?? []) modified.add(file);

  const readFiles = Array.from(fileOps.read ?? []).filter((file) => !modified.has(file)).sort();
  const modifiedFiles = Array.from(modified).sort();

  return {
    readFiles,
    modifiedFiles,
  };
}

function buildConversationText(messages: unknown[]): string {
  const sections: string[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;

    const m = msg as Record<string, unknown>;
    const role = String(m.role || "");
    const content = m.content;

    if (role === "user") {
      const texts = extractTextFromContent(content);
      for (const text of texts) {
        if (text.trim()) {
          sections.push(`[User]\n${text.trim()}`);
        }
      }
    } else if (role === "assistant") {
      const lines: string[] = [];

      // Text content
      const texts = extractTextFromContent(content);
      for (const text of texts) {
        if (text.trim()) {
          lines.push(text.trim());
        }
      }

      // Thinking (if present)
      const thinking = m.thinking;
      if (typeof thinking === "string" && thinking.trim()) {
        lines.push(`[Thinking]\n${thinking.trim().slice(0, 500)}`);
      }

      // Tool calls
      const toolCalls = extractToolCalls(content);
      for (const tc of toolCalls) {
        const argsPreview = tc.args.length > 100 ? tc.args.slice(0, 100) + "..." : tc.args;
        lines.push(`[Tool: ${tc.name}]\n${argsPreview}`);
      }

      if (lines.length > 0) {
        sections.push(`[Assistant]\n${lines.join("\n\n")}`);
      }
    } else if (role === "toolResult") {
      const toolName = String(m.toolName || "unknown");
      const texts = extractTextFromContent(content);
      const text = texts.join("\n").trim();
      if (text) {
        const preview = text.length > 200 ? text.slice(0, 200) + "..." : text;
        sections.push(`[Result: ${toolName}]\n${preview}`);
      }
    }
  }

  return sections.join("\n\n");
}
