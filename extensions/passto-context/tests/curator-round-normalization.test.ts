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

test('normalizeCuratorResultAgentRound backfills certaintyAssessment from lastPolicyProjection when model omits it', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续当前目标\n\n## 已完成\n- 完成第二轮',
    signal: {
      type: 'continue',
      confidence: 0.9,
      evidence: '目标仍在继续',
    },
    summaryEntry: null,
    goalState: {
      version: 2,
      agentRound: 2,
      updatedAt: '2026-05-20T05:00:00.000Z',
      rootGoalIds: ['goal-1'],
      currentFocusGoalId: 'goal-1',
      nodes: [
        {
          id: 'goal-1',
          parentId: null,
          assertion: '继续当前目标',
          kind: 'goal',
          status: 'active',
          signal: 'explicit',
          atomicity: 'atomic',
          phase: 'execute',
          sinceRound: 1,
          lastTouchedRound: 2,
          lastConfirmedRound: 2,
          priority: 0,
          order: 0,
        },
      ],
      migrations: [],
      prunedCount: 0,
    },
    lastPolicyProjection: {
      xNodeId: 'goal-1',
      derivedAtRound: 2,
      dimensions: {
        why: 'closed',
        what: 'closed',
        flow: 'partial',
        structure: 'partial',
        runtimeProof: 'open',
      },
      keyGaps: ['runtimeProof: 仍需补验证'],
      nextStepType: 'run_tests',
      confidence: 0.82,
      guidance: ['先补测试'],
    },
    certaintyAssessment: null,
    sections: {
      goal: '继续当前目标',
      completed: ['完成第二轮'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 2);
  assert.ok(normalized?.certaintyAssessment);
  assert.equal(normalized?.certaintyAssessment?.nextStepType, 'run_tests');
  assert.equal(normalized?.certaintyAssessment?.dimensions.runtimeProof, 'open');
  assert.deepEqual(normalized?.certaintyAssessment?.keyGaps, ['runtimeProof: 仍需补验证']);
  assert.equal(normalized?.certaintyAssessment?.confidence, 0.82);
});

