import type { SummaryEntry } from "./types.js";
import { extractKeywords } from "./utils.js";

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
}

interface CuratorArtifactLike {
  summaryEntry?: unknown;
}

function cloneSummaryEntry(entry: SummaryEntry): SummaryEntry {
  return JSON.parse(JSON.stringify(entry)) as SummaryEntry;
}

export function getSummaryEntrySourceKey(entry: SummaryEntry): string {
  const sourceFile = entry.sessionFile ?? entry.sessionPointers?.file ?? "unknown-session";
  return `${sourceFile}::${entry.agentRound}`;
}

export function dedupeSummaryEntries(entries: SummaryEntry[]): SummaryEntry[] {
  const latestBySource = new Map<string, SummaryEntry>();

  for (const entry of entries) {
    latestBySource.set(getSummaryEntrySourceKey(entry), cloneSummaryEntry(entry));
  }

  return [...latestBySource.values()].sort((a, b) => a.agentRound - b.agentRound);
}

export function mergeSummaryWarehouses(...lists: SummaryEntry[][]): SummaryEntry[] {
  return dedupeSummaryEntries(lists.flat());
}

function isSummaryEntry(value: unknown): value is SummaryEntry {
  return !!value && typeof value === "object" && typeof (value as SummaryEntry).agentRound === "number";
}

function buildSummarySearchText(entry: SummaryEntry): string {
  return [
    entry.summary.goal,
    entry.summary.completed.join("\n"),
    entry.summary.keyDecisions.join("\n"),
    entry.summary.status,
    entry.summary.blockers.join("\n"),
    entry.summary.filesChanged.map((item) => item.path).join("\n"),
    entry.sessionPointers?.searchQuery ?? "",
    entry.sessionFile ?? "",
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function scoreSummaryEntry(entry: SummaryEntry, query: string, queryTokens: string[]): number {
  const haystack = buildSummarySearchText(entry);
  if (!haystack) return 0;

  let score = 0;
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    score += Math.max(3, normalizedQuery.length / 8);
  }

  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  return score;
}

export function hydrateSummaryEntrySessionContext(
  summaryEntry: SummaryEntry | null,
  options: {
    sessionFile?: string | null;
    sessionEntryRange?: SummaryEntry["sessionEntryRange"] | null;
  },
): SummaryEntry | null {
  if (!summaryEntry) return null;

  const nextSessionFile = options.sessionFile ?? summaryEntry.sessionFile;
  const nextSessionEntryRange = options.sessionEntryRange ?? summaryEntry.sessionEntryRange;

  return {
    ...summaryEntry,
    sessionFile: nextSessionFile ?? undefined,
    sessionEntryRange: nextSessionEntryRange ?? undefined,
    sessionPointers: {
      ...summaryEntry.sessionPointers,
      file: nextSessionFile ?? summaryEntry.sessionPointers?.file,
    },
  };
}

export function extractSummaryEntriesFromBranch<T extends BranchEntryLike>(branch: T[]): SummaryEntry[] {
  const entries: SummaryEntry[] = [];

  for (const entry of branch) {
    if (entry?.type !== "custom" || entry.customType !== "grc-curator-artifact") {
      continue;
    }

    const artifact = entry.data as CuratorArtifactLike | undefined;
    if (!isSummaryEntry(artifact?.summaryEntry)) {
      continue;
    }

    entries.push(cloneSummaryEntry(artifact.summaryEntry));
  }

  return entries;
}

export function buildSessionSummaryWarehouse<T extends BranchEntryLike>(branch: T[]): SummaryEntry[] {
  return dedupeSummaryEntries(extractSummaryEntriesFromBranch(branch));
}

export function searchSessionSummaryWarehouse(
  entries: SummaryEntry[],
  query: string,
  limit = 5,
): SummaryEntry[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const queryTokens = extractKeywords(normalizedQuery.toLowerCase());
  const scored = entries
    .map((entry) => ({
      entry,
      score: scoreSummaryEntry(entry, normalizedQuery, queryTokens),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.agentRound - a.entry.agentRound)
    .slice(0, Math.max(1, limit));

  return scored.map((item) => cloneSummaryEntry(item.entry));
}
