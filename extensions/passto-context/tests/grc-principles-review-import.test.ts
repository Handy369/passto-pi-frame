import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { importPrinciplesReviewDecisionFile } from '../grc-principles-review.ts';

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

function hashRaw(raw: string): string {
  return `sha256:${createHash('sha256').update(raw).digest('hex')}`;
}

test('importPrinciplesReviewDecisionFile validates snapshot and applies lifecycle updates', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-import-'));
  const registryPath = path.join(dir, 'principles-registry.json');
  const decisionPath = path.join(dir, 'review-decision.json');

  try {
    const rawRegistry = JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T12:00:00.000Z',
      principles: [
        {
          id: 'principle_keep',
          created: '2026-05-12T11:00:00.000Z',
          updated: '2026-05-12T11:00:00.000Z',
          tags: ['quality'],
          content: '修改文件后必须验证结果。',
          metadata: {
            activeScore: 10,
            hintCount: 10,
            hintTimestamps: ['2026-05-12T11:00:00.000Z'],
            lifecycle: 'active',
            customNote: 'keep-me',
          },
        },
        {
          id: 'principle_stale',
          created: '2026-05-12T11:01:00.000Z',
          updated: '2026-05-12T11:01:00.000Z',
          tags: ['legacy'],
          content: '引用 RequirementLedger 的旧原则应停止注入。',
          metadata: {
            activeScore: 4,
            hintCount: 4,
            hintTimestamps: ['2026-05-12T11:01:00.000Z'],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_archive',
          created: '2026-05-12T11:02:00.000Z',
          updated: '2026-05-12T11:02:00.000Z',
          tags: ['legacy'],
          content: '新增：同步文档。新增：更新 README 并记录迁移备注。',
          metadata: {
            activeScore: 3,
            hintCount: 3,
            hintTimestamps: ['2026-05-12T11:02:00.000Z'],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_disable',
          created: '2026-05-12T11:03:00.000Z',
          updated: '2026-05-12T11:03:00.000Z',
          tags: ['legacy'],
          content: '这是一条需要停用的原则。',
          metadata: {
            activeScore: 2,
            hintCount: 2,
            hintTimestamps: ['2026-05-12T11:03:00.000Z'],
            lifecycle: 'active',
          },
        },
      ],
    }, null, 2);
    await fs.writeFile(registryPath, rawRegistry, 'utf-8');

    await fs.writeFile(
      decisionPath,
      JSON.stringify({
        version: 1,
        kind: 'principles-review-decision',
        generatedAt: '2026-05-12T12:10:00.000Z',
        reviewSessionId: '2026-05-12T12-00-00Z',
        registrySnapshotHash: hashRaw(rawRegistry),
        reviewer: 'handy',
        decisions: [
          { id: 'principle_keep', action: 'keep-active', note: '保留' },
          { id: 'principle_stale', action: 'mark-stale', note: '降权' },
          { id: 'principle_archive', action: 'archive', note: '归档' },
          { id: 'principle_disable', action: 'disable', note: '停用' },
        ],
      }, null, 2),
      'utf-8',
    );

    const result = await importPrinciplesReviewDecisionFile({
      principlesDir: dir,
      decisionFilePath: decisionPath,
      logger,
      appliedAt: '2026-05-12T12:20:00.000Z',
    });

    assert.deepEqual(result, {
      totalDecisions: 4,
      updated: 4,
      active: 1,
      stale: 1,
      archived: 1,
      disabled: 1,
      registryPath,
    });

    const rewritten = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
    const byId = new Map(rewritten.principles.map((item: any) => [item.id, item]));

    assert.equal(byId.get('principle_keep')?.metadata?.lifecycle, 'active');
    assert.equal(byId.get('principle_stale')?.metadata?.lifecycle, 'stale');
    assert.equal(byId.get('principle_archive')?.metadata?.lifecycle, 'archived');
    assert.equal(byId.get('principle_disable')?.metadata?.lifecycle, 'disabled');

    assert.equal(byId.get('principle_keep')?.updated, '2026-05-12T12:20:00.000Z');
    assert.equal(byId.get('principle_stale')?.updated, '2026-05-12T12:20:00.000Z');
    assert.equal(byId.get('principle_archive')?.updated, '2026-05-12T12:20:00.000Z');
    assert.equal(byId.get('principle_disable')?.updated, '2026-05-12T12:20:00.000Z');

    assert.equal(byId.get('principle_keep')?.metadata?.customNote, 'keep-me');
    assert.equal(byId.get('principle_keep')?.content, '修改文件后必须验证结果。');
    assert.deepEqual(byId.get('principle_keep')?.tags, ['quality']);
    assert.equal(byId.get('principle_keep')?.metadata?.activeScore, 10);
    assert.equal(byId.get('principle_keep')?.metadata?.hintCount, 10);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('importPrinciplesReviewDecisionFile rejects snapshot mismatch', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-mismatch-'));
  const registryPath = path.join(dir, 'principles-registry.json');
  const decisionPath = path.join(dir, 'review-decision.json');

  try {
    const rawRegistry = JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T12:30:00.000Z',
      principles: [],
    }, null, 2);
    await fs.writeFile(registryPath, rawRegistry, 'utf-8');
    await fs.writeFile(
      decisionPath,
      JSON.stringify({
        version: 1,
        kind: 'principles-review-decision',
        generatedAt: '2026-05-12T12:31:00.000Z',
        reviewSessionId: '2026-05-12T12-30-00Z',
        registrySnapshotHash: 'sha256:wrong',
        reviewer: 'handy',
        decisions: [],
      }, null, 2),
      'utf-8',
    );

    await assert.rejects(
      () => importPrinciplesReviewDecisionFile({
        principlesDir: dir,
        decisionFilePath: decisionPath,
        logger,
      }),
      /snapshot mismatch/i,
    );

    assert.equal(await fs.readFile(registryPath, 'utf-8'), rawRegistry);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('importPrinciplesReviewDecisionFile rejects unknown principle ids for all-or-nothing import', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-unknown-'));
  const registryPath = path.join(dir, 'principles-registry.json');
  const decisionPath = path.join(dir, 'review-decision.json');

  try {
    const rawRegistry = JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T12:40:00.000Z',
      principles: [
        {
          id: 'principle_only',
          created: '2026-05-12T12:00:00.000Z',
          tags: ['quality'],
          content: '只存在这一条。',
          metadata: {
            activeScore: 1,
            hintCount: 1,
            lifecycle: 'active',
          },
        },
      ],
    }, null, 2);
    await fs.writeFile(registryPath, rawRegistry, 'utf-8');
    await fs.writeFile(
      decisionPath,
      JSON.stringify({
        version: 1,
        kind: 'principles-review-decision',
        generatedAt: '2026-05-12T12:41:00.000Z',
        reviewSessionId: '2026-05-12T12-40-00Z',
        registrySnapshotHash: hashRaw(rawRegistry),
        reviewer: 'handy',
        decisions: [
          { id: 'principle_only', action: 'mark-stale' },
          { id: 'principle_missing', action: 'archive' },
        ],
      }, null, 2),
      'utf-8',
    );

    await assert.rejects(
      () => importPrinciplesReviewDecisionFile({
        principlesDir: dir,
        decisionFilePath: decisionPath,
        logger,
      }),
      /unknown principle ids/i,
    );

    const unchanged = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
    assert.equal(unchanged.principles[0]?.metadata?.lifecycle, 'active');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
