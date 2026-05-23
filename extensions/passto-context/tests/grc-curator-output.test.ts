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
  draftGoalOp: {
    action: 'create',
    goal: {
      assertion: '补齐 draft replay proof',
      kind: 'goal',
      parentGoalId: null,
      atomicity: 'undecided',
      phase: 'plan',
    },
    reason: '当前消息引入独立新目标',
  },
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
  assert.deepEqual(parsed.draftGoalOp, {
    action: 'create',
    goal: {
      assertion: '补齐 draft replay proof',
      kind: 'goal',
      parentGoalId: null,
      atomicity: 'undecided',
      phase: 'plan',
    },
    reason: '当前消息引入独立新目标',
  });

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

test('parseCuratorOutput accepts object-first payload when markdown goal/completed sections are missing', () => {
  const raw = [
    '## 关键决策',
    '- 只有局部摘要，但结构化 payload 完整',
    '',
    '```json',
    JSON.stringify({
      signal: { type: 'continue', confidence: 0.5, evidence: 'test' },
      summaryEntry: {
        agentRound: 3,
        summary: {
          goal: '以 object-first payload 为主恢复 Curator 结果',
          completed: ['跳过 markdown 目标/已完成 gate'],
          keyDecisions: [],
          filesChanged: [],
          status: 'payload 有效',
          blockers: [],
        },
      },
    }, null, 2),
    '```',
  ].join('\n');

  const parsed = parseCuratorOutput(raw);
  assert.ok(parsed);
  assert.equal(parsed.signal?.type, 'continue');
  assert.equal(parsed.sections.goal, '以 object-first payload 为主恢复 Curator 结果');
  assert.deepEqual(parsed.sections.completed, ['跳过 markdown 目标/已完成 gate']);
  assert.ok(parsed.summaryEntry);
  assert.equal(parsed.summaryEntry?.summary.status, 'payload 有效');
});

 test('parseCuratorOutput returns null when both payload and markdown envelope are missing', () => {
  const raw = [
    '只有普通文本',
    '没有 markdown sections，也没有 json payload',
  ].join('\n');

  assert.equal(parseCuratorOutput(raw), null);
});

test('parseCuratorOutput strips truncated trailing json fence and keeps markdown summary', () => {
  const raw = [
    '## 目标',
    '验证截断 JSON 尾块容错。',
    '',
    '## 已完成',
    '- 已产出 markdown 摘要',
    '',
    '## 关键决策',
    '- 即使 JSON 尾块被截断，也应保留 markdown summary',
    '',
    '## 修改的文件',
    '- tests/grc-curator-output.test.ts: 新增截断场景测试',
    '',
    '## 当前状态',
    '结构化字段因截断无法解析。',
    '',
    '## 下一步',
    '- 提升输出稳定性',
    '',
    '## 注意事项',
    '- 尾块没有闭合 fence',
    '',
    '```json',
    '{',
    '  "signal": {',
    '    "type": "continue"',
    '  }',
  ].join('\n');

  const parsed = parseCuratorOutput(raw);
  assert.ok(parsed);
  assert.equal(parsed.sections.goal, '验证截断 JSON 尾块容错。');
  assert.equal(parsed.summary.includes('```json'), false);
  assert.equal(parsed.signal, null);
  assert.deepEqual(parsed.closureEvidence, []);
  assert.equal(parsed.summaryEntry, null);
  assert.equal(parsed.goalState, null);
  assert.equal(parsed.certaintyAssessment, null);
  assert.equal(parsed.draftDispositions, null);
});

test('parseCuratorOutput recovers structured payload when json object is complete but closing fence is missing', () => {
  const raw = [
    '## 目标',
    '验证未闭合 fence 的结构化恢复。',
    '',
    '## 已完成',
    '- markdown 与 JSON 主体都已产出',
    '',
    '## 关键决策',
    '- 若 JSON 主体完整，只缺 closing fence，也应恢复结构化字段',
    '',
    '## 修改的文件',
    '- tests/grc-curator-output.test.ts: 新增恢复场景测试',
    '',
    '## 当前状态',
    'closing fence 丢失，但 JSON 对象完整。',
    '',
    '## 下一步',
    '- 继续验证恢复逻辑',
    '',
    '## 注意事项',
    '- 只缺 closing fence，不是半截 JSON',
    '',
    '```json',
    JSON.stringify(validCuratorPayload, null, 2),
  ].join('\n');

  const parsed = parseCuratorOutput(raw);
  assert.ok(parsed);
  assert.equal(parsed.sections.goal, '验证未闭合 fence 的结构化恢复。');
  assert.ok(parsed.signal);
  assert.equal(parsed.signal?.type, 'advance');
  assert.ok(parsed.summaryEntry);
  assert.ok(parsed.goalState);
  assert.equal(parsed.goalState?.version, 1);
});

