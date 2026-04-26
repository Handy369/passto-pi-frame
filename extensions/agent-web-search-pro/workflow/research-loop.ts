// ============================================================
// agent-web-search-pro v2 — Bounded Research Loop Orchestrator (Phase 2)
// ============================================================
// High-level orchestrator that runs a bounded, serial, gap-driven
// multi-round research workflow.
//
// Responsibilities:
// 1. Plan research (once)
// 2. Execute round 1 with original query
// 3. Evaluate sufficiency → decide continue/stop
// 4. If continue: generate next query from gaps → execute round N
// 5. Accumulate knowledge, mark gaps as queried
// 6. Stop on termination condition
//
// Non-goals for this phase:
// - No concurrency
// - No LLM-native query generation
// - No persistent memory across sessions
// - No advanced optimization

import type {
  ResearchState,
  ResearchGap,
  AskedQuery,
  RoundRecord,
  KnowledgeItem,
  ResearchPlan,
  SearchCandidate,
  TerminationReason,
  SearchRequestMeta,
} from "../types.js";
import type { SearchRoundOutput } from "../types.js";
import type { BrowsePagesOutput } from "../types.js";
import type { SynthesizeResearchOutput } from "../types.js";
import type { TerminationDecision } from "./termination.js";
import type { NextQueryResult } from "./generate-next-queries.js";

import { planResearch } from "./plan-research.js";
import { executeSearchRound } from "./search-round.js";
import { browsePages } from "./browse-pages.js";
import { judgeSufficiency } from "./synthesize-research.js";
import { evaluateTermination, buildRoundRecord } from "./termination.js";
import { generateNextQueries } from "./generate-next-queries.js";

// ─── Configuration ───

const DEFAULT_MAX_ROUNDS = 3;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;
const DEFAULT_STAGNATION_LIMIT = 2;
const DEFAULT_BROWSE_LIMIT = 3;

// ─── Public API ───

export interface ResearchLoopOptions {
  /** Maximum research rounds (default: 3) */
  maxRounds?: number;
  /** Confidence threshold for early termination (default: 0.65) */
  confidenceThreshold?: number;
  /** Stagnation limit: consecutive rounds with no new knowledge (default: 2) */
  stagnationLimit?: number;
  /** Max URLs to browse per round (default: 3) */
  browseLimit?: number;
  /** Optional callback for progress updates */
  onUpdate?: (message: string, details?: Record<string, unknown>) => void;
}

export interface ResearchLoopResult {
  /** Final synthesized answer */
  answer: string;
  /** Final confidence (0–1) */
  confidence: number;
  /** Whether the information was judged sufficient */
  sufficient: boolean;
  /** Why the loop stopped */
  terminationReason: TerminationReason;
  /** Complete research state */
  state: ResearchState;
  /** Round-by-round summary records */
  roundRecords: RoundRecord[];
  /** All knowledge items collected */
  knowledge: KnowledgeItem[];
  /** Final termination explanation */
  explanation: string;
}

/**
 * Run a bounded, serial, gap-driven multi-round research loop.
 *
 * This is the Phase 2 high-level orchestrator. It chains together:
 * planResearch → executeSearchRound → browsePages → judgeSufficiency →
 * evaluateTermination → generateNextQueries → (next round)
 *
 * @param query — the user's research query
 * @param options — optional configuration
 * @returns ResearchLoopResult with answer, state, and termination info
 */
