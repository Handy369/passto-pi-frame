import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { CuratorArtifactEntry, Logger } from '../../types.ts';
import { parseCuratorArtifactEntry } from '../../grc-restore.ts';
import { expandHome, safeFileName } from '../../utils.ts';

const DEFAULT_SKILL_EXPLORE_ROOT = '~/.passtocontext/skill-explore';

export interface SkillReadObservation {
  sessionFile: string | null;
  agentRound: number | null;
  source: 'top-agent' | 'subagent';
  toolName: 'read';
  skillPath: string;
  skillFileName: string;
  entryIndex: number;
  subagentName?: string;
  subagentTask?: string;
}

export interface SkillExploreRoundBoundary {
  agentRound: number;
  totalCompletedAgentRounds: number;
  userTurnsAtStart: number;
  createdAt?: string;
}

export interface SkillExploreRoundFact {
  sessionFile: string | null;
  agentRound: number;
  boundary: SkillExploreRoundBoundary | null;
  skillReads: SkillReadObservation[];
  hasSkillReads: boolean;
}

export interface SkillExploreSessionSummary {
  sessionFile: string | null;
  sessionKey: string;
  updatedAt: string;
  totalSkillReads: number;
  roundsWithSkillReads: number[];
  countsByRound: Array<{
    agentRound: number;
    skillReadCount: number;
  }>;
}

export interface SkillExploreRuntimeSnapshot {
  skillReadCount: number;
}

export interface SkillExplorePersistResult {
  rootDir: string;
  sessionDir: string;
  roundFactsFile: string;
  summaryFile: string;
  latestFile: string;
  summary: SkillExploreSessionSummary;
  roundFacts: SkillExploreRoundFact[];
  usageFacts?: SkillUsageFact[];
  aggregateResult?: SkillAggregatePersistResult;
  bundleFiles?: string[];
}

export interface SkillAggregatePersistItem {
  aggregate: SkillAggregateSummary;
  aggregateDir: string;
  summaryFile: string;
  taskShapesFile: string;
  evidenceIndexFile: string;
}

export interface SkillAggregatePersistResult {
  rootDir: string;
  aggregateRootDir: string;
  items: SkillAggregatePersistItem[];
}

export interface SkillReviewBundle {
  bundleId: string;
  createdAt: string;
  targetSkill: {
    skillKey: string;
    skillName: string;
    skillPath: string;
    versionKey?: string;
    descriptionHash?: string;
  };
  scope: {
    from: string;
    to: string;
    usageFactCount: number;
    sessionCount: number;
  };
  summary: {
    totalReads: number;
    topAgentReads: number;
    subagentReads: number;
    dominantTaskShapes: string[];
    notableSignals: {
      advance: number;
      correct: number;
      supplement: number;
      continue: number;
      clarify: number;
    };
  };
  reviewFocus: {
    representativeHits: string[];
    correctionSoonCases: string[];
    subagentCases: string[];
    ambiguousCases: string[];
    nearbyNoReadPeerShapes?: string[];
  };
  openQuestions: string[];
  artifactRefs: {
    aggregateSummaryFile: string;
    taskShapesFile?: string;
    evidenceIndexFile?: string;
  };
}

export interface BundleReceipt {
  bundleId: string;
  consumer: 'skills-maker';
  consumerRunId: string;
  consumedAt: string;
  result: {
    status: 'reviewed' | 'adopted' | 'dismissed' | 'superseded';
    notes?: string;
    outputDocPath?: string;
  };
}

export interface SkillReviewBundlePersistResult {
  rootDir: string;
  handoffDir: string;
  bundleFile: string;
  bundle: SkillReviewBundle;
}

export interface BundleReceiptPersistResult {
  rootDir: string;
  handoffDir: string;
  receiptFile: string;
  receipt: BundleReceipt;
  readyIndexFile: string;
  reviewedIndexFile: string;
}

export interface SkillReviewReadyIndexEntry {
  bundleId: string;
  bundleFile: string;
  createdAt: string;
  targetSkill: SkillReviewBundle['targetSkill'];
}

export interface SkillReviewReviewedIndexEntry {
  bundleId: string;
  bundleFile: string;
  latestReceipt: BundleReceipt;
}

export interface SkillUsageFact {
  factId: string;
  observedAt: string;
  session: {
    sessionFile: string | null;
    sessionKey: string;
    agentRound: number;
  };
  skill: {
    skillPath: string;
    skillName: string;
    skillFileName: string;
    skillKey?: string;
    versionKey?: string;
    descriptionHash?: string;
  };
  read: {
    source: 'top-agent' | 'subagent';
    toolName: 'read';
    entryIndex: number;
    subagentName?: string;
    subagentTask?: string;
  };
  context: {
    summaryEntryId?: string;
    signalType?: 'advance' | 'correct' | 'supplement' | 'continue' | 'clarify';
    taskShapeKey?: string;
    taskShapeLabel?: string;
    userIntentLabel?: string;
  };
  outcomeProxy?: {
    nextSignalType?: 'advance' | 'correct' | 'supplement' | 'continue' | 'clarify';
    hadCorrectionSoon?: boolean;
    advancedSoon?: boolean;
  };
  artifactRefs: {
    roundFactsFile: string;
    sessionSummaryFile: string;
  };
}

export interface SkillAggregateSummary {
  aggregateId: string;
  generatedAt: string;
  skill: {
    skillKey: string;
    skillName: string;
    skillPath: string;
    versionKey?: string;
    descriptionHash?: string;
  };
  window: {
    from: string;
    to: string;
    sessionCount: number;
    usageFactCount: number;
    roundCount: number;
  };
  counts: {
    totalReads: number;
    topAgentReads: number;
    subagentReads: number;
    uniqueTaskShapes: number;
  };
  signalsAfterRead: {
    advance: number;
    correct: number;
    supplement: number;
    continue: number;
    clarify: number;
    unknown: number;
  };
  taskShapeBreakdown: Array<{
    taskShapeKey: string;
    label: string;
    count: number;
    sourceBreakdown: {
      topAgent: number;
      subagent: number;
    };
    nextSignalBreakdown: {
      advance: number;
      correct: number;
      supplement: number;
      continue: number;
      clarify: number;
      unknown: number;
    };
    sampleFactIds: string[];
  }>;
  evidencePools: {
    representativeFactIds: string[];
    correctionSoonFactIds: string[];
    subagentFactIds: string[];
    ambiguousFactIds: string[];
  };
  artifactRefs: {
    usageFactFiles: string[];
  };
}

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
  message?: unknown;
}

interface ToolCallLike {
  type?: string;
  name?: string;
  arguments?: unknown;
}

