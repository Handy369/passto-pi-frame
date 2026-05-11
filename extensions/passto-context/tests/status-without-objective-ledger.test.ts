import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPTCStatus } from '../ptc-status.ts';

test('/ptc status keeps converged round-centric fields and includes top-level runtime status', () => {
  const text = formatPTCStatus({
    sessionDisplayName: 'demo-session',
    configFileLabel: '/tmp/config.json',
    runtimeModeLabel: 'on',
    memoryEnabled: true,
    trackingEnabled: true,
    widgetEnabled: true,
    grcEnabled: true,
    currentMode: 'grc',
    currentAgentRound: 7,
    currentTurnRound: 2,
    reflectorStatus: 'done',
    lastReflectedAgentRound: 6,
    curatorStatus: 'done',
    lastCuratedAgentRound: 5,
    summaryCacheRounds: [3, 4, 5],
    lastSignalLabel: 'advance (confidence=0.92)',
    latestCuratorArtifactRound: 5,
    principlesStored: 9,
    orchestratorGuardLabel: 'active',
    sessionTurnCount: 9,
    filesModifiedCount: 2,
    contextUsageLabel: '4,096 / 128,000 (3%)',
    latestReflectorAdvice: '优先保持 GoalState 焦点一致。',
    latestCuratorSummary: '已完成 P4 测试补强。',
    goalStateSnapshot: {
      active: 2,
      completed: 4,
      migrations: 1,
      pruned: 0,
      updatedRound: 5,
    },
  });

  assert.match(text, /Runtime/);
  assert.match(text, /Memory/);
  assert.match(text, /Tracking/);
  assert.match(text, /Widget/);
  assert.match(text, /Current agent-round/);
  assert.match(text, /Current turn-round/);
  assert.match(text, /Reflector status/);
  assert.match(text, /Last reflected round/);
  assert.match(text, /Curator status/);
  assert.match(text, /Last curated round/);
  assert.match(text, /\*\*SummaryCache entries\*\*: 3 \(rounds=3,4,5\)/);
  assert.match(text, /\*\*Last Signal\*\*: advance \(confidence=0\.92\)/);
  assert.match(text, /\*\*Latest Curator Artifact Round\*\*: 5/);
  assert.match(text, /GoalState Snapshot/);

  assert.doesNotMatch(text, /Objective/i);
  assert.doesNotMatch(text, /Ledger/i);
  assert.doesNotMatch(text, /Has GoalState/);
  assert.doesNotMatch(text, /Injected SummaryCache rounds/);
  assert.doesNotMatch(text, /processedUpToAgentRound/);
  assert.doesNotMatch(text, /Prompt-rounds/);
  assert.doesNotMatch(text, /Legacy/);
  assert.doesNotMatch(text, /GRC cycles/);
  assert.doesNotMatch(text, /Latest SummaryEntry/);
  assert.doesNotMatch(text, /Manual mode/);
});