export async function runResearch(
  query: string,
  options?: ResearchLoopOptions,
): Promise<ResearchLoopResult> {
  const maxRounds = options?.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const confidenceThreshold = options?.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
  const stagnationLimit = options?.stagnationLimit ?? DEFAULT_STAGNATION_LIMIT;
  const browseLimit = options?.browseLimit ?? DEFAULT_BROWSE_LIMIT;
  const onUpdate = options?.onUpdate;

  // ── Initialize research state ──
  const state: ResearchState = {
    originalQuery: query,
    plan: undefined,
    knowledge: [],
    searchedUrls: [],
    askedQueries: [],
    roundRecords: [],
    round: 0,
    maxRounds,
    isComplete: false,
    terminationReason: undefined,
  };

  // ── Step 1: Plan research (once) ──
  onUpdate?.(`📋 正在规划研究: ${query}`, { phase: "plan", query });
  const planResult = planResearch({ query });
  state.plan = planResult.researchPlan;

  onUpdate?.(
    `研究计划已生成: ${planResult.researchPlan.aspects.length} 个维度, ${planResult.researchPlan.initialSubQueries.length} 个子查询`,
    { phase: "plan-complete", aspects: planResult.researchPlan.aspects },
  );

  // ── Round 1 query: use the first suggested sub-query ──
  let currentQuery = planResult.researchPlan.initialSubQueries[0] || query;

  // ── Main loop ──
  let synthesizeOutput: SynthesizeResearchOutput | undefined;
  let terminationDecision: TerminationDecision | undefined;

  for (let round = 1; round <= maxRounds; round++) {
    state.round = round;

    onUpdate?.(`\n━━━ 第 ${round} 轮研究 ━━━`, { phase: "round-start", round });
    onUpdate?.(`查询: ${currentQuery}`, { phase: "round-query", round, query: currentQuery });

    // ── Step 2: Execute search round ──
    const searchRequest: SearchRequestMeta = {
      mode: "search",
      query: currentQuery,
      language: detectLanguage(query),
      limit: 5,
      deepRead: false,
    };

    onUpdate?.(`🔍 正在搜索: ${currentQuery}`, { phase: "search", round, query: currentQuery });
    const searchResult: { payload: any; v2Output: SearchRoundOutput } = await executeSearchRound(
      searchRequest,
      (message, details) => onUpdate?.(message, details),
    );

    const candidates = searchResult.v2Output.webResults;
    const recommendedToBrowse = searchResult.v2Output.recommendedToBrowse.slice(0, browseLimit);

    onUpdate?.(
      `搜索完成: 找到 ${candidates.length} 个候选, 推荐浏览 ${recommendedToBrowse.length} 个页面`,
      { phase: "search-complete", round, candidatesFound: candidates.length },
    );

    // ── Step 3: Browse recommended pages ──
    let adoptedKnowledge: KnowledgeItem[] = [];
    let pagesBrowsedCount = 0;

    if (recommendedToBrowse.length > 0) {
      const browseUrls = recommendedToBrowse.map((p) => p.url);
      onUpdate?.(`📖 正在读取 ${browseUrls.length} 个页面...`, { phase: "browse", round, urlCount: browseUrls.length });

      const browseResult: BrowsePagesOutput = await browsePages({
        focusQuery: currentQuery,
        urls: browseUrls,
        maxPages: browseLimit,
        backupCandidates: candidates as SearchCandidate[],
        onUpdate: (message, details) => onUpdate?.(message, details),
      });

      adoptedKnowledge = browseResult.adoptedKnowledge;
      pagesBrowsedCount = browseResult.pageAnalyses.length;

      // Track searched URLs
      for (const url of browseUrls) {
        if (!state.searchedUrls.includes(url)) {
          state.searchedUrls.push(url);
        }
      }
      for (const pa of browseResult.pageAnalyses) {
        if (!state.searchedUrls.includes(pa.url)) {
          state.searchedUrls.push(pa.url);
        }
      }

      onUpdate?.(
        `浏览完成: 采纳 ${adoptedKnowledge.length} 条知识`,
        { phase: "browse-complete", round, adopted: adoptedKnowledge.length },
      );
    } else {
      onUpdate?.(`⚠️ 无推荐页面可浏览`, { phase: "browse-skipped", round });
    }

    // ── Step 4: Merge knowledge into state ──
    const newKnowledge = mergeKnowledge(state.knowledge, adoptedKnowledge, round);
    state.knowledge = newKnowledge;

    // ── Step 5: Synthesize / judge sufficiency ──
    onUpdate?.(`🔬 正在综合研究结果...`, { phase: "synthesize", round });
    synthesizeOutput = judgeSufficiency({
      originalQuery: query,
      knowledge: state.knowledge,
      plan: state.plan,
      round,
      maxRounds,
    });

    onUpdate?.(
      `综合完成: confidence=${(synthesizeOutput.confidence * 100).toFixed(0)}%, sufficient=${synthesizeOutput.sufficient}, gaps=${synthesizeOutput.gaps.length}`,
      { phase: "synthesize-complete", round, confidence: synthesizeOutput.confidence, gaps: synthesizeOutput.gaps.length },
    );

    // ── Step 6: Mark gaps as queried (based on current round's queries) ──
    markGapsAsQueried(synthesizeOutput.gaps, state.askedQueries, round);

    // ── Step 7: Build round record ──
    const roundRecord = buildRoundRecord(
      round,
      currentQuery,
      candidates.length,
      pagesBrowsedCount,
      adoptedKnowledge.length,
      synthesizeOutput,
    );
    state.roundRecords.push(roundRecord);

    // ── Step 8: Evaluate termination ──
    terminationDecision = evaluateTermination(state, synthesizeOutput, {
      maxRounds,
      confidenceThreshold,
      stagnationLimit,
    });

    onUpdate?.(
      terminationDecision.shouldStop
        ? `⏹️ 停止条件满足: ${terminationDecision.reason} — ${terminationDecision.explanation}`
        : `▶️ 继续研究: ${terminationDecision.explanation}`,
      { phase: "termination", round, shouldStop: terminationDecision.shouldStop, reason: terminationDecision.reason },
    );

    if (terminationDecision.shouldStop) {
      state.isComplete = true;
      state.terminationReason = terminationDecision.reason;
      break;
    }

    // ── Step 9: Generate next query from gaps ──
    const nextQueryResult: NextQueryResult = generateNextQueries(
      synthesizeOutput.gaps,
      state.askedQueries,
      query,
      { maxQueries: 1 }, // Generate only 1 query for bounded serial loop
    );

    if (nextQueryResult.queries.length === 0) {
      // No more queries to try — stop
      state.isComplete = true;
      state.terminationReason = "no_actionable_gaps";
      terminationDecision.reason = "no_actionable_gaps";
      terminationDecision.shouldStop = true;
      terminationDecision.explanation = "无法生成更多有效查询";
      onUpdate?.(`⏹️ 无更多查询可执行`, { phase: "no-more-queries", round });
      break;
    }

    currentQuery = nextQueryResult.queries[0];

    // Record the query as asked (will be updated with knowledge count after next round)
    state.askedQueries.push({
      query: currentQuery,
      round,
      sourceGapDescriptions: nextQueryResult.sourceGaps.map((g) => g.description),
      knowledgeCount: 0, // Will be updated after next round's browse
    });
  }

  // ── Finalize ──
  if (!state.isComplete) {
    state.isComplete = true;
    state.terminationReason = terminationDecision?.reason ?? "max_rounds_reached";
  }

  const finalAnswer = synthesizeOutput?.answer ?? `未能获取关于 "${query}" 的有效信息。`;
  const finalConfidence = synthesizeOutput?.confidence ?? 0;
  const finalSufficient = synthesizeOutput?.sufficient ?? false;
  const finalReason = state.terminationReason ?? "max_rounds_reached";
  const finalExplanation = terminationDecision?.explanation ?? `已完成 ${state.round} 轮研究`;

  return {
    answer: finalAnswer,
    confidence: finalConfidence,
    sufficient: finalSufficient,
    terminationReason: finalReason,
    state,
    roundRecords: state.roundRecords,
    knowledge: state.knowledge,
    explanation: finalExplanation,
  };
}

