// ============================================================
// agent-web-search-pro v2 - Synthesis Stage (Phase 1.5 upgraded)
// ============================================================
// Analyzes accumulated knowledge and judges whether information
// is sufficient to answer the original query. Produces gap analysis
// and a structured synthesized answer.
//
// Phase 1.5 upgrades:
// - Structured answer: direct conclusion → supporting evidence → uncertainty → next steps
// - Query-type-aware gap generation (specific and actionable)
// - Improved sufficiency judgment
//
// Phase 2 (this iteration):
// - Query-type-aware answer generation: factual/comparison/solution_design/etc.
// - Answers read like real responses, not summary dumps
// - Factual queries: "支持/部分支持/不支持/待确认" stance
// - Comparison queries: directional judgment with scenarios
// - Solution design queries: proposal-like output

import type {
  SynthesizeResearchOutput,
  ResearchGap,
  GapType,
  KnowledgeItem,
  ResearchPlan,
} from "../types.js";
import { classifyQuery, QueryType } from "./plan-research.js";

// ─── Query-Type-Aware Gap Templates ───

/** Map QueryType → GapType for structured gap classification */
const QUERY_TO_GAP_TYPE: Record<QueryType, GapType> = {
  factual: "factual",
  comparison: "comparison",
  latest: "recency",
  pricing: "factual",
  troubleshooting: "depth",
  tutorial: "depth",
  solution_design: "breadth",
  general: "context",
};

interface GapTemplate {
  gaps: ResearchGap[];
  nextQueries: string[];
}

/** Build a single ResearchGap from an aspect and query context */
function makeGap(
  aspect: string,
  description: string,
  queryType: QueryType,
  suggestedQuery: string | undefined,
  round: number,
): ResearchGap {
  const gapType = QUERY_TO_GAP_TYPE[queryType];
  // Priority: missing aspects earlier in the list are typically more important
  // Base priority by type, then scale
  const basePriority: Record<GapType, number> = {
    factual: 0.8,
    comparison: 0.7,
    verification: 0.9,
    depth: 0.6,
    breadth: 0.5,
    recency: 0.6,
    context: 0.4,
  };
  return {
    description,
    aspect,
    type: gapType,
    priority: basePriority[gapType],
    suggestedQuery,
    identifiedInRound: round,
    queried: false,
  };
}