interface AssistantMessageLike {
  role?: string;
  content?: unknown;
}

interface SubagentResultLike {
  agent?: unknown;
  task?: unknown;
  messages?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function isRoundBoundaryEntry(value: unknown): value is {
  type: 'custom';
  customType: 'passto-round-boundary';
  data: {
    agentRound: number;
    totalCompletedAgentRounds?: number;
    userTurnsAtStart?: number;
    createdAt?: string;
  };
} {
  if (!isRecord(value)) return false;
  if (value.type !== 'custom' || value.customType !== 'passto-round-boundary') return false;
  const data = value.data;
  return isRecord(data) && typeof data.agentRound === 'number';
}

function normalizeRound(value: number | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

function parseToolCallArguments(argumentsValue: unknown): Record<string, unknown> | null {
  if (isRecord(argumentsValue)) {
    return argumentsValue;
  }

  if (typeof argumentsValue !== 'string' || !argumentsValue.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(argumentsValue) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getToolCallPath(item: unknown): string | null {
  if (!isRecord(item)) return null;
  const toolCall = item as ToolCallLike;
  if (toolCall.type !== 'toolCall' || toolCall.name !== 'read') {
    return null;
  }

  const args = parseToolCallArguments(toolCall.arguments);
  if (!args) return null;
  return typeof args.path === 'string' ? args.path : null;
}

function isSkillPath(pathValue: string | null): pathValue is string {
  return typeof pathValue === 'string' && /(^|\/)SKILL\.md$/i.test(pathValue.trim());
}

function getSkillFileName(skillPath: string): string {
  const parts = skillPath.split('/').filter(Boolean);
  return parts.at(-1) ?? 'SKILL.md';
}

function getSkillName(skillPath: string): string {
  const parts = skillPath.split('/').filter(Boolean);
  if (parts.length >= 2 && /^SKILL\.md$/i.test(parts.at(-1) ?? '')) {
    return parts.at(-2) ?? 'unknown-skill';
  }
  return parts.at(-1)?.replace(/\.md$/i, '') ?? 'unknown-skill';
}

function buildRoundLookup(branch: BranchEntryLike[]): Map<number, number> {
  const lookup = new Map<number, number>();
  let currentRound: number | null = null;

  for (let index = 0; index < branch.length; index += 1) {
    const entry = branch[index];
    if (isRoundBoundaryEntry(entry)) {
      currentRound = entry.data.agentRound;
    }
    lookup.set(index, currentRound ?? -1);
  }

  return lookup;
}

function extractTopAgentReads(
  branch: BranchEntryLike[],
  sessionFile: string | null,
  entryIndex: number,
  round: number | null,
  content: unknown[],
): SkillReadObservation[] {
  const observations: SkillReadObservation[] = [];

  for (const item of content) {
    const skillPath = getToolCallPath(item);
    if (!isSkillPath(skillPath)) continue;

    observations.push({
      sessionFile,
      agentRound: round,
      source: 'top-agent',
      toolName: 'read',
      skillPath,
      skillFileName: getSkillFileName(skillPath),
      entryIndex,
    });
  }

  return observations;
}

function extractSubagentReads(
  sessionFile: string | null,
  entryIndex: number,
  round: number | null,
  result: SubagentResultLike,
): SkillReadObservation[] {
  if (!Array.isArray(result.messages)) return [];

  const observations: SkillReadObservation[] = [];
  for (const message of result.messages) {
    if (!isRecord(message)) continue;
    const assistantMessage = message as AssistantMessageLike;
    if (assistantMessage.role !== 'assistant' || !Array.isArray(assistantMessage.content)) {
      continue;
    }

    for (const item of assistantMessage.content) {
      const skillPath = getToolCallPath(item);
      if (!isSkillPath(skillPath)) continue;

      observations.push({
        sessionFile,
        agentRound: round,
        source: 'subagent',
        toolName: 'read',
        skillPath,
        skillFileName: getSkillFileName(skillPath),
        entryIndex,
        subagentName: typeof result.agent === 'string' ? result.agent : undefined,
        subagentTask: typeof result.task === 'string' ? result.task : undefined,
      });
    }
  }

  return observations;
}

export function extractCuratorArtifactsFromBranch(
  branch: BranchEntryLike[],
): CuratorArtifactEntry[] {
  const artifacts: CuratorArtifactEntry[] = [];

  for (const entry of branch) {
    if (entry.type !== 'custom' || entry.customType !== 'grc-curator-artifact') {
      continue;
    }

    const parsed = parseCuratorArtifactEntry(entry.data);
    if (parsed) {
      artifacts.push(parsed);
    }
  }

  return artifacts;
}

export function extractSkillReadsFromBranch(
  branch: BranchEntryLike[],
  sessionFile: string | null,
): SkillReadObservation[] {
  const roundLookup = buildRoundLookup(branch);
  const observations: SkillReadObservation[] = [];

  for (let entryIndex = 0; entryIndex < branch.length; entryIndex += 1) {
    const entry = branch[entryIndex];
    const round = normalizeRound(roundLookup.get(entryIndex));
    const message = entry?.message;
    if (!isRecord(message)) continue;

    if (message.role === 'assistant' && Array.isArray(message.content)) {
      observations.push(...extractTopAgentReads(branch, sessionFile, entryIndex, round, message.content));
    }

    if (message.role !== 'toolResult' || message.toolName !== 'subagent') {
      continue;
    }

    const details = message.details;
    if (!isRecord(details) || !Array.isArray(details.results)) {
      continue;
    }

    for (const result of details.results) {
      if (!isRecord(result)) continue;
      observations.push(...extractSubagentReads(sessionFile, entryIndex, round, result as SubagentResultLike));
    }
  }

  return observations;
}

function extractRoundBoundaries(branch: BranchEntryLike[]): Map<number, SkillExploreRoundBoundary> {
  const boundaries = new Map<number, SkillExploreRoundBoundary>();

  for (const entry of branch) {
    if (!isRoundBoundaryEntry(entry)) continue;
    const { agentRound, totalCompletedAgentRounds = agentRound - 1, userTurnsAtStart = 0, createdAt } = entry.data;
    boundaries.set(agentRound, {
      agentRound,
      totalCompletedAgentRounds,
      userTurnsAtStart,
      createdAt: typeof createdAt === 'string' ? createdAt : undefined,
    });
  }

  return boundaries;
}

function buildCuratorArtifactLookup(
  artifacts: CuratorArtifactEntry[],
): Map<number, CuratorArtifactEntry> {
  const lookup = new Map<number, CuratorArtifactEntry>();
  for (const artifact of artifacts) {
    lookup.set(artifact.agentRound, artifact);
  }
  return lookup;
}

function getSessionArtifactRefs(
  sessionFile: string | null,
  rootDir?: string,
): SkillUsageFact['artifactRefs'] {
  const sessionKey = getSessionKey(sessionFile);
  const sessionDir = path.join(getArtifactRoot(rootDir), 'sessions', sessionKey);
  return {
    roundFactsFile: path.join(sessionDir, 'round-skill-usage-facts.json'),
    sessionSummaryFile: path.join(sessionDir, 'skill-explore-summary.json'),
  };
}

function buildSummaryEntryId(sessionKey: string, agentRound: number): string {
  return `${sessionKey}:summary:${agentRound}`;
}

function buildSkillUsageFactId(sessionKey: string, read: SkillReadObservation, agentRound: number): string {
  const suffix = hashString([
    read.skillPath,
    read.source,
    String(read.entryIndex),
    read.subagentName ?? '',
    read.subagentTask ?? '',
  ].join('|'));
  return `${sessionKey}:round:${agentRound}:entry:${read.entryIndex}:${suffix}`;
}

function normalizeLabelText(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

function buildTaskKeyFragment(value: string | null | undefined): string | undefined {
  const normalized = normalizeLabelText(value);
  if (!normalized) return undefined;

  const lowered = normalized.toLowerCase();
  const fragment = safeFileName(lowered)
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return fragment || undefined;
}

function deriveUserIntentLabel(read: SkillReadObservation, curatorArtifact?: CuratorArtifactEntry): string | undefined {
  return normalizeLabelText(curatorArtifact?.summaryEntry?.summary.goal)
    ?? normalizeLabelText(read.subagentTask);
}

function deriveTaskShapeContext(
  read: SkillReadObservation,
  curatorArtifact?: CuratorArtifactEntry,
): Pick<SkillUsageFact['context'], 'taskShapeKey' | 'taskShapeLabel' | 'userIntentLabel'> {
  const userIntentLabel = deriveUserIntentLabel(read, curatorArtifact);
  const goalFragment = buildTaskKeyFragment(curatorArtifact?.summaryEntry?.summary.goal);
  const taskFragment = buildTaskKeyFragment(read.subagentTask);
  const agentFragment = buildTaskKeyFragment(read.subagentName);

  if (read.source === 'subagent') {
    const keyParts = [
      'subagent',
      agentFragment ?? 'unknown-agent',
      taskFragment ?? goalFragment ?? 'skill-read',
    ];

    return {
      taskShapeKey: keyParts.join(':'),
      taskShapeLabel: normalizeLabelText(read.subagentTask)
        ?? `subagent:${normalizeLabelText(read.subagentName) ?? 'unknown-agent'} skill read`,
      userIntentLabel,
    };
  }

  return {
    taskShapeKey: `top-agent:${goalFragment ?? 'skill-read'}`,
    taskShapeLabel: normalizeLabelText(curatorArtifact?.summaryEntry?.summary.goal) ?? 'top-agent skill read',
    userIntentLabel,
  };
}

function compareSkillUsageFacts(left: SkillUsageFact, right: SkillUsageFact): number {
  return left.session.agentRound - right.session.agentRound
    || left.observedAt.localeCompare(right.observedAt)
    || left.read.entryIndex - right.read.entryIndex
    || left.factId.localeCompare(right.factId);
}

function buildOutcomeProxyForFact(
  fact: SkillUsageFact,
  nextFact: SkillUsageFact | undefined,
): SkillUsageFact['outcomeProxy'] | undefined {
  if (!nextFact) return undefined;

  const nextSignalType = nextFact.context.signalType;
  return {
    nextSignalType,
    hadCorrectionSoon: nextSignalType === 'correct',
    advancedSoon: nextSignalType === 'advance',
  };
}

export function attachOutcomeProxyToSkillUsageFacts(
  facts: SkillUsageFact[],
): SkillUsageFact[] {
  const groups = new Map<string, SkillUsageFact[]>();

  for (const fact of facts) {
    const key = `${fact.session.sessionKey}|${getSkillAggregationGroupKey(fact)}`;
    const list = groups.get(key) ?? [];
    list.push(fact);
    groups.set(key, list);
  }

  const outcomeProxyByFactId = new Map<string, SkillUsageFact['outcomeProxy']>();

  for (const groupFacts of groups.values()) {
    const sortedFacts = [...groupFacts].sort(compareSkillUsageFacts);

    for (let index = 0; index < sortedFacts.length; index += 1) {
      const currentFact = sortedFacts[index];
      const nextFact = sortedFacts.slice(index + 1).find((candidate) => candidate.session.agentRound > currentFact.session.agentRound);
      outcomeProxyByFactId.set(currentFact.factId, buildOutcomeProxyForFact(currentFact, nextFact));
    }
  }

  return facts.map((fact) => ({
    ...fact,
    outcomeProxy: outcomeProxyByFactId.get(fact.factId),
  }));
}

export function buildSkillUsageFactsFromBranch(
  branch: BranchEntryLike[],
  sessionFile: string | null,
  options?: {
    rootDir?: string;
  },
): SkillUsageFact[] {
  const sessionKey = getSessionKey(sessionFile);
  const reads = extractSkillReadsFromBranch(branch, sessionFile);
  const boundaries = extractRoundBoundaries(branch);
  const curatorArtifacts = buildCuratorArtifactLookup(extractCuratorArtifactsFromBranch(branch));
  const artifactRefs = getSessionArtifactRefs(sessionFile, options?.rootDir);

  const usageFacts = reads
    .filter((read): read is SkillReadObservation & { agentRound: number } => normalizeRound(read.agentRound ?? undefined) !== null)
    .map((read) => {
      const agentRound = read.agentRound;
      const curatorArtifact = curatorArtifacts.get(agentRound);
      const boundary = boundaries.get(agentRound);
      const observedAt = curatorArtifact?.recordedAt
        ?? curatorArtifact?.summaryEntry?.timestamp
        ?? boundary?.createdAt
        ?? new Date(0).toISOString();

      const taskShapeContext = deriveTaskShapeContext(read, curatorArtifact);

      return {
        factId: buildSkillUsageFactId(sessionKey, read, agentRound),
        observedAt,
        session: {
          sessionFile,
          sessionKey,
          agentRound,
        },
        skill: {
          skillPath: read.skillPath,
          skillName: getSkillName(read.skillPath),
          skillFileName: read.skillFileName,
          skillKey: safeFileName(getSkillName(read.skillPath)),
        },
        read: {
          source: read.source,
          toolName: read.toolName,
          entryIndex: read.entryIndex,
          subagentName: read.subagentName,
          subagentTask: read.subagentTask,
        },
        context: {
          summaryEntryId: curatorArtifact?.summaryEntry ? buildSummaryEntryId(sessionKey, agentRound) : undefined,
          signalType: curatorArtifact?.signal?.type,
          taskShapeKey: taskShapeContext.taskShapeKey,
          taskShapeLabel: taskShapeContext.taskShapeLabel,
          userIntentLabel: taskShapeContext.userIntentLabel,
        },
        artifactRefs,
      } satisfies SkillUsageFact;
    });

  return attachOutcomeProxyToSkillUsageFacts(usageFacts);
}

function getSignalBucket(
  signalType: SkillUsageFact['context']['signalType'],
): keyof SkillAggregateSummary['signalsAfterRead'] {
  return signalType ?? 'unknown';
}

function createEmptySignalBreakdown(): SkillAggregateSummary['signalsAfterRead'] {
  return {
    advance: 0,
    correct: 0,
    supplement: 0,
    continue: 0,
    clarify: 0,
    unknown: 0,
  };
}

function getSkillAggregationGroupKey(fact: SkillUsageFact): string {
  return [
    fact.skill.skillKey ?? safeFileName(fact.skill.skillName || getSkillName(fact.skill.skillPath)),
    fact.skill.versionKey ?? 'no-version',
    fact.skill.descriptionHash ?? 'no-description-hash',
    fact.skill.skillPath,
  ].join('|');
}

function getAggregateSkillIdentity(fact: SkillUsageFact): SkillAggregateSummary['skill'] {
  return {
    skillKey: fact.skill.skillKey ?? safeFileName(fact.skill.skillName || getSkillName(fact.skill.skillPath)),
    skillName: fact.skill.skillName || getSkillName(fact.skill.skillPath),
    skillPath: fact.skill.skillPath,
    versionKey: fact.skill.versionKey,
    descriptionHash: fact.skill.descriptionHash,
  };
}

function buildAggregateId(skill: SkillAggregateSummary['skill'], facts: SkillUsageFact[]): string {
  const sortedFacts = [...facts].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.factId.localeCompare(b.factId));
  const from = sortedFacts[0]?.observedAt ?? 'unknown';
  const to = sortedFacts.at(-1)?.observedAt ?? 'unknown';
  const suffix = hashString([skill.skillKey, skill.versionKey ?? 'no-version', from, to, String(facts.length)].join('|'));
  return `agg:${skill.skillKey}:${skill.versionKey ?? 'path'}:${suffix}`;
}

export function groupSkillUsageFactsBySkillVersion(
  facts: SkillUsageFact[],
): Map<string, SkillUsageFact[]> {
  const groups = new Map<string, SkillUsageFact[]>();

  for (const fact of facts) {
    const key = getSkillAggregationGroupKey(fact);
    const list = groups.get(key) ?? [];
    list.push(fact);
    groups.set(key, list);
  }

  return groups;
}

export function buildSkillAggregateSummaries(
  facts: SkillUsageFact[],
  options?: {
    generatedAt?: string;
  },
): SkillAggregateSummary[] {
  const enrichedFacts = attachOutcomeProxyToSkillUsageFacts(facts);
  const groups = groupSkillUsageFactsBySkillVersion(enrichedFacts);
  const generatedAt = options?.generatedAt ?? new Date().toISOString();

  return [...groups.entries()]
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([, groupFacts]) => {
      const sortedFacts = [...groupFacts].sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.factId.localeCompare(b.factId));
      const firstFact = sortedFacts[0];
      const skill = getAggregateSkillIdentity(firstFact);
      const signalsAfterRead = createEmptySignalBreakdown();
      const taskShapeMap = new Map<string, SkillAggregateSummary['taskShapeBreakdown'][number]>();
      const sessionKeys = new Set<string>();
      const roundKeys = new Set<string>();
      const usageFactFiles = new Set<string>();
      const subagentFactIds: string[] = [];
      const ambiguousFactIds: string[] = [];

      for (const fact of sortedFacts) {
        sessionKeys.add(fact.session.sessionKey);
        roundKeys.add(`${fact.session.sessionKey}:${fact.session.agentRound}`);
        usageFactFiles.add(fact.artifactRefs.roundFactsFile);

        const signalBucket = getSignalBucket(fact.context.signalType);
        signalsAfterRead[signalBucket] += 1;

        const nextSignalBucket = getSignalBucket(fact.outcomeProxy?.nextSignalType);
        const taskShapeKey = fact.context.taskShapeKey ?? 'unknown-task-shape';
        const label = fact.context.taskShapeLabel ?? fact.context.userIntentLabel ?? 'unknown task shape';
        const taskShapeEntry = taskShapeMap.get(taskShapeKey) ?? {
          taskShapeKey,
          label,
          count: 0,
          sourceBreakdown: {
            topAgent: 0,
            subagent: 0,
          },
          nextSignalBreakdown: createEmptySignalBreakdown(),
          sampleFactIds: [],
        };

        taskShapeEntry.count += 1;
        if (fact.read.source === 'top-agent') taskShapeEntry.sourceBreakdown.topAgent += 1;
        else taskShapeEntry.sourceBreakdown.subagent += 1;
        taskShapeEntry.nextSignalBreakdown[nextSignalBucket] += 1;
        if (taskShapeEntry.sampleFactIds.length < 3) {
          taskShapeEntry.sampleFactIds.push(fact.factId);
        }
        taskShapeMap.set(taskShapeKey, taskShapeEntry);

        if (fact.read.source === 'subagent') {
          subagentFactIds.push(fact.factId);
        }
        if (!fact.context.signalType || !fact.context.taskShapeKey || !fact.context.userIntentLabel) {
          ambiguousFactIds.push(fact.factId);
        }
      }

      const taskShapeBreakdown = [...taskShapeMap.values()]
        .sort((a, b) => b.count - a.count || a.taskShapeKey.localeCompare(b.taskShapeKey));
      const representativeFactIds = Array.from(new Set(taskShapeBreakdown.flatMap((item) => item.sampleFactIds))).slice(0, 5);
      const correctionSoonFactIds = sortedFacts
        .filter((fact) => fact.outcomeProxy?.hadCorrectionSoon)
        .map((fact) => fact.factId);
      const topAgentReads = sortedFacts.filter((fact) => fact.read.source === 'top-agent').length;
      const subagentReads = sortedFacts.length - topAgentReads;

      return {
        aggregateId: buildAggregateId(skill, sortedFacts),
        generatedAt,
        skill,
        window: {
          from: sortedFacts[0]?.observedAt ?? generatedAt,
          to: sortedFacts.at(-1)?.observedAt ?? generatedAt,
          sessionCount: sessionKeys.size,
          usageFactCount: sortedFacts.length,
          roundCount: roundKeys.size,
        },
        counts: {
          totalReads: sortedFacts.length,
          topAgentReads,
          subagentReads,
          uniqueTaskShapes: taskShapeBreakdown.length,
        },
        signalsAfterRead,
        taskShapeBreakdown,
        evidencePools: {
          representativeFactIds,
          correctionSoonFactIds,
          subagentFactIds,
          ambiguousFactIds,
        },
        artifactRefs: {
          usageFactFiles: [...usageFactFiles].sort(),
        },
      } satisfies SkillAggregateSummary;
    });
}

export function buildSkillExploreRoundFactsFromBranch(
  branch: BranchEntryLike[],
  sessionFile: string | null,
): SkillExploreRoundFact[] {
  const reads = extractSkillReadsFromBranch(branch, sessionFile);
  const boundaries = extractRoundBoundaries(branch);
  const readsByRound = new Map<number, SkillReadObservation[]>();
  const allRounds = new Set<number>(boundaries.keys());

  for (const read of reads) {
    if (read.agentRound === null) continue;
    const list = readsByRound.get(read.agentRound) ?? [];
    list.push(read);
    readsByRound.set(read.agentRound, list);
    allRounds.add(read.agentRound);
  }

  return [...allRounds]
    .sort((a, b) => a - b)
    .map((agentRound) => {
      const skillReads = readsByRound.get(agentRound) ?? [];
      return {
        sessionFile,
        agentRound,
        boundary: boundaries.get(agentRound) ?? null,
        skillReads,
        hasSkillReads: skillReads.length > 0,
      } satisfies SkillExploreRoundFact;
    });
}

export function summarizeSkillExploreRoundFacts(
  roundFacts: SkillExploreRoundFact[],
  sessionFile: string | null,
): SkillExploreSessionSummary {
  const countsByRound = roundFacts.map((fact) => ({
    agentRound: fact.agentRound,
    skillReadCount: fact.skillReads.length,
  }));
  const totalSkillReads = countsByRound.reduce((sum, item) => sum + item.skillReadCount, 0);

  return {
    sessionFile,
    sessionKey: getSessionKey(sessionFile),
    updatedAt: new Date().toISOString(),
    totalSkillReads,
    roundsWithSkillReads: roundFacts.filter((fact) => fact.skillReads.length > 0).map((fact) => fact.agentRound),
    countsByRound,
  };
}

export function getSkillExploreRuntimeSnapshotFromBranch(
  branch: BranchEntryLike[],
  sessionFile: string | null,
): SkillExploreRuntimeSnapshot {
  const roundFacts = buildSkillExploreRoundFactsFromBranch(branch, sessionFile);
  const summary = summarizeSkillExploreRoundFacts(roundFacts, sessionFile);
  return {
    skillReadCount: summary.totalSkillReads,
  };
}

function hashString(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function getSessionKey(sessionFile: string | null): string {
  if (!sessionFile) return 'ephemeral';
  const parts = sessionFile.split('/').filter(Boolean);
  const fileName = parts.at(-1)?.replace(/\.jsonl$/i, '') || 'session';
  const parentName = parts.at(-2) || 'session';
  return `${safeFileName(parentName)}-${safeFileName(fileName)}-${hashString(sessionFile)}`;
}

function getArtifactRoot(rootDir?: string): string {
  return expandHome(rootDir ?? DEFAULT_SKILL_EXPLORE_ROOT);
}

export function resolveSkillExploreArtifactRoot(rootDir?: string): string {
  return getArtifactRoot(rootDir);
}

function getAggregateVersionDirName(skill: SkillAggregateSummary['skill']): string {
  return safeFileName(skill.versionKey ?? skill.descriptionHash ?? 'unversioned');
}

function getAggregateDir(rootDir: string, skill: SkillAggregateSummary['skill']): string {
  return path.join(rootDir, 'aggregates', 'by-skill', safeFileName(skill.skillKey), getAggregateVersionDirName(skill));
}

function getSkillReviewHandoffDir(rootDir: string): string {
  return path.join(rootDir, 'handoff', 'skills-maker');
}

function getSkillReviewIndexesDir(rootDir: string): string {
  return path.join(getSkillReviewHandoffDir(rootDir), 'indexes');
}

function getBundleFile(rootDir: string, bundleId: string): string {
  return path.join(getSkillReviewHandoffDir(rootDir), 'bundles', `${safeFileName(bundleId)}.json`);
}

function getReceiptDir(rootDir: string, bundleId: string): string {
  return path.join(getSkillReviewHandoffDir(rootDir), 'receipts', safeFileName(bundleId));
}

function buildBundleId(summary: SkillAggregateSummary): string {
  const suffix = hashString([
    summary.aggregateId,
    summary.window.from,
    summary.window.to,
    String(summary.window.usageFactCount),
  ].join('|'));
  return `bundle:${summary.skill.skillKey}:${getAggregateVersionDirName(summary.skill)}:${suffix}`;
}

export function formatSkillProofMetric(createdCount: number, skillReadCount: number): string {
  return `记:${Math.max(0, createdCount)}+${Math.max(0, skillReadCount)}`;
}

export function buildSkillReviewBundle(
  aggregate: SkillAggregateSummary,
  options: {
    aggregateSummaryFile: string;
    taskShapesFile?: string;
    evidenceIndexFile?: string;
    createdAt?: string;
    openQuestions?: string[];
  },
): SkillReviewBundle {
  const dominantTaskShapes = aggregate.taskShapeBreakdown.slice(0, 3).map((item) => item.label);
  const openQuestions = options.openQuestions && options.openQuestions.length > 0
    ? options.openQuestions
    : [
      `这个 Skill 的主导 task shape（${dominantTaskShapes.join(' / ') || 'unknown'}）是否仍应保留在同一 Skill 边界内？`,
      'correctionSoon 样本是否说明当前 Skill 存在误吸、漏吸或说明不清？',
      'subagent 与 top-agent 的读取分布，是否暗示需要单独的 routing / reference / examples 调整？',
    ];

  return {
    bundleId: buildBundleId(aggregate),
    createdAt: options.createdAt ?? new Date().toISOString(),
    targetSkill: aggregate.skill,
    scope: {
      from: aggregate.window.from,
      to: aggregate.window.to,
      usageFactCount: aggregate.window.usageFactCount,
      sessionCount: aggregate.window.sessionCount,
    },
    summary: {
      totalReads: aggregate.counts.totalReads,
      topAgentReads: aggregate.counts.topAgentReads,
      subagentReads: aggregate.counts.subagentReads,
      dominantTaskShapes,
      notableSignals: {
        advance: aggregate.signalsAfterRead.advance,
        correct: aggregate.signalsAfterRead.correct,
        supplement: aggregate.signalsAfterRead.supplement,
        continue: aggregate.signalsAfterRead.continue,
        clarify: aggregate.signalsAfterRead.clarify,
      },
    },
    reviewFocus: {
      representativeHits: aggregate.evidencePools.representativeFactIds,
      correctionSoonCases: aggregate.evidencePools.correctionSoonFactIds,
      subagentCases: aggregate.evidencePools.subagentFactIds,
      ambiguousCases: aggregate.evidencePools.ambiguousFactIds,
    },
    openQuestions,
    artifactRefs: {
      aggregateSummaryFile: options.aggregateSummaryFile,
      taskShapesFile: options.taskShapesFile,
      evidenceIndexFile: options.evidenceIndexFile,
    },
  } satisfies SkillReviewBundle;
}

export async function persistSkillAggregateArtifacts(input: {
  usageFacts: SkillUsageFact[];
  rootDir?: string;
  generatedAt?: string;
}): Promise<SkillAggregatePersistResult> {
  const rootDir = getArtifactRoot(input.rootDir);
  const aggregateRootDir = path.join(rootDir, 'aggregates', 'by-skill');
  const aggregates = buildSkillAggregateSummaries(input.usageFacts, { generatedAt: input.generatedAt });
  const items: SkillAggregatePersistItem[] = [];

  await fs.mkdir(aggregateRootDir, { recursive: true });

  for (const aggregate of aggregates) {
    const aggregateDir = getAggregateDir(rootDir, aggregate.skill);
    const summaryFile = path.join(aggregateDir, 'summary.json');
    const taskShapesFile = path.join(aggregateDir, 'task-shapes.json');
    const evidenceIndexFile = path.join(aggregateDir, 'evidence-index.json');

    await fs.mkdir(aggregateDir, { recursive: true });
    await fs.writeFile(summaryFile, `${JSON.stringify(aggregate, null, 2)}\n`, 'utf-8');
    await fs.writeFile(taskShapesFile, `${JSON.stringify(aggregate.taskShapeBreakdown, null, 2)}\n`, 'utf-8');
    await fs.writeFile(
      evidenceIndexFile,
      `${JSON.stringify({
        aggregateId: aggregate.aggregateId,
        generatedAt: aggregate.generatedAt,
        skill: aggregate.skill,
        window: aggregate.window,
        evidencePools: aggregate.evidencePools,
        usageFactFiles: aggregate.artifactRefs.usageFactFiles,
      }, null, 2)}\n`,
      'utf-8',
    );

    items.push({
      aggregate,
      aggregateDir,
      summaryFile,
      taskShapesFile,
      evidenceIndexFile,
    });
  }

  return {
    rootDir,
    aggregateRootDir,
    items,
  };
}

async function listBundleFiles(rootDir: string): Promise<string[]> {
  const bundleDir = path.join(getSkillReviewHandoffDir(rootDir), 'bundles');
  try {
    const entries = await fs.readdir(bundleDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
      .map((entry) => path.join(bundleDir, entry.name))
      .sort();
  } catch {
    return [];
  }
}

export async function listBundleReceipts(
  bundleId: string,
  rootDir?: string,
): Promise<BundleReceipt[]> {
  const resolvedRootDir = getArtifactRoot(rootDir);
  const receiptDir = getReceiptDir(resolvedRootDir, bundleId);

  try {
    const entries = await fs.readdir(receiptDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && /\.json$/i.test(entry.name))
      .map((entry) => path.join(receiptDir, entry.name))
      .sort();

    const receipts = await Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(file, 'utf-8')) as BundleReceipt));
    return receipts.sort((a, b) => a.consumedAt.localeCompare(b.consumedAt) || a.consumerRunId.localeCompare(b.consumerRunId));
  } catch {
    return [];
  }
}

export async function rebuildSkillReviewIndexes(rootDir?: string): Promise<{
  rootDir: string;
  handoffDir: string;
  readyIndexFile: string;
  reviewedIndexFile: string;
}> {
  const resolvedRootDir = getArtifactRoot(rootDir);
  const handoffDir = getSkillReviewHandoffDir(resolvedRootDir);
  const indexesDir = getSkillReviewIndexesDir(resolvedRootDir);
  const readyIndexFile = path.join(indexesDir, 'ready.json');
  const reviewedIndexFile = path.join(indexesDir, 'reviewed.json');
  const bundleFiles = await listBundleFiles(resolvedRootDir);
  const ready: SkillReviewReadyIndexEntry[] = [];
  const reviewed: SkillReviewReviewedIndexEntry[] = [];

  await fs.mkdir(indexesDir, { recursive: true });

  for (const bundleFile of bundleFiles) {
    const bundle = JSON.parse(await fs.readFile(bundleFile, 'utf-8')) as SkillReviewBundle;
    const receipts = await listBundleReceipts(bundle.bundleId, resolvedRootDir);
    const latestReceipt = receipts.at(-1);

    if (!latestReceipt) {
      ready.push({
        bundleId: bundle.bundleId,
        bundleFile,
        createdAt: bundle.createdAt,
        targetSkill: bundle.targetSkill,
      });
      continue;
    }

    reviewed.push({
      bundleId: bundle.bundleId,
      bundleFile,
      latestReceipt,
    });
  }

  ready.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.bundleId.localeCompare(b.bundleId));
  reviewed.sort((a, b) => a.latestReceipt.consumedAt.localeCompare(b.latestReceipt.consumedAt) || a.bundleId.localeCompare(b.bundleId));

