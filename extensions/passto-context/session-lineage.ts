import * as fs from "node:fs/promises";
import { buildSessionSummaryWarehouse } from "./summary-warehouse.ts";
import type { SummaryEntry } from "./types.ts";

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
}

interface SessionHeaderLike {
  type?: string;
  parentSession?: unknown;
}

interface ParsedSessionFile {
  parentSession: string | null;
  branchEntries: BranchEntryLike[];
}

export interface BuildSessionLineageSummaryWarehouseOptions {
  sessionFile?: string | null;
  currentBranch?: BranchEntryLike[];
  maxDepth?: number;
}

function getSummaryEntrySourceKey(entry: SummaryEntry): string {
  const sourceFile = entry.sessionFile ?? entry.sessionPointers?.file ?? "";
  if (sourceFile) {
    return `${sourceFile}::${entry.agentRound}`;
  }

  return `${entry.agentRound}::${entry.timestamp}::${entry.summary.goal}`;
}

function dedupeSummaryEntries(entries: SummaryEntry[]): SummaryEntry[] {
  const latestByKey = new Map<string, SummaryEntry>();

  for (const entry of entries) {
    latestByKey.set(getSummaryEntrySourceKey(entry), entry);
  }

  return [...latestByKey.values()].sort((a, b) => a.agentRound - b.agentRound);
}

function parseSessionHeaderLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as SessionHeaderLike;
    if (parsed?.type !== "session") return null;
    return typeof parsed.parentSession === "string" && parsed.parentSession.trim() ? parsed.parentSession : null;
  } catch {
    return null;
  }
}

async function parseSessionFile(filePath: string, includeBranchEntries: boolean): Promise<ParsedSessionFile> {
  const raw = await fs.readFile(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);
  const parentSession = lines.length > 0 ? parseSessionHeaderLine(lines[0] ?? "") : null;

  if (!includeBranchEntries) {
    return {
      parentSession,
      branchEntries: [],
    };
  }

  const branchEntries: BranchEntryLike[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as BranchEntryLike;
      branchEntries.push(parsed);
    } catch {
      // Ignore malformed historical lines; lineage search is best-effort.
    }
  }

  return {
    parentSession,
    branchEntries,
  };
}

export async function buildSessionLineageSummaryWarehouse(
  options: BuildSessionLineageSummaryWarehouseOptions,
): Promise<SummaryEntry[]> {
  const maxDepth = Math.max(0, options.maxDepth ?? 8);
  const collected: SummaryEntry[] = [];

  if (options.currentBranch && options.currentBranch.length > 0) {
    collected.push(...buildSessionSummaryWarehouse(options.currentBranch));
  }

  let nextSessionFile = options.sessionFile?.trim() ? options.sessionFile : null;
  const visited = new Set<string>();
  let includeEntriesForCurrentSession = !options.currentBranch || options.currentBranch.length === 0;
  let depth = 0;

  while (nextSessionFile && depth <= maxDepth && !visited.has(nextSessionFile)) {
    visited.add(nextSessionFile);

    try {
      const parsed = await parseSessionFile(nextSessionFile, includeEntriesForCurrentSession);
      if (parsed.branchEntries.length > 0) {
        collected.push(...buildSessionSummaryWarehouse(parsed.branchEntries));
      }
      nextSessionFile = parsed.parentSession;
      includeEntriesForCurrentSession = true;
    } catch {
      break;
    }

    depth += 1;
  }

  return dedupeSummaryEntries(collected);
}
