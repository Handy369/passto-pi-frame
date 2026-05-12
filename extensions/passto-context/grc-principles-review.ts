import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';

import { createPrinciplesManager } from './grc-principles.ts';
import { renderPrinciplesReviewHtml } from './grc-principles-review-html.ts';
import type { Logger, PrincipleItem } from './types.ts';
import { nowIso } from './utils.ts';

const REGISTRY_FILE = 'principles-registry.json';

export type PrincipleLifecycle = 'active' | 'stale' | 'archived' | 'disabled';
export type PrinciplesReviewAction = 'keep-active' | 'mark-stale' | 'archive' | 'disable';

export interface PrinciplesReviewItem {
  id: string;
  created: string;
  updated?: string;
  content: string;
  tags: string[];
  metadata: {
    lifecycle: PrincipleLifecycle;
    activeScore: number;
    hintCount: number;
    lastHintedAt?: string;
    conflictGroupId?: string;
  };
  review: {
    reasons: string[];
    signals: string[];
    recommendedAction: PrinciplesReviewAction;
  };
}

export interface PrinciplesReviewModel {
  version: 1;
  kind: 'principles-review-model';
  generatedAt: string;
  reviewSessionId: string;
  registryPath: string;
  registrySnapshotHash: string;
  summary: {
    total: number;
    injectable: number;
    active: number;
    stale: number;
    archived: number;
    disabled: number;
    review: {
      staleCandidates: number;
      pseudoCandidates: number;
      oversizedCandidates: number;
    };
  };
  filters: {
    supportedLifecycle: PrincipleLifecycle[];
    supportedActions: PrinciplesReviewAction[];
  };
  items: PrinciplesReviewItem[];
}

export interface BuildPrinciplesReviewModelOptions {
  principlesDir: string;
  logger: Logger;
  generatedAt?: string;
}

export interface PrinciplesReviewDecision {
  id: string;
  action: PrinciplesReviewAction;
  note?: string;
}

export interface PrinciplesReviewDecisionFile {
  version: 1;
  kind: 'principles-review-decision';
  generatedAt?: string;
  reviewSessionId?: string;
  registrySnapshotHash: string;
  reviewer?: string;
  decisions: PrinciplesReviewDecision[];
}

export interface ImportPrinciplesReviewDecisionFileOptions {
  principlesDir: string;
  decisionFilePath: string;
  logger: Logger;
  appliedAt?: string;
}

export interface ImportPrinciplesReviewDecisionResult {
  totalDecisions: number;
  updated: number;
  active: number;
  stale: number;
  archived: number;
  disabled: number;
  registryPath: string;
}

export interface ExportPrinciplesReviewBundleOptions {
  principlesDir: string;
  outputDir?: string;
  logger: Logger;
  generatedAt?: string;
}

export interface ExportPrinciplesReviewBundleResult {
  outputDir: string;
  reviewModelPath: string;
  reviewHtmlPath: string;
  reviewSessionId: string;
  registrySnapshotHash: string;
}

export async function buildPrinciplesReviewModel(options: BuildPrinciplesReviewModelOptions): Promise<PrinciplesReviewModel> {
  const generatedAt = options.generatedAt ?? nowIso();
  const registryPath = path.join(options.principlesDir, REGISTRY_FILE);

  const manager = createPrinciplesManager(options.logger);
  await manager.load(options.principlesDir);
  const registrySnapshotHash = await computeRegistrySnapshotHash(registryPath);

  const diagnostics = manager.getDiagnostics();
  const items = manager.list().map(toReviewItem);

  return {
    version: 1,
    kind: 'principles-review-model',
    generatedAt,
    reviewSessionId: formatReviewSessionId(generatedAt),
    registryPath,
    registrySnapshotHash,
    summary: {
      total: items.length,
      injectable: diagnostics.health.injectable,
      active: countByLifecycle(items, 'active'),
      stale: countByLifecycle(items, 'stale'),
      archived: countByLifecycle(items, 'archived'),
      disabled: countByLifecycle(items, 'disabled'),
      review: {
        staleCandidates: diagnostics.review.staleCandidates,
        pseudoCandidates: diagnostics.review.pseudoCandidates,
        oversizedCandidates: diagnostics.review.oversizedCandidates,
      },
    },
    filters: {
      supportedLifecycle: ['active', 'stale', 'archived', 'disabled'],
      supportedActions: ['keep-active', 'mark-stale', 'archive', 'disable'],
    },
    items,
  };
}

