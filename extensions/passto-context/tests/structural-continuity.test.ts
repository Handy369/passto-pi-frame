import test from 'node:test';
import assert from 'node:assert/strict';

import { applyUserGoalProjectionToObjectState } from '../grc-user-goal-projection.ts';
import type { UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

const NOW = '2026-05-22T00:00:00.000Z';

test('P0 structural continuity: created user goal and x-node model expose bidirectional document identities', () => {
  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-identity', assertion: '锁定 identity 关联' }],
    source: 'generator',
    sourceAgentRound: 1,
    nowIso: NOW,
  });

  const goal = result.userGoalTree.userGoals.find((item) => item.id === 'goal-identity');
  const model = result.xNodeModels.find((item) => item.userGoalId === 'goal-identity') as (XNodeModelDocument & { id?: string }) | undefined;

  assert.ok(goal, 'created userGoal should exist');
  assert.ok(model, 'created xNodeModel should exist');
  assert.equal(model.id, goal.xNodeModelId, 'xNodeModel.id must equal userGoal.xNodeModelId');
  assert.equal(model.userGoalId, goal.id, 'xNodeModel.userGoalId must point back to userGoal.id');
});

test('P0 structural continuity: missing x-node sidecar is reported as identity-resolution warning, not silently recreated', () => {
  const userGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 1,
    updatedAt: NOW,
    currentFocusUserGoalId: 'goal-existing',
    rootUserGoalIds: ['goal-existing'],
    userGoals: [{
      id: 'goal-existing',
      parentId: null,
      assertion: '已有目标但 sidecar 缺失',
      status: 'executing',
      executionState: 'executing',
      reviewState: 'generator_projected',
      relationState: 'active',
      xNodeModelId: 'xnode-goal-existing',
      sinceRound: 1,
      lastTouchedRound: 1,
    }],
  };

  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree, xNodeModels: [] },
    userGoalOps: [],
    source: 'generator',
    sourceAgentRound: 2,
    nowIso: NOW,
  });

  assert.match(
    result.warnings.join('\n'),
    /identity-resolution.*missing xNodeModelId=xnode-goal-existing.*userGoalId=goal-existing/,
  );
});

test('P0 structural continuity: update_user_goal for missing target returns identity-resolution warning', () => {
  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'update_user_goal', id: 'goal-missing', assertion: '不应静默跳过' }],
    focus: { currentFocusUserGoalId: 'goal-missing', currentFocusXNodeId: 'goal-missing' },
    source: 'generator',
    sourceAgentRound: 3,
    nowIso: NOW,
  });

  assert.match(
    result.warnings.join('\n'),
    /identity-resolution.*missing userGoalId=goal-missing.*action=update_user_goal/,
  );
  assert.equal(result.userGoalTree.userGoals.length, 0, 'missing target must not synthesize a replacement root goal');
});

test('P0 structural continuity: completing a node records a post-node commit that can be injected next round', () => {
  const initial = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-commit', assertion: '提交节点运行结果', executionState: 'testing' }],
    source: 'generator',
    sourceAgentRound: 4,
    nowIso: NOW,
  });

  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: initial.userGoalTree, xNodeModels: initial.xNodeModels },
    userGoalOps: [],
    xNodeModelOps: [{ action: 'complete_xnode', userGoalId: 'goal-commit', id: 'goal-commit' }],
    source: 'generator',
    sourceAgentRound: 5,
    nowIso: NOW,
  });

  const model = result.xNodeModels.find((item) => item.userGoalId === 'goal-commit') as (XNodeModelDocument & { id?: string; commitLog?: Array<{ userGoalId: string; xNodeModelId: string; xNodeId: string; resultStatus: string }> }) | undefined;

  assert.ok(model?.commitLog?.length, 'complete_xnode should append a post-node commit');
  const commit = model!.commitLog![model!.commitLog!.length - 1]!;
  assert.equal(commit.userGoalId, 'goal-commit');
  assert.equal(commit.xNodeModelId, model!.id);
  assert.equal(commit.xNodeId, 'goal-commit');
  assert.equal(commit.resultStatus, 'completed');
});
