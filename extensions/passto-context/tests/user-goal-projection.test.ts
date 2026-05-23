import test from 'node:test';
import assert from 'node:assert/strict';

import { applyUserGoalProjectionToObjectState } from '../grc-user-goal-projection.ts';
import type { UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

const NOW = '2026-05-22T00:00:00.000Z';

test('applyUserGoalProjectionToObjectState creates generator-projected user goal and x-node skeleton', () => {
  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-r1', assertion: '实施 R1 projection 核心' }],
    source: 'generator',
    sourceAgentRound: 11,
    nowIso: NOW,
  });

  assert.equal(result.warnings.length, 0);
  assert.equal(result.userGoalTree.currentFocusUserGoalId, 'goal-r1');
  assert.deepEqual(result.userGoalTree.rootUserGoalIds, ['goal-r1']);
  assert.equal(result.userGoalTree.userGoals.length, 1);
  assert.equal(result.userGoalTree.userGoals[0]?.status, 'identified');
  assert.equal(result.userGoalTree.userGoals[0]?.executionState, 'identified');
  assert.equal(result.userGoalTree.userGoals[0]?.reviewState, 'generator_projected');
  assert.equal(result.userGoalTree.userGoals[0]?.relationState, 'active');
  assert.equal(result.userGoalTree.userGoals[0]?.source?.createdBy, 'generator');
  assert.equal(result.userGoalTree.userGoals[0]?.xNodeModelId, 'xnode-goal-r1');

  assert.equal(result.xNodeModels.length, 1);
  const model = result.xNodeModels[0];
  assert.equal(model?.userGoalId, 'goal-r1');
  assert.equal(model?.currentFocusXNodeId, 'goal-r1');
  assert.equal(model?.nodes.length, 1);
  assert.equal(model?.nodes[0]?.assertion, '实施 R1 projection 核心');
  assert.equal(model?.nodes[0]?.structure.summary, 'created by UserGoalProjection object-first path');
  assert.equal(model?.latestPolicyProjection?.xNodeId, 'goal-r1');
  assert.equal(model?.latestPolicyProjection?.nextStepType, 'plan_repair');
});

test('applyUserGoalProjectionToObjectState updates existing user goal without rebuilding model', () => {
  const initial = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-r1', assertion: '旧断言' }],
    xNodeModelOps: [{ action: 'add_xnode', userGoalId: 'goal-r1', id: 'child-1', assertion: '保留子节点' }],
    source: 'generator',
    sourceAgentRound: 11,
    nowIso: NOW,
  });

  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: initial.userGoalTree, xNodeModels: initial.xNodeModels },
    userGoalOps: [{ action: 'update_user_goal', id: 'goal-r1', assertion: '新断言', executionState: 'executing' }],
    source: 'generator',
    sourceAgentRound: 12,
    nowIso: '2026-05-22T00:00:12.000Z',
  });

  assert.equal(result.userGoalTree.userGoals[0]?.assertion, '新断言');
  assert.equal(result.userGoalTree.userGoals[0]?.executionState, 'executing');
  assert.equal(result.userGoalTree.userGoals[0]?.status, 'executing');
  const model = result.xNodeModels[0];
  assert.equal(model?.nodes.length, 2);
  assert.equal(model?.nodes.find((node) => node.id === 'goal-r1')?.assertion, '新断言');
  assert.equal(model?.nodes.find((node) => node.id === 'child-1')?.assertion, '保留子节点');
});

test('applyUserGoalProjectionToObjectState completes and reopens user goal with legacy status sync', () => {
  const initial = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-r1', assertion: '可完成目标', executionState: 'executing' }],
    source: 'generator',
    sourceAgentRound: 11,
    nowIso: NOW,
  });

  const completed = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: initial.userGoalTree, xNodeModels: initial.xNodeModels },
    userGoalOps: [{ action: 'complete_user_goal', id: 'goal-r1' }],
    xNodeModelOps: [{ action: 'complete_xnode', userGoalId: 'goal-r1', id: 'goal-r1' }],
    source: 'generator',
    sourceAgentRound: 12,
    nowIso: NOW,
  });

  assert.equal(completed.userGoalTree.userGoals[0]?.executionState, 'completed');
  assert.equal(completed.userGoalTree.userGoals[0]?.status, 'completed');
  assert.equal(completed.userGoalTree.currentFocusUserGoalId, null);
  assert.equal(completed.userGoalTree.completion?.treeComplete, true);

  const reopened = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: completed.userGoalTree, xNodeModels: completed.xNodeModels },
    userGoalOps: [{ action: 'reopen_user_goal', id: 'goal-r1', executionState: 'planning' }],
    source: 'generator',
    sourceAgentRound: 13,
    nowIso: NOW,
  });

  assert.equal(reopened.userGoalTree.userGoals[0]?.executionState, 'planning');
  assert.equal(reopened.userGoalTree.userGoals[0]?.status, 'planning');
  assert.equal(reopened.userGoalTree.userGoals[0]?.relationState, 'reopened');
  assert.equal(reopened.userGoalTree.completion?.treeComplete, false);
});

