import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReflectorGoalContext } from '../grc-goal-context.ts';
import { buildGoalStateInjection } from '../grc-prompts.ts';
import type { GoalStateDocument } from '../types.ts';

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
    `- [${context.focusPath[0]?.status}] ${context.focusPath[0]?.assertion}`,
  );

  for (const sibling of context.siblingActiveGoals) {
    assert.match(injection, new RegExp(escapeRegExp(sibling.assertion)));
  }

  assert.match(injection, /最近目标迁移:/);
  assert.match(injection, /g-legacy → g-focus/);
  assert.match(injection, /最近完成目标:/);
  assert.match(injection, /完成 SummaryCache 去重注入/);
});
