import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialGRCState, restoreGRCState } from '../grc-state.ts';
import { restoreCuratorStateFromBranchEntries } from '../grc-restore.ts';

const baseState = restoreGRCState({
  mode: 'grc',
  turnCount: 16,
  totalAgentRounds: 16,
  currentAgentRound: 16,
  currentTurnRound: 0,
  grcCycleCount: 3,
  reflector: {
    status: 'idle',
    lastAdvice: null,
    processedUpToTurn: 0,
  },
  curator: {
    ...createInitialGRCState().curator,
    status: 'running',
    principlesExtracted: 2,
  },
  activatedAtTurn: 12,
  lastGrcTriggerTurn: 14,
});

test('restoreCuratorStateFromBranchEntries dedupes summaryCache by agentRound using latest artifact entry semantics', () => {
  const restoreResult = restoreCuratorStateFromBranchEntries(
    restoreGRCState({
      ...createInitialGRCState(),
      mode: 'grc',
      curator: {
        ...createInitialGRCState().curator,
        status: 'done',
      },
    }),
    [
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 23,
          recordedAt: '2026-05-09T00:00:23.000Z',
          processedUpToUserTurn: 48,
          summary: 'round 23 first summary',
          summaryEntry: {
            agentRound: 23,
            timestamp: '2026-05-09T00:00:23.000Z',
            summary: {
              goal: '旧的 round 23 summary',
              completed: ['第一次写入 summary cache'],
              keyDecisions: ['同一 round 后续可能被覆盖'],
              filesChanged: [],
              status: 'first summary',
              blockers: [],
            },
          },
          goalState: null,
          signal: {
            type: 'continue',
            confidence: 0.52,
            evidence: 'first duplicate-round artifact',
          },
        },
      },
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 23,
          recordedAt: '2026-05-09T00:00:23.500Z',
          processedUpToUserTurn: 49,
          summary: 'round 23 replacement summary',
          summaryEntry: {
            agentRound: 23,
            timestamp: '2026-05-09T00:00:23.500Z',
            summary: {
              goal: '新的 round 23 summary',
              completed: ['第二次写入应覆盖第一次'],
              keyDecisions: ['pushSummaryCacheEntry 以 agentRound 去重'],
              filesChanged: [{ path: 'tests/index-restore-replay.test.ts', action: 'write' }],
              status: 'replacement summary',
              blockers: [],
            },
          },
          goalState: null,
          signal: {
            type: 'advance',
            confidence: 0.91,
            evidence: 'replacement duplicate-round artifact',
          },
        },
      },
    ],
    6,
  );

  const restored = restoreResult.state;
  assert.deepEqual(restoreResult.restoredCuratorArtifactRounds, [23, 23]);
  assert.equal(restored.curator.summaryCache.length, 1);
  assert.deepEqual(restored.curator.summaryCache.map((item) => item.agentRound), [23]);
  assert.equal(restored.curator.summaryCache[0]?.timestamp, '2026-05-09T00:00:23.500Z');
  assert.equal(restored.curator.summaryCache[0]?.summary.goal, '新的 round 23 summary');
  assert.equal(restored.curator.lastSummary, 'round 23 replacement summary');
  assert.equal(restored.curator.processedUpToTurn, 49);
  assert.equal(restored.curator.lastSignal?.type, 'advance');
});

