/**
 * PasstoContext Memory Manager
 * High-level interface for memory operations, wrapping the memory index
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { MemoryItem, MemoryConfig, MemoryInput } from "./types.js";
import { createMemoryIndex, type MemoryIndex, type MemoryInput as IndexInput } from "./memory-index.js";
import { expandHome, estimateTokens, nowIso, daysSince, joinWithAnd, getSessionMemoryDir } from "./utils.js";
import type { Logger } from "./types.js";

// =============================================================================
// Memory Manager
// =============================================================================

export interface MemoryManager {
  /**
   * Initialize: load memories from disk into memory index
   */
  init(): Promise<void>;

  /**
   * Search for relevant memories
   */
  search(query: string, limit: number): MemoryItem[];

  /**
   * Save a new memory
   */
  save(input: MemoryInput): Promise<string>;

  /**
   * Save a session summary (convenience method)
   */
  saveSessionSummary(summary: string, tags?: string[]): Promise<string>;

  /**
   * Delete a memory by ID
   */
  forget(id: string): Promise<boolean>;

  /**
   * Clean up old memories (by age and count)
   */
  cleanup(maxAgeDays: number, maxFiles: number): Promise<number>;

  /**
   * List all memories
   */
  list(): MemoryItem[];

  /**
   * Format memories for LLM injection (respects token budget)
   */
  formatForInjection(memories: MemoryItem[], maxTokens: number): string;

  /**
   * Get memory by ID
   */
  getById(id: string): MemoryItem | null;
}

export function createMemoryManager(config: MemoryConfig, logger: Logger): MemoryManager {
  const index = createMemoryIndex(logger);
  let sessionDir = "";

  return {
    /**
     * Initialize the memory manager with a session-specific directory.
     * @param sessionFile - The session file path (from ctx.sessionManager.getSessionFile())
     */
    async init(sessionFile?: string | null): Promise<void> {
      // Compute session-specific directory
      sessionDir = getSessionMemoryDir(sessionFile);

      // Ensure sessions subdirectory exists
      try {
        await fs.mkdir(sessionDir, { recursive: true });
      } catch {
        // Ignore
      }

      logger.debug(`Memory using session dir: ${sessionDir}`);

      // Load from session-specific sessions dir
      await index.load(sessionDir);
    },

    /**
     * Search for relevant memories
     */
    search(query: string, limit: number): MemoryItem[] {
      const results = index.search(query, limit);
      return results.map(({ score, _tokens, filePath, ...item }) => item as MemoryItem);
    },

    /**
     * Save a new memory
     */
    async save(input: MemoryInput): Promise<string> {
      // Route to appropriate subdirectory under session dir
      const typeDir = input.type === "session_summary" ? "sessions" : input.type === "entity" ? "entities" : "notes";
      let baseDir: string;
      if (sessionDir) {
        baseDir = path.dirname(sessionDir); // Go up from sessions/
      } else {
        // Fallback: use global memory dir
        baseDir = expandHome(config.dir);
      }
      const dir = path.join(baseDir, typeDir);

      const id = await index.add(input as IndexInput, dir);
      return id;
    },

    /**
     * Save a session summary
     */
    async saveSessionSummary(summary: string, tags: string[] = ["session-summary"]): Promise<string> {
      const input: MemoryInput = {
        type: "session_summary",
        tags,
        content: summary,
      };

      const id = await this.save(input);
      logger.info(`Saved session summary: ${id}`);
      return id;
    },

    /**
     * Delete a memory by ID
     */
    async forget(id: string): Promise<boolean> {
      const ok = await index.delete(id);
      if (ok) {
        logger.info(`Forgot memory: ${id}`);
      }
      return ok;
    },

    /**
     * Clean up old memories
     */
    async cleanup(maxAgeDays: number, maxFiles: number): Promise<number> {
      const allMemories = index.getAll();
      let removed = 0;

      // Phase 1: Remove expired by age
      const now = Date.now();
      for (const mem of allMemories) {
        const age = daysSince(mem.created);
        if (age > maxAgeDays) {
          const ok = await index.delete(mem.id);
          if (ok) removed++;
        }
      }

      // Phase 2: If still over limit, remove oldest
      const remaining = index.getAll();
      if (remaining.length > maxFiles) {
        const toRemove = remaining.slice(maxFiles);
        for (const mem of toRemove) {
          const ok = await index.delete(mem.id);
          if (ok) removed++;
        }
      }

      if (removed > 0) {
        logger.info(`Cleaned up ${removed} memories (maxAge: ${maxAgeDays}d, maxFiles: ${maxFiles})`);
      }

      return removed;
    },

    /**
     * List all memories
     */
    list(): MemoryItem[] {
      return index.getAll().map(({ score, _tokens, filePath, ...item }) => item as MemoryItem);
    },

    /**
     * Format memories for LLM injection with token budget
     */
    formatForInjection(memories: MemoryItem[], maxTokens: number): string {
      if (memories.length === 0) return "";

      const sections: string[] = [];
      let currentTokens = 0;

      for (const mem of memories) {
        const header = `### [${mem.type.replace("_", " ")}] ${mem.id}`;
        const tagLine = mem.tags.length > 0 ? `Tags: ${mem.tags.join(", ")}` : "";
        const content = mem.content;

        const sectionText = `${header}\n${tagLine}\n${content}`;
        const sectionTokens = estimateTokens(sectionText);

        // Check if adding this would exceed budget
        if (currentTokens + sectionTokens > maxTokens) {
          // Try just the header + truncated content
          const truncated = content.slice(0, 500);
          const shortSection = `${header}\n${tagLine}\n${truncated}...\n[truncated]`;
          const shortTokens = estimateTokens(shortSection);

          if (currentTokens + shortTokens <= maxTokens) {
            sections.push(shortSection);
            currentTokens += shortTokens;
          }
          break; // Budget exhausted
        }

        sections.push(sectionText);
        currentTokens += sectionTokens;
      }

      if (sections.length === 0) return "";

      const intro = `--- Relevant Context from Memory (${memories.length} items) ---\n`;
      const introTokens = estimateTokens(intro);
      const finalTokens = currentTokens + introTokens;

      if (finalTokens > maxTokens) {
        // Still too much, truncate sections
        const budget = maxTokens - introTokens - 20; // 20 for "..." markers
        const truncatedContent = sections.join("\n\n").slice(0, budget * 4); // rough char estimate
        return intro + truncatedContent + "\n...[truncated]";
      }

      return intro + sections.join("\n\n");
    },

    /**
     * Get memory by ID
     */
    getById(id: string): MemoryItem | null {
      const mem = index.getById(id);
      if (!mem) return null;
      const { score, _tokens, filePath, ...item } = mem;
      return item as MemoryItem;
    },
  };
}