const GAP_TEMPLATES: Record<QueryType, (entity: string, missingAspects: string[], round: number) => GapTemplate> = {
  factual: (entity, missing, _round) => {
    const nextQueries = [
      `${entity} 核心功能 详细介绍`,
      `${entity} 使用场景 限制`,
    ];
    const descMap: Record<string, string> = {
      "核心功能与能力": `尚未找到 "${entity}" 的具体功能清单和能力边界`,
      "使用场景与限制": `缺少 "${entity}" 的典型使用场景和已知限制`,
      "技术架构与原理": `未获取 "${entity}" 的技术架构或底层原理说明`,
    };
    return {
      gaps: missing.map((a) => makeGap(a, descMap[a] ?? `缺少关于 "${entity}" 的"${a}"维度信息`, "factual", nextQueries[0], _round)),
      nextQueries,
    };
  },
  comparison: (entity, missing, _round) => {
    const nextQueries = [
      `${entity} 对比 竞品 优缺点`,
      `${entity} 用户评价 社区反馈`,
    ];
    const descMap: Record<string, string> = {
      "核心指标对比": `缺少 "${entity}" 与竞品的核心指标对比数据`,
      "优劣势分析": `未找到 "${entity}" 的优劣势系统性分析`,
      "适用场景差异": `缺少不同场景下 "${entity}" 与替代方案的适用性对比`,
      "用户评价": `未获取用户/社区对 "${entity}" 的真实评价`,
    };
    return {
      gaps: missing.map((a) => makeGap(a, descMap[a] ?? `缺少 "${entity}" 的"${a}"对比信息`, "comparison", nextQueries[0], _round)),
      nextQueries,
    };
  },
  latest: (entity, missing, _round) => {
    const nextQueries = [
      `${entity} 最新版本 changelog`,
      `${entity} 最近更新 社区反馈`,
    ];
    const descMap: Record<string, string> = {
      "最新版本信息": `未找到 "${entity}" 的最新版本号和发布日期`,
      "更新内容与变更": `缺少 "${entity}" 最新版本的变更日志和更新内容`,
      "社区反馈": `未获取社区对 "${entity}" 最新版本的反馈`,
    };
    return {
      gaps: missing.map((a) => makeGap(a, descMap[a] ?? `缺少 "${entity}" 的"${a}"信息`, "latest", nextQueries[0], _round)),
      nextQueries,
    };
  },
  pricing: (entity, missing, _round) => {
    const nextQueries = [
      `${entity} 价格 定价 方案`,
      `${entity} 免费版 额度 限制`,
    ];
    const descMap: Record<string, string> = {
      "定价方案": `未找到 "${entity}" 的具体定价方案和价格明细`,
      "免费额度与限制": `缺少 "${entity}" 免费版额度和限制条件`,
      "性价比分析": `缺少对 "${entity}" 性价比的评估`,
      "竞品价格对比": `未获取 "${entity}" 与竞品价格的横向对比`,
    };
    return {
      gaps: missing.map((a) => makeGap(a, descMap[a] ?? `缺少 "${entity}" 的"${a}"信息`, "pricing", nextQueries[0], _round)),
      nextQueries,
    };
  },
  troubleshooting: (entity, missing, _round) => {
    const nextQueries = [
      `${entity} 问题 解决方案`,
      `${entity} 错误 修复 方法`,
    ];
    const descMap: Record<string, string> = {
      "常见错误与原因": `未找到 "${entity}" 相关常见错误及其原因`,
      "解决方案与步骤": `缺少针对 "${entity}" 问题的具体解决步骤`,
      "官方文档与社区讨论": `未获取官方文档或社区中关于 "${entity}" 问题的讨论`,
    };
    return {
      gaps: missing.map((a) => makeGap(a, descMap[a] ?? `缺少 "${entity}" 的"${a}"信息`, "troubleshooting", nextQueries[0], _round)),
      nextQueries,
    };
  },
  tutorial: (entity, missing, _round) => {
    const nextQueries = [
      `${entity} 教程 入门 快速上手`,
      `${entity} 安装 配置 步骤`,
    ];
    const descMap: Record<string, string> = {
      "入门步骤": `未找到 "${entity}" 的入门教程或快速上手指南`,
      "配置与安装": `缺少 "${entity}" 的安装和配置步骤`,
      "最佳实践": `缺少 "${entity}" 的最佳实践和示例代码`,
      "常见问题": `未获取 "${entity}" 使用过程中常见问题`,
    };
    return {
      gaps: missing.map((a) => makeGap(a, descMap[a] ?? `缺少 "${entity}" 的"${a}"信息`, "tutorial", nextQueries[0], _round)),
      nextQueries,
    };
  },
  solution_design: (entity, missing, _round) => {
    const nextQueries = [
      `${entity} 架构设计 方案`,
      `${entity} 最佳实践 案例`,
    ];
    const descMap: Record<string, string> = {
      "架构设计方案": `未找到关于 "${entity}" 的架构设计方案`,
      "技术选型对比": `缺少 "${entity}" 相关技术选型的对比分析`,
      "实施步骤": `缺少 "${entity}" 的具体实施步骤`,
      "最佳实践": `未获取 "${entity}" 的最佳实践案例`,
    };
    return {
      gaps: missing.map((a) => makeGap(a, descMap[a] ?? `缺少 "${entity}" 的"${a}"信息`, "solution_design", nextQueries[0], _round)),
      nextQueries,
    };
  },
  general: (_entity, missing, _round) => ({
    gaps: missing.map((a) => makeGap(a, `未找到关于"${a}"的具体信息`, "general", undefined, _round)),
    nextQueries: [],
  }),
};

/**
 * Extract the primary entity from a query (reuse from planning).
 */
