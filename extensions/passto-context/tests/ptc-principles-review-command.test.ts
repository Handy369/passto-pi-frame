import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPrinciplesReviewExportMessage,
  formatPrinciplesReviewImportMessage,
  getPTCUsageText,
  handlePTCPrinciplesReviewCommand,
} from '../ptc-principles-review-command.ts';

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

test('handlePTCPrinciplesReviewCommand dispatches export with default principles dir', async () => {
  const notices: Array<{ message: string; level: string }> = [];
  let received: any = null;

  const handled = await handlePTCPrinciplesReviewCommand('principles review export', {
    principlesDir: '/tmp/principles',
    logger,
    notify: (message, level) => notices.push({ message, level }),
    exportBundle: async (options) => {
      received = options;
      return {
        outputDir: '/tmp/principles/reviews/2026-05-12T13-20-30Z',
        reviewModelPath: '/tmp/principles/reviews/2026-05-12T13-20-30Z/review-model.json',
        reviewHtmlPath: '/tmp/principles/reviews/2026-05-12T13-20-30Z/review.html',
        reviewSessionId: '2026-05-12T13-20-30Z',
        registrySnapshotHash: 'sha256:abc123',
      };
    },
  });

  assert.equal(handled, true);
  assert.equal(received?.principlesDir, '/tmp/principles');
  assert.equal(received?.outputDir, undefined);
  assert.equal(notices[0]?.level, 'info');
  assert.match(notices[0]?.message ?? '', /Principles review bundle exported/);
  assert.match(notices[0]?.message ?? '', /review-model\.json, review\.html/);
});

test('handlePTCPrinciplesReviewCommand dispatches import with expanded file path', async () => {
  const notices: Array<{ message: string; level: string }> = [];
  let received: any = null;

  const handled = await handlePTCPrinciplesReviewCommand('principles review import ~/review-decision.json', {
    principlesDir: '/tmp/principles',
    logger,
    notify: (message, level) => notices.push({ message, level }),
    expandPath: (value) => value.replace('~', '/Users/handy'),
    importDecisionFile: async (options) => {
      received = options;
      return {
        totalDecisions: 7,
        updated: 7,
        active: 2,
        stale: 3,
        archived: 1,
        disabled: 1,
        registryPath: '/tmp/principles/principles-registry.json',
      };
    },
  });

  assert.equal(handled, true);
  assert.equal(received?.decisionFilePath, '/Users/handy/review-decision.json');
  assert.equal(notices[0]?.level, 'info');
  assert.match(notices[0]?.message ?? '', /Principles review imported/);
  assert.match(notices[0]?.message ?? '', /total decisions: 7/);
});

test('handlePTCPrinciplesReviewCommand warns on missing import file', async () => {
  const notices: Array<{ message: string; level: string }> = [];

  const handled = await handlePTCPrinciplesReviewCommand('principles review import', {
    principlesDir: '/tmp/principles',
    logger,
    notify: (message, level) => notices.push({ message, level }),
  });

  assert.equal(handled, true);
  assert.equal(notices[0]?.level, 'warning');
  assert.match(notices[0]?.message ?? '', /Usage: \/ptc \[status\|on\|off\|config\|rotate\|compact\|principles review export\|principles review import <file>\|skills status\|skills ready\|skills reviewed\|skills aggregate \[skillKey\|skillName\|skillPath\]\|skills export \[skillKey\|skillName\|skillPath\] \[output-dir\]\]/);
});

test('handlePTCPrinciplesReviewCommand reports import failure', async () => {
  const notices: Array<{ message: string; level: string }> = [];

  const handled = await handlePTCPrinciplesReviewCommand('principles review import /tmp/review-decision.json', {
    principlesDir: '/tmp/principles',
    logger,
    notify: (message, level) => notices.push({ message, level }),
    importDecisionFile: async () => {
      throw new Error('snapshot mismatch');
    },
  });

  assert.equal(handled, true);
  assert.equal(notices[0]?.level, 'error');
  assert.match(notices[0]?.message ?? '', /Import failed: snapshot mismatch/);
});

test('format message helpers match command surface copy', () => {
  assert.match(getPTCUsageText(), /rotate/);
  assert.match(getPTCUsageText(), /compact/);
  assert.match(getPTCUsageText(), /principles review export/);
  assert.match(getPTCUsageText(), /principles review import <file>/);
  assert.match(getPTCUsageText(), /skills status/);
  assert.match(getPTCUsageText(), /skills ready/);
  assert.match(getPTCUsageText(), /skills reviewed/);
  assert.match(getPTCUsageText(), /skills aggregate/);
  assert.match(getPTCUsageText(), /skills export/);

  assert.match(
    formatPrinciplesReviewExportMessage({
      outputDir: '/tmp/reviews/abc',
      reviewModelPath: '/tmp/reviews/abc/review-model.json',
      reviewHtmlPath: '/tmp/reviews/abc/review.html',
      reviewSessionId: '2026-05-12T13-20-30Z',
      registrySnapshotHash: 'sha256:abc123',
    }),
    /snapshot: sha256:abc123/,
  );

  assert.match(
    formatPrinciplesReviewImportMessage({
      totalDecisions: 7,
      updated: 7,
      active: 2,
      stale: 3,
      archived: 1,
      disabled: 1,
      registryPath: '/tmp/principles/principles-registry.json',
    }),
    /updated: 7/,
  );
}
);
