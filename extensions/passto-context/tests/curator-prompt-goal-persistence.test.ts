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
  assert.match(prompt, /currentGoalState 是当前目标真相源/);
  assert.match(prompt, /GoalStateDocument 会在后续 before_agent_start 中被注入给主 Agent/);
  assert.match(prompt, /若一条持续规则只写在摘要或历史对话里、却没有进入 GoalState\.active，那么当旧对话被修剪后，这条规则会退出上下文并失效/);
  assert.match(prompt, /从 GoalState\.active 移除某项目，等价于让主系统后续不再默认注入\/优先遵守该目标/);
  assert.match(prompt, /当前轮用户第一条消息不是普通输入，而是上一轮目标状态的最佳后验证据/);
  assert.match(prompt, /你处理的不是“当前轮要做什么”，而是“上一轮在当前轮到来后应如何被重新判定”/);
  assert.match(prompt, /跨轮持续生效的用户规则/);
  assert.match(prompt, /先完成 GoalStateDocument 判定，再从该 GoalState 派生 SummaryEntry 与 Markdown 摘要/);
  assert.match(prompt, /summaryEntry\.summary\.goal 不是独立创作字段/);
  assert.match(prompt, /若 summaryEntry\.summary\.goal 非空，则 goalState\.active 不得为空/);
  assert.match(prompt, /只有当 closureEvidence 明确表明所有当前目标都已关闭\/完成\/撤销/);
  assert.match(prompt, /若 currentGoalState 中已有 active goal 且 closureEvidence 为空，默认保留该目标链/);
  assert.match(prompt, /当前消息只是现有持续目标下的一次普通输入/);
  assert.match(prompt, /若没有明确关闭证据，closureEvidence 必须为空数组/);
  assert.match(prompt, /对带停止条件的持续用户规则，若停止条件未满足，则必须保持 active/);
  assert.ok(!/"active": \[\]/.test(prompt));
});