function extractEntity(query: string): string {
  let entity = query
    .replace(/[？？]/g, "")
    .replace(/^(什么是|什么|怎么|如何|为什么|请问|问一下|帮我查|查一下|告诉我|我想把|我想|想把|帮我|请帮我)/i, "")
    .replace(/(是什么|怎么样|怎么用|如何使用|有哪些|好不好|值不值|靠谱吗)$/i, "")
    .trim();
  const cnMatch = entity.match(/^([\u4e00-\u9fa5]{2,10})/);
  if (cnMatch) return cnMatch[1];
  const enMatch = entity.match(/^(\w+(?:\s+\w+){0,2})/);
  if (enMatch) return enMatch[1];
  return entity.slice(0, 15);
}

// ─── Answer Synthesis Helpers ───

/** Collect all key facts from adopted knowledge, deduplicated */
function collectAllFacts(adopted: KnowledgeItem[]): string[] {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const k of adopted) {
    for (const f of k.keyFacts) {
      const normalized = f.trim().toLowerCase();
      if (!seen.has(normalized) && f.trim().length > 5) {
        seen.add(normalized);
        facts.push(f.trim());
      }
    }
  }
  return facts;
}

/** Get a short source attribution for a knowledge item */
function sourceTag(k: KnowledgeItem): string {
  const domain = (() => {
    try { return new URL(k.sourceUrl).hostname.replace(/^www\./, ""); } catch { return k.title.slice(0, 30); }
  })();
  return domain;
}

/** Merge summaries from top knowledge into a coherent statement */
function synthesizeSummary(adopted: KnowledgeItem[], maxItems = 3): string {
  const summaries = adopted.slice(0, maxItems).map((k) => k.summary).filter(Boolean);
  if (summaries.length === 0) return "未获取到有效信息";
  if (summaries.length === 1) return summaries[0];
  // For multiple summaries, try to combine rather than just concatenate
  return summaries.join("；");
}

/**
 * Build a structured answer from knowledge items.
 * Phase 2: Query-type-aware answer generation that reads like a real response.
 *
 * Each query type produces:
 *   1. Direct answer / conclusion (first line, most important)
 *   2. Supporting evidence (key facts with source attribution)
 *   3. Limitations / uncertainty (what we don't know)
 *   4. Recommendations (what to do next / where to verify)
 */
function buildAnswer(params: {
  originalQuery: string;
  knowledge: KnowledgeItem[];
  queryType: QueryType;
  coveredAspects: string[];
  missingAspects: string[];
  confidence: number;
}): string {
  const { originalQuery, knowledge, queryType, coveredAspects, missingAspects, confidence } = params;
  const entity = extractEntity(originalQuery);
  const adopted = knowledge
    .filter((k) => k.adopted)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  if (adopted.length === 0) {
    return `未找到关于「${originalQuery}」的有效信息。建议尝试更具体的关键词，或提供更多上下文。`;
  }

  const allFacts = collectAllFacts(adopted);
  const sections: string[] = [];

  // ── Type-specific direct answer ──
  const directAnswer = buildDirectAnswer({
    originalQuery, entity, adopted, queryType, allFacts, coveredAspects, missingAspects, confidence,
  });
  sections.push(directAnswer);

  // ── Evidence section (only if we have meaningful facts) ──
  if (allFacts.length > 0) {
    const evidence = buildEvidence(adopted, allFacts);
    if (evidence) sections.push(evidence);
  }

  // ── Limitations ──
  const limitations = buildLimitations({ adopted, missingAspects, confidence, coveredAspects });
  if (limitations) sections.push(limitations);

  return sections.join("\n\n");
}

// ─── Direct Answer Builders (per query type) ───

interface DirectAnswerParams {
  originalQuery: string;
  entity: string;
  adopted: KnowledgeItem[];
  queryType: QueryType;
  allFacts: string[];
  coveredAspects: string[];
  missingAspects: string[];
  confidence: number;
}

function buildDirectAnswer(p: DirectAnswerParams): string {
  switch (p.queryType) {
    case "factual":
      return buildFactualAnswer(p);
    case "comparison":
      return buildComparisonAnswer(p);
    case "solution_design":
      return buildSolutionDesignAnswer(p);
    case "latest":
      return buildLatestAnswer(p);
    case "troubleshooting":
      return buildTroubleshootingAnswer(p);
    case "tutorial":
      return buildTutorialAnswer(p);
    case "pricing":
      return buildPricingAnswer(p);
    case "general":
    default:
      return buildGeneralAnswer(p);
  }
}

