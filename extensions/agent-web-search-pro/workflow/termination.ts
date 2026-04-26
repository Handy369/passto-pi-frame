// ============================================================
// agent-web-search-pro v2 — Termination Logic (Phase 2)
// ============================================================
// Centralized stop-condition module for the multi-round research loop.
// Evaluates whether the research should continue or terminate.
//
// Pure function module — no side effects.
//
// Termination conditions (checked in priority order):
// 1. Sufficient answer — confidence meets threshold
// 2. Max rounds reached — hit the configured round limit
// 3. No actionable gaps — remaining gaps are too low priority or already queried
// 4. No new knowledge — latest round added no adopted knowledge (stagnation)
// 5. Error — unrecoverable error state

import type {
  ResearchState,
  ResearchGap,
  TerminationReason,
  AskedQuery,
  KnowledgeItem,
  RoundRecord,
  SynthesizeResearchOutput,
} from "../types.js";

// ─── Default Configuration ───

const DEFAULT_MAX_ROUNDS = 5;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;
const DEFAULT_STAGNATION_LIMIT = 2;
const DEFAULT_MIN_ACTIONABLE_PRIORITY = 0.4;

// ─── Termination Evaluation ───

export interface TerminationDecision {
  /** Whether the research loop should stop */
  shouldStop: boolean;
  /** The reason for termination (undefined if shouldStop is false) */
  reason?: TerminationReason;
  /** Human-readable explanation of the decision */
  explanation: string;
  /** Current round number */
  currentRound: number;
  /** Current confidence level */
  confidence: number;
  /** Number of actionable gaps remaining */
  actionableGapCount: number;
}

export interface TerminationOptions {
  /** Maximum number of research rounds (default: 5) */
  maxRounds?: number;
  /** Confidence threshold for early termination (default: 0.65) */
  confidenceThreshold?: number;
  /** Consecutive rounds with no new knowledge before stopping (default: 2) */
  stagnationLimit?: number;
  /** Minimum priority for a gap to be considered actionable (default: 0.4) */
  minActionablePriority?: number;
}

/**
 * Evaluate whether the research loop should terminate.
 *
 * Checks conditions in order:
 * 1. Sufficient answer (confidence ≥ threshold AND answer is not empty)
 * 2. Max rounds reached
 * 3. No actionable gaps
 * 4. No new knowledge (stagnation over N rounds)
 *
 * @param state — current research state
 * @param synthesizeOutput — latest synthesis result
 * @param options — optional configuration overrides
 * @returns TerminationDecision with stop/no-stop verdict and reasoning
 */
export function evaluateTermination(
  state: ResearchState,
  synthesizeOutput: SynthesizeResearchOutput,
  options?: TerminationOptions,
): TerminationDecision {
  const maxRounds = options?.maxRounds ?? state.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const confidenceThreshold =
    options?.confidenceThreshold ??
    state.plan?.confidenceThreshold ??
    DEFAULT_CONFIDENCE_THRESHOLD;
  const stagnationLimit =
    options?.stagnationLimit ??
    state.plan?.stagnationLimit ??
    DEFAULT_STAGNATION_LIMIT;
  const minPriority = options?.minActionablePriority ?? DEFAULT_MIN_ACTIONABLE_PRIORITY;

  const currentRound = state.round;
  const confidence = synthesizeOutput.confidence;
  const gaps = synthesizeOutput.gaps;

  // Count actionable gaps (high priority, not yet queried)
  const actionableGapCount = gaps.filter(
    (g) => g.priority >= minPriority && !g.queried,
  ).length;

  // ── Condition 1: Sufficient answer ──
  if (synthesizeOutput.sufficient || confidence >= confidenceThreshold) {
    // Also check that we have at least a minimal answer
    const hasAnswer =
      synthesizeOutput.answer &&
      synthesizeOutput.answer.trim().length > 20 &&
      !synthesizeOutput.answer.includes("暂未能获取");

    if (hasAnswer || synthesizeOutput.sufficient) {
      return {
        shouldStop: true,
        reason: "sufficient_answer",
        explanation: `已达到充分性阈值（confidence=${confidence.toFixed(2)} ≥ ${confidenceThreshold.toFixed(2)}），${
          synthesizeOutput.sufficient
            ? "综合判断信息已足够"
            : `答案质量可接受，剩余 ${actionableGapCount} 个可执行缺口优先级不足`
        }`,
        currentRound,
        confidence,
        actionableGapCount,
      };
    }
  }

  // ── Condition 2: Max rounds reached ──
  if (currentRound >= maxRounds) {
    return {
      shouldStop: true,
      reason: "max_rounds_reached",
      explanation: `已达到最大轮次限制（${currentRound}/${maxRounds}），confidence=${confidence.toFixed(2)}，剩余 ${actionableGapCount} 个可执行缺口`,
      currentRound,
      confidence,
      actionableGapCount,
    };
  }

  // ── Condition 3: No actionable gaps ──
  if (actionableGapCount === 0 && gaps.length > 0) {
    return {
      shouldStop: true,
      reason: "no_actionable_gaps",
      explanation: `无更多可执行缺口（共 ${gaps.length} 个缺口，但均已被查询或优先级低于 ${minPriority}）`,
      currentRound,
      confidence,
      actionableGapCount,
    };
  }

  if (actionableGapCount === 0 && gaps.length === 0) {
    // No gaps at all — this means either we have full coverage or something went wrong
    // with gap generation. Treat as sufficient if we have some knowledge.
    const hasKnowledge = state.knowledge.some((k) => k.adopted);
    if (hasKnowledge) {
      return {
        shouldStop: true,
        reason: "sufficient_answer",
        explanation: `无剩余缺口，已采集 ${state.knowledge.filter((k) => k.adopted).length} 条知识，信息覆盖完整`,
        currentRound,
        confidence,
        actionableGapCount: 0,
      };
    }
    // No gaps and no knowledge — this is unusual, stop with sufficient_answer
    // to avoid infinite looping
    return {
      shouldStop: true,
      reason: "no_actionable_gaps",
      explanation: "无剩余缺口且无已采集知识，无法继续推进",
      currentRound,
      confidence,
      actionableGapCount: 0,
    };
  }

  // ── Condition 4: No new knowledge (stagnation) ──
  const stagnationResult = checkStagnation(
    state.roundRecords,
    state.knowledge,
    currentRound,
    stagnationLimit,
  );
  if (stagnationResult.stagnant) {
    return {
      shouldStop: true,
      reason: "no_new_knowledge",
      explanation: `信息增益停滞（连续 ${stagnationResult.consecutiveStagnantRounds} 轮未采集到新知识的 ${
        stagnationLimit
      } 轮阈值），最新轮次 confidence=${confidence.toFixed(2)}`,
      currentRound,
      confidence,
      actionableGapCount,
    };
  }

  // ── Default: continue ──
  return {
    shouldStop: false,
    explanation: `继续研究（confidence=${confidence.toFixed(2)} < ${confidenceThreshold.toFixed(2)}，${actionableGapCount} 个可执行缺口，无停滞）`,
    currentRound,
    confidence,
    actionableGapCount,
  };
}

