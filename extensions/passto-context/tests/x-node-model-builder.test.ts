import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProjectionXNode, buildXNodeModelSkeleton, reopenXNodeModelRoot } from '../grc-x-node-model.ts';
import type { UserGoalNode } from '../types.ts';

const NOW = '2026-05-22T00:00:00.000Z';

test('buildXNodeModelSkeleton creates enriched model for an open user goal', () => {
  const userGoal: UserGoalNode = {
    id: 'goal-r3',
    parentId: null,
    assertion: '收口 xNodeModel builder',
    status: 'executing',
    executionState: 'executing',
    reviewState: 'generator_projected',
    relationState: 'active',
    xNodeModelId: 'xnode-goal-r3',
    sinceRound: 21,
    lastTouchedRound: 21,
  };

  const model = buildXNodeModelSkeleton({ userGoal, agentRound: 21, nowIso: NOW });

  assert.equal(model.userGoalId, 'goal-r3');
  assert.equal(model.currentFocusXNodeId, 'goal-r3');
  assert.deepEqual(model.rootXNodeIds, ['goal-r3']);
  assert.equal(model.nodes[0]?.assertion, '收口 xNodeModel builder');
  assert.equal(model.nodes[0]?.structure.summary, 'created by UserGoalProjection object-first path');
  assert.equal(model.latestPolicyProjection?.nextStepType, 'plan_repair');
  assert.equal(model.completion?.modelComplete, false);
});

test('buildXNodeModelSkeleton routes planning goals to certainty improvement before proof collection', () => {
  const userGoal: UserGoalNode = {
    id: 'goal-plan',
    parentId: null,
    assertion: '收敛 plan 阶段方案',
    status: 'planning',
    executionState: 'planning',
    reviewState: 'generator_projected',
    relationState: 'active',
    xNodeModelId: 'xnode-goal-plan',
    sinceRound: 21,
    lastTouchedRound: 21,
  };

  const model = buildXNodeModelSkeleton({ userGoal, agentRound: 21, nowIso: NOW });

  assert.equal(model.nodes[0]?.phase, 'plan');
  assert.equal(model.nodes[0]?.runtimeProof.confidence, 'partial');
  assert.equal(model.nodes[0]?.runtimeProof.summary, 'plan-stage x-node should improve target certainty before requiring runtime proof');
  assert.equal(model.latestPolicyProjection?.nextStepType, 'plan_repair');
  assert.match(model.latestPolicyProjection?.guidance.join('\n') ?? '', /目标确定性提升层/);
});

test('reopenXNodeModelRoot reopens completed root and refreshes policy projection', () => {
  const completedGoal: UserGoalNode = {
    id: 'goal-r3',
    parentId: null,
    assertion: '已完成后重开目标',
    status: 'completed',
    executionState: 'completed',
    reviewState: 'generator_projected',
    relationState: 'active',
    xNodeModelId: 'xnode-goal-r3',
    sinceRound: 21,
    lastTouchedRound: 21,
    completedAtRound: 22,
  };
  const completedModel = buildXNodeModelSkeleton({ userGoal: completedGoal, agentRound: 22, nowIso: NOW });

  const reopened = reopenXNodeModelRoot(completedModel, {
    executionState: 'testing',
    agentRound: 23,
    updatedAt: '2026-05-22T00:00:23.000Z',
  });

  assert.equal(reopened.currentFocusXNodeId, 'goal-r3');
  assert.equal(reopened.nodes[0]?.status, 'active');
  assert.equal(reopened.nodes[0]?.phase, 'testing');
  assert.equal(reopened.nodes[0]?.completedAtRound, undefined);
  assert.equal(reopened.latestPolicyProjection?.nextStepType, 'run_tests');
  assert.equal(reopened.completion?.modelComplete, false);
});

test('buildProjectionXNode creates projection-native x-node facet defaults', () => {
  const node = buildProjectionXNode({
    id: 'child-1',
    parentId: 'goal-r3',
    assertion: '补投影测试',
    status: 'active',
    atomicity: 'atomic',
    phase: 'execute',
    agentRound: 24,
    priority: 0,
    order: 1,
  });

  assert.equal(node.structure.summary, 'created by UserGoalProjection object-first path');
  assert.equal(node.runtimeProof.confidence, 'open');
  assert.deepEqual(node.runtimeProof.method, ['补充可执行的 runtime proof、测试或人工验收步骤']);
});
