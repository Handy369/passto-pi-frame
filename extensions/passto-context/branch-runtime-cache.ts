import {
  findAgentRoundBoundaries,
  getCurrentAgentRoundEntries,
  getPreviousAgentRoundEntries,
  getRecentAgentRoundMessages,
  getSlidingWindowAgentRoundMessages,
  getLatestUserMessageText as extractLatestUserMessageText,
  resolveAgentRoundEntryRange,
  serializeCurrentAgentRoundConversation,
  serializePreviousAgentRoundConversation,
  type AgentRoundBoundary,
  type ContextLikeMessage,
} from "./grc-context-manager.ts";
import { buildSessionSummaryWarehouse } from "./summary-warehouse.ts";
import { buildSessionLineageSummaryWarehouse } from "./session-lineage.ts";
import type { GRCConfig, SummaryEntry } from "./types.ts";

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
  message?: unknown;
}

interface SessionManagerLike {
  getBranch(): BranchEntryLike[];
  getLeafId?(): string | null;
  getSessionFile?(): string | undefined;
}

export interface BranchRuntimeContextLike {
  sessionManager: SessionManagerLike;
}

export interface BranchRuntimeSnapshot {
  revision: string;
  sessionFile: string | null;
  leafId: string | null;
  branch: BranchEntryLike[];
  agentRoundBoundaries?: AgentRoundBoundary[];
  sessionSummaryWarehouse?: SummaryEntry[];
  lineageSummaryWarehouseByDepth: Map<number, Promise<SummaryEntry[]>>;
  latestUserTimestamp?: number | null;
  latestUserMessageText?: string;
  currentAgentRoundEntries?: BranchEntryLike[];
  previousAgentRoundEntries?: BranchEntryLike[];
  recentAgentRoundMessagesByKeep: Map<number, ContextLikeMessage[]>;
  slidingWindowAgentRoundMessagesByConfig: Map<string, ContextLikeMessage[]>;
  entryRangeByAgentRound: Map<number, { startAgentEntryIndex: number; endAgentEntryIndex: number } | null>;
}

let currentSnapshot: BranchRuntimeSnapshot | null = null;

function normalizeSessionFile(sessionFile: string | undefined): string | null {
  return typeof sessionFile === "string" && sessionFile.trim() ? sessionFile : null;
}

function buildRevision(ctx: BranchRuntimeContextLike): {
  revision: string;
  sessionFile: string | null;
  leafId: string | null;
} {
  const sessionFile = normalizeSessionFile(ctx.sessionManager.getSessionFile?.());
  const leafId = ctx.sessionManager.getLeafId?.() ?? null;
  return {
    revision: `${sessionFile ?? "ephemeral"}::${leafId ?? "root"}`,
    sessionFile,
    leafId,
  };
}

export function invalidateBranchRuntimeCache(): void {
  currentSnapshot = null;
}

export function getBranchRuntimeSnapshot(ctx: BranchRuntimeContextLike): BranchRuntimeSnapshot {
  const next = buildRevision(ctx);
  if (currentSnapshot && currentSnapshot.revision === next.revision) {
    return currentSnapshot;
  }

  currentSnapshot = {
    revision: next.revision,
    sessionFile: next.sessionFile,
    leafId: next.leafId,
    branch: ctx.sessionManager.getBranch(),
    lineageSummaryWarehouseByDepth: new Map<number, Promise<SummaryEntry[]>>(),
    recentAgentRoundMessagesByKeep: new Map<number, ContextLikeMessage[]>(),
    slidingWindowAgentRoundMessagesByConfig: new Map<string, ContextLikeMessage[]>(),
    entryRangeByAgentRound: new Map<number, { startAgentEntryIndex: number; endAgentEntryIndex: number } | null>(),
  };
  return currentSnapshot;
}

export function getCachedBranch(ctx: BranchRuntimeContextLike): BranchEntryLike[] {
  return getBranchRuntimeSnapshot(ctx).branch;
}

export function getCachedSessionSummaryWarehouseEntries(ctx: BranchRuntimeContextLike): SummaryEntry[] {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  if (!snapshot.sessionSummaryWarehouse) {
    snapshot.sessionSummaryWarehouse = buildSessionSummaryWarehouse(snapshot.branch);
  }
  return snapshot.sessionSummaryWarehouse;
}

export async function getCachedLineageSummaryWarehouseEntries(
  ctx: BranchRuntimeContextLike,
  config?: Pick<GRCConfig, "lineageSummaryMaxDepth">,
): Promise<SummaryEntry[]> {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  const maxDepth = Math.max(0, config?.lineageSummaryMaxDepth ?? 8);
  const cached = snapshot.lineageSummaryWarehouseByDepth.get(maxDepth);
  if (cached) {
    return cached;
  }

  const loader = buildSessionLineageSummaryWarehouse({
    sessionFile: snapshot.sessionFile,
    currentBranch: snapshot.branch,
    maxDepth,
  });
  snapshot.lineageSummaryWarehouseByDepth.set(maxDepth, loader);
  return loader;
}

