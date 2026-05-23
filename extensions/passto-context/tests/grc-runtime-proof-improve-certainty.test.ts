import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDirectAnswerFastPathProof,
  buildPlanCertaintyRuntimeProof,
  derivePlanCertaintyProofSignals,
} from '../grc-runtime-proof.ts';

test('buildDirectAnswerFastPathProof records why no recursive xNodeModel is needed', () => {
  const record = buildDirectAnswerFastPathProof({
    userInputSummary: '1+1=?',
    reasonNoXNodeNeeded: '简单高确定性计算，不依赖项目上下文、多步决策、状态写入或 runtime proof',
    answerOrActionSummary: '直接回答 2',
    evidence: ['arithmetic fact'],
    atRound: 3,
  });

  assert.equal(record.targetXNodeId, 'direct-answer-fast-path');
  assert.equal(record.atRound, 3);
  assert.equal(record.proofMode, 'self-proof');
  assert.equal(record.proofStatus, 'passed');
  assert.match(record.resultSummary, /Direct answer fast path/);
  assert.match(record.evidence.join('\n'), /1\+1=\?/);
  assert.match(record.evidence.join('\n'), /不依赖项目上下文/);
  assert.match(record.verificationMethod.join('\n'), /未展开递归 xNodeModel/);
});

test('buildPlanCertaintyRuntimeProof records full certainty chain and parallel subagent evidence', () => {
  const record = buildPlanCertaintyRuntimeProof({
    targetXNodeId: 'xnode-plan-certainty',
    atRound: 9,
    uncertainty: 'structure 与 runtimeProof 缺口独立存在',
    parameterRequest: 'ContextParameterRequest for structure/runtimeProof',
    providerUsed: 'context provider + subagent',
    parallelSubagents: [
      { task: '审查代码结构事实', resultSummary: '确认 grc-x-node-policy.ts 为 policy 落点', evidence: ['grc-x-node-policy.ts'] },
      { task: '审查 proof 风险', resultSummary: '确认需要 RuntimeProofRecord 记录 certainty delta', evidence: ['grc-runtime-proof.ts'] },
    ],
    evidenceExtracted: ['policy guidance exists', 'runtime proof builder exists'],
    certaintyDelta: ['structure: partial -> closed', 'runtimeProof: open -> partial'],
    stateWrite: 'patch_xnode succeeded',
    exitDecision: 'continue to implementation plan',
  });

  const evidence = record.evidence.join('\n');
  assert.equal(record.targetXNodeId, 'xnode-plan-certainty');
  assert.equal(record.proofMode, 'mixed');
  assert.equal(record.proofStatus, 'passed');
  assert.match(evidence, /uncertainty: structure 与 runtimeProof 缺口独立存在/);
  assert.match(evidence, /parameterRequest: ContextParameterRequest/);
  assert.match(evidence, /parallelSubagent\[1\]\.task: 审查代码结构事实/);
  assert.match(evidence, /parallelSubagent\[2\]\.resultSummary: 确认需要 RuntimeProofRecord/);
  assert.match(evidence, /certaintyDelta: structure: partial -> closed/);
  assert.match(evidence, /stateWrite: patch_xnode succeeded/);
  assert.match(record.verificationMethod.join('\n'), /并行 subagent \/ provider/);
});

test('buildPlanCertaintyRuntimeProof marks failed state write as partial proof', () => {
  const record = buildPlanCertaintyRuntimeProof({
    targetXNodeId: 'xnode-plan-certainty',
    atRound: 10,
    uncertainty: 'state write uncertain',
    parameterRequest: 'ContextParameterRequest',
    providerUsed: 'provider',
    evidenceExtracted: ['evidence exists'],
    certaintyDelta: ['why: open -> partial'],
    stateWrite: '写入失败，输出 ProposedXNodeModelPatch 待持久化',
    exitDecision: 'blocked until state write succeeds',
  });

  assert.equal(record.proofStatus, 'partial');
  assert.match(record.evidence.join('\n'), /写入失败/);
});

test('derivePlanCertaintyProofSignals emits partial and conflicted signals for unpersisted state write', () => {
  const record = buildPlanCertaintyRuntimeProof({
    targetXNodeId: 'xnode-plan-certainty',
    atRound: 11,
    uncertainty: 'state write failed after certainty delta',
    parameterRequest: 'ContextParameterRequest',
    providerUsed: 'provider',
    evidenceExtracted: ['facet evidence exists'],
    certaintyDelta: ['runtimeProof: open -> partial'],
    stateWrite: '未写入，输出 ProposedXNodeModelPatch 待持久化',
    exitDecision: 'blocked until state write succeeds',
  });

  const signals = derivePlanCertaintyProofSignals(record);
  assert.deepEqual(signals.map((signal) => signal.type), ['runtime-proof-partial', 'runtime-proof-conflicted']);
  assert.ok(signals.every((signal) => signal.targetXNodeId === 'xnode-plan-certainty'));
  assert.ok(signals.every((signal) => signal.suggestedNextStepType === 'run_tests'));
  assert.match(signals.map((signal) => signal.message).join('\n'), /ProposedXNodeModelPatch/);
  assert.deepEqual(signals[0]?.evidence, record.evidence);
});

test('buildPlanCertaintyRuntimeProof supports mixed passed document proof scenario', () => {
  const record = buildPlanCertaintyRuntimeProof({
    targetXNodeId: 'xnode-doc-proof',
    atRound: 12,
    uncertainty: '需要用设计方案和实施计划证明 plan 阶段闭合',
    parameterRequest: '读取 improve-certainty design 和 implementation plan',
    providerUsed: 'local documents',
    evidenceExtracted: ['improve-certainty-design.md', 'improve-certainty-implementation-plan.md'],
    certaintyDelta: ['what: partial -> closed', 'flow: partial -> closed'],
    stateWrite: 'patch_xnode succeeded',
    exitDecision: 'document proof closed, continue implementation',
    documentProof: true,
  });

  assert.equal(record.proofMode, 'mixed');
  assert.equal(record.proofStatus, 'passed');
  assert.match(record.verificationMethod.join('\n'), /文档 proof 场景/);
  assert.deepEqual(derivePlanCertaintyProofSignals(record), []);
});
