// ============================================================
// agent-web-search-pro v2 — Planning Stage (Phase 1.5 upgraded)
// ============================================================
// Analyzes a research query and produces a structured research plan
// with aspects, sub-queries, and suggested site types / engines.
//
// Phase 1.5 upgrades:
// - Query type classification (factual, comparison, latest, solution, troubleshooting, pricing, tutorial)
// - Per-type dimension and subquery templates
// - Intent-aware subquery generation (not naive concatenation)
// - Query-type-aware site type suggestions

import type { ResearchPlan, PlanResearchOutput } from "../types.js";

// ─── Query Type Classification ───

export type QueryType =
  | "factual"
  | "comparison"
  | "latest"
  | "solution_design"
  | "troubleshooting"
  | "pricing"
  | "tutorial"
  | "general";

interface QueryTypeRule {
  type: QueryType;
  keywords: RegExp[];
}

const QUERY_TYPE_RULES: QueryTypeRule[] = [
  {
    type: "comparison",
    keywords: [
      /对比|比较|vs\.?|versus|compare|which.*better|difference.*between|区别|哪个好|孰优孰劣|优劣|优缺点|横向测评|哪个更适合|哪个更好|哪个更强|哪个值得|.+[和与跟].+哪个|.+还是.+/i,
    ],
  },
  {
    type: "latest",
    keywords: [
      /最新|最近更新|最新发布|new release|latest.*update|changelog|版本更新|更新日志|最近变化|what.*new/i,
    ],
  },
  {
    type: "pricing",
    keywords: [
      /价格|费用|多少钱|定价|cost|price|pay|收费|免费|订阅|免费额度|pricing|how much|afford/i,
    ],
  },
  {
    type: "troubleshooting",
    keywords: [
      /问题|bug|错误|报错|异常|故障|解决|修复|issue|error|fix|troubleshoot|cannot|can't.*work|not working|失败/i,
    ],
  },
  {
    type: "tutorial",
    keywords: [
      /教程|怎么用|如何使用|入门|guide|tutorial|how.*to|上手|配置|安装|安装|设置|step.*by.*step|get.*started/i,
    ],
  },
  {
    type: "solution_design",
    keywords: [
      /方案|架构|设计|实现|怎么搭建|如何构建|build|implement|architecture|方案.*设计|技术选型|最佳实践|best.*practic/i,
    ],
  },
  {
    type: "factual",
    keywords: [
      /是什么|什么是|能力|功能|定义|含义|meaning|definition|what.*is|capabilities|features.*of|支持|能做什么|用途|支持.*什么/i,
    ],
  },
];

/**
 * Classify a query into a query type using keyword heuristics.
 * Falls back to "general" if no pattern matches.
 */
function classifyQuery(query: string): QueryType {
  const lower = query.toLowerCase();
  for (const rule of QUERY_TYPE_RULES) {
    if (rule.keywords.some((kw) => kw.test(lower))) {
      return rule.type;
    }
  }
  return "general";
}

// ─── Per-Type Research Dimensions ───

interface DimensionTemplate {
  aspects: string[];
  subqueryTemplates: string[]; // {entity} and {aspect} placeholders
  siteTypes: string[];
}

