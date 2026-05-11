import test from 'node:test';
import assert from 'node:assert/strict';

import { parseCuratorOutput } from '../grc-curator-parser.ts';

const validCuratorPayload = {
  signal: {
    type: 'advance',
    confidence: 0.93,
    evidence: '用户明确要求继续补强 Curator 输出解析与 restore replay 覆盖。',
  },
  closureEvidence: [],
  summaryEntry: {
    agentRound: 16,
    summary: {
      goal: '补强 Curator 输出解析与恢复链路。',
      completed: [
        '新增 superseded / withdrawn 场景',
        '新增 multi-goal 场景',
        '新增 restore replay round-trip 验证',
      ],
      keyDecisions: [
        'GoalStateDocument + SummaryEntry 作为 Curator 主输出',
        '不再保留旧 ledger / snapshot 主路径',
      ],
      filesChanged: [
        { path: 'tests/grc-curator-output.test.ts', action: 'write' },
        { path: 'grc-subagent.ts', action: 'read' },
        { path: 'grc-restore.ts', action: 'read' },
      ],
      status: 'Curator parse / restore 路径已具备回归覆盖。',
      blockers: ['后续仍需补 index restore/replay 集成测试'],
    },
    sessionPointers: {
      searchQuery: 'Curator restore parseCuratorOutput',
    },
  },
  goalState: {
    version: 1,
    agentRound: 16,
    updatedAt: '2026-05-09T00:00:16.000Z',
    active: [
      {
        id: 'goal-ledger-tests',
        assertion: '补强 Curator 输出解析测试',
        status: 'active',
        sinceRound: 15,
        lastConfirmedRound: 16,
        signal: 'explicit',
      },
    ],
    completed: [
      {
        id: 'goal-doc-sync',
        assertion: '同步 Curator 主路径文档描述',
        completedAtRound: 15,
      },
    ],
    migrations: [
      {
        from: '清理旧 heuristic snapshot 文档',
        to: '补强 ledger 测试覆盖',
        atRound: 16,
        reason: '用户同意继续补强 Curator 主路径回归测试。',
      },
    ],
    prunedCount: 0,
  },
};

test('parseCuratorOutput extracts summary sections and structured payload', () => {
  const markdown = [
    '## 目标',
    '补强 Curator 输出解析与恢复链路。',
    '',
    '## 已完成',
    '- 新增 superseded / withdrawn 场景',
    '- 新增 multi-goal 场景',
    '- 新增 restore replay round-trip 验证',
    '',
    '## 关键决策',
    '- GoalStateDocument + SummaryEntry 作为主输出 → 与当前架构对齐',
    '- 不再保留旧 ledger / snapshot 主路径 → 降低状态复杂度',
    '',
    '## 修改的文件',
    '- tests/grc-curator-output.test.ts: 新增回归测试',
    '- grc-subagent.ts: 保持 Curator payload 解析逻辑',
    '',
    '## 当前状态',
    'Curator parse / restore 路径已具备回归覆盖。',
    '',
    '## 下一步',
    '- 补充 Curator 输出解析测试',
    '- 继续做 index restore/replay 集成测试',
    '',
    '## 注意事项',
    '- version 版本校验需与持久化逻辑同步',
  ].join('\n');

  const raw = `${markdown}\n\n\
\
\
\
\
\
\
\
\
\
${'```json'}\n${JSON.stringify(validCuratorPayload, null, 2)}\n\
${'```'}`;

  const parsed = parseCuratorOutput(raw);
  assert.ok(parsed);
  assert.match(parsed.summary, /## 目标/);
  assert.equal(parsed.sections.goal, '补强 Curator 输出解析与恢复链路。');
  assert.deepEqual(parsed.sections.completed, [
    '新增 superseded / withdrawn 场景',
    '新增 multi-goal 场景',
    '新增 restore replay round-trip 验证',
  ]);
  assert.deepEqual(parsed.sections.nextSteps, [
    '补充 Curator 输出解析测试',
    '继续做 index restore/replay 集成测试',
  ]);

  assert.ok(parsed.signal);
  assert.equal(parsed.signal.type, 'advance');
  assert.equal(parsed.signal.confidence, 0.93);

  assert.deepEqual(parsed.closureEvidence, []);

  assert.ok(parsed.summaryEntry);
  assert.equal(parsed.summaryEntry.agentRound, 16);
  assert.equal(parsed.summaryEntry.summary.goal, '补强 Curator 输出解析与恢复链路。');
  assert.deepEqual(parsed.summaryEntry.summary.filesChanged, [
    { path: 'tests/grc-curator-output.test.ts', action: 'write' },
    { path: 'grc-subagent.ts', action: 'read' },
    { path: 'grc-restore.ts', action: 'read' },
  ]);
  assert.equal(parsed.summaryEntry.sessionPointers?.searchQuery, 'Curator restore parseCuratorOutput');

  assert.ok(parsed.goalState);
  assert.equal(parsed.goalState.version, 1);
  assert.equal(parsed.goalState.agentRound, 16);
  assert.equal(parsed.goalState.active.length, 1);
  assert.equal(parsed.goalState.active[0].assertion, '补强 Curator 输出解析测试');
  assert.equal(parsed.goalState.completed[0].id, 'goal-doc-sync');
  assert.equal(parsed.goalState.migrations[0].to, '补强 ledger 测试覆盖');

  assert.equal((parsed as { requirementLedger?: unknown }).requirementLedger, undefined);
});

test('parseCuratorOutput tolerates invalid structured payload by keeping markdown summary', () => {
  const raw = [
    '## 目标',
    '验证 Curator 输出解析的容错行为。',
    '',
    '## 已完成',
    '- 构造非法 JSON payload',
    '',
    '## 关键决策',
    '- 结构化 payload 无法解析时仍保留 markdown summary',
    '',
    '## 修改的文件',
    '- tests/grc-curator-output.test.ts: 新增解析测试',
    '',
    '## 当前状态',
    '已验证 markdown section extract 不依赖 payload 成功。',
    '',
    '## 下一步',
    '- 增加更多字段缺失场景',
    '',
    '## 注意事项',
    '- 最后的 JSON 必须合法，否则结构化字段会回退为 null',
    '',
    '```json',
    '{ invalid json }',
    '```',
  ].join('\n');

  const parsed = parseCuratorOutput(raw);
  assert.ok(parsed);
  assert.equal(parsed.sections.goal, '验证 Curator 输出解析的容错行为。');
  assert.deepEqual(parsed.sections.completed, ['构造非法 JSON payload']);
  assert.equal(parsed.signal, null);
  assert.deepEqual(parsed.closureEvidence, []);
  assert.equal(parsed.summaryEntry, null);
  assert.equal(parsed.goalState, null);
  assert.equal((parsed as { requirementLedger?: unknown }).requirementLedger, undefined);
});

test('parseCuratorOutput returns null when required markdown sections are missing', () => {
  const raw = [
    '## 关键决策',
    '- 只有局部输出，没有目标和已完成',
    '',
    '```json',
    JSON.stringify({ signal: { type: 'continue', confidence: 0.5, evidence: 'test' } }, null, 2),
    '```',
  ].join('\n');

  assert.equal(parseCuratorOutput(raw), null);
});
