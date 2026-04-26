/**
 * PasstoContext Memory Index
 * In-memory index for fast memory search
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MemoryItem, IndexedMemory, MemoryConfig } from "./types.js";
import { extractKeywords, generateId, nowIso, safeFileName } from "./utils.js";
import type { Logger } from "./types.js";

// =============================================================================
// Memory Index
// =============================================================================

export interface MemoryIndex {
  /**
   * Load all memory files from disk into memory
   */
  load(dir: string): Promise<void>;

  /**
   * Search for relevant memories
   */
  search(query: string, limit: number): IndexedMemory[];

  /**
   * Add a new memory item (writes to disk + updates index)
   */
  add(item: MemoryInput, dir: string): Promise<string>;

  /**
   * Delete a memory item by ID (removes from disk + index)
   */
  delete(id: string): Promise<boolean>;

  /**
   * Get all memories
   */
  getAll(): IndexedMemory[];

  /**
   * Get memory by ID
   */
  getById(id: string): IndexedMemory | null;

  /**
   * Get total count
   */
  count(): number;
}

export interface MemoryInput {
  type: MemoryItem["type"];
  tags: string[];
  content: string;
}

/**
 * Create a memory index instance
 */
export function createMemoryIndex(logger: Logger): MemoryIndex {
  // In-memory index: id -> IndexedMemory
  const index = new Map<string, IndexedMemory>();

  /**
   * Build the search token set for a memory item
   */
  function buildTokens(item: MemoryItem): Set<string> {
    const tokens = new Set<string>();

    // Tokenize content
    const contentTokens = extractKeywords(item.content);
    for (const t of contentTokens) {
      tokens.add(t);
    }

    // Tokenize tags
    for (const tag of item.tags) {
      tokens.add(tag.toLowerCase());
    }

    // Also add bigrams from content (pairs of consecutive significant words)
    const words = item.content.split(/\s+/).filter((w) => w.length > 3);
    for (let i = 0; i < words.length - 1; i++) {
      tokens.add(`${words[i].toLowerCase()} ${words[i + 1].toLowerCase()}`);
    }

    return tokens;
  }

  /**
   * Calculate relevance score for a memory against query keywords
   */
  function scoreMemory(memory: IndexedMemory, queryTokens: string[]): number {
    const tokens = memory._tokens;
    if (tokens.size === 0) return 0;

    let score = 0;

    // Count keyword matches
    let matchCount = 0;
    for (const qt of queryTokens) {
      if (tokens.has(qt)) {
        matchCount++;
        score += 1.0; // Exact match
      }
      // Partial match (query token is substring of indexed token)
      for (const t of tokens) {
        if (t.includes(qt) && t !== qt) {
          score += 0.5;
          break;
        }
      }
    }

    if (matchCount === 0) return 0;

    // Tag match bonus
    for (const qt of queryTokens) {
      if (memory.tags.some((tag) => tag.toLowerCase().includes(qt))) {
        score += 2.0; // Tags are weighted heavily
      }
    }

    // Normalize by query length
    score = score / Math.sqrt(queryTokens.length);

    // Recency bonus: newer memories score higher
    const daysOld = (Date.now() - new Date(memory.created).getTime()) / (1000 * 60 * 60 * 24);
    const recencyBonus = Math.max(0, 1 - daysOld / 30); // Decay over 30 days
    score += recencyBonus * 0.5;

    return score;
  }

  return {
    /**
     * Load all YAML memory files from directory into memory
     */
    async load(dir: string): Promise<void> {
      index.clear();

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (!entry.isFile()) continue;
          if (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml")) continue;

          const filePath = path.join(dir, entry.name);
          try {
            const content = await fs.readFile(filePath, "utf-8");
            const item = parseYamlMemory(content);

            if (!item) {
              logger.warn(`Failed to parse memory file: ${filePath}`);
              continue;
            }

            // Use filename (without extension) as ID
            const id = entry.name.replace(/\.(yaml|yml)$/, "");
            const indexed: IndexedMemory = {
              ...item,
              id,
              filePath,
              _tokens: buildTokens(item),
            };

            index.set(id, indexed);
          } catch (err) {
            logger.warn(`Failed to read memory file: ${filePath}`, err);
          }
        }

        logger.info(`Loaded ${index.size} memories from ${dir}`);
      } catch (err) {
        // Directory doesn't exist yet — that's fine
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
          logger.warn(`Failed to load memories from ${dir}:`, err);
        }
      }
    },

    /**
     * Search for relevant memories
     */
    search(query: string, limit: number): IndexedMemory[] {
      if (!query.trim()) return [];

      const queryTokens = extractKeywords(query);
      if (queryTokens.length === 0) {
        // Fall back to simple string match
        const lower = query.toLowerCase();
        const results = Array.from(index.values()).filter(
          (m) => m.content.toLowerCase().includes(lower) || m.tags.some((t) => t.toLowerCase().includes(lower)),
        );
        return results.slice(0, limit);
      }

      // Score all memories
      const scored: Array<{ memory: IndexedMemory; score: number }> = [];

      for (const memory of index.values()) {
        const score = scoreMemory(memory, queryTokens);
        if (score > 0) {
          scored.push({ memory, score });
        }
      }

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // Return top N with scores attached
      const results = scored.slice(0, limit).map(({ memory, score }) => ({
        ...memory,
        score,
      }));

      return results;
    },

    /**
     * Add a new memory item
     */
    async add(input: MemoryInput, dir: string): Promise<string> {
      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Generate ID from content hash
      const id = generateId(input.type.replace("_", "-"));
      const created = nowIso();

      const item: MemoryItem = {
        id,
        type: input.type,
        created,
        tags: input.tags,
        content: input.content,
      };

      const fileName = `${safeFileName(id)}.yaml`;
      const filePath = path.join(dir, fileName);

      // Serialize and write
      const yaml = serializeYamlMemory(item);
      await fs.writeFile(filePath, yaml, "utf-8");

      // Add to index
      const indexed: IndexedMemory = {
        ...item,
        filePath,
        _tokens: buildTokens(item),
      };
      index.set(id, indexed);

      logger.debug(`Saved memory: ${id} -> ${filePath}`);
      return id;
    },

    /**
     * Delete a memory item
     */
    async delete(id: string): Promise<boolean> {
      const memory = index.get(id);
      if (!memory) return false;

      try {
        await fs.unlink(memory.filePath);
        index.delete(id);
        logger.debug(`Deleted memory: ${id}`);
        return true;
      } catch (err) {
        logger.warn(`Failed to delete memory ${id}:`, err);
        return false;
      }
    },

    /**
     * Get all memories (without scores, sorted by date descending)
     */
    getAll(): IndexedMemory[] {
      return Array.from(index.values()).sort(
        (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime(),
      );
    },

    /**
     * Get memory by ID
     */
    getById(id: string): IndexedMemory | null {
      return index.get(id) || null;
    },

    /**
     * Count of indexed memories
     */
    count(): number {
      return index.size;
    },
  };
}

