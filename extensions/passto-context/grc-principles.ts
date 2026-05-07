import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Logger, PrincipleDraft } from "./types.js";
import { extractKeywords, generateId, nowIso, safeFileName } from "./utils.js";

interface PrincipleMetadata {
  source?: string;
  hitCount?: number;
  lastUsed?: string;
}

export interface PrincipleItem {
  id: string;
  created: string;
  tags: string[];
  content: string;
  metadata: PrincipleMetadata;
  score?: number;
}

interface IndexedPrinciple extends PrincipleItem {
  filePath: string;
  _tokens: Set<string>;
  _tagTokens: Set<string>;
}

interface AddPrinciplesOptions {
  source?: string;
  maxCount: number;
}

export interface PrinciplesManager {
  load(dir: string): Promise<void>;
  list(): PrincipleItem[];
  search(query: string, limit: number): PrincipleItem[];
  addMany(principles: PrincipleDraft[], options: AddPrinciplesOptions): Promise<number>;
  markUsed(principles: PrincipleItem[]): Promise<void>;
  prune(maxCount: number): Promise<number>;
  getDirectory(): string;
  count(): number;
}

export function createPrinciplesManager(logger: Logger): PrinciplesManager {
  const index = new Map<string, IndexedPrinciple>();
  let currentDir = "";

  function normalizeContent(content: string): string {
    return content.replace(/\s+/g, " ").trim();
  }

  function buildTokens(item: Pick<PrincipleItem, "content" | "tags">): Set<string> {
    const tokens = new Set<string>();
    for (const token of extractKeywords(item.content)) {
      tokens.add(token);
    }
    for (const tag of item.tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!normalizedTag) continue;
      tokens.add(normalizedTag);
      for (const token of extractKeywords(normalizedTag)) {
        tokens.add(token);
      }
    }
    return tokens;
  }

  function buildTagTokens(tags: string[]): Set<string> {
    const tokens = new Set<string>();
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase().trim();
      if (!normalizedTag) continue;
      tokens.add(normalizedTag);
      for (const token of extractKeywords(normalizedTag)) {
        tokens.add(token);
      }
    }
    return tokens;
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

    const hitBonus = Math.min(item.metadata.hitCount ?? 0, 10) * 0.08;
    const recencyDays = Math.max(0, (Date.now() - new Date(item.created).getTime()) / (1000 * 60 * 60 * 24));
    const recencyBonus = Math.max(0, 0.3 - recencyDays / 120);
    return score / Math.sqrt(queryTokens.length) + hitBonus + recencyBonus;
  }

  function toPublicItem(item: IndexedPrinciple): PrincipleItem {
    return {
      id: item.id,
      created: item.created,
      tags: [...item.tags],
      content: item.content,
      metadata: { ...item.metadata },
      score: item.score,
    };
  }

  function findDuplicate(content: string): IndexedPrinciple | null {
    const normalized = normalizeContent(content).toLowerCase();
    for (const principle of index.values()) {
      if (normalizeContent(principle.content).toLowerCase() === normalized) {
        return principle;
      }
    }
    return null;
  }

  async function rewritePrinciple(item: IndexedPrinciple): Promise<void> {
    await fs.writeFile(item.filePath, serializePrincipleYaml(item), "utf-8");
  }

  async function pruneInternal(maxCount: number): Promise<number> {
    if (maxCount < 1) return 0;

    const all = Array.from(index.values()).sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    const overflow = all.slice(maxCount);
    let removed = 0;

    for (const item of overflow) {
      try {
        await fs.unlink(item.filePath);
        removed += 1;
      } catch (err) {
        logger.warn(`Failed to prune principle ${item.id}:`, err);
      }
      index.delete(item.id);
    }

    return removed;
  }

  return {
    async load(dir: string): Promise<void> {
      currentDir = dir;
      index.clear();

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;

          const filePath = path.join(dir, entry.name);
          try {
            const raw = await fs.readFile(filePath, "utf-8");
            const parsed = parsePrincipleYaml(raw);
            if (!parsed) continue;

            const id = entry.name.replace(/\.(yaml|yml)$/i, "");
            const indexed: IndexedPrinciple = {
              ...parsed,
              id,
              filePath,
              _tokens: buildTokens(parsed),
              _tagTokens: buildTagTokens(parsed.tags),
            };
            index.set(id, indexed);
          } catch (err) {
            logger.warn(`Failed to load principle file: ${filePath}`, err);
          }
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          logger.warn(`Failed to load principles from ${dir}:`, err);
        }
      }

      logger.info(`Loaded ${index.size} principles from ${dir}`);
    },

    list(): PrincipleItem[] {
      return Array.from(index.values())
        .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
        .map(toPublicItem);
    },

    search(query: string, limit: number): PrincipleItem[] {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const queryTokens = extractKeywords(trimmed);
      const scored: IndexedPrinciple[] = [];

      for (const item of index.values()) {
        const score = scorePrinciple(item, trimmed, queryTokens);
        if (score <= 0) continue;
        scored.push({ ...item, score });
      }

      return scored
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit)
        .map(toPublicItem);
    },

    async addMany(principles: PrincipleDraft[], options: AddPrinciplesOptions): Promise<number> {
      if (!currentDir) {
        throw new Error("Principles manager not initialized. Call load(dir) first.");
      }

      await fs.mkdir(currentDir, { recursive: true });

      let saved = 0;
      for (const draft of principles) {
        const content = normalizeContent(draft.content);
        if (!content) continue;

        const duplicate = findDuplicate(content);
        if (duplicate) {
          continue;
        }

        const id = generateId("principle");
        const created = nowIso();
        const item: IndexedPrinciple = {
          id,
          created,
          tags: Array.from(new Set((draft.tags ?? []).map((tag) => tag.trim()).filter(Boolean))).slice(0, 8),
          content,
          metadata: {
            source: options.source,
            hitCount: 0,
          },
          filePath: path.join(currentDir, `${safeFileName(id)}.yaml`),
          _tokens: new Set<string>(),
          _tagTokens: new Set<string>(),
        };
        item._tokens = buildTokens(item);
        item._tagTokens = buildTagTokens(item.tags);

        await fs.writeFile(item.filePath, serializePrincipleYaml(item), "utf-8");
        index.set(item.id, item);
        saved += 1;
      }

      await pruneInternal(options.maxCount);
      return saved;
    },

    async markUsed(principles: PrincipleItem[]): Promise<void> {
      for (const principle of principles) {
        const existing = index.get(principle.id);
        if (!existing) continue;
        existing.metadata.hitCount = (existing.metadata.hitCount ?? 0) + 1;
        existing.metadata.lastUsed = nowIso();
        try {
          await rewritePrinciple(existing);
        } catch (err) {
          logger.warn(`Failed to update principle usage for ${existing.id}:`, err);
        }
      }
    },

    async prune(maxCount: number): Promise<number> {
      return pruneInternal(maxCount);
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

  const lines = ["--- 经验原则（来自历史会话）---"];
  for (const principle of principles) {
    lines.push(`- ${principle.content}`);
  }
  lines.push("--- 经验原则结束 ---");
  return lines.join("\n");
}

function parsePrincipleYaml(content: string): Omit<PrincipleItem, "id" | "score"> | null {
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
        if (key === "lastUsed" && value) metadata.lastUsed = value;
        if (key === "hitCount") {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) metadata.hitCount = parsed;
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

function serializePrincipleYaml(item: PrincipleItem): string {
  let yaml = "";
  yaml += "type: principle\n";
  yaml += `created: \"${item.created}\"\n`;
  yaml += "tags:\n";
  if (item.tags.length === 0) {
    yaml += "  []\n";
  } else {
    for (const tag of item.tags) {
      yaml += `  - ${tag.replace(/([:#\[\],{}])/g, "\\$1")}\n`;
    }
  }
  yaml += "content: |\n";
  for (const line of item.content.split("\n")) {
    yaml += `  ${line}\n`;
  }
  yaml += "metadata: |\n";
  if (item.metadata.source) {
    yaml += `  source: ${item.metadata.source}\n`;
  }
  yaml += `  hitCount: ${item.metadata.hitCount ?? 0}\n`;
  if (item.metadata.lastUsed) {
    yaml += `  lastUsed: ${item.metadata.lastUsed}\n`;
  }
  return yaml;
}
