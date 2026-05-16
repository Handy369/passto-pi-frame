import test from 'node:test';
import assert from 'node:assert/strict';

import type { PrinciplesReviewModel } from '../grc-principles-review.ts';
import { renderPrinciplesReviewHtml } from '../grc-principles-review-html.ts';

function createModel(): PrinciplesReviewModel {
  return {
    version: 1,
    kind: 'principles-review-model',
    generatedAt: '2026-05-12T12:00:00.000Z',
    reviewSessionId: '2026-05-12T12-00-00Z',
    registryPath: '/tmp/principles-registry.json',
    registrySnapshotHash: 'sha256:abc123',
    summary: {
      total: 2,
      injectable: 1,
      active: 1,
      stale: 0,
      archived: 1,
      disabled: 0,
      review: {
        staleCandidates: 0,
        pseudoCandidates: 1,
        oversizedCandidates: 0,
      },
    },
    filters: {
      supportedLifecycle: ['active', 'stale', 'archived', 'disabled'],
      supportedActions: ['keep-active', 'mark-stale', 'archive', 'disable'],
    },
    items: [
      {
        id: 'principle_active',
        created: '2026-05-12T11:00:00.000Z',
        updated: '2026-05-12T11:00:00.000Z',
        content: '修改文件后必须验证结果。',
        tags: ['quality'],
        metadata: {
          lifecycle: 'active',
          origin: 'manual',
          promoted: true,
          activeScore: 10,
          hintCount: 10,
          lastHintedAt: '2026-05-12T11:00:00.000Z',
        },
        review: {
          reasons: [],
          signals: [],
          recommendedAction: 'keep-active',
        },
      },
      {
        id: 'principle_archived',
        created: '2026-05-12T11:05:00.000Z',
        updated: '2026-05-12T11:05:00.000Z',
        content: '新增：同步文档。新增：更新 README。',
        tags: ['legacy'],
        metadata: {
          lifecycle: 'archived',
          origin: 'reflector',
          promoted: false,
          activeScore: 1,
          hintCount: 1,
          lastHintedAt: '2026-05-12T11:05:00.000Z',
        },
        review: {
          reasons: ['pseudo-candidate'],
          signals: ['multiple-新增', 'mentions-README', 'doc-sync'],
          recommendedAction: 'archive',
        },
      },
    ],
  };
}

test('renderPrinciplesReviewHtml renders embedded model and core review controls', () => {
  const html = renderPrinciplesReviewHtml(createModel());

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /Principles Review/i);
  assert.match(html, /2026-05-12T12-00-00Z/);
  assert.match(html, /sha256:abc123/);
  assert.match(html, /导出 decision JSON/);
  assert.match(html, /name="lifecycle-filter"/);
  assert.match(html, /name="query"/);
  assert.match(html, /data-role="decision-count"/);
  assert.match(html, /principle_active/);
  assert.match(html, /principle_archived/);
  assert.match(html, /keep-active/);
  assert.match(html, /mark-stale/);
  assert.match(html, /archive/);
  assert.match(html, /disable/);
  assert.match(html, /__REVIEW_MODEL__/);
  assert.match(html, /修改文件后必须验证结果/);
  assert.match(html, /origin: manual/);
  assert.match(html, /origin: reflector/);
  assert.match(html, /promoted: yes/);
  assert.match(html, /promoted: no/);
});

test('renderPrinciplesReviewHtml safely escapes dangerous content in embedded model', () => {
  const model = createModel();
  model.items[0]!.content = '</script><script>alert(1)</script>';

  const html = renderPrinciplesReviewHtml(model);

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /__REVIEW_MODEL__/);
});
