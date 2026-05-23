import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialGRCState } from '../grc-state.ts';
import { executeApplyUserGoalProjectionTool } from '../grc-user-goal-projection-tool.ts';
import type { GRCState } from '../types.ts';

const NOW = '2026-05-22T00:00:00.000Z';

test('executeApplyUserGoalProjectionTool applies projection and persists grc state', () => {
  let state: GRCState | null = {
    ...createInitialGRCState(),
    currentAgentRound: 9,
    totalAgentRounds: 8,
  };
  const persisted: GRCState[] = [];

  const result = executeApplyUserGoalProjectionTool({
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-tool', assertion: '接入 projection tool' }],
    xNodeModelOps: [{ action: 'add_xnode', userGoalId: 'goal-tool', id: 'xnode-tool-child', assertion: '补 tool 级验证', phase: 'testing' }],
  }, {
    getState: () => state,
    setState: (nextState) => {
      state = nextState;
    },
    appendState: (nextState) => {
      persisted.push(nextState);
    },
    nowIso: () => NOW,
  });

  assert.match(result.text, /applyUserGoalProjection applied/);
  assert.equal(result.details.userGoalTree.currentFocusUserGoalId, 'goal-tool');
  assert.equal(result.details.userGoalTree.userGoals[0]?.reviewState, 'generator_projected');
  assert.equal(result.details.xNodeModels[0]?.currentFocusXNodeId, 'xnode-tool-child');
  assert.equal(result.details.latestPolicyProjection?.xNodeId, 'xnode-tool-child');
  assert.equal(result.details.latestPolicyProjection?.nextStepType, 'run_tests');
  assert.equal(state?.curator.lastUserGoalTree?.currentFocusUserGoalId, 'goal-tool');
  assert.equal(state?.curator.lastXNodeModels[0]?.nodes.length, 2);
  assert.equal(state?.curator.lastPolicyProjection?.xNodeId, 'xnode-tool-child');
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.curator.lastUserGoalTree?.currentFocusUserGoalId, 'goal-tool');
});

test('executeApplyUserGoalProjectionTool returns warning result when grc state is unavailable', () => {
  const result = executeApplyUserGoalProjectionTool({
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-tool', assertion: '不会落库' }],
  }, {
    getState: () => null,
    setState: () => {
      throw new Error('setState should not be called');
    },
    appendState: () => {
      throw new Error('appendState should not be called');
    },
    nowIso: () => NOW,
  });

  assert.match(result.text, /not initialized/);
  assert.deepEqual(result.details.warnings, ['grc-state-not-initialized']);
});
