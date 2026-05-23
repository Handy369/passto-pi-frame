import test from 'node:test';
import assert from 'node:assert/strict';

import { buildNextStepPolicyInjection } from '../grc-prompts.ts';
import type { CertaintyAssessment, XNodePolicyProjection } from '../types.ts';

function makeAssessment(nextStepType: CertaintyAssessment['nextStepType']): CertaintyAssessment {
  return {
    dimensions: {
      why: 'closed',
      what: 'closed',
      flow: 'partial',
      structure: 'closed',
      runtimeProof: 'open',
    },
    keyGaps: ['runtimeProof: 仍需补运行态证据'],
    nextStepType,
    confidence: 0.81,
  };
}

test('buildNextStepPolicyInjection renders run_tests as runtime validation policy via certainty fallback when object policy is absent', () => {
  const injection = buildNextStepPolicyInjection(null, makeAssessment('run_tests'));

  assert.match(injection, /当前运行时执行策略/);
  assert.match(injection, /当前 x-node policy projection: run_tests/);
  assert.match(injection, /policy hint nextStepType: run_tests/);
  assert.match(injection, /advisory-only runtime hint/);
  assert.doesNotMatch(injection, /Curator 推荐下一步类型/);
  assert.match(injection, /policy source=certainty-assessment \(compatibility fallback\)/);
  assert.match(injection, /本轮主动作优先视为测试\/验证\/回归/);
  assert.match(injection, /先运行最小相关测试、构建或 runtime proof/);
});

test('buildNextStepPolicyInjection renders plan_repair as target certainty improvement policy', () => {
  const policy: XNodePolicyProjection = {
    xNodeId: 'goal-plan',
    derivedAtRound: 8,
    dimensions: {
      why: 'closed',
      what: 'partial',
      flow: 'partial',
      structure: 'partial',
      runtimeProof: 'partial',
    },
    keyGaps: ['what: 目标实施方案尚未闭合'],
    nextStepType: 'plan_repair',
    confidence: 0.68,
    guidance: [
      '当前优先进入目标确定性提升层，补齐计划/定义/依赖缺口，再继续实现。',
      '循环使用必要的 tools/skills 提高 why/what/flow/structure 确定性，并把结果更新回 xNodeModel。',
    ],
  };

  const injection = buildNextStepPolicyInjection(policy, null);

  assert.match(injection, /policy hint nextStepType: plan_repair/);
  assert.match(injection, /目标确定性提升层/);
  assert.match(injection, /循环使用必要的 tools\/skills/);
  assert.match(injection, /更新回 xNodeModel/);
});

test('buildNextStepPolicyInjection renders generate_children as decomposition policy', () => {
  const injection = buildNextStepPolicyInjection(null, makeAssessment('generate_children'));

  assert.match(injection, /policy hint nextStepType: generate_children/);
  assert.match(injection, /当前焦点更像 composite；先拆出子目标\/检查项/);
  assert.match(injection, /优先推进未完成 child/);
});

test('buildNextStepPolicyInjection renders upward_regression as parent-sibling policy', () => {
  const injection = buildNextStepPolicyInjection(null, makeAssessment('upward_regression'));

  assert.match(injection, /policy hint nextStepType: upward_regression/);
  assert.match(injection, /先把注意力从局部完成项抬升到 parent \/ sibling/);
  assert.match(injection, /不要把 local complete 直接当成 parent complete/);
});

test('buildNextStepPolicyInjection prefers explicit x-node policy projection when present', () => {
  const policy: XNodePolicyProjection = {
    xNodeId: 'goal-focus',
    derivedAtRound: 7,
    dimensions: {
      why: 'closed',
      what: 'closed',
      flow: 'partial',
      structure: 'closed',
      runtimeProof: 'open',
    },
    keyGaps: ['runtimeProof: 仍需补运行态证据'],
    nextStepType: 'run_tests',
    confidence: 0.81,
    guidance: ['本轮主动作优先视为测试/验证/回归，而不是继续扩写实现。'],
  };

  const injection = buildNextStepPolicyInjection(policy, makeAssessment('plan_repair'));
  assert.match(injection, /当前 x-node policy projection: run_tests/);
  assert.match(injection, /policy source=x-node-policy \(primary\)/);
  assert.doesNotMatch(injection, /当前 x-node policy projection: plan_repair/);
  assert.doesNotMatch(injection, /policy source=certainty-assessment \(compatibility fallback\)/);
});

test('buildNextStepPolicyInjection returns empty string when certainty assessment is absent', () => {
  assert.equal(buildNextStepPolicyInjection(null, null), '');
  assert.equal(buildNextStepPolicyInjection(undefined, undefined), '');
});
