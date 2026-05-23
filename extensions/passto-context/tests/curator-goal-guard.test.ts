import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDraftDispositionsToGoalState, getCuratorGoalStateRejectionReasons, reconcileCuratorGoalState } from '../grc-curator-guard.ts';
import type { CuratorResult, GoalStateDocument, GoalTreeDocument, UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

const previousGoalState: GoalStateDocument = {
  version: 1,
  agentRound: 1,
  updatedAt: '2026-05-10T00:00:00.000Z',
  active: [
    {
      id: 'goal-1',
      assertion: '持续按固定格式回复，直到收到 STOP',
      status: 'active',
      sinceRound: 1,
      lastConfirmedRound: 1,
      signal: 'explicit',
    },
  ],
  completed: [],
  migrations: [],
  prunedCount: 0,
};

test('getCuratorGoalStateRejectionReasons returns existing-active-cleared-without-closure when old active is dropped without closure evidence', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续处理当前长期规则\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.8, evidence: '当前消息不足以关闭旧目标' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续处理当前长期规则',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  assert.deepEqual(getCuratorGoalStateRejectionReasons(previousGoalState, result), ['existing-active-cleared-without-closure']);
});

test('reconcileCuratorGoalState rejects structured payload when previous active exists but new active becomes empty without closure evidence', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续处理当前长期规则\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.8, evidence: '当前消息不足以关闭旧目标' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续处理当前长期规则',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const reconciled = reconcileCuratorGoalState(previousGoalState, result);
  assert.equal(reconciled?.summaryEntry, null);
  assert.equal(reconciled?.goalState, null);
  assert.equal(reconciled?.signal, null);
});

test('reconcileCuratorGoalState allows clearing active goals when closure evidence exists', () => {
  const result: CuratorResult = {
    summary: '## 目标\n结束长期规则\n\n## 已完成\n- 用户明确说 STOP',
    signal: { type: 'correct', confidence: 0.95, evidence: '用户明确说 STOP' },
    closureEvidence: ['用户明确说 STOP'],
    summaryEntry: null,
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [
        {
          id: 'goal-1',
          assertion: '持续按固定格式回复，直到收到 STOP',
          completedAtRound: 2,
        },
      ],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '结束长期规则',
      completed: ['用户明确说 STOP'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const reconciled = reconcileCuratorGoalState(previousGoalState, result);
  assert.equal(reconciled?.goalState?.active.length, 0);
  assert.equal(reconciled?.goalState?.completed[0]?.completedAtRound, 2);
});

test('getCuratorGoalStateRejectionReasons returns summary-goal-without-active when summary goal is non-empty but active goals are empty', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续补强 Curator 契约\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.76, evidence: '用户仍在当前目标链上推进' },
    closureEvidence: [],
    summaryEntry: {
      agentRound: 2,
      timestamp: '2026-05-10T00:01:00.000Z',
      summary: {
        goal: '继续补强 Curator 契约',
        completed: [],
        keyDecisions: [],
        filesChanged: [],
        status: '当前目标仍在继续。',
        blockers: [],
      },
    },
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续补强 Curator 契约',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  assert.deepEqual(getCuratorGoalStateRejectionReasons(null, result), ['summary-goal-without-active']);
});

test('reconcileCuratorGoalState rejects structured payload when summary goal exists but active goals are empty without closure evidence', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续补强 Curator 契约\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.76, evidence: '用户仍在当前目标链上推进' },
    closureEvidence: [],
    summaryEntry: {
      agentRound: 2,
      timestamp: '2026-05-10T00:01:00.000Z',
      summary: {
        goal: '继续补强 Curator 契约',
        completed: [],
        keyDecisions: [],
        filesChanged: [],
        status: '当前目标仍在继续。',
        blockers: [],
      },
    },
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续补强 Curator 契约',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const reconciled = reconcileCuratorGoalState(null, result);
  assert.equal(reconciled?.summaryEntry, null);
  assert.equal(reconciled?.goalState, null);
  assert.equal(reconciled?.signal, null);
});

