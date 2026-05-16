import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Logger, PrincipleDraft, PrincipleItem, PrincipleOp } from "./types.js";
import { extractKeywords, generateId, nowIso } from "./utils.js";

interface PrincipleMetadata {
  source?: string;
  sources?: string[];
  origin?: "reflector" | "manual";
  promoted?: boolean;
  hintCount?: number;
  activeScore?: number;
  lastHintedAt?: string;
  hintTimestamps?: string[];
  lastDecayAt?: string;
  mergeCount?: number;
  conflictGroupId?: string;
  lifecycle?: "active" | "stale" | "archived" | "disabled";
  // legacy compatibility
  hitCount?: number;
  lastUsed?: string;
  conflictStatus?: "clean" | "needs-review";
}

interface IndexedPrinciple extends PrincipleItem {
  _tokens: Set<string>;
  _tagTokens: Set<string>;
}

interface ApplyPrincipleOpsOptions {
  source?: string;
  hardMaxCount: number;
}

interface PrinciplesRegistry {
  version: number;
  updatedAt: string;
  principles: Array<{
    id: string;
    created: string;
    updated?: string;
    tags: string[];
    content: string;
    metadata: PrincipleMetadata;
  }>;
}

export interface PrinciplesDiagnostics {
  audit: {
    applyRuns: number;
    pruneRuns: number;
    ops: {
      create: number;
      reuse: number;
      merge: number;
      conflict: number;
    };
    effects: {
      created: number;
      reused: number;
      merged: number;
      conflicted: number;
      decayed: number;
      deletedByOverflow: number;
    };
  };
  migration: {
    loadedRegistryVersion: number | null;
    upgradedToVersion2: boolean;
    normalizedRegistryItems: number;
    migratedYamlFiles: number;
    legacyYamlFilesDetected: number;
  };
  health: {
    total: number;
    injectable: number;
    active: number;
    conflictGroups: number;
    conflictedItems: number;
  };
  review: {
    staleCandidates: number;
    pseudoCandidates: number;
    oversizedCandidates: number;
  };
}

export interface SlimPrincipleItem {
  id: string;
  tags: string[];
  content: string;
}

export interface PrinciplesManager {
  load(dir: string): Promise<void>;
  list(): PrincipleItem[];
  listSlim(limit: number): SlimPrincipleItem[];
  search(query: string, limit: number): PrincipleItem[];
  listInjectable(limit: number): PrincipleItem[];
  applyPrincipleOps(ops: PrincipleOp[], options: ApplyPrincipleOpsOptions): Promise<{ changed: number; deleted: number }>;
  prune(maxCount: number): Promise<number>;
  deleteByIds(ids: string[]): Promise<number>;
  getDiagnostics(): PrinciplesDiagnostics;
  getDirectory(): string;
  count(): number;
}

const REGISTRY_FILE = "principles-registry.json";
const REGISTRY_VERSION = 2;
const MAX_HINT_TIMESTAMPS = 32;
const HIGH_VALUE_HINT_THRESHOLD = 5;
const CONFLICT_GROUP_PREFIX = "cg";

