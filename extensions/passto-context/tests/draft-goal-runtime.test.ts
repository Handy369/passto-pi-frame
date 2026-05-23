import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDraftGoalOpToGoalTree, extractDraftGoalOpFromText, parseDraftGoalOp } from '../grc-draft-goal.ts';
import { createInitialGRCState, getEffectiveGoalState, getEffectiveObjectState, setRuntimeDraftGoalState, setRuntimeProvisionalOverlay } from '../grc-state.ts';
import { buildRuntimeProvisionalOverlayFromDraftGoalOp } from '../grc-provisional-overlay.ts';

test('parseDraftGoalOp accepts create payload', () => {
  const parsed = parseDraftGoalOp({
    action: 'create',
    goal: {
      assertion: '补齐 draft anchor',
      kind: 'goal',
      parentGoalId: null,
      atomicity: 'undecided',
      phase: 'plan',
    },
    reason: '当前消息引入新目标',
  });

  assert.deepEqual(parsed, {
    action: 'create',
    goal: {
      assertion: '补齐 draft anchor',
      kind: 'goal',
      parentGoalId: null,
      atomicity: 'undecided',
      phase: 'plan',
    },
    reason: '当前消息引入新目标',
  });
});

test('extractDraftGoalOpFromText reads trailing json fence', () => {
  const text = [
    '先做实现。',
    '```json',
    JSON.stringify({
      draftGoalOp: {
        action: 'create',
        goal: {
          assertion: '创建新的 draft 子目标',
          kind: 'subgoal',
          parentGoalId: 'root',
          atomicity: 'atomic',
          phase: 'execute',
        },
        reason: '当前消息新增独立子目标',
      },
    }, null, 2),
    '```',
  ].join('\n');

  const parsed = extractDraftGoalOpFromText(text);
  assert.equal(parsed?.action, 'create');
  assert.equal(parsed?.goal?.parentGoalId, 'root');
  assert.equal(parsed?.goal?.phase, 'execute');
});

test('applyDraftGoalOpToGoalTree appends draft root and focuses it', () => {
  const goalTree: GoalTreeDocument = {
    version: 2,
    agentRound: 9,
    updatedAt: '2026-05-20T09:00:00.000Z',
    rootGoalIds: ['root'],
    currentFocusGoalId: 'root',
    nodes: [
      {
        id: 'root',
        parentId: null,
        assertion: '已有目标',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'composite',
        phase: 'execute',
        sinceRound: 8,
        lastTouchedRound: 9,
        lastConfirmedRound: 9,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const next = applyDraftGoalOpToGoalTree(goalTree, {
    action: 'create',
    goal: {
      assertion: '当前轮新 root',
      kind: 'goal',
      parentGoalId: null,
      atomicity: 'undecided',
      phase: 'plan',
    },
    reason: '用户切换到新目标',
  }, 10);

  assert.equal(next.currentFocusGoalId, 'draft-10-root-1');
  assert.equal(next.nodes.some((node) => node.id === 'draft-10-root-1' && node.signal === 'draft'), true);
  assert.deepEqual(next.rootGoalIds, ['root', 'draft-10-root-1']);
});

test('applyDraftGoalOpToGoalTree appends draft child under parent', () => {
  const goalTree: GoalTreeDocument = {
    version: 2,
    agentRound: 9,
    updatedAt: '2026-05-20T09:00:00.000Z',
    rootGoalIds: ['root'],
    currentFocusGoalId: 'root',
    nodes: [
      {
        id: 'root',
        parentId: null,
        assertion: '已有目标',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'composite',
        phase: 'execute',
        sinceRound: 8,
        lastTouchedRound: 9,
        lastConfirmedRound: 9,
        priority: 0,
        order: 0,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const next = applyDraftGoalOpToGoalTree(goalTree, {
    action: 'create',
    goal: {
      assertion: '当前轮新 child',
      kind: 'subgoal',
      parentGoalId: 'root',
      atomicity: 'atomic',
      phase: 'execute',
    },
    reason: '细化当前目标',
  }, 10);

  const child = next.nodes.find((node) => node.id === 'draft-10-child-1');
  assert.equal(child?.parentId, 'root');
  assert.equal(child?.phase, 'execute');
  assert.equal(child?.atomicity, 'atomic');
  assert.equal(next.currentFocusGoalId, 'draft-10-child-1');
});

test('runtime draft overlay can bootstrap from empty v2 goal tree on first round', () => {
  const state = createInitialGRCState();
  const baseGoalState: GoalTreeDocument = {
    version: 2,
    agentRound: 0,
    updatedAt: '2026-05-20T09:00:00.000Z',
    rootGoalIds: [],
    currentFocusGoalId: null,
    nodes: [],
    migrations: [],
    prunedCount: 0,
  };

  const nextGoalState = applyDraftGoalOpToGoalTree(baseGoalState, {
    action: 'create',
    goal: {
      assertion: 'fresh real session proof',
      kind: 'goal',
      parentGoalId: null,
      atomicity: 'undecided',
      phase: 'plan',
    },
    reason: '首轮 lastGoalState 为空时仍需建立 overlay',
  }, 1);

  assert.equal(nextGoalState.currentFocusGoalId, 'draft-1-root-1');
  assert.deepEqual(nextGoalState.rootGoalIds, ['draft-1-root-1']);
  assert.equal(nextGoalState.nodes[0]?.signal, 'draft');

  const withOverlay = setRuntimeDraftGoalState(state, {
    baseGoalStateRound: null,
    sourceAgentRound: 1,
    createdAt: '2026-05-20T09:01:00.000Z',
    source: 'generator',
    goalState: nextGoalState,
  });

  const effective = getEffectiveGoalState(withOverlay);
  assert.equal(effective?.version, 2);
  assert.equal((effective as GoalTreeDocument).currentFocusGoalId, 'draft-1-root-1');
  assert.equal((effective as GoalTreeDocument).nodes[0]?.assertion, 'fresh real session proof');
});

test('runtime provisional overlay remains legacy-only and does not override mainline effective object state', () => {
  const state = createInitialGRCState();
  const overlay = buildRuntimeProvisionalOverlayFromDraftGoalOp({
    draftGoalOp: {
      action: 'create',
      goal: {
        assertion: 'fresh provisional anchor',
        kind: 'goal',
        parentGoalId: null,
        atomicity: 'undecided',
        phase: 'plan',
      },
      reason: '首轮先建立 provisional anchor',
    },
    currentAgentRound: 1,
    confirmedGoalState: {
      version: 2,
      agentRound: 0,
      updatedAt: '2026-05-20T09:00:00.000Z',
      rootGoalIds: [],
      currentFocusGoalId: null,
      nodes: [],
      migrations: [],
      prunedCount: 0,
    },
  });

  const withOverlay = setRuntimeProvisionalOverlay(state, overlay);
  const effective = getEffectiveObjectState(withOverlay);
  assert.equal(withOverlay.curator.lastUserGoalTree, null);
  assert.equal(withOverlay.curator.lastXNodeModels?.length, 0);
  assert.equal(effective.userGoalTree, null);
  assert.equal(effective.xNodeModels.length, 0);
});
