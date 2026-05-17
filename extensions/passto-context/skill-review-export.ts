import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {
  getPreferredReadySkillReviewBundle,
  listReadySkillReviewBundles,
  listReviewedSkillReviewBundles,
  listSkillAggregateSummaries,
  readLatestSkillExploreSessionIndex,
  resolveSkillExploreArtifactRoot,
  type BundleReceipt,
  type SkillAggregateSummary,
  type SkillExploreLatestSessionIndex,
  type SkillReviewBundle,
  type SkillReviewReviewedIndexEntry,
} from './plugin/skill-explore/index.ts';
import { renderSkillReviewHtml } from './skill-review-export-html.ts';
import type { Logger } from './types.ts';
import { nowIso, safeFileName } from './utils.ts';

export interface SkillReviewExportModel {
  version: 1;
  kind: 'skill-review-export-model';
  exportedAt: string;
  exportSessionId: string;
  artifactRoot: string;
  requestedTargetSkill?: string;
  latestSession: SkillExploreLatestSessionIndex | null;
  catalog: {
    readyCount: number;
    reviewedCount: number;
    aggregateCount: number;
  };
  selected: {
    status: 'ready-bundle' | 'reviewed-bundle' | 'aggregate-only' | 'empty';
    selection?: {
      strategy: 'latest' | 'target-skill' | 'latest-fallback' | 'reviewed-match' | 'aggregate-match';
      orderedBy: string[];
      requestedTargetSkill?: string;
      signalRichness?: {
        notableSignalTotal: number;
        usageFactCount: number;
        totalReads: number;
      };
    };
    bundle?: SkillReviewBundle;
    reviewedReceipt?: BundleReceipt;
    aggregate?: SkillAggregateSummary;
  };
  aggregateCandidates: Array<{
    skillKey: string;
    generatedAt: string;
    totalReads: number;
    sessionCount: number;
    roundCount: number;
  }>;
  notes: string[];
}

export interface ExportSkillReviewBundleOptions {
  rootDir?: string;
  outputDir?: string;
  targetSkill?: string;
  logger: Logger;
  exportedAt?: string;
}

export interface ExportSkillReviewBundleResult {
  outputDir: string;
  reviewModelPath: string;
  reviewHtmlPath: string;
  exportSessionId: string;
  artifactRoot: string;
  selectedStatus: SkillReviewExportModel['selected']['status'];
}

interface SelectedSkillExportState {
  status: SkillReviewExportModel['selected']['status'];
  selection?: SkillReviewExportModel['selected']['selection'];
  bundle?: SkillReviewBundle;
  reviewedReceipt?: BundleReceipt;
  aggregate?: SkillAggregateSummary;
}