export async function exportPrinciplesReviewBundle(
  options: ExportPrinciplesReviewBundleOptions,
): Promise<ExportPrinciplesReviewBundleResult> {
  const generatedAt = options.generatedAt ?? nowIso();
  const model = await buildPrinciplesReviewModel({
    principlesDir: options.principlesDir,
    logger: options.logger,
    generatedAt,
  });
  const outputDir = options.outputDir ?? path.join(options.principlesDir, 'reviews', model.reviewSessionId);
  const reviewModelPath = path.join(outputDir, 'review-model.json');
  const reviewHtmlPath = path.join(outputDir, 'review.html');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(reviewModelPath, JSON.stringify(model, null, 2), 'utf-8');
  await fs.writeFile(reviewHtmlPath, renderPrinciplesReviewHtml(model), 'utf-8');

  return {
    outputDir,
    reviewModelPath,
    reviewHtmlPath,
    reviewSessionId: model.reviewSessionId,
    registrySnapshotHash: model.registrySnapshotHash,
  };
}

export async function importPrinciplesReviewDecisionFile(
  options: ImportPrinciplesReviewDecisionFileOptions,
): Promise<ImportPrinciplesReviewDecisionResult> {
  const appliedAt = options.appliedAt ?? nowIso();
  const registryPath = path.join(options.principlesDir, REGISTRY_FILE);
  const currentRegistryRaw = await fs.readFile(registryPath, 'utf-8');
  const currentSnapshotHash = computeRawHash(currentRegistryRaw);

  const decisionFile = parseDecisionFile(await fs.readFile(options.decisionFilePath, 'utf-8'));
  if (decisionFile.registrySnapshotHash !== currentSnapshotHash) {
    throw new Error(`snapshot mismatch: expected ${currentSnapshotHash} but got ${decisionFile.registrySnapshotHash}`);
  }

  const registry = JSON.parse(currentRegistryRaw) as {
    version?: number;
    updatedAt?: string;
    principles?: Array<{
      id?: string;
      updated?: string;
      metadata?: Record<string, unknown>;
      [key: string]: unknown;
    }>;
  };
  const principles = Array.isArray(registry.principles) ? registry.principles : [];
  const existingIds = new Set(
    principles
      .map((item) => (typeof item?.id === 'string' ? item.id : null))
      .filter((item): item is string => Boolean(item)),
  );

  const missingIds = Array.from(new Set(decisionFile.decisions.map((item) => item.id).filter((id) => !existingIds.has(id))));
  if (missingIds.length > 0) {
    throw new Error(`unknown principle ids: ${missingIds.join(', ')}`);
  }

  const decisionsById = new Map(decisionFile.decisions.map((item) => [item.id, item]));
  let updated = 0;
  for (const principle of principles) {
    if (typeof principle?.id !== 'string') continue;
    const decision = decisionsById.get(principle.id);
    if (!decision) continue;
    const metadata = isRecord(principle.metadata) ? { ...principle.metadata } : {};
    metadata.lifecycle = mapActionToLifecycle(decision.action);
    principle.metadata = metadata;
    principle.updated = appliedAt;
    updated += 1;
  }

  registry.updatedAt = appliedAt;
  await fs.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf-8');

  const lifecycleCounts = countRegistryLifecycles(principles);
  return {
    totalDecisions: decisionFile.decisions.length,
    updated,
    active: lifecycleCounts.active,
    stale: lifecycleCounts.stale,
    archived: lifecycleCounts.archived,
    disabled: lifecycleCounts.disabled,
    registryPath,
  };
}

async function computeRegistrySnapshotHash(registryPath: string): Promise<string> {
  const raw = await fs.readFile(registryPath, 'utf-8');
  return computeRawHash(raw);
}

function computeRawHash(raw: string): string {
  return `sha256:${createHash('sha256').update(raw).digest('hex')}`;
}

function formatReviewSessionId(iso: string): string {
  return iso.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z');
}

function countByLifecycle(items: PrinciplesReviewItem[], lifecycle: PrincipleLifecycle): number {
  return items.filter((item) => item.metadata.lifecycle === lifecycle).length;
}

function toReviewItem(item: PrincipleItem): PrinciplesReviewItem {
  const lifecycle = normalizeLifecycle(item.metadata.lifecycle);
  const reasons = buildReasons(item);
  const signals = buildSignals(item);

  return {
    id: item.id,
    created: item.created,
    updated: item.updated,
    content: item.content,
    tags: [...item.tags],
    metadata: {
      lifecycle,
      activeScore: item.metadata.activeScore ?? item.metadata.hintCount ?? item.metadata.hitCount ?? 0,
      hintCount: item.metadata.hintCount ?? item.metadata.hitCount ?? 0,
      lastHintedAt: item.metadata.lastHintedAt,
      conflictGroupId: item.metadata.conflictGroupId,
    },
    review: {
      reasons,
      signals,
      recommendedAction: chooseRecommendedAction(lifecycle, reasons),
    },
  };
}

function normalizeLifecycle(lifecycle?: PrincipleItem['metadata']['lifecycle']): PrincipleLifecycle {
  if (lifecycle === 'stale' || lifecycle === 'archived' || lifecycle === 'disabled') {
    return lifecycle;
  }
  return 'active';
}

