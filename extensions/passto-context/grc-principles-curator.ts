/**
 * PrinciplesCurator
 * Triggered when principles count >= threshold.
 * Semantically merges/prunes principles to target count,
 * then extracts methodology and updates reflector-contract.md.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { GRCConfig, Logger, PrincipleItem, PrincipleOp } from "./types.js";
import { REFLECTOR_CONTRACT_PATH } from "./grc-prompts.js";

export const PRINCIPLES_CURATOR_TRIGGER = 100;
export const PRINCIPLES_CURATOR_TARGET = 50;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildPrinciplesCuratorPrompt(principles: PrincipleItem[]): string {
  return [
    "# 角色",
    "你是原则库治理专家（PrinciplesCurator）。你的任务是对现有原则库进行语义分析、合并重叠原则、淘汰低价值原则，将原则库从当前数量精简到约 50 条，同时提炼出「原则生成方法论」供 Reflector 在后续原则提取时参考。",
    "",
    "# 输入",
    "以下是当前完整原则库（含 id、tags、content、hintCount、activeScore）：",
    "",
    "<principles>",
    JSON.stringify(principles.map((p) => ({
      id: p.id,
      tags: p.tags,
      content: p.content,
      hintCount: p.metadata.hintCount ?? p.metadata.hitCount ?? 0,
      activeScore: p.metadata.activeScore ?? 0,
    })), null, 2),
    "</principles>",
    "",
    "# 任务",
    "",
    "## 任务一：语义治理",
    "对原则库进行以下操作，最终保留约 50 条高质量原则：",
    "1. **merge**：将语义高度重叠（表达同一核心观点）的多条原则合并为一条，保留表达更完整的版本，并合并 tags。",
    "2. **prune**：淘汰以下类型的原则：",
    "   - hintCount = 0 且 activeScore <= 1 的低活跃原则（除非内容独特且通用）",
    "   - 表达某次具体任务步骤而非可复用行为模式的原则",
    "   - 内容超过 200 字且可拆分或精简的原则（精简后保留）",
    "   - 包含项目专属路径、文件名、API 名称等无法跨项目复用的原则",
    "3. **keep**：保留 hintCount 高、activeScore 高、内容通用且表达清晰的原则。",
    "",
    "## 任务二：方法论提炼",
    "基于本次治理过程，提炼出 3-6 条「原则生成方法论」，帮助 Reflector 在后续生成原则时更准确：",
    "- 哪类经验值得沉淀为原则（被多次命中、跨场景复用）",
    "- 哪类经验不应成为原则（一次性步骤、项目专属、过于具体）",
    "- 原则的粒度和表达方式建议",
    "- 如何判断 hit vs expand vs create",
    "",
    "# 输出格式",
    "先输出方法论（Markdown），然后输出 JSON 代码块。",
    "",
    "方法论格式：",
    "### 治理总结",
    "（1-2 句说明本次治理的主要发现）",
    "",
    "### 原则生成指导",
    "- （方法论条目，3-6 条）",
    "",
    "然后输出 JSON：",
    "```json",
    "{",
    "  \"ops\": [",
    "    { \"op\": \"keep\", \"id\": \"principle-xxx\" },",
    "    { \"op\": \"merge\", \"keepId\": \"principle-xxx\", \"dropIds\": [\"principle-yyy\"], \"newContent\": \"...\", \"newTags\": [\"...\"] },",
    "    { \"op\": \"prune\", \"id\": \"principle-xxx\", \"reason\": \"low-activity | redundant | too-specific | oversized\" }",
    "  ]",
    "}",
    "```",
    "",
    "# 约束",
    "- ops 中 keep + merge(保留) 的原则总数应约为 50 条",
    "- 每条 merge 必须指定 keepId（保留哪条）和 dropIds（删除哪些）以及合并后的 newContent 和 newTags",
    "- prune 必须给出 reason",
    "- 不要编造不存在的 id",
    "- 方法论不超过 400 字",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Parse output
// ---------------------------------------------------------------------------

type CuratorOp =
  | { op: "keep"; id: string }
  | { op: "merge"; keepId: string; dropIds: string[]; newContent: string; newTags: string[] }
  | { op: "prune"; id: string; reason: string };

interface CuratorOutput {
  ops: CuratorOp[];
  guidanceMarkdown: string;
}

function parseCuratorOutput(raw: string): CuratorOutput | null {
  const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;

  let ops: CuratorOp[] = [];
  try {
    const parsed = JSON.parse(jsonMatch[1].trim()) as { ops?: unknown[] };
    ops = (parsed.ops ?? []).filter(isValidOp);
  } catch {
    return null;
  }

  // Extract markdown before the json block
  const guidanceMarkdown = raw.slice(0, raw.indexOf("```json")).trim();

  return { ops, guidanceMarkdown };
}

function isValidOp(raw: unknown): raw is CuratorOp {
  if (!raw || typeof raw !== "object") return false;
  const v = raw as Record<string, unknown>;
  if (v.op === "keep") return typeof v.id === "string";
  if (v.op === "prune") return typeof v.id === "string" && typeof v.reason === "string";
  if (v.op === "merge") {
    return typeof v.keepId === "string"
      && Array.isArray(v.dropIds)
      && typeof v.newContent === "string"
      && Array.isArray(v.newTags);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Apply ops to principles
// ---------------------------------------------------------------------------

function applyGovernanaceOps(
  principles: PrincipleItem[],
  ops: CuratorOp[],
): { kept: PrincipleItem[]; mergeOps: PrincipleOp[]; prunedIds: Set<string> } {
  const byId = new Map(principles.map((p) => [p.id, p]));
  const prunedIds = new Set<string>();
  const mergeOps: PrincipleOp[] = [];

  for (const op of ops) {
    if (op.op === "prune") {
      prunedIds.add(op.id);
    } else if (op.op === "merge") {
      for (const dropId of op.dropIds) {
        prunedIds.add(dropId);
      }
      // Build a merge principleOp to be applied via principlesManager
      mergeOps.push({
        op: "merge",
        targetId: op.keepId,
        content: op.newContent,
        tags: op.newTags,
      });
    }
    // "keep" ops require no action
  }

  const kept = principles.filter((p) => !prunedIds.has(p.id));
  return { kept, mergeOps, prunedIds };
}

// ---------------------------------------------------------------------------
// Update reflector-contract.md
// ---------------------------------------------------------------------------

async function updateReflectorContract(guidanceMarkdown: string, generatedAt: string): Promise<void> {
  let content: string;
  try {
    content = await fs.readFile(REFLECTOR_CONTRACT_PATH, "utf-8");
  } catch {
    content = "";
  }

  const newGuidanceSection = [
    "## Principle Generation Guidance",
    "",
    `> 最近一次 PrinciplesCurator 治理时间：${generatedAt}`,
    "",
    guidanceMarkdown.trim(),
  ].join("\n");

  // Replace existing ## Principle Generation Guidance section or append
  const sectionPattern = /^## Principle Generation Guidance[\s\S]*?(?=^## |\Z)/m;
  if (sectionPattern.test(content)) {
    content = content.replace(sectionPattern, `${newGuidanceSection}\n\n`);
  } else {
    content = `${content.trimEnd()}\n\n${newGuidanceSection}\n`;
  }

  await fs.writeFile(REFLECTOR_CONTRACT_PATH, content, "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PrinciplesCuratorResult {
  prunedCount: number;
  mergedCount: number;
  keptCount: number;
  guidanceMarkdown: string;
}

export interface PrinciplesCuratorOptions {
  principles: PrincipleItem[];
  ctx: ExtensionContext;
  config: GRCConfig;
  logger: Logger;
  signal?: AbortSignal;
  principlesManager: {
    applyPrincipleOps(ops: PrincipleOp[], options: { source?: string; hardMaxCount: number }): Promise<{ changed: number; deleted: number }>;
    prune(maxCount: number): Promise<number>;
    deleteByIds(ids: string[]): Promise<number>;
  };
}

export async function executePrinciplesCurator(options: PrinciplesCuratorOptions): Promise<PrinciplesCuratorResult | null> {
  const { principles, ctx, config, logger, signal, principlesManager } = options;

  logger.info(`PrinciplesCurator triggered: ${principles.length} principles → target ${PRINCIPLES_CURATOR_TARGET}`);

  const { complete } = await import("@earendil-works/pi-ai");
  const model = ctx.modelRegistry.find(config.subagentModelProvider, config.subagentModel)
    ?? ctx.modelRegistry.getAvailable().find((m) => m.id === config.subagentModel || m.name === config.subagentModel);

  if (!model) {
    logger.warn(`PrinciplesCurator: model not found (${config.subagentModelProvider}/${config.subagentModel})`);
    return null;
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) {
    logger.warn("PrinciplesCurator: no API key");
    return null;
  }

  const prompt = buildPrinciplesCuratorPrompt(principles);
  logger.debug(`PrinciplesCurator prompt: ~${Math.round(prompt.length / 4)} tokens`);

  let raw: string;
  try {
    const response = await complete(
      model,
      {
        messages: [{
          role: "user" as const,
          content: [{ type: "text" as const, text: prompt }],
          timestamp: Date.now(),
        }],
      },
      { apiKey: auth.apiKey, headers: auth.headers, maxTokens: 4096, signal },
    );
    raw = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text" && typeof b.text === "string")
      .map((b) => b.text)
      .join("\n")
      .trim();
  } catch (err) {
    logger.warn("PrinciplesCurator LLM call failed:", err);
    return null;
  }

  const output = parseCuratorOutput(raw);
  if (!output) {
    logger.warn("PrinciplesCurator: failed to parse output");
    return null;
  }

  const { mergeOps, prunedIds } = applyGovernanaceOps(principles, output.ops);

  // Apply merge ops via principlesManager
  if (mergeOps.length > 0) {
    await principlesManager.applyPrincipleOps(mergeOps, {
      source: "principles-curator",
      hardMaxCount: Math.max(principles.length, 200),
    });
  }

  // Step 1: Delete LLM-designated prune ids first (respects LLM intent)
  let explicitlyDeleted = 0;
  if (prunedIds.size > 0) {
    explicitlyDeleted = await principlesManager.deleteByIds([...prunedIds]);
    logger.debug(`PrinciplesCurator: explicitly deleted ${explicitlyDeleted} LLM-pruned principles`);
  }

  // Step 2: Fallback truncation to reach target count
  const pruned = await principlesManager.prune(PRINCIPLES_CURATOR_TARGET);

  // Update reflector-contract.md
  const generatedAt = new Date().toISOString();
  try {
    await updateReflectorContract(output.guidanceMarkdown, generatedAt);
    logger.info("PrinciplesCurator: reflector-contract.md updated");
  } catch (err) {
    logger.warn("PrinciplesCurator: failed to update reflector-contract.md:", err);
  }

  const result: PrinciplesCuratorResult = {
    prunedCount: explicitlyDeleted + pruned,
    mergedCount: mergeOps.length,
    keptCount: principles.length - explicitlyDeleted - pruned,
    guidanceMarkdown: output.guidanceMarkdown,
  };

  logger.info(`PrinciplesCurator done: pruned=${result.prunedCount}, merged=${result.mergedCount}, kept=${result.keptCount}`);
  return result;
}
