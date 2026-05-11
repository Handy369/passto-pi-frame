import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeCuratorResultAgentRound } from '../grc-curator-normalizer.ts';
import type { CuratorResult } from '../types.ts';

test('normalizeCuratorResultAgentRound overrides top-level summaryEntry and goalState agentRound to targetPreviousAgentRound', () => {
  const result: CuratorResult = {
    summary: '## 目标\n修复 round 错位\n\n## 已完成\n- 发现模型输出 agentRound 不可信',
    signal: {
      type: 'advance',
      confidence: 0.9,
      evidence: '模型多次返回与 targetPreviousAgentRound 不一致的 round。',
    },
    sections: {
      goal: '修复 round 错位',
      completed: ['发现模型输出 agentRound 不可信'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
    summaryEntry: {
      agentRound: 2,
      timestamp: '2026-05-09T10:00:00.000Z',
      summary: {
        goal: '修复 round 错位',
        completed: ['归一化 summaryEntry.agentRound'],
        keyDecisions: ['不要信任模型返回的 round'],
        filesChanged: [{ path: 'index.ts', action: 'edit' }],
        status: '进行中',
        blockers: [],
      },
      sessionPointers: {
        searchQuery: 'round normalization',
      },
    },
    goalState: {
      version: 1,
      agentRound: 3,
      updatedAt: '2026-05-09T10:00:00.000Z',
      active: [
        {
          id: 'goal-1',
          assertion: '修复 Curator round 归一化',
          status: 'active',
          sinceRound: 2,
          lastConfirmedRound: 3,
          signal: 'explicit',
        },
      ],
      completed: [
        {
          id: 'goal-0',
          assertion: '定位 round 错位根因',
          completedAtRound: 2,
        },
      ],
      migrations: [
        {
          from: '信任模型 round',
          to: '强制归一化 top-level round',
          atRound: 3,
          reason: 'artifact 恢复必须可预测',
        },
      ],
      prunedCount: 0,
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 11);

  assert.ok(normalized);
  assert.equal(normalized?.summaryEntry?.agentRound, 11);
  assert.equal(normalized?.goalState?.agentRound, 11);

  assert.equal(normalized?.goalState?.active[0]?.sinceRound, 2);
  assert.equal(normalized?.goalState?.active[0]?.lastConfirmedRound, 3);
  assert.equal(normalized?.goalState?.completed[0]?.completedAtRound, 2);
  assert.equal(normalized?.goalState?.migrations[0]?.atRound, 3);
});

test('normalizeCuratorResultAgentRound tolerates missing structured payload sections', () => {
  const result: CuratorResult = {
    summary: '## 目标\n仅 markdown\n\n## 已完成\n- 无结构化 payload',
    signal: null,
    summaryEntry: null,
    goalState: null,
    sections: {
      goal: '仅 markdown',
      completed: ['无结构化 payload'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 7);
  assert.ok(normalized);
  assert.equal(normalized?.summaryEntry, null);
  assert.equal(normalized?.goalState, null);
});

test('normalizeCuratorResultAgentRound returns null when result is null', () => {
  assert.equal(normalizeCuratorResultAgentRound(null, 9), null);
});
