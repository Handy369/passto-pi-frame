import { buildSessionSummarySearchGuidance } from "./grc-prompts.ts";
import { buildSessionSummaryWarehouse, searchSessionSummaryWarehouse } from "./summary-warehouse.ts";
import type { SummaryEntry } from "./types.ts";

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
}

interface SessionManagerLike {
  getBranch(): BranchEntryLike[];
}

interface SummarySearchContextLike {
  sessionManager: SessionManagerLike;
}

export interface SummarySearchToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: {
    query: string;
    limit: number;
    totalWarehouseEntries: number;
    hits: SummaryEntry[];
  };
}

export function getSessionSummaryWarehouseEntries(ctx: SummarySearchContextLike): SummaryEntry[] {
  return buildSessionSummaryWarehouse(ctx.sessionManager.getBranch());
}

export function executeSummarySearchTool(
  params: { query: string; limit?: number },
  ctx: SummarySearchContextLike,
): SummarySearchToolResult {
  const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(20, Math.trunc(params.limit ?? 5))) : 5;
  const entries = getSessionSummaryWarehouseEntries(ctx);
  const hits = searchSessionSummaryWarehouse(entries, params.query, limit);

  return {
    content: [{ type: "text", text: hits.length > 0 ? `Found ${hits.length} current-session summary hit(s).` : "No current-session summary hits found." }],
    details: {
      query: params.query,
      limit,
      totalWarehouseEntries: entries.length,
      hits,
    },
  };
}

export function injectSessionSummarySearchGuidance(
  systemPrompt: string,
  grcPromptEnabled: boolean,
  ctx: SummarySearchContextLike,
): { systemPrompt: string; diagnostic: string } {
  if (!grcPromptEnabled) {
    return {
      systemPrompt,
      diagnostic: `summary-search-guidance:skip(enabled=${grcPromptEnabled})`,
    };
  }

  const warehouseEntries = getSessionSummaryWarehouseEntries(ctx);
  const guidance = buildSessionSummarySearchGuidance(warehouseEntries.length > 0);
  if (!guidance) {
    return {
      systemPrompt,
      diagnostic: `summary-search-guidance:0(warehouse=${warehouseEntries.length})`,
    };
  }

  return {
    systemPrompt: `${systemPrompt}\n\n${guidance}`,
    diagnostic: `summary-search-guidance(${warehouseEntries.length}/${guidance.length} chars)`,
  };
}
