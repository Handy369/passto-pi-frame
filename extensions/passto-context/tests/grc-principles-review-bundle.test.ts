import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { exportPrinciplesReviewBundle, importPrinciplesReviewDecisionFile } from '../grc-principles-review.ts';

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

test('exportPrinciplesReviewBundle writes review-model.json and review.html to default reviews dir', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-bundle-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  try {
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        version: 2,
        updatedAt: '2026-05-12T13:00:00.000Z',
        principles: [
          {
            id: 'principle_active',
            created: '2026-05-12T12:00:00.000Z',
            updated: '2026-05-12T12:00:00.000Z',
            tags: ['quality'],
            content: '修改文件后必须验证结果。',
            metadata: {
              activeScore: 5,
              hintCount: 5,
              hintTimestamps: ['2026-05-12T12:00:00.000Z'],
              lifecycle: 'active',
            },
          },
        ],
      }, null, 2),
      'utf-8',
    );

    const result = await exportPrinciplesReviewBundle({
      principlesDir: dir,
      logger,
      generatedAt: '2026-05-12T13:20:30.000Z',
    });

    assert.equal(result.outputDir, path.join(dir, 'reviews', '2026-05-12T13-20-30Z'));
    assert.equal(result.reviewModelPath, path.join(result.outputDir, 'review-model.json'));
    assert.equal(result.reviewHtmlPath, path.join(result.outputDir, 'review.html'));
    assert.equal(result.reviewSessionId, '2026-05-12T13-20-30Z');

    const model = JSON.parse(await fs.readFile(result.reviewModelPath, 'utf-8'));
    assert.equal(model.kind, 'principles-review-model');
    assert.equal(model.summary.total, 1);

    const html = await fs.readFile(result.reviewHtmlPath, 'utf-8');
    assert.match(html, /Principles Review/);
    assert.match(html, /__REVIEW_MODEL__/);
    assert.match(html, /修改文件后必须验证结果/);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('exportPrinciplesReviewBundle respects explicit output dir', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-bundle-explicit-'));
  const registryPath = path.join(dir, 'principles-registry.json');
  const outputDir = path.join(dir, 'custom-review-output');

  try {
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        version: 2,
        updatedAt: '2026-05-12T13:30:00.000Z',
        principles: [],
      }, null, 2),
      'utf-8',
    );

    const result = await exportPrinciplesReviewBundle({
      principlesDir: dir,
      outputDir,
      logger,
      generatedAt: '2026-05-12T13:31:00.000Z',
    });

    assert.equal(result.outputDir, outputDir);
    assert.equal(JSON.parse(await fs.readFile(result.reviewModelPath, 'utf-8')).summary.total, 0);
    assert.equal(typeof await fs.readFile(result.reviewHtmlPath, 'utf-8'), 'string');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('exportPrinciplesReviewBundle snapshot stays importable after load-time registry normalization', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-bundle-roundtrip-'));
  const registryPath = path.join(dir, 'principles-registry.json');
  const outputDir = path.join(dir, 'review-output');
  const decisionPath = path.join(dir, 'review-decision.json');

  try {
    await fs.writeFile(
      registryPath,
      JSON.stringify({
        version: 2,
        updatedAt: '2026-05-12T13:40:00.000Z',
        principles: [
          {
            id: 'principle_stale',
            created: '2026-05-12T13:00:00.000Z',
            updated: '2026-05-12T13:00:00.000Z',
            tags: ['legacy'],
            content: '引用 RequirementLedger 的旧原则应停止注入。',
            metadata: {
              activeScore: 4,
              hintCount: 4,
              hintTimestamps: ['2026-05-12T13:00:00.000Z'],
              lifecycle: 'active',
            },
          },
        ],
      }, null, 2),
      'utf-8',
    );

    const exportResult = await exportPrinciplesReviewBundle({
      principlesDir: dir,
      outputDir,
      logger,
      generatedAt: '2026-05-12T13:41:00.000Z',
    });

    const model = JSON.parse(await fs.readFile(exportResult.reviewModelPath, 'utf-8'));
    await fs.writeFile(
      decisionPath,
      JSON.stringify({
        version: 1,
        kind: 'principles-review-decision',
        generatedAt: '2026-05-12T13:42:00.000Z',
        reviewSessionId: model.reviewSessionId,
        registrySnapshotHash: model.registrySnapshotHash,
        reviewer: 'roundtrip-test',
        decisions: [
          { id: 'principle_stale', action: 'mark-stale', note: 'roundtrip import should succeed' },
        ],
      }, null, 2),
      'utf-8',
    );

    const result = await importPrinciplesReviewDecisionFile({
      principlesDir: dir,
      decisionFilePath: decisionPath,
      logger,
      appliedAt: '2026-05-12T13:43:00.000Z',
    });

    assert.equal(result.updated, 1);
    const rewritten = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
    assert.equal(rewritten.principles[0]?.metadata?.lifecycle, 'stale');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
