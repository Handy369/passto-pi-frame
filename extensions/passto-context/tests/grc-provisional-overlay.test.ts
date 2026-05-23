import test from 'node:test';
import assert from 'node:assert/strict';

import { applyRuntimeProvisionalOverlay, buildRuntimeProvisionalOverlayFromDraftGoalOp } from '../grc-provisional-overlay.ts';
import type { GoalTreeDocument, UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

test('buildRuntimeProvisionalOverlayFromDraftGoalOp creates provisional user goal root and x-node root', () => {
  const confirmedUserGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 9,
    updatedAt: '2026-05-20T09:00:00.000Z',
    currentFocusUserGoalId: 'goal-root',
    rootUserGoalIds: ['goal-root'],
    userGoals: [
      {
        id: 'goal-root',
        parentId: null,
        assertion: '已有用户目标',
        status: 'executing',
        xNodeModelId: 'xnode-goal-root',
        sinceRound: 8,
        lastTouchedRound: 9,
      },
    ],
  };

  const confirmedXNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-root',
      agentRound: 9,
      updatedAt: '2026-05-20T09:00:00.000Z',
      currentFocusXNodeId: 'goal-root',
      rootXNodeIds: ['goal-root'],
      nodes: [
        {
          id: 'goal-root',
          parentId: null,
          assertion: '已有用户目标',
          status: 'active',
          atomicity: 'composite',
          phase: 'execute',
          why: { summary: '已有用户目标', confidence: 'partial' },
          what: { summary: '已有用户目标', confidence: 'partial' },
          flow: { summary: 'phase=execute; atomicity=composite', confidence: 'partial' },
          structure: { summary: 'confirmed', confidence: 'partial' },
          runtimeProof: { summary: 'confirmed proof missing', confidence: 'open' },
          sinceRound: 8,
          lastTouchedRound: 9,
          priority: 0,
          order: 0,
        },
      ],
    },
  ];

  const overlay = buildRuntimeProvisionalOverlayFromDraftGoalOp({
    draftGoalOp: {
      action: 'create',
      goal: {
        assertion: '当前轮新 root',
        kind: 'goal',
        parentGoalId: null,
        atomicity: 'undecided',
        phase: 'plan',
      },
      reason: '切换到独立新目标',
    },
    currentAgentRound: 10,
    confirmedUserGoalTree,
    confirmedXNodeModels,
  });

  assert.ok(overlay);
  assert.equal(overlay?.userGoalState?.userGoalTree.currentFocusUserGoalId, 'draft-10-root-1');
  assert.equal(overlay?.userGoalState?.userGoalTree.userGoals.some((goal) => goal.id === 'draft-10-root-1'), true);
  assert.equal(overlay?.xNodeState?.xNodeModel.userGoalId, 'draft-10-root-1');
  assert.equal(overlay?.xNodeState?.xNodeModel.currentFocusXNodeId, 'draft-10-root-1');
});

test('applyRuntimeProvisionalOverlay keeps confirmed sidecars intact while exposing effective provisional state', () => {
  const confirmedUserGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 9,
    updatedAt: '2026-05-20T09:00:00.000Z',
    currentFocusUserGoalId: 'goal-root',
    rootUserGoalIds: ['goal-root'],
    userGoals: [
      {
        id: 'goal-root',
        parentId: null,
        assertion: '已有用户目标',
        status: 'executing',
        xNodeModelId: 'xnode-goal-root',
        sinceRound: 8,
        lastTouchedRound: 9,
      },
    ],
  };
  const confirmedXNodeModels: XNodeModelDocument[] = [];
  const overlay = buildRuntimeProvisionalOverlayFromDraftGoalOp({
    draftGoalOp: {
      action: 'create',
      goal: {
        assertion: '当前轮新 root',
        kind: 'goal',
        parentGoalId: null,
        atomicity: 'undecided',
        phase: 'plan',
      },
      reason: '切换到独立新目标',
    },
    currentAgentRound: 10,
    confirmedUserGoalTree,
    confirmedXNodeModels,
  });

  const effective = applyRuntimeProvisionalOverlay(confirmedUserGoalTree, confirmedXNodeModels, overlay);
  assert.equal(confirmedUserGoalTree.currentFocusUserGoalId, 'goal-root');
  assert.equal(effective.userGoalTree?.currentFocusUserGoalId, 'draft-10-root-1');
  assert.equal(effective.userGoalTree?.userGoals.length, 2);
  assert.equal(effective.xNodeModels.some((model) => model.userGoalId === 'draft-10-root-1'), true);
});

test('buildRuntimeProvisionalOverlayFromDraftGoalOp can bootstrap from confirmed goal tree only', () => {
  const goalTree: GoalTreeDocument = {
    version: 2,
    agentRound: 0,
    updatedAt: '2026-05-20T09:00:00.000Z',
    rootGoalIds: [],
    currentFocusGoalId: null,
    nodes: [],
    migrations: [],
    prunedCount: 0,
  };

  const overlay = buildRuntimeProvisionalOverlayFromDraftGoalOp({
    draftGoalOp: {
      action: 'create',
      goal: {
        assertion: 'fresh real session proof',
        kind: 'goal',
        parentGoalId: null,
        atomicity: 'undecided',
        phase: 'plan',
      },
      reason: '首轮 lastGoalState 为空时仍需建立 overlay',
    },
    currentAgentRound: 1,
    confirmedGoalState: goalTree,
  });

  assert.equal(overlay?.userGoalState?.userGoalTree.currentFocusUserGoalId, 'draft-1-root-1');
  assert.equal(overlay?.xNodeState?.xNodeModel.userGoalId, 'draft-1-root-1');
});
