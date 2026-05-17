import type { Logger } from './types.ts';
import {
  listReadySkillReviewBundles,
  listReviewedSkillReviewBundles,
  listSkillAggregateSummaries,
  readLatestSkillExploreSessionIndex,
  resolveSkillExploreArtifactRoot,
  type SkillAggregateSummary,
  type SkillReviewReadyIndexEntry,
  type SkillReviewReviewedIndexEntry,
} from './plugin/skill-explore/index.ts';
import { exportSkillReviewBundle, type ExportSkillReviewBundleResult } from './skill-review-export.ts';

export interface HandlePTCSkillsCommandOptions {
  logger: Logger;
  notify: (message: string, level: 'info' | 'warning' | 'error') => void;
  rootDir?: string;
  listReadyBundles?: typeof listReadySkillReviewBundles;
  listReviewedBundles?: typeof listReviewedSkillReviewBundles;
  listAggregates?: typeof listSkillAggregateSummaries;
  readLatestSessionIndex?: typeof readLatestSkillExploreSessionIndex;
  resolveArtifactRoot?: (rootDir?: string) => string;
  exportReviewBundle?: typeof exportSkillReviewBundle;
  expandPath?: (value: string) => string;
}

export function getPTCSkillsUsageText(): string {
  return 'Usage: /ptc [status|on|off|config|rotate|compact|principles review export|principles review import <file>|skills status|skills ready|skills reviewed|skills aggregate [skillKey|skillName|skillPath]|skills export [skillKey|skillName|skillPath] [output-dir]]';
}

function formatReadyEntry(entry: SkillReviewReadyIndexEntry): string {
  return `- ${entry.targetSkill.skillKey} | ${entry.createdAt} | ${entry.bundleId}`;
}

function formatReviewedEntry(entry: SkillReviewReviewedIndexEntry): string {
  return `- ${entry.latestReceipt.result.status} | ${entry.latestReceipt.consumedAt} | ${entry.bundleId} | ${entry.latestReceipt.consumerRunId}`;
}

function formatAggregateEntry(summary: SkillAggregateSummary): string {
  return `- ${summary.skill.skillKey} | reads=${summary.counts.totalReads} | sessions=${summary.window.sessionCount} | rounds=${summary.window.roundCount} | generatedAt=${summary.generatedAt}`;
}

export function formatPTCSkillsExportMessage(result: ExportSkillReviewBundleResult): string {
  return [
    'Skill review bundle exported:',
    `- dir: ${result.outputDir}`,
    `- files: skill-review-model.json, review.html`,
    `- selectedStatus: ${result.selectedStatus}`,
    `- artifactRoot: ${result.artifactRoot}`,
  ].join('\n');
}

export function formatPTCSkillsStatusMessage(input: {
  artifactRoot: string;
  latestSession: Awaited<ReturnType<typeof readLatestSkillExploreSessionIndex>>;
  readyCount: number;
  reviewedCount: number;
  aggregateCount: number;
}): string {
  const lines = [
    '## Skill Explore Status',
    '',
    `- artifactRoot: ${input.artifactRoot}`,
    `- latestSessionKey: ${input.latestSession?.sessionKey ?? 'none'}`,
    `- latestUpdatedAt: ${input.latestSession?.updatedAt ?? 'none'}`,
    `- latestTotalSkillReads: ${input.latestSession?.totalSkillReads ?? 0}`,
    `- readyBundles: ${input.readyCount}`,
    `- reviewedBundles: ${input.reviewedCount}`,
    `- aggregateSummaries: ${input.aggregateCount}`,
  ];

  if (input.latestSession) {
    lines.push(`- latestSummaryFile: ${input.latestSession.summaryFile}`);
    lines.push(`- latestRoundFactsFile: ${input.latestSession.roundFactsFile}`);
  }

  return `${lines.join('\n')}\n`;
}

export function formatPTCSkillsReadyMessage(entries: SkillReviewReadyIndexEntry[]): string {
  const lines = ['## Skill Explore Ready Bundles', ''];
  if (entries.length === 0) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }

  lines.push(...entries.map(formatReadyEntry));
  return `${lines.join('\n')}\n`;
}

