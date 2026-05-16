import test from 'node:test';
import assert from 'node:assert/strict';

import {
  executeSummarySearchTool,
  getSessionSummaryWarehouseEntries,
  injectSessionSummarySearchGuidance,
} from '../runtime-summary-search.ts';
import { createInitialGRCState, restoreGRCState } from '../grc-state.ts';
import { restoreCuratorStateFromBranchEntries } from '../grc-restore.ts';

function makeBranch() {
  return [
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 3,
        recordedAt: '2026-05-13T10:00:00.000Z',
        processedUpToUserTurn: 6,
        summaryEntry: {
          agentRound: 3,
          timestamp: '2026-05-13T10:00:00.000Z',
          sessionFile: '/tmp/session-a.jsonl',
          sessionEntryRange: {
            startAgentEntryIndex: 11,
            endAgentEntryIndex: 15,
          },
          summary: {
            goal: '排查 summaryCache eviction',
            completed: ['确认旧摘要只是被挤出窗口'],
            keyDecisions: ['新增 ptc_search_summary'],
            filesChanged: [{ path: 'index.ts', action: 'edit' }],
            status: '需要补 generator 指引',
            blockers: ['缺少历史摘要检索提示'],
          },
          sessionPointers: {
            file: '/tmp/session-a.jsonl',
            searchQuery: 'summaryCache evict generator',
          },
        },
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 4,
        recordedAt: '2026-05-13T10:05:00.000Z',
        processedUpToUserTurn: 8,
        summaryEntry: {
          agentRound: 4,
          timestamp: '2026-05-13T10:05:00.000Z',
          sessionFile: '/tmp/session-a.jsonl',
          sessionEntryRange: {
            startAgentEntryIndex: 16,
            endAgentEntryIndex: 22,
          },
          summary: {
            goal: '整理 reflector 文档',
            completed: ['补 implementation plan'],
            keyDecisions: ['本轮先不改 runtime'],
            filesChanged: [{ path: 'docs/v1.1/TODO.md', action: 'write' }],
            status: 'done',
            blockers: [],
          },
          sessionPointers: {
            file: '/tmp/session-a.jsonl',
            searchQuery: 'reflector implementation plan',
          },
        },
      },
    },
  ];
}

function makeCtx(branch = makeBranch()) {
  return {
    sessionManager: {
      getBranch() {
        return branch;
      },
    },
  };
}

test('getSessionSummaryWarehouseEntries rehydrates warehouse from current session branch', () => {
  const entries = getSessionSummaryWarehouseEntries(makeCtx());
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((item) => item.agentRound), [3, 4]);
  assert.equal(entries[0]?.sessionFile, '/tmp/session-a.jsonl');
});

test('executeSummarySearchTool returns runtime-ready result with session pointers', () => {
  const result = executeSummarySearchTool({ query: 'summaryCache eviction', limit: 5 }, makeCtx());

  assert.equal(result.content[0]?.type, 'text');
  assert.match(result.content[0]?.text ?? '', /Found 1 current-session summary hit/);
  assert.equal(result.details.query, 'summaryCache eviction');
  assert.equal(result.details.limit, 5);
  assert.equal(result.details.totalWarehouseEntries, 2);
  assert.equal(result.details.hits.length, 1);
  assert.equal(result.details.hits[0]?.agentRound, 3);
  assert.equal(result.details.hits[0]?.sessionFile, '/tmp/session-a.jsonl');
  assert.deepEqual(result.details.hits[0]?.sessionEntryRange, {
    startAgentEntryIndex: 11,
    endAgentEntryIndex: 15,
  });
  assert.equal(result.details.hits[0]?.sessionPointers?.searchQuery, 'summaryCache evict generator');
});

test('executeSummarySearchTool clamps limit and returns empty result text when no hit exists', () => {
  const result = executeSummarySearchTool({ query: 'missing keyword', limit: 999 }, makeCtx());

  assert.match(result.content[0]?.text ?? '', /No current-session summary hits found/);
  assert.equal(result.details.limit, 20);
  assert.equal(result.details.totalWarehouseEntries, 2);
  assert.deepEqual(result.details.hits, []);
});