  await fs.writeFile(readyIndexFile, `${JSON.stringify(ready, null, 2)}\n`, 'utf-8');
  await fs.writeFile(reviewedIndexFile, `${JSON.stringify(reviewed, null, 2)}\n`, 'utf-8');

  return {
    rootDir: resolvedRootDir,
    handoffDir,
    readyIndexFile,
    reviewedIndexFile,
  };
}

export async function listReadySkillReviewBundles(rootDir?: string): Promise<SkillReviewReadyIndexEntry[]> {
  const resolvedRootDir = getArtifactRoot(rootDir);
  const readyIndexFile = path.join(getSkillReviewIndexesDir(resolvedRootDir), 'ready.json');

  try {
    const raw = await fs.readFile(readyIndexFile, 'utf-8');
    const ready = JSON.parse(raw) as SkillReviewReadyIndexEntry[];
    return [...ready].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.bundleId.localeCompare(b.bundleId));
  } catch {
    return [];
  }
}

export async function listReviewedSkillReviewBundles(rootDir?: string): Promise<SkillReviewReviewedIndexEntry[]> {
  const resolvedRootDir = getArtifactRoot(rootDir);
  const reviewedIndexFile = path.join(getSkillReviewIndexesDir(resolvedRootDir), 'reviewed.json');

  try {
    const raw = await fs.readFile(reviewedIndexFile, 'utf-8');
    const reviewed = JSON.parse(raw) as SkillReviewReviewedIndexEntry[];
    return [...reviewed].sort(
      (a, b) => a.latestReceipt.consumedAt.localeCompare(b.latestReceipt.consumedAt) || a.bundleId.localeCompare(b.bundleId),
    );
  } catch {
    return [];
  }
}