// ─── Stagnation Detection ───

interface StagnationResult {
  stagnant: boolean;
  consecutiveStagnantRounds: number;
}

/**
 * Detect information stagnation by analyzing round records.
 * A round is considered stagnant if it produced no adopted knowledge.
 * If N consecutive rounds are stagnant, the loop should stop.
 *
 * Lightweight heuristic — does not measure semantic similarity,
 * only counts adopted knowledge items per round.
 */
function checkStagnation(
  roundRecords: RoundRecord[],
  knowledge: KnowledgeItem[],
  currentRound: number,
  stagnationLimit: number,
): StagnationResult {
  if (stagnationLimit <= 0 || roundRecords.length === 0) {
    return { stagnant: false, consecutiveStagnantRounds: 0 };
  }

  // Count adopted knowledge per round
  const knowledgePerRound = new Map<number, number>();
  for (const k of knowledge) {
    if (k.adopted && k.round !== undefined) {
      knowledgePerRound.set(k.round, (knowledgePerRound.get(k.round) ?? 0) + 1);
    }
  }

  // Also use roundRecords if available
  for (const record of roundRecords) {
    if (!knowledgePerRound.has(record.round)) {
      knowledgePerRound.set(record.round, record.knowledgeAdopted);
    }
  }

  // Count consecutive stagnant rounds from most recent backwards
  let consecutiveStagnantRounds = 0;
  for (let r = currentRound; r >= 1; r--) {
    const adoptedCount = knowledgePerRound.get(r) ?? 0;
    if (adoptedCount === 0) {
      consecutiveStagnantRounds++;
    } else {
      break;
    }
  }

  // Need at least 1 round of data to judge stagnation
  // (the current round hasn't produced knowledge yet when we check)
  // So we check the previous rounds
  let consecutiveFromPrevious = 0;
  for (let r = currentRound - 1; r >= 1; r--) {
    const adoptedCount = knowledgePerRound.get(r) ?? 0;
    if (adoptedCount === 0) {
      consecutiveFromPrevious++;
    } else {
      break;
    }
  }

  // Stagnation: the current round + previous consecutive rounds with 0 knowledge
  // We consider it stagnant if the recent pattern shows no gain
  const totalConsecutive = consecutiveFromPrevious;

  return {
    stagnant: totalConsecutive >= stagnationLimit,
    consecutiveStagnantRounds: totalConsecutive,
  };
}

// ─── Utility: Build Round Record ───

/**
 * Helper to create a RoundRecord from synthesis output.
 * Used by the orchestrator to populate state.roundRecords.
 */
export function buildRoundRecord(
  round: number,
  query: string,
  searchCandidateCount: number,
  browsePageCount: number,
  adoptedKnowledgeCount: number,
  synthesizeOutput: SynthesizeResearchOutput,
  minPriority: number = DEFAULT_MIN_ACTIONABLE_PRIORITY,
): RoundRecord {
  const actionableGaps = synthesizeOutput.gaps.filter(
    (g) => g.priority >= minPriority && !g.queried,
  ).length;

  return {
    round,
    query,
    candidatesFound: searchCandidateCount,
    pagesBrowsed: browsePageCount,
    knowledgeAdopted: adoptedKnowledgeCount,
    confidence: synthesizeOutput.confidence,
    gapsRemaining: synthesizeOutput.gaps.length,
    actionableGaps,
  };
}
