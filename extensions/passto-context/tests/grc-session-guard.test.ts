import test from 'node:test';
import assert from 'node:assert/strict';

import { getSessionStateGuardReason, isSessionStateReady, normalizeSessionFile } from '../grc-session-guard.ts';

test('normalizeSessionFile normalizes empty and missing values to null', () => {
  assert.equal(normalizeSessionFile(undefined), null);
  assert.equal(normalizeSessionFile(null), null);
  assert.equal(normalizeSessionFile(''), null);
  assert.equal(normalizeSessionFile('   '), null);
  assert.equal(normalizeSessionFile('/tmp/a.jsonl'), '/tmp/a.jsonl');
});

test('isSessionStateReady rejects injection before session restore finishes', () => {
  assert.equal(isSessionStateReady('/tmp/a.jsonl', '/tmp/a.jsonl', false), false);
  assert.equal(getSessionStateGuardReason('/tmp/a.jsonl', '/tmp/a.jsonl', false), 'restore-not-ready');
});

test('isSessionStateReady allows injection only when active and current sessions match', () => {
  assert.equal(isSessionStateReady('/tmp/a.jsonl', '/tmp/a.jsonl', true), true);
  assert.equal(getSessionStateGuardReason('/tmp/a.jsonl', '/tmp/a.jsonl', true), null);
  assert.equal(isSessionStateReady('/tmp/a.jsonl', '/tmp/b.jsonl', true), false);
  assert.match(getSessionStateGuardReason('/tmp/a.jsonl', '/tmp/b.jsonl', true) ?? '', /session-mismatch/);
});

test('isSessionStateReady treats null session files as matching ephemeral sessions', () => {
  assert.equal(isSessionStateReady(null, null, true), true);
  assert.equal(getSessionStateGuardReason(null, null, true), null);
  assert.equal(isSessionStateReady(null, '/tmp/a.jsonl', true), false);
});