export function createPrinciplesManager(logger: Logger): PrinciplesManager {
  const index = new Map<string, IndexedPrinciple>();
  let currentDir = "";
  let registryPath = "";
  const diagnostics: PrinciplesDiagnostics = {
    audit: {
      applyRuns: 0,
      pruneRuns: 0,
      ops: {
        create: 0,
        reuse: 0,
        merge: 0,
        conflict: 0,
      },
      effects: {
        created: 0,
        reused: 0,
        merged: 0,
        conflicted: 0,
        decayed: 0,
        deletedByOverflow: 0,
      },
    },
    migration: {
      loadedRegistryVersion: null,
      upgradedToVersion2: false,
      normalizedRegistryItems: 0,
      migratedYamlFiles: 0,
      legacyYamlFilesDetected: 0,
    },
    health: {
      total: 0,
      injectable: 0,
      active: 0,
      conflictGroups: 0,
      conflictedItems: 0,
    },
    review: {
      staleCandidates: 0,
      pseudoCandidates: 0,
      oversizedCandidates: 0,
    },
  };

  function normalizeContent(content: string): string {
    return content.replace(/\s+/g, " ").trim();
  }

  function normalizeTags(tags: string[]): string[] {
    return Array.from(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))).slice(0, 12);
  }

  function normalizeMetadata(metadata?: PrincipleMetadata): PrincipleMetadata {
    const hintCount = metadata?.hintCount ?? metadata?.hitCount ?? 0;
    const hintTimestamps = Array.isArray(metadata?.hintTimestamps)
      ? metadata!.hintTimestamps!.map(String).filter(Boolean).slice(-MAX_HINT_TIMESTAMPS)
      : [];
    const lastHintedAt = metadata?.lastHintedAt ?? metadata?.lastUsed;

    return {
      source: typeof metadata?.source === "string" ? metadata.source : undefined,
      sources: Array.isArray(metadata?.sources) ? metadata.sources.map(String).filter(Boolean).slice(-20) : [],
      origin: metadata?.origin === "manual" ? "manual" : "reflector",
      promoted: metadata?.promoted === true,
      hintCount,
      activeScore: Math.max(0, metadata?.activeScore ?? hintCount),
      lastHintedAt: typeof lastHintedAt === "string" ? lastHintedAt : undefined,
      hintTimestamps,
      lastDecayAt: typeof metadata?.lastDecayAt === "string" ? metadata.lastDecayAt : undefined,
      mergeCount: typeof metadata?.mergeCount === "number" ? metadata.mergeCount : 0,
      conflictGroupId: typeof metadata?.conflictGroupId === "string" ? metadata.conflictGroupId : undefined,
      lifecycle: metadata?.lifecycle === "stale" || metadata?.lifecycle === "archived" || metadata?.lifecycle === "disabled"
        ? metadata.lifecycle
        : "active",
      // legacy compatibility
      hitCount: hintCount,
      lastUsed: typeof lastHintedAt === "string" ? lastHintedAt : undefined,
      conflictStatus: metadata?.conflictStatus === "needs-review" ? "needs-review" : "clean",
    };
  }

  function buildTokens(item: Pick<PrincipleItem, "content" | "tags">): Set<string> {
    const tokens = new Set<string>();
    for (const token of extractKeywords(item.content)) tokens.add(token);
    for (const tag of item.tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!normalizedTag) continue;
      tokens.add(normalizedTag);
      for (const token of extractKeywords(normalizedTag)) tokens.add(token);
    }
    return tokens;
  }

  function buildTagTokens(tags: string[]): Set<string> {
    const tokens = new Set<string>();
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!normalizedTag) continue;
      tokens.add(normalizedTag);
      for (const token of extractKeywords(normalizedTag)) tokens.add(token);
    }
    return tokens;
  }

  function recentHintCount(item: IndexedPrinciple, days: number): number {
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return (item.metadata.hintTimestamps ?? []).filter((iso) => {
      const value = new Date(iso).getTime();
      return Number.isFinite(value) && value >= threshold;
    }).length;
  }

  function scorePrinciple(item: IndexedPrinciple, query: string, queryTokens: string[]): number {
    if (queryTokens.length === 0) return 0;

    let score = 0;
    let matched = false;
    const normalizedQuery = query.toLowerCase().trim();
    const normalizedContent = item.content.toLowerCase();
    const normalizedTags = item.tags.map((tag) => tag.toLowerCase());

    if (normalizedQuery) {
      if (normalizedTags.some((tag) => tag === normalizedQuery)) {
        score += 8;
        matched = true;
      } else if (normalizedTags.some((tag) => tag.includes(normalizedQuery) || normalizedQuery.includes(tag))) {
        score += 5;
        matched = true;
      }

      if (normalizedContent.includes(normalizedQuery)) {
        score += 3;
        matched = true;
      }
    }

    for (const queryToken of queryTokens) {
      if (item._tagTokens.has(queryToken)) {
        score += 3;
        matched = true;
        continue;
      }
      if (item._tokens.has(queryToken)) {
        score += 1.5;
        matched = true;
        continue;
      }
      for (const token of item._tokens) {
        if (token.includes(queryToken) || queryToken.includes(token)) {
          score += item._tagTokens.has(token) ? 1.5 : 0.5;
          matched = true;
          break;
        }
      }
    }

    if (!matched) return 0;

    const activeScore = item.metadata.activeScore ?? item.metadata.hintCount ?? 0;
    const activeBonus = Math.min(activeScore, 10) * 0.25;
    const recent60Bonus = recentHintCount(item, 60) * 0.18;
    const recent30Bonus = recentHintCount(item, 30) * 0.08;
    return score / Math.sqrt(queryTokens.length) + activeBonus + recent60Bonus + recent30Bonus;
  }

  function toPublicItem(item: IndexedPrinciple): PrincipleItem {
    return {
      id: item.id,
      created: item.created,
      updated: item.updated,
      tags: [...item.tags],
      content: item.content,
      metadata: { ...item.metadata, sources: [...(item.metadata.sources ?? [])], hintTimestamps: [...(item.metadata.hintTimestamps ?? [])] },
      score: item.score,
    };
  }

  function asIndexed(item: PrincipleItem): IndexedPrinciple {
    const normalizedItem: PrincipleItem = {
      ...item,
      tags: normalizeTags(item.tags),
      content: normalizeContent(item.content),
      metadata: normalizeMetadata(item.metadata),
    };

    return {
      ...normalizedItem,
      _tokens: buildTokens(normalizedItem),
      _tagTokens: buildTagTokens(normalizedItem.tags),
    };
  }

  function tokenJaccard(a: Set<string>, b: Set<string>): number {
    if (a.size === 0 || b.size === 0) return 0;
    let intersection = 0;
    for (const token of a) {
      if (b.has(token)) intersection += 1;
    }
    const union = a.size + b.size - intersection;
    return union <= 0 ? 0 : intersection / union;
  }

  function findMergeTarget(content: string, tags: string[]): IndexedPrinciple | null {
    const normalized = normalizeContent(content).toLowerCase();
    const draftTokens = buildTokens({ content, tags });
    const draftTagTokens = buildTagTokens(tags);

    let best: IndexedPrinciple | null = null;
    let bestScore = 0;

    for (const item of index.values()) {
      const existing = normalizeContent(item.content).toLowerCase();
      if (existing === normalized) {
        return item;
      }

      const containsRelation = existing.includes(normalized) || normalized.includes(existing);
      const contentSimilarity = tokenJaccard(item._tokens, draftTokens);
      const tagSimilarity = tokenJaccard(item._tagTokens, draftTagTokens);
      const score = Math.max(contentSimilarity, containsRelation ? 0.92 : 0) + tagSimilarity * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    }

    return bestScore >= 0.78 ? best : null;
  }

  function choosePreferredContent(existing: string, incoming: string): string {
    const current = normalizeContent(existing);
    const next = normalizeContent(incoming);
    if (current === next) return current;
    if (next.length > current.length + 8) return next;
    if (current.length > next.length + 20) return current;
    return next.length >= current.length ? next : current;
  }

  function mergeMetadata(existing: PrincipleMetadata, incomingSource?: string): PrincipleMetadata {
    const sources = new Set<string>(existing.sources ?? []);
    if (existing.source) sources.add(existing.source);
    if (incomingSource) sources.add(incomingSource);

    const normalized = normalizeMetadata(existing);
    return {
      ...normalized,
      source: incomingSource ?? normalized.source,
      sources: Array.from(sources).slice(-20),
      origin: normalized.origin === "manual" ? "manual" : "reflector",
      promoted: normalized.promoted === true,
      mergeCount: (normalized.mergeCount ?? 0) + 1,
      hitCount: normalized.hintCount,
      lastUsed: normalized.lastHintedAt,
    };
  }

  function mergeIntoExisting(target: IndexedPrinciple, draft: PrincipleDraft, source?: string): boolean {
    const incomingContent = normalizeContent(draft.content);
    if (!incomingContent) return false;

    const nextContent = choosePreferredContent(target.content, incomingContent);
    const nextTags = normalizeTags([...target.tags, ...(draft.tags ?? [])]);
    target.content = nextContent;
    target.tags = nextTags;
    target.updated = nowIso();
    target.metadata = mergeMetadata(target.metadata, source);
    target._tokens = buildTokens(target);
    target._tagTokens = buildTagTokens(target.tags);
    return true;
  }

  function bumpHint(item: IndexedPrinciple): void {
    const now = nowIso();
    const timestamps = [...(item.metadata.hintTimestamps ?? []), now].slice(-MAX_HINT_TIMESTAMPS);
    const nextHintCount = (item.metadata.hintCount ?? item.metadata.hitCount ?? 0) + 1;
    item.metadata.hintCount = nextHintCount;
    item.metadata.hitCount = nextHintCount;
    item.metadata.activeScore = Math.max(0, item.metadata.activeScore ?? 0) + 1;
    item.metadata.lastHintedAt = now;
    item.metadata.lastUsed = now;
    item.metadata.hintTimestamps = timestamps;
    item.updated = now;
  }

  function createConflictGroupId(): string {
    return `${CONFLICT_GROUP_PREFIX}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function attachConflict(target: IndexedPrinciple, draft: PrincipleDraft, source?: string): boolean {
    const content = normalizeContent(draft.content);
    if (!content) return false;

    const groupId = target.metadata.conflictGroupId ?? createConflictGroupId();
    target.metadata.conflictGroupId = groupId;
    const now = nowIso();
    target.updated = now;

    const item: PrincipleItem = {
      id: generateId("principle"),
      created: now,
      updated: now,
      tags: normalizeTags(draft.tags ?? []),
      content,
      metadata: normalizeMetadata({
        source,
        sources: source ? [source] : [],
        hintCount: 0,
        activeScore: 0,
        hintTimestamps: [],
        conflictGroupId: groupId,
      }),
    };
    index.set(item.id, asIndexed(item));
    return true;
  }

  function getHitCount(item: Pick<PrincipleItem, "metadata">): number {
    return item.metadata.hitCount ?? item.metadata.hintCount ?? 0;
  }

  function isManualPromoted(item: Pick<PrincipleItem, "metadata">): boolean {
    return item.metadata.origin === "manual" && item.metadata.promoted === true;
  }

  function isReflectorInjectable(item: Pick<PrincipleItem, "metadata">): boolean {
    return item.metadata.origin !== "manual" && getHitCount(item) > HIGH_VALUE_HINT_THRESHOLD;
  }

  function shouldDecay(item: IndexedPrinciple, nowMs: number): boolean {
    if (isManualPromoted(item)) return false;
    const updatedAt = new Date(item.updated ?? item.created).getTime();
    if (!Number.isFinite(updatedAt)) return false;
    if (nowMs - updatedAt < 7 * 24 * 60 * 60 * 1000) return false;

    const lastHintedAt = item.metadata.lastHintedAt
      ? new Date(item.metadata.lastHintedAt).getTime()
      : 0;
    const baseline = Number.isFinite(lastHintedAt) && lastHintedAt > 0 ? lastHintedAt : updatedAt;
    const lastDecayAt = item.metadata.lastDecayAt ? new Date(item.metadata.lastDecayAt).getTime() : 0;
    const hintCount = item.metadata.hintCount ?? item.metadata.hitCount ?? 0;
    const decayWindowMs = hintCount > HIGH_VALUE_HINT_THRESHOLD
      ? 21 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000;

    if (nowMs - baseline < decayWindowMs) return false;
    if (Number.isFinite(lastDecayAt) && lastDecayAt > 0 && nowMs - lastDecayAt < decayWindowMs) return false;
    return true;
  }

  function decayPrinciples(): number {
    const now = Date.now();
    let changed = 0;
    for (const item of index.values()) {
      if (!shouldDecay(item, now)) continue;
      const current = item.metadata.activeScore ?? item.metadata.hintCount ?? item.metadata.hitCount ?? 0;
      const next = Math.max(0, current - 1);
      if (next !== current) {
        item.metadata.activeScore = next;
        item.metadata.lastDecayAt = nowIso();
        item.updated = nowIso();
        changed += 1;
      }
    }
    return changed;
  }


  function isInjectable(item: IndexedPrinciple): boolean {
    if (item.metadata.lifecycle === "stale" || item.metadata.lifecycle === "archived" || item.metadata.lifecycle === "disabled") {
      return false;
    }
    if (isManualPromoted(item)) return true;
    return isReflectorInjectable(item);
  }

  function compareInjectable(a: IndexedPrinciple, b: IndexedPrinciple): number {
    const promotedDiff = Number(isManualPromoted(b)) - Number(isManualPromoted(a));
    if (promotedDiff !== 0) return promotedDiff;
    const activeDiff = (b.metadata.activeScore ?? 0) - (a.metadata.activeScore ?? 0);
    if (activeDiff !== 0) return activeDiff;
    const recent60Diff = recentHintCount(b, 60) - recentHintCount(a, 60);
    if (recent60Diff !== 0) return recent60Diff;
    const recent30Diff = recentHintCount(b, 30) - recentHintCount(a, 30);
    if (recent30Diff !== 0) return recent30Diff;
    const hintDiff = (b.metadata.hintCount ?? b.metadata.hitCount ?? 0) - (a.metadata.hintCount ?? a.metadata.hitCount ?? 0);
    if (hintDiff !== 0) return hintDiff;
    return new Date(b.updated ?? b.created).getTime() - new Date(a.updated ?? a.created).getTime();
  }

  function resolveConflictGroups(items: IndexedPrinciple[]): IndexedPrinciple[] {
    const byGroup = new Map<string, IndexedPrinciple[]>();
    const withoutGroup: IndexedPrinciple[] = [];

    for (const item of items) {
      const groupId = item.metadata.conflictGroupId;
      if (!groupId) {
        withoutGroup.push(item);
        continue;
      }
      const group = byGroup.get(groupId) ?? [];
      group.push(item);
      byGroup.set(groupId, group);
    }

    const winners: IndexedPrinciple[] = [];
    for (const group of byGroup.values()) {
      const winner = [...group].sort(compareInjectable)[0];
      if (winner) winners.push(winner);
    }

    return [...withoutGroup, ...winners].sort(compareInjectable);
  }

  function isStaleCandidate(item: IndexedPrinciple): boolean {
    return /RequirementLedger|standingInstructions|ObjectiveSnapshot/.test(item.content);
  }

  function isPseudoCandidate(item: IndexedPrinciple): boolean {
    const addedCount = (item.content.match(/新增：/g) ?? []).length;
    return addedCount >= 2
      || /TODO\.md|README|package\.json/.test(item.content)
      || /同步文档|迁移|回归决策记录/.test(item.content);
  }

  function isOversizedCandidate(item: IndexedPrinciple): boolean {
    return item.content.length > 280;
  }

  function refreshHealth(): void {
    const items = Array.from(index.values());
    const active = items.filter((item) => (item.metadata.activeScore ?? item.metadata.hintCount ?? item.metadata.hitCount ?? 0) > 0).length;
    const injectableItems = items.filter(isInjectable);
    const conflictGroupIds = new Set<string>();
    let conflictedItems = 0;
    let staleCandidates = 0;
    let pseudoCandidates = 0;
    let oversizedCandidates = 0;
    for (const item of items) {
      if (item.metadata.conflictGroupId) {
        conflictGroupIds.add(item.metadata.conflictGroupId);
        conflictedItems += 1;
      }
      if (isStaleCandidate(item)) staleCandidates += 1;
      if (isPseudoCandidate(item)) pseudoCandidates += 1;
      if (isOversizedCandidate(item)) oversizedCandidates += 1;
    }

    diagnostics.health = {
      total: items.length,
      injectable: resolveConflictGroups(injectableItems).length,
      active,
      conflictGroups: conflictGroupIds.size,
      conflictedItems,
    };
    diagnostics.review = {
      staleCandidates,
      pseudoCandidates,
      oversizedCandidates,
    };
  }

  async function writeRegistry(): Promise<void> {
    if (!registryPath) return;

    const existingMetadataById = new Map<string, Record<string, unknown>>();
    try {
      const raw = await fs.readFile(registryPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PrinciplesRegistry>;
      const principles = Array.isArray(parsed.principles) ? parsed.principles : [];
      for (const item of principles) {
        if (!item || typeof item !== "object") continue;
        if (typeof item.id !== "string") continue;
        const metadata = item.metadata;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue;
        existingMetadataById.set(item.id, { ...(metadata as Record<string, unknown>) });
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn(`Failed to read existing principles registry before write ${registryPath}:`, err);
      }
    }

    const registry: PrinciplesRegistry = {
      version: REGISTRY_VERSION,
      updatedAt: nowIso(),
      principles: Array.from(index.values())
        .sort((a, b) => new Date(b.updated ?? b.created).getTime() - new Date(a.updated ?? a.created).getTime())
        .map((item) => ({
          id: item.id,
          created: item.created,
          updated: item.updated,
          tags: [...item.tags],
          content: item.content,
          metadata: {
            ...(existingMetadataById.get(item.id) ?? {}),
            source: item.metadata.source,
            sources: [...(item.metadata.sources ?? [])],
            origin: item.metadata.origin === "manual" ? "manual" : "reflector",
            promoted: item.metadata.promoted === true,
            hintCount: item.metadata.hintCount ?? item.metadata.hitCount ?? 0,
            activeScore: item.metadata.activeScore ?? item.metadata.hintCount ?? item.metadata.hitCount ?? 0,
            lastHintedAt: item.metadata.lastHintedAt ?? item.metadata.lastUsed,
            hintTimestamps: [...(item.metadata.hintTimestamps ?? [])],
            lastDecayAt: item.metadata.lastDecayAt,
            mergeCount: item.metadata.mergeCount ?? 0,
            conflictGroupId: item.metadata.conflictGroupId,
            lifecycle: item.metadata.lifecycle ?? "active",
            // legacy compatibility
            hitCount: item.metadata.hintCount ?? item.metadata.hitCount ?? 0,
            lastUsed: item.metadata.lastHintedAt ?? item.metadata.lastUsed,
            conflictStatus: item.metadata.conflictStatus ?? "clean",
          },
        })),
    };

    const tempPath = `${registryPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(registry, null, 2), "utf-8");
    await fs.rename(tempPath, registryPath);
  }

  async function loadRegistryFile(): Promise<boolean> {
    try {
      const raw = await fs.readFile(registryPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<PrinciplesRegistry>;
      diagnostics.migration.loadedRegistryVersion = typeof parsed.version === "number" ? parsed.version : 1;
      const items = Array.isArray(parsed.principles) ? parsed.principles : [];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        if (typeof item.id !== "string" || typeof item.created !== "string" || typeof item.content !== "string") continue;
        const hadLegacyShape = !item.metadata
          || item.metadata.hintCount == null
          || item.metadata.activeScore == null
          || item.metadata.lastHintedAt == null
          || !Array.isArray(item.metadata.hintTimestamps)
          || item.metadata.conflictGroupId === undefined
          || item.metadata.origin === undefined
          || item.metadata.promoted === undefined;
        if (hadLegacyShape) {
          diagnostics.migration.normalizedRegistryItems += 1;
        }
        const publicItem: PrincipleItem = {
          id: item.id,
          created: item.created,
          updated: typeof item.updated === "string" ? item.updated : undefined,
          tags: normalizeTags(Array.isArray(item.tags) ? item.tags.map(String) : []),
          content: normalizeContent(item.content),
          metadata: normalizeMetadata(item.metadata),
        };
        index.set(publicItem.id, asIndexed(publicItem));
      }
      return items.length > 0;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn(`Failed to read principles registry ${registryPath}:`, err);
      }
      return false;
    }
  }

  async function loadLegacyYamlFiles(): Promise<boolean> {
    let migrated = false;

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;

        diagnostics.migration.legacyYamlFilesDetected += 1;
        const filePath = path.join(currentDir, entry.name);
        try {
          const raw = await fs.readFile(filePath, "utf-8");
          const parsed = parseLegacyPrincipleYaml(raw);
          if (!parsed?.content) continue;

          const mergeTarget = findMergeTarget(parsed.content, parsed.tags);
          if (mergeTarget) {
            mergeIntoExisting(mergeTarget, { content: parsed.content, tags: parsed.tags }, parsed.metadata.source);
          } else {
            const item: PrincipleItem = {
              id: entry.name.replace(/\.(yaml|yml)$/i, ""),
              created: parsed.created,
              updated: parsed.metadata.lastUsed ?? parsed.created,
              tags: normalizeTags(parsed.tags),
              content: normalizeContent(parsed.content),
              metadata: normalizeMetadata(parsed.metadata),
            };
            index.set(item.id, asIndexed(item));
          }
          diagnostics.migration.migratedYamlFiles += 1;
          migrated = true;
        } catch (err) {
          logger.warn(`Failed to load principle file: ${filePath}`, err);
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        logger.warn(`Failed to load legacy principles from ${currentDir}:`, err);
      }
    }

    return migrated;
  }

  async function pruneInternal(maxCount: number): Promise<number> {
    if (maxCount < 1) return 0;

    const all = Array.from(index.values()).sort(compareInjectable);
    const overflow = all.slice(maxCount);
    for (const item of overflow) {
      index.delete(item.id);
    }
    if (overflow.length > 0) {
      await writeRegistry();
    }
    return overflow.length;
  }

  async function applyOpsInternal(ops: PrincipleOp[], options: ApplyPrincipleOpsOptions): Promise<{ changed: number; deleted: number }> {
    let changed = 0;
    diagnostics.audit.applyRuns += 1;

    for (const op of ops) {
      if (op.op === "hit") {
        diagnostics.audit.ops.reuse += 1;
      } else if (op.op === "expand") {
        diagnostics.audit.ops.merge += 1;
      } else {
        diagnostics.audit.ops[op.op] += 1;
      }

      if (op.op === "reuse" || op.op === "hit") {
        const existing = index.get(op.targetId);
        if (!existing) continue;
        bumpHint(existing);
        diagnostics.audit.effects.reused += 1;
        changed += 1;
        continue;
      }

      if (op.op === "create") {
        const mergeTarget = findMergeTarget(op.content, op.tags);
        if (mergeTarget) {
          bumpHint(mergeTarget);
          diagnostics.audit.effects.reused += 1;
          changed += 1;
          continue;
        }

        const now = nowIso();
        const item: PrincipleItem = {
          id: generateId("principle"),
          created: now,
          updated: now,
          tags: normalizeTags(op.tags),
          content: normalizeContent(op.content),
          metadata: normalizeMetadata({
            source: options.source,
            sources: options.source ? [options.source] : [],
            origin: "reflector",
            promoted: false,
            hintCount: 1,
            hitCount: 1,
            activeScore: 1,
            lastHintedAt: now,
            lastUsed: now,
            hintTimestamps: [now],
          }),
        };
        index.set(item.id, asIndexed(item));
        diagnostics.audit.effects.created += 1;
        changed += 1;
        continue;
      }

      if (op.op === "merge" || op.op === "expand") {
        const existing = index.get(op.targetId);
        if (!existing) continue;
        if (mergeIntoExisting(existing, { content: op.content, tags: op.tags }, options.source)) {
          bumpHint(existing);
          diagnostics.audit.effects.merged += 1;
          changed += 1;
        }
        continue;
      }

      if (op.op === "conflict") {
        const existing = index.get(op.targetId);
        if (!existing) continue;
        if (attachConflict(existing, { content: op.content, tags: op.tags }, options.source)) {
          diagnostics.audit.effects.conflicted += 1;
          changed += 1;
        }
      }
    }

    const decayed = decayPrinciples();
    const overflowDeleted = Array.from(index.values()).length > options.hardMaxCount
      ? (await pruneInternal(options.hardMaxCount))
      : 0;

    diagnostics.audit.effects.decayed += decayed;
    diagnostics.audit.effects.deletedByOverflow += overflowDeleted;

    const totalChanged = changed + decayed;
    const totalDeleted = overflowDeleted;
    if (totalChanged > 0 || totalDeleted > 0) {
      await writeRegistry();
    }
    refreshHealth();
    return { changed: totalChanged, deleted: totalDeleted };
  }

  return {
    async load(dir: string): Promise<void> {
      currentDir = dir;
      registryPath = path.join(dir, REGISTRY_FILE);
      index.clear();
      diagnostics.migration.loadedRegistryVersion = null;
      diagnostics.migration.upgradedToVersion2 = false;
      diagnostics.migration.normalizedRegistryItems = 0;
      diagnostics.migration.migratedYamlFiles = 0;
      diagnostics.migration.legacyYamlFilesDetected = 0;
      await fs.mkdir(currentDir, { recursive: true });
      const hasRegistryData = await loadRegistryFile();
      const migratedYaml = hasRegistryData ? false : await loadLegacyYamlFiles();
      const shouldRewriteRegistry = migratedYaml
        || diagnostics.migration.normalizedRegistryItems > 0
        || ((diagnostics.migration.loadedRegistryVersion ?? REGISTRY_VERSION) < REGISTRY_VERSION);
      if (shouldRewriteRegistry) {
        diagnostics.migration.upgradedToVersion2 = true;
        await writeRegistry();
      }
      refreshHealth();
      logger.info(`Loaded ${index.size} principles from ${registryPath}`);
    },

    list(): PrincipleItem[] {
      return Array.from(index.values())
        .sort(compareInjectable)
        .map(toPublicItem);
    },

    listSlim(limit: number): SlimPrincipleItem[] {
      return Array.from(index.values())
        .sort((a, b) => {
          const aScore = (a.metadata.hintCount ?? a.metadata.hitCount ?? 0);
          const bScore = (b.metadata.hintCount ?? b.metadata.hitCount ?? 0);
          return bScore - aScore;
        })
        .slice(0, Math.max(0, limit))
        .map((item) => ({ id: item.id, tags: [...item.tags], content: item.content }));
    },

    search(query: string, limit: number): PrincipleItem[] {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const queryTokens = extractKeywords(trimmed);
      const scored: IndexedPrinciple[] = [];
      for (const item of resolveConflictGroups(Array.from(index.values()).filter(isInjectable))) {
        const score = scorePrinciple(item, trimmed, queryTokens);
        if (score <= 0) continue;
        scored.push({ ...item, score });
      }

      return scored
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit)
        .map(toPublicItem);
    },

    listInjectable(limit: number): PrincipleItem[] {
      return resolveConflictGroups(Array.from(index.values()).filter(isInjectable))
        .slice(0, Math.max(0, limit))
        .map(toPublicItem);
    },

    async applyPrincipleOps(ops: PrincipleOp[], options: ApplyPrincipleOpsOptions): Promise<{ changed: number; deleted: number }> {
      if (!currentDir) {
        throw new Error("Principles manager not initialized. Call load(dir) first.");
      }
      await fs.mkdir(currentDir, { recursive: true });
      return applyOpsInternal(ops, options);
    },

    async prune(maxCount: number): Promise<number> {
      diagnostics.audit.pruneRuns += 1;
      const decayed = decayPrinciples();
      const overflow = await pruneInternal(maxCount);
      diagnostics.audit.effects.decayed += decayed;
      diagnostics.audit.effects.deletedByOverflow += overflow;
      if (decayed > 0) {
        await writeRegistry();
      }
      refreshHealth();
      return overflow;
    },

    async deleteByIds(ids: string[]): Promise<number> {
      let deleted = 0;
      for (const id of ids) {
        if (index.delete(id)) deleted += 1;
      }
      if (deleted > 0) {
        diagnostics.audit.effects.deletedByOverflow += deleted;
        await writeRegistry();
        refreshHealth();
      }
      return deleted;
    },

    getDiagnostics(): PrinciplesDiagnostics {
      refreshHealth();
      return JSON.parse(JSON.stringify(diagnostics)) as PrinciplesDiagnostics;
    },

    getDirectory(): string {
      return currentDir;
    },

    count(): number {
      return index.size;
    },
  };
}

