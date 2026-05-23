import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveUserGoalTreeFromGoalState } from '../grc-user-goal-tree.ts';
import { deriveXNodeModelsFromGoalState, selectCurrentXNodeModel } from '../grc-x-node-model.ts';
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

test('deriveXNodeModelsFromGoalState maps v1 goal state into single-node x-node models', () => {
  const userGoalTree = deriveUserGoalTreeFromGoalState(v1);
  const models = deriveXNodeModelsFromGoalState(v1, userGoalTree);

  assert.equal(models.length, 2);
  assert.equal(models[0]?.userGoalId, 'goal-a');
  assert.equal(models[0]?.nodes.length, 1);
  assert.equal(models[0]?.nodes[0]?.why.confidence, 'partial');
  assert.equal(models[0]?.nodes[0]?.runtimeProof.confidence, 'open');
  assert.equal(models[0]?.latestPolicyProjection?.xNodeId, 'goal-a');
  assert.equal(models[0]?.latestPolicyProjection?.nextStepType, 'plan_repair');
  assert.equal(selectCurrentXNodeModel(userGoalTree, models)?.userGoalId, 'goal-a');
});

test('deriveXNodeModelsFromGoalState partitions v2 tree by root user goal', () => {
  const v2: GoalTreeDocument = {
    version: 2,
    agentRound: 9,
    updatedAt: '2026-05-20T00:00:09.000Z',
    rootGoalIds: ['goal-root-a', 'goal-root-b'],
    currentFocusGoalId: 'goal-child-a1',
    nodes: [
      {
        id: 'goal-root-a',
        parentId: null,
        assertion: 'A 根目标',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'composite',
        phase: 'execute',
        sinceRound: 9,
        lastTouchedRound: 9,
        lastConfirmedRound: 9,
        priority: 0,
        order: 0,
      },
      {
        id: 'goal-child-a1',
        parentId: 'goal-root-a',
        assertion: 'A 的子目标',
        kind: 'subgoal',
        status: 'active',
        signal: 'inferred',
        atomicity: 'atomic',
        phase: 'execute',
        sinceRound: 9,
        lastTouchedRound: 9,
        lastConfirmedRound: 9,
        priority: 0,
        order: 0,
      },
      {
        id: 'goal-root-b',
        parentId: null,
        assertion: 'B 根目标',
        kind: 'goal',
        status: 'completed',
        signal: 'explicit',
        atomicity: 'atomic',
        phase: 'complete',
        sinceRound: 8,
        lastTouchedRound: 9,
        lastConfirmedRound: 9,
        completedAtRound: 9,
        priority: 0,
        order: 1,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const userGoalTree = deriveUserGoalTreeFromGoalState(v2);
  const models = deriveXNodeModelsFromGoalState(v2, userGoalTree);

  assert.equal(models.length, 2);

  const modelA = models.find((model) => model.userGoalId === 'goal-root-a');
  const modelB = models.find((model) => model.userGoalId === 'goal-root-b');

  assert.ok(modelA);
  assert.ok(modelB);
  assert.equal(modelA?.nodes.length, 2);
  assert.equal(modelA?.currentFocusXNodeId, 'goal-child-a1');
  assert.equal(modelA?.latestPolicyProjection?.xNodeId, 'goal-child-a1');
  assert.equal(modelA?.latestPolicyProjection?.nextStepType, 'run_tests');
  assert.equal(modelB?.nodes.length, 1);
  assert.equal(modelB?.currentFocusXNodeId, null);
  assert.equal(modelB?.latestPolicyProjection?.nextStepType, 'upward_regression');
  assert.equal(selectCurrentXNodeModel(userGoalTree, models)?.userGoalId, 'goal-root-a');
});