test('normalizeCuratorResultAgentRound backfills conservative certaintyAssessment when model omits it and object policy is unavailable', () => {
  const result: CuratorResult = {
    summary: '## 目标\n继续当前目标\n\n## 已完成\n- 完成第二轮',
    signal: {
      type: 'continue',
      confidence: 0.9,
      evidence: '目标仍在继续',
    },
    summaryEntry: null,
    goalState: {
      version: 2,
      agentRound: 2,
      updatedAt: '2026-05-20T05:00:00.000Z',
      rootGoalIds: ['goal-1'],
      currentFocusGoalId: 'goal-1',
      nodes: [
        {
          id: 'goal-1',
          parentId: null,
          assertion: '继续当前目标',
          kind: 'goal',
          status: 'active',
          signal: 'explicit',
          atomicity: 'atomic',
          phase: 'execute',
          sinceRound: 1,
          lastTouchedRound: 2,
          lastConfirmedRound: 2,
          priority: 0,
          order: 0,
        },
      ],
      migrations: [],
      prunedCount: 0,
    },
    certaintyAssessment: null,
    sections: {
      goal: '继续当前目标',
      completed: ['完成第二轮'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 2);
  assert.ok(normalized?.certaintyAssessment);
  assert.equal(normalized?.certaintyAssessment?.nextStepType, 'plan_repair');
  assert.equal(normalized?.certaintyAssessment?.dimensions.runtimeProof, 'open');
  assert.match(normalized?.certaintyAssessment?.keyGaps[0] ?? '', /缺少 object policy/);
});

test('normalizeCuratorResultAgentRound normalizes proof payload rounds to targetPreviousAgentRound', () => {
  const result: CuratorResult = {
    summary: '## 目标\nproof round normalize\n\n## 已完成\n- 记录 proof payload',
    signal: null,
    summaryEntry: null,
    goalState: null,
    latestRuntimeProof: {
      targetXNodeId: 'goal-proof',
      atRound: 3,
      resultSummary: 'proof should follow target round',
      proofMode: 'tests',
      proofStatus: 'partial',
      evidence: ['need more runtime proof'],
      verificationMethod: ['run targeted tests'],
    },
    latestProofSignals: [
      {
        id: 'proof-goal-proof-runtime-proof-partial',
        targetXNodeId: 'goal-proof',
        atRound: 3,
        type: 'runtime-proof-partial',
        message: 'proof incomplete',
        suggestedNextStepType: 'run_tests',
        evidence: ['need more runtime proof'],
      },
    ],
    sections: {
      goal: 'proof round normalize',
      completed: ['记录 proof payload'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 11);
  assert.equal(normalized?.latestRuntimeProof?.atRound, 11);
  assert.equal(normalized?.latestProofSignals?.[0]?.atRound, 11);
});

test('normalizeCuratorResultAgentRound backfills top-level proof payload from focused x-node model when curator omits it', () => {
  const result: CuratorResult = {
    summary: '## 目标\nbackfill proof\n\n## 已完成\n- 仅产出 x-node sidecar proof',
    signal: null,
    summaryEntry: null,
    goalState: null,
    userGoalTree: {
      version: 1,
      agentRound: 5,
      updatedAt: '2026-05-21T00:00:00.000Z',
      currentFocusUserGoalId: 'goal-proof',
      rootUserGoalIds: ['goal-proof'],
      userGoals: [
        {
          id: 'goal-proof',
          parentId: null,
          assertion: '补 proof producer',
          status: 'executing',
          xNodeModelId: 'xnode-goal-proof',
          sinceRound: 5,
          lastTouchedRound: 5,
        },
      ],
    },
    xNodeModels: [
      {
        version: 1,
        userGoalId: 'goal-proof',
        agentRound: 5,
        updatedAt: '2026-05-21T00:00:00.000Z',
        currentFocusXNodeId: 'node-proof',
        rootXNodeIds: ['node-proof'],
        nodes: [],
        latestRuntimeProof: {
          targetXNodeId: 'node-proof',
          atRound: 5,
          resultSummary: 'proof only exists on x-node model',
          proofMode: 'tests',
          proofStatus: 'partial',
          evidence: ['need targeted proof'],
          verificationMethod: ['run targeted tests'],
        },
        latestProofSignals: [
          {
            id: 'proof-node-proof-runtime-proof-partial',
            targetXNodeId: 'node-proof',
            atRound: 5,
            type: 'runtime-proof-partial',
            message: 'proof incomplete',
            suggestedNextStepType: 'run_tests',
            evidence: ['need targeted proof'],
          },
        ],
      },
    ],
    sections: {
      goal: 'backfill proof',
      completed: ['仅产出 x-node sidecar proof'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 9);
  assert.equal(normalized?.latestRuntimeProof?.targetXNodeId, 'node-proof');
  assert.equal(normalized?.latestRuntimeProof?.atRound, 9);
  assert.equal(normalized?.latestProofSignals?.[0]?.type, 'runtime-proof-partial');
  assert.equal(normalized?.latestProofSignals?.[0]?.atRound, 9);
});

test('normalizeCuratorResultAgentRound synthesizes minimal proof signal when proof is not passed and signals are missing', () => {
  const result: CuratorResult = {
    summary: '## 目标\nproof signal synthesize\n\n## 已完成\n- 只有 proof record',
    signal: null,
    summaryEntry: null,
    goalState: null,
    latestRuntimeProof: {
      targetXNodeId: 'goal-proof',
      atRound: 3,
      resultSummary: 'proof still incomplete',
      proofMode: 'tests',
      proofStatus: 'partial',
      evidence: ['need more runtime proof'],
      verificationMethod: ['run targeted tests'],
    },
    latestProofSignals: null,
    sections: {
      goal: 'proof signal synthesize',
      completed: ['只有 proof record'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 11);
  assert.equal(normalized?.latestProofSignals?.length, 1);
  assert.equal(normalized?.latestProofSignals?.[0]?.type, 'runtime-proof-partial');
  assert.equal(normalized?.latestProofSignals?.[0]?.atRound, 11);
  assert.equal(normalized?.latestProofSignals?.[0]?.id, 'proof-goal-proof-11-runtime-proof-partial');
});

test('normalizeCuratorResultAgentRound backfills proof signal id when curator omits it', () => {
  const result: CuratorResult = {
    summary: '## 目标\nproof signal id\n\n## 已完成\n- signal 缺少 id',
    signal: null,
    summaryEntry: null,
    goalState: null,
    latestRuntimeProof: {
      targetXNodeId: 'goal-proof',
      atRound: 4,
      resultSummary: 'proof incomplete',
      proofMode: 'tests',
      proofStatus: 'partial',
      evidence: ['need more runtime proof'],
      verificationMethod: ['run targeted tests'],
    },
    latestProofSignals: [
      {
        id: '',
        targetXNodeId: 'goal-proof',
        atRound: 4,
        type: 'runtime-proof-partial',
        message: 'proof incomplete',
        suggestedNextStepType: 'run_tests',
        evidence: ['need more runtime proof'],
      },
    ],
    sections: {
      goal: 'proof signal id',
      completed: ['signal 缺少 id'],
      decisions: [],
      files: [],
      status: '',
      nextSteps: [],
      warnings: [],
    },
  };

  const normalized = normalizeCuratorResultAgentRound(result, 12);
  assert.equal(normalized?.latestProofSignals?.[0]?.id, 'proof-goal-proof-12-runtime-proof-partial');
  assert.equal(normalized?.latestProofSignals?.[0]?.atRound, 12);
});
