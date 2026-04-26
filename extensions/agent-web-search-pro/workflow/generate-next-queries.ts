// ============================================================
// agent-web-search-pro v2 — Next Query Generation (Phase 2)
// ============================================================
// Selects actionable research gaps, prioritizes them, and generates
// a small number of focused follow-up queries for the next round.
//
// Pure function module — no side effects.
//
// Responsibilities:
// 1. Filter actionable gaps (high priority, not yet queried)
// 2. Rank by priority and select top 1–2
// 3. Deduplicate against already-asked queries
// 4. Return 1–3 focused queries with their source gaps

import type {
  ResearchGap,
  AskedQuery,
  ResearchPlan,
} from "../types.js";
import { classifyQuery, extractEntity } from "./plan-research.js";

// ─── Actionable Gap Filtering ───

/** Minimum priority threshold for a gap to be considered actionable */
const ACTIONABLE_PRIORITY_THRESHOLD = 0.4;

/**
 * Filter gaps that are worth pursuing in the next round.
 * A gap is actionable when:
 * - its priority is above the threshold
 * - it has not been queried yet
 * - it has a meaningful description
 */
export function filterActionableGaps(
  gaps: ResearchGap[],
  options?: { minPriority?: number },
): ResearchGap[] {
  const minPriority = options?.minPriority ?? ACTIONABLE_PRIORITY_THRESHOLD;

  return gaps.filter(
    (gap) =>
      gap.priority >= minPriority &&
      !gap.queried &&
      gap.description.trim().length > 0,
  );
}

// ─── Deduplication Against Asked Queries ───

/**
 * Check whether a candidate query is too similar to an already-asked query.
 * Uses normalized token overlap as a lightweight similarity heuristic.
 */
export function isDuplicateQuery(
  candidate: string,
  askedQueries: AskedQuery[],
  threshold: number = 0.6,
): boolean {
  const candidateTokens = normalizeQuery(candidate);

  for (const asked of askedQueries) {
    const askedTokens = normalizeQuery(asked.query);
    const similarity = tokenOverlap(candidateTokens, askedTokens);
    if (similarity >= threshold) {
      return true;
    }
  }

  return false;
}

/**
 * Normalize a query string into a set of significant tokens.
 * Removes common filler words and punctuation.
 */
function normalizeQuery(query: string): Set<string> {
  const filler = new Set([
    "的", "了", "是", "在", "有", "和", "与", "跟",
    "吗", "呢", "吧", "啊", "呀", "什么", "怎么", "如何",
    "the", "a", "an", "is", "are", "of", "and", "or", "to",
    "what", "how", "which", "for", "with",
  ]);

  return new Set(
    query
      .toLowerCase()
      .replace(/[？?!,.，。！、]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !filler.has(t)),
  );
}

/**
 * Calculate token overlap ratio between two token sets.
 * Returns the Jaccard-like similarity: |A ∩ B| / min(|A|, |B|).
 */
function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  return intersection / Math.min(a.size, b.size);
}

// ─── Query Generation from Gaps ───

/**
 * Generate a focused follow-up query for a given gap.
 * Uses the gap's suggestedQuery if available, otherwise constructs
 * one from the gap description and the original research query.
 */
function generateQueryForGap(
  gap: ResearchGap,
  originalQuery: string,
): string {
  if (gap.suggestedQuery && gap.suggestedQuery.trim().length > 0) {
    return gap.suggestedQuery.trim();
  }

  // Fallback: derive query from gap description
  const entity = extractEntity(originalQuery);
  const queryType = classifyQuery(originalQuery);

  // For comparison queries, try to extract both entities from original query
  if (queryType === "comparison") {
    const compMatch = originalQuery.match(/^(.+?)(?:\s*[和与跟]\s*|\s+vs\.?\s+|\s+versus\s+)(.+?)(?:[哪个谁更适合更好更强更值得]?$|\?)/i);
    if (compMatch) {
      const a = compMatch[1].trim();
      const b = compMatch[2].trim();
      const desc = gap.description
        .replace(/“”""'']/g, "")
        .replace(/缺少|未找到|未获取|尚未找到|关于|的信息|对比信息|与竞品的|对比数据|系统性分析|适用性对比|真实评价|"[^"]+"/g, "")
        .trim();
      return `${a} ${b} ${desc}`;
    }
  }

  // Try to extract key terms from the description
  const desc = gap.description
    .replace(/“”""'']/g, "")
    .replace(/缺少|未找到|未获取|尚未找到|关于|的信息|对比信息/g, "")
    .trim();
  if (desc.length > 0) {
    return `${entity} ${desc}`;
  }

  // Last resort: use aspect name
  return `${entity} ${gap.aspect}`;
}

// ─── Main Entry Point ───

export interface NextQueryResult {
  /** Generated queries for the next round (1–3 items) */
  queries: string[];
  /** The gaps these queries are derived from */
  sourceGaps: ResearchGap[];
  /** Gaps that were filtered out as not actionable */
  skippedGaps: ResearchGap[];
  /** Queries that were dropped due to deduplication */
  deduplicatedQueries: string[];
}

/**
 * Generate focused follow-up queries for the next research round.
 *
 * @param gaps — all gaps identified in the current round
 * @param askedQueries — queries already executed in previous rounds
 * @param originalQuery — the user's original research query
 * @param options — optional configuration
 * @returns NextQueryResult with 1–3 queries and metadata
 */
export function generateNextQueries(
  gaps: ResearchGap[],
  askedQueries: AskedQuery[],
  originalQuery: string,
  options?: {
    /** Maximum number of queries to generate (default: 3) */
    maxQueries?: number;
    /** Minimum priority for actionable gaps (default: 0.4) */
    minPriority?: number;
    /** Deduplication similarity threshold (default: 0.6) */
    dedupThreshold?: number;
  },
): NextQueryResult {
  const maxQueries = options?.maxQueries ?? 3;
  const dedupThreshold = options?.dedupThreshold ?? 0.6;

  // Step 1: Filter actionable gaps
  const actionableGaps = filterActionableGaps(gaps, {
    minPriority: options?.minPriority,
  });

  const skippedGaps = gaps.filter(
    (gap) => !actionableGaps.includes(gap),
  );

  // Step 2: Sort by priority (descending), then by round (ascending — older gaps first)
  const sortedGaps = [...actionableGaps].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return (a.identifiedInRound ?? 0) - (b.identifiedInRound ?? 0);
  });

  // Step 3: Select top gaps and generate queries, with deduplication
  const selectedGaps: ResearchGap[] = [];
  const queries: string[] = [];
  const deduplicatedQueries: string[] = [];

  for (const gap of sortedGaps) {
    if (queries.length >= maxQueries) break;

    const candidateQuery = generateQueryForGap(gap, originalQuery);

    if (isDuplicateQuery(candidateQuery, askedQueries, dedupThreshold)) {
      deduplicatedQueries.push(candidateQuery);
      continue;
    }

    // Also deduplicate against already-selected queries in this batch
    if (queries.some((q) => isDuplicateQuery(candidateQuery, [{ query: q, round: 0, knowledgeCount: 0 }], dedupThreshold))) {
      deduplicatedQueries.push(candidateQuery);
      continue;
    }

    queries.push(candidateQuery);
    selectedGaps.push(gap);
  }

  return {
    queries,
    sourceGaps: selectedGaps,
    skippedGaps,
    deduplicatedQueries,
  };
}
