import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { buildPrinciplesReviewModel } from '../grc-principles-review.ts';

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

test('buildPrinciplesReviewModel exports summary, snapshot hash, and review recommendations', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-model-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  try {
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        version: 2,
        updatedAt: '2026-05-12T11:18:00.000Z',
        principles: [
          {
            id: 'principle_active',
            created: '2026-05-12T11:00:00.000Z',
            updated: '2026-05-12T11:00:00.000Z',
            tags: ['quality'],
            content: '修改文件后必须验证结果。',
            metadata: {
              activeScore: 10,
              hintCount: 10,
              hintTimestamps: ['2026-05-12T11:00:00.000Z'],
              lifecycle: 'active',
            },
          },
          {
            id: 'principle_stale_candidate',
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
            id: 'principle_pseudo_candidate',
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
            id: 'principle_oversized_candidate',
            created: '2026-05-12T11:03:00.000Z',
            updated: '2026-05-12T11:03:00.000Z',
            tags: ['legacy'],
            content: '这是一条超长原则。'.repeat(40),
            metadata: {
              activeScore: 2,
              hintCount: 2,
              hintTimestamps: ['2026-05-12T11:03:00.000Z'],
              lifecycle: 'active',
            },
          },
          {
            id: 'principle_archived',
            created: '2026-05-12T11:04:00.000Z',
            updated: '2026-05-12T11:04:00.000Z',
            tags: ['legacy'],
            content: '这是已归档的旧原则。',
            metadata: {
              activeScore: 1,
              hintCount: 1,
              hintTimestamps: ['2026-05-12T11:04:00.000Z'],
              lifecycle: 'archived',
            },
          },
          {
            id: 'principle_disabled',
            created: '2026-05-12T11:05:00.000Z',
            updated: '2026-05-12T11:05:00.000Z',
            tags: ['legacy'],
            content: '这是已停用的旧原则。',
            metadata: {
              activeScore: 1,
              hintCount: 1,
              hintTimestamps: ['2026-05-12T11:05:00.000Z'],
              lifecycle: 'disabled',
            },
          },
        ],
      }, null, 2),
      'utf-8',
    );

    const model = await buildPrinciplesReviewModel({
      principlesDir: dir,
      logger,
      generatedAt: '2026-05-12T11:20:30.000Z',
    });

    const normalizedRegistry = await fs.readFile(registryPath, 'utf-8');
    const expectedHash = `sha256:${createHash('sha256').update(normalizedRegistry).digest('hex')}`;

    assert.equal(model.version, 1);
    assert.equal(model.kind, 'principles-review-model');
    assert.equal(model.generatedAt, '2026-05-12T11:20:30.000Z');
    assert.equal(model.reviewSessionId, '2026-05-12T11-20-30Z');
    assert.equal(model.registryPath, registryPath);
    assert.equal(model.registrySnapshotHash, expectedHash);

    assert.deepEqual(model.summary, {
      total: 6,
      injectable: 4,
      active: 4,
      stale: 0,
      archived: 1,
      disabled: 1,
      review: {
        staleCandidates: 1,
        pseudoCandidates: 1,
        oversizedCandidates: 1,
      },
    });

    assert.deepEqual(model.filters.supportedLifecycle, ['active', 'stale', 'archived', 'disabled']);
    assert.deepEqual(model.filters.supportedActions, ['keep-active', 'mark-stale', 'archive', 'disable']);

    const itemsById = new Map(model.items.map((item) => [item.id, item]));

    assert.equal(itemsById.get('principle_active')?.review.recommendedAction, 'keep-active');
    assert.deepEqual(itemsById.get('principle_active')?.review.reasons, []);

    assert.equal(itemsById.get('principle_stale_candidate')?.review.recommendedAction, 'mark-stale');
    assert.deepEqual(itemsById.get('principle_stale_candidate')?.review.reasons, ['stale-candidate']);
    assert.deepEqual(itemsById.get('principle_stale_candidate')?.review.signals, ['mentions-RequirementLedger']);

    assert.equal(itemsById.get('principle_pseudo_candidate')?.review.recommendedAction, 'mark-stale');
    assert.deepEqual(itemsById.get('principle_pseudo_candidate')?.review.reasons, ['pseudo-candidate']);
    assert.deepEqual(itemsById.get('principle_pseudo_candidate')?.review.signals, ['multiple-新增', 'mentions-README', 'doc-sync', 'migration-note']);

    assert.equal(itemsById.get('principle_oversized_candidate')?.review.recommendedAction, 'mark-stale');
    assert.deepEqual(itemsById.get('principle_oversized_candidate')?.review.reasons, ['oversized-candidate']);
    assert.deepEqual(itemsById.get('principle_oversized_candidate')?.review.signals, ['content>280']);

    assert.equal(itemsById.get('principle_archived')?.review.recommendedAction, 'archive');
    assert.equal(itemsById.get('principle_disabled')?.review.recommendedAction, 'disable');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('buildPrinciplesReviewModel hashes normalized registry file content after load-time rewrite', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-hash-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  try {
    const rawRegistry = '{\n  "version": 2,\n  "updatedAt": "2026-05-12T11:40:00.000Z",\n  "principles": []\n}\n';
    await fs.writeFile(registryPath, rawRegistry, 'utf-8');

    const model = await buildPrinciplesReviewModel({
      principlesDir: dir,
      logger,
      generatedAt: '2026-05-12T11:41:00.000Z',
    });

    const normalizedRegistry = await fs.readFile(registryPath, 'utf-8');
    assert.equal(
      model.registrySnapshotHash,
      `sha256:${createHash('sha256').update(normalizedRegistry).digest('hex')}`,
    );
    assert.equal(model.summary.total, 0);
    assert.deepEqual(model.items, []);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