/**
 * Factual: "支持 / 部分支持 / 不支持 / 待确认"
 * Example: "OpenAI Responses API 是否支持 structured outputs？"
 */
function buildFactualAnswer(p: DirectAnswerParams): string {
  const { originalQuery, entity, adopted, allFacts, coveredAspects, confidence } = p;

  // Determine stance based on evidence strength
  const stance = determineFactualStance(adopted, allFacts, coveredAspects, confidence);

  const parts: string[] = [];
  parts.push(`**结论**: ${stance.label}`);
  parts.push(stance.detail);

  if (allFacts.length > 0 && allFacts.length <= 4) {
    // Inline key facts if small number
    parts.push(allFacts.map((f) => f.endsWith("。") || f.endsWith(".") ? f : f + "。").join(" "));
  }

  return parts.join("\n");
}

function determineFactualStance(
  adopted: KnowledgeItem[],
  facts: string[],
  covered: string[],
  confidence: number,
): { label: string; detail: string } {
  const highRelevance = adopted.filter((k) => k.relevanceScore >= 0.6);
  const hasDirectEvidence = highRelevance.length >= 1 && facts.length >= 2;

  if (confidence >= 0.6 && hasDirectEvidence) {
    return {
      label: "✅ 信息支持",
      detail: `根据 ${highRelevance.length} 个来源的信息，可以确认该问题的主要方面。`,
    };
  }
  if (confidence >= 0.35 && adopted.length >= 1) {
    return {
      label: "⚠️ 部分支持，信息不完整",
      detail: `找到了 ${adopted.length} 个相关信息源，但覆盖的研究维度有限（${covered.length}/${covered.length + (3 - covered.length)}），部分细节待确认。`,
    };
  }
  if (adopted.length >= 1) {
    return {
      label: "❓ 信息不足，待进一步确认",
      detail: `仅找到 ${adopted.length} 条相关信息，覆盖度不足，建议补充搜索。`,
    };
  }
  return {
    label: "❌ 未找到有效信息",
    detail: "未能检索到与问题相关的可靠来源。",
  };
}

/**
 * Comparison: directional judgment with scenario-based advice
 * Example: "Cursor 和 Windsurf 哪个更适合个人独立开发者？"
 */
function buildComparisonAnswer(p: DirectAnswerParams): string {
  const { originalQuery, entity, adopted, allFacts, coveredAspects, confidence } = p;

  // Try to extract the two compared items from entity string
  const comparisonMatch = entity.match(/^(.+?)\s*(?:vs|VS|对比|和|与|跟|还是)\s*(.+?)$/i);
  const itemA = comparisonMatch ? comparisonMatch[1].trim() : entity;
  const itemB = comparisonMatch ? comparisonMatch[2].trim() : "竞品";

  const parts: string[] = [];

  if (confidence >= 0.45 && adopted.length >= 2) {
    // We have enough to make a comparison
    const summary = synthesizeSummary(adopted, 3);
    parts.push(`**对比结论**: 基于 ${adopted.length} 个来源的信息：`);
    parts.push(summary);
    parts.push("");

    // Extract scenario-specific advice if available
    const scenarioFacts = allFacts.filter(
      (f) => f.includes("适合") || f.includes("优势") || f.includes("劣势") || f.includes("场景") || f.includes("推荐"),
    );
    if (scenarioFacts.length > 0) {
      parts.push(`**场景建议**:`);
      for (const f of scenarioFacts.slice(0, 3)) {
        parts.push(`- ${f.endsWith("。") ? f : f + "。"}`);
      }
    }
  } else if (adopted.length >= 1) {
    parts.push(`**对比结论**: 找到了 ${adopted.length} 个相关信息源，但对比维度不够全面，以下信息供参考：`);
    parts.push(synthesizeSummary(adopted, 2));
  } else {
    parts.push(`**对比结论**: 未找到足够的对比信息来回答「${originalQuery}」。`);
  }

  return parts.join("\n");
}

/**
 * Solution Design: proposal-like output
 * Example: "如何设计 Next.js SaaS 的最小可行 observability 方案？"
 */