export interface SkillExploreLatestSessionIndex {
  sessionFile: string | null;
  sessionKey: string;
  updatedAt: string;
  totalSkillReads: number;
  summaryFile: string;
  roundFactsFile: string;
}

export async function readLatestSkillExploreSessionIndex(rootDir?: string): Promise<SkillExploreLatestSessionIndex | null> {
  const resolvedRootDir = getArtifactRoot(rootDir);
  const latestFile = path.join(resolvedRootDir, 'latest', 'latest-session.json');

  try {
    const raw = await fs.readFile(latestFile, 'utf-8');
    return JSON.parse(raw) as SkillExploreLatestSessionIndex;
  } catch {
    return null;
  }
}

function matchesRequestedAggregateTargetSkill(skill: SkillAggregateSummary['skill'], targetSkill: string): boolean {
  const normalizedTargetSkill = targetSkill.trim().toLowerCase();
  if (!normalizedTargetSkill) return false;

  const candidates = [
    skill.skillKey,
    skill.skillName,
    skill.skillPath,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return candidates.some((value) => value.toLowerCase() === normalizedTargetSkill);
}

export async function listSkillAggregateSummaries(input?: {
  rootDir?: string;
  targetSkill?: string;
}): Promise<SkillAggregateSummary[]> {
  const resolvedRootDir = getArtifactRoot(input?.rootDir);
  const aggregateRootDir = path.join(resolvedRootDir, 'aggregates', 'by-skill');

  let skillDirs: fs.Dirent[];
  try {
    skillDirs = await fs.readdir(aggregateRootDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const summaries: SkillAggregateSummary[] = [];

  for (const skillDir of skillDirs.filter((entry) => entry.isDirectory())) {
    const skillPath = path.join(aggregateRootDir, skillDir.name);
    let versionDirs: fs.Dirent[];
    try {
      versionDirs = await fs.readdir(skillPath, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const versionDir of versionDirs.filter((entry) => entry.isDirectory())) {
      const summaryFile = path.join(skillPath, versionDir.name, 'summary.json');
      try {
        const raw = await fs.readFile(summaryFile, 'utf-8');
        const summary = JSON.parse(raw) as SkillAggregateSummary;
        if (input?.targetSkill && !matchesRequestedAggregateTargetSkill(summary.skill, input.targetSkill)) {
          continue;
        }
        summaries.push(summary);
      } catch {
        continue;
      }
    }
  }

  return summaries.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt) || b.window.to.localeCompare(a.window.to) || a.aggregateId.localeCompare(b.aggregateId));
}

interface ReadyBundleSignalRichness {
  notableSignalTotal: number;
  usageFactCount: number;
  totalReads: number;
}

interface ReadyBundleCandidate {
  entry: SkillReviewReadyIndexEntry;
  bundle: SkillReviewBundle;
  signalRichness: ReadyBundleSignalRichness;
}

function matchesRequestedReadyTargetSkill(entry: SkillReviewReadyIndexEntry, targetSkill: string): boolean {
  const normalizedTargetSkill = targetSkill.trim().toLowerCase();
  if (!normalizedTargetSkill) return false;

  const candidates = [
    entry.targetSkill.skillKey,
    entry.targetSkill.skillName,
    entry.targetSkill.skillPath,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return candidates.some((value) => value.toLowerCase() === normalizedTargetSkill);
}

function getReadyBundleSignalRichness(bundle: SkillReviewBundle): ReadyBundleSignalRichness {
  return {
    notableSignalTotal: Object.values(bundle.summary.notableSignals).reduce((sum, value) => sum + value, 0),
    usageFactCount: bundle.scope.usageFactCount,
    totalReads: bundle.summary.totalReads,
  };
}

function compareReadyBundleCandidates(a: ReadyBundleCandidate, b: ReadyBundleCandidate): number {
  const createdAtComparison = a.entry.createdAt.localeCompare(b.entry.createdAt);
  if (createdAtComparison !== 0) return createdAtComparison;

  const notableSignalComparison = a.signalRichness.notableSignalTotal - b.signalRichness.notableSignalTotal;
  if (notableSignalComparison !== 0) return notableSignalComparison;

  const usageFactComparison = a.signalRichness.usageFactCount - b.signalRichness.usageFactCount;
  if (usageFactComparison !== 0) return usageFactComparison;

  const totalReadsComparison = a.signalRichness.totalReads - b.signalRichness.totalReads;
  if (totalReadsComparison !== 0) return totalReadsComparison;

  return a.entry.bundleId.localeCompare(b.entry.bundleId);
}

export async function getPreferredReadySkillReviewBundle(input?: {
  rootDir?: string;
  targetSkill?: string;
}): Promise<{
  entry: SkillReviewReadyIndexEntry;
  bundle: SkillReviewBundle;
  selection: {
    strategy: 'latest' | 'target-skill' | 'latest-fallback';
    requestedTargetSkill?: string;
    orderedBy: Array<'target-skill' | 'newer' | 'richer-signals'>;
    signalRichness: ReadyBundleSignalRichness;
  };
} | null> {
  const ready = await listReadySkillReviewBundles(input?.rootDir);
  if (ready.length === 0) return null;

  const candidates = (await Promise.all(ready.map(async (entry) => {
    try {
      const bundle = JSON.parse(await fs.readFile(entry.bundleFile, 'utf-8')) as SkillReviewBundle;
      return {
        entry,
        bundle,
        signalRichness: getReadyBundleSignalRichness(bundle),
      } satisfies ReadyBundleCandidate;
    } catch {
      return null;
    }
  }))).filter((candidate): candidate is ReadyBundleCandidate => !!candidate);

  if (candidates.length === 0) return null;

  const requestedTargetSkill = input?.targetSkill?.trim();
  let selectedPool = candidates;
  let selectionBase: {
    strategy: 'latest' | 'target-skill' | 'latest-fallback';
    requestedTargetSkill?: string;
    orderedBy: Array<'target-skill' | 'newer' | 'richer-signals'>;
  } | null = null;

  if (requestedTargetSkill) {
    const matched = candidates.filter(({ entry }) => matchesRequestedReadyTargetSkill(entry, requestedTargetSkill));
    if (matched.length > 0) {
      selectedPool = matched;
      selectionBase = {
        strategy: 'target-skill',
        requestedTargetSkill,
        orderedBy: ['target-skill', 'newer', 'richer-signals'],
      };
    } else {
      selectionBase = {
        strategy: 'latest-fallback',
        requestedTargetSkill,
        orderedBy: ['target-skill', 'newer', 'richer-signals'],
      };
    }
  }

  const selectedCandidate = [...selectedPool].sort(compareReadyBundleCandidates).at(-1);
  if (!selectedCandidate) return null;

  return {
    entry: selectedCandidate.entry,
    bundle: selectedCandidate.bundle,
    selection: {
      ...(selectionBase ?? {
        strategy: 'latest',
        orderedBy: ['newer', 'richer-signals'],
      }),
      signalRichness: selectedCandidate.signalRichness,
    },
  };
}

export async function getLatestReadySkillReviewBundle(rootDir?: string): Promise<{
  entry: SkillReviewReadyIndexEntry;
  bundle: SkillReviewBundle;
} | null> {
  const preferred = await getPreferredReadySkillReviewBundle({ rootDir });
  if (!preferred) return null;

  return {
    entry: preferred.entry,
    bundle: preferred.bundle,
  };
}

export async function persistSkillReviewBundle(input: {
  bundle: SkillReviewBundle;
  rootDir?: string;
}): Promise<SkillReviewBundlePersistResult> {
  const rootDir = getArtifactRoot(input.rootDir);
  const handoffDir = getSkillReviewHandoffDir(rootDir);
  const bundlesDir = path.join(handoffDir, 'bundles');
  const bundleFile = getBundleFile(rootDir, input.bundle.bundleId);

  await fs.mkdir(bundlesDir, { recursive: true });
  await fs.writeFile(bundleFile, `${JSON.stringify(input.bundle, null, 2)}\n`, 'utf-8');
  await rebuildSkillReviewIndexes(rootDir);

  return {
    rootDir,
    handoffDir,
    bundleFile,
    bundle: input.bundle,
  };
}

export async function persistBundleReceipt(input: {
  receipt: BundleReceipt;
  rootDir?: string;
}): Promise<BundleReceiptPersistResult> {
  const rootDir = getArtifactRoot(input.rootDir);
  const handoffDir = getSkillReviewHandoffDir(rootDir);
  const receiptDir = getReceiptDir(rootDir, input.receipt.bundleId);
  const receiptFile = path.join(receiptDir, `${safeFileName(input.receipt.consumerRunId)}.json`);

  await fs.mkdir(receiptDir, { recursive: true });
  await fs.writeFile(receiptFile, `${JSON.stringify(input.receipt, null, 2)}\n`, 'utf-8');
  const indexes = await rebuildSkillReviewIndexes(rootDir);

  return {
    rootDir,
    handoffDir,
    receiptFile,
    receipt: input.receipt,
    readyIndexFile: indexes.readyIndexFile,
    reviewedIndexFile: indexes.reviewedIndexFile,
  };
}

export async function persistSkillExploreArtifacts(input: {
  branch: BranchEntryLike[];
  sessionFile: string | null;
  rootDir?: string;
}): Promise<SkillExplorePersistResult> {
  const rootDir = getArtifactRoot(input.rootDir);
  const sessionKey = getSessionKey(input.sessionFile);
  const sessionDir = path.join(rootDir, 'sessions', sessionKey);
  const latestDir = path.join(rootDir, 'latest');
  const roundFactsFile = path.join(sessionDir, 'round-skill-usage-facts.json');
  const summaryFile = path.join(sessionDir, 'skill-explore-summary.json');
  const latestFile = path.join(latestDir, 'latest-session.json');

  const roundFacts = buildSkillExploreRoundFactsFromBranch(input.branch, input.sessionFile);
  const summary = summarizeSkillExploreRoundFacts(roundFacts, input.sessionFile);

  await fs.mkdir(sessionDir, { recursive: true });
  await fs.mkdir(latestDir, { recursive: true });

  await fs.writeFile(roundFactsFile, `${JSON.stringify(roundFacts, null, 2)}\n`, 'utf-8');
  await fs.writeFile(summaryFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  await fs.writeFile(
    latestFile,
    `${JSON.stringify({
      sessionFile: input.sessionFile,
      sessionKey,
      updatedAt: summary.updatedAt,
      totalSkillReads: summary.totalSkillReads,
      summaryFile,
      roundFactsFile,
    }, null, 2)}\n`,
    'utf-8',
  );

  return {
    rootDir,
    sessionDir,
    roundFactsFile,
    summaryFile,
    latestFile,
    summary,
    roundFacts,
  };
}

export async function runSkillExploreAgentEndBridge(input: {
  branch: BranchEntryLike[];
  sessionFile: string | null;
  rootDir?: string;
  logger?: Logger | null;
}): Promise<SkillExplorePersistResult> {
  const result = await persistSkillExploreArtifacts(input);
  const usageFacts = buildSkillUsageFactsFromBranch(input.branch, input.sessionFile, { rootDir: result.rootDir });
  let aggregateResult: SkillAggregatePersistResult | undefined;
  let bundleFiles: string[] | undefined;

  if (usageFacts.length > 0) {
    aggregateResult = await persistSkillAggregateArtifacts({
      usageFacts,
      rootDir: result.rootDir,
    });

    const persistedBundles: string[] = [];
    for (const item of aggregateResult.items) {
      const bundle = buildSkillReviewBundle(item.aggregate, {
        aggregateSummaryFile: item.summaryFile,
        taskShapesFile: item.taskShapesFile,
        evidenceIndexFile: item.evidenceIndexFile,
      });
      const persisted = await persistSkillReviewBundle({
        bundle,
        rootDir: result.rootDir,
      });
      persistedBundles.push(persisted.bundleFile);
    }

    bundleFiles = persistedBundles;
  }

  input.logger?.debug?.(
    `skill-explore bridge persisted (sessionKey=${result.summary.sessionKey}, totalSkillReads=${result.summary.totalSkillReads}, rounds=${result.roundFacts.length}, usageFacts=${usageFacts.length}, aggregates=${aggregateResult?.items.length ?? 0}, bundles=${bundleFiles?.length ?? 0})`,
  );
  return {
    ...result,
    usageFacts,
    aggregateResult,
    bundleFiles,
  };
}
