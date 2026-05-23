import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveXNodePolicyProjection } from '../grc-x-node-policy.ts';
import { buildNextStepPolicyInjection } from '../grc-prompts.ts';
import type { CertaintyAssessment, XNodeModelDocument } from '../types.ts';

function makePlanModel(): XNodeModelDocument {
  return {
    version: 1,
    userGoalId: 'goal-plan-certainty',
    agentRound: 22,
    updatedAt: '2026-05-22T00:00:00.000Z',
    currentFocusXNodeId: 'xnode-plan-certainty',
    rootXNodeIds: ['xnode-plan-certainty'],
    nodes: [{
      id: 'xnode-plan-certainty',
      parentId: null,
      assertion: '提升目标确定性以输出实施方案',
      status: 'active',
      atomicity: 'atomic',
      phase: 'plan',
      why: { summary: 'why open', confidence: 'open' },
      what: { summary: 'what partial', confidence: 'partial' },
      flow: { summary: 'flow partial', confidence: 'partial' },
      structure: { summary: 'structure partial', confidence: 'partial' },
      runtimeProof: { summary: 'proof open', confidence: 'open' },
      sinceRound: 22,
      lastTouchedRound: 22,
      priority: 0,
      order: 0,
    }],
  };
}

function makeAssessment(): CertaintyAssessment {
  return {
    dimensions: {
      why: 'open',
      what: 'partial',
      flow: 'partial',
      structure: 'partial',
      runtimeProof: 'open',
    },
    keyGaps: ['why/what/flow/structure/runtimeProof 未闭合'],
    nextStepType: 'plan_repair',
    confidence: 0.42,
  };
}

test('deriveXNodePolicyProjection plan_repair guidance includes direct-answer gate and plan-certainty-improvement', () => {
  const projection = deriveXNodePolicyProjection(makePlanModel());

  assert.equal(projection?.nextStepType, 'plan_repair');
  const text = projection?.guidance.join('\n') ?? '';
  assert.match(text, /direct-answer gate/);
  assert.match(text, /简单高确定性请求/);
  assert.match(text, /不展开递归 xNodeModel/);
  assert.match(text, /plan-certainty-improvement/);
  assert.match(text, /ContextParameterRequest/);
  assert.match(text, /CertaintyAssessment/);
  assert.match(text, /XNodeModelPatch/);
  assert.match(text, /RuntimeProofRecord/);
});

test('deriveXNodePolicyProjection plan_repair guidance supports parallel subagent/provider acquisition without fixed tool enumeration', () => {
  const projection = deriveXNodePolicyProjection(makePlanModel());
  const text = projection?.guidance.join('\n') ?? '';

  assert.match(text, /并行调用 subagent \/ provider/);
  assert.match(text, /参数提供者或方法提供者/);
  assert.doesNotMatch(text, /browser_runtime_observe|ptc_search_summary|passto_planner|agent_reach/);
});

test('buildNextStepPolicyInjection certainty fallback uses the same plan-certainty-improvement guidance', () => {
  const injection = buildNextStepPolicyInjection(null, makeAssessment());

  assert.match(injection, /当前 x-node policy projection: plan_repair/);
  assert.match(injection, /direct-answer gate/);
  assert.match(injection, /简单高确定性请求/);
  assert.match(injection, /不展开递归 xNodeModel/);
  assert.match(injection, /plan-certainty-improvement/);
  assert.match(injection, /ContextParameterRequest/);
  assert.match(injection, /并行调用 subagent \/ provider/);
  assert.match(injection, /RuntimeProofRecord/);
});