function buildSolutionDesignAnswer(p: DirectAnswerParams): string {
  const { originalQuery, entity, adopted, allFacts, coveredAspects, confidence } = p;

  const parts: string[] = [];

  if (confidence >= 0.4 && adopted.length >= 2) {
    parts.push(`**方案建议**: 针对「${originalQuery}」，基于 ${adopted.length} 个来源的信息整理如下：`);
    parts.push("");

    // Try to extract actionable steps/recommendations
    const actionableFacts = allFacts.filter(
      (f) =>
        f.includes("推荐") || f.includes("建议") || f.includes("方案") ||
        f.includes("步骤") || f.includes("使用") || f.includes("配置") ||
        f.includes("部署") || f.includes("选择") || f.includes("实践"),
    );

    if (actionableFacts.length > 0) {
      parts.push(`**关键要点**:`);
      for (const f of actionableFacts.slice(0, 5)) {
        parts.push(`- ${f.endsWith("。") ? f : f + "。"}`);
      }
    } else {
      // Fallback: use summaries
      parts.push(synthesizeSummary(adopted, 3));
    }
  } else if (adopted.length >= 1) {
    parts.push(`**方案参考**: 找到 ${adopted.length} 个相关信息，内容有限，仅供参考：`);
    parts.push(synthesizeSummary(adopted, 2));
  } else {
    parts.push(`未找到关于「${originalQuery}」的方案设计参考信息。`);
  }

  return parts.join("\n");
}

/**
 * Latest: version/update status
 */
function buildLatestAnswer(p: DirectAnswerParams): string {
  const { originalQuery, entity, adopted, allFacts, confidence } = p;

  const parts: string[] = [];

  if (adopted.length >= 1) {
    parts.push(`**最新动态**: 关于「${entity}」的最新信息如下：`);
    parts.push(synthesizeSummary(adopted, 2));

    const versionFacts = allFacts.filter(
      (f) => f.includes("版本") || f.includes("更新") || f.includes("发布") || f.includes("v\\d") || /\d+\.\d+/.test(f),
    );
    if (versionFacts.length > 0) {
      parts.push("");
      parts.push(`**关键信息**:`);
      for (const f of versionFacts.slice(0, 3)) {
        parts.push(`- ${f.endsWith("。") ? f : f + "。"}`);
      }
    }
  } else {
    parts.push(`未找到关于「${originalQuery}」的最新动态信息。`);
  }

  return parts.join("\n");
}

/**
 * Troubleshooting: likely cause + solution summary
 */
function buildTroubleshootingAnswer(p: DirectAnswerParams): string {
  const { originalQuery, entity, adopted, allFacts, confidence } = p;

  const parts: string[] = [];

  if (adopted.length >= 1) {
    const solutionFacts = allFacts.filter(
      (f) => f.includes("解决") || f.includes("修复") || f.includes("方法") || f.includes("步骤") || f.includes("方案"),
    );

    if (solutionFacts.length > 0) {
      parts.push(`**解决方案**: 针对「${entity}」的问题，找到以下信息：`);
      for (const f of solutionFacts.slice(0, 4)) {
        parts.push(`- ${f.endsWith("。") ? f : f + "。"}`);
      }
    } else {
      parts.push(`**问题参考**: 关于「${entity}」找到 ${adopted.length} 条相关信息：`);
      parts.push(synthesizeSummary(adopted, 2));
    }
  } else {
    parts.push(`未找到关于「${originalQuery}」的问题解决方案。`);
  }

  return parts.join("\n");
}

/**
 * Tutorial: high-level approach summary
 */
function buildTutorialAnswer(p: DirectAnswerParams): string {
  const { originalQuery, entity, adopted, allFacts } = p;

  const parts: string[] = [];

  if (adopted.length >= 1) {
    const stepFacts = allFacts.filter(
      (f) => f.includes("步骤") || f.includes("安装") || f.includes("配置") || f.includes("创建") || f.includes("设置"),
    );

    if (stepFacts.length > 0) {
      parts.push(`**操作指南**: 关于「${entity}」的操作步骤如下：`);
      for (const f of stepFacts.slice(0, 5)) {
        parts.push(`- ${f.endsWith("。") ? f : f + "。"}`);
      }
    } else {
      parts.push(`**教程参考**: 关于「${entity}」找到 ${adopted.length} 条相关信息：`);
      parts.push(synthesizeSummary(adopted, 2));
    }
  } else {
    parts.push(`未找到关于「${originalQuery}」的教程信息。`);
  }

  return parts.join("\n");
}

