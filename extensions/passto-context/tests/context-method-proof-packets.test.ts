import test from 'node:test';
import assert from 'node:assert/strict';

import { buildContextMethodProofPacketInjection, buildContextMethodProofPackets } from '../grc-prompts.ts';
import type { UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

function makeUserGoalTree(): UserGoalTreeDocument {
  return {
    version: 1,
    agentRound: 12,
    updatedAt: '2026-05-22T00:00:00.000Z',
    currentFocusUserGoalId: 'goal-root',
    rootUserGoalIds: ['goal-root'],
    userGoals: [
      {
        id: 'goal-root',
        parentId: null,
        assertion: '完成 Context / Method / Proof packet 注入',
        status: 'executing',
        executionState: 'executing',
        reviewState: 'generator_projected',
        relationState: 'active',
        xNodeModelId: 'xnode-goal-root',
        sinceRound: 10,
        lastTouchedRound: 12,
      },
      {
        id: 'goal-sleeping',
        parentId: null,
        assertion: '暂缓的旁路目标',
        status: 'planning',
        executionState: 'planning',
        reviewState: 'curator_reviewed',
        relationState: 'active',
        xNodeModelId: 'xnode-goal-sleeping',
        sinceRound: 8,
        lastTouchedRound: 9,
      },
    ],
  };
}

function makeXNodeModel(): XNodeModelDocument {
  return {
    version: 1,
    id: 'xnode-goal-root',
    userGoalId: 'goal-root',
    agentRound: 12,
    updatedAt: '2026-05-22T00:00:00.000Z',
    currentFocusXNodeId: 'xnode-child',
    rootXNodeIds: ['goal-root'],
    nodes: [
      {
        id: 'goal-root',
        parentId: null,
        assertion: '完成 Context / Method / Proof packet 注入',
        status: 'active',
        atomicity: 'composite',
        phase: 'execute',
        why: { summary: '让 LLM 获得稳定信息参数', confidence: 'closed' },
        what: { summary: '注入三类 packet', confidence: 'closed' },
        flow: { summary: 'builder → before-agent-start → tests', confidence: 'partial' },
        structure: { summary: 'grc-prompts / before-agent-start', confidence: 'closed' },
        runtimeProof: { summary: '等待测试证明', confidence: 'partial' },
        sinceRound: 10,
        lastTouchedRound: 12,
        priority: 0,
        order: 0,
      },
      {
        id: 'xnode-child',
        parentId: 'goal-root',
        assertion: '实现 packet builder',
        status: 'active',
        atomicity: 'atomic',
        phase: 'testing',
        why: { summary: 'P3 最小切片', confidence: 'closed' },
        what: { summary: 'ContextParameterPacket / MethodPacket / ProofPacket', confidence: 'closed' },
        flow: { summary: '新增 builder 与注入', confidence: 'partial' },
        structure: { summary: 'prompt packet surface', confidence: 'closed' },
        runtimeProof: { summary: 'packet tests', confidence: 'partial' },
        sinceRound: 12,
        lastTouchedRound: 12,
        priority: 0,
        order: 1,
      },
    ],
    latestRuntimeProof: {
      targetXNodeId: 'xnode-child',
      atRound: 12,
      resultSummary: 'packet builder has focused proof surface',
      proofMode: 'tests',
      proofStatus: 'partial',
      evidence: ['context-method-proof-packets.test.ts'],
      verificationMethod: ['node --test'],
    },
    latestProofSignals: [
      {
        id: 'proof-xnode-child-12-runtime-proof-partial',
        targetXNodeId: 'xnode-child',
        atRound: 12,
        type: 'runtime-proof-partial',
        message: 'P3 needs before-agent-start injection coverage',
        suggestedNextStepType: 'run_tests',
        evidence: ['P3 packet proof'],
      },
    ],
  };
}

test('buildContextMethodProofPackets creates stable context, method and proof packet contracts', () => {
  const packets = buildContextMethodProofPackets({
    userGoalTree: makeUserGoalTree(),
    xNodeModel: makeXNodeModel(),
    latestCommits: [{
      commitId: 'commit-1',
      userGoalId: 'goal-root',
      xNodeModelId: 'xnode-goal-root',
      xNodeId: 'previous-node',
      resultStatus: 'completed',
      outputRefs: [],
      proofRefs: [],
      statePatch: { status: 'completed', phase: 'complete' },
      evidence: ['previous commit'],
    }],
  });

  assert.equal(packets.contextParameterPacket.currentFocusUserGoalId, 'goal-root');
  assert.equal(packets.contextParameterPacket.currentFocusXNodeModelId, 'xnode-goal-root');
  assert.equal(packets.contextParameterPacket.currentFocusXNodeId, 'xnode-child');
  assert.deepEqual(packets.contextParameterPacket.focusUserGoalPath.map((goal) => goal.id), ['goal-root']);
  assert.deepEqual(packets.contextParameterPacket.focusXNodePath.map((node) => node.id), ['goal-root', 'xnode-child']);
  assert.deepEqual(packets.contextParameterPacket.sleepingUserGoals.map((goal) => goal.id), ['goal-sleeping']);
  assert.equal(packets.contextParameterPacket.latestCommits.length, 1);
  assert.equal(packets.contextParameterPacket.latestRuntimeProof?.targetXNodeId, 'xnode-child');
  assert.equal(packets.contextParameterPacket.runtimeContextHintSurface.dynamicStateSource, 'object-sidecars');
  assert.equal(packets.contextParameterPacket.runtimeContextHintSurface.focusUserGoalIdCandidate, 'goal-root');
  assert.equal(packets.contextParameterPacket.runtimeContextHintSurface.phaseCandidate, 'testing');
  assert.equal(packets.contextParameterPacket.runtimeContextHintSurface.policyHint, null);
  assert.equal(packets.contextParameterPacket.runtimeContextHintSurface.proofStatusHint, 'partial');
  assert.deepEqual(packets.contextParameterPacket.runtimeContextHintSurface.warnings, []);

  assert.ok(packets.methodPackets.some((packet) => packet.methodRef === 'GoalRelationDecision'));
  assert.ok(packets.methodPackets.some((packet) => packet.methodRef === 'RuntimeProofValidation'));
  assert.ok(packets.methodPackets.some((packet) => packet.methodRef === 'PostNodeCommit'));
  assert.ok(packets.methodPackets.every((packet) => packet.advisoryOnly));
  assert.ok(packets.methodPackets.find((packet) => packet.methodRef === 'GoalRelationDecision')?.purpose.includes('不是脚本裁决'));
  assert.ok(packets.methodPackets.find((packet) => packet.methodRef === 'GoalRelationDecision')?.outputContract.some((line) => /producesNewUserGoal/.test(line)));
  assert.ok(packets.methodPackets.find((packet) => packet.methodRef === 'PostNodeCommit')?.outputContract.some((line) => /advisory-only/.test(line)));

  assert.equal(packets.proofPacket?.targetUserGoalId, 'goal-root');
  assert.equal(packets.proofPacket?.targetXNodeModelId, 'xnode-goal-root');
  assert.equal(packets.proofPacket?.targetXNodeId, 'xnode-child');
  assert.equal(packets.proofPacket?.proofStatus, 'partial');
  assert.match(packets.proofPacket?.userVisibleSummary ?? '', /packet builder has focused proof surface/);
});

test('buildContextMethodProofPackets reads latest commits from x-node model commitLog by default', () => {
  const model = makeXNodeModel();
  model.commitLog = [{
    commitId: 'commit-from-model',
    userGoalId: 'goal-root',
    xNodeModelId: 'xnode-goal-root',
    xNodeId: 'xnode-child',
    resultStatus: 'completed',
    outputRefs: [],
    proofRefs: [model.latestRuntimeProof!],
    statePatch: { status: 'completed', phase: 'complete', nextFocusXNodeId: null },
    evidence: ['complete_xnode userGoalId=goal-root xNodeId=xnode-child'],
  }];

  const packets = buildContextMethodProofPackets({
    userGoalTree: makeUserGoalTree(),
    xNodeModel: model,
  });

  assert.equal(packets.contextParameterPacket.latestCommits[0]?.commitId, 'commit-from-model');
  assert.equal(packets.contextParameterPacket.latestCommits[0]?.xNodeModelId, 'xnode-goal-root');
});

test('buildContextMethodProofPackets exposes unresolved_context_state instead of silently creating a root goal', () => {
  const packets = buildContextMethodProofPackets({
    userGoalTree: null,
    xNodeModel: null,
  });

  assert.equal(packets.contextParameterPacket.runtimeContextHintSurface.dynamicStateSource, 'unresolved_context_state');
  assert.equal(packets.contextParameterPacket.runtimeContextHintSurface.phaseCandidate, 'unresolved_context_state');
  assert.match(packets.contextParameterPacket.runtimeContextHintSurface.warnings.join('\n'), /Do not silently create a root goal/);

  const injection = buildContextMethodProofPacketInjection(packets);
  assert.match(injection, /phaseCandidate=unresolved_context_state/);
  assert.match(injection, /unresolved_context_state: No resolvable current focus/);
  assert.doesNotMatch(injection, /goal_materialization/);
});

test('buildContextMethodProofPacketInjection renders packet surface for before-agent-start prompt', () => {
  const injection = buildContextMethodProofPacketInjection(buildContextMethodProofPackets({
    userGoalTree: makeUserGoalTree(),
    xNodeModel: makeXNodeModel(),
    latestCommits: [],
  }));

  assert.match(injection, /ContextParameterPacket/);
  assert.match(injection, /currentFocusUserGoalId=goal-root/);
  assert.match(injection, /currentFocusXNodeModelId=xnode-goal-root/);
  assert.match(injection, /focusXNodePath=goal-root > xnode-child/);
  assert.match(injection, /sleepingUserGoals=goal-sleeping/);
  assert.match(injection, /Runtime Context Hint Surface/);
  assert.match(injection, /dynamicStateSource=object-sidecars/);
  assert.match(injection, /focusUserGoalIdCandidate=goal-root/);
  assert.match(injection, /phaseCandidate=testing/);
  assert.match(injection, /proofStatusHint=partial/);
  assert.match(injection, /do not override the latest user input or LLM-owned decisions/);
  assert.match(injection, /MethodPacket/);
  assert.match(injection, /method packets are advisory method references, not workflow commands/);
  assert.match(injection, /GoalRelationDecision/);
  assert.match(injection, /advisoryOnly=true/);
  assert.match(injection, /nextFocusHint\(advisory-only\)/);
  assert.match(injection, /ProofPacket/);
  assert.match(injection, /proofStatus=partial/);
  assert.match(injection, /userVisibleSummary=packet builder has focused proof surface/);
});
