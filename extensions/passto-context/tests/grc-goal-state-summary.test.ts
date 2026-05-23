import test from 'node:test';
import assert from 'node:assert/strict';

import { getGoalStateOpenAssertions, getGoalStateOpenAssertionsFromObjectSidecars, summarizeGoalState, summarizeGoalStateFromObjectSidecars } from '../grc-goal-state-summary.ts';
import type { GoalStateDocument, GoalTreeDocument, UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

const v1: GoalStateDocument = {
  version: 1,
  agentRound: 7,
  updatedAt: '2026-05-19T12:00:00.000Z',
  active: [
    {
      id: 'goal-1',
      assertion: '修复 V1-only status surface',
      status: 'active',
      sinceRound: 6,
      lastConfirmedRound: 7,
      signal: 'explicit',
    },
    {
      id: 'goal-2',
      assertion: '补 rotate V2 兼容',
      status: 'suspended',
      sinceRound: 6,
      lastConfirmedRound: 7,
      signal: 'explicit',
    },
  ],
  completed: [
    {
      id: 'goal-0',
      assertion: '完成 runtime gap 重写',
      completedAtRound: 6,
    },
  ],
  migrations: [
    {
      from: '旧分析',
      to: '真实代码重读',
      atRound: 7,
      reason: '用户纠偏',
    },
  ],
  prunedCount: 0,
};

const v2: GoalTreeDocument = {
  version: 2,
  agentRound: 8,
  updatedAt: '2026-05-19T12:10:00.000Z',
  rootGoalIds: ['root'],
  currentFocusGoalId: 'child-a',
  nodes: [
    {
      id: 'root',
      parentId: null,
      assertion: '诊断并修复 V2 runtime 主链',
      kind: 'goal',
      status: 'active',
      signal: 'explicit',
      atomicity: 'composite',
      phase: 'execute',
      sinceRound: 7,
      lastTouchedRound: 8,
      lastConfirmedRound: 8,
      priority: 0,
      order: 0,
    },
    {
      id: 'child-a',
      parentId: 'root',
      assertion: '清理 status/rotate 的 V1-only 访问',
      kind: 'subgoal',
      status: 'active',
      signal: 'explicit',
      atomicity: 'atomic',
      phase: 'testing',
      sinceRound: 8,
      lastTouchedRound: 8,
      lastConfirmedRound: 8,
      priority: 0,
      order: 1,
    },
    {
      id: 'child-b',
      parentId: 'root',
      assertion: '接通默认 GoalTree 迁移',
      kind: 'subgoal',
      status: 'suspended',
      signal: 'explicit',
      atomicity: 'atomic',
      phase: 'plan',
      sinceRound: 8,
      lastTouchedRound: 8,
      lastConfirmedRound: 8,
      priority: 0,
      order: 2,
    },
    {
      id: 'done',
      parentId: null,
      assertion: '完成真实代码 gap 分析',
      kind: 'goal',
      status: 'completed',
      signal: 'inferred',
      atomicity: 'atomic',
      phase: 'complete',
      sinceRound: 7,
      lastTouchedRound: 7,
      lastConfirmedRound: 7,
      completedAtRound: 7,
      priority: 0,
      order: 3,
    },
  ],
  migrations: [
    {
      id: 'm-1',
      fromGoalId: 'legacy',
      toGoalId: 'child-a',
      type: 'refine',
      atRound: 8,
      triggerSignal: 'advance',
      reason: '先修 surface 再切主链',
    },
  ],
  prunedCount: 1,
};

test('summarizeGoalState supports v1 goal state', () => {
  assert.deepEqual(summarizeGoalState(v1), {
    version: 1,
    active: 2,
    completed: 1,
    migrations: 1,
    pruned: 0,
    updatedRound: 7,
  });

  assert.deepEqual(getGoalStateOpenAssertions(v1, 5), [
    '修复 V1-only status surface',
    '补 rotate V2 兼容',
  ]);
});

test('summarizeGoalState supports v2 goal tree and open assertions ignore completed nodes', () => {
  assert.deepEqual(summarizeGoalState(v2), {
    version: 2,
    active: 3,
    completed: 1,
    migrations: 1,
    pruned: 1,
    updatedRound: 8,
    nodes: 4,
  });

  assert.deepEqual(getGoalStateOpenAssertions(v2, 5), [
    '诊断并修复 V2 runtime 主链',
    '清理 status/rotate 的 V1-only 访问',
    '接通默认 GoalTree 迁移',
  ]);
});

test('object-sidecar summary and open assertions prefer current x-node model with user-goal fallback', () => {
  const userGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 12,
    updatedAt: '2026-05-21T08:00:00.000Z',
    currentFocusUserGoalId: 'goal-root',
    rootUserGoalIds: ['goal-root', 'goal-sibling', 'goal-done'],
    userGoals: [
      {
        id: 'goal-root',
        parentId: null,
        assertion: '推进 object-first 收口',
        status: 'executing',
        xNodeModelId: 'xnode-goal-root',
        sinceRound: 10,
        lastTouchedRound: 12,
      },
      {
        id: 'goal-sibling',
        parentId: null,
        assertion: '补 status surface 兼容回归',
        status: 'planning',
        xNodeModelId: 'xnode-goal-sibling',
        sinceRound: 11,
        lastTouchedRound: 11,
      },
      {
        id: 'goal-done',
        parentId: null,
        assertion: '完成 compatibility 盘点',
        status: 'completed',
        xNodeModelId: 'xnode-goal-done',
        sinceRound: 9,
        lastTouchedRound: 10,
        completedAtRound: 10,
      },
    ],
  };

  const xNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-root',
      agentRound: 12,
      updatedAt: '2026-05-21T08:00:00.000Z',
      currentFocusXNodeId: 'child-a',
      rootXNodeIds: ['goal-root'],
      nodes: [
        {
          id: 'goal-root', parentId: null, assertion: '推进 object-first 收口', status: 'active', atomicity: 'composite', phase: 'execute',
          why: { summary: 'root', confidence: 'partial' }, what: { summary: 'root', confidence: 'partial' }, flow: { summary: 'root', confidence: 'partial' }, structure: { summary: 'root', confidence: 'partial' }, runtimeProof: { summary: 'root', confidence: 'open' },
          sinceRound: 10, lastTouchedRound: 12, priority: 0, order: 0,
        },
        {
          id: 'child-a', parentId: 'goal-root', assertion: '收紧 goal view primary path', status: 'active', atomicity: 'atomic', phase: 'testing',
          why: { summary: 'child-a', confidence: 'partial' }, what: { summary: 'child-a', confidence: 'partial' }, flow: { summary: 'child-a', confidence: 'partial' }, structure: { summary: 'child-a', confidence: 'partial' }, runtimeProof: { summary: 'child-a', confidence: 'open' },
          sinceRound: 11, lastTouchedRound: 12, priority: 0, order: 0,
        },
        {
          id: 'child-b', parentId: 'goal-root', assertion: '补 transition object-first 断言', status: 'completed', atomicity: 'atomic', phase: 'complete',
          why: { summary: 'child-b', confidence: 'partial' }, what: { summary: 'child-b', confidence: 'partial' }, flow: { summary: 'child-b', confidence: 'partial' }, structure: { summary: 'child-b', confidence: 'partial' }, runtimeProof: { summary: 'child-b', confidence: 'closed' },
          sinceRound: 11, lastTouchedRound: 12, completedAtRound: 12, priority: 0, order: 1,
        },
      ],
    },
  ];

  assert.deepEqual(summarizeGoalStateFromObjectSidecars(userGoalTree, xNodeModels), {
    version: 2,
    active: 2,
    completed: 1,
    migrations: 0,
    pruned: 0,
    updatedRound: 12,
    nodes: 3,
  });

  assert.deepEqual(getGoalStateOpenAssertionsFromObjectSidecars(userGoalTree, xNodeModels, 5), [
    '推进 object-first 收口',
    '收紧 goal view primary path',
    '补 status surface 兼容回归',
  ]);
});
