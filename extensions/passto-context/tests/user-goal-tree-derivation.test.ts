import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveUserGoalTreeFromGoalState, selectCurrentUserGoal, summarizeUserGoalTree } from '../grc-user-goal-tree.ts';
import type { GoalStateDocument, GoalTreeDocument } from '../types.ts';

const v1: GoalStateDocument = {
  version: 1,
  agentRound: 7,
  updatedAt: '2026-05-20T00:00:07.000Z',
  active: [
    {
      id: 'goal-a',
      assertion: '实现 GoalTree 升级函数',
      status: 'active',
      sinceRound: 6,
      lastConfirmedRound: 7,
      signal: 'explicit',
    },
  ],
  completed: [
    {
      id: 'goal-z',
      assertion: '完成 V2.0 方案设计',
      completedAtRound: 5,
    },
  ],
  migrations: [],
  prunedCount: 0,
};

test('deriveUserGoalTreeFromGoalState maps v1 goal state into root user goals', () => {
  const userGoalTree = deriveUserGoalTreeFromGoalState(v1);

  assert.ok(userGoalTree);
  assert.equal(userGoalTree?.version, 1);
  assert.equal(userGoalTree?.currentFocusUserGoalId, 'goal-a');
  assert.deepEqual(userGoalTree?.rootUserGoalIds, ['goal-a']);
  assert.equal(userGoalTree?.userGoals.length, 2);
  assert.equal(userGoalTree?.userGoals[0]?.status, 'planning');
  assert.equal(userGoalTree?.userGoals[1]?.status, 'completed');
  assert.equal(userGoalTree?.userGoals[0]?.xNodeModelId, 'xnode-goal-a');
});

test('deriveUserGoalTreeFromGoalState maps v2 child focus back to root user goal', () => {
  const v2: GoalTreeDocument = {
    version: 2,
    agentRound: 8,
    updatedAt: '2026-05-20T00:00:08.000Z',
    rootGoalIds: ['goal-root'],
    currentFocusGoalId: 'goal-child',
    nodes: [
      {
        id: 'goal-root',
        parentId: null,
        assertion: '补齐 V2 正式对象层',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'composite',
        phase: 'execute',
        sinceRound: 8,
        lastTouchedRound: 8,
        lastConfirmedRound: 8,
        priority: 0,
        order: 0,
      },
      {
        id: 'goal-child',
        parentId: 'goal-root',
        assertion: '先实现派生 adapter',
        kind: 'subgoal',
        status: 'active',
        signal: 'inferred',
        atomicity: 'atomic',
        phase: 'execute',
        sinceRound: 8,
        lastTouchedRound: 8,
        lastConfirmedRound: 8,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const userGoalTree = deriveUserGoalTreeFromGoalState(v2);
  assert.ok(userGoalTree);
  assert.equal(userGoalTree?.currentFocusUserGoalId, 'goal-root');
  assert.equal(selectCurrentUserGoal(userGoalTree)?.assertion, '补齐 V2 正式对象层');
  assert.equal(userGoalTree?.userGoals.length, 1);
  assert.equal(userGoalTree?.userGoals[0]?.status, 'executing');
});

test('summarizeUserGoalTree reports active/completed counters', () => {
  const summary = summarizeUserGoalTree(deriveUserGoalTreeFromGoalState(v1));
  assert.deepEqual(summary, {
    active: 1,
    completed: 1,
    focus: '实现 GoalTree 升级函数',
  });
});
