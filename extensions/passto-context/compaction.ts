/**
 * PasstoContext Smart Compaction
 * Replaces the default Pi compaction with an AI-powered structured summary
 */

import type { ExtensionContext, SessionBeforeCompactEvent } from "@earendil-works/pi-coding-agent";
import type { CompactionConfig, CompactionResult } from "./types.js";
import type { Logger } from "./types.js";

interface GRCCompactionOptions {
  curatorSummary?: string | null;
}

interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
  strategy?: "curator-summary";
}

// =============================================================================
// Compaction Handler
// =============================================================================

export interface CompactionHandler {
  /**
   * Handle the session_before_compact event
   * Returns the custom compaction or undefined to fall back to default
   */
  handleCompaction(
    event: SessionBeforeCompactEvent,
    ctx: ExtensionContext,
    options?: GRCCompactionOptions,
  ): Promise<{ compaction: CompactionResult } | undefined>;
}

export function createCompactionHandler(config: CompactionConfig, logger: Logger): CompactionHandler {
  return {
    async handleCompaction(
      event: SessionBeforeCompactEvent,
      ctx: ExtensionContext,
      options?: GRCCompactionOptions,
    ): Promise<{ compaction: CompactionResult } | undefined> {
      const { preparation } = event;
      const { tokensBefore, firstKeptEntryId, fileOps } = preparation;

      logger.info(`Compaction triggered: ${tokensBefore} tokens`);

      const details = buildCompactionDetails(fileOps);

      if (options?.curatorSummary?.trim()) {
        logger.info("Using curator summary for compaction");
        return {
          compaction: {
            summary: options.curatorSummary.trim(),
            firstKeptEntryId,
            tokensBefore,
            details: {
              ...details,
              strategy: "curator-summary",
            } satisfies CompactionDetails,
          },
        };
      }

      return undefined;
    },
  };
}

function buildCompactionDetails(fileOps: {
  read?: Set<string>;
  edited?: Set<string>;
  written?: Set<string>;
}): CompactionDetails {
  const modified = new Set<string>();
  for (const file of fileOps.edited ?? []) modified.add(file);
  for (const file of fileOps.written ?? []) modified.add(file);

  const readFiles = Array.from(fileOps.read ?? []).filter((file) => !modified.has(file)).sort();
  const modifiedFiles = Array.from(modified).sort();

  return {
    readFiles,
    modifiedFiles,
  };
}
