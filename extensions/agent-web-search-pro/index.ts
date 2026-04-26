import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, truncateHead } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ─── Types ───
import type {
  AgentWebSearchProState,
  SearchRequestMeta,
  SearchMode,
  SearchResultPayload,
  SearchCandidate,
} from "./types.js";

// ─── Providers ───
import { callTavilySearch } from "./providers/tavily.js";
import { callJinaReader } from "./providers/jina-reader.js";

// ─── Utils ───
import { loadState, saveState, removeState, DEFAULT_STATE } from "./utils/state.js";
import { buildPayload } from "./utils/results.js";
import { detectMode, buildRequestMeta } from "./utils/request.js";
import { buildProgressText } from "./utils/progress.js";
import { formatCommandResult, formatTextResult, formatTruncatedResult } from "./utils/formatting.js";

// ─── Workflow ───
import { planResearch } from "./workflow/plan-research.js";
import { executeSearchRound } from "./workflow/search-round.js";
import { browsePages } from "./workflow/browse-pages.js";
import { judgeSufficiency } from "./workflow/synthesize-research.js";
import { runResearch } from "./workflow/research-loop.js";

// ─── Constants ───
const TOOL_SEARCH = "ext_agent_web_search_pro_search";
const TOOL_PLAN = "ext_agent_web_search_pro_plan_research";
const TOOL_BROWSE = "ext_agent_web_search_pro_browse_pages";
const TOOL_SYNTHESIZE = "ext_agent_web_search_pro_synthesize_research";
const TOOL_RUN_RESEARCH = "ext_agent_web_search_pro_run_research";
const TOOL_RESET = "ext_agent_web_search_pro_reset_state";
const TOOL_STATUS = "ext_agent_web_search_pro_get_last_state";
const COMMAND_NAME = "web-search-pro";

// ─── Legacy flow (kept for backward compatibility) ───
async function executeSearchLikeFlow(
  input: { query?: string; url?: string; site?: string; language?: string; limit?: number; deepRead?: boolean; sort?: string },
  progress?: (message: string, details?: Record<string, unknown>) => void,
) {
  const state = await loadState();
  const mode = detectMode(input);
  const request = buildRequestMeta({ ...input, mode });

  progress?.(
    buildProgressText({ stage: "请求已接收", mode: request.mode, query: request.query, url: request.url, site: request.site }),
    { mode: request.mode, query: request.query, url: request.url, site: request.site, limit: request.limit, deepRead: request.deepRead },
  );

  const { payload, v2Output } = await executeSearchRound(request, (message, details) => {
    progress?.(message, details);
  });

  const nextState: AgentWebSearchProState = {
    ...state,
    currentStep: state.currentStep + 1,
    lastMode: payload.mode,
    lastQuery: payload.request.query,
    lastUrl: payload.request.url,
    lastResultCount: payload.resultCount,
    lastSummary: payload.summary,
    lastProvider: payload.provider,
  };
  await saveState(nextState);
  return { payload, state: nextState, v2Output };
}

