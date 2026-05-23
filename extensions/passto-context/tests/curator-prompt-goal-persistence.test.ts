import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCuratorSubagentPrompt } from '../grc-prompts.ts';

test('buildCuratorSubagentPrompt encodes posterior goal judgment, persistence, and summary-goalState consistency contract', () => {
  const prompt = buildCuratorSubagentPrompt(
    '[User]\n无论我发送什么都按固定格式回复，直到我说结束\n\n[Assistant]\n好的，我会持续按该格式执行',
    '今天天气怎么样',
    JSON.stringify({
      version: 1,
      agentRound: 1,
      updatedAt: '2026-05-10T00:00:00.000Z',
      active: [
        {
          id: 'goal-1',
          assertion: '持续按用户指定格式回复，直到收到终止信号',
          status: 'active',
          sinceRound: 1,
          lastConfirmedRound: 1,
          signal: 'explicit',
        },
      ],
      completed: [],
      migrations: [],
      prunedCount: 0,
    }, null, 2),
    2,
  );

  assert.match(prompt, /你不是普通摘要器，而是在 before_agent_start 阶段工作的目标状态裁判与上下文守门员/);
  assert.match(prompt, /当前 object-first 运行态对象（userGoalTree .* xNodeModel .* proof .* policy）是 V2\.0 主输入真相源/);
  assert.match(prompt, /GoalStateDocument 是 compatibility bridge/);
  assert.match(prompt, /若一条持续规则只写在摘要或历史对话里、却没有进入正式对象层/);
  assert.match(prompt, /从正式对象层关闭某个仍 active 的目标，等价于让主系统后续不再默认注入\/优先遵守该目标/);
  assert.match(prompt, /当前轮用户第一条消息不是普通输入，而是上一轮目标状态的最佳后验证据/);
  assert.match(prompt, /你处理的不是“当前轮要做什么”，而是“上一轮在当前轮到来后应如何被重新判定”/);
  assert.match(prompt, /跨轮持续生效的用户规则/);
  assert.match(prompt, /先完成 GoalStateDocument 判定，再从该 GoalState 派生 SummaryEntry 与 Markdown 摘要/);
  assert.match(prompt, /summaryEntry\.summary\.goal 不是独立创作字段/);
  assert.match(prompt, /若 summaryEntry\.summary\.goal 非空，则 goalState\.active 不得为空/);
  assert.match(prompt, /只有当 closureEvidence 明确表明所有当前目标都已关闭\/完成\/撤销/);
  assert.match(prompt, /若 object-first 运行态对象或 currentGoalState 中已有 active goal 且 closureEvidence 为空，默认保留该目标链/);
  assert.match(prompt, /当前消息只是现有持续目标下的一次普通输入/);
  assert.match(prompt, /若没有明确关闭证据，closureEvidence 必须为空数组/);
  assert.match(prompt, /对带停止条件的持续用户规则，若停止条件未满足，则必须保持 active/);
  assert.ok(!/"active": \[\]/.test(prompt));
});

