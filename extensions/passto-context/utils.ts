/**
 * PasstoContext Utilities
 * Shared helper functions used across modules
 */

import * as os from "node:os";
import type { Logger, LogLevel, MemoryItem } from "./types.js";

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Expand ~ to home directory
 */
export function expandHome(filePath: string): string {
  if (filePath.startsWith("~/") || filePath === "~") {
    return filePath.replace("~", os.homedir());
  }
  return filePath;
}

/**
 * Get the default PasstoContext config directory
 */
export function getDefaultConfigDir(): string {
  return expandHome("~/.passtocontext");
}

/**
 * Get the default memory directory
 */
export function getDefaultMemoryDir(): string {
  return expandHome("~/.passtocontext/memory");
}

// =============================================================================
// Token Estimation
// =============================================================================

/**
 * Rough token estimation without a proper tokenizer.
 * English: ~4 chars/token, CJK: ~1.5 chars/token
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;

  let cjkCount = 0;
  let otherCount = 0;

  for (const char of text) {
    // CJK characters — sorted by Unicode code point, required by regex spec
    // Ranges: CJK Punctuation, Extension A, Unified Ideographs, Halfwidth/Fullwidth, Extension B-F
    if (/[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uff00-\uffef\u{20000}-\u{2a6df}]/u.test(char)) {
      cjkCount++;
    } else {
      otherCount++;
    }
  }

  return Math.ceil(cjkCount / 1.5 + otherCount / 4);
}

// =============================================================================
// Keyword Extraction
// =============================================================================

const STOP_WORDS = new Set([
  // English
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "must", "shall", "can", "need", "dare",
  "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
  "from", "as", "into", "through", "during", "before", "after",
  "above", "below", "between", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all",
  "each", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "but", "and", "or", "if", "because", "until", "while",
  "this", "that", "these", "those", "it", "its",
  // Chinese common
  "的", "了", "是", "在", "和", "与", "或", "但", "就", "都", "而",
  "及", "对", "于", "从", "到", "把", "被", "让", "给", "向", "用",
  "会", "能", "可以", "不", "也", "还", "只", "又", "更", "最",
  "已", "已经", "正在", "将", "将要", "要", "得", "地", "着", "过",
]);

/**
 * Extract keywords from text (tokenized, stop-word removed)
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];

  const tokens: string[] = [];

  // Split by whitespace and common punctuation
  const parts = text.split(/[\s\n\r\t,.!?;:'"(){}[\]·\/\-]+/);

  for (const part of parts) {
    const lower = part.toLowerCase().trim();
    // Keep words with length >= 2 and not stop words
    if (lower.length >= 2 && !STOP_WORDS.has(lower)) {
      tokens.push(lower);
    }
  }

  return tokens;
}

// =============================================================================
// Object Utilities
// =============================================================================

/**
 * Deep merge two objects. overrides takes precedence.
 */
export function deepMerge<T extends Record<string, unknown>>(defaults: T, overrides: Partial<T>): T {
  const result: Record<string, unknown> = { ...defaults };

  for (const key of Object.keys(overrides)) {
    const d = defaults[key as keyof T];
    const o = overrides[key as keyof T];

    if (
      o !== null &&
      typeof o === "object" &&
      !Array.isArray(o) &&
      d !== null &&
      typeof d === "object" &&
      !Array.isArray(d)
    ) {
      result[key] = deepMerge(d as Record<string, unknown>, o as Record<string, unknown>);
    } else if (o !== undefined) {
      result[key] = o;
    }
  }

  return result as T;
}

// =============================================================================
// YAML Serialization (simple, only for MemoryItem format)
// =============================================================================

/**
 * Serialize a MemoryItem to YAML string
 */
