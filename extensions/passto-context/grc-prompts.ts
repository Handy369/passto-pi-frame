/**
 * PasstoContext runtime prompts
 * Prompt builders for Generator / Reflector / Curator
 */

import type { GoalStateDocument, ReflectorInput, SummaryEntry } from "./types.ts";
import { buildGoalViewModel } from "./grc-goal-view.ts";

export function buildBaseGRCPrompt(): string {
  return [
    "--- PasstoContext 认知增强 ---",
    "在处理复杂问题时，请自然地:",
    "- 先理清真正的需求（区分表面需求和底层需求）",
    "- 考虑是否有替代方案",
    "- 关注假设是否成立",
    "这不是强制格式，只是思维习惯的提醒。",
  ].join("\n");
}

export function buildReflectionSteerPrompt(): string {
  return [
    "[PasstoContext] 当前对话已进行较多轮交互。",
    "在继续之前，请用 2-3 句话简要回顾:",
    "1. 到目前为止的主要进展",
    "2. 当前方向是否仍然正确",
    "然后继续你的工作。",
  ].join("\n");
}

export function buildReflectorSubagentPrompt(input: ReflectorInput): string {
  const {
    currentRoundConversation,
    currentGoalState = null,
    goalContext = null,
    summaryCacheExcerpt = [],
    recentCuratorArtifacts = [],
    candidatePrinciples = [],
  } = input;

  return [
    "# 角色",
    "你不是泛泛而谈的高级技术顾问，而是在 agent_end 之后工作的上位审计器（Auditor）与原则综合器（Generalizer）。",
    "你的职责是相对当前目标基线审视本轮执行：判断是否对齐、若有偏移则归因，并在有充分证据时输出最小原则操作集。",
    "你的意见将被注入到后续对话中，作为纠偏参考，而不是替代 GoalState 的新真相源。",
    "",
    "# 输入",
    "以下包含：",
    "1. 当前 round 的完整对话记录，包括用户需求、AI 回复、工具调用和执行结果。",
    "2. 当前 GoalStateDocument（可能为空）。",
    "3. 当前焦点目标视图 goalContext（可能为空）。",
    "4. 最近的 summaryCacheExcerpt（可能为空）。",
    "5. 最近的 recentCuratorArtifacts（可能为空）。",
    "6. 与当前 round 最相关的 candidatePrinciples（可能为空）。",
    "",
    "# 核心任务",
    "你必须优先相对 currentGoalState / goalContext 判断当前执行是否仍服务于当前目标链，而不是只基于对话表面做评论。",
    "summaryCacheExcerpt / recentCuratorArtifacts / candidatePrinciples 只是 grounding 辅助，不得替代当前目标基线。",
    "当输出 principleOps 时，必须优先参考 candidatePrinciples，避免脱离现有原则库盲目 create / merge / conflict。",
    "如果发现偏移，必须尽量归因为以下类型之一：",
    "- none",
    "- goal_state_drift",
    "- generator_execution_drift",
    "- curator_misjudgment",
    "- mixed",
    "",
    "# 输出结构",
    "正文必须严格使用以下段落标题：",
    "",
    "## 目标对齐判断",
    "用 1-2 句说明当前执行是否对齐当前目标链；若对齐，也要说明为什么对齐。",
    "",
    "## 偏移归因",
    "列出 0-3 条证据或判断点。",
    "若没有明显偏移，可只写：无明显偏移。",
    "",
    "## 顾问意见",
    "给出 0-3 条具体、可执行的纠偏建议。",
    "每条建议必须：",
    "- 指向具体的代码 / 文件 / 设计决策",
    "- 说明为什么要改",
    "- 说明怎么改",
    "如果没有实质建议，必须只写：无",
    "",
    "## 原则判断",
    "说明本轮经验是否值得沉淀为原则操作。",
    "如果没有，必须只写：无",
    "",
    "## 能力沉淀候选",
    "若没有成熟候选，必须只写：无。",
    "不要在正文中发出自动创建 skill/script/reference 的执行指令。",
    "",
    "## 结构化结果",
    "在正文之后，额外输出一个 JSON 代码块，格式如下：",
    "```json",
    "{",
    "  \"diagnosis\": {",
    "    \"aligned\": true,",
    "    \"driftSource\": \"none\",",
    "    \"confidence\": 0.9,",
    "    \"evidence\": [\"...\"],",
    "    \"explanation\": \"...\"",
    "  },",
    "  \"principleOps\": [",
    "    { \"op\": \"create\", \"content\": \"...\", \"tags\": [\"...\"] },",
    "    { \"op\": \"reuse\", \"targetId\": \"principle_xxx\" },",
    "    { \"op\": \"merge\", \"targetId\": \"principle_xxx\", \"content\": \"...\", \"tags\": [\"...\"] },",
    "    { \"op\": \"conflict\", \"targetId\": \"principle_xxx\", \"content\": \"...\", \"tags\": [\"...\"] }",
    "  ],",
    "  \"assetCandidates\": [",
    "    { \"type\": \"reference\", \"title\": \"...\", \"rationale\": \"...\", \"evidence\": [\"...\"], \"targetPath\": \"references/...\", \"scope\": \"shared\", \"notes\": \"...\" }",
    "  ]",
    "}",
    "```",
    "如果没有值得沉淀或更新的原则或模式候选，则输出 {\"diagnosis\": {...}, \"principleOps\":[], \"assetCandidates\":[]}。",
    "principleOps 必须来自本轮真实执行经验，并与当前目标链相关，而不是空洞常识。",
    "assetCandidates 最多 3 条；每条必须包含 type / title / rationale / evidence，且只表达候选，不得包含自动执行语义。",
    "diagnosis 必须与正文判断一致；若把握不足，可以降低 confidence，但不要编造证据。",
    "",
    "# 约束",
    "- 总输出不超过 600 字",
    "- 不要复述整段对话",
    "- 不要给出用户没有问的额外执行任务",
    "- 不要为了凑结构而编造问题、风险或建议",
    "- 若 currentGoalState / goalContext 为空，可退化为基于对话判断，但不要假装知道不存在的目标基线",
    "- Reflector 不能替代 GoalState，也不能直接做状态裁决",
    "- 宁可明确写\"无\"或降低 confidence，也不要写空洞正确话术",
    "",
    "<current_goal_state>",
    currentGoalState ? JSON.stringify(currentGoalState, null, 2) : "null",
    "</current_goal_state>",
    "",
    "<goal_context>",
    goalContext ? JSON.stringify(goalContext, null, 2) : "null",
    "</goal_context>",
    "",
    "<summary_cache_excerpt>",
    summaryCacheExcerpt.length > 0 ? JSON.stringify(summaryCacheExcerpt, null, 2) : "[]",
    "</summary_cache_excerpt>",
    "",
    "<recent_curator_artifacts>",
    recentCuratorArtifacts.length > 0 ? JSON.stringify(recentCuratorArtifacts, null, 2) : "[]",
    "</recent_curator_artifacts>",
    "",
    "<candidate_principles>",
    candidatePrinciples.length > 0 ? JSON.stringify(candidatePrinciples, null, 2) : "[]",
    "</candidate_principles>",
    "",
    "<conversation>",
    currentRoundConversation,
    "</conversation>",
  ].join("\n");
}