test('applyDraftDispositionsToGoalState supports subtree rewrite and focus update', () => {
  const goalState: GoalTreeDocument = {
    version: 2,
    agentRound: 11,
    updatedAt: '2026-05-20T11:00:00.000Z',
    rootGoalIds: ['draft-root'],
    currentFocusGoalId: 'draft-child-1',
    nodes: [
      {
        id: 'draft-root',
        parentId: null,
        assertion: '错误目标解释',
        kind: 'goal',
        status: 'active',
        signal: 'draft',
        atomicity: 'composite',
        phase: 'execute',
        sinceRound: 11,
        lastTouchedRound: 11,
        lastConfirmedRound: 11,
        priority: 0,
        order: 0,
      },
      {
        id: 'draft-child-1',
        parentId: 'draft-root',
        assertion: '旧子任务',
        kind: 'subgoal',
        status: 'active',
        signal: 'inferred',
        atomicity: 'atomic',
        phase: 'execute',
        sinceRound: 11,
        lastTouchedRound: 11,
        lastConfirmedRound: 11,
        priority: 0,
        order: 0,
      },
      {
        id: 'draft-child-2',
        parentId: 'draft-root',
        assertion: '应删除子任务',
        kind: 'subgoal',
        status: 'active',
        signal: 'inferred',
        atomicity: 'atomic',
        phase: 'testing',
        sinceRound: 11,
        lastTouchedRound: 11,
        lastConfirmedRound: 11,
        priority: 0,
        order: 1,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const next = applyDraftDispositionsToGoalState(goalState, [
    {
      goalId: 'draft-root',
      action: 'revise-draft',
      revisedAssertion: '修正后的目标解释',
      subtreeDisposition: 'rewrite-subtree',
      nodeEdits: [
        {
          goalId: 'draft-child-1',
          action: 'update',
          newAssertion: '修正后子任务',
          newPhase: 'plan',
          newAtomicity: 'composite',
        },
        {
          goalId: 'draft-child-2',
          action: 'remove',
        },
      ],
      newCurrentFocusGoalId: 'draft-root',
      evidence: '用户下一轮指出上一轮目标理解错误',
    },
  ]) as GoalTreeDocument;

  assert.equal(next.nodes.find((node) => node.id === 'draft-root')?.assertion, '修正后的目标解释');
  assert.equal(next.nodes.find((node) => node.id === 'draft-root')?.signal, 'inferred');
  assert.equal(next.nodes.find((node) => node.id === 'draft-child-1')?.assertion, '修正后子任务');
  assert.equal(next.nodes.find((node) => node.id === 'draft-child-1')?.phase, 'plan');
  assert.equal(next.nodes.find((node) => node.id === 'draft-child-1')?.atomicity, 'composite');
  assert.equal(next.nodes.some((node) => node.id === 'draft-child-2'), false);
  assert.equal(next.currentFocusGoalId, 'draft-root');
});

test('getCuratorGoalStateRejectionReasons rejects phase regression without evidence for goal tree', () => {
  const previous: GoalTreeDocument = {
    version: 2,
    agentRound: 10,
    updatedAt: '2026-05-20T10:00:00.000Z',
    rootGoalIds: ['goal-1'],
    currentFocusGoalId: 'goal-1',
    nodes: [
      {
        id: 'goal-1',
        parentId: null,
        assertion: '实现 GoalTree',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'atomic',
        phase: 'testing',
        sinceRound: 10,
        lastTouchedRound: 10,
        lastConfirmedRound: 10,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const next: GoalTreeDocument = {
    ...previous,
    agentRound: 11,
    nodes: [{ ...previous.nodes[0], phase: 'plan_insufficient', lastConfirmedRound: 11 }],
  };

  const result: CuratorResult = {
    summary: '## 目标\n实现 GoalTree\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.6, evidence: '无足够证据' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: next,
    sections: { goal: '实现 GoalTree', completed: ['无'], decisions: [], files: [], status: '', nextSteps: [], warnings: [] },
  };

  assert.deepEqual(getCuratorGoalStateRejectionReasons(previous, result), ['phase-regression-without-evidence']);
});

test('getCuratorGoalStateRejectionReasons rejects atomicity flip without evidence for goal tree', () => {
  const previous: GoalTreeDocument = {
    version: 2,
    agentRound: 10,
    updatedAt: '2026-05-20T10:00:00.000Z',
    rootGoalIds: ['goal-1'],
    currentFocusGoalId: 'goal-1',
    nodes: [
      {
        id: 'goal-1',
        parentId: null,
        assertion: '实现 GoalTree',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'atomic',
        phase: 'execute',
        sinceRound: 10,
        lastTouchedRound: 10,
        lastConfirmedRound: 10,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const next: GoalTreeDocument = {
    ...previous,
    agentRound: 11,
    nodes: [{ ...previous.nodes[0], atomicity: 'composite', lastConfirmedRound: 11 }],
  };

  const result: CuratorResult = {
    summary: '## 目标\n实现 GoalTree\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.6, evidence: '无足够证据' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: next,
    sections: { goal: '实现 GoalTree', completed: ['无'], decisions: [], files: [], status: '', nextSteps: [], warnings: [] },
  };

  assert.deepEqual(getCuratorGoalStateRejectionReasons(previous, result), ['atomicity-flip-without-evidence']);
});

test('reconcileCuratorGoalState confirms draft node by upgrading signal in goal tree', () => {
  const previous: GoalTreeDocument = {
    version: 2,
    agentRound: 10,
    updatedAt: '2026-05-20T10:00:00.000Z',
    rootGoalIds: ['draft-1'],
    currentFocusGoalId: 'draft-1',
    nodes: [
      {
        id: 'draft-1',
        parentId: null,
        assertion: '可能需要补 P4 apply 逻辑',
        kind: 'goal',
        status: 'active',
        signal: 'draft',
        atomicity: 'atomic',
        phase: 'plan',
        sinceRound: 10,
        lastTouchedRound: 10,
        lastConfirmedRound: 10,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const result: CuratorResult = {
    summary: '## 目标\n补 P4 apply 逻辑\n\n## 已完成\n- 确认 draft 方向成立',
    signal: { type: 'confirm-draft', confidence: 0.88, evidence: '后续工作继续围绕该目标推进' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: previous,
    draftDispositions: [
      { goalId: 'draft-1', action: 'confirm-draft', evidence: '后续工作继续围绕该目标推进' },
    ],
    sections: { goal: '补 P4 apply 逻辑', completed: ['确认 draft 方向成立'], decisions: [], files: [], status: '', nextSteps: [], warnings: [] },
  };

  const reconciled = reconcileCuratorGoalState(previous, result);
  assert.equal((reconciled?.goalState as GoalTreeDocument).nodes[0]?.signal, 'inferred');
  assert.equal((reconciled?.goalState as GoalTreeDocument).nodes[0]?.assertion, '可能需要补 P4 apply 逻辑');
});

test('reconcileCuratorGoalState revises draft node assertion and upgrades signal in goal tree', () => {
  const previous: GoalTreeDocument = {
    version: 2,
    agentRound: 10,
    updatedAt: '2026-05-20T10:00:00.000Z',
    rootGoalIds: ['draft-1'],
    currentFocusGoalId: 'draft-1',
    nodes: [
      {
        id: 'draft-1',
        parentId: null,
        assertion: '可能需要补 P4 apply 逻辑',
        kind: 'goal',
        status: 'active',
        signal: 'draft',
        atomicity: 'atomic',
        phase: 'plan',
        sinceRound: 10,
        lastTouchedRound: 10,
        lastConfirmedRound: 10,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const next: GoalTreeDocument = {
    ...previous,
    updatedAt: '2026-05-20T10:01:00.000Z',
  };

  const result: CuratorResult = {
    summary: '## 目标\n补 P4 draft disposition apply\n\n## 已完成\n- 修正 draft assertion',
    signal: { type: 'revise-draft', confidence: 0.86, evidence: '需要把范围收敛到 draft disposition apply' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: next,
    draftDispositions: [
      { goalId: 'draft-1', action: 'revise-draft', revisedAssertion: '补 P4 draft disposition apply', evidence: '需要把范围收敛到 draft disposition apply' },
    ],
    sections: { goal: '补 P4 draft disposition apply', completed: ['修正 draft assertion'], decisions: [], files: [], status: '', nextSteps: [], warnings: [] },
  };

  const reconciled = reconcileCuratorGoalState(previous, result);
  assert.equal((reconciled?.goalState as GoalTreeDocument).nodes[0]?.signal, 'inferred');
  assert.equal((reconciled?.goalState as GoalTreeDocument).nodes[0]?.assertion, '补 P4 draft disposition apply');
});

test('reconcileCuratorGoalState applies reconciliationOps to any generator-projected user goal', () => {
  const userGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 4,
    updatedAt: '2026-05-22T10:00:00.000Z',
    currentFocusUserGoalId: 'goal-r1',
    rootUserGoalIds: ['goal-r1'],
    userGoals: [
      {
        id: 'goal-r1',
        parentId: null,
        assertion: '旧 assertion',
        status: 'planning',
        executionState: 'planning',
        reviewState: 'generator_projected',
        relationState: 'active',
        xNodeModelId: 'xnode-goal-r1',
        sinceRound: 4,
        lastTouchedRound: 4,
      },
    ],
  };
  const xNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-r1',
      agentRound: 4,
      updatedAt: '2026-05-22T10:00:00.000Z',
      currentFocusXNodeId: 'goal-r1',
      rootXNodeIds: ['goal-r1'],
      nodes: [
        {
          id: 'goal-r1',
          parentId: null,
          assertion: '旧 assertion',
          status: 'active',
          atomicity: 'undecided',
          phase: 'plan',
          why: { summary: '旧 assertion', confidence: 'partial' },
          what: { summary: '旧 assertion', confidence: 'partial' },
          flow: { summary: 'phase=plan', confidence: 'partial' },
          structure: { summary: 'projection', confidence: 'partial' },
          runtimeProof: { summary: 'missing', confidence: 'open' },
          sinceRound: 4,
          lastTouchedRound: 4,
          priority: 0,
          order: 0,
        },
      ],
      latestPolicyProjection: null,
      completion: null,
    },
  ];
  const result: CuratorResult = {
    summary: '## 目标\n复核 projection\n\n## 已完成\n- 修正 userGoal',
    signal: { type: 'correct', confidence: 0.9, evidence: 'Curator 复核发现 assertion 需要收敛' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: previousGoalState,
    reconciliationOps: [
      {
        action: 'revise_user_goal',
        targetUserGoalId: 'goal-r1',
        patch: { assertion: '新 assertion', executionState: 'executing' },
      },
      {
        action: 'update_xnode_model',
        targetUserGoalId: 'goal-r1',
        xNodeModelOps: [
          {
            action: 'patch_xnode',
            userGoalId: 'goal-r1',
            id: 'goal-r1',
            phase: 'execute',
            runtimeProof: { summary: 'still missing', confidence: 'open' },
          },
        ],
      },
    ],
    sections: { goal: '复核 projection', completed: ['修正 userGoal'], decisions: [], files: [], status: '', nextSteps: [], warnings: [] },
  };

  const reconciled = reconcileCuratorGoalState(previousGoalState, result, {
    userGoalTree,
    xNodeModels,
    agentRound: 5,
    nowIso: '2026-05-22T10:01:00.000Z',
  });

  const goal = reconciled?.userGoalTree?.userGoals[0];
  assert.equal(goal?.assertion, '新 assertion');
  assert.equal(goal?.executionState, 'executing');
  assert.equal(goal?.reviewState, 'curator_reviewed');
  assert.equal(goal?.relationState, 'revised');
  assert.equal(reconciled?.xNodeModels?.[0]?.nodes[0]?.phase, 'execute');
  assert.equal(reconciled?.xNodeModels?.[0]?.nodes[0]?.runtimeProof.summary, 'still missing');
});

test('reconcileCuratorGoalState discards draft-only active node without triggering empty-active rejection', () => {
  const previous: GoalTreeDocument = {
    version: 2,
    agentRound: 10,
    updatedAt: '2026-05-20T10:00:00.000Z',
    rootGoalIds: ['draft-1'],
    currentFocusGoalId: 'draft-1',
    nodes: [
      {
        id: 'draft-1',
        parentId: null,
        assertion: '顺手也许要改成硬调度器',
        kind: 'goal',
        status: 'active',
        signal: 'draft',
        atomicity: 'atomic',
        phase: 'plan',
        sinceRound: 10,
        lastTouchedRound: 10,
        lastConfirmedRound: 10,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const result: CuratorResult = {
    summary: '## 目标\n继续当前主线\n\n## 已完成\n- 排除误判 draft',
    signal: { type: 'discard-draft', confidence: 0.9, evidence: '实际上是对既有目标的补充，不是新目标' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: previous,
    draftDispositions: [
      { goalId: 'draft-1', action: 'discard-draft', evidence: '实际上是对既有目标的补充，不是新目标' },
    ],
    sections: { goal: '继续当前主线', completed: ['排除误判 draft'], decisions: [], files: [], status: '', nextSteps: [], warnings: [] },
  };

  assert.deepEqual(getCuratorGoalStateRejectionReasons(previous, result), []);
  const reconciled = reconcileCuratorGoalState(previous, result);
  assert.equal((reconciled?.goalState as GoalTreeDocument).nodes.length, 0);
  assert.equal((reconciled?.goalState as GoalTreeDocument).currentFocusGoalId, null);
});
