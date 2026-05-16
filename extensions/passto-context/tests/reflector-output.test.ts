import test from 'node:test';
import assert from 'node:assert/strict';

import { parseReflectorOutput } from '../grc-subagent.ts';

test('parseReflectorOutput supports legacy v1 reflector format', () => {
  const raw = [
    '## 方向评估',
    '当前工作仍围绕目标推进。',
    '',
    '## 盲点',
    '- 无',
    '',
    '## 风险',
    '- 配置边界尚未覆盖测试。',
    '',
    '## 建议',
    '- 在 grc-subagent.ts 增加解析回归测试，避免格式漂移。',
    '',
    '```json',
    '{',
    '  "principleOps": [',
    '    { "op": "reuse", "targetId": "principle_reflector_parse" }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.equal(result.diagnosis ?? null, null);
  assert.deepEqual(result.assetCandidates ?? [], []);
  assert.equal(result.sections.direction, '当前工作仍围绕目标推进。');
  assert.deepEqual(result.sections.risks, ['配置边界尚未覆盖测试。']);
  assert.deepEqual(result.sections.suggestions, ['在 grc-subagent.ts 增加解析回归测试，避免格式漂移。']);
  assert.equal(result.hasSubstantiveContent, true);
  assert.deepEqual(result.principleOps, [{ op: 'reuse', targetId: 'principle_reflector_parse' }]);
});

test('parseReflectorOutput prefers structured diagnosis from v2 reflector format', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行总体对齐当前目标链，因为改动集中在 Reflector 的 prompt 与 parser。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 优先保持 advice + principleOps 兼容链不变。',
    '',
    '## 原则判断',
    '- 可复用既有“兼容优先”原则。',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{',
    '  "diagnosis": {',
    '    "aligned": true,',
    '    "driftSource": "none",',
    '    "confidence": 0.86,',
    '    "evidence": [',
    '      "改动仅涉及 Reflector prompt、types 与 parser。",',
    '      "未修改 GoalState 写入链。"',
    '    ],',
    '    "explanation": "本轮工作聚焦于 Batch 1 兼容升级。"',
    '  },',
    '  "principleOps": [',
    '    { "op": "hit", "targetId": "principle_batch_compat" }',
    '  ],',
    '  "assetCandidates": [',
    '    {',
    '      "type": "reference",',
    '      "title": "Reflector Batch compatibility guide",',
    '      "rationale": "当前实现已形成稳定的兼容升级路径，可沉淀为参考文档候选。",',
    '      "evidence": ["prompt 与 parser 已保持兼容演进。"],',
    '      "targetPath": "references/reflector-batch-compatibility.md",',
    '      "scope": "shared",',
    '      "notes": "先人工审阅。"',
    '    }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.ok(result.diagnosis);
  assert.deepEqual(result.diagnosis, {
    aligned: true,
    driftSource: 'none',
    confidence: 0.86,
    evidence: ['改动仅涉及 Reflector prompt、types 与 parser。', '未修改 GoalState 写入链。'],
    explanation: '本轮工作聚焦于 Batch 1 兼容升级。',
  });
  assert.deepEqual(result.principleOps, [{ op: 'hit', targetId: 'principle_batch_compat' }]);
  assert.deepEqual(result.assetCandidates, [
    {
      type: 'reference',
      title: 'Reflector Batch compatibility guide',
      rationale: '当前实现已形成稳定的兼容升级路径，可沉淀为参考文档候选。',
      evidence: ['prompt 与 parser 已保持兼容演进。'],
      targetPath: 'references/reflector-batch-compatibility.md',
      scope: 'shared',
      notes: '先人工审阅。',
    },
  ]);
  assert.equal(result.hasSubstantiveContent, true);
  assert.deepEqual(result.sections.suggestions, ['优先保持 advice + principleOps 兼容链不变。']);
});

test('parseReflectorOutput falls back when trailing json is invalid', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 继续保持 parser 的兼容回退。',
    '',
    '## 原则判断',
    '无',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{ "diagnosis": { "aligned": true, "driftSource": "none", } }',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.equal(result.diagnosis ?? null, null);
  assert.deepEqual(result.principleOps, []);
  assert.equal(result.hasSubstantiveContent, true);
  assert.match(result.advice, /继续保持 parser 的兼容回退/);
});

test('parseReflectorOutput supports expand op in structured reflector format', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 命中旧原则后再扩写。',
    '',
    '## 原则判断',
    '- 现有原则需要更完整表达。',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{',
    '  "principleOps": [',
    '    { "op": "expand", "targetId": "principle_expand_me", "content": "先验证真实工具结果，再下结论。", "tags": ["verification"] }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.deepEqual(result.principleOps, [
    { op: 'expand', targetId: 'principle_expand_me', content: '先验证真实工具结果，再下结论。', tags: ['verification'] },
  ]);
});

test('parseReflectorOutput rejects append-style expand content', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 不要把新约束补丁式追加到旧原则尾部。',
    '',
    '## 原则判断',
    '- 这条 expand 应被拒绝。',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{',
    '  "principleOps": [',
    '    { "op": "expand", "targetId": "principle_expand_me", "content": "先验证真实工具结果，再下结论。新增：输出前检查路径是否存在。", "tags": ["verification"] }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.deepEqual(result.principleOps, []);
});

