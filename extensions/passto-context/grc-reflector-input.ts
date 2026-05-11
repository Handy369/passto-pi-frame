import type { CuratorArtifactEntry, PrincipleItem, ReflectorGoalContext, ReflectorInput, SummaryEntry } from './types.ts';

export interface ReflectorInputAssemblyOptions {
  currentRoundConversation: string;
  currentGoalState: ReflectorInput['currentGoalState'];
  goalContext?: ReflectorGoalContext | null;
  summaryCache?: SummaryEntry[];
  branchEntries?: Array<{ type?: string; customType?: string; data?: unknown } | null | undefined>;
  principlesManager?: {
    search(query: string, limit: number): PrincipleItem[];
  } | null;
  principleQuery?: string;
  summaryCacheLimit?: number;
  curatorArtifactsLimit?: number;
  candidatePrinciplesLimit?: number;
}

const DEFAULT_SUMMARY_CACHE_LIMIT = 4;
const DEFAULT_CURATOR_ARTIFACTS_LIMIT = 3;
const DEFAULT_CANDIDATE_PRINCIPLES_LIMIT = 5;

export function buildReflectorInput(options: ReflectorInputAssemblyOptions): ReflectorInput {
  const summaryCacheExcerpt = buildSummaryCacheExcerpt(
    options.summaryCache ?? [],
    options.summaryCacheLimit ?? DEFAULT_SUMMARY_CACHE_LIMIT,
  );
  const recentCuratorArtifacts = extractRecentCuratorArtifacts(
    options.branchEntries ?? [],
    options.curatorArtifactsLimit ?? DEFAULT_CURATOR_ARTIFACTS_LIMIT,
  );
  const candidatePrinciples = buildCandidatePrinciples(
    options.principlesManager ?? null,
    options.principleQuery ?? '',
    options.candidatePrinciplesLimit ?? DEFAULT_CANDIDATE_PRINCIPLES_LIMIT,
  );

  return {
    currentRoundConversation: options.currentRoundConversation,
    currentGoalState: options.currentGoalState,
    goalContext: options.goalContext ?? null,
    summaryCacheExcerpt,
    recentCuratorArtifacts,
    candidatePrinciples,
  };
}

export function buildSummaryCacheExcerpt(summaryCache: SummaryEntry[], limit: number): SummaryEntry[] {
  if (limit <= 0) return [];
  return summaryCache.slice(-limit);
}

export function extractRecentCuratorArtifacts(
  entries: Array<{ type?: string; customType?: string; data?: unknown } | null | undefined>,
  limit: number,
): CuratorArtifactEntry[] {
  if (limit <= 0) return [];

  const parsed: CuratorArtifactEntry[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.type !== 'custom' || entry.customType !== 'grc-curator-artifact') continue;
    const artifact = parseCuratorArtifactEntry(entry.data);
    if (artifact) parsed.push(artifact);
  }

  return parsed.slice(-limit);
}

export function buildCandidatePrinciples(
  principlesManager: { search(query: string, limit: number): PrincipleItem[] } | null,
  query: string,
  limit: number,
): PrincipleItem[] {
  if (!principlesManager || !query.trim() || limit <= 0) return [];
  return principlesManager.search(query, limit);
}

function parseCuratorArtifactEntry(raw: unknown): CuratorArtifactEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Partial<CuratorArtifactEntry>;
  if (value.customType !== 'grc-curator-artifact') return null;
  if (typeof value.agentRound !== 'number') return null;
  if (typeof value.recordedAt !== 'string') return null;
  if (typeof value.processedUpToUserTurn !== 'number') return null;

  return {
    customType: 'grc-curator-artifact',
    agentRound: value.agentRound,
    recordedAt: value.recordedAt,
    processedUpToUserTurn: value.processedUpToUserTurn,
    summary: typeof value.summary === 'string' || value.summary === null ? (value.summary ?? null) : null,
    summaryEntry: value.summaryEntry && typeof value.summaryEntry === 'object' ? value.summaryEntry : null,
    goalState: value.goalState && typeof value.goalState === 'object' ? value.goalState : null,
    signal: value.signal && typeof value.signal === 'object' ? value.signal : null,
  };
}