test('injectSessionSummarySearchGuidance appends guidance only when warehouse exists and enabled', () => {
  const enabled = injectSessionSummarySearchGuidance('BASE', true, makeCtx());
  assert.match(enabled.systemPrompt, /BASE/);
  assert.match(enabled.systemPrompt, /ptc_search_summary/);
  assert.match(enabled.diagnostic, /summary-search-guidance\(2\//);

  const disabled = injectSessionSummarySearchGuidance('BASE', false, makeCtx());
  assert.equal(disabled.systemPrompt, 'BASE');
  assert.equal(disabled.diagnostic, 'summary-search-guidance:skip(enabled=false)');

  const empty = injectSessionSummarySearchGuidance('BASE', true, makeCtx([]));
  assert.equal(empty.systemPrompt, 'BASE');
  assert.equal(empty.diagnostic, 'summary-search-guidance:0(warehouse=0)');
});

test('restore replay and runtime summary search stay aligned on persisted curator artifacts', () => {
  const restoredBranch = [
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 12,
        recordedAt: '2026-05-13T12:00:00.000Z',
        processedUpToUserTurn: 24,
        summary: 'round 12 first summary',
        summaryEntry: {
          agentRound: 12,
          timestamp: '2026-05-13T12:00:00.000Z',
          sessionFile: '/tmp/restored-session.jsonl',
          sessionEntryRange: {
            startAgentEntryIndex: 40,
            endAgentEntryIndex: 48,
          },
          summary: {
            goal: '旧版 restore warehouse 结果',
            completed: ['第一次写入'],
            keyDecisions: ['后续同 round 结果应覆盖'],
            filesChanged: [{ path: 'memory.ts', action: 'read' }],
            status: 'old',
            blockers: [],
          },
          sessionPointers: {
            file: '/tmp/restored-session.jsonl',
            searchQuery: 'obsolete restore warehouse',
          },
        },
        goalState: null,
        signal: {
          type: 'continue',
          confidence: 0.55,
          evidence: 'first duplicate-round artifact',
        },
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 12,
        recordedAt: '2026-05-13T12:00:01.000Z',
        processedUpToUserTurn: 25,
        summary: 'round 12 replacement summary',
        summaryEntry: {
          agentRound: 12,
          timestamp: '2026-05-13T12:00:01.000Z',
          sessionFile: '/tmp/restored-session.jsonl',
          sessionEntryRange: {
            startAgentEntryIndex: 40,
            endAgentEntryIndex: 48,
          },
          summary: {
            goal: 'restore 后继续支持 summary warehouse 检索',
            completed: ['同 round 最新 artifact 应被命中'],
            keyDecisions: ['runtime search 与 restore replay 共享同一持久化来源'],
            filesChanged: [{ path: 'index.ts', action: 'edit' }],
            status: 'replacement',
            blockers: ['需要验证 restore -> warehouse -> search 串联路径'],
          },
          sessionPointers: {
            file: '/tmp/restored-session.jsonl',
            searchQuery: 'restore warehouse search index.ts',
          },
        },
        goalState: {
          version: 1,
          agentRound: 12,
          updatedAt: '2026-05-13T12:00:01.000Z',
          active: [
            {
              id: 'goal-restore-warehouse',
              assertion: 'restore 后继续支持 summary warehouse 检索',
              status: 'active',
              sinceRound: 12,
              lastConfirmedRound: 12,
              signal: 'explicit',
            },
          ],
          completed: [],
          migrations: [],
          prunedCount: 0,
        },
        signal: {
          type: 'advance',
          confidence: 0.92,
          evidence: 'replacement duplicate-round artifact should win',
        },
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 13,
        recordedAt: '2026-05-13T12:05:00.000Z',
        processedUpToUserTurn: 27,
        summary: 'round 13 summary',
        summaryEntry: {
          agentRound: 13,
          timestamp: '2026-05-13T12:05:00.000Z',
          sessionFile: '/tmp/restored-session.jsonl',
          sessionEntryRange: {
            startAgentEntryIndex: 49,
            endAgentEntryIndex: 56,
          },
          summary: {
            goal: '另一个 round',
            completed: ['保留多 round warehouse'],
            keyDecisions: ['query 应精准命中 round 12 replacement'],
            filesChanged: [{ path: 'docs/v1.1/TODO.md', action: 'write' }],
            status: 'done',
            blockers: [],
          },
          sessionPointers: {
            file: '/tmp/restored-session.jsonl',
            searchQuery: 'other round docs TODO',
          },
        },
        goalState: null,
        signal: {
          type: 'supplement',
          confidence: 0.73,
          evidence: 'extra round for warehouse coverage',
        },
      },
    },
  ];

  const restored = restoreCuratorStateFromBranchEntries(
    restoreGRCState({
      ...createInitialGRCState(),
      mode: 'grc',
      curator: {
        ...createInitialGRCState().curator,
        status: 'done',
      },
    }),
    restoredBranch,
    6,
  ).state;

  assert.deepEqual(restored.curator.summaryCache.map((item) => item.agentRound), [12, 13]);
  assert.equal(restored.curator.lastSummaryEntry?.summary.goal, '另一个 round');
  assert.equal(restored.curator.lastGoalState, null);
  assert.equal(restored.curator.lastSignal?.type, 'supplement');
  assert.equal(restored.curator.summaryCache[0]?.summary.goal, 'restore 后继续支持 summary warehouse 检索');

  const warehouseEntries = getSessionSummaryWarehouseEntries(makeCtx(restoredBranch));
  assert.deepEqual(warehouseEntries.map((item) => item.agentRound), [12, 13]);
  assert.equal(warehouseEntries[0]?.summary.goal, 'restore 后继续支持 summary warehouse 检索');

  const result = executeSummarySearchTool({ query: 'runtime search index.ts', limit: 5 }, makeCtx(restoredBranch));
  assert.equal(result.details.totalWarehouseEntries, 2);
  assert.equal(result.details.hits.length, 1);
  assert.equal(result.details.hits[0]?.agentRound, 12);
  assert.equal(result.details.hits[0]?.summary.goal, 'restore 后继续支持 summary warehouse 检索');
  assert.equal(result.details.hits[0]?.sessionPointers?.file, '/tmp/restored-session.jsonl');
  assert.deepEqual(result.details.hits[0]?.sessionEntryRange, {
    startAgentEntryIndex: 40,
    endAgentEntryIndex: 48,
  });
});