test('restoreCuratorStateFromBranchEntries rehydrates curator artifacts into cache, goal state, and signal', () => {
  const restoreResult = restoreCuratorStateFromBranchEntries(
    baseState,
    [
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 14,
          recordedAt: '2026-05-09T00:00:14.000Z',
          processedUpToUserTurn: 28,
          summary: 'round 14 summary',
          summaryEntry: {
            agentRound: 14,
            timestamp: '2026-05-09T00:00:14.000Z',
            summary: {
              goal: '补第一轮 curator artifact restore',
              completed: ['记录 round 14 summary'],
              keyDecisions: ['保留 artifact replay'],
              filesChanged: [{ path: 'index.ts', action: 'read' }],
              status: 'artifact round 14 restored',
              blockers: [],
            },
          },
          goalState: {
            version: 1,
            agentRound: 14,
            updatedAt: '2026-05-09T00:00:14.000Z',
            active: [
              {
                id: 'goal-r14',
                assertion: '恢复 curator artifact round 14',
                status: 'active',
                sinceRound: 14,
                lastConfirmedRound: 14,
                signal: 'explicit',
              },
            ],
            completed: [],
            migrations: [],
            prunedCount: 0,
          },
          signal: {
            type: 'supplement',
            confidence: 0.72,
            evidence: 'round 14 replay',
          },
        },
      },
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 15,
          recordedAt: '2026-05-09T00:00:15.000Z',
          processedUpToUserTurn: 30,
          summary: 'round 15 summary',
          summaryEntry: {
            agentRound: 15,
            timestamp: '2026-05-09T00:00:15.000Z',
            summary: {
              goal: '恢复最新 curator artifact',
              completed: ['记录 round 15 summary'],
              keyDecisions: ['latest artifact should win for goalState/signal'],
              filesChanged: [{ path: 'tests/index-restore-replay.test.ts', action: 'write' }],
              status: 'artifact round 15 restored',
              blockers: [],
            },
          },
          goalState: {
            version: 1,
            agentRound: 15,
            updatedAt: '2026-05-09T00:00:15.000Z',
            active: [
              {
                id: 'goal-r15',
                assertion: '恢复最新 curator artifact',
                status: 'active',
                sinceRound: 15,
                lastConfirmedRound: 15,
                signal: 'explicit',
              },
            ],
            completed: [
              {
                id: 'goal-r14',
                assertion: '恢复 curator artifact round 14',
                completedAtRound: 15,
              },
            ],
            migrations: [
              {
                from: '恢复 curator artifact round 14',
                to: '恢复最新 curator artifact',
                atRound: 15,
                reason: 'latest replay should dominate',
              },
            ],
            prunedCount: 0,
          },
          signal: {
            type: 'advance',
            confidence: 0.88,
            evidence: 'round 15 replay',
          },
        },
      },
    ],
    2,
  );

  const restored = restoreResult.state;
  assert.equal(restoreResult.curatorArtifactsRejected, 0);
  assert.deepEqual(restoreResult.restoredCuratorArtifactRounds, [14, 15]);
  assert.equal(restored.curator.status, 'done');
  assert.equal(restored.curator.lastSummary, 'round 15 summary');
  assert.equal(restored.curator.processedUpToTurn, 30);
  assert.equal(restored.curator.lastGoalState?.agentRound, 15);
  assert.equal(restored.curator.lastSignal?.type, 'advance');
  assert.deepEqual(restored.curator.summaryCache.map((item) => item.agentRound), [14, 15]);
});

test('restoreCuratorStateFromBranchEntries rejects invalid restore entries without mutating state', () => {
  const restoreResult = restoreCuratorStateFromBranchEntries(
    restoreGRCState({
      ...createInitialGRCState(),
      mode: 'grc',
      curator: {
        ...createInitialGRCState().curator,
        status: 'done',
        lastSummary: 'baseline summary',
      },
    }),
    [
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 'bad-round',
          recordedAt: '2026-05-09T00:00:17.000Z',
          processedUpToUserTurn: 31,
        },
      },
    ],
    2,
  );

  const restored = restoreResult.state;
  assert.equal(restoreResult.curatorArtifactsRejected, 1);
  assert.deepEqual(restoreResult.restoredCuratorArtifactRounds, []);
  assert.equal(restored.curator.lastSummary, 'baseline summary');
  assert.deepEqual(restored.curator.summaryCache, []);
  assert.equal(restored.curator.lastGoalState, null);
  assert.equal(restored.curator.lastSignal, null);
});

