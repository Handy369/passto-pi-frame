import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeReflectorAssetCandidates } from '../grc-reflector-assets.ts';

test('normalizeReflectorAssetCandidates accepts valid reference/script/skill candidates', () => {
  const candidates = normalizeReflectorAssetCandidates([
    {
      type: 'reference',
      title: 'Reflector grounding checklist',
      rationale: '当前 grounding 输入与裁剪规则已稳定，适合沉淀为参考清单。',
      evidence: ['summaryCacheExcerpt 已接入。'],
      targetPath: 'references/reflector-grounding-checklist.md',
      scope: 'shared',
      notes: '先人工审阅后再决定是否落地。',
    },
    {
      type: 'script',
      title: 'Reflector regression runner',
      rationale: 'Reflector 输出契约已扩大，适合提供标准回归脚本。',
      evidence: ['test:reflector 已覆盖 grounding / diagnosis / assets。'],
      scope: 'domain',
    },
    {
      type: 'skill',
      title: 'Reflector implementation reviewer',
      rationale: '后续可把 Reflector 迭代注意事项沉淀成专用 review skill。',
      evidence: ['当前已形成多批次渐进实现方法。'],
    },
  ]);

  assert.equal(candidates.length, 3);
  assert.deepEqual(candidates.map((item) => item.type), ['reference', 'script', 'skill']);
});

test('normalizeReflectorAssetCandidates rejects invalid candidates as a whole', () => {
  const candidates = normalizeReflectorAssetCandidates([
    {
      type: 'reference',
      title: 'Safe candidate',
      rationale: '只是候选，不自动执行。',
      evidence: ['合法 evidence'],
    },
    {
      type: 'script',
      title: '立即执行脚本',
      rationale: '自动执行这个脚本来修复所有问题。',
      evidence: ['包含自动执行语义，应整体丢弃。'],
    },
  ]);

  assert.deepEqual(candidates, []);
});

test('normalizeReflectorAssetCandidates returns empty array for missing or malformed payload', () => {
  assert.deepEqual(normalizeReflectorAssetCandidates(undefined), []);
  assert.deepEqual(normalizeReflectorAssetCandidates({}), []);
  assert.deepEqual(normalizeReflectorAssetCandidates([
    {
      type: 'reference',
      title: '',
      rationale: 'missing title',
      evidence: ['bad'],
    },
  ]), []);
});