export function getCachedLatestUserTimestamp(ctx: BranchRuntimeContextLike): number | null {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  if (snapshot.latestUserTimestamp !== undefined) {
    return snapshot.latestUserTimestamp;
  }

  for (let i = snapshot.branch.length - 1; i >= 0; i -= 1) {
    const entry = snapshot.branch[i];
    if (entry?.type !== "message") continue;
    const message = entry.message as { role?: string; timestamp?: number } | undefined;
    if (message?.role === "user" && typeof message.timestamp === "number") {
      snapshot.latestUserTimestamp = message.timestamp;
      return snapshot.latestUserTimestamp;
    }
  }

  snapshot.latestUserTimestamp = null;
  return snapshot.latestUserTimestamp;
}

export function getCachedLatestUserMessageText(ctx: BranchRuntimeContextLike): string {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  if (snapshot.latestUserMessageText !== undefined) {
    return snapshot.latestUserMessageText;
  }

  snapshot.latestUserMessageText = extractLatestUserMessageText(snapshot.branch);
  return snapshot.latestUserMessageText;
}

export function getCachedAgentRoundBoundaries(ctx: BranchRuntimeContextLike): AgentRoundBoundary[] {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  if (!snapshot.agentRoundBoundaries) {
    snapshot.agentRoundBoundaries = findAgentRoundBoundaries(snapshot.branch);
  }
  return snapshot.agentRoundBoundaries;
}

export function getCachedResolveAgentRoundEntryRange(
  ctx: BranchRuntimeContextLike,
  agentRound: number,
): { startAgentEntryIndex: number; endAgentEntryIndex: number } | null {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  const cached = snapshot.entryRangeByAgentRound.get(agentRound);
  if (cached !== undefined) {
    return cached;
  }

  const resolved = resolveAgentRoundEntryRange(snapshot.branch, agentRound, getCachedAgentRoundBoundaries(ctx));
  snapshot.entryRangeByAgentRound.set(agentRound, resolved);
  return resolved;
}

export function getCachedCurrentAgentRoundEntries(ctx: BranchRuntimeContextLike): BranchEntryLike[] {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  if (!snapshot.currentAgentRoundEntries) {
    snapshot.currentAgentRoundEntries = getCurrentAgentRoundEntries(snapshot.branch, getCachedAgentRoundBoundaries(ctx));
  }
  return snapshot.currentAgentRoundEntries;
}

export function getCachedPreviousAgentRoundEntries(ctx: BranchRuntimeContextLike): BranchEntryLike[] {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  if (!snapshot.previousAgentRoundEntries) {
    snapshot.previousAgentRoundEntries = getPreviousAgentRoundEntries(snapshot.branch, getCachedAgentRoundBoundaries(ctx));
  }
  return snapshot.previousAgentRoundEntries;
}

export function getCachedRecentAgentRoundMessages(
  ctx: BranchRuntimeContextLike,
  keepRecentRounds: number,
): ContextLikeMessage[] {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  const safeKeep = Math.max(1, keepRecentRounds);
  const cached = snapshot.recentAgentRoundMessagesByKeep.get(safeKeep);
  if (cached) {
    return cached;
  }

  const messages = getRecentAgentRoundMessages(snapshot.branch, safeKeep, getCachedAgentRoundBoundaries(ctx));
  snapshot.recentAgentRoundMessagesByKeep.set(safeKeep, messages);
  return messages;
}

export function getCachedSlidingWindowAgentRoundMessages(
  ctx: BranchRuntimeContextLike,
  minRecentRounds: number,
  contextWindow: number,
  maxContextPercent: number,
): ContextLikeMessage[] {
  const snapshot = getBranchRuntimeSnapshot(ctx);
  const key = `${Math.max(1, minRecentRounds)}::${Math.max(1, contextWindow)}::${Math.max(0.1, maxContextPercent)}`;
  const cached = snapshot.slidingWindowAgentRoundMessagesByConfig.get(key);
  if (cached) {
    return cached;
  }

  const messages = getSlidingWindowAgentRoundMessages(
    snapshot.branch,
    minRecentRounds,
    contextWindow,
    maxContextPercent,
    getCachedAgentRoundBoundaries(ctx),
  );
  snapshot.slidingWindowAgentRoundMessagesByConfig.set(key, messages);
  return messages;
}

export function serializeCachedCurrentAgentRoundConversation(
  ctx: BranchRuntimeContextLike,
  serializer: (entries: Array<{ message?: unknown }>) => string,
): string {
  return serializeCurrentAgentRoundConversation(getCachedBranch(ctx), serializer, getCachedAgentRoundBoundaries(ctx));
}

export function serializeCachedPreviousAgentRoundConversation(
  ctx: BranchRuntimeContextLike,
  serializer: (entries: Array<{ message?: unknown }>) => string,
): string {
  return serializePreviousAgentRoundConversation(getCachedBranch(ctx), serializer, getCachedAgentRoundBoundaries(ctx));
}
