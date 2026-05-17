import { getCachedLineageSummaryWarehouseEntries, getCachedSessionSummaryWarehouseEntries } from "./branch-runtime-cache.ts";
import { buildSessionSummarySearchGuidance } from "./grc-prompts.ts";
import { searchSessionSummaryWarehouse } from "./summary-warehouse.ts";
import type { GRCConfig, SummaryEntry } from "./types.ts";

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
}

interface SessionManagerLike {
  getBranch(): BranchEntryLike[];
  getSessionFile?(): string | undefined;
}

export interface SummarySearchContextLike {
  sessionManager: SessionManagerLike;
}

export interface SummarySearchToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: {
    query: string;
    limit: number;
    totalWarehouseEntries: number;
    hits: SummaryEntry[];
    searchScope: "session" | "lineage";
  };
}

export function getSessionSummaryWarehouseEntries(ctx: SummarySearchContextLike): SummaryEntry[] {
  return getCachedSessionSummaryWarehouseEntries(ctx);
}

export async function getLineageSummaryWarehouseEntries(
  ctx: SummarySearchContextLike,
  config?: Pick<GRCConfig, "lineageSummaryMaxDepth">,
): Promise<SummaryEntry[]> {
  return getCachedLineageSummaryWarehouseEntries(ctx, config);
}

export async function executeSummarySearchTool(
  params: { query: string; limit?: number },
  ctx: SummarySearchContextLike,
  config?: Pick<GRCConfig, "lineageSummaryMaxDepth">,
): Promise<SummarySearchToolResult> {
  const limit = Number.isFinite(params.limit) ? Math.max(1, Math.min(20, Math.trunc(params.limit ?? 5))) : 5;
  const entries = await getLineageSummaryWarehouseEntries(ctx, config);
  const hits = searchSessionSummaryWarehouse(entries, params.query, limit);

  return {
    content: [{ type: "text", text: hits.length > 0 ? `Found ${hits.length} lineage summary hit(s).` : "No lineage summary hits found." }],
    details: {
      query: params.query,
      limit,
      totalWarehouseEntries: entries.length,
      hits,
      searchScope: "lineage",
    },
  };
}

export async function injectSessionSummarySearchGuidance(
  systemPrompt: string,
  grcPromptEnabled: boolean,
  ctx: SummarySearchContextLike,
  config?: Pick<GRCConfig, "lineageSummaryMaxDepth">,
): Promise<{ systemPrompt: string; diagnostic: string }> {
  if (!grcPromptEnabled) {
    return {
      systemPrompt,
      diagnostic: `summary-search-guidance:skip(enabled=${grcPromptEnabled})`,
    };
  }

  const warehouseCount = getSessionSummaryWarehouseEntries(ctx).length;
  const guidance = buildSessionSummarySearchGuidance(warehouseCount > 0);
  if (!guidance) {
    return {
      systemPrompt,
      diagnostic: `summary-search-guidance:0(warehouse=${warehouseCount})`,
    };
  }

  return {
    systemPrompt: `${systemPrompt}\n\n${guidance}`,
    diagnostic: `summary-search-guidance(${warehouseCount}/${guidance.length} chars)`,
  };
}