// =============================================================================
// YAML Parsing (simple, inline to avoid circular deps)
// =============================================================================

function parseYamlMemory(content: string): MemoryItem | null {
  try {
    const lines = content.split("\n");
    let i = 0;

    // Skip empty lines
    while (i < lines.length && !lines[i].trim()) i++;
    if (i >= lines.length) return null;

    // Parse type
    const typeLine = lines[i];
    if (!typeLine.startsWith("type:")) return null;
    const type = typeLine.slice(5).trim() as MemoryItem["type"];
    i++;

    // Parse created
    if (!lines[i]?.startsWith("created:")) return null;
    const created = lines[i].slice(8).trim().replace(/^["']|["']$/g, "");
    i++;

    // Parse tags
    if (!lines[i]?.startsWith("tags:")) return null;
    i++;

    const tags: string[] = [];
    while (i < lines.length && lines[i].match(/^\s+-/)) {
      const tag = lines[i].replace(/^\s+-\s*/, "").trim();
      if (tag && tag !== "[]") tags.push(tag);
      i++;
    }

    // Parse content (everything after "content: |")
    if (!lines[i]?.includes("content:") || !lines[i]?.includes("|")) return null;
    i++;

    const contentLines: string[] = [];
    while (i < lines.length) {
      const line = lines[i];
      // Stop at top-level keys
      if (line.match(/^[a-z_]+:/) && !line.startsWith("  ") && !line.startsWith("\t")) {
        break;
      }
      if (line.trim() === "") {
        contentLines.push("");
      } else if (line.startsWith("  ")) {
        contentLines.push(line.slice(2));
      }
      i++;
    }

    const id = `memory-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    return {
      id,
      type,
      created,
      tags,
      content: contentLines.join("\n").trim(),
    };
  } catch {
    return null;
  }
}

function serializeYamlMemory(item: MemoryItem): string {
  let yaml = "";
  yaml += `type: ${item.type}\n`;
  yaml += `created: "${item.created}"\n`;
  yaml += `tags:\n`;
  if (item.tags.length === 0) {
    yaml += `  []\n`;
  } else {
    for (const tag of item.tags) {
      const escaped = tag.replace(/([:#\[\],{}])/g, "\\$1");
      yaml += `  - ${escaped}\n`;
    }
  }
  yaml += `content: |\n`;
  for (const line of item.content.split("\n")) {
    yaml += `  ${line}\n`;
  }
  return yaml;
}
