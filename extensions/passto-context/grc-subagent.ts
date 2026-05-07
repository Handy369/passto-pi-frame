/**
 * PasstoContext GRC Subagent Engine
 * Conversation serialization + Reflector / Curator execution helpers
 */

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { complete } from "@mariozechner/pi-ai";
import {
  buildCuratorSubagentPrompt,
  buildReflectorSubagentPrompt,
} from "./grc-prompts.js";
import type { CuratorResult, GRCConfig, Logger, PrincipleDraft, ReflectorResult } from "./types.js";
import { estimateTokens } from "./utils.js";

interface SerializeConversationOptions {
  maxTokens: number;
  preserveFirstUserMessage: boolean;
  preserveRecentTurns: number;
  includeToolResults: boolean;
  toolResultMaxChars: number;
}

interface AuthInfo {
  apiKey: string;
  headers?: Record<string, string>;
}

type PiContentBlock = {
  type?: string;
  text?: string;
  name?: string;
  arguments?: string | Record<string, unknown>;
};

type SessionLikeMessage = {
  role?: string;
  content?: unknown;
  toolName?: string;
  isError?: boolean;
  summary?: string;
};

export function serializeConversation(branch: Array<{ message?: unknown }>, options: SerializeConversationOptions): string {
  const sections: string[] = [];
  const messages = branch
    .map((entry) => entry.message)
    .filter((message): message is SessionLikeMessage => !!message && typeof message === "object");

  let firstUserIncluded = false;

  for (const message of messages) {
    if (message.role === "user") {
      const text = extractTextFromContent(message.content).join("\n").trim();
      if (!text) continue;

      if (!firstUserIncluded && options.preserveFirstUserMessage) {
        sections.push(`[User]\n${text}`);
        firstUserIncluded = true;
        continue;
      }

      sections.push(`[User]\n${text}`);
      continue;
    }

    if (message.role === "assistant") {
      const text = extractAssistantText(message.content).trim();
      if (text) {
        sections.push(`[Assistant]\n${text}`);
      }

      const toolCalls = extractToolCalls(message.content);
      for (const call of toolCalls) {
        sections.push(`[ToolCall:${call.name}]\n${call.args}`);
      }
      continue;
    }

    if (message.role === "toolResult" && options.includeToolResults) {
      const text = extractTextFromContent(message.content)
        .join("\n")
        .slice(0, options.toolResultMaxChars)
        .trim();
      if (!text) continue;
      sections.push(`[ToolResult:${message.toolName ?? "unknown"}${message.isError ? ":error" : ""}]\n${text}`);
      continue;
    }

    if (message.role === "compactionSummary" && typeof message.summary === "string") {
      sections.push(`[CompactionSummary]\n${message.summary.trim()}`);
    }
  }

  if (sections.length === 0) return "";

  let text = sections.join("\n\n");
  if (estimateTokens(text) <= options.maxTokens) {
    return text;
  }

  const recentSections = options.preserveRecentTurns > 0
    ? sections.slice(-Math.max(options.preserveRecentTurns * 3, options.preserveRecentTurns))
    : sections;

  if (options.preserveFirstUserMessage && sections[0] && recentSections[0] !== sections[0]) {
    text = [sections[0], ...recentSections].join("\n\n");
  } else {
    text = recentSections.join("\n\n");
  }

  while (estimateTokens(text) > options.maxTokens && text.length > 200) {
    text = text.slice(0, Math.max(200, Math.floor(text.length * 0.9)));
  }

  return text;
}

export async function executeReflector(
  conversation: string,
  ctx: ExtensionContext,
  config: GRCConfig,
  logger: Logger,
  signal?: AbortSignal,
): Promise<ReflectorResult | null> {
  const prompt = buildReflectorSubagentPrompt(conversation);
  const raw = await executeTextCompletion(prompt, ctx, config, logger, config.maxReflectorTokens, signal);
  if (!raw) return null;
  return parseReflectorOutput(raw);
}

export async function executeCurator(
  conversation: string,
  ctx: ExtensionContext,
  config: GRCConfig,
  logger: Logger,
  signal?: AbortSignal,
): Promise<CuratorResult | null> {
  const prompt = buildCuratorSubagentPrompt(conversation);
  const raw = await executeTextCompletion(prompt, ctx, config, logger, config.maxCuratorSummaryTokens, signal);
  if (!raw) return null;
  return parseCuratorOutput(raw);
}

