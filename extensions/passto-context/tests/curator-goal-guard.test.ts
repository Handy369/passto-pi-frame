import test from 'node:test';
import assert from 'node:assert/strict';

import { getCuratorGoalStateRejectionReasons, reconcileCuratorGoalState } from '../grc-curator-guard.ts';
import type { CuratorResult, GoalStateDocument } from '../types.ts';

const previousGoalState: GoalStateDocument = {
  version: 1,
  agentRound: 1,
  updatedAt: '2026-05-10T00:00:00.000Z',
  active: [
    {
      id: 'goal-1',
      assertion: '持续按固定格式回复，直到收到 STOP',
      status: 'active',
      sinceRound: 1,
      lastConfirmedRound: 1,
      signal: 'explicit',
    },
  ],
  completed: [],
  migrations: [],
  prunedCount: 0,
};

test('getCuratorGoalStateRejectionReasons returns existing-active-cleared-without-closure when old active is dropped without closure evidence', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续处理当前长期规则\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.8, evidence: '当前消息不足以关闭旧目标' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续处理当前长期规则',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  assert.deepEqual(getCuratorGoalStateRejectionReasons(previousGoalState, result), ['existing-active-cleared-without-closure']);
});

test('reconcileCuratorGoalState rejects structured payload when previous active exists but new active becomes empty without closure evidence', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续处理当前长期规则\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.8, evidence: '当前消息不足以关闭旧目标' },
    closureEvidence: [],
    summaryEntry: null,
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续处理当前长期规则',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const reconciled = reconcileCuratorGoalState(previousGoalState, result);
  assert.equal(reconciled?.summaryEntry, null);
  assert.equal(reconciled?.goalState, null);
  assert.equal(reconciled?.signal, null);
});

test('reconcileCuratorGoalState allows clearing active goals when closure evidence exists', () => {
  const result: CuratorResult = {
    summary: '## 目标\n结束长期规则\n\n## 已完成\n- 用户明确说 STOP',
    signal: { type: 'correct', confidence: 0.95, evidence: '用户明确说 STOP' },
    closureEvidence: ['用户明确说 STOP'],
    summaryEntry: null,
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [
        {
          id: 'goal-1',
          assertion: '持续按固定格式回复，直到收到 STOP',
          completedAtRound: 2,
        },
      ],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '结束长期规则',
      completed: ['用户明确说 STOP'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const reconciled = reconcileCuratorGoalState(previousGoalState, result);
  assert.equal(reconciled?.goalState?.active.length, 0);
  assert.equal(reconciled?.goalState?.completed[0]?.completedAtRound, 2);
});

test('getCuratorGoalStateRejectionReasons returns summary-goal-without-active when summary goal is non-empty but active goals are empty', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续补强 Curator 契约\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.76, evidence: '用户仍在当前目标链上推进' },
    closureEvidence: [],
    summaryEntry: {
      agentRound: 2,
      timestamp: '2026-05-10T00:01:00.000Z',
      summary: {
        goal: '继续补强 Curator 契约',
        completed: [],
        keyDecisions: [],
        filesChanged: [],
        status: '当前目标仍在继续。',
        blockers: [],
      },
    },
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续补强 Curator 契约',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  assert.deepEqual(getCuratorGoalStateRejectionReasons(null, result), ['summary-goal-without-active']);
});

test('reconcileCuratorGoalState rejects structured payload when summary goal exists but active goals are empty without closure evidence', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续补强 Curator 契约\n\n## 已完成\n- 无',
    signal: { type: 'continue', confidence: 0.76, evidence: '用户仍在当前目标链上推进' },
    closureEvidence: [],
    summaryEntry: {
      agentRound: 2,
      timestamp: '2026-05-10T00:01:00.000Z',
      summary: {
        goal: '继续补强 Curator 契约',
        completed: [],
        keyDecisions: [],
        filesChanged: [],
        status: '当前目标仍在继续。',
        blockers: [],
      },
    },
    goalState: {
      version: 1,
      agentRound: 2,
      updatedAt: '2026-05-10T00:01:00.000Z',
      active: [],
      completed: [],
      migrations: [],
      prunedCount: 0,
    },
    sections: {
      goal: '继续补强 Curator 契约',
      completed: ['无'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const reconciled = reconcileCuratorGoalState(null, result);
  assert.equal(reconciled?.summaryEntry, null);
  assert.equal(reconciled?.goalState, null);
  assert.equal(reconciled?.signal, null);
});
