import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionSummaryWarehouse,
  hydrateSummaryEntrySessionContext,
  searchSessionSummaryWarehouse,
} from '../summary-warehouse.ts';
import { findAgentRoundBoundaryByRound, resolveAgentRoundEntryRange } from '../grc-context-manager.ts';
import { buildSessionSummarySearchGuidance } from '../grc-prompts.ts';

test('findAgentRoundBoundaryByRound returns matching round boundary', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: 2, totalCompletedAgentRounds: 1, userTurnsAtStart: 2 },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'round 2' }] } },
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: 3, totalCompletedAgentRounds: 2, userTurnsAtStart: 3 },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'round 3' }] } },
  ];

  const boundary = findAgentRoundBoundaryByRound(branch, 2);
  assert.deepEqual(boundary, {
    agentRound: 2,
    startEntryIndex: 0,
    endEntryIndex: 1,
    userTurnsAtStart: 2,
    totalCompletedAgentRounds: 1,
    createdAt: undefined,
  });
  assert.equal(findAgentRoundBoundaryByRound(branch, 99), null);
});

test('resolveAgentRoundEntryRange trims trailing current-turn user prompt from previous round slice', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: 2, totalCompletedAgentRounds: 1, userTurnsAtStart: 2 },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'previous round user' }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'previous round assistant' }] } },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'current turn user prompt' }] } },
  ];

  assert.deepEqual(resolveAgentRoundEntryRange(branch, 2), {
    startAgentEntryIndex: 0,
    endAgentEntryIndex: 2,
  });
});

test('hydrateSummaryEntrySessionContext fills session file and range', () => {
  const hydrated = hydrateSummaryEntrySessionContext({
    agentRound: 7,
    timestamp: '2026-05-13T12:00:00.000Z',
    summary: {
      goal: '补齐 session 定位',
      completed: [],
      keyDecisions: [],
      filesChanged: [],
      status: 'doing',
      blockers: [],
    },
  }, {
    sessionFile: '/tmp/session.jsonl',
    sessionEntryRange: {
      startAgentEntryIndex: 10,
      endAgentEntryIndex: 16,
    },
  });

  assert.equal(hydrated?.sessionFile, '/tmp/session.jsonl');
  assert.deepEqual(hydrated?.sessionEntryRange, {
    startAgentEntryIndex: 10,
    endAgentEntryIndex: 16,
  });
  assert.equal(hydrated?.sessionPointers?.file, '/tmp/session.jsonl');
});

test('buildSessionSummaryWarehouse dedupes by agentRound using latest curator artifact', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        summaryEntry: {
          agentRound: 4,
          timestamp: '2026-05-13T12:00:00.000Z',
          summary: {
            goal: '旧 round 4',
            completed: ['first'],
            keyDecisions: [],
            filesChanged: [],
            status: 'old',
            blockers: [],
          },
        },
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        summaryEntry: {
          agentRound: 4,
          timestamp: '2026-05-13T12:01:00.000Z',
          summary: {
            goal: '新 round 4',
            completed: ['replacement'],
            keyDecisions: [],
            filesChanged: [],
            status: 'new',
            blockers: [],
          },
        },
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        summaryEntry: {
          agentRound: 5,
          timestamp: '2026-05-13T12:02:00.000Z',
          summary: {
            goal: 'round 5',
            completed: ['kept'],
            keyDecisions: [],
            filesChanged: [],
            status: 'stable',
            blockers: [],
          },
        },
      },
    },
  ];

  const warehouse = buildSessionSummaryWarehouse(branch);
  assert.equal(warehouse.length, 2);
  assert.deepEqual(warehouse.map((item) => item.agentRound), [4, 5]);
  assert.equal(warehouse[0]?.summary.goal, '新 round 4');
});

test('searchSessionSummaryWarehouse matches by goal, files, and searchQuery', () => {
  const entries = [
    {
      agentRound: 6,
      timestamp: '2026-05-13T12:03:00.000Z',
      sessionFile: '/tmp/a.jsonl',
      summary: {
        goal: '排查 summaryCache eviction',
        completed: ['确认 cache eviction 只是窗口裁剪'],
        keyDecisions: ['改为增加 summary warehouse 检索'],
        filesChanged: [{ path: 'index.ts', action: 'edit' as const }],
        status: '需要补检索工具',
        blockers: ['缺少 generator 指引'],
      },
      sessionPointers: { searchQuery: 'summaryCache evict generator' },
    },
    {
      agentRound: 7,
      timestamp: '2026-05-13T12:04:00.000Z',
      sessionFile: '/tmp/b.jsonl',
      summary: {
        goal: '整理 reflector checklist',
        completed: ['新增文档'],
        keyDecisions: ['先不改代码'],
        filesChanged: [{ path: 'docs/v1.1/TODO.md', action: 'write' as const }],
        status: 'done',
        blockers: [],
      },
      sessionPointers: { searchQuery: 'reflector checklist' },
    },
  ];

  const byGoal = searchSessionSummaryWarehouse(entries, 'summaryCache eviction', 5);
  assert.equal(byGoal.length, 1);
  assert.equal(byGoal[0]?.agentRound, 6);

  const byFile = searchSessionSummaryWarehouse(entries, 'index.ts', 5);
  assert.equal(byFile[0]?.agentRound, 6);

  const bySearchQuery = searchSessionSummaryWarehouse(entries, 'generator', 5);
  assert.equal(bySearchQuery[0]?.agentRound, 6);
});

test('buildSessionSummarySearchGuidance emits runtime guidance only when warehouse exists', () => {
  assert.equal(buildSessionSummarySearchGuidance(false), '');
  const guidance = buildSessionSummarySearchGuidance(true);
  assert.match(guidance, /ptc_search_summary/);
  assert.match(guidance, /SummaryCache 只包含近期窗口/);
});
