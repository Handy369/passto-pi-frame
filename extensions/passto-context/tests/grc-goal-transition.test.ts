import test from 'node:test';
import assert from 'node:assert/strict';

import { summarizeGoalTransition, summarizeGoalTransitionFromObjectSidecars } from '../grc-goal-transition.ts';
import type { GoalTreeDocument, UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

function makeTree(nodes: GoalTreeDocument['nodes'], currentFocusGoalId: string | null): GoalTreeDocument {
  return {
    version: 2,
    agentRound: 12,
    updatedAt: '2026-05-19T12:00:00.000Z',
    rootGoalIds: nodes.filter((node) => node.parentId === null && node.status !== 'completed').map((node) => node.id),
    currentFocusGoalId,
    nodes,
    migrations: [],
    prunedCount: 0,
  };
}

test('summarizeGoalTransition reports returning to parent after child completion', () => {
  const previous = makeTree([
    {
      id: 'child-a', parentId: 'root', assertion: '先完成 draft apply', kind: 'subgoal', status: 'active', signal: 'explicit', atomicity: 'atomic', phase: 'execute', sinceRound: 10, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 0,
    },
    {
      id: 'root', parentId: null, assertion: '推进 P4', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'composite', phase: 'execute', sinceRound: 9, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 1,
    },
  ], 'child-a');

  const next = makeTree([
    {
      id: 'child-a', parentId: 'root', assertion: '先完成 draft apply', kind: 'subgoal', status: 'completed', signal: 'explicit', atomicity: 'atomic', phase: 'complete', sinceRound: 10, lastTouchedRound: 11, lastConfirmedRound: 11, completedAtRound: 11, priority: 0, order: 0,
    },
    {
      id: 'root', parentId: null, assertion: '推进 P4 upward regression 证据', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'composite', phase: 'execute', sinceRound: 9, lastTouchedRound: 11, lastConfirmedRound: 11, priority: 0, order: 1,
    },
  ], 'root');

  assert.deepEqual(summarizeGoalTransition(previous, next), {
    label: '子目标完成，回到父目标: 推进 P4 upward regression 证据',
    completedAssertion: '先完成 draft apply',
    currentAssertion: '推进 P4 upward regression 证据',
  });
});

test('summarizeGoalTransition reports focus completion without new focus change', () => {
  const previous = makeTree([
    {
      id: 'goal-a', parentId: null, assertion: '完成当前 P4 子目标', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'atomic', phase: 'testing', sinceRound: 10, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 0,
    },
  ], 'goal-a');

  const next = makeTree([
    {
      id: 'goal-a', parentId: null, assertion: '完成当前 P4 子目标', kind: 'goal', status: 'completed', signal: 'explicit', atomicity: 'atomic', phase: 'complete', sinceRound: 10, lastTouchedRound: 11, lastConfirmedRound: 11, completedAtRound: 11, priority: 0, order: 0,
    },
  ], null);

  assert.deepEqual(summarizeGoalTransition(previous, next), {
    label: '目标完成: 完成当前 P4 子目标',
    completedAssertion: '完成当前 P4 子目标',
    currentAssertion: null,
  });
});

test('summarizeGoalTransition reports switching to sibling after child completion', () => {
  const previous = makeTree([
    {
      id: 'child-a', parentId: 'root', assertion: '先补 draft apply', kind: 'subgoal', status: 'active', signal: 'explicit', atomicity: 'atomic', phase: 'execute', sinceRound: 10, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 0,
    },
    {
      id: 'child-b', parentId: 'root', assertion: '再补 status/widget 证据', kind: 'subgoal', status: 'active', signal: 'inferred', atomicity: 'atomic', phase: 'plan', sinceRound: 10, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 1,
    },
    {
      id: 'root', parentId: null, assertion: '推进 P4', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'composite', phase: 'execute', sinceRound: 9, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 2,
    },
  ], 'child-a');

  const next = makeTree([
    {
      id: 'child-a', parentId: 'root', assertion: '先补 draft apply', kind: 'subgoal', status: 'completed', signal: 'explicit', atomicity: 'atomic', phase: 'complete', sinceRound: 10, lastTouchedRound: 11, lastConfirmedRound: 11, completedAtRound: 11, priority: 0, order: 0,
    },
    {
      id: 'child-b', parentId: 'root', assertion: '再补 status/widget 证据', kind: 'subgoal', status: 'active', signal: 'inferred', atomicity: 'atomic', phase: 'execute', sinceRound: 10, lastTouchedRound: 11, lastConfirmedRound: 11, priority: 0, order: 1,
    },
    {
      id: 'root', parentId: null, assertion: '推进 P4', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'composite', phase: 'execute', sinceRound: 9, lastTouchedRound: 11, lastConfirmedRound: 11, priority: 0, order: 2,
    },
  ], 'child-b');

  assert.deepEqual(summarizeGoalTransition(previous, next), {
    label: '子目标完成，切到兄弟目标: 再补 status/widget 证据',
    completedAssertion: '先补 draft apply',
    currentAssertion: '再补 status/widget 证据',
  });
});

test('summarizeGoalTransition reports focus change without completion', () => {
  const previous = makeTree([
    {
      id: 'goal-a', parentId: null, assertion: '先看 draft apply', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'atomic', phase: 'execute', sinceRound: 10, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 0,
    },
    {
      id: 'goal-b', parentId: null, assertion: '改去补 status/widget 证据', kind: 'goal', status: 'active', signal: 'inferred', atomicity: 'atomic', phase: 'plan', sinceRound: 10, lastTouchedRound: 11, lastConfirmedRound: 11, priority: 0, order: 1,
    },
  ], 'goal-a');

  const next = makeTree([
    {
      id: 'goal-a', parentId: null, assertion: '先看 draft apply', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'atomic', phase: 'execute', sinceRound: 10, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 0,
    },
    {
      id: 'goal-b', parentId: null, assertion: '改去补 status/widget 证据', kind: 'goal', status: 'active', signal: 'inferred', atomicity: 'atomic', phase: 'execute', sinceRound: 10, lastTouchedRound: 11, lastConfirmedRound: 11, priority: 0, order: 1,
    },
  ], 'goal-b');

  assert.deepEqual(summarizeGoalTransition(previous, next), {
    label: '目标改变为: 改去补 status/widget 证据',
    completedAssertion: null,
    currentAssertion: '改去补 status/widget 证据',
  });
});

test('summarizeGoalTransition reports assertion rewrite on same focus node', () => {
  const previous = makeTree([
    {
      id: 'goal-a', parentId: null, assertion: '推进 P4', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'composite', phase: 'execute', sinceRound: 10, lastTouchedRound: 10, lastConfirmedRound: 10, priority: 0, order: 0,
    },
  ], 'goal-a');

  const next = makeTree([
    {
      id: 'goal-a', parentId: null, assertion: '推进 P4 upward regression 证据', kind: 'goal', status: 'active', signal: 'explicit', atomicity: 'composite', phase: 'execute', sinceRound: 10, lastTouchedRound: 11, lastConfirmedRound: 11, priority: 0, order: 0,
    },
  ], 'goal-a');

  assert.deepEqual(summarizeGoalTransition(previous, next), {
    label: '目标改写为: 推进 P4 upward regression 证据',
    completedAssertion: null,
    currentAssertion: '推进 P4 upward regression 证据',
  });
});

test('summarizeGoalTransitionFromObjectSidecars prefers object-first focus change', () => {
  const previousUserGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 10,
    updatedAt: '2026-05-20T10:00:00.000Z',
    currentFocusUserGoalId: 'goal-a',
    rootUserGoalIds: ['goal-a', 'goal-b'],
    userGoals: [
      { id: 'goal-a', parentId: null, assertion: '先补 draft apply', status: 'executing', xNodeModelId: 'xnode-goal-a', sinceRound: 9, lastTouchedRound: 10 },
      { id: 'goal-b', parentId: null, assertion: '改去补 status/widget 证据', status: 'planning', xNodeModelId: 'xnode-goal-b', sinceRound: 9, lastTouchedRound: 10 },
    ],
  };
  const previousXNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-a',
      agentRound: 10,
      updatedAt: '2026-05-20T10:00:00.000Z',
      currentFocusXNodeId: 'goal-a',
      rootXNodeIds: ['goal-a'],
      nodes: [
        {
          id: 'goal-a', parentId: null, assertion: '先补 draft apply', status: 'active', atomicity: 'atomic', phase: 'execute',
          why: { summary: 'a', confidence: 'partial' }, what: { summary: 'a', confidence: 'partial' }, flow: { summary: 'a', confidence: 'partial' }, structure: { summary: 'a', confidence: 'partial' }, runtimeProof: { summary: 'a', confidence: 'open' },
          sinceRound: 9, lastTouchedRound: 10, priority: 0, order: 0,
        },
      ],
    },
    {
      version: 1,
      userGoalId: 'goal-b',
      agentRound: 10,
      updatedAt: '2026-05-20T10:00:00.000Z',
      currentFocusXNodeId: 'goal-b',
      rootXNodeIds: ['goal-b'],
      nodes: [
        {
          id: 'goal-b', parentId: null, assertion: '改去补 status/widget 证据', status: 'active', atomicity: 'atomic', phase: 'plan',
          why: { summary: 'b', confidence: 'partial' }, what: { summary: 'b', confidence: 'partial' }, flow: { summary: 'b', confidence: 'partial' }, structure: { summary: 'b', confidence: 'partial' }, runtimeProof: { summary: 'b', confidence: 'open' },
          sinceRound: 9, lastTouchedRound: 10, priority: 0, order: 0,
        },
      ],
    },
  ];

  const nextUserGoalTree: UserGoalTreeDocument = {
    ...previousUserGoalTree,
    agentRound: 11,
    updatedAt: '2026-05-20T11:00:00.000Z',
    currentFocusUserGoalId: 'goal-b',
    userGoals: [
      { ...previousUserGoalTree.userGoals[0]!, lastTouchedRound: 10 },
      { ...previousUserGoalTree.userGoals[1]!, status: 'executing', lastTouchedRound: 11 },
    ],
  };
  const nextXNodeModels: XNodeModelDocument[] = [
    previousXNodeModels[0]!,
    {
      ...previousXNodeModels[1]!,
      agentRound: 11,
      updatedAt: '2026-05-20T11:00:00.000Z',
      nodes: [{ ...previousXNodeModels[1]!.nodes[0]!, phase: 'execute', lastTouchedRound: 11 }],
    },
  ];

  assert.deepEqual(
    summarizeGoalTransitionFromObjectSidecars(previousUserGoalTree, previousXNodeModels, nextUserGoalTree, nextXNodeModels),
    {
      label: '目标改变为: 改去补 status/widget 证据',
      completedAssertion: null,
      currentAssertion: '改去补 status/widget 证据',
    },
  );
});

