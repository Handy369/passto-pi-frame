import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPTCStatus } from '../ptc-status.ts';
import { createInitialGRCState } from '../grc-state.ts';
import { getRuntimeSurfacePolicySnapshot } from '../grc-policy-surface.ts';

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
    latestReflectorDiagnosisLabel: 'aligned=true, driftSource=none, confidence=0.92, evidence=2',
    latestCuratorSummary: '已完成 P4 测试补强。',
    latestGoalTransitionLabel: '目标完成/改变为: 推进 P4 upward regression 证据',
    currentUserGoal: {
      id: 'goal-focus',
      assertion: '推进 P4 upward regression 证据',
      executionState: 'testing',
      reviewState: 'curator_reviewed',
      relationState: 'active',
    },
    currentXNode: {
      id: 'goal-focus',
      phase: 'testing',
      atomicity: 'atomic',
      status: 'active',
    },
    latestNextStepPolicy: {
      nextStepType: 'run_tests',
      confidence: 0.78,
      runtimeProof: 'open',
      keyGaps: ['runtimeProof: 尚未补齐真实运行态证据'],
      source: 'x-node-policy',
    },
    latestRuntimeProof: {
      targetXNodeId: 'goal-focus',
      proofStatus: 'partial',
      proofMode: 'tests',
      signalTypes: ['runtime-proof-partial'],
    },
    provisionalOverlay: {
      active: true,
      sourceAgentRound: 7,
      hasUserGoalState: true,
      hasXNodeState: false,
    },
    latestCompletion: {
      localComplete: false,
      modelComplete: true,
      treeComplete: false,
      nextFocusUserGoalId: 'goal-next',
      nextOpenXNodeId: null,
    },
    goalStateSnapshot: {
      version: 2,
      active: 2,
      completed: 4,
      migrations: 1,
      pruned: 0,
      updatedRound: 5,
      nodes: 6,
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
  assert.match(text, /version=2/);
  assert.match(text, /nodes=6/);
  assert.match(text, /Latest Reflector Diagnosis/);
  assert.match(text, /driftSource=none/);
  assert.match(text, /Latest Goal Transition/);
  assert.match(text, /目标完成\/改变为: 推进 P4 upward regression 证据/);
  assert.match(text, /Current Object Focus/);
  assert.match(text, /userGoalId=goal-focus, executionState=testing, reviewState=curator_reviewed, relationState=active/);
  assert.match(text, /assertion=推进 P4 upward regression 证据/);
  assert.match(text, /xNodeId=goal-focus, phase=testing, atomicity=atomic, status=active/);
  assert.match(text, /Latest Policy Projection/);
  assert.match(text, /nextStepType=run_tests, confidence=0\.78, runtimeProof=open, source=x-node-policy/);
  assert.match(text, /keyGaps=runtimeProof: 尚未补齐真实运行态证据/);
  assert.match(text, /Latest Runtime Proof/);
  assert.match(text, /targetXNodeId=goal-focus, proofStatus=partial, proofMode=tests/);
  assert.match(text, /proofSignals=runtime-proof-partial/);
  assert.match(text, /Runtime Provisional Overlay/);
  assert.match(text, /active=true, sourceAgentRound=7, userGoalState=true, xNodeState=false/);
  assert.match(text, /Latest Completion Closure/);
  assert.match(text, /localComplete=false, modelComplete=true, treeComplete=false/);
  assert.match(text, /nextFocusUserGoalId=goal-next, nextOpenXNodeId=none/);

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

test('getRuntimeSurfacePolicySnapshot ignores legacy provisional overlay and prefers confirmed stored policy', () => {
  const state = createInitialGRCState();
  state.curator.lastPolicyProjection = {
    xNodeId: 'confirmed-goal',
    derivedAtRound: 2,
    dimensions: {
      why: 'closed',
      what: 'closed',
      flow: 'open',
      structure: 'open',
      runtimeProof: 'open',
    },
    keyGaps: ['confirmed gap'],
    nextStepType: 'plan_repair',
    confidence: 0.6,
    guidance: ['confirmed guidance'],
  };
  state.curator.runtimeProvisionalOverlay = {
    sourceAgentRound: 3,
    createdAt: '2026-05-20T20:29:00.000Z',
    source: 'generator',
    userGoalState: {
      baseUserGoalTreeRound: null,
      sourceAgentRound: 3,
      createdAt: '2026-05-20T20:29:00.000Z',
      source: 'generator',
      userGoalTree: {
        version: 1,
        agentRound: 3,
        updatedAt: '2026-05-20T20:29:00.000Z',
        currentFocusUserGoalId: 'draft-goal',
        rootUserGoalIds: ['draft-goal'],
        userGoals: [
          {
            id: 'draft-goal',
            parentId: null,
            assertion: '补写 draft goal runtime 的 fresh real session proof',
            status: 'planning',
            xNodeModelId: 'xnode-draft-goal',
            sinceRound: 3,
            lastTouchedRound: 3,
          },
        ],
      },
    },
    xNodeState: {
      baseXNodeModelRound: null,
      sourceAgentRound: 3,
      createdAt: '2026-05-20T20:29:00.000Z',
      source: 'generator',
      xNodeModel: {
        version: 1,
        userGoalId: 'draft-goal',
        agentRound: 3,
        updatedAt: '2026-05-20T20:29:00.000Z',
        currentFocusXNodeId: 'draft-goal',
        rootXNodeIds: ['draft-goal'],
        nodes: [
          {
            id: 'draft-goal',
            parentId: null,
            assertion: '补写 draft goal runtime 的 fresh real session proof',
            status: 'active',
            atomicity: 'undecided',
            phase: 'plan',
            why: { summary: 'draft why', confidence: 'partial' },
            what: { summary: 'draft what', confidence: 'partial' },
            flow: { summary: 'draft flow', confidence: 'partial' },
            structure: { summary: 'draft structure', confidence: 'partial' },
            runtimeProof: { summary: 'draft proof gap', confidence: 'open' },
            sinceRound: 3,
            lastTouchedRound: 3,
            priority: 0,
            order: 0,
          },
        ],
        latestPolicyProjection: {
          xNodeId: 'draft-goal',
          derivedAtRound: 3,
          dimensions: {
            why: 'partial',
            what: 'partial',
            flow: 'partial',
            structure: 'partial',
            runtimeProof: 'open',
          },
          keyGaps: ['overlay gap'],
          nextStepType: 'run_tests',
          confidence: 0.52,
          guidance: ['overlay guidance'],
        },
      },
    },
  };

  const snapshot = getRuntimeSurfacePolicySnapshot(state);
  assert.ok(snapshot);
  assert.equal(snapshot?.nextStepType, 'plan_repair');
  assert.equal(snapshot?.confidence, 0.6);
  assert.equal(snapshot?.source, 'x-node-policy');
  assert.deepEqual(snapshot?.keyGaps, ['confirmed gap']);
});