test('restoreCuratorStateFromBranchEntries normalizes mismatched artifact summaryEntry/goalState round to artifact agentRound', () => {
  const restoreResult = restoreCuratorStateFromBranchEntries(
    restoreGRCState({
      ...createInitialGRCState(),
      mode: 'grc',
      curator: {
        ...createInitialGRCState().curator,
        status: 'done',
      },
    }),
    [
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 31,
          recordedAt: '2026-05-10T00:00:31.000Z',
          processedUpToUserTurn: 66,
          summary: 'artifact round mismatch summary',
          summaryEntry: {
            agentRound: 30,
            timestamp: '2026-05-10T00:00:31.000Z',
            summary: {
              goal: '错误 round 的 summaryEntry 需要在 restore 时被归一化',
              completed: ['artifact 外层 round 才是权威'],
              keyDecisions: ['不要信任旧 jsonl 里漂移的 summaryEntry.agentRound'],
              filesChanged: [],
              status: 'restore normalization',
              blockers: [],
            },
          },
          goalState: {
            version: 1,
            agentRound: 29,
            updatedAt: '2026-05-10T00:00:31.000Z',
            active: [
              {
                id: 'goal-mismatch',
                assertion: '恢复时归一化 artifact 内部 round',
                status: 'active',
                sinceRound: 29,
                lastConfirmedRound: 30,
                signal: 'explicit',
              },
            ],
            completed: [],
            migrations: [],
            prunedCount: 0,
          },
          signal: {
            type: 'continue',
            confidence: 0.77,
            evidence: 'artifact outer round differs from inner payload rounds',
          },
        },
      },
    ],
    4,
  );

  const restored = restoreResult.state;
  assert.equal(restored.curator.lastSummaryEntry?.agentRound, 31);
  assert.equal(restored.curator.lastGoalState?.agentRound, 31);
  assert.deepEqual(restored.curator.summaryCache.map((item) => item.agentRound), [31]);
});

test('restoreGRCState and restoreCuratorStateFromBranchEntries normalize running statuses to idle while preserving restored data', () => {
  const restoredState = restoreGRCState({
    ...createInitialGRCState(),
    mode: 'grc',
    reflector: {
      ...createInitialGRCState().reflector,
      status: 'running',
      lastAdvice: 'reflector advice',
    },
    curator: {
      ...createInitialGRCState().curator,
      status: 'running',
      lastSummary: 'legacy running summary',
    },
  });

  assert.equal(restoredState.reflector.status, 'idle');
  assert.equal(restoredState.curator.status, 'idle');
  assert.equal(restoredState.reflector.lastAdvice, 'reflector advice');
  assert.equal(restoredState.curator.lastSummary, 'legacy running summary');

  const replayed = restoreCuratorStateFromBranchEntries(
    restoredState,
    [
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 18,
          recordedAt: '2026-05-09T00:00:18.000Z',
          processedUpToUserTurn: 35,
          summary: 'artifact replay after idle normalization',
          summaryEntry: {
            agentRound: 18,
            timestamp: '2026-05-09T00:00:18.000Z',
            summary: {
              goal: '验证 restore 后 running 会归一化为 idle',
              completed: ['状态恢复成功'],
              keyDecisions: ['running 状态不应跨 session 持续'],
              filesChanged: [],
              status: 'restored',
              blockers: [],
            },
          },
          goalState: {
            version: 1,
            agentRound: 18,
            updatedAt: '2026-05-09T00:00:18.000Z',
            active: [
              {
                id: 'goal-18',
                assertion: '验证 restore 后 running 会归一化为 idle',
                status: 'active',
                sinceRound: 18,
                lastConfirmedRound: 18,
                signal: 'explicit',
              },
            ],
            completed: [],
            migrations: [],
            prunedCount: 0,
          },
          signal: {
            type: 'continue',
            confidence: 0.7,
            evidence: 'artifact replay after restore',
          },
        },
      },
    ],
    4,
  ).state;

  assert.equal(replayed.curator.status, 'done');
  assert.equal(replayed.curator.lastGoalState?.agentRound, 18);
  assert.equal(replayed.curator.lastSignal?.type, 'continue');
  assert.deepEqual(replayed.curator.summaryCache.map((item) => item.agentRound), [18]);
});