function formatExportSessionId(iso: string): string {
  return iso.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function matchesSkillTarget(
  skill: { skillKey?: string; skillName?: string; skillPath?: string },
  targetSkill: string,
): boolean {
  const normalized = targetSkill.trim().toLowerCase();
  if (!normalized) return false;

  const candidates = [skill.skillKey, skill.skillName, skill.skillPath]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  return candidates.some((value) => value.toLowerCase() === normalized);
}

function buildAggregateCandidates(summaries: SkillAggregateSummary[]): SkillReviewExportModel['aggregateCandidates'] {
  return summaries.slice(0, 10).map((summary) => ({
    skillKey: summary.skill.skillKey,
    generatedAt: summary.generatedAt,
    totalReads: summary.counts.totalReads,
    sessionCount: summary.window.sessionCount,
    roundCount: summary.window.roundCount,
  }));
}

async function readReviewedBundlesWithPayload(rootDir?: string): Promise<Array<{
  entry: SkillReviewReviewedIndexEntry;
  bundle: SkillReviewBundle;
}>> {
  const reviewed = await listReviewedSkillReviewBundles(rootDir);
  const loaded = await Promise.all(reviewed.map(async (entry) => {
    try {
      const bundle = JSON.parse(await fs.readFile(entry.bundleFile, 'utf-8')) as SkillReviewBundle;
      return { entry, bundle };
    } catch {
      return null;
    }
  }));

  return loaded.filter((item): item is { entry: SkillReviewReviewedIndexEntry; bundle: SkillReviewBundle } => !!item);
}

async function resolveSelectedSkillExportState(input: {
  rootDir?: string;
  targetSkill?: string;
  aggregates: SkillAggregateSummary[];
}): Promise<SelectedSkillExportState> {
  const preferred = await getPreferredReadySkillReviewBundle({
    rootDir: input.rootDir,
    targetSkill: input.targetSkill,
  });

  if (preferred) {
    const matchedAggregate = input.aggregates.find((item) =>
      item.skill.skillKey === preferred.bundle.targetSkill.skillKey
      && item.skill.skillPath === preferred.bundle.targetSkill.skillPath,
    );

    return {
      status: 'ready-bundle',
      selection: {
        strategy: preferred.selection.strategy,
        orderedBy: preferred.selection.orderedBy,
        requestedTargetSkill: preferred.selection.requestedTargetSkill,
        signalRichness: preferred.selection.signalRichness,
      },
      bundle: preferred.bundle,
      aggregate: matchedAggregate,
    };
  }

  const reviewed = await readReviewedBundlesWithPayload(input.rootDir);
  if (reviewed.length > 0) {
    const selectedReviewed = input.targetSkill
      ? reviewed.find((item) => matchesSkillTarget(item.bundle.targetSkill, input.targetSkill)) ?? reviewed.at(-1)
      : reviewed.at(-1);

    if (selectedReviewed) {
      const matchedAggregate = input.aggregates.find((item) =>
        item.skill.skillKey === selectedReviewed.bundle.targetSkill.skillKey
        && item.skill.skillPath === selectedReviewed.bundle.targetSkill.skillPath,
      );
      return {
        status: 'reviewed-bundle',
        selection: {
          strategy: 'reviewed-match',
          orderedBy: input.targetSkill ? ['target-skill', 'reviewed-consumedAt'] : ['reviewed-consumedAt'],
          requestedTargetSkill: input.targetSkill,
        },
        bundle: selectedReviewed.bundle,
        reviewedReceipt: selectedReviewed.entry.latestReceipt,
        aggregate: matchedAggregate,
      };
    }
  }

  const aggregate = input.targetSkill
    ? input.aggregates.find((item) => matchesSkillTarget(item.skill, input.targetSkill))
    : input.aggregates[0];

  if (aggregate) {
    return {
      status: 'aggregate-only',
      selection: {
        strategy: 'aggregate-match',
        orderedBy: input.targetSkill ? ['target-skill', 'aggregate-generatedAt'] : ['aggregate-generatedAt'],
        requestedTargetSkill: input.targetSkill,
      },
      aggregate,
    };
  }

  return {
    status: 'empty',
  };
}

export async function buildSkillReviewExportModel(
  options: ExportSkillReviewBundleOptions,
): Promise<SkillReviewExportModel> {
  const exportedAt = options.exportedAt ?? nowIso();
  const artifactRoot = resolveSkillExploreArtifactRoot(options.rootDir);
  const [latestSession, readyBundles, reviewedBundles, aggregates] = await Promise.all([
    readLatestSkillExploreSessionIndex(options.rootDir),
    listReadySkillReviewBundles(options.rootDir),
    listReviewedSkillReviewBundles(options.rootDir),
    listSkillAggregateSummaries({ rootDir: options.rootDir, targetSkill: options.targetSkill }),
  ]);

  const selected = await resolveSelectedSkillExportState({
    rootDir: options.rootDir,
    targetSkill: options.targetSkill,
    aggregates,
  });

  const notes: string[] = [];
  if (selected.status === 'ready-bundle') {
    notes.push('已优先导出 ready bundle，对应 handoff surface 可直接供 skills-maker 或人工审阅使用。');
  } else if (selected.status === 'reviewed-bundle') {
    notes.push('当前未命中 ready bundle，已回退到最近 reviewed bundle，并保留 receipt 作为消费证明。');
  } else if (selected.status === 'aggregate-only') {
    notes.push('当前缺少 bundle，已回退到 aggregate summary；这仍是 evidence 输入层，不是最终 verdict。');
  } else {
    notes.push('当前未发现可导出的 bundle 或 aggregate；缺少 runtime evidence。');
  }

  if (options.targetSkill) {
    notes.push(`请求 target skill: ${options.targetSkill}`);
  }

  return {
    version: 1,
    kind: 'skill-review-export-model',
    exportedAt,
    exportSessionId: formatExportSessionId(exportedAt),
    artifactRoot,
    requestedTargetSkill: options.targetSkill,
    latestSession,
    catalog: {
      readyCount: readyBundles.length,
      reviewedCount: reviewedBundles.length,
      aggregateCount: aggregates.length,
    },
    selected,
    aggregateCandidates: buildAggregateCandidates(aggregates),
    notes,
  };
}

export async function exportSkillReviewBundle(
  options: ExportSkillReviewBundleOptions,
): Promise<ExportSkillReviewBundleResult> {
  const model = await buildSkillReviewExportModel(options);
  const outputDir = options.outputDir
    ?? path.join(model.artifactRoot, 'exports', `${model.exportSessionId}${model.requestedTargetSkill ? `-${safeFileName(model.requestedTargetSkill)}` : ''}`);
  const reviewModelPath = path.join(outputDir, 'skill-review-model.json');
  const reviewHtmlPath = path.join(outputDir, 'review.html');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(reviewModelPath, `${JSON.stringify(model, null, 2)}\n`, 'utf-8');
  await fs.writeFile(reviewHtmlPath, renderSkillReviewHtml(model), 'utf-8');

  options.logger.info?.(
    `skill review export written (status=${model.selected.status}, outputDir=${outputDir}, target=${model.requestedTargetSkill ?? 'none'})`,
  );

  return {
    outputDir,
    reviewModelPath,
    reviewHtmlPath,
    exportSessionId: model.exportSessionId,
    artifactRoot: model.artifactRoot,
    selectedStatus: model.selected.status,
  };
}