test('summarizeGoalTransitionFromObjectSidecars reports returning to parent after child completion', () => {
  const previousUserGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 20,
    updatedAt: '2026-05-21T08:00:00.000Z',
    currentFocusUserGoalId: 'goal-root',
    rootUserGoalIds: ['goal-root'],
    userGoals: [
      { id: 'goal-root', parentId: null, assertion: '推进 S1 shrink', status: 'executing', xNodeModelId: 'xnode-goal-root', sinceRound: 18, lastTouchedRound: 20 },
    ],
  };
  const previousXNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-root',
      agentRound: 20,
      updatedAt: '2026-05-21T08:00:00.000Z',
      currentFocusXNodeId: 'child-a',
      rootXNodeIds: ['goal-root'],
      nodes: [
        {
          id: 'goal-root', parentId: null, assertion: '推进 S1 shrink', status: 'active', atomicity: 'composite', phase: 'execute',
          why: { summary: 'root', confidence: 'partial' }, what: { summary: 'root', confidence: 'partial' }, flow: { summary: 'root', confidence: 'partial' }, structure: { summary: 'root', confidence: 'partial' }, runtimeProof: { summary: 'root', confidence: 'open' },
          sinceRound: 18, lastTouchedRound: 20, priority: 0, order: 0,
        },
        {
          id: 'child-a', parentId: 'goal-root', assertion: '先收紧 goal-view primary path', status: 'active', atomicity: 'atomic', phase: 'execute',
          why: { summary: 'child-a', confidence: 'partial' }, what: { summary: 'child-a', confidence: 'partial' }, flow: { summary: 'child-a', confidence: 'partial' }, structure: { summary: 'child-a', confidence: 'partial' }, runtimeProof: { summary: 'child-a', confidence: 'open' },
          sinceRound: 19, lastTouchedRound: 20, priority: 0, order: 0,
        },
      ],
    },
  ];

  const nextXNodeModels: XNodeModelDocument[] = [
    {
      ...previousXNodeModels[0]!,
      agentRound: 21,
      updatedAt: '2026-05-21T08:10:00.000Z',
      currentFocusXNodeId: 'goal-root',
      nodes: [
        { ...previousXNodeModels[0]!.nodes[0]!, lastTouchedRound: 21 },
        { ...previousXNodeModels[0]!.nodes[1]!, status: 'completed', phase: 'complete', lastTouchedRound: 21, completedAtRound: 21 },
      ],
    },
  ];
  const nextUserGoalTree: UserGoalTreeDocument = {
    ...previousUserGoalTree,
    agentRound: 21,
    updatedAt: '2026-05-21T08:10:00.000Z',
    userGoals: [{ ...previousUserGoalTree.userGoals[0]!, lastTouchedRound: 21 }],
  };

  assert.deepEqual(
    summarizeGoalTransitionFromObjectSidecars(previousUserGoalTree, previousXNodeModels, nextUserGoalTree, nextXNodeModels),
    {
      label: '子目标完成，回到父目标: 推进 S1 shrink',
      completedAssertion: '先收紧 goal-view primary path',
      currentAssertion: '推进 S1 shrink',
    },
  );
});