export function parseReflectorOutput(raw: string): ReflectorResult | null {
  const text = raw.trim();
  if (!text.includes("## 方向评估") || !text.includes("## 建议")) {
    return null;
  }

  const direction = extractSection(text, "方向评估");
  const blindSpots = extractListSection(text, "盲点");
  const risks = extractListSection(text, "风险");
  const suggestions = extractListSection(text, "建议");

  const substantiveBlindSpots = blindSpots.filter((item) => !isExplicitEmptyReflectorItem(item));
  const substantiveRisks = risks.filter((item) => !isExplicitEmptyReflectorItem(item));
  const substantiveSuggestions = suggestions.filter((item) => !isExplicitEmptyReflectorItem(item));

  const hasSubstantiveContent =
    substantiveSuggestions.length > 0 ||
    substantiveRisks.length > 0 ||
    substantiveBlindSpots.length > 0;

  return {
    advice: text,
    hasSubstantiveContent,
    sections: {
      direction,
      blindSpots,
      risks,
      suggestions,
    },
  };
}

export function parseCuratorOutput(raw: string): CuratorResult | null {
  const text = raw.trim();
  if (!text.includes("## 目标") || !text.includes("## 已完成")) {
    return null;
  }

  return {
    summary: text,
    principles: extractPrinciples(text),
    sections: {
      goal: extractSection(text, "目标"),
      completed: extractListSection(text, "已完成"),
      decisions: extractListSection(text, "关键决策"),
      files: extractListSection(text, "修改的文件"),
      status: extractSection(text, "当前状态"),
      nextSteps: extractListSection(text, "下一步"),
      warnings: extractListSection(text, "注意事项"),
    },
  };
}

async function executeTextCompletion(
  prompt: string,
  ctx: ExtensionContext,
  config: GRCConfig,
  logger: Logger,
  maxTokens: number,
  signal?: AbortSignal,
): Promise<string> {
  const availableModels = ctx.modelRegistry.getAvailable();
  let model = ctx.modelRegistry.find(config.subagentModelProvider, config.subagentModel);

  if (!model) {
    model = availableModels.find((m) => m.id === config.subagentModel || m.name === config.subagentModel);
  }

  if (!model) {
    throw new Error(`GRC model not found: ${config.subagentModelProvider}/${config.subagentModel}`);
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) {
    throw new Error(auth.ok ? `No API key for ${model.provider}/${model.id}` : auth.error);
  }

  logger.debug(`Calling ${model.provider}/${model.id} for GRC subagent (${estimateTokens(prompt)} tokens)`);

  const response = await complete(
    model,
    {
      messages: [
        {
          role: "user" as const,
          content: [{ type: "text" as const, text: prompt }],
          timestamp: Date.now(),
        },
      ],
    },
    {
      apiKey: auth.apiKey,
      headers: auth.headers,
      maxTokens,
      signal,
    },
  );

  return extractResponseText(response.content);
}

function extractResponseText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractTextFromContent(content: unknown): string[] {
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];

  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as PiContentBlock;
    if (b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
    }
  }
  return parts;
}

function extractAssistantText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as PiContentBlock;
    if ((b.type === "text" || b.type === "thinking") && typeof b.text === "string") {
      parts.push(b.text);
    }
  }
  return parts.join("\n");
}

function extractToolCalls(content: unknown): Array<{ name: string; args: string }> {
  if (!Array.isArray(content)) return [];

  const calls: Array<{ name: string; args: string }> = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as PiContentBlock;
    if (b.type !== "toolCall" || typeof b.name !== "string") continue;

    let args = "";
    if (typeof b.arguments === "string") {
      args = b.arguments;
    } else if (b.arguments && typeof b.arguments === "object") {
      try {
        args = JSON.stringify(b.arguments);
      } catch {
        args = String(b.arguments);
      }
    }

    calls.push({ name: b.name, args });
  }
  return calls;
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

function extractPrinciples(text: string): PrincipleDraft[] {
  const matches = text.match(/<!--\s*PRINCIPLE:\s*([\s\S]*?)\s*-->/g) ?? [];

  return matches
    .map((match) => match.replace(/<!--\s*PRINCIPLE:\s*/, "").replace(/\s*-->/, "").trim())
    .map((raw) => parsePrincipleDraft(raw))
    .filter((item): item is PrincipleDraft => !!item)
    .slice(0, 3);
}

function parsePrincipleDraft(raw: string): PrincipleDraft | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as { content?: unknown; tags?: unknown };
    if (typeof parsed.content !== "string" || !parsed.content.trim()) {
      return null;
    }

    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
      : [];

    return {
      content: parsed.content.trim(),
      tags: Array.from(new Set(tags)).slice(0, 4),
    };
  } catch {
    return {
      content: raw.trim(),
      tags: [],
    };
  }
}

function isExplicitEmptyReflectorItem(text: string): boolean {
  const normalized = text.replace(/[。.!！\s]/g, "").toLowerCase();
  return normalized === "无" || normalized === "未发现明显盲点" || normalized === "none";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