// ─── Extension Entry ───
export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const state = await loadState();
    try {
      await saveState(state);
    } catch {
      ctx.ui.notify("web-search-pro could not persist state.", "warning");
    }
  });

  // ══════════════════════════════════════════════════════════
  // V2 WORKFLOW TOOLS
  // ══════════════════════════════════════════════════════════

  // ─── 1. plan_research ───
  pi.registerTool({
    name: TOOL_PLAN,
    label: "Plan Research",
    description: "分析研究问题，生成研究计划：包括研究维度、子查询、建议站点类型和搜索引擎。",
    parameters: Type.Object({
      query: Type.String({ description: "研究问题" }),
      context: Type.Optional(Type.String({ description: "已有背景信息" })),
      includeSites: Type.Optional(Type.Array(Type.String(), { description: "强制包含的站点类型" })),
      engines: Type.Optional(Type.Array(Type.String(), { description: "指定使用的搜索引擎列表" })),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      onUpdate?.({
        content: [{ type: "text", text: `正在规划研究: ${params.query}` }],
        details: { phase: "planning", query: params.query },
      });

      const result = planResearch({
        query: params.query,
        context: params.context,
        includeSites: params.includeSites,
        engines: params.engines,
      });

      const state = await loadState();
      await saveState({ ...state, currentStep: state.currentStep + 1, lastQuery: params.query });

      return {
        content: [{
          type: "text",
          text: [
            `📋 研究计划: ${params.query}`,
            ``,
            `研究维度 (${result.researchPlan.aspects.length}):`,
            ...result.researchPlan.aspects.map((a, i) => `  ${i + 1}. ${a}`),
            ``,
            `建议子查询:`,
            ...result.researchPlan.initialSubQueries.map((q, i) => `  ${i + 1}. ${q}`),
            ``,
            `建议站点类型: ${result.researchPlan.suggestedSiteTypes.join(", ")}`,
            `建议搜索引擎: ${result.researchPlan.suggestedEngines.join(", ")}`,
            ``,
            result.researchPlan.planningNotes ? `备注: ${result.researchPlan.planningNotes}` : "",
          ].filter(Boolean).join("\n"),
        }],
        details: result,
      };
    },
  });

  // ─── 2. search (v2: candidate discovery) ───
  pi.registerTool({
    name: TOOL_SEARCH,
    label: "Web Search Pro",
    description: "执行通用搜索、URL 阅读或站点定向搜索，返回结构化摘要、结果预览与来源。If evidenceStatus=none or shouldNotInferFacts=true, do not infer product facts from this result.",
    parameters: Type.Object({
      query: Type.Optional(Type.String({ description: "搜索查询；若为 URL 则进入 URL 阅读模式" })),
      url: Type.Optional(Type.String({ description: "要读取的 URL；提供时优先进入 URL 阅读模式" })),
      site: Type.Optional(Type.String({ description: "站点过滤，如 github.com、youtube.com、x.com、v2ex.com" })),
      language: Type.Optional(Type.String({ description: "查询语言，如 zh-CN 或 en" })),
      limit: Type.Optional(Type.Number({ description: "结果数量上限（1-10）" })),
      deepRead: Type.Optional(Type.Boolean({ description: "是否对候选结果执行进一步阅读提取" })),
      sort: Type.Optional(Type.String({ description: "排序偏好，例如 relevance 或 recent" })),
    }),
    async execute(_toolCallId, params, _signal, onUpdate, _ctx) {
      onUpdate?.({
        content: [{
          type: "text",
          text: buildProgressText({
            stage: "工具已启动",
            mode: detectMode(params),
            query: params.query,
            url: params.url,
            site: params.site,
          }),
        }],
        details: { phase: "start", mode: detectMode(params) },
      });

      const { payload, v2Output } = await executeSearchLikeFlow(params, (message, details) => {
        onUpdate?.({ content: [{ type: "text", text: message }], details });
      });

      return {
        content: [{ type: "text", text: formatTruncatedResult(formatTextResult(payload)) }],
        details: {
          // Legacy fields (backward compatible)
          request: payload.request,
          provider: payload.provider,
          summary: payload.summary,
          resultCount: payload.resultCount,
          citationsCount: payload.citationsCount,
          topResultsPreview: payload.topResultsPreview,
          results: payload.results,
          citations: payload.citations,
          degraded: payload.degraded,
          error: payload.error,
          responseTimeMs: payload.responseTimeMs,
          deepReadCount: payload.deepReadCount,
          evidenceStatus: payload.evidenceStatus,
          shouldNotInferFacts: payload.shouldNotInferFacts,
          authoritative: payload.authoritative,
          antiHallucinationWarning: payload.antiHallucinationWarning,
          // V2 workflow fields
          searchMeta: v2Output.searchMeta,
          webResults: v2Output.webResults,
          recommendedToBrowse: v2Output.recommendedToBrowse,
          researchStatus: v2Output.researchStatus,
        },
      };
    },
  });

  // ─── 3. browse_pages ───
  pi.registerTool({
    name: TOOL_BROWSE,
    label: "Browse Pages",
    description: "读取指定 URL 列表，提取页面中的关键事实、引用和摘要，返回结构化分析结果。",
    parameters: Type.Object({
      focusQuery: Type.String({ description: "研究焦点查询，用于相关性评估" }),
      urls: Type.Array(Type.String(), { description: "要读取的 URL 列表" }),
      maxPages: Type.Optional(Type.Number({ description: "最大读取页面数（默认 5）" })),
      backupCandidates: Type.Optional(Type.Array(Type.Object({
        title: Type.String(),
        url: Type.String(),
        snippet: Type.String(),
        source: Type.Optional(Type.String()),
        score: Type.Optional(Type.Number()),
        deepReadApplied: Type.Optional(Type.Boolean()),
      }), { description: "备选候选页面（当主页面失败时用于替代）" })),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      onUpdate?.({
        content: [{ type: "text", text: `正在读取 ${params.urls.length} 个页面...` }],
        details: { phase: "browse", urlCount: params.urls.length },
      });

      const result = await browsePages({
        focusQuery: params.focusQuery,
        urls: params.urls,
        maxPages: params.maxPages,
        backupCandidates: params.backupCandidates as SearchCandidate[] | undefined,
        onUpdate: (message, details) => {
          onUpdate?.({ content: [{ type: "text", text: message }], details });
        },
      });

      const state = await loadState();
      await saveState({ ...state, currentStep: state.currentStep + 1 });

      const summaryLines = [
        `📖 页面读取完成`,
        `焦点查询: ${result.browseMeta.focusQuery}`,
        `请求页面: ${result.browseMeta.urlsRequested}`,
        `成功: ${result.browseMeta.urlsSucceeded}`,
        `失败: ${result.browseMeta.urlsFailed}`,
        `采纳知识: ${result.adoptedKnowledge.length} 条`,
      ];

      if (result.fallbackUsed && result.fallbackUsed > 0) {
        summaryLines.push(`备选替代: ${result.fallbackUsed} 次`);
      }

      summaryLines.push(``, "页面分析:");

      for (const page of result.pageAnalyses) {
        summaryLines.push(`  • ${page.title} (${page.url})`);
        summaryLines.push(`    相关性: ${(page.relevanceScore * 100).toFixed(0)}%`);
        if (page.keyFacts.length > 0) {
          summaryLines.push(`    关键事实: ${page.keyFacts.slice(0, 2).join("; ")}`);
        }
        if (page.fetchError) {
          summaryLines.push(`    错误: ${page.fetchError}`);
        }
      }

      if (result.fallbackAttempts && result.fallbackAttempts.length > 0) {
        summaryLines.push(``, "备选尝试:");
        for (const attempt of result.fallbackAttempts) {
          summaryLines.push(`  ${attempt.fallbackSuccess ? "✅" : "❌"} ${attempt.originalFailedUrl} → ${attempt.fallbackUrl}`);
        }
      }

      return {
        content: [{ type: "text", text: formatTruncatedResult(summaryLines.join("\n")) }],
        details: result,
      };
    },
  });

  // ─── 4. synthesize_research ───
  pi.registerTool({
    name: TOOL_SYNTHESIZE,
    label: "Synthesize Research",
    description: "综合已有知识，判断信息是否充分，列出覆盖的维度、缺失的信息点和差距。",
    parameters: Type.Object({
      originalQuery: Type.String({ description: "原始研究问题" }),
      knowledge: Type.Array(Type.Object({
        sourceUrl: Type.String(),
        title: Type.String(),
        summary: Type.String(),
        keyFacts: Type.Array(Type.String()),
        relevanceScore: Type.Number(),
        adopted: Type.Boolean(),
      }), { description: "已收集的知识条目列表" }),
      aspects: Type.Optional(Type.Array(Type.String(), { description: "研究维度列表（可选）" })),
      round: Type.Optional(Type.Number({ description: "当前轮次（可选）" })),
      maxRounds: Type.Optional(Type.Number({ description: "最大轮次（可选，默认 5）" })),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      onUpdate?.({
        content: [{ type: "text", text: `正在综合研究结果: ${params.originalQuery}` }],
        details: { phase: "synthesize", knowledgeCount: params.knowledge.length },
      });

      const result = judgeSufficiency({
        originalQuery: params.originalQuery,
        knowledge: params.knowledge,
        plan: params.aspects ? { originalQuery: params.originalQuery, aspects: params.aspects, initialSubQueries: [], suggestedSiteTypes: [], suggestedEngines: [] } : undefined,
        round: params.round,
        maxRounds: params.maxRounds,
      });

      const state = await loadState();
      await saveState({ ...state, currentStep: state.currentStep + 1 });

      const summaryLines = [
        `🔬 研究综合结果`,
        ``,
        `信息充分: ${result.sufficient ? "✅ 是" : "❌ 否"}`,
        `置信度: ${(result.confidence * 100).toFixed(0)}%`,
        ``,
        `已覆盖维度 (${result.coveredAspects.length}):`,
        ...result.coveredAspects.map((a) => `  ✓ ${a}`),
        ``,
        `缺失维度 (${result.missingAspects.length}):`,
        ...result.missingAspects.map((a) => `  ✗ ${a}`),
        ``,
        `信息差距 (${result.gaps.length}):`,
        ...result.gaps.map((g) => `  • [${g.type}] ${g.description}`),
      ];

      if (result.answer) {
        summaryLines.push(``, `📝 综合回答:`, result.answer);
      }

      if (result.nextSuggestedSubQueries) {
        summaryLines.push(``, `🔍 建议下一步查询:`, ...result.nextSuggestedSubQueries.map((q) => `  • ${q}`));
      }

      return {
        content: [{ type: "text", text: formatTruncatedResult(summaryLines.join("\n")) }],
        details: result,
      };
    },
  });

  // ─── 5. run_research (Phase 2 high-level orchestrator) ───
  pi.registerTool({
    name: TOOL_RUN_RESEARCH,
    label: "Run Bounded Research",
    description: "运行 Phase 2 有界多轮研究流程：自动规划、搜索、浏览、综合、补 gap，并给出停止原因。",
    parameters: Type.Object({
      query: Type.String({ description: "原始研究问题" }),
      maxRounds: Type.Optional(Type.Number({ description: "最大研究轮次（默认 3）" })),
      confidenceThreshold: Type.Optional(Type.Number({ description: "提前停止的置信度阈值（默认 0.65）" })),
      stagnationLimit: Type.Optional(Type.Number({ description: "无新增知识的停滞轮次阈值（默认 2）" })),
      browseLimit: Type.Optional(Type.Number({ description: "每轮最多浏览页面数（默认 3）" })),
    }),
    async execute(_toolCallId, params, _signal, onUpdate) {
      onUpdate?.({
        content: [{ type: "text", text: `开始 Phase 2 多轮研究: ${params.query}` }],
        details: { phase: "run-research-start", query: params.query },
      });

      const result = await runResearch(params.query, {
        maxRounds: params.maxRounds,
        confidenceThreshold: params.confidenceThreshold,
        stagnationLimit: params.stagnationLimit,
        browseLimit: params.browseLimit,
        onUpdate: (message, details) => {
          onUpdate?.({ content: [{ type: "text", text: message }], details });
        },
      });

      const state = await loadState();
      await saveState({
        ...state,
        currentStep: state.currentStep + 1,
        lastQuery: params.query,
        lastSummary: result.explanation,
      });

      const summaryLines = [
        `🧭 Phase 2 多轮研究完成`,
        ``,
        `问题: ${params.query}`,
        `轮次: ${result.state.round}/${result.state.maxRounds}`,
        `信息充分: ${result.sufficient ? "✅ 是" : "❌ 否"}`,
        `置信度: ${(result.confidence * 100).toFixed(0)}%`,
        `停止原因: ${result.terminationReason}`,
        `说明: ${result.explanation}`,
        `累计知识: ${result.knowledge.length} 条`,
        ``,
        `📝 最终回答:`,
        result.answer,
      ];

      if (result.roundRecords.length > 0) {
        summaryLines.push(``, `回合记录:`);
        for (const round of result.roundRecords) {
          summaryLines.push(
            `  • Round ${round.round}: query=${round.query}, candidates=${round.candidatesFound}, browsed=${round.pagesBrowsed}, adopted=${round.knowledgeAdopted}, confidence=${(round.confidence * 100).toFixed(0)}%`,
          );
        }
      }

      return {
        content: [{ type: "text", text: formatTruncatedResult(summaryLines.join("\n")) }],
        details: result,
      };
    },
  });

  // ══════════════════════════════════════════════════════════
  // COMMAND (human-facing entry)
  // ══════════════════════════════════════════════════════════
  pi.registerCommand(COMMAND_NAME, {
    description: "执行增强型 Web 搜索或读取 URL，并输出带来源的结构化结果",
    handler: async (args, ctx) => {
      const raw = args?.trim();
      if (!raw) {
        ctx.ui.notify("用法: /web-search-pro <query-or-url>", "info");
        return;
      }
      const deepRead = /\s--deep-read\b/.test(raw);
      const query = raw.replace(/\s--deep-read\b/g, "").trim();
      ctx.ui.notify(`收到请求: ${query}`, "info");
      const { payload } = await executeSearchLikeFlow({ query, deepRead }, (message, details) => {
        const suffix = details?.resultCount !== undefined ? `（结果数: ${details.resultCount}）` : "";
        ctx.ui.notify(`${message}${suffix}`, "info");
      });
      ctx.ui.notify(payload.degraded ? `已返回降级结果：${payload.summary}` : `完成：找到 ${payload.resultCount} 条结果`, payload.degraded ? "warning" : "success");
      return formatTruncatedResult(formatCommandResult(payload));
    },
  });

  // ══════════════════════════════════════════════════════════
  // UTILITY TOOLS
  // ══════════════════════════════════════════════════════════
  pi.registerTool({
    name: TOOL_STATUS,
    label: "Get Web Search Pro Last State",
    description: "读取 web-search-pro 最近一次请求状态，便于调试与体验迭代。",
    parameters: Type.Object({}),
    async execute() {
      const state = await loadState();
      return {
        content: [{ type: "text", text: formatTruncatedResult([
          "lastState:",
          `- currentStep: ${state.currentStep}`,
          `- startedAt: ${state.startedAt}`,
          `- lastMode: ${state.lastMode ?? ""}`,
          `- lastProvider: ${state.lastProvider ?? ""}`,
          `- lastQuery: ${state.lastQuery ?? ""}`,
          `- lastUrl: ${state.lastUrl ?? ""}`,
          `- lastResultCount: ${state.lastResultCount ?? 0}`,
          `- lastSummary: ${state.lastSummary ?? ""}`,
        ].join("\n")) }],
        details: state,
      };
    },
  });

  pi.registerTool({
    name: TOOL_RESET,
    label: "Reset Web Search Pro State",
    description: "清除 web-search-pro 扩展的外部状态文件。",
    parameters: Type.Object({}),
    async execute() {
      await removeState();
      return { content: [{ type: "text", text: "State cleared." }], details: { cleared: true } };
    },
  });
}
