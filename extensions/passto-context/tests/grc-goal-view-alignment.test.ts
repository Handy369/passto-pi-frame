import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReflectorGoalContext, buildReflectorGoalContextFromObjectSidecars } from '../grc-goal-context.ts';
import { buildGoalStateInjection, buildGoalStateInjectionFromObjectSidecars } from '../grc-prompts.ts';
import { buildGoalViewModelFromObjectSidecars } from '../grc-goal-view.ts';
import type { GoalStateDocument, GoalTreeDocument, UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

const goalState: GoalStateDocument = {
  version: 1,
  agentRound: 14,
  updatedAt: '2026-05-09T14:00:00.000Z',
  active: [
    {
      id: 'g-older',
      assertion: '清理旧的 context fallback',
      status: 'active',
      sinceRound: 10,
      lastConfirmedRound: 10,
      signal: 'inferred',
    },
    {
      id: 'g-focus',
      assertion: '统一 GoalState 注入与 ReflectorGoalContext',
      status: 'active',
      sinceRound: 13,
      lastConfirmedRound: 14,
      signal: 'explicit',
    },
    {
      id: 'g-sibling',
      assertion: '收紧 compaction 到 curator-only 接管',
      status: 'suspended',
      sinceRound: 12,
      lastConfirmedRound: 13,
      signal: 'explicit',
    },
  ],
  completed: [
    {
      id: 'g-done',
      assertion: '完成 SummaryCache 去重注入',
      completedAtRound: 12,
    },
  ],
  migrations: [
    {
      from: 'g-legacy',
      to: 'g-focus',
      atRound: 14,
      reason: 'P4 需要统一目标焦点视图，避免主模型与 Reflector 看到不同的目标基线。',
    },
  ],
  prunedCount: 0,
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('buildGoalStateInjection uses the same focus selection as ReflectorGoalContext', () => {
  const context = buildReflectorGoalContext(goalState);
  const injection = buildGoalStateInjection(goalState, 3);

  assert.ok(context);
  assert.equal(context.currentFocusGoalId, 'g-focus');
  assert.equal(context.focusPath[0]?.assertion, '统一 GoalState 注入与 ReflectorGoalContext');

  const lines = injection.split('\n');
  const focusHeaderIndex = lines.indexOf('当前焦点目标:');
  assert.notEqual(focusHeaderIndex, -1);
  assert.equal(
    lines[focusHeaderIndex + 1],
    `- [${context.focusPath[0]?.status}][${context.focusPath[0]?.signal}] ${context.focusPath[0]?.assertion}`,
  );

  for (const sibling of context.siblingActiveGoals) {
    assert.match(injection, new RegExp(escapeRegExp(sibling.assertion)));
  }

  assert.match(injection, /最近目标迁移:/);
  assert.match(injection, /g-legacy → g-focus/);
  assert.match(injection, /最近完成目标:/);
  assert.match(injection, /完成 SummaryCache 去重注入/);
});

test('buildGoalStateInjection renders draft signal in goal tree focus, siblings and children', () => {
  const goalTree: GoalTreeDocument = {
    version: 2,
    agentRound: 21,
    updatedAt: '2026-05-20T11:00:00.000Z',
    rootGoalIds: ['draft-root'],
    currentFocusGoalId: 'draft-root',
    nodes: [
      {
        id: 'draft-root',
        parentId: null,
        assertion: '当前轮 provisional 目标',
        kind: 'goal',
        status: 'active',
        signal: 'draft',
        atomicity: 'undecided',
        phase: 'plan',
        sinceRound: 21,
        lastTouchedRound: 21,
        lastConfirmedRound: 21,
        priority: 0,
        order: 0,
      },
      {
        id: 'draft-child',
        parentId: 'draft-root',
        assertion: '围绕 draft 展开的子任务',
        kind: 'subgoal',
        status: 'active',
        signal: 'draft',
        atomicity: 'atomic',
        phase: 'execute',
        sinceRound: 21,
        lastTouchedRound: 21,
        lastConfirmedRound: 21,
        priority: 0,
        order: 0,
      },
      {
        id: 'draft-sibling',
        parentId: null,
        assertion: '另一个 draft 并行目标',
        kind: 'goal',
        status: 'suspended',
        signal: 'draft',
        atomicity: 'undecided',
        phase: 'plan',
        sinceRound: 21,
        lastTouchedRound: 21,
        lastConfirmedRound: 21,
        priority: 0,
        order: 1,
      },
    ],
    migrations: [],
    prunedCount: 0,
  };

  const injection = buildGoalStateInjection(goalTree, 3);
  assert.match(injection, /\[active\]\[draft\]\[undecided\]\[plan\] 当前轮 provisional 目标/);
  assert.match(injection, /\[active\]\[draft\]\[execute\] 围绕 draft 展开的子任务/);
  assert.match(injection, /并行活跃目标:/);
  assert.match(injection, /\[draft\]\[plan\] 另一个 draft 并行目标/);
});

test('buildGoalStateInjection renders goal tree atomicity and phase consistently with reflector goal context', () => {
  const goalTree: GoalTreeDocument = {
    version: 2,
    agentRound: 20,
    updatedAt: '2026-05-20T10:00:00.000Z',
    rootGoalIds: ['root'],
    currentFocusGoalId: 'child',
    nodes: [
      {
        id: 'root',
        parentId: null,
        assertion: 'PasstoContext V2.0 实施',
        kind: 'goal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'composite',
        phase: 'execute',
        sinceRound: 18,
        lastTouchedRound: 20,
        lastConfirmedRound: 20,
        priority: 0,
        order: 0,
      },
      {
        id: 'child',
        parentId: 'root',
        assertion: '实现 GoalTree 注入视图',
        kind: 'subgoal',
        status: 'active',
        signal: 'explicit',
        atomicity: 'atomic',
        phase: 'testing',
        sinceRound: 19,
        lastTouchedRound: 20,
        lastConfirmedRound: 20,
        priority: 0,
        order: 0,
      },
      {
        id: 'sibling',
        parentId: 'root',
        assertion: '实现 Curator GoalTree parser',
        kind: 'subgoal',
        status: 'suspended',
        signal: 'explicit',
        atomicity: 'atomic',
        phase: 'plan',
        sinceRound: 19,
        lastTouchedRound: 19,
        lastConfirmedRound: 19,
        priority: 0,
        order: 1,
      },
    ],
    migrations: [
      {
        id: 'm-1',
        fromGoalId: 'old',
        toGoalId: 'child',
        type: 'refine',
        atRound: 20,
        triggerSignal: 'advance',
        reason: '焦点下钻到具体实现子目标',
      },
    ],
    prunedCount: 0,
  };

  const context = buildReflectorGoalContext(goalTree);
  const injection = buildGoalStateInjection(goalTree, 3);

  assert.ok(context);
  assert.equal(context.currentFocusGoalId, 'child');
  assert.equal(context.focusPath.length, 2);
  assert.equal(context.focusPath[1]?.phase, 'testing');
  assert.equal(context.focusPath[1]?.atomicity, 'atomic');
  assert.match(injection, /\[active\]\[explicit\]\[composite\]\[execute\] PasstoContext V2.0 实施/);
  assert.match(injection, /\[active\]\[explicit\]\[atomic\]\[testing\] 实现 GoalTree 注入视图/);
  assert.match(injection, /并行活跃目标:/);
  assert.match(injection, /实现 Curator GoalTree parser/);
  assert.match(injection, /最近目标迁移:/);
});

test('object-sidecar goal view and reflector context stay aligned on focus path', () => {
  const userGoalTree: UserGoalTreeDocument = {
    version: 1,
    agentRound: 20,
    updatedAt: '2026-05-20T10:00:00.000Z',
    currentFocusUserGoalId: 'goal-root',
    rootUserGoalIds: ['goal-root'],
    userGoals: [
      {
        id: 'goal-root',
        parentId: null,
        assertion: 'PasstoContext V2.0 实施',
        status: 'executing',
        xNodeModelId: 'xnode-goal-root',
        sinceRound: 18,
        lastTouchedRound: 20,
      },
    ],
  };
  const xNodeModels: XNodeModelDocument[] = [
    {
      version: 1,
      userGoalId: 'goal-root',
      agentRound: 20,
      updatedAt: '2026-05-20T10:00:00.000Z',
      currentFocusXNodeId: 'child',
      rootXNodeIds: ['goal-root'],
      nodes: [
        {
          id: 'goal-root', parentId: null, assertion: 'PasstoContext V2.0 实施', status: 'active', atomicity: 'composite', phase: 'execute',
          why: { summary: 'root', confidence: 'partial' }, what: { summary: 'root', confidence: 'partial' }, flow: { summary: 'root', confidence: 'partial' }, structure: { summary: 'root', confidence: 'partial' }, runtimeProof: { summary: 'root', confidence: 'open' },
          sinceRound: 18, lastTouchedRound: 20, priority: 0, order: 0,
        },
        {
          id: 'child', parentId: 'goal-root', assertion: '实现 object-first goal view', status: 'active', atomicity: 'atomic', phase: 'testing',
          why: { summary: 'child', confidence: 'partial' }, what: { summary: 'child', confidence: 'partial' }, flow: { summary: 'child', confidence: 'partial' }, structure: { summary: 'child', confidence: 'partial' }, runtimeProof: { summary: 'child', confidence: 'open' },
          sinceRound: 19, lastTouchedRound: 20, priority: 0, order: 0,
        },
      ],
    },
  ];

  const context = buildReflectorGoalContextFromObjectSidecars(userGoalTree, xNodeModels);
  const view = buildGoalViewModelFromObjectSidecars(userGoalTree, xNodeModels);
  const injection = buildGoalStateInjectionFromObjectSidecars(userGoalTree, xNodeModels, 3);

  assert.ok(context);
  assert.ok(view);
  assert.equal(context.currentFocusGoalId, 'child');
  assert.equal(view.currentFocusGoalId, 'child');
  assert.equal(context.focusPath.length, 2);
  assert.equal(view.focusPath.length, 2);
  assert.equal(context.focusPath[1]?.assertion, '实现 object-first goal view');
  assert.equal(view.focusPath[1]?.assertion, '实现 object-first goal view');
  assert.match(injection, /\[active\]\[explicit\]\[composite\]\[execute\] PasstoContext V2.0 实施/);
  assert.match(injection, /\[active\]\[inferred\]\[atomic\]\[testing\] 实现 object-first goal view/);
});
