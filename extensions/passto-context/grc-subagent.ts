/**
 * PasstoContext runtime subagent engine
 * Conversation serialization + Reflector / Curator execution helpers
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  buildCuratorSubagentPrompt,
  buildReflectorSubagentPrompt,
} from "./grc-prompts.ts";
import { ensureGoalTreeDocument } from "./grc-goal-tree.ts";
import { deriveUserGoalTreeFromGoalState } from "./grc-user-goal-tree.ts";
import { parseCuratorOutput } from "./grc-curator-parser.ts";
import { normalizeCuratorResultAgentRound } from "./grc-curator-normalizer.ts";
import { deriveXNodeModelsFromGoalState, selectCurrentXNodeModel } from "./grc-x-node-model.ts";
import { normalizeReflectorAssetCandidates } from "./grc-reflector-assets.ts";
import { normalizeReflectorDiagnosis } from "./grc-reflector-diagnosis.ts";
import type {
  CuratorResult,
  GRCConfig,
  GoalStateAny,
  Logger,
  PrincipleDraft,
  PrincipleItem,
  PrincipleOp,
  ReflectorInput,
  ReflectorResult,
} from "./types.ts";
import { estimateTokens, truncate } from "./utils.ts";

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
  thinking?: string;
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
  input: ReflectorInput,
  ctx: ExtensionContext,
  config: GRCConfig,
  logger: Logger,
  signal?: AbortSignal,
): Promise<ReflectorResult | null> {
  const prompt = buildReflectorSubagentPrompt(input);
  const raw = await executeTextCompletion(prompt, ctx, config, logger, config.maxReflectorTokens, signal);
  if (!raw) return null;
  return parseReflectorOutput(raw);
}

export function normalizeGoalStateForCurator(currentGoalState: GoalStateAny | null): GoalStateAny | null {
  return ensureGoalTreeDocument(currentGoalState);
}

export async function executeCurator(
  previousRoundConversation: string,
  currentUserMessage: string,
  ctx: ExtensionContext,
  config: GRCConfig,
  logger: Logger,
  signal?: AbortSignal,
  currentGoalState: GoalStateAny | null = null,
  currentAgentRound = 0,
): Promise<CuratorResult | null> {
  const normalizedGoalState = normalizeGoalStateForCurator(currentGoalState);
  const userGoalTree = deriveUserGoalTreeFromGoalState(normalizedGoalState);
  const xNodeModels = deriveXNodeModelsFromGoalState(normalizedGoalState, userGoalTree);
  const currentXNodeModel = selectCurrentXNodeModel(userGoalTree, xNodeModels);
  const prompt = buildCuratorSubagentPrompt(
    previousRoundConversation,
    currentUserMessage,
    {
      goalStateJson: normalizedGoalState ? JSON.stringify(normalizedGoalState, null, 2) : "null",
      userGoalTree,
      xNodeModel: currentXNodeModel,
      lastPolicyProjection: currentXNodeModel?.latestPolicyProjection ?? null,
      latestRuntimeProof: currentXNodeModel?.latestRuntimeProof ?? null,
      latestProofSignals: currentXNodeModel?.latestProofSignals ?? null,
    },
    currentAgentRound,
  );
  const raw = await executeTextCompletion(prompt, ctx, config, logger, config.maxCuratorSummaryTokens, signal);
  if (!raw) return null;
  const parsed = parseCuratorOutput(raw);
  if (!parsed) {
    const excerpt = truncate(raw.replace(/\s+/g, ' ').trim(), 2000);
    logger.warn(`Curator parse returned null (agentRound=${currentAgentRound}, rawExcerpt=${JSON.stringify(excerpt)})`);
    return null;
  }
  if (raw.includes('```json') && !/```json\s*[\s\S]*?```\s*$/.test(raw.trim())) {
    logger.warn(`Curator structured payload appears truncated (agentRound=${currentAgentRound}, rawExcerpt=${JSON.stringify(truncate(raw.slice(Math.max(0, raw.lastIndexOf('```json'))).replace(/\s+/g, ' ').trim(), 2000))})`);
  }
  return normalizeCuratorResultAgentRound(parsed, currentAgentRound);
}

export function parseReflectorOutput(raw: string): ReflectorResult | null {
  const text = raw.trim();
  const adviceText = stripTrailingJsonCodeBlock(text).trim();
  const format = detectReflectorFormat(adviceText);
  if (!format) {
    return null;
  }

  const sections = format === "v2"
    ? {
        direction: extractSection(adviceText, "目标对齐判断"),
        blindSpots: extractListSection(adviceText, "偏移归因"),
        risks: extractListSection(adviceText, "原则判断"),
        suggestions: extractListSection(adviceText, "顾问意见"),
      }
    : {
        direction: extractSection(adviceText, "方向评估"),
        blindSpots: extractListSection(adviceText, "盲点"),
        risks: extractListSection(adviceText, "风险"),
        suggestions: extractListSection(adviceText, "建议"),
      };

  const substantiveBlindSpots = sections.blindSpots.filter((item) => !isExplicitEmptyReflectorItem(item));
  const substantiveRisks = sections.risks.filter((item) => !isExplicitEmptyReflectorItem(item));
  const substantiveSuggestions = sections.suggestions.filter((item) => !isExplicitEmptyReflectorItem(item));
  const diagnosis = extractReflectorDiagnosis(text);
  const assetCandidates = extractReflectorAssetCandidates(text);

  const hasSubstantiveContent =
    substantiveSuggestions.length > 0 ||
    substantiveRisks.length > 0 ||
    substantiveBlindSpots.length > 0;

  return {
    advice: adviceText,
    principleOps: extractPrincipleOps(text),
    diagnosis,
    assetCandidates,
    hasSubstantiveContent,
    sections,
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
  const { complete } = await import("@earendil-works/pi-ai");
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

  const text = extractResponseText(response.content);
  if (!text) {
    const blockTypes = Array.isArray(response.content)
      ? response.content.map((block) => (block && typeof block === "object" && "type" in block ? String((block as { type?: unknown }).type ?? "unknown") : "unknown"))
      : [];
    logger.debug(`GRC subagent returned empty text payload (provider=${model.provider}, model=${model.id}, blocks=${JSON.stringify(blockTypes)})`);
  }

  return text;
}

function extractResponseText(content: Array<{ type: string; text?: string; thinking?: string }>): string {
  const textBlocks = content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text.trim())
    .filter(Boolean);

  if (textBlocks.length > 0) {
    return textBlocks.join("\n").trim();
  }

  return content
    .filter((block): block is { type: "thinking"; thinking: string } => block.type === "thinking" && typeof block.thinking === "string")
    .map((block) => block.thinking.trim())
    .filter(Boolean)
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
    if (b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
      continue;
    }
    if (b.type === "thinking" && typeof b.thinking === "string") {
      parts.push(b.thinking);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPrincipleOps(text: string): PrincipleOp[] {
  const parsed = extractTrailingReflectorJson(text);
  if (!parsed || !Array.isArray(parsed.principleOps)) return [];
  return parsed.principleOps.map(parsePrincipleOp).filter((item): item is PrincipleOp => !!item).slice(0, 3);
}

function parsePrincipleOp(raw: unknown): PrincipleOp | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const op = typeof value.op === "string" ? value.op : "";
  const targetId = typeof value.targetId === "string" ? value.targetId.trim() : "";
  const draft = parsePrincipleDraft(value);

  if ((op === "reuse" || op === "hit") && targetId) {
    return { op, targetId };
  }
  if (op === "create" && draft && isValidReflectorCreateContent(draft.content)) {
    return { op, content: draft.content, tags: draft.tags };
  }
  if ((op === "merge" || op === "expand") && targetId && draft) {
    if (op === "expand" && !isValidReflectorExpandContent(draft.content)) {
      return null;
    }
    return { op, targetId, content: draft.content, tags: draft.tags };
  }
  if (op === "conflict" && targetId && draft) {
    return { op, targetId, content: draft.content, tags: draft.tags };
  }
  return null;
}

function parsePrincipleDraft(raw: unknown): PrincipleDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as { content?: unknown; tags?: unknown };
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
}

const APPEND_STYLE_EXPAND_RE = /(?:^|[。；;\n])\s*(新增|补充|延伸)\s*[:：]/;
const CODE_OR_SCENE_SPECIFIC_NAME_PATTERNS = [
  /`[^`]+`/,
  /\b(?:\.\.?\/|\/)[^\s]+/,
  /\b[\w./-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|toml|sh)\b/i,
  /\b[a-z]+(?:[A-Z][a-z0-9]+){1,}\b/,
  /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+){1,}\b/,
  /\b[a-z0-9]+(?:_[a-z0-9]+)+\b/,
];

function isValidReflectorExpandContent(content: string): boolean {
  return !APPEND_STYLE_EXPAND_RE.test(content);
}

function isValidReflectorCreateContent(content: string): boolean {
  return !CODE_OR_SCENE_SPECIFIC_NAME_PATTERNS.some((pattern) => pattern.test(content));
}

function stripTrailingJsonCodeBlock(text: string): string {
  return text.replace(/\n?```json\s*[\s\S]*?```\s*$/, "").trim();
}

function detectReflectorFormat(text: string): "v1" | "v2" | null {
  if (text.includes("## 目标对齐判断") && text.includes("## 顾问意见")) {
    return "v2";
  }
  if (text.includes("## 方向评估") && text.includes("## 建议")) {
    return "v1";
  }
  return null;
}

function extractTrailingReflectorJson(text: string): Record<string, unknown> | null {
  const match = text.match(/```json\s*([\s\S]*?)```\s*$/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim());
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function extractReflectorDiagnosis(text: string) {
  const parsed = extractTrailingReflectorJson(text);
  return normalizeReflectorDiagnosis(parsed?.diagnosis);
}

function extractReflectorAssetCandidates(text: string) {
  const parsed = extractTrailingReflectorJson(text);
  return normalizeReflectorAssetCandidates(parsed?.assetCandidates);
}

function isExplicitEmptyReflectorItem(text: string): boolean {
  const normalized = text.replace(/[。.!！\s]/g, "").toLowerCase();
  return normalized === "无" || normalized === "未发现明显盲点" || normalized === "none";
}
