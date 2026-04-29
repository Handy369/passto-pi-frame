// Step 4: Minimal file I/O helpers for planner artifact generation.

import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Ensure parent directory exists.
 */
export function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write text content to a file, creating parent directories as needed.
 */
export function writeTextFile(filePath: string, content: string): void {
  ensureDir(filePath);
  fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Read text content from a file. Returns null if file doesn't exist.
 */
export function readTextFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
