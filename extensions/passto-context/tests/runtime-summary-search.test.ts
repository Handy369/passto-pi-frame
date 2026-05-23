import test from 'node:test';
import assert from 'node:assert/strict';

import {
  executeSummarySearchTool,
  getLineageSummaryWarehouseEntries,
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

let ctxCounter = 0;

function makeCtx(branch = makeBranch(), sessionFile = '/tmp/session-a.jsonl') {
  ctxCounter += 1;
  const leafId = `leaf-${ctxCounter}`;
  return {
    sessionManager: {
      getBranch() {
        return branch;
      },
      getLeafId() {
        return leafId;
      },
      getSessionFile() {
        return sessionFile;
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

test('getLineageSummaryWarehouseEntries falls back to current branch when depth is zero', async () => {
  const entries = await getLineageSummaryWarehouseEntries(makeCtx(), {
    lineageSummaryMaxDepth: 0,
  });
  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((item) => item.agentRound), [3, 4]);
});

test('executeSummarySearchTool returns runtime-ready result with session pointers', async () => {
  const result = await executeSummarySearchTool({ query: 'summaryCache eviction', limit: 5 }, makeCtx(), {
    lineageSummaryMaxDepth: 0,
  });

  assert.equal(result.content[0]?.type, 'text');
  assert.match(result.content[0]?.text ?? '', /Found 1 lineage summary hit/);
  assert.equal(result.details.query, 'summaryCache eviction');
  assert.equal(result.details.limit, 5);
  assert.equal(result.details.totalWarehouseEntries, 2);
  assert.equal(result.details.searchScope, 'lineage');
  assert.equal(result.details.hits.length, 1);
  assert.equal(result.details.hits[0]?.agentRound, 3);
  assert.equal(result.details.hits[0]?.sessionFile, '/tmp/session-a.jsonl');
  assert.deepEqual(result.details.hits[0]?.sessionEntryRange, {
    startAgentEntryIndex: 11,
    endAgentEntryIndex: 15,
  });
  assert.equal(result.details.hits[0]?.sessionPointers?.searchQuery, 'summaryCache evict generator');
});

test('executeSummarySearchTool clamps limit and returns empty result text when no hit exists', async () => {
  const result = await executeSummarySearchTool({ query: 'missing keyword', limit: 999 }, makeCtx(), {
    lineageSummaryMaxDepth: 0,
  });

  assert.match(result.content[0]?.text ?? '', /No lineage summary hits found/);
  assert.equal(result.details.limit, 20);
  assert.equal(result.details.totalWarehouseEntries, 2);
  assert.deepEqual(result.details.hits, []);
});

test('executeSummarySearchTool ignores draftGoalOp-only artifact when summaryEntry is absent', async () => {
  const branch = [
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 7,
        recordedAt: '2026-05-13T10:07:00.000Z',
        processedUpToUserTurn: 14,
        draftGoalOp: {
          action: 'create',
          goal: {
            assertion: 'draft only artifact',
            kind: 'goal',
            parentGoalId: null,
            atomicity: 'undecided',
            phase: 'plan',
          },
          reason: 'new independent goal',
        },
      },
    },
  ];

  const result = await executeSummarySearchTool({ query: 'draft only artifact', limit: 5 }, makeCtx(branch), {
    lineageSummaryMaxDepth: 0,
  });

  assert.match(result.content[0]?.text ?? '', /No lineage summary hits found/);
  assert.equal(result.details.totalWarehouseEntries, 0);
});

test('injectSessionSummarySearchGuidance appends guidance only when warehouse exists and enabled', async () => {
  const enabled = await injectSessionSummarySearchGuidance('BASE', true, makeCtx(), {
    lineageSummaryMaxDepth: 0,
  });
  assert.match(enabled.systemPrompt, /BASE/);
  assert.match(enabled.systemPrompt, /ptc_search_summary/);
  assert.match(enabled.systemPrompt, /parentSession lineage/);
  assert.match(enabled.diagnostic, /summary-search-guidance\(2\//);

  const disabled = await injectSessionSummarySearchGuidance('BASE', false, makeCtx(), {
    lineageSummaryMaxDepth: 0,
  });
  assert.equal(disabled.systemPrompt, 'BASE');
  assert.equal(disabled.diagnostic, 'summary-search-guidance:skip(enabled=false)');

  const empty = await injectSessionSummarySearchGuidance('BASE', true, makeCtx([]), {
    lineageSummaryMaxDepth: 0,
  });
  assert.equal(empty.systemPrompt, 'BASE');
  assert.equal(empty.diagnostic, 'summary-search-guidance:0(warehouse=0)');
});


test('injectSessionSummarySearchGuidance uses current-session warehouse without lineage traversal', async () => {
  const ctx = makeCtx();
  let getSessionFileCalls = 0;
  const wrapped = {
    sessionManager: {
      getBranch: ctx.sessionManager.getBranch,
      getLeafId() {
        return 'wrapped-leaf';
      },
      getSessionFile() {
        getSessionFileCalls += 1;
        return '/tmp/session-a.jsonl';
      },
    },
  };

  const result = await injectSessionSummarySearchGuidance('BASE', true, wrapped, {
    lineageSummaryMaxDepth: 8,
  });

  assert.match(result.systemPrompt, /ptc_search_summary/);
  assert.equal(getSessionFileCalls, 1);
});

test('restore replay and runtime summary search stay aligned on persisted curator artifacts', async () => {
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

  const result = await executeSummarySearchTool({ query: 'runtime search index.ts', limit: 5 }, makeCtx(restoredBranch, '/tmp/restored-session.jsonl'), {
    lineageSummaryMaxDepth: 0,
  });
  assert.equal(result.details.totalWarehouseEntries, 2);
  assert.equal(result.details.searchScope, 'lineage');
  assert.equal(result.details.hits.length, 1);
  assert.equal(result.details.hits[0]?.agentRound, 12);
  assert.equal(result.details.hits[0]?.summary.goal, 'restore 后继续支持 summary warehouse 检索');
  assert.equal(result.details.hits[0]?.sessionPointers?.file, '/tmp/restored-session.jsonl');
  assert.deepEqual(result.details.hits[0]?.sessionEntryRange, {
    startAgentEntryIndex: 40,
    endAgentEntryIndex: 48,
  });
});
