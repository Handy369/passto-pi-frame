import test from 'node:test';
import assert from 'node:assert/strict';

import { applyCompletionClosure, deriveXNodeModelCompletion } from '../grc-completion-closure.ts';
import type { UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

test('applyCompletionClosure marks user goal completed when x-node-model is fully complete and advances focus to next open user goal', () => {
  const userGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 12,
    updatedAt: '2026-05-20T12:00:00.000Z',
    currentFocusUserGoalId: 'goal-a',
    rootUserGoalIds: ['goal-a', 'goal-b'],
    userGoals: [
      {
        id: 'goal-a',
        parentId: null,
        assertion: '完成 A',
        status: 'executing',
        xNodeModelId: 'xnode-goal-a',
        sinceRound: 10,
        lastTouchedRound: 12,
      },
      {
        id: 'goal-b',
        parentId: null,
        assertion: '继续 B',
        status: 'planning',
        xNodeModelId: 'xnode-goal-b',
        sinceRound: 11,
        lastTouchedRound: 12,
      },
    ],
  };

  const xNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-a',
      agentRound: 12,
      updatedAt: '2026-05-20T12:00:00.000Z',
      currentFocusXNodeId: 'goal-a-child',
      rootXNodeIds: ['goal-a'],
      nodes: [
        {
          id: 'goal-a',
          parentId: null,
          assertion: '完成 A',
          status: 'completed',
          atomicity: 'composite',
          phase: 'complete',
          why: { summary: 'A', confidence: 'closed' },
          what: { summary: 'A', confidence: 'closed' },
          flow: { summary: 'A', confidence: 'closed' },
          structure: { summary: 'A', confidence: 'closed' },
          runtimeProof: { summary: 'A', confidence: 'closed' },
          sinceRound: 10,
          lastTouchedRound: 12,
          completedAtRound: 12,
          priority: 0,
          order: 0,
        },
        {
          id: 'goal-a-child',
          parentId: 'goal-a',
          assertion: 'A 子项',
          status: 'completed',
          atomicity: 'atomic',
          phase: 'complete',
          why: { summary: 'A child', confidence: 'closed' },
          what: { summary: 'A child', confidence: 'closed' },
          flow: { summary: 'A child', confidence: 'closed' },
          structure: { summary: 'A child', confidence: 'closed' },
          runtimeProof: { summary: 'A child', confidence: 'closed' },
          sinceRound: 11,
          lastTouchedRound: 12,
          completedAtRound: 12,
          priority: 0,
          order: 1,
        },
      ],
    },
    {
      version: 1,
      userGoalId: 'goal-b',
      agentRound: 12,
      updatedAt: '2026-05-20T12:00:00.000Z',
      currentFocusXNodeId: 'goal-b',
      rootXNodeIds: ['goal-b'],
      nodes: [
        {
          id: 'goal-b',
          parentId: null,
          assertion: '继续 B',
          status: 'active',
          atomicity: 'atomic',
          phase: 'execute',
          why: { summary: 'B', confidence: 'partial' },
          what: { summary: 'B', confidence: 'partial' },
          flow: { summary: 'B', confidence: 'partial' },
          structure: { summary: 'B', confidence: 'partial' },
          runtimeProof: { summary: 'B', confidence: 'open' },
          sinceRound: 11,
          lastTouchedRound: 12,
          priority: 0,
          order: 0,
        },
      ],
    },
  ];

  const closure = applyCompletionClosure(userGoalTree, xNodeModels);

  assert.equal(closure.userGoalTree?.userGoals.find((goal) => goal.id === 'goal-a')?.status, 'completed');
  assert.equal(closure.userGoalTree?.currentFocusUserGoalId, 'goal-b');
  assert.deepEqual(closure.userGoalTree?.rootUserGoalIds, ['goal-b']);
  assert.equal(closure.userGoalTree?.completion?.treeComplete, false);
  assert.equal(closure.userGoalTree?.completion?.nextFocusUserGoalId, 'goal-b');
  assert.equal(closure.xNodeModels[0]?.completion?.modelComplete, true);
  assert.equal(closure.xNodeModels[0]?.currentFocusXNodeId, null);
});

test('deriveXNodeModelCompletion preserves current open focus and detects local complete separately from model complete', () => {
  const model: XNodeModelDocument = {
    version: 1,
    userGoalId: 'goal-focus',
    agentRound: 8,
    updatedAt: '2026-05-20T08:00:00.000Z',
    currentFocusXNodeId: 'child-open',
    rootXNodeIds: ['root'],
    nodes: [
      {
        id: 'root',
        parentId: null,
        assertion: '根节点',
        status: 'active',
        atomicity: 'composite',
        phase: 'execute',
        why: { summary: 'root', confidence: 'partial' },
        what: { summary: 'root', confidence: 'partial' },
        flow: { summary: 'root', confidence: 'partial' },
        structure: { summary: 'root', confidence: 'partial' },
        runtimeProof: { summary: 'root', confidence: 'open' },
        sinceRound: 7,
        lastTouchedRound: 8,
        priority: 0,
        order: 0,
      },
      {
        id: 'child-open',
        parentId: 'root',
        assertion: '当前 open 子节点',
        status: 'active',
        atomicity: 'atomic',
        phase: 'testing',
        why: { summary: 'child', confidence: 'partial' },
        what: { summary: 'child', confidence: 'partial' },
        flow: { summary: 'child', confidence: 'partial' },
        structure: { summary: 'child', confidence: 'partial' },
        runtimeProof: { summary: 'child', confidence: 'partial' },
        sinceRound: 8,
        lastTouchedRound: 8,
        priority: 0,
        order: 1,
      },
    ],
  };

  const completion = deriveXNodeModelCompletion(model);
  assert.equal(completion?.localComplete, false);
  assert.equal(completion?.modelComplete, false);
  assert.equal(completion?.nextOpenXNodeId, 'child-open');
  assert.equal(completion?.openNodeCount, 2);
});