function buildReasons(item: PrincipleItem): string[] {
  const reasons: string[] = [];
  if (isStaleCandidate(item)) reasons.push('stale-candidate');
  if (isPseudoCandidate(item)) reasons.push('pseudo-candidate');
  if (isOversizedCandidate(item)) reasons.push('oversized-candidate');
  return reasons;
}

function buildSignals(item: PrincipleItem): string[] {
  const signals: string[] = [];
  const content = item.content;
  const addedCount = (content.match(/新增：/g) ?? []).length;

  if (/RequirementLedger/.test(content)) signals.push('mentions-RequirementLedger');
  if (/standingInstructions/.test(content)) signals.push('mentions-standingInstructions');
  if (/ObjectiveSnapshot/.test(content)) signals.push('mentions-ObjectiveSnapshot');
  if (addedCount >= 2) signals.push('multiple-新增');
  if (/README/.test(content)) signals.push('mentions-README');
  if (/TODO\.md/.test(content)) signals.push('mentions-TODO.md');
  if (/package\.json/.test(content)) signals.push('mentions-package.json');
  if (/同步文档/.test(content)) signals.push('doc-sync');
  if (/迁移/.test(content)) signals.push('migration-note');
  if (/回归决策记录/.test(content)) signals.push('regression-note');
  if (content.length > 280) signals.push('content>280');

  return signals;
}

function chooseRecommendedAction(lifecycle: PrincipleLifecycle, reasons: string[]): PrinciplesReviewAction {
  if (lifecycle === 'archived') return 'archive';
  if (lifecycle === 'disabled') return 'disable';
  if (reasons.length > 0) return 'mark-stale';
  return 'keep-active';
}

function parseDecisionFile(raw: string): PrinciplesReviewDecisionFile {
  const parsed = JSON.parse(raw) as Partial<PrinciplesReviewDecisionFile>;
  if (parsed.kind !== 'principles-review-decision') {
    throw new Error('invalid decision file: kind must be principles-review-decision');
  }
  if (parsed.version !== 1) {
    throw new Error('invalid decision file: version must be 1');
  }
  if (typeof parsed.registrySnapshotHash !== 'string' || !parsed.registrySnapshotHash.trim()) {
    throw new Error('invalid decision file: registrySnapshotHash is required');
  }
  if (!Array.isArray(parsed.decisions)) {
    throw new Error('invalid decision file: decisions must be an array');
  }

  const decisions = parsed.decisions.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new Error('invalid decision file: decision must be an object');
    }
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id) {
      throw new Error('invalid decision file: decision id must be a non-empty string');
    }
    if (!isReviewAction(item.action)) {
      throw new Error(`invalid decision file: unsupported action for ${id}`);
    }
    return {
      id,
      action: item.action,
      note: typeof item.note === 'string' ? item.note : undefined,
    } satisfies PrinciplesReviewDecision;
  });

  return {
    version: 1,
    kind: 'principles-review-decision',
    generatedAt: typeof parsed.generatedAt === 'string' ? parsed.generatedAt : undefined,
    reviewSessionId: typeof parsed.reviewSessionId === 'string' ? parsed.reviewSessionId : undefined,
    registrySnapshotHash: parsed.registrySnapshotHash,
    reviewer: typeof parsed.reviewer === 'string' ? parsed.reviewer : undefined,
    decisions,
  };
}

function isReviewAction(value: unknown): value is PrinciplesReviewAction {
  return value === 'keep-active' || value === 'mark-stale' || value === 'archive' || value === 'disable';
}

function mapActionToLifecycle(action: PrinciplesReviewAction): PrincipleLifecycle {
  switch (action) {
    case 'keep-active':
      return 'active';
    case 'mark-stale':
      return 'stale';
    case 'archive':
      return 'archived';
    case 'disable':
      return 'disabled';
  }
}

function countRegistryLifecycles(
  principles: Array<{ metadata?: Record<string, unknown> }>,
): Record<PrincipleLifecycle, number> {
  const counts: Record<PrincipleLifecycle, number> = {
    active: 0,
    stale: 0,
    archived: 0,
    disabled: 0,
  };

  for (const principle of principles) {
    const lifecycle = normalizeLifecycle(typeof principle?.metadata?.lifecycle === 'string'
      ? principle.metadata.lifecycle as PrincipleItem['metadata']['lifecycle']
      : undefined);
    counts[lifecycle] += 1;
  }

  return counts;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStaleCandidate(item: PrincipleItem): boolean {
  return /RequirementLedger|standingInstructions|ObjectiveSnapshot/.test(item.content);
}

function isPseudoCandidate(item: PrincipleItem): boolean {
  const addedCount = (item.content.match(/新增：/g) ?? []).length;
  return addedCount >= 2
    || /TODO\.md|README|package\.json/.test(item.content)
    || /同步文档|迁移|回归决策记录/.test(item.content);
}

function isOversizedCandidate(item: PrincipleItem): boolean {
  return item.content.length > 280;
}