export function formatPrinciplesForInjection(principles: PrincipleItem[]): string {
  if (principles.length === 0) return "";

  const constitutionPrinciples = principles.filter((principle) => principle.metadata.origin === "manual" && principle.metadata.promoted === true);
  const historicalPrinciples = principles.filter((principle) => !(principle.metadata.origin === "manual" && principle.metadata.promoted === true));

  const lines: string[] = [];

  if (constitutionPrinciples.length > 0) {
    lines.push("--- 人工宪法原则 ---");
    lines.push("以下为人工确认并晋升的长期原则，优先于普通历史经验层，但不得覆盖当前用户明确要求与当前代码事实。");
    for (const principle of constitutionPrinciples) {
      lines.push(`- ${principle.content}`);
    }
    lines.push("--- 人工宪法原则结束 ---");
  }

  if (historicalPrinciples.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("--- 经验原则（来自历史会话）---");
    lines.push("以下为历史经验启发，仅在不与当前目标、当前用户要求、当前代码事实冲突时参考。");
    for (const principle of historicalPrinciples) {
      lines.push(`- ${principle.content}`);
    }
    lines.push("--- 经验原则结束 ---");
  }

  return lines.join("\n");
}

function parseLegacyPrincipleYaml(content: string): Omit<PrincipleItem, "id" | "score" | "updated"> | null {
  try {
    const lines = content.split("\n");
    let i = 0;

    while (i < lines.length && !lines[i].trim()) i++;
    if (!lines[i]?.startsWith("type:")) return null;
    if (lines[i].slice(5).trim() !== "principle") return null;
    i++;

    if (!lines[i]?.startsWith("created:")) return null;
    const created = lines[i].slice(8).trim().replace(/^["']|["']$/g, "");
    i++;

    if (!lines[i]?.startsWith("tags:")) return null;
    i++;

    const tags: string[] = [];
    while (i < lines.length && lines[i].match(/^\s+-/)) {
      const tag = lines[i].replace(/^\s+-\s*/, "").trim();
      if (tag && tag !== "[]") tags.push(tag);
      i++;
    }

    if (!lines[i]?.includes("content:") || !lines[i]?.includes("|")) return null;
    i++;

    const contentLines: string[] = [];
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith("metadata:")) break;
      if (!line.trim()) {
        contentLines.push("");
      } else if (line.startsWith("  ")) {
        contentLines.push(line.slice(2));
      }
      i++;
    }

    const metadata: PrincipleMetadata = {};
    if (lines[i]?.startsWith("metadata:") && lines[i].includes("|")) {
      i++;
      const metaLines: string[] = [];
      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) {
          metaLines.push("");
        } else if (line.startsWith("  ")) {
          metaLines.push(line.slice(2));
        }
        i++;
      }

      for (const line of metaLines) {
        const separator = line.indexOf(":");
        if (separator === -1) continue;
        const key = line.slice(0, separator).trim();
        const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
        if (key === "source" && value) metadata.source = value;
        if (key === "origin" && (value === "reflector" || value === "manual")) metadata.origin = value;
        if (key === "promoted") metadata.promoted = value === "true";
        if (key === "lastUsed" && value) metadata.lastUsed = value;
        if (key === "lastHintedAt" && value) metadata.lastHintedAt = value;
        if (key === "lastDecayAt" && value) metadata.lastDecayAt = value;
        if (key === "conflictGroupId" && value) metadata.conflictGroupId = value;
        if (key === "hitCount" || key === "hintCount" || key === "activeScore" || key === "mergeCount") {
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) continue;
          if (key === "hitCount") metadata.hitCount = parsed;
          if (key === "hintCount") metadata.hintCount = parsed;
          if (key === "activeScore") metadata.activeScore = parsed;
          if (key === "mergeCount") metadata.mergeCount = parsed;
        }
      }
    }

    return {
      created,
      tags,
      content: contentLines.join("\n").trim(),
      metadata,
    };
  } catch {
    return null;
  }
}