test('parseCuratorOutput supports v2 goal tree, object-first sidecars, certainty assessment, proof payload, and draft dispositions', () => {
  const payload = {
    signal: {
      type: 'continue',
      confidence: 0.82,
      evidence: '当前目标仍在继续推进',
    },
    closureEvidence: [],
    userGoalTree: {
      version: 1,
      agentRound: 20,
      updatedAt: '2026-05-20T20:00:00.000Z',
      currentFocusUserGoalId: 'root',
      rootUserGoalIds: ['root'],
      userGoals: [
        {
          id: 'root',
          parentId: null,
          assertion: 'PasstoContext V2.0 实施',
          status: 'executing',
          xNodeModelId: 'xnode-root',
          sinceRound: 18,
          lastTouchedRound: 20,
        },
      ],
    },
    xNodeModels: [
      {
        version: 1,
        userGoalId: 'root',
        agentRound: 20,
        updatedAt: '2026-05-20T20:00:00.000Z',
        currentFocusXNodeId: 'child',
        rootXNodeIds: ['root'],
        nodes: [
          {
            id: 'root',
            parentId: null,
            assertion: 'PasstoContext V2.0 实施',
            status: 'active',
            atomicity: 'composite',
            phase: 'execute',
            why: { summary: '方向已确认', confidence: 'closed' },
            what: { summary: '当前继续实现 GoalTree parser', confidence: 'closed' },
            flow: { summary: '还需补测试', confidence: 'partial' },
            structure: { summary: '对象层已明确', confidence: 'closed' },
            runtimeProof: { summary: '尚未验证实现结果', confidence: 'open' },
            sinceRound: 18,
            lastTouchedRound: 20,
            priority: 0,
            order: 0,
          },
          {
            id: 'child',
            parentId: 'root',
            assertion: '实现 GoalTree parser',
            status: 'active',
            atomicity: 'atomic',
            phase: 'testing',
            why: { summary: '方向已确认', confidence: 'closed' },
            what: { summary: '实现 GoalTree parser', confidence: 'closed' },
            flow: { summary: '还需补测试', confidence: 'partial' },
            structure: { summary: '对象层已明确', confidence: 'closed' },
            runtimeProof: { summary: '尚未验证实现结果', confidence: 'open' },
            sinceRound: 20,
            lastTouchedRound: 20,
            priority: 0,
            order: 1,
          },
        ],
        latestPolicyProjection: {
          xNodeId: 'child',
          derivedAtRound: 20,
          dimensions: {
            why: 'closed',
            what: 'closed',
            flow: 'partial',
            structure: 'closed',
            runtimeProof: 'open',
          },
          keyGaps: ['runtimeProof: 尚未验证实现结果'],
          nextStepType: 'run_tests',
          confidence: 0.78,
          guidance: ['先补测试'],
        },
      },
    ],
    lastPolicyProjection: {
      xNodeId: 'child',
      derivedAtRound: 20,
      dimensions: {
        why: 'closed',
        what: 'closed',
        flow: 'partial',
        structure: 'closed',
        runtimeProof: 'open',
      },
      keyGaps: ['runtimeProof: 尚未验证实现结果'],
      nextStepType: 'run_tests',
      confidence: 0.78,
      guidance: ['先补测试'],
    },
    certaintyAssessment: {
      dimensions: {
        why: 'closed',
        what: 'closed',
        flow: 'partial',
        structure: 'closed',
        runtimeProof: 'open',
      },
      keyGaps: ['runtimeProof: 尚未验证实现结果'],
      nextStepType: 'run_tests',
      confidence: 0.78,
    },
    latestRuntimeProof: {
      targetXNodeId: 'child',
      atRound: 20,
      resultSummary: '当前 proof 仍不完整，应优先补测试',
      proofMode: 'tests',
      proofStatus: 'partial',
      evidence: ['runtimeProof: 尚未验证实现结果'],
      verificationMethod: ['运行最小相关测试'],
    },
    latestProofSignals: [
      {
        id: 'proof-child-runtime-proof-partial',
        targetXNodeId: 'child',
        atRound: 20,
        type: 'runtime-proof-partial',
        message: '当前 proof 仍不完整，应优先补测试。',
        suggestedNextStepType: 'run_tests',
        evidence: ['runtimeProof: 尚未验证实现结果'],
      },
    ],
    auditAdvice: {
      parentAlignmentWarning: '父目标仍需等待 sibling proof 后再完成。',
      possibleGoalMisclassification: '当前输入可能只是补充验证，不应创建新目标。',
      suggestedRecovery: '下一轮主 LLM 应优先检查 latest user input 与 tool evidence 后再决定是否调整焦点。',
      advisoryOnly: true,
    },
    reconciliationOps: [
      {
        action: 'mark_reviewed',
        targetUserGoalId: 'root',
      },
      {
        action: 'update_xnode_model',
        targetUserGoalId: 'root',
        xNodeModelOps: [
          {
            action: 'patch_xnode',
            userGoalId: 'root',
            id: 'child',
            phase: 'testing',
            runtimeProof: { summary: '尚未验证实现结果', confidence: 'open' },
          },
        ],
      },
    ],
    goalState: {
      version: 2,
      agentRound: 20,
      updatedAt: '2026-05-20T20:00:00.000Z',
      rootGoalIds: ['root'],
      currentFocusGoalId: 'child',
      nodes: [
        {
          id: 'root',
          parentId: null,
          assertion: 'PasstoContext V2.0 实施',
          kind: 'goal',
          status: 'active',
          signal: 'explicit',
          atomicity: 'composite',
          phase: 'execute',
          sinceRound: 18,
          lastTouchedRound: 20,
          lastConfirmedRound: 20,
          priority: 0,
          order: 0,
        },
        {
          id: 'child',
          parentId: 'root',
          assertion: '实现 GoalTree parser',
          kind: 'subgoal',
          status: 'active',
          signal: 'draft',
          atomicity: 'atomic',
          phase: 'testing',
          sinceRound: 20,
          lastTouchedRound: 20,
          lastConfirmedRound: 20,
          priority: 0,
          order: 1,
        },
      ],
      migrations: [
        {
          id: 'm-1',
          fromGoalId: 'old',
          toGoalId: 'child',
          type: 'refine',
          atRound: 20,
          triggerSignal: 'continue',
          reason: '焦点下钻',
        },
      ],
      prunedCount: 0,
    },
  };

  const raw = [
    '## 目标',
    '实现 GoalTree parser',
    '',
    '## 已完成',
    '- 产出 v2 JSON payload',
    '',
    '## 关键决策',
    '- 引入 GoalTree 结构',
    '',
    '## 修改的文件',
    '- grc-curator-parser.ts: 增加 v2 解析',
    '',
    '## 当前状态',
    '已支持 v2 结构。',
    '',
    '## 下一步',
    '- 补测试',
    '',
    '## 注意事项',
    '- 兼容 v1',
    '',
    '```json',
    JSON.stringify(payload, null, 2),
    '```',
  ].join('\n');

  const parsed = parseCuratorOutput(raw);
  assert.ok(parsed);
  assert.ok(parsed.goalState);
  assert.equal(parsed.goalState?.version, 2);
  assert.equal((parsed.goalState as { currentFocusGoalId?: string }).currentFocusGoalId, 'child');
  assert.equal(parsed.userGoalTree?.currentFocusUserGoalId, 'root');
  assert.equal(parsed.xNodeModels?.[0]?.currentFocusXNodeId, 'child');
  assert.equal(parsed.lastPolicyProjection?.xNodeId, 'child');
  assert.equal(parsed.lastPolicyProjection?.nextStepType, 'run_tests');
  assert.equal(parsed.certaintyAssessment?.dimensions.runtimeProof, 'open');
  assert.equal(parsed.certaintyAssessment?.nextStepType, 'run_tests');
  assert.equal(parsed.latestRuntimeProof?.targetXNodeId, 'child');
  assert.equal(parsed.latestRuntimeProof?.proofStatus, 'partial');
  assert.equal(parsed.latestProofSignals?.[0]?.type, 'runtime-proof-partial');
  assert.equal(parsed.auditAdvice?.advisoryOnly, true);
  assert.equal(parsed.auditAdvice?.parentAlignmentWarning, '父目标仍需等待 sibling proof 后再完成。');
  assert.equal(parsed.auditAdvice?.possibleGoalMisclassification, '当前输入可能只是补充验证，不应创建新目标。');
  assert.match(parsed.auditAdvice?.suggestedRecovery ?? '', /latest user input 与 tool evidence/);
  assert.equal(parsed.reconciliationOps?.[0]?.action, 'mark_reviewed');
  assert.equal(parsed.reconciliationOps?.[1]?.action, 'update_xnode_model');
  assert.equal(parsed.draftDispositions, null);
});