const DIMENSION_TEMPLATES: Record<QueryType, DimensionTemplate> = {
  factual: {
    aspects: ["核心功能与能力", "使用场景与限制", "技术架构与原理"],
    subqueryTemplates: [
      "{entity} 核心功能 能力介绍",
      "{entity} 能做什么 使用场景",
      "{entity} 技术原理 架构",
    ],
    siteTypes: ["search_engine", "docs", "github"],
  },
  comparison: {
    aspects: ["核心指标对比", "优劣势分析", "适用场景差异", "用户评价"],
    subqueryTemplates: [
      "{entity} 对比 优劣势",
      "{entity} vs 性能 功能 比较",
      "{entity} 适用场景 选择建议",
      "{entity} 用户评价 口碑",
    ],
    siteTypes: ["search_engine", "zhihu", "reddit", "v2ex"],
  },
  latest: {
    aspects: ["最新版本信息", "更新内容与变更", "社区反馈"],
    subqueryTemplates: [
      "{entity} 最新版本 更新",
      "{entity} changelog 更新内容",
      "{entity} 最新版本 社区反馈",
    ],
    siteTypes: ["search_engine", "github", "news"],
  },
  pricing: {
    aspects: ["定价方案", "免费额度与限制", "性价比分析", "竞品价格对比"],
    subqueryTemplates: [
      "{entity} 价格 定价方案",
      "{entity} 免费版 额度 限制",
      "{entity} 性价比 值不值",
      "{entity} 竞品 价格对比",
    ],
    siteTypes: ["search_engine", "zhihu", "reddit"],
  },
  troubleshooting: {
    aspects: ["常见错误与原因", "解决方案与步骤", "官方文档与社区讨论"],
    subqueryTemplates: [
      "{entity} 常见错误 原因",
      "{entity} 问题解决 修复方法",
      "{entity} 官方文档 解决方案",
    ],
    siteTypes: ["search_engine", "github", "stackoverflow", "v2ex"],
  },
  tutorial: {
    aspects: ["入门步骤", "配置与安装", "最佳实践", "常见问题"],
    subqueryTemplates: [
      "{entity} 入门教程 快速上手",
      "{entity} 安装 配置步骤",
      "{entity} 最佳实践 示例",
    ],
    siteTypes: ["search_engine", "youtube", "github", "docs"],
  },
  solution_design: {
    aspects: ["架构设计方案", "技术选型对比", "实施步骤", "最佳实践"],
    subqueryTemplates: [
      "{entity} 架构设计 方案",
      "{entity} 技术选型 对比",
      "{entity} 实施步骤 最佳实践",
    ],
    siteTypes: ["search_engine", "github", "docs", "v2ex"],
  },
  general: {
    aspects: ["概览与核心信息", "关键特性", "使用场景"],
    subqueryTemplates: [
      "{entity} 概览 介绍",
      "{entity} 核心特性 功能",
      "{entity} 典型使用场景",
    ],
    siteTypes: ["search_engine"],
  },
};

// ─── Site Type Keyword Rules (kept for user-specified overrides) ───

const SITE_KEYWORD_RULES: Array<{ keywords: string[]; sites: string[] }> = [
  { keywords: ["经验", "推荐", "测评", "好用", "对比", "review", "recommend"], sites: ["zhihu", "xiaohongshu"] },
  { keywords: ["新闻", "最新", "发布", "新闻", "news", "latest", "release"], sites: ["news", "search_engine"] },
  { keywords: ["代码", "开源", "github", "api", "sdk", "库", "library"], sites: ["github", "search_engine"] },
  { keywords: ["视频", "教程", "教程", "tutorial", "howto", "教学"], sites: ["youtube", "bilibili"] },
  { keywords: ["讨论", "社区", "问答", "forum", "discussion"], sites: ["v2ex", "reddit", "zhihu"] },
  { keywords: ["文档", "文档", "reference", "docs", "specification"], sites: ["search_engine"] },
];

/**
 * Extract the primary entity (subject) from a query.
 * Strips common question words and trailing modifiers.
 */
