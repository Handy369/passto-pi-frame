import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePTCSubcommand } from '../ptc-command-routing.ts';

test('normalizePTCSubcommand keeps normal subcommands unchanged', () => {
  assert.equal(normalizePTCSubcommand('status'), 'status');
  assert.equal(normalizePTCSubcommand('rotate'), 'rotate');
  assert.equal(normalizePTCSubcommand('CONFIG'), 'config');
});

test('normalizePTCSubcommand maps compact to rotate alias', () => {
  assert.equal(normalizePTCSubcommand('compact'), 'rotate');
  assert.equal(normalizePTCSubcommand('COMPACT'), 'rotate');
});