export function buildCuratorSubagentPrompt(
  previousRoundConversation: string,
  currentUserMessage: string,
  currentGoalStateJson = "null",
  currentAgentRound = 0,
): string {
  return [
    "# 角色",
    "你不是普通摘要器，而是在 before_agent_start 阶段工作的目标状态裁判与上下文守门员。你的职责不是机械复述上一轮做了什么，而是利用当前轮用户第一条消息这个后验信号，站在上一轮结束之后重新判断：哪些目标仍然有效、哪些已经完成、哪些只是被补充/纠偏、哪些真的被替代，然后产出可供下一轮主 Agent 继续依赖的 GoalStateDocument 与 SummaryEntry。",
    "",
    "# 输入",
    "以下包含三部分：",
    "1. 上一轮 agent-round 的完整对话记录",
    "2. 当前轮用户第一条消息",
    "3. 当前 GoalStateDocument（可能为空）",
    "",
    "# 为什么这件事重要",
    "- currentGoalState 是当前目标真相源；若其中存在 active 目标，默认它们仍然有效。",
    "- GoalStateDocument 会在后续 before_agent_start 中被注入给主 Agent；其中 active goals 是跨轮保留目标、规则与焦点的主锚点。",
    "- 若一条持续规则只写在摘要或历史对话里、却没有进入 GoalState.active，那么当旧对话被修剪后，这条规则会退出上下文并失效。",
    "- 从 GoalState.active 移除某项目，等价于让主系统后续不再默认注入/优先遵守该目标；因此移除必须有明确 closureEvidence。",
    "- 你的输出会决定下一轮主 Agent 默认看见什么、继续遵守什么、优先服务什么；如果目标识别失真，系统会保留错误焦点，或把仍然有效的目标错误丢失。",
    "",
    "# 后验视角原则",
    "- 当前轮用户第一条消息不是普通输入，而是上一轮目标状态的最佳后验证据。",
    "- 你处理的不是“当前轮要做什么”，而是“上一轮在当前轮到来后应如何被重新判定”。",
    "- 你必须优先回答：当前消息是在继续上一轮目标、补充上一轮目标、纠正上一轮目标、证明上一轮目标已完成，还是明确切换到新目标。",
    "- 当前轮用户消息可能只是对现有目标链的一次实例输入、补充或执行载荷，不应仅因出现新内容就改写顶层目标。",
    "- 对跨轮持续生效的用户规则（格式、角色、步骤、停止条件、输出协议等），若未收到明确终止/完成/撤销信号，必须继续保留为 active goal。",
    "- 你需要优先解释当前消息如何服务于现有 active goal，再考虑它是否构成新目标、迁移或替代。",
    "- 只有在存在明确关闭证据时，才允许把 active goal 标记为 completed / suspended / replaced。",
    "- 若无法给出明确关闭证据，则宁可继续保留旧目标，也不要过早关闭、迁移或重置目标链。",
    "",
    "# 一致性约束",
    "- 先完成 GoalStateDocument 判定，再从该 GoalState 派生 SummaryEntry 与 Markdown 摘要；不要把 summary.goal 和 goalState.active 当成两个彼此独立的产物。",
    "- summaryEntry.summary.goal 不是独立创作字段，它必须是更新后 GoalStateDocument 中当前主焦点目标的文本投影。",
    "- 若 summaryEntry.summary.goal 非空，则 goalState.active 不得为空，且其中至少有一项 active goal 与 summaryEntry.summary.goal 语义一致。",
    "- 只有当 closureEvidence 明确表明所有当前目标都已关闭/完成/撤销，且当前消息也没有开启新的有效目标时，goalState.active 才允许为空。",
    "",
    "# 任务一: 后验目标状态判定",
    "先基于 currentGoalState、上一轮对话与当前轮用户第一条消息，判断上一轮结束后哪些目标在当前轮到来后仍应继续保留，哪些已完成，哪些被补充/纠偏，哪些真的被替代。",
    "更新规则：",
    "- 若 currentGoalState 中已有 active goal 且 closureEvidence 为空，默认保留该目标链；当前消息通常只是其下的一次输入、补充、澄清或推进。",
    "- 新目标：只有在当前消息明确开启了一个独立的新目标时，才加入 active。",
    "- 已完成目标：只有在 closureEvidence 明确成立时，才从 active 移到 completed。",
    "- 方向变化：只有在明确 pivot / replace / switch 证据成立时，才写入 migrations。",
    "- 对带停止条件的持续用户规则，若停止条件未满足，则必须保持 active。",
    "- 若信息不足，则尽量保持现状，不要编造。",
    "",
    "# 任务二: 定性信号分析",
    "判断当前轮用户消息对现有目标链的影响类型，输出一个 signal：advance / correct / supplement / continue / clarify。",
    "注意：若当前消息只是现有持续目标下的一次普通输入，通常应为 continue 或 supplement，而不是把它改写成新的顶层目标。",
    "",
    "# 任务三: 目标关闭证据判断",
    "判断当前 active goal 是否存在明确关闭证据。输出 closureEvidence 字符串数组。",
    "规则：",
    "- 只有用户明确表达结束、完成、停止、撤销、切换到新目标，或当前轮信息对旧目标形成明确替代关系时，closureEvidence 才能非空。",
    "- 若没有明确关闭证据，closureEvidence 必须为空数组。",
    "- 若 closureEvidence 为空，则不得无依据关闭 currentGoalState 中仍 active 的目标。",
    "",
    "# 任务四: 输出 GoalStateDocument",
    "输出更新后的 GoalStateDocument。这是主产物，不是附属字段。下一轮主 Agent 的默认目标锚点将直接依赖它。",
    "",
    "# 任务五: 从 GoalState 派生 SummaryEntry 与结构化摘要",
    "在思考顺序上，必须先完成 GoalState 判定，再从其派生 SummaryEntry 与 Markdown 摘要；最终输出顺序仍然是先 Markdown 摘要，再 JSON 代码块。",
    "生成一份摘要，严格使用以下结构（缺失的部分写\"无\"）：",
    "",
    "## 目标",
    "写当前主目标/焦点目标，而不是随意改写成新的局部任务（1-2句）。",
    "",
    "## 已完成",
    "- 具体完成了什么（列表，每项 1 句）",
    "",
    "## 关键决策",
    "- 决策内容 → 原因（列表）",
    "",
    "## 修改的文件",
    "- 文件路径: 改动说明（列表）",
    "",
    "## 当前状态",
    "工作进展到哪里了（1-2句）",
    "",
    "## 下一步",
    "接下来应该做什么（1-3项）",
    "",
    "## 注意事项",
    "需要警惕的问题（如有）",
    "",
    "# 输出格式",
    "先输出上面的结构化摘要（Markdown），然后在最后额外输出一个 JSON 代码块：",
    "```json",
    "{",
    "  \"signal\": { \"type\": \"advance\", \"confidence\": 0.9, \"evidence\": \"当前用户消息表明旧目标仍在继续推进\" },",
    "  \"closureEvidence\": [],",
    "  \"summaryEntry\": {",
    `    \"agentRound\": ${currentAgentRound},`,
    "    \"summary\": {",
    "      \"goal\": \"持续按用户指定格式回复，直到收到终止信号\",",
    "      \"completed\": [\"已确认当前消息只是旧目标下的一次继续输入\"],",
    "      \"keyDecisions\": [\"继续保留持续格式规则 → 当前消息未提供终止证据\"],",
    "      \"filesChanged\": [{ \"path\": \"grc-prompts.ts\", \"action\": \"edit\" }],",
    "      \"status\": \"旧目标继续有效，当前消息服务于现有目标链。\",",
    "      \"blockers\": []",
    "    },",
    "    \"sessionPointers\": { \"searchQuery\": \"持续格式规则 active goal closureEvidence\" }",
    "  },",
    "  \"goalState\": {",
    "    \"version\": 1,",
    `    \"agentRound\": ${currentAgentRound},`,
    "    \"updatedAt\": \"<ISO_TIMESTAMP>\",",
    "    \"active\": [",
    "      {",
    "        \"id\": \"goal-format-rule\",",
    "        \"assertion\": \"持续按用户指定格式回复，直到收到终止信号\",",
    "        \"status\": \"active\",",
    "        \"sinceRound\": 1,",
    "        \"lastConfirmedRound\": 2,",
    "        \"signal\": \"explicit\"",
    "      }",
    "    ],",
    "    \"completed\": [],",
    "    \"migrations\": [],",
    "    \"prunedCount\": 0",
    "  }",
    "}",
    "```",
    "",
    "# 约束",
    "- 摘要不超过 800 字",
    "- JSON 必须合法",
    "- 不要编造对话中没有的内容",
    "- 文件路径必须是对话中实际出现的",
    "- 除摘要和最后一个 JSON 代码块外，不要输出额外解释",
    "",
    "<current_goal_state>",
    currentGoalStateJson || "null",
    "</current_goal_state>",
    "",
    "<current_user_message>",
    currentUserMessage || "",
    "</current_user_message>",
    "",
    "<previous_round_conversation>",
    previousRoundConversation,
    "</previous_round_conversation>",
  ].join("\n");
}