// ─── Knowledge Merging ───

/**
 * Merge new knowledge items into existing knowledge pool.
 * Deduplicates by sourceUrl to avoid duplicate entries.
 * Updates existing entries if new version has higher relevance.
 */
function mergeKnowledge(
  existing: KnowledgeItem[],
  newItems: KnowledgeItem[],
  round: number,
): KnowledgeItem[] {
  const existingMap = new Map<string, KnowledgeItem>();
  for (const k of existing) {
    existingMap.set(k.sourceUrl, k);
  }

  for (const newItem of newItems) {
    const existingItem = existingMap.get(newItem.sourceUrl);
    if (existingItem) {
      // Update if new item has higher relevance
      if (newItem.relevanceScore > existingItem.relevanceScore) {
        existingMap.set(newItem.sourceUrl, {
          ...newItem,
          adopted: true,
          round,
        });
      }
      // Merge key facts (deduplicated)
      const mergedFacts = [...new Set([...existingItem.keyFacts, ...newItem.keyFacts])];
      existingItem.keyFacts = mergedFacts.slice(0, 20); // Cap at 20 facts per source
    } else {
      existingMap.set(newItem.sourceUrl, {
        ...newItem,
        adopted: true,
        round,
      });
    }
  }

  return Array.from(existingMap.values()).sort(
    (a, b) => b.relevanceScore - a.relevanceScore,
  );
}

// ─── Gap Tracking ───

/**
 * Mark gaps as queried based on the asked queries history.
 * If a gap's suggestedQuery matches an asked query, mark it as queried.
 * Also marks gaps from the current round.
 */
function markGapsAsQueried(
  gaps: ResearchGap[],
  askedQueries: AskedQuery[],
  currentRound: number,
): void {
  const askedQueryTexts = new Set(askedQueries.map((q) => q.query.toLowerCase()));

  for (const gap of gaps) {
    // Mark as queried if:
    // 1. Its suggestedQuery has been asked, OR
    // 2. It was identified in the current round (we're about to move on)
    if (gap.suggestedQuery && askedQueryTexts.has(gap.suggestedQuery.toLowerCase())) {
      gap.queried = true;
    } else if (gap.identifiedInRound !== undefined && gap.identifiedInRound < currentRound) {
      // Gaps from previous rounds that haven't been addressed are marked
      // Note: we only mark gaps that are from rounds < current round
      // The current round's gaps will be addressed in the next iteration
      if (askedQueries.some((q) => q.sourceGapDescriptions?.includes(gap.description))) {
        gap.queried = true;
      }
    }
  }
}

// ─── Language Detection ───

/**
 * Simple heuristic to detect query language for search metadata.
 */
function detectLanguage(query: string): string | undefined {
  const hasChinese = /[\u4e00-\u9fa5]/.test(query);
  if (hasChinese) return "zh-CN";
  const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(query);
  if (hasJapanese) return "ja";
  return undefined;
}
