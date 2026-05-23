import test from 'node:test';
import assert from 'node:assert/strict';

import { downgradeTreeToGoalState, ensureGoalTreeDocument, isGoalTreeDocument, upgradeGoalStateToTree } from '../grc-goal-tree.ts';
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
  migrations: [
    {
      from: '设计升级方案',
      to: '实现 GoalTree 升级函数',
      atRound: 7,
      reason: '进入实现阶段',
    },
  ],
  prunedCount: 0,
};

test('upgradeGoalStateToTree upgrades v1 goal state into normalized goal tree', () => {
  const tree = upgradeGoalStateToTree(v1);

  assert.equal(tree.version, 2);
  assert.equal(tree.currentFocusGoalId, 'goal-a');
  assert.deepEqual(tree.rootGoalIds, ['goal-a']);
  assert.equal(tree.nodes.length, 2);
  assert.equal(tree.nodes[0]?.atomicity, 'undecided');
  assert.equal(tree.nodes[0]?.phase, 'plan');
  assert.equal(tree.nodes[1]?.status, 'completed');
  assert.equal(tree.nodes[1]?.phase, 'complete');
  assert.equal(tree.migrations[0]?.toGoalId, '实现 GoalTree 升级函数');
});

test('ensureGoalTreeDocument upgrades v1 and keeps v2 as-is', () => {
  const upgraded = ensureGoalTreeDocument(v1);
  assert.ok(upgraded);
  assert.equal(upgraded?.version, 2);

  const v2: GoalTreeDocument = {
    version: 2,
    agentRound: 8,
    updatedAt: '2026-05-20T00:00:08.000Z',
    rootGoalIds: ['goal-b'],
    currentFocusGoalId: 'goal-b',
    nodes: [
      {
        id: 'goal-b',
        parentId: null,
        assertion: '保持 v2 目标树不变',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
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

  assert.equal(ensureGoalTreeDocument(v2), v2);
  assert.equal(isGoalTreeDocument(v2), true);
});

test('downgradeTreeToGoalState converts v2 tree into compatible v1 structure', () => {
  const tree = upgradeGoalStateToTree(v1);
  const downgraded = downgradeTreeToGoalState(tree);

  assert.equal(downgraded.version, 1);
  assert.equal(downgraded.active.length, 1);
  assert.equal(downgraded.completed.length, 1);
  assert.equal(downgraded.active[0]?.id, 'goal-a');
  assert.equal(downgraded.completed[0]?.id, 'goal-z');
});
