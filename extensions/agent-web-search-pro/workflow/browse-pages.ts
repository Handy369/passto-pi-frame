// ============================================================
// agent-web-search-pro v2 — Browse Pages Stage (Phase 1.5 upgraded)
// ============================================================
// Fetches specified URLs, extracts page content, and produces
// structured evidence (keyFacts, keyQuotes, summaries).
//
// Phase 1.5 upgrades:
// - Accept a pool of backup candidates for fallback
// - When a recommended page fails, try a replacement from the backup pool
// - Track fallback attempts in output (adopted / rejected / failed / fallback)

import type {
  BrowsePagesOutput,
  PageAnalysis,
  KnowledgeItem,
  SearchCandidate,
} from "../types.js";
import { callJinaReader } from "../providers/jina-reader.js";

/**
 * Analyze page content to extract key facts and quotes.
 * Currently uses heuristic extraction; in Phase 2, LLM can
 * be used for smarter fact extraction.
 */
function extractEvidence(content: string, focusQuery: string): { keyFacts: string[]; keyQuotes: string[]; summary: string } {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  const keyFacts: string[] = [];
  const keyQuotes: string[] = [];

  // Extract sentences that look like factual statements
  const queryLower = focusQuery.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  for (const line of lines) {
    // Skip very short lines (likely headings or navigation)
    if (line.length < 10) continue;

    // Check relevance to query
    const relevance = queryTerms.filter((term) => line.toLowerCase().includes(term)).length;
    if (relevance > 0) {
      // Lines with query terms become key facts
      if (line.length <= 200 && !keyFacts.includes(line)) {
        keyFacts.push(line);
      }
      // Longer relevant passages become quotes
      if (line.length > 50 && keyQuotes.length < 3) {
        keyQuotes.push(line.slice(0, 300));
      }
    }
  }

  // Build a summary from the first relevant facts
  const summary = keyFacts.slice(0, 3).join(" ") || content.slice(0, 500);

  return {
    keyFacts: keyFacts.slice(0, 10),
    keyQuotes: keyQuotes.slice(0, 5),
    summary: summary.slice(0, 500),
  };
}

/**
 * Calculate relevance score based on content-query overlap.
 */
function calculateRelevance(content: string, focusQuery: string): number {
  const contentLower = content.toLowerCase();
  const queryLower = focusQuery.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  if (queryTerms.length === 0) return 0.5;

  const matchCount = queryTerms.filter((term) => contentLower.includes(term)).length;
  return Math.min(matchCount / queryTerms.length, 1.0);
}

/**
 * Score a backup candidate for fallback suitability.
 * Higher score = better fallback candidate.
 */
function scoreBackupCandidate(candidate: SearchCandidate, focusQuery: string): number {
  let score = 0;
  const queryLower = focusQuery.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  // Prefer candidates with higher original scores
  if (candidate.score !== undefined) score += candidate.score * 30;

  // Prefer longer snippets (more content)
  score += Math.min(candidate.snippet.length / 10, 20);

  // Prefer candidates whose snippet mentions query terms
  const snippetLower = candidate.snippet.toLowerCase();
  const termMatches = queryTerms.filter((t) => snippetLower.includes(t)).length;
  score += termMatches * 10;

  // Prefer deep-read enriched candidates
  if (candidate.deepReadApplied) score += 15;

  return score;
}

/**
 * Select fallback URLs from backup candidates.
 * Excludes URLs already in the primary list.
 */
function selectFallbackUrls(
  backupCandidates: SearchCandidate[],
  primaryUrls: string[],
  maxFallbacks: number,
  focusQuery: string,
): SearchCandidate[] {
  const primarySet = new Set(primaryUrls.map((u) => u.replace(/\/$/, "")));

  return backupCandidates
    .filter((c) => c.url && !primarySet.has(c.url.replace(/\/$/, "")))
    .map((c) => ({ ...c, _fallbackScore: scoreBackupCandidate(c, focusQuery) }))
    .sort((a, b) => (b as any)._fallbackScore - (a as any)._fallbackScore)
    .slice(0, maxFallbacks);
}

/**
 * Browse specified URLs and extract evidence.
 * Phase 1.5: Accepts backupCandidates for fallback when primary URLs fail.
 */
