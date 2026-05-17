import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getBranchRuntimeSnapshot,
  getCachedAgentRoundBoundaries,
  getCachedBranch,
  getCachedLatestUserTimestamp,
  getCachedPreviousAgentRoundEntries,
  getCachedRecentAgentRoundMessages,
  getCachedResolveAgentRoundEntryRange,
  getCachedSessionSummaryWarehouseEntries,
  getCachedSlidingWindowAgentRoundMessages,
  invalidateBranchRuntimeCache,
} from '../branch-runtime-cache.ts';

function makeBranch() {
  return [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
      },
    },
    {
      type: 'message',
      message: {
        role: 'user',
        timestamp: 101,
        content: [{ type: 'text', text: 'hello' }],
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
      },
    },
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 2,
        totalCompletedAgentRounds: 1,
        userTurnsAtStart: 2,
      },
    },
    {
      type: 'message',
      message: {
        role: 'user',
        timestamp: 202,
        content: [{ type: 'text', text: 'next round' }],
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        summaryEntry: {
          agentRound: 2,
          timestamp: '2026-05-16T10:00:00.000Z',
          sessionFile: '/tmp/cache-session.jsonl',
          summary: {
            goal: 'cache warehouse',
            completed: ['done'],
            keyDecisions: ['reuse branch snapshot'],
            filesChanged: [{ path: 'index.ts', action: 'edit' }],
            status: 'ok',
            blockers: [],
          },
          sessionPointers: {
            file: '/tmp/cache-session.jsonl',
            searchQuery: 'cache warehouse',
          },
        },
      },
    },
  ];
}

test('branch runtime cache reuses branch within the same revision', () => {
  invalidateBranchRuntimeCache();
  let getBranchCalls = 0;
  const branch = makeBranch();
  const ctx = {
    sessionManager: {
      getBranch() {
        getBranchCalls += 1;
        return branch;
      },
      getLeafId() {
        return 'leaf-1';
      },
      getSessionFile() {
        return '/tmp/cache-session.jsonl';
      },
    },
  };

  const first = getCachedBranch(ctx);
  const second = getCachedBranch(ctx);
  const snapshot = getBranchRuntimeSnapshot(ctx);

  assert.equal(getBranchCalls, 1);
  assert.equal(first, branch);
  assert.equal(second, branch);
  assert.equal(snapshot.branch, branch);
});

test('branch runtime cache invalidates when revision changes', () => {
  invalidateBranchRuntimeCache();
  let getBranchCalls = 0;
  const branches = [makeBranch(), makeBranch()];
  const ctx = {
    sessionManager: {
      getBranch() {
        getBranchCalls += 1;
        return getBranchCalls === 1 ? branches[0] : branches[1];
      },
      getLeafId() {
        return getBranchCalls === 0 ? 'leaf-1' : 'leaf-2';
      },
      getSessionFile() {
        return '/tmp/cache-session.jsonl';
      },
    },
  };

  getCachedBranch(ctx);
  getCachedBranch(ctx);
  assert.equal(getBranchCalls, 2);
});

test('branch runtime cache memoizes latest user timestamp and session warehouse', () => {
  invalidateBranchRuntimeCache();
  const ctx = {
    sessionManager: {
      getBranch() {
        return makeBranch();
      },
      getLeafId() {
        return 'leaf-1';
      },
      getSessionFile() {
        return '/tmp/cache-session.jsonl';
      },
    },
  };

  assert.equal(getCachedLatestUserTimestamp(ctx), 202);
  assert.equal(getCachedLatestUserTimestamp(ctx), 202);

  const firstWarehouse = getCachedSessionSummaryWarehouseEntries(ctx);
  const secondWarehouse = getCachedSessionSummaryWarehouseEntries(ctx);
  assert.equal(firstWarehouse.length, 1);
  assert.equal(firstWarehouse, secondWarehouse);
});

test('branch runtime cache memoizes round boundaries and derived slices', () => {
  invalidateBranchRuntimeCache();
  const ctx = {
    sessionManager: {
      getBranch() {
        return makeBranch();
      },
      getLeafId() {
        return 'leaf-1';
      },
      getSessionFile() {
        return '/tmp/cache-session.jsonl';
      },
    },
  };

  const boundaries = getCachedAgentRoundBoundaries(ctx);
  const boundariesAgain = getCachedAgentRoundBoundaries(ctx);
  assert.equal(boundaries.length, 2);
  assert.equal(boundaries, boundariesAgain);

  const previous = getCachedPreviousAgentRoundEntries(ctx);
  const previousAgain = getCachedPreviousAgentRoundEntries(ctx);
  assert.equal(previous, previousAgain);
  assert.equal(previous.length, 2);

  const recent = getCachedRecentAgentRoundMessages(ctx, 1);
  const recentAgain = getCachedRecentAgentRoundMessages(ctx, 1);
  assert.equal(recent, recentAgain);
  assert.equal(recent.length, 1);

  const sliding = getCachedSlidingWindowAgentRoundMessages(ctx, 1, 100, 50);
  const slidingAgain = getCachedSlidingWindowAgentRoundMessages(ctx, 1, 100, 50);
  assert.equal(sliding, slidingAgain);

  const range = getCachedResolveAgentRoundEntryRange(ctx, 2);
  const rangeAgain = getCachedResolveAgentRoundEntryRange(ctx, 2);
  assert.equal(range, rangeAgain);
  assert.deepEqual(range, {
    startAgentEntryIndex: 3,
    endAgentEntryIndex: 5,
  });
});