/**
 * Pricing: price summary
 */
function buildPricingAnswer(p: DirectAnswerParams): string {
  const { originalQuery, entity, adopted, allFacts } = p;

  const parts: string[] = [];

  if (adopted.length >= 1) {
    const priceFacts = allFacts.filter(
      (f) => f.includes("价格") || f.includes("费用") || f.includes("$") || f.includes("元") || f.includes("免费") || f.includes("订阅"),
    );

    if (priceFacts.length > 0) {
      parts.push(`**价格信息**: 关于「${entity}」的定价信息如下：`);
      for (const f of priceFacts.slice(0, 4)) {
        parts.push(`- ${f.endsWith("。") ? f : f + "。"}`);
      }
    } else {
      parts.push(`**定价参考**: 关于「${entity}」找到 ${adopted.length} 条相关信息：`);
      parts.push(synthesizeSummary(adopted, 2));
    }
  } else {
    parts.push(`未找到关于「${originalQuery}」的定价信息。`);
  }

  return parts.join("\n");
}

/**
 * General: fallback for unclassifiable queries
 */
function buildGeneralAnswer(p: DirectAnswerParams): string {
  const { originalQuery, adopted, allFacts, confidence } = p;

  if (adopted.length === 0) {
    return `未找到关于「${originalQuery}」的有效信息。建议尝试更具体的关键词。`;
  }

  const parts: string[] = [];
  parts.push(`**查询结果**: 关于「${originalQuery}」，找到 ${adopted.length} 条相关信息：`);
  parts.push(synthesizeSummary(adopted, 3));

  if (allFacts.length > 0 && allFacts.length <= 6) {
    parts.push("");
    for (const f of allFacts.slice(0, 5)) {
      parts.push(`- ${f.endsWith("。") ? f : f + "。"}`);
    }
  }

  return parts.join("\n");
}

// ─── Evidence Section ───

function buildEvidence(adopted: KnowledgeItem[], allFacts: string[]): string | null {
  if (allFacts.length === 0) return null;

  // Pick the most informative facts (not too many)
  const factsToShow = allFacts.slice(0, 6);
  const lines = factsToShow.map((f) => {
    // Find which source this fact came from
    const source = adopted.find((k) => k.keyFacts.includes(f));
    const tag = source ? `(${sourceTag(source)})` : "";
    return `- ${f}${tag ? " " + tag : ""}`;
  });

  return `**详细信息**:\n${lines.join("\n")}`;
}

// ─── Limitations Section ───

function buildLimitations(params: {
  adopted: KnowledgeItem[];
  missingAspects: string[];
  confidence: number;
  coveredAspects: string[];
}): string | null {
  const { adopted, missingAspects, confidence, coveredAspects } = params;
  const warnings: string[] = [];

  if (adopted.length < 2) {
    warnings.push(`信息来源较少（仅 ${adopted.length} 条），可能不够全面`);
  }
  if (missingAspects.length > 0) {
    warnings.push(`以下维度尚未覆盖：${missingAspects.slice(0, 2).join("、")}${missingAspects.length > 2 ? " 等" : ""}`);
  }
  if (confidence < 0.4) {
    warnings.push("整体置信度较低，建议交叉验证");
  } else if (confidence < 0.6) {
    warnings.push("信息置信度中等，部分细节可能需要进一步确认");
  }

  // Add time-sensitive warning for latest/pricing queries
  const lowRelevanceCount = adopted.filter((k) => k.relevanceScore < 0.4).length;
  if (lowRelevanceCount > adopted.length / 2 && adopted.length > 0) {
    warnings.push("多数信息来源相关性较低，结论仅供参考");
  }

  if (warnings.length === 0) return null;

  return `**局限性**: ${warnings.join("；")}。`;
}

/**
 * Heuristic sufficiency judgment.
 * Evaluates whether accumulated knowledge covers the research aspects.
 */