export function serializeMemoryYaml(item: MemoryItem): string {
  let yaml = "";
  yaml += `type: ${item.type}\n`;
  yaml += `created: "${item.created}"\n`;
  yaml += `tags:\n`;
  if (item.tags.length === 0) {
    yaml += `  []\n`;
  } else {
    for (const tag of item.tags) {
      // Escape special characters in tags
      const escaped = tag.replace(/[:#\[\],{}]/g, (c) => (c === ":" ? "\\:" : `\\${c}`));
      yaml += `  - ${escaped}\n`;
    }
  }
  yaml += `content: |\n`;
  for (const line of item.content.split("\n")) {
    yaml += `  ${line}\n`;
  }
  return yaml;
}

/**
 * Parse a YAML string back to MemoryItem
 * Only handles the specific format produced by serializeMemoryYaml
 */
export function parseMemoryYaml(content: string): MemoryItem | null {
  try {
    const lines = content.split("\n");
    let i = 0;

    // Skip empty lines at start
    while (i < lines.length && !lines[i].trim()) i++;

    // Parse type
    if (!lines[i]?.startsWith("type:")) return null;
    const type = lines[i].slice(5).trim() as MemoryItem["type"];
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
      // Check if this line is a YAML directive (starts a new key at top level)
      if (line.match(/^[a-z]+:/) && !line.startsWith("  ")) {
        break;
      }
      // Remove leading two spaces (YAML indentation)
      if (line.startsWith("  ")) {
        contentLines.push(line.slice(2));
      } else if (!line.trim() || line.startsWith("  ")) {
        contentLines.push(line);
      }
      i++;
    }

    const id = content
      .split("\n")
      .find((l) => l.includes("type:"))
      ?.split("created:")[0]?.split("tags:")[0]
      ?.replace("type:", "")
      ?.trim() || `memory-${Date.now()}`;

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

// =============================================================================
// Logger
// =============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/**
 * Create a logger that prefixes output with [PasstoContext]
 */
export function createLogger(level: LogLevel): Logger {
  const minLevel = LOG_LEVELS[level];

  const log = (method: "error" | "warn" | "info" | "debug", ...args: unknown[]) => {
    if (LOG_LEVELS[method] <= minLevel) {
      console[method](`[PasstoContext]`, ...args);
    }
  };

  return {
    error: (...args) => log("error", ...args),
    warn: (...args) => log("warn", ...args),
    info: (...args) => log("info", ...args),
    debug: (...args) => log("debug", ...args),
  };
}

// =============================================================================
// File Utilities
// =============================================================================

/**
 * Sanitize a string to be safe for use as a filename
 */
export function safeFileName(input: string): string {
  return input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 200);
}

/**
 * Generate a unique ID based on timestamp
 */
export function generateId(prefix: string): string {
  const now = new Date();
  const datePart = now.toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const random = Math.random().toString(36).slice(2, 6);
  return `${datePart}-${prefix}-${random}`;
}

// =============================================================================
// Date Utilities
// =============================================================================

/**
 * Get current ISO datetime string
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Get days since an ISO date string
 */
export function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

// =============================================================================
// Text Utilities
// =============================================================================

/**
 * Truncate text to a max length, adding ellipsis if needed
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

/**
 * Join array with commas and "and" for the last item
 */
export function joinWithAnd(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

// =============================================================================
// Session Memory Utilities
// =============================================================================

/**
 * Get the session-specific memory directory based on session file path.
 * Uses a hash of the session file to create a unique, stable directory.
 * Falls back to a global "default" directory for ephemeral sessions.
 */
export function getSessionMemoryDir(sessionFile: string | undefined | null): string {
  const baseDir = expandHome("~/.passtocontext/memory");

  if (!sessionFile) {
    // Ephemeral session (no file) — use a shared default
    return `${baseDir}/__default__/sessions`;
  }

  // Create a stable hash from the session file path
  // Use a simple hash function that works in browser and Node
  let hash = 0;
  for (let i = 0; i < sessionFile.length; i++) {
    const char = sessionFile.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const hashStr = Math.abs(hash).toString(36);

  // Extract a meaningful name from the session file path
  // e.g., "/Users/handy/project/.pi/sessions/2026-04-07-session.jsonl" -> "project-2026-04-07-session"
  const parts = sessionFile.split("/");
  const fileName = parts[parts.length - 1]?.replace(/\.jsonl$/, "") || "session";
  const parentName = parts[parts.length - 2] || "session";

  // Create a readable, unique name
  const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 30);
  const uniqueDir = `${parentName}-${safeName}-${hashStr}`;

  return `${baseDir}/${uniqueDir}/sessions`;
}

/**
 * Get session identifier from session file path for display purposes.
 */
export function getSessionDisplayName(sessionFile: string | undefined | null): string {
  if (!sessionFile) return "ephemeral";
  const parts = sessionFile.split("/");
  const fileName = parts[parts.length - 1]?.replace(/\.jsonl$/, "") || "session";
  return fileName;
}