export function buildSummaryCacheInjection(
  summaryCache: SummaryEntry[],
  maxEntries = 6,
  excludeRecentAgentRounds = 0,
): string {
  const cutoffRound = excludeRecentAgentRounds > 0
    ? Math.max(...summaryCache.map((entry) => entry.agentRound), 0) - excludeRecentAgentRounds
    : Number.POSITIVE_INFINITY;

  const entries = summaryCache
    .filter((entry) => excludeRecentAgentRounds <= 0 || entry.agentRound <= cutoffRound)
    .slice(-Math.max(0, maxEntries));
  if (entries.length === 0) return "";

  const lines: string[] = ["--- 最近对话摘要缓存 ---"];
  for (const entry of entries) {
    lines.push(`Agent Round ${entry.agentRound}`);
    if (entry.summary.goal) lines.push(`- 目标: ${entry.summary.goal}`);
    if (entry.summary.completed.length > 0) lines.push(`- 完成: ${entry.summary.completed.join("；")}`);
    if (entry.summary.status) lines.push(`- 状态: ${entry.summary.status}`);
    if (entry.summary.blockers.length > 0) lines.push(`- 阻塞: ${entry.summary.blockers.join("；")}`);
  }
  lines.push("--- 摘要缓存结束 ---");
  return lines.join("\n");
}

