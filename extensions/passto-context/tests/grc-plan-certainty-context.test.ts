import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collectPlanCertaintyContext,
  mergePlanCertaintyContextPackets,
  type PlanCertaintyContextRequest,
} from '../grc-plan-certainty-context.ts';
import type { UserGoalTreeDocument, XNodeModelDocument } from '../types.ts';

const REQUEST: PlanCertaintyContextRequest = {
  targetUserGoalId: 'goal-p3',
  targetXNodeId: 'xnode-p3',
  targetFacet: 'structure',
  blockingQuestion: 'provider 应从哪里读取结构事实？',
  requiredParameter: '当前 userGoal、xNode、policy 与 proof 摘要',
  expectedShape: 'mixed',
};

test('collectPlanCertaintyContext returns target user goal, x-node, policy and proof summaries', () => {
  const packet = collectPlanCertaintyContext({
    request: REQUEST,
    userGoalTree: makeUserGoalTree(),
    xNodeModels: [makeXNodeModel()],
  });

  assert.equal(packet.targetUserGoal?.id, 'goal-p3');
  assert.equal(packet.targetUserGoal?.assertion, '实现 P3 provider');
  assert.equal(packet.targetUserGoal?.executionState, 'executing');
  assert.equal(packet.targetXNode?.id, 'xnode-p3');
  assert.equal(packet.targetXNode?.facetStatus.structure, 'partial');
  assert.equal(packet.policyProjection?.nextStepType, 'plan_repair');
  assert.equal(packet.latestRuntimeProof?.proofStatus, 'partial');
  assert.equal(packet.proofSignals.length, 1);
  assert.deepEqual(packet.unknowns, []);
  assert.ok(packet.facts.some((fact) => fact.includes('targetFacet.structure.confidence=partial')));
  assert.ok(packet.decisions.some((decision) => decision.includes('policy guidance recommends plan_repair')));
  assert.ok(packet.constraints.some((constraint) => constraint.includes('must not modify object state')));
  assert.ok(packet.evidence.some((item) => item.includes('source:xNodeModels.nodes[id=xnode-p3]')));
});

test('collectPlanCertaintyContext returns unknowns instead of throwing when targets are missing', () => {
  const packet = collectPlanCertaintyContext({
    request: { ...REQUEST, targetUserGoalId: 'missing-goal', targetXNodeId: 'missing-node' },
    userGoalTree: makeUserGoalTree(),
    xNodeModels: [makeXNodeModel()],
  });

  assert.equal(packet.targetUserGoal, null);
  assert.equal(packet.targetXNode, null);
  assert.ok(packet.unknowns.some((unknown) => unknown.includes('target userGoal not found: missing-goal')));
  assert.ok(packet.unknowns.some((unknown) => unknown.includes('target xNode not found: missing-node')));
  assert.ok(packet.evidence.some((item) => item.includes('PlanCertaintyContextProvider object-state snapshot')));
});

test('mergePlanCertaintyContextPackets merges parallel provider/subagent packets with deduped evidence', () => {
  const base = collectPlanCertaintyContext({
    request: REQUEST,
    userGoalTree: makeUserGoalTree(),
    xNodeModels: [makeXNodeModel()],
  });
  const parallel = {
    ...base,
    facts: ['subagent fact: proof builder exists', 'targetUserGoal=goal-p3: 实现 P3 provider'],
    decisions: ['subagent decision: keep provider read-only'],
    constraints: ['subagent constraint: no fixed tool list'],
    unknowns: ['subagent unknown: later tool registration'],
    evidence: ['subagent evidence: grc-runtime-proof.ts', 'source:xNodeModels.nodes[id=xnode-p3]'],
  };

  const merged = mergePlanCertaintyContextPackets(REQUEST, [base, parallel]);

  assert.equal(merged.targetUserGoal?.id, 'goal-p3');
  assert.equal(merged.targetXNode?.id, 'xnode-p3');
  assert.equal(merged.proofSignals.length, 1);
  assert.ok(merged.facts.includes('subagent fact: proof builder exists'));
  assert.ok(merged.decisions.includes('subagent decision: keep provider read-only'));
  assert.ok(merged.constraints.includes('merged packet preserves source packets and does not decide exit state'));
  assert.ok(merged.unknowns.includes('subagent unknown: later tool registration'));
  assert.ok(merged.evidence.includes('merged 2 plan-certainty context packet(s)'));
  assert.equal(merged.evidence.filter((item) => item === 'source:xNodeModels.nodes[id=xnode-p3]').length, 1);
});

function makeUserGoalTree(): UserGoalTreeDocument {
  return {
    version: 1,
    agentRound: 7,
    updatedAt: '2026-05-22T00:00:00.000Z',
    currentFocusUserGoalId: 'goal-p3',
    rootUserGoalIds: ['goal-p3'],
    userGoals: [{
      id: 'goal-p3',
      parentId: null,
      assertion: '实现 P3 provider',
      status: 'executing',
      executionState: 'executing',
      reviewState: 'generator_projected',
      relationState: 'active',
      xNodeModelId: 'xnode-goal-p3',
      sinceRound: 7,
      lastTouchedRound: 7,
    }],
  };
}

function makeXNodeModel(): XNodeModelDocument {
  return {
    version: 1,
    userGoalId: 'goal-p3',
    agentRound: 7,
    updatedAt: '2026-05-22T00:00:00.000Z',
    currentFocusXNodeId: 'xnode-p3',
    rootXNodeIds: ['xnode-p3'],
    nodes: [{
      id: 'xnode-p3',
      parentId: null,
      assertion: '实施 P3 Context parameter provider',
      status: 'active',
      atomicity: 'atomic',
      phase: 'execute',
      why: { summary: 'why closed', confidence: 'closed' },
      what: { summary: 'what closed', confidence: 'closed' },
      flow: { summary: 'flow partial', confidence: 'partial' },
      structure: { summary: 'provider file not yet proven', confidence: 'partial' },
      runtimeProof: { summary: 'tests pending', confidence: 'partial' },
      sinceRound: 7,
      lastTouchedRound: 7,
      priority: 0,
      order: 0,
    }],
    latestPolicyProjection: {
      xNodeId: 'xnode-p3',
      derivedAtRound: 7,
      dimensions: {
        why: 'closed',
        what: 'closed',
        flow: 'partial',
        structure: 'partial',
        runtimeProof: 'partial',
      },
      keyGaps: ['structure: provider file not yet proven'],
      nextStepType: 'plan_repair',
      confidence: 0.72,
      guidance: ['policy guidance sample'],
    },
    latestRuntimeProof: {
      targetXNodeId: 'xnode-p3',
      atRound: 7,
      resultSummary: 'proof partial',
      proofMode: 'self-proof',
      proofStatus: 'partial',
      evidence: ['tests pending'],
      verificationMethod: ['run provider tests'],
    },
    latestProofSignals: [{
      id: 'proof-xnode-p3-7-runtime-proof-partial',
      targetXNodeId: 'xnode-p3',
      atRound: 7,
      type: 'runtime-proof-partial',
      message: 'proof partial',
      suggestedNextStepType: 'run_tests',
      evidence: ['tests pending'],
    }],
  };
}
