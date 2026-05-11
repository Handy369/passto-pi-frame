import test from 'node:test';
import assert from 'node:assert/strict';

import { createInitialGRCState, restoreGRCState, updateCuratorStatus, updateReflectorStatus } from '../grc-state.ts';

test('updateReflectorStatus tracks processed and last reflected agent rounds', () => {
  const initial = createInitialGRCState();
  const next = updateReflectorStatus(initial, 'done', 'reflector advice', 12, 7, 7);

  assert.equal(next.reflector.status, 'done');
  assert.equal(next.reflector.lastAdvice, 'reflector advice');
  assert.equal(next.reflector.processedUpToTurn, 12);
  assert.equal(next.reflector.processedUpToAgentRound, 7);
  assert.equal(next.reflector.lastReflectedAgentRound, 7);
});

test('updateCuratorStatus tracks processed and last curated agent rounds', () => {
  const initial = createInitialGRCState();
  const next = updateCuratorStatus(initial, 'done', 'curator summary', 14, 0, null, null, undefined, null, 6, 6);

  assert.equal(next.curator.status, 'done');
  assert.equal(next.curator.lastSummary, 'curator summary');
  assert.equal(next.curator.processedUpToTurn, 14);
  assert.equal(next.curator.processedUpToAgentRound, 6);
  assert.equal(next.curator.lastCuratedAgentRound, 6);
});

test('restoreGRCState preserves new round-based fields while normalizing running statuses', () => {
  const restored = restoreGRCState({
    ...createInitialGRCState(),
    mode: 'grc',
    runtimeMode: 'off',
    reflector: {
      ...createInitialGRCState().reflector,
      status: 'running',
      processedUpToTurn: 20,
      processedUpToAgentRound: 9,
      lastReflectedAgentRound: 9,
    },
    curator: {
      ...createInitialGRCState().curator,
      status: 'running',
      processedUpToTurn: 18,
      processedUpToAgentRound: 8,
      lastCuratedAgentRound: 8,
    },
  });

  assert.equal(restored.runtimeMode, 'off');
  assert.equal(restored.reflector.status, 'idle');
  assert.equal(restored.curator.status, 'idle');
  assert.equal(restored.reflector.processedUpToAgentRound, 9);
  assert.equal(restored.reflector.lastReflectedAgentRound, 9);
  assert.equal(restored.curator.processedUpToAgentRound, 8);
  assert.equal(restored.curator.lastCuratedAgentRound, 8);
});

test('restoreGRCState maps legacy manualMode forced-off to runtimeMode off when runtimeMode is absent', () => {
  const legacyState = { ...createInitialGRCState() } as Record<string, unknown>;
  delete legacyState.runtimeMode;
  legacyState.mode = 'grc';
  legacyState.manualMode = 'forced-off';

  const restored = restoreGRCState(legacyState);
  assert.equal(restored.runtimeMode, 'off');
});

test('restoreGRCState maps legacy manualMode forced-on to runtimeMode on when runtimeMode is absent', () => {
  const legacyState = { ...createInitialGRCState() } as Record<string, unknown>;
  delete legacyState.runtimeMode;
  legacyState.mode = 'grc';
  legacyState.manualMode = 'forced-on';

  const restored = restoreGRCState(legacyState);
  assert.equal(restored.runtimeMode, 'on');
});