export function buildGoalStateInjection(goalState: GoalStateDocument, maxActiveItems = 5): string {
  const view = buildGoalViewModel(goalState, { maxSiblingActiveGoals: Math.max(0, maxActiveItems - 1) });
  if (!view) return "";

  const lines: string[] = ["--- 当前目标状态 ---"];

  if (view.focusPath.length > 0) {
    lines.push("当前焦点目标:");
    for (const item of view.focusPath) {
      lines.push(`- [${item.status}] ${item.assertion}`);
    }
  } else {
    lines.push("当前焦点目标: 无");
  }

  if (view.siblingActiveGoals.length > 0) {
    lines.push("并行活跃目标:");
    for (const item of view.siblingActiveGoals) {
      lines.push(`- ${item.assertion}`);
    }
  }

  if (view.recentCompletedGoals.length > 0) {
    lines.push("最近完成目标:");
    for (const item of view.recentCompletedGoals) {
      lines.push(`- ${item.assertion}`);
    }
  }

  if (view.recentMigrations.length > 0) {
    lines.push("最近目标迁移:");
    for (const item of view.recentMigrations) {
      lines.push(`- ${item.fromGoalId || "none"} → ${item.toGoalId}（round ${item.atRound}，${item.reason}）`);
    }
  }

  lines.push(`最近更新: round ${view.updatedRound}`);
  lines.push("--- 目标状态结束 ---");
  return lines.join("\n");
}

export function buildReflectorInjection(advice: string): string {
  const trimmed = advice.trim();
  if (!trimmed) return "";

  return [
    "",
    "--- 顾问意见（自动生成，仅供参考）---",
    trimmed,
    "--- 顾问意见结束 ---",
    "",
  ].join("\n");
}

export function buildCuratorSummaryMessage(summary: string): string {
  const trimmed = summary.trim();
  if (!trimmed) return "";

  return [
    "[上下文摘要 - 以下是之前对话的整理结果]",
    "",
    trimmed,
    "",
    "[摘要结束 - 以下是最近的完整对话记录]",
  ].join("\n");
}