test('summarizeGoalTransitionFromObjectSidecars reports switching to sibling after child completion', () => {
  const previousUserGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 20,
    updatedAt: '2026-05-21T08:00:00.000Z',
    currentFocusUserGoalId: 'goal-root',
    rootUserGoalIds: ['goal-root'],
    userGoals: [
      { id: 'goal-root', parentId: null, assertion: '推进 S1 shrink', status: 'executing', xNodeModelId: 'xnode-goal-root', sinceRound: 18, lastTouchedRound: 20 },
    ],
  };
  const previousXNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-root',
      agentRound: 20,
      updatedAt: '2026-05-21T08:00:00.000Z',
      currentFocusXNodeId: 'child-a',
      rootXNodeIds: ['goal-root'],
      nodes: [
        {
          id: 'goal-root', parentId: null, assertion: '推进 S1 shrink', status: 'active', atomicity: 'composite', phase: 'execute',
          why: { summary: 'root', confidence: 'partial' }, what: { summary: 'root', confidence: 'partial' }, flow: { summary: 'root', confidence: 'partial' }, structure: { summary: 'root', confidence: 'partial' }, runtimeProof: { summary: 'root', confidence: 'open' },
          sinceRound: 18, lastTouchedRound: 20, priority: 0, order: 0,
        },
        {
          id: 'child-a', parentId: 'goal-root', assertion: '先收紧 goal-view primary path', status: 'active', atomicity: 'atomic', phase: 'execute',
          why: { summary: 'child-a', confidence: 'partial' }, what: { summary: 'child-a', confidence: 'partial' }, flow: { summary: 'child-a', confidence: 'partial' }, structure: { summary: 'child-a', confidence: 'partial' }, runtimeProof: { summary: 'child-a', confidence: 'open' },
          sinceRound: 19, lastTouchedRound: 20, priority: 0, order: 0,
        },
        {
          id: 'child-b', parentId: 'goal-root', assertion: '再收紧 goal-state-summary primary path', status: 'active', atomicity: 'atomic', phase: 'plan',
          why: { summary: 'child-b', confidence: 'partial' }, what: { summary: 'child-b', confidence: 'partial' }, flow: { summary: 'child-b', confidence: 'partial' }, structure: { summary: 'child-b', confidence: 'partial' }, runtimeProof: { summary: 'child-b', confidence: 'open' },
          sinceRound: 19, lastTouchedRound: 20, priority: 0, order: 1,
        },
      ],
    },
  ];

  const nextXNodeModels: XNodeModelDocument[] = [
    {
      ...previousXNodeModels[0]!,
      agentRound: 21,
      updatedAt: '2026-05-21T08:10:00.000Z',
      currentFocusXNodeId: 'child-b',
      nodes: [
        { ...previousXNodeModels[0]!.nodes[0]!, lastTouchedRound: 21 },
        { ...previousXNodeModels[0]!.nodes[1]!, status: 'completed', phase: 'complete', lastTouchedRound: 21, completedAtRound: 21 },
        { ...previousXNodeModels[0]!.nodes[2]!, phase: 'execute', lastTouchedRound: 21 },
      ],
    },
  ];
  const nextUserGoalTree: UserGoalTreeDocument = {
    ...previousUserGoalTree,
    agentRound: 21,
    updatedAt: '2026-05-21T08:10:00.000Z',
    userGoals: [{ ...previousUserGoalTree.userGoals[0]!, lastTouchedRound: 21 }],
  };

  assert.deepEqual(
    summarizeGoalTransitionFromObjectSidecars(previousUserGoalTree, previousXNodeModels, nextUserGoalTree, nextXNodeModels),
    {
      label: '子目标完成，切到兄弟目标: 再收紧 goal-state-summary primary path',
      completedAssertion: '先收紧 goal-view primary path',
      currentAssertion: '再收紧 goal-state-summary primary path',
    },
  );
});
