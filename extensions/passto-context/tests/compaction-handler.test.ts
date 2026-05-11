import test from 'node:test';
import assert from 'node:assert/strict';

import { createCompactionHandler } from '../compaction.ts';

function createLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}

function createEvent() {
  return {
    preparation: {
      tokensBefore: 2048,
      firstKeptEntryId: 'entry-42',
      fileOps: {
        read: new Set(['/repo/README.md', '/repo/src/index.ts']),
        edited: new Set(['/repo/src/index.ts']),
        written: new Set(['/repo/docs/notes.md']),
      },
    },
  };
}

test('createCompactionHandler falls back to Pi default compaction when curator summary is absent', async () => {
  const handler = createCompactionHandler({} as never, createLogger() as never);
  const result = await handler.handleCompaction(createEvent() as never, {} as never, {});

  assert.equal(result, undefined);
});

test('createCompactionHandler uses curator summary only when it is present', async () => {
  const handler = createCompactionHandler({} as never, createLogger() as never);
  const result = await handler.handleCompaction(
    createEvent() as never,
    {} as never,
    { curatorSummary: '  已由 Curator 生成最终摘要  ' },
  );

  assert.ok(result);
  assert.equal(result.compaction.summary, '已由 Curator 生成最终摘要');
  assert.equal(result.compaction.firstKeptEntryId, 'entry-42');
  assert.equal(result.compaction.tokensBefore, 2048);
  assert.deepEqual(result.compaction.details, {
    readFiles: ['/repo/README.md'],
    modifiedFiles: ['/repo/docs/notes.md', '/repo/src/index.ts'],
    strategy: 'curator-summary',
  });
});