function extractEntity(query: string): string {
  let entity = query
    .replace(/[？?]/g, "")
    .replace(/^(什么是|什么|怎么|如何|为什么|请问|问一下|帮我查|查一下|告诉我|我想把|我想|想把|帮我|请帮我)/i, "")
    .replace(/(是什么|怎么样|怎么用|如何使用|有哪些|好不好|值不值|靠谱吗)$/i, "")
    .trim();

  const comparisonMatch = entity.match(/^(.+?)(?:\s*[和与跟]\s*|\s+vs\.?\s+|\s+versus\s+)(.+?)(?:哪个|谁|更|更适合|更好|更强|更值得|$)/i);
  if (comparisonMatch) {
    return `${comparisonMatch[1].trim()} vs ${comparisonMatch[2].trim()}`;
  }

  const technicalPhraseMatch = entity.match(/([A-Za-z][A-Za-z0-9.+\-/]*(?:\s+[A-Za-z][A-Za-z0-9.+\-/]*){0,3})/g);
  if (technicalPhraseMatch && technicalPhraseMatch.length > 0) {
    const meaningful = technicalPhraseMatch.find((p) => p.length >= 3 && !/^(how|what|which|when|where)$/i.test(p));
    if (meaningful) return meaningful.trim();
  }

  const mixedPhraseMatch = entity.match(/((?:[A-Za-z][A-Za-z0-9.+\-/]*\s*){1,4}(?:SaaS|API|SDK|Next\.js|Vercel|OpenAI|Cursor|Windsurf|Claude|RAG|observability)?)/i);
  if (mixedPhraseMatch && mixedPhraseMatch[1]?.trim()) {
    return mixedPhraseMatch[1].trim();
  }

  const cnNounPhraseMatch = entity.match(/^([\u4e00-\u9fa5A-Za-z0-9.+\-/]{2,24}?)(?:\s*(部署到|如何|怎么|方案|架构|设计|实现|支持|比较|对比|哪个|是否|有何|有哪些)|$)/);
  if (cnNounPhraseMatch) return cnNounPhraseMatch[1].trim();

  const cnMatch = entity.match(/^([\u4e00-\u9fa5]{2,12})/);
  if (cnMatch) return cnMatch[1];
  const enMatch = entity.match(/^(\w+(?:\s+\w+){0,3})/);
  if (enMatch) return enMatch[1];
  return entity.slice(0, 24);
}

/**
 * Generate sub-queries from templates, replacing placeholders.
 */
function generateSubQueriesFromTemplates(entity: string, templates: string[]): string[] {
  return templates
    .map((t) => t.replace(/\{entity\}/g, entity))
    .slice(0, 5);
}

/**
 * Suggest site types based on query type + keyword rules.
 */
function suggestSiteTypes(queryType: QueryType, query: string): string[] {
  const sites = new Set<string>(DIMENSION_TEMPLATES[queryType].siteTypes);
  const lower = query.toLowerCase();

  for (const rule of SITE_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      for (const site of rule.sites) sites.add(site);
    }
  }

  return Array.from(sites);
}

/**
 * Plan research for a given query.
 * Returns a structured research plan with aspects, sub-queries, and suggestions.
 */
export function planResearch(params: {
  query: string;
  context?: string;
  includeSites?: string[];
  engines?: string[];
}): PlanResearchOutput {
  const { query, context, includeSites, engines } = params;

  const queryType = classifyQuery(query);
  const entity = extractEntity(query);
  const template = DIMENSION_TEMPLATES[queryType];

  const aspects = [...template.aspects];
  const initialSubQueries = generateSubQueriesFromTemplates(entity, template.subqueryTemplates);
  const suggestedSiteTypes = suggestSiteTypes(queryType, query);

  // Merge user-specified sites
  if (includeSites && includeSites.length > 0) {
    for (const site of includeSites) {
      if (!suggestedSiteTypes.includes(site)) {
        suggestedSiteTypes.push(site);
      }
    }
  }

  const suggestedEngines = engines && engines.length > 0 ? [...engines] : ["tavily"];

  const queryTypeLabels: Record<QueryType, string> = {
    factual: "事实性查询",
    comparison: "对比性查询",
    latest: "最新动态查询",
    solution_design: "方案设计查询",
    troubleshooting: "问题排查查询",
    pricing: "价格/费用查询",
    tutorial: "教程/操作查询",
    general: "通用查询",
  };

  const planningNotes = context
    ? `识别为${queryTypeLabels[queryType]}。提取实体: "${entity}"。基于 ${aspects.length} 个研究维度进行分析。已提供上下文信息。建议使用 ${suggestedSiteTypes.join("、")} 类型的站点。`
    : `识别为${queryTypeLabels[queryType]}。提取实体: "${entity}"。基于 ${aspects.length} 个研究维度进行分析。建议使用 ${suggestedSiteTypes.join("、")} 类型的站点。`;

  return {
    originalQuery: query,
    researchPlan: {
      originalQuery: query,
      aspects,
      initialSubQueries,
      suggestedSiteTypes,
      suggestedEngines,
      planningNotes,
    },
  };
}

// Export helpers for testing
export { classifyQuery, extractEntity };
