import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReflectorGoalContext } from '../grc-goal-context.ts';
import { buildReflectionSteerPrompt, buildReflectorSubagentPrompt } from '../grc-prompts.ts';
import type { GoalStateDocument } from '../types.ts';

const goalState: GoalStateDocument = {
  version: 1,
  agentRound: 12,
  updatedAt: '2026-05-09T12:00:00.000Z',
  active: [
    {
      id: 'g-12',
      assertion: '升级 Reflector 输入契约',
      status: 'active',
      sinceRound: 12,
      lastConfirmedRound: 12,
      signal: 'explicit',
    },
    {
      id: 'g-10',
      assertion: '保留 GoalState 作为当前目标单核',
      status: 'suspended',
      sinceRound: 10,
      lastConfirmedRound: 11,
      signal: 'explicit',
    },
    {
      id: 'g-8',
      assertion: '清理旧账本设计残留',
      status: 'active',
      sinceRound: 8,
      lastConfirmedRound: 9,
      signal: 'inferred',
    },
  ],
  completed: [
    {
      id: 'g-6',
      assertion: '完成 v1.1 设计文档收敛',
      completedAtRound: 11,
    },
  ],
  migrations: [
    {
      from: 'g-11',
      to: 'g-12',
      atRound: 12,
      reason: '用户要求 Reflector 根据当前 GoalState 判断方向是否偏离。',
    },
  ],
  prunedCount: 0,
};

test('buildReflectorGoalContext derives focus and sibling goals from GoalStateDocument', () => {
  const context = buildReflectorGoalContext(goalState);
  assert.ok(context);
  assert.equal(context.currentFocusGoalId, 'g-12');
  assert.deepEqual(context.focusPath, [
    {
      id: 'g-12',
      assertion: '升级 Reflector 输入契约',
      status: 'active',
    },
  ]);
  assert.deepEqual(context.siblingActiveGoals, [
    {
      id: 'g-10',
      assertion: '保留 GoalState 作为当前目标单核',
    },
    {
      id: 'g-8',
      assertion: '清理旧账本设计残留',
    },
  ]);
  assert.deepEqual(context.recentMigrations, [
    {
      fromGoalId: 'g-11',
      toGoalId: 'g-12',
      reason: '用户要求 Reflector 根据当前 GoalState 判断方向是否偏离。',
    },
  ]);
});

test('buildReflectorSubagentPrompt includes current goal state and goal context payloads', () => {
  const context = buildReflectorGoalContext(goalState);
  const prompt = buildReflectorSubagentPrompt({
    currentRoundConversation: '[User]\n请升级 Reflector 输入\n\n[Assistant]\n开始修改',
    currentGoalState: goalState,
    goalContext: context,
  });

  assert.match(prompt, /<current_goal_state>/);
  assert.match(prompt, /<goal_context>/);
  assert.match(prompt, /升级 Reflector 输入契约/);
  assert.match(prompt, /currentGoalState \/ goalContext/);
  assert.match(prompt, /## 目标对齐判断/);
  assert.match(prompt, /## 顾问意见/);
  assert.match(prompt, /"diagnosis"/);
  assert.match(prompt, /"currentFocusGoalId": "g-12"/);
});

test('buildReflectionSteerPrompt stays lightweight and focuses on loop avoidance', () => {
  const prompt = buildReflectionSteerPrompt();

  assert.match(prompt, /agent-round 已经持续了较多 turn/);
  assert.match(prompt, /极短反思/);
  assert.match(prompt, /重复读取\/调用相近工具/);
  assert.match(prompt, /下一步只做一个最能推进结果的动作/);
  assert.doesNotMatch(prompt, /summaryCacheExcerpt/);
  assert.doesNotMatch(prompt, /principleOps/);
  assert.doesNotMatch(prompt, /assetCandidates/);
});