test('applyUserGoalProjectionToObjectState supports migrate split merge relation states', () => {
  const initial = makeTreeWithModels();
  const result = applyUserGoalProjectionToObjectState({
    current: initial,
    userGoalOps: [
      { action: 'migrate_user_goal', fromId: 'goal-a', to: { id: 'goal-b', assertion: '迁移后的目标' } },
      { action: 'split_user_goal', sourceId: 'goal-b', goals: [{ id: 'goal-c', assertion: '拆分目标 C' }] },
      { action: 'merge_user_goals', sourceIds: ['goal-c'], targetId: 'goal-b' },
    ],
    source: 'curator',
    sourceAgentRound: 12,
    nowIso: NOW,
  });

  const byId = new Map(result.userGoalTree.userGoals.map((goal) => [goal.id, goal]));
  assert.equal(byId.get('goal-a')?.relationState, 'migrated');
  assert.equal(byId.get('goal-b')?.relationState, 'split');
  assert.equal(byId.get('goal-c')?.relationState, 'merged');
  assert.equal(result.userGoalTree.currentFocusUserGoalId, 'goal-b');
  assert.ok(result.xNodeModels.some((model) => model.userGoalId === 'goal-b'));
  assert.ok(result.xNodeModels.some((model) => model.userGoalId === 'goal-c'));
});

test('applyUserGoalProjectionToObjectState validates focus references and reports warnings', () => {
  const initial = makeTreeWithModels();
  const result = applyUserGoalProjectionToObjectState({
    current: initial,
    userGoalOps: [{ action: 'switch_focus_user_goal', id: 'missing-goal' }],
    source: 'generator',
    sourceAgentRound: 12,
    nowIso: NOW,
  });

  assert.match(result.warnings.join('\n'), /currentFocusUserGoalId not found/);
  assert.equal(result.userGoalTree.currentFocusUserGoalId, 'goal-a');
});

test('applyUserGoalProjectionToObjectState patch_xnode writes certainty delta to all five facets with evidence and method', () => {
  const initial = makeTreeWithModels();
  const result = applyUserGoalProjectionToObjectState({
    current: initial,
    userGoalOps: [],
    xNodeModelOps: [{
      action: 'patch_xnode',
      userGoalId: 'goal-a',
      id: 'goal-a',
      why: {
        summary: 'why closed by parameter packet',
        confidence: 'closed',
        evidence: ['ContextParameterPacket.why'],
        method: ['plan-certainty-improvement'],
      },
      what: {
        summary: 'what closed by user correction',
        confidence: 'closed',
        evidence: ['ContextParameterPacket.what'],
        method: ['plan-certainty-improvement'],
      },
      flow: {
        summary: 'flow closed by implementation plan',
        confidence: 'closed',
        evidence: ['ContextParameterPacket.flow'],
        method: ['plan-certainty-improvement'],
      },
      structure: {
        summary: 'structure closed by source read',
        confidence: 'closed',
        evidence: ['ContextParameterPacket.structure'],
        method: ['source read'],
      },
      runtimeProof: {
        summary: 'runtime proof partial by projection test',
        confidence: 'partial',
        evidence: ['npm run test:projection'],
        method: ['projection regression'],
      },
    }],
    source: 'generator',
    sourceAgentRound: 12,
    nowIso: '2026-05-22T00:00:12.000Z',
  });

  assert.equal(result.warnings.length, 0);
  const node = result.xNodeModels[0]?.nodes.find((item) => item.id === 'goal-a');
  assert.equal(node?.why.confidence, 'closed');
  assert.deepEqual(node?.why.evidence, ['ContextParameterPacket.why']);
  assert.deepEqual(node?.why.method, ['plan-certainty-improvement']);
  assert.equal(node?.what.summary, 'what closed by user correction');
  assert.deepEqual(node?.flow.evidence, ['ContextParameterPacket.flow']);
  assert.deepEqual(node?.structure.method, ['source read']);
  assert.equal(node?.runtimeProof.confidence, 'partial');
  assert.deepEqual(node?.runtimeProof.method, ['projection regression']);
  assert.equal(node?.lastTouchedRound, 12);
});

test('applyUserGoalProjectionToObjectState reports clear warnings when patch_xnode state write target is missing', () => {
  const initial = makeTreeWithModels();
  const result = applyUserGoalProjectionToObjectState({
    current: initial,
    userGoalOps: [],
    xNodeModelOps: [{
      action: 'patch_xnode',
      userGoalId: 'goal-a',
      id: 'missing-xnode',
      runtimeProof: { summary: 'would be persisted by ProposedXNodeModelPatch', confidence: 'partial' },
    }],
    source: 'generator',
    sourceAgentRound: 12,
    nowIso: NOW,
  });

  assert.match(result.warnings.join('\n'), /x-node not found id=missing-xnode/);
});

test('direct-answer fast path does not require creating or patching xNodeModel', () => {
  const result = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [],
    xNodeModelOps: [],
    source: 'generator',
    sourceAgentRound: 12,
    nowIso: NOW,
  });

  assert.equal(result.userGoalTree.userGoals.length, 0);
  assert.equal(result.xNodeModels.length, 0);
  assert.equal(result.userGoalTree.currentFocusUserGoalId, null);
  assert.equal(result.warnings.length, 0);
});

function makeTreeWithModels(): { userGoalTree: UserGoalTreeDocument; xNodeModels: XNodeModelDocument[] } {
  const created = applyUserGoalProjectionToObjectState({
    current: { userGoalTree: null, xNodeModels: [] },
    userGoalOps: [{ action: 'create_user_goal', id: 'goal-a', assertion: '原始目标', executionState: 'executing' }],
    source: 'generator',
    sourceAgentRound: 11,
    nowIso: NOW,
  });
  return { userGoalTree: created.userGoalTree, xNodeModels: created.xNodeModels };
}
