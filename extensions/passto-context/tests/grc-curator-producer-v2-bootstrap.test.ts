import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuratorSubagentPrompt } from '../grc-prompts.ts';
import { normalizeGoalStateForCurator } from '../grc-subagent.ts';
import type { GoalStateDocument } from '../types.ts';

const v1GoalState: GoalStateDocument = {
  version: 1,
  agentRound: 12,
  updatedAt: '2026-05-19T12:00:00.000Z',
  active: [
    {
      id: 'goal-1',
      assertion: '清理 index.ts 中 V1-only runtime surface',
      status: 'active',
      sinceRound: 11,
      lastConfirmedRound: 12,
      signal: 'explicit',
    },
    {
      id: 'goal-2',
      assertion: '准备切换 Curator 默认 GoalTree 输入',
      status: 'suspended',
      sinceRound: 11,
      lastConfirmedRound: 12,
      signal: 'explicit',
    },
  ],
  completed: [
    {
      id: 'goal-0',
      assertion: '重写 runtime-gap-analysis.md',
      completedAtRound: 10,
    },
  ],
  migrations: [
    {
      from: '旧 gap 判断',
      to: '真实代码核对',
      atRound: 11,
      reason: '先查代码再下结论',
    },
  ],
  prunedCount: 0,
};

test('normalizeGoalStateForCurator upgrades v1 goal state to goal tree document', () => {
  const normalized = normalizeGoalStateForCurator(v1GoalState);

  assert.ok(normalized);
  assert.equal(normalized?.version, 2);
  assert.equal(normalized?.agentRound, 12);
  assert.equal('nodes' in normalized!, true);
  assert.equal((normalized as { nodes: unknown[] }).nodes.length, 3);
  assert.equal((normalized as { currentFocusGoalId: string | null }).currentFocusGoalId, 'goal-1');
});

test('curator producer bootstrap causes prompt to enter v2 goal tree branch for legacy v1 input', () => {
  const normalized = normalizeGoalStateForCurator(v1GoalState);
  const prompt = buildCuratorSubagentPrompt(
    '[User]\n继续推进 runtime 修复\n\n[Assistant]\n先清理 V1-only surface',
    '继续，把 Curator 默认切到 GoalTree 输入',
    JSON.stringify(normalized, null, 2),
    13,
  );

  assert.match(prompt, /GoalTree 更新规则（V2）/);
  assert.match(prompt, /当前 GoalState 是 version: 2 的归一化目标树/);
  assert.match(prompt, /Atomicity 判定/);
  assert.match(prompt, /Phase 推进/);
  assert.match(prompt, /任务新增：Policy Projection/);

  const currentGoalStateBlock = prompt.match(/<current_goal_state>\n([\s\S]*?)\n<\/current_goal_state>/)?.[1] ?? '';
  assert.match(currentGoalStateBlock, /"version": 2/);
  assert.doesNotMatch(currentGoalStateBlock, /"version": 1/);
});

test('normalizeGoalStateForCurator bootstraps null input to empty v2 goal tree document', () => {
  const normalized = normalizeGoalStateForCurator(null);

  assert.ok(normalized);
  assert.equal(normalized?.version, 2);
  assert.equal(normalized?.agentRound, 0);
  assert.equal((normalized as { currentFocusGoalId: string | null }).currentFocusGoalId, null);
  assert.deepEqual((normalized as { rootGoalIds: string[] }).rootGoalIds, []);
  assert.deepEqual((normalized as { nodes: unknown[] }).nodes, []);
  assert.deepEqual((normalized as { migrations: unknown[] }).migrations, []);
});

test('curator producer bootstrap causes prompt to enter v2 goal tree branch for null input', () => {
  const normalized = normalizeGoalStateForCurator(null);
  const prompt = buildCuratorSubagentPrompt(
    '[User]\n继续推进 runtime 修复\n\n[Assistant]\n先补 fresh proof',
    '继续，验证 cold start curator 是否默认进入 GoalTree',
    JSON.stringify(normalized, null, 2),
    1,
  );

  assert.match(prompt, /GoalTree 更新规则（V2）/);
  assert.match(prompt, /当前 GoalState 是 version: 2 的归一化目标树/);
  assert.match(prompt, /任务新增：Policy Projection/);

  const currentGoalStateBlock = prompt.match(/<current_goal_state>\n([\s\S]*?)\n<\/current_goal_state>/)?.[1] ?? '';
  assert.match(currentGoalStateBlock, /"version": 2/);
  assert.match(currentGoalStateBlock, /"rootGoalIds": \[\]/);
  assert.match(currentGoalStateBlock, /"currentFocusGoalId": null/);
});