test('restoreCuratorStateFromBranchEntries rehydrates latest reflector artifact into lightweight reflector state only', () => {
  const restoreResult = restoreCuratorStateFromBranchEntries(
    restoreGRCState({
      ...createInitialGRCState(),
      mode: 'grc',
      reflector: {
        ...createInitialGRCState().reflector,
        status: 'idle',
        lastAdvice: 'older reflector advice',
      },
    }),
    [
      {
        type: 'custom',
        customType: 'grc-reflector-artifact',
        data: {
          customType: 'grc-reflector-artifact',
          agentRound: 20,
          recordedAt: '2026-05-10T00:00:20.000Z',
          diagnosis: {
            aligned: false,
            driftSource: 'generator_execution_drift',
            confidence: 0.66,
            evidence: ['round 20 diagnosis'],
          },
          advice: 'round 20 reflector advice',
          principleOps: [{ op: 'reuse', targetId: 'principle_round20' }],
          assetCandidates: [
            {
              type: 'reference',
              title: 'Round 20 candidate',
              rationale: '只是候选。',
              evidence: ['round 20 asset'],
            },
          ],
        },
      },
      {
        type: 'custom',
        customType: 'grc-reflector-artifact',
        data: {
          customType: 'grc-reflector-artifact',
          agentRound: 21,
          recordedAt: '2026-05-10T00:00:21.000Z',
          diagnosis: {
            aligned: true,
            driftSource: 'none',
            confidence: 0.9,
            evidence: ['round 21 diagnosis'],
          },
          advice: 'round 21 reflector advice',
          principleOps: [{ op: 'reuse', targetId: 'principle_round21' }],
          assetCandidates: [
            {
              type: 'script',
              title: 'Round 21 candidate',
              rationale: '仍然只是候选。',
              evidence: ['round 21 asset'],
            },
          ],
        },
      },
    ],
    4,
  );

  const restored = restoreResult.state;
  assert.equal(restoreResult.reflectorArtifactsRejected, 0);
  assert.deepEqual(restoreResult.restoredReflectorArtifactRounds, [20, 21]);
  assert.equal(restored.reflector.status, 'done');
  assert.equal(restored.reflector.lastAdvice, 'round 21 reflector advice');
  assert.deepEqual(restored.reflector.lastDiagnosis, {
    aligned: true,
    driftSource: 'none',
    confidence: 0.9,
    evidence: ['round 21 diagnosis'],
  });
  assert.equal(restored.reflector.processedUpToAgentRound, 21);
  assert.equal(restored.reflector.lastReflectedAgentRound, 21);
  assert.equal('assetCandidates' in restored.reflector, false);
});

test('restoreCuratorStateFromBranchEntries rejects invalid reflector artifacts without mutating reflector state', () => {
  const restoreResult = restoreCuratorStateFromBranchEntries(
    restoreGRCState({
      ...createInitialGRCState(),
      mode: 'grc',
      reflector: {
        ...createInitialGRCState().reflector,
        status: 'done',
        lastAdvice: 'baseline reflector advice',
        lastDiagnosis: {
          aligned: false,
          driftSource: 'mixed',
          confidence: 0.5,
          evidence: ['baseline diagnosis'],
        },
        lastReflectedAgentRound: 12,
      },
    }),
    [
      {
        type: 'custom',
        customType: 'grc-reflector-artifact',
        data: {
          customType: 'grc-reflector-artifact',
          agentRound: 'bad-round',
          recordedAt: '2026-05-10T00:00:22.000Z',
          advice: 'should be rejected',
          principleOps: [],
        },
      },
    ],
    4,
  );

  const restored = restoreResult.state;
  assert.equal(restoreResult.reflectorArtifactsRejected, 1);
  assert.deepEqual(restoreResult.restoredReflectorArtifactRounds, []);
  assert.equal(restored.reflector.lastAdvice, 'baseline reflector advice');
  assert.deepEqual(restored.reflector.lastDiagnosis, {
    aligned: false,
    driftSource: 'mixed',
    confidence: 0.5,
    evidence: ['baseline diagnosis'],
  });
  assert.equal(restored.reflector.lastReflectedAgentRound, 12);
});