test('parseReflectorOutput rejects create content with scene-specific names', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 这类带专名的经验应转去 assetCandidates。',
    '',
    '## 原则判断',
    '- 这条 create 应被拒绝。',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{',
    '  "principleOps": [',
    '    { "op": "create", "content": "修改 before-agent-start-event.ts 时应优先核对 ReflectorAPI 的事件名再继续。", "tags": ["verification"] }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.deepEqual(result.principleOps, []);
});

test('parseReflectorOutput keeps generic create content without scene-specific names', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 只保留跨任务复用的泛化约束。',
    '',
    '## 原则判断',
    '- 这条 create 可以保留。',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{',
    '  "principleOps": [',
    '    { "op": "create", "content": "在把局部经验上升为长期规则前，先验证它是否脱离特定场景仍成立。", "tags": ["generalization"] }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.deepEqual(result.principleOps, [
    { op: 'create', content: '在把局部经验上升为长期规则前，先验证它是否脱离特定场景仍成立。', tags: ['generalization'] },
  ]);
});

test('parseReflectorOutput ignores invalid diagnosis schema but keeps valid principleOps', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 当前判断证据较弱。',
    '',
    '## 顾问意见',
    '- 为 diagnosis 增加 schema 校验测试。',
    '',
    '## 原则判断',
    '- 可复用测试优先原则。',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{',
    '  "diagnosis": {',
    '    "aligned": true,',
    '    "driftSource": "unknown",',
    '    "confidence": 1.2,',
    '    "evidence": []',
    '  },',
    '  "principleOps": [',
    '    { "op": "reuse", "targetId": "principle_test_first" }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.equal(result.diagnosis ?? null, null);
  assert.deepEqual(result.principleOps, [{ op: 'reuse', targetId: 'principle_test_first' }]);
  assert.deepEqual(result.assetCandidates ?? [], []);
  assert.equal(result.hasSubstantiveContent, true);
});

test('parseReflectorOutput drops invalid assetCandidates without affecting diagnosis or principleOps', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 保持候选为非执行语义。',
    '',
    '## 原则判断',
    '- 复用审慎落地原则。',
    '',
    '## 能力沉淀候选',
    '- 可考虑沉淀候选，但先人工审阅。',
    '',
    '```json',
    '{',
    '  "diagnosis": {',
    '    "aligned": true,',
    '    "driftSource": "none",',
    '    "confidence": 0.81,',
    '    "evidence": ["当前只是做 schema 引入。"]',
    '  },',
    '  "principleOps": [',
    '    { "op": "reuse", "targetId": "principle_review_before_execute" }',
    '  ],',
    '  "assetCandidates": [',
    '    {',
    '      "type": "script",',
    '      "title": "立即执行修复脚本",',
    '      "rationale": "自动执行这个脚本。",',
    '      "evidence": ["这会违反非执行语义约束。"]',
    '    }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.deepEqual(result.diagnosis, {
    aligned: true,
    driftSource: 'none',
    confidence: 0.81,
    evidence: ['当前只是做 schema 引入。'],
  });
  assert.deepEqual(result.principleOps, [{ op: 'reuse', targetId: 'principle_review_before_execute' }]);
  assert.deepEqual(result.assetCandidates ?? [], []);
});

test('parseReflectorOutput rejects skill assetCandidates and keeps diagnosis/principleOps', () => {
  const raw = [
    '## 目标对齐判断',
    '当前执行基本对齐。',
    '',
    '## 偏移归因',
    '- 无明显偏移。',
    '',
    '## 顾问意见',
    '- 保持能力沉淀与 Reflector 解耦。',
    '',
    '## 原则判断',
    '- 复用职责单一原则。',
    '',
    '## 能力沉淀候选',
    '无',
    '',
    '```json',
    '{',
    '  "diagnosis": {',
    '    "aligned": true,',
    '    "driftSource": "none",',
    '    "confidence": 0.88,',
    '    "evidence": ["skill 候选已不再属于 Reflector 职责。"]',
    '  },',
    '  "principleOps": [',
    '    { "op": "reuse", "targetId": "principle_single_responsibility" }',
    '  ],',
    '  "assetCandidates": [',
    '    {',
    '      "type": "skill",',
    '      "title": "Reflector skill candidate",',
    '      "rationale": "这个类型现在应被拒绝。",',
    '      "evidence": ["skill 沉淀要移到单独模块。"]',
    '    }',
    '  ]',
    '}',
    '```',
  ].join('\n');

  const result = parseReflectorOutput(raw);
  assert.ok(result);
  assert.deepEqual(result.diagnosis, {
    aligned: true,
    driftSource: 'none',
    confidence: 0.88,
    evidence: ['skill 候选已不再属于 Reflector 职责。'],
  });
  assert.deepEqual(result.principleOps, [{ op: 'reuse', targetId: 'principle_single_responsibility' }]);
  assert.deepEqual(result.assetCandidates ?? [], []);
});