export async function browsePages(params: {
  focusQuery: string;
  urls: string[];
  maxPages?: number;
  backupCandidates?: SearchCandidate[]; // Phase 1.5: pool of replacement candidates
  onUpdate?: (message: string, details?: Record<string, unknown>) => void;
}): Promise<BrowsePagesOutput> {
  const { focusQuery, urls, maxPages = 5, backupCandidates, onUpdate } = params;
  const targetUrls = urls.slice(0, maxPages);

  // Pre-select fallback candidates
  const fallbackPool = backupCandidates
    ? selectFallbackUrls(backupCandidates, targetUrls, maxPages, focusQuery)
    : [];

  // Merge target URLs with fallback candidates
  // Strategy: try all primary URLs first, then fill gaps with fallbacks
  const allTargets: Array<{ url: string; isFallback: boolean; fallbackTitle?: string }> = targetUrls.map((u) => ({
    url: u,
    isFallback: false,
  }));

  // Append fallback candidates
  for (const fc of fallbackPool) {
    allTargets.push({ url: fc.url, isFallback: true, fallbackTitle: fc.title });
  }

  const pageAnalyses: PageAnalysis[] = [];
  const adoptedKnowledge: KnowledgeItem[] = [];
  const rejectedPages: Array<{ url: string; reason: string }> = [];
  const fallbackAttempts: Array<{ originalFailedUrl: string; fallbackUrl: string; fallbackSuccess: boolean }> = [];

  let urlsSucceeded = 0;
  let urlsFailed = 0;
  let fallbackUsed = 0;
  const failedPrimaryUrls: string[] = [];

  // Phase 1: Try all primary URLs
  for (const target of allTargets) {
    if (!target.isFallback) {
      onUpdate?.(
        `正在读取: ${target.url}`,
        { phase: "browse", url: target.url, progress: `${urlsSucceeded + urlsFailed + 1}/${allTargets.length}` },
      );

      const readResult = await callJinaReader(target.url);

      if (readResult.error) {
        urlsFailed += 1;
        failedPrimaryUrls.push(target.url);
        pageAnalyses.push({
          url: target.url,
          title: target.url,
          summary: "",
          keyFacts: [],
          keyQuotes: [],
          relevanceScore: 0,
          fetchError: readResult.error,
        });
        rejectedPages.push({ url: target.url, reason: readResult.error });
        continue;
      }

      urlsSucceeded += 1;
      const content = readResult.snippet;
      const evidence = extractEvidence(content, focusQuery);
      const relevanceScore = calculateRelevance(content, focusQuery);

      const analysis: PageAnalysis = {
        url: target.url,
        title: readResult.title,
        summary: evidence.summary,
        keyFacts: evidence.keyFacts,
        keyQuotes: evidence.keyQuotes,
        relevanceScore,
        extractedContent: content.slice(0, 3000),
      };
      pageAnalyses.push(analysis);

      if (relevanceScore > 0.3) {
        adoptedKnowledge.push({
          sourceUrl: target.url,
          title: readResult.title,
          summary: evidence.summary,
          keyFacts: evidence.keyFacts,
          relevanceScore,
          adopted: true,
        });
      } else {
        rejectedPages.push({ url: target.url, reason: `低相关性 (score: ${relevanceScore.toFixed(2)})` });
      }
    } else {
      // Phase 2: Try fallback candidates for failed primary URLs
      if (failedPrimaryUrls.length === 0) break; // No more failed primaries to replace

      const failedUrl = failedPrimaryUrls[0];

      onUpdate?.(
        `主页面读取失败，尝试替代: ${target.url}`,
        { phase: "browse-fallback", failedUrl, fallbackUrl: target.url },
      );

      const readResult = await callJinaReader(target.url);

      if (readResult.error) {
        fallbackAttempts.push({ originalFailedUrl: failedUrl, fallbackUrl: target.url, fallbackSuccess: false });
        pageAnalyses.push({
          url: target.url,
          title: target.fallbackTitle || target.url,
          summary: "",
          keyFacts: [],
          keyQuotes: [],
          relevanceScore: 0,
          fetchError: readResult.error,
        });
        rejectedPages.push({ url: target.url, reason: `备选页面也失败: ${readResult.error}` });
        continue;
      }

      fallbackUsed += 1;
      fallbackAttempts.push({ originalFailedUrl: failedUrl, fallbackUrl: target.url, fallbackSuccess: true });
      failedPrimaryUrls.shift(); // Remove the replaced failed URL

      urlsSucceeded += 1;
      const content = readResult.snippet;
      const evidence = extractEvidence(content, focusQuery);
      const relevanceScore = calculateRelevance(content, focusQuery);

      const analysis: PageAnalysis = {
        url: target.url,
        title: readResult.title,
        summary: evidence.summary,
        keyFacts: evidence.keyFacts,
        keyQuotes: evidence.keyQuotes,
        relevanceScore,
        extractedContent: content.slice(0, 3000),
      };
      pageAnalyses.push(analysis);

      if (relevanceScore > 0.3) {
        adoptedKnowledge.push({
          sourceUrl: target.url,
          title: readResult.title,
          summary: evidence.summary,
          keyFacts: evidence.keyFacts,
          relevanceScore,
          adopted: true,
        });
      } else {
        rejectedPages.push({ url: target.url, reason: `低相关性 (score: ${relevanceScore.toFixed(2)})` });
      }
    }
  }

  return {
    browseMeta: {
      focusQuery,
      urlsRequested: targetUrls.length,
      urlsSucceeded,
      urlsFailed: urlsFailed - fallbackUsed, // Net failures after fallback
      timestamp: new Date().toISOString(),
    },
    pageAnalyses,
    adoptedKnowledge,
    rejectedPages,
    fallbackAttempts,
    fallbackUsed,
  };
}