export function formatPTCSkillsReviewedMessage(entries: SkillReviewReviewedIndexEntry[]): string {
  const lines = ['## Skill Explore Reviewed Bundles', ''];
  if (entries.length === 0) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }

  lines.push(...entries.map(formatReviewedEntry));
  return `${lines.join('\n')}\n`;
}

export function formatPTCSkillsAggregateMessage(input: {
  summaries: SkillAggregateSummary[];
  requestedTargetSkill?: string;
}): string {
  const lines = ['## Skill Explore Aggregate Summaries', ''];
  if (input.requestedTargetSkill) {
    lines.push(`- requestedTargetSkill: ${input.requestedTargetSkill}`);
    lines.push('');
  }

  if (input.summaries.length === 0) {
    lines.push('- none');
    return `${lines.join('\n')}\n`;
  }

  lines.push(...input.summaries.map(formatAggregateEntry));
  return `${lines.join('\n')}\n`;
}

export async function handlePTCSkillsCommand(
  input: string,
  options: HandlePTCSkillsCommandOptions,
): Promise<boolean> {
  const normalized = input.trim();
  if (!normalized.startsWith('skills')) return false;

  const parts = normalized.split(/\s+/);
  if (parts[0] !== 'skills') return false;

  const action = parts[1]?.toLowerCase();
  const artifactRoot = (options.resolveArtifactRoot ?? resolveSkillExploreArtifactRoot)(options.rootDir);
  const listReady = options.listReadyBundles ?? listReadySkillReviewBundles;
  const listReviewed = options.listReviewedBundles ?? listReviewedSkillReviewBundles;
  const listAggregates = options.listAggregates ?? listSkillAggregateSummaries;
  const readLatest = options.readLatestSessionIndex ?? readLatestSkillExploreSessionIndex;
  const exportBundle = options.exportReviewBundle ?? exportSkillReviewBundle;

  try {
    if (action === 'status') {
      const [latestSession, ready, reviewed, aggregates] = await Promise.all([
        readLatest(options.rootDir),
        listReady(options.rootDir),
        listReviewed(options.rootDir),
        listAggregates({ rootDir: options.rootDir }),
      ]);

      options.notify(
        formatPTCSkillsStatusMessage({
          artifactRoot,
          latestSession,
          readyCount: ready.length,
          reviewedCount: reviewed.length,
          aggregateCount: aggregates.length,
        }),
        'info',
      );
      return true;
    }

    if (action === 'ready') {
      const ready = await listReady(options.rootDir);
      options.notify(formatPTCSkillsReadyMessage(ready), 'info');
      return true;
    }

    if (action === 'reviewed') {
      const reviewed = await listReviewed(options.rootDir);
      options.notify(formatPTCSkillsReviewedMessage(reviewed), 'info');
      return true;
    }

    if (action === 'aggregate') {
      const requestedTargetSkill = parts.slice(2).join(' ').trim() || undefined;
      const aggregates = await listAggregates({
        rootDir: options.rootDir,
        targetSkill: requestedTargetSkill,
      });
      options.notify(
        formatPTCSkillsAggregateMessage({
          summaries: aggregates,
          requestedTargetSkill,
        }),
        'info',
      );
      return true;
    }

    if (action === 'export') {
      const trailingArgs = parts.slice(2);
      const outputDirArg = trailingArgs.at(-1)?.startsWith('/') || trailingArgs.at(-1)?.startsWith('~')
        ? trailingArgs.at(-1)
        : undefined;
      const requestedTargetSkill = trailingArgs
        .slice(0, outputDirArg ? -1 : undefined)
        .join(' ')
        .trim() || undefined;
      const outputDir = outputDirArg
        ? (options.expandPath ? options.expandPath(outputDirArg) : outputDirArg)
        : undefined;

      const result = await exportBundle({
        rootDir: options.rootDir,
        outputDir,
        targetSkill: requestedTargetSkill,
        logger: options.logger,
      });
      options.notify(formatPTCSkillsExportMessage(result), 'info');
      return true;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    options.logger.error?.('ptc skills command failed:', err);
    options.notify(`Skills command failed: ${message}`, 'error');
    return true;
  }

  options.notify(getPTCSkillsUsageText(), 'warning');
  return true;
}