function judgeSufficiency(params: {
  originalQuery: string;
  knowledge: KnowledgeItem[];
  plan?: ResearchPlan;
  round?: number;
  maxRounds?: number;
}): SynthesizeResearchOutput {
  const { originalQuery, knowledge, plan, round = 1, maxRounds = 5 } = params;

  const adoptedKnowledge = knowledge.filter((k) => k.adopted);
  const queryType = classifyQuery(originalQuery);
  const entity = extractEntity(originalQuery);

  // Determine which aspects are covered
  let aspectsToCheck = plan?.aspects ?? DIMENSION_TEMPLATES[queryType].aspects;
  const coveredAspects: string[] = [];
  const missingAspects: string[] = [];

  for (const aspect of aspectsToCheck) {
    const aspectKeywords = aspect.toLowerCase().split(/[\s_]+/);
    const hasCoverage = adoptedKnowledge.some((item) => {
      const content = `${item.summary} ${item.keyFacts.join(" ")}`.toLowerCase();
      return aspectKeywords.some((kw) => kw.length > 1 && content.includes(kw));
    });

    if (hasCoverage) {
      coveredAspects.push(aspect);
    } else {
      missingAspects.push(aspect);
    }
  }

  // Calculate confidence
  const coverageRatio = aspectsToCheck.length > 0 ? coveredAspects.length / aspectsToCheck.length : 0;
  const avgRelevance = adoptedKnowledge.length > 0
    ? adoptedKnowledge.reduce((sum, k) => sum + k.relevanceScore, 0) / adoptedKnowledge.length
    : 0;
  const roundPenalty = round >= maxRounds ? 0.1 : 0;
  const knowledgeBonus = Math.min(adoptedKnowledge.length * 0.05, 0.2);
  const qualityBonus = adoptedKnowledge.some((k) => k.keyFacts.length >= 3) ? 0.1 : 0;

  const confidence = Math.min(
    Math.max(coverageRatio * 0.5 + avgRelevance * 0.3 + knowledgeBonus + qualityBonus - roundPenalty, 0),
    1.0,
  );

  const sufficient = confidence >= 0.65 && missingAspects.length <= 1;

  // Generate gaps using query-type-aware templates
  const gapTemplate = GAP_TEMPLATES[queryType](entity, missingAspects, round);
  const gaps: ResearchGap[] = gapTemplate.gaps;

  // Synthesize answer (always provide one, even if insufficient)
  const answer = buildAnswer({
    originalQuery,
    knowledge,
    queryType,
    coveredAspects,
    missingAspects,
    confidence,
  });

  const sources = adoptedKnowledge.map((k) => ({
    title: k.title,
    url: k.sourceUrl,
    relevance: k.relevanceScore >= 0.7 ? "high" : k.relevanceScore >= 0.4 ? "medium" : "low",
  }));

  // Suggest next sub-queries if not sufficient
  let nextSuggestedSubQueries: string[] | undefined;
  if (!sufficient) {
    nextSuggestedSubQueries = gapTemplate.nextQueries.slice(0, 3);
  }

  return {
    sufficient,
    confidence: Math.round(confidence * 100) / 100,
    coveredAspects,
    missingAspects,
    gaps,
    answer,
    sources,
    nextSuggestedSubQueries,
  };
}

// Need the dimension templates reference for fallback aspects
const DIMENSION_TEMPLATES: Record<QueryType, { aspects: string[] }> = {
  factual: { aspects: ["核心功能与能力", "使用场景与限制", "技术架构与原理"] },
  comparison: { aspects: ["核心指标对比", "优劣势分析", "适用场景差异", "用户评价"] },
  latest: { aspects: ["最新版本信息", "更新内容与变更", "社区反馈"] },
  pricing: { aspects: ["定价方案", "免费额度与限制", "性价比分析", "竞品价格对比"] },
  troubleshooting: { aspects: ["常见错误与原因", "解决方案与步骤", "官方文档与社区讨论"] },
  tutorial: { aspects: ["入门步骤", "配置与安装", "最佳实践", "常见问题"] },
  solution_design: { aspects: ["架构设计方案", "技术选型对比", "实施步骤", "最佳实践"] },
  general: { aspects: ["概览与核心信息", "关键特性", "使用场景"] },
};

export { judgeSufficiency };