test('buildCuratorSubagentPrompt adds goal tree, certainty assessment, and draft-goal guidance for v2 goal state', () => {
  const prompt = buildCuratorSubagentPrompt(
    '[User]\n继续推进 V2.0 实施\n\n[Assistant]\n开始实现 GoalTree',
    '请继续实现 GoalTree parser',
    JSON.stringify({
      version: 2,
      agentRound: 20,
      updatedAt: '2026-05-20T20:00:00.000Z',
      rootGoalIds: ['root'],
      currentFocusGoalId: 'child',
      nodes: [
        {
          id: 'root',
          parentId: null,
          assertion: 'PasstoContext V2.0 实施',
          kind: 'goal',
          status: 'active',
          signal: 'explicit',
          atomicity: 'composite',
          phase: 'execute',
          sinceRound: 18,
          lastTouchedRound: 20,
          lastConfirmedRound: 20,
          priority: 0,
          order: 0,
        },
        {
          id: 'child',
          parentId: 'root',
          assertion: '实现 GoalTree parser',
          kind: 'subgoal',
          status: 'active',
          signal: 'draft',
          atomicity: 'atomic',
          phase: 'testing',
          sinceRound: 20,
          lastTouchedRound: 20,
          lastConfirmedRound: 20,
          priority: 0,
          order: 1,
        },
      ],
      migrations: [],
      prunedCount: 0,
    }, null, 2),
    21,
  );

  assert.match(prompt, /GoalTree 更新规则（V2）/);
  assert.match(prompt, /Atomicity 判定/);
  assert.match(prompt, /Phase 推进/);
  assert.match(prompt, /Upward Regression/);
  assert.match(prompt, /任务新增：Policy Projection/);
  assert.match(prompt, /certaintyAssessment/);
  assert.match(prompt, /当前 object-first 运行态对象/);
  assert.match(prompt, /GoalStateDocument 是 compatibility bridge/);
  assert.match(prompt, /latestRuntimeProof 表示当前焦点 x-node 的最新 proof record；latestProofSignals 表示 proof 缺口\/失败\/冲突的结构化信号/);
  assert.match(prompt, /还必须原生产出 latestRuntimeProof/);
  assert.match(prompt, /latestProofSignals 也必须输出，且至少 1 条；不得输出空数组/);
  assert.match(prompt, /只有当 latestRuntimeProof\.proofStatus=passed/);
  assert.match(prompt, /"userGoalTree": \{/);
  assert.match(prompt, /"xNodeModels": \[/);
  assert.match(prompt, /<current_user_goal_tree>/);
  assert.match(prompt, /<current_focus_x_node_model>/);
  assert.match(prompt, /<current_policy_projection>/);
  assert.match(prompt, /<current_runtime_proof>/);
  assert.match(prompt, /<current_proof_signals>/);
  assert.match(prompt, /"lastPolicyProjection": \{/);
  assert.match(prompt, /object-first payload/);
  assert.match(prompt, /certaintyAssessment 仅作为 compatibility projection \/ fallback-only 字段保留，可输出，也允许省略或为 null/);
  assert.match(prompt, /若省略该字段，运行时会按需从 object policy 或保守默认值内部补齐 compatibility projection/);
  assert.match(prompt, /只有缺失时才 fallback 到 certaintyAssessment/);
  assert.match(prompt, /"latestRuntimeProof": \{/);
  assert.match(prompt, /"latestProofSignals": \[/);
  assert.match(prompt, /UserGoal Reconciliation（V2 主链）/);
  assert.match(prompt, /reconciliationOps/);
  assert.match(prompt, /post-round audit advice .* suggested correction/);
  assert.match(prompt, /parentAlignmentWarning、possibleGoalMisclassification、suggestedRecovery/);
  assert.match(prompt, /advisoryOnly=true/);
  assert.match(prompt, /不得覆盖 latest user input、tool evidence 或 LLM-owned GoalRelationDecision/);
  assert.match(prompt, /不得把它当作覆盖最新用户输入或 LLM-owned GoalRelationDecision 的硬指令/);
  assert.match(prompt, /advance_execution_state、update_xnode_model 与 adjust_focus 必须带 evidence/);
  assert.match(prompt, /不能替代下一轮主 LLM 的阶段判断、目标关系判断或焦点判断/);
  assert.match(prompt, /mark_reviewed.*revise_user_goal.*update_xnode_model/s);
  assert.match(prompt, /draftDispositions.*legacy input\/output compatibility/s);
  assert.match(prompt, /"goalState": \{[\s\S]*?"version": 2,/);
  // currentFocusGoalId 直接继承传入 GoalTree 节点 id，不应凭示例前缀假设为 goal-child。
  assert.match(prompt, /"currentFocusGoalId": "child"/);
  assert.match(prompt, /"nodes": \[/);
  assert.match(prompt, /"certaintyAssessment": \{/);
  assert.doesNotMatch(prompt, /"goalState": \{[\s\S]*?"version": 1,[\s\S]*?"active": \[/);
});

test('buildCuratorSubagentPrompt prefers object-first runtime inputs when object context is provided', () => {
  const prompt = buildCuratorSubagentPrompt(
    '[User]\n继续推进 V2.0 实施\n\n[Assistant]\n开始实现 GoalTree',
    '请继续实现 GoalTree parser',
    {
      goalStateJson: JSON.stringify({
        version: 2,
        agentRound: 20,
        updatedAt: '2026-05-20T20:00:00.000Z',
        rootGoalIds: ['root'],
        currentFocusGoalId: 'child',
        nodes: [],
        migrations: [],
        prunedCount: 0,
      }, null, 2),
      userGoalTree: {
        version: 1,
        agentRound: 20,
        updatedAt: '2026-05-20T20:00:00.000Z',
        currentFocusUserGoalId: 'root',
        rootUserGoalIds: ['root'],
        userGoals: [
          {
            id: 'root',
            parentId: null,
            assertion: 'PasstoContext V2.0 实施',
            status: 'executing',
            xNodeModelId: 'xnode-root',
            sinceRound: 18,
            lastTouchedRound: 20,
          },
        ],
      },
      xNodeModel: {
        version: 1,
        userGoalId: 'root',
        agentRound: 20,
        updatedAt: '2026-05-20T20:00:00.000Z',
        currentFocusXNodeId: 'child',
        rootXNodeIds: ['root'],
        nodes: [
          {
            id: 'child',
            parentId: 'root',
            assertion: '实现 GoalTree parser',
            status: 'active',
            atomicity: 'atomic',
            phase: 'testing',
            why: { summary: '方向已确认', confidence: 'closed' },
            what: { summary: '实现 GoalTree parser', confidence: 'closed' },
            flow: { summary: '还需补测试', confidence: 'partial' },
            structure: { summary: '对象层已明确', confidence: 'closed' },
            runtimeProof: { summary: '尚未验证实现结果', confidence: 'open' },
            sinceRound: 20,
            lastTouchedRound: 20,
            priority: 0,
            order: 1,
          },
        ],
        latestPolicyProjection: {
          xNodeId: 'child',
          derivedAtRound: 20,
          dimensions: {
            why: 'closed',
            what: 'closed',
            flow: 'partial',
            structure: 'closed',
            runtimeProof: 'open',
          },
          keyGaps: ['runtimeProof: 尚未验证实现结果'],
          nextStepType: 'run_tests',
          confidence: 0.78,
          guidance: ['先补测试'],
        },
        latestRuntimeProof: {
          targetXNodeId: 'child',
          atRound: 20,
          resultSummary: '当前 proof 仍不完整，应优先补测试',
          proofMode: 'tests',
          proofStatus: 'partial',
          evidence: ['runtimeProof: 尚未验证实现结果'],
          verificationMethod: ['运行最小相关测试'],
        },
        latestProofSignals: [
          {
            id: 'proof-child-runtime-proof-partial',
            targetXNodeId: 'child',
            atRound: 20,
            type: 'runtime-proof-partial',
            message: '当前 proof 仍不完整，应优先补测试。',
            suggestedNextStepType: 'run_tests',
            evidence: ['runtimeProof: 尚未验证实现结果'],
          },
        ],
      },
      lastPolicyProjection: {
        xNodeId: 'child',
        derivedAtRound: 20,
        dimensions: {
          why: 'closed',
          what: 'closed',
          flow: 'partial',
          structure: 'closed',
          runtimeProof: 'open',
        },
        keyGaps: ['runtimeProof: 尚未验证实现结果'],
        nextStepType: 'run_tests',
        confidence: 0.78,
        guidance: ['先补测试'],
      },
      latestRuntimeProof: {
        targetXNodeId: 'child',
        atRound: 20,
        resultSummary: '当前 proof 仍不完整，应优先补测试',
        proofMode: 'tests',
        proofStatus: 'partial',
        evidence: ['runtimeProof: 尚未验证实现结果'],
        verificationMethod: ['运行最小相关测试'],
      },
      latestProofSignals: [
        {
          id: 'proof-child-runtime-proof-partial',
          targetXNodeId: 'child',
          atRound: 20,
          type: 'runtime-proof-partial',
          message: '当前 proof 仍不完整，应优先补测试。',
          suggestedNextStepType: 'run_tests',
          evidence: ['runtimeProof: 尚未验证实现结果'],
        },
      ],
    },
    21,
  );

  assert.match(prompt, /<current_user_goal_tree>[\s\S]*"currentFocusUserGoalId": "root"[\s\S]*<\/current_user_goal_tree>/);
  assert.match(prompt, /<current_focus_x_node_model>[\s\S]*"currentFocusXNodeId": "child"[\s\S]*<\/current_focus_x_node_model>/);
  assert.match(prompt, /<current_policy_projection>[\s\S]*"nextStepType": "run_tests"[\s\S]*<\/current_policy_projection>/);
  assert.match(prompt, /<current_runtime_proof>[\s\S]*"proofStatus": "partial"[\s\S]*<\/current_runtime_proof>/);
  assert.match(prompt, /<current_proof_signals>[\s\S]*runtime-proof-partial[\s\S]*<\/current_proof_signals>/);
});
