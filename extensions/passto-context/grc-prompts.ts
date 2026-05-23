/**
 * PasstoContext runtime prompts
 * Prompt builders for Generator / Reflector / Curator
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ArtifactRef, CertaintyAssessment, ContextMethodProofPackets, GoalStateAny, MethodPacket, ReflectorInput, RuntimeContextHintSurface, RuntimeProofRecord, RuntimeProofSignal, SummaryEntry, UserGoalTreeDocument, XNode, XNodeCommit, XNodeModelDocument, XNodePolicyProjection } from "./types.ts";
import { buildGoalViewModel, buildGoalViewModelFromObjectSidecars } from "./grc-goal-view.ts";
import { projectGeneratorCharterPrompt, readGeneratorContract } from "./grc-generator-contract.ts";

export const REFLECTOR_CONTRACT_PATH = path.resolve(import.meta.dirname, "references/reflector-contract.md");

function readReflectorGuidance(): string {
  try {
    const content = fs.readFileSync(REFLECTOR_CONTRACT_PATH, "utf-8");
    const match = content.match(/^## Principle Generation Guidance\n([\s\S]*?)(?=^## |\Z)/m);
    return match?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

let cachedGeneratorCharterPrompt: string | null = null;

/**
 * @deprecated 已由 buildGeneratorCharterPrompt() 替代；仅保留作历史语义对照，勿再接入新的运行时注入链。
 */
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

export function buildGeneratorCharterPrompt(_options?: { draftGoalEnabled?: boolean }): string {
  if (cachedGeneratorCharterPrompt) return cachedGeneratorCharterPrompt;

  const basePrompt = projectGeneratorCharterPrompt(readGeneratorContract());
  cachedGeneratorCharterPrompt = basePrompt;
  return basePrompt;
}

export function buildReflectionSteerPrompt(): string {
  return [
    "[PasstoContext] 当前这个 agent-round 已经持续了较多 turn。",
    "先暂停一下，做一次极短反思：",
    "1. 你现在的目标是否仍然清晰且未变化？",
    "2. 你刚才是否在重复读取/调用相近工具，出现绕圈迹象？",
    "3. 下一步只做一个最能推进结果的动作，然后继续执行。",
  ].join("\n");
}

export function buildReflectorSubagentPrompt(input: ReflectorInput): string {
  const {
    currentRoundConversation,
    currentGoalState = null,
    goalContext = null,
    summaryCacheExcerpt = [],
    recentCuratorArtifacts = [],
    allPrinciples = [],
  } = input;

  const guidance = readReflectorGuidance();

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
    "6. 当前完整原则库 allPrinciples（可能为空）。",
    "",
    "# 核心任务",
    "你必须优先相对 currentGoalState / goalContext 判断当前执行是否仍服务于当前目标链，而不是只基于对话表面做评论。",
    "summaryCacheExcerpt / recentCuratorArtifacts / allPrinciples 只是 grounding 辅助，不得替代当前目标基线。",
    "当输出 principleOps 时，必须先逐条对照 allPrinciples，判断当前经验是否已经被旧原则覆盖；只有在充分比较后，才能在 hit / expand / create 三个方向中三选一。",
    "若已有原则已能表达当前经验，则输出 hit；若命中旧原则但需要更完整表达，则输出 expand；只有现有原则库确实无法覆盖时，才允许输出 create。",
    "禁止在未充分排除旧原则前盲目 create；否则原则会持续发散增长，最终让命中机制失效。",
    "在输出 principleOps 前，必须先判断经验作用域：global / domain / local。只有 global 经验才允许进入 principles；domain 经验如有复用价值，优先输出 assetCandidates(reference/script)；local 经验只能留在 advice，不得产出 principleOps。",
    "global 的判定标准必须同时满足：① 不依赖特定产品/仓库/工作台语境；② 不依赖特定框架、组件、目录、API、协议名、事件名或对象名；③ 换到别的任务/代码库后仍成立；④ 表达的是长期可复用的决策约束，而不是单次实现教训。任一条件不满足，就不要输出 principleOps。",
    "凡是明显依赖特定框架、组件、工作台、benchmark harness、目录路径、宿主环境、场景对象名、特定 API/事件名的经验，默认先判为 domain 或 local，而不是 global。若某观察必须借助这些专有名词才能成立，也不得进入 principles。",
    "一条原则只能表达一个主断言。expand 只适用于补充旧原则的适用边界、触发条件或更清晰表述；若新观察引入第二个独立约束、另一个子系统实现要求，或需要用“新增/补充”追加不同主题，则不得 expand 到原原则尾部。",
    "atomic 的判定标准是：去掉任何从句后，原则仍只回答一个问题；若一句话里同时在规定两个以上动作、两个以上判断标准、或两个不共享因果链的约束，则它不是 atomic。遇到这种情况，应改为 hit 旧原则、输出 assetCandidates，或直接不产出 principleOps。",
    "默认从严：若你不能同时证明 global + atomic，就输出空的 principleOps。宁可漏提，也不要把局部经验抬升为全局原则。",
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
    "不要在正文中发出自动创建 script/reference 的执行指令，也不要提出新增 skill 的建议。",
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
    "    { \"op\": \"hit\", \"targetId\": \"principle_xxx\" },",
    "    { \"op\": \"expand\", \"targetId\": \"principle_xxx\", \"content\": \"...\", \"tags\": [\"...\"] },",
    "    { \"op\": \"create\", \"content\": \"...\", \"tags\": [\"...\"] }",
    "  ],",
    "  \"assetCandidates\": [",
    "    { \"type\": \"reference\", \"title\": \"...\", \"rationale\": \"...\", \"evidence\": [\"...\"], \"targetPath\": \"references/...\", \"scope\": \"shared\", \"notes\": \"...\" }",
    "  ]",
    "}",
    "```",
    "如果没有值得沉淀或更新的原则或模式候选，则输出 {\"diagnosis\": {...}, \"principleOps\":[], \"assetCandidates\":[]}。",
    "principleOps 必须来自本轮真实执行经验，并与当前目标链相关，而不是空洞常识。",
    "principleOps 仅允许 hit / expand / create 三种操作；优先 hit，其次 expand，最后才是 create。",
    "principleOps 默认应为空；只有在证据足以支持 global + atomic 时才填写。单轮局部 bugfix、单个文件教训、单次试验结论，默认不足以 create/expand。",
    "若经验带有明显领域依赖但又具复用价值，应输出到 assetCandidates，而不是 principleOps。",
    "expand 的 content 必须是重写后的完整原则文本，而不是在旧原则后补“新增/补充/延伸”。create 的 content 不得包含具体文件路径、目录名、接口名、组件名、工作台名、benchmark 名、产品名或场景专名。",
    "assetCandidates 最多 3 条；type 仅允许 reference / script。每条必须包含 type / title / rationale / evidence，且只表达候选，不得包含自动执行语义。",
    "diagnosis 必须与正文判断一致；若把握不足，可以降低 confidence，但不要编造证据。",
    "",
    ...(guidance ? [
      "# 原则生成方法论",
      "以下是根据历史原则治理经验提炼的方法论，在输出 principleOps 时请优先参考：",
      guidance,
      "",
    ] : []),
    "# 约束",
    "- 总输出不超过 600 字",
    "- 不要复述整段对话",
    "- 不要给出用户没有问的额外执行任务",
    "- 不要为了凑结构而编造问题、风险或建议",
    "- 若 currentGoalState / goalContext 为空，可退化为基于对话判断，但不要假装知道不存在的目标基线",
    "- Reflector 不能替代 GoalState，也不能直接做状态裁决",
    "- 以下通常不是 global principle：单个文件/单次 bugfix 的实现教训、特定 benchmark 规则、特定工作台 API 语义、特定组件交互细节、特定目录部署步骤、特定编码链路或 dev-server middleware 细节",
    "- 若某条候选原则含有专有名词、路径、接口名、事件名、框架名、组件名、产品名，先假定它不是 global，除非你能明确论证这些词只是例子而非成立前提",
    "- 若某条候选原则里出现“以及/同时/并且/新增/补充/延伸”等连接多个独立约束的迹象，先假定它不是 atomic",
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
    "<all_principles>",
    allPrinciples.length > 0 ? JSON.stringify(allPrinciples, null, 2) : "[]",
    "</all_principles>",
    "",
    "<conversation>",
    currentRoundConversation,
    "</conversation>",
  ].join("\n");
}

function buildGoalTreeCuratorInstructions(_enableDraftGoal: boolean): string[] {
  return [
    '',
    '# GoalTree 更新规则（V2）',
    '当前 GoalState 是 version: 2 的归一化目标树。每个节点具有 parentId、atomicity、phase。',
    '',
    '## Atomicity 判定',
    '- 产出物单一、不需子目标、proof 面可直接验证 → atomic',
    '- 产出物为 mixed bundle、需要子目标拆解 → composite',
    '- 首次创建默认 undecided，在后续轮次中基于证据确定',
    '- atomicity 一旦确定原则上不可逆（除非有显式修正证据）',
    '',
    '## Phase 推进',
    '- 允许转换：plan → execute → testing → pending_acceptance → complete',
    '- 允许回退：testing → execute（验证失败需修复）、plan → plan_insufficient（发现缺口）',
    '- 不得因 narrative 包装跳过中间 phase',
    '',
    '## Upward Regression',
    '- 当 atomic 节点 complete 时，检查 parent 的所有必要 sibling 是否已完成',
    '- 所有 sibling complete → parent 可推进',
    '- 否则 → 激活下一个未完成 sibling',
    '- 不得把 local complete 等同于 parent complete',
    '',
    '# 任务新增：Policy Projection',
    '在完成 GoalTree 更新后，对当前焦点节点做五维状态投影，并收口为 policy projection。',
    '当输出 GoalTree(version:2) 时，JSON 代码块还必须原生产出 `userGoalTree`、`xNodeModels`、`lastPolicyProjection`，它们是当前阶段的 object-first payload。',
    '- why：当前焦点目标存在的理由是否清楚？与父目标的关系是否明确？',
    '- what：成果物与完成定义是否收敛？',
    '- flow：达成路径是否清楚？',
    '- structure：依赖的 truth source、对象、层级是否明确？',
    '- runtimeProof：当前判断是否被实际证据支撑？',
    '当输出 GoalTree(version:2) 时，JSON 代码块还必须原生产出 latestRuntimeProof。',
    'latestRuntimeProof 表示当前焦点 x-node 的最新 proof record；latestProofSignals 表示 proof 缺口/失败/冲突的结构化信号。',
    '当 latestRuntimeProof.proofStatus 不是 passed，或 runtimeProof 维度不是 closed，或存在 proof/evidence 缺口时，latestProofSignals 也必须输出，且至少 1 条；不得输出空数组。',
    '只有当 latestRuntimeProof.proofStatus=passed 且当前没有 proof 缺口/失败/冲突时，latestProofSignals 才允许为空数组。',
    '当输出 GoalTree(version:2) 时，`lastPolicyProjection` / object policy 是主策略对象；JSON 代码块中的 certaintyAssessment 仅作为 compatibility projection / fallback-only 字段保留，可输出，也允许省略或为 null。',
    '若已输出 certaintyAssessment，仍应保持其与 `lastPolicyProjection` 语义一致；若省略该字段，运行时会按需从 object policy 或保守默认值内部补齐 compatibility projection。运行时主消费始终应优先依赖 `lastPolicyProjection`，只有缺失时才 fallback 到 certaintyAssessment。',
    '若缺少更强证据，nextStepType 默认优先使用 plan_repair 或 run_tests，而不是留空。',
    '可使用以下最小兜底形状：{"dimensions":{"why":"open","what":"open","flow":"open","structure":"open","runtimeProof":"open"},"keyGaps":["缺少足够证据"],"nextStepType":"plan_repair","confidence":0.3}',
    '',
    '# UserGoal Reconciliation（V2 主链）',
    'Curator 不再只“确认 draft”，而是异步复核任何 userGoal / xNodeModel 状态。',
    '当发现 userGoalTree 或 xNodeModels 需要修正时，在 JSON 代码块中输出 `reconciliationOps`。',
    '`reconciliationOps` 是 post-round audit advice / suggested correction，运行时不得把它当作覆盖最新用户输入或 LLM-owned GoalRelationDecision 的硬指令。',
    '当发现父目标对齐风险、目标误判风险或恢复建议时，在 JSON 代码块中输出 `auditAdvice`：包含 parentAlignmentWarning、possibleGoalMisclassification、suggestedRecovery，并必须声明 advisoryOnly=true。',
    '`auditAdvice` 是 advisory-only post-round audit advice，不得覆盖 latest user input、tool evidence 或 LLM-owned GoalRelationDecision。',
    '`reconciliationOps` 可用于 mark_reviewed / revise_user_goal / supersede_user_goal / discard_user_goal / merge_user_goals / split_user_goal / advance_execution_state / update_xnode_model / adjust_focus。',
    'advance_execution_state、update_xnode_model 与 adjust_focus 必须带 evidence；它们只能表达 Curator 建议的状态修正，不能替代下一轮主 LLM 的阶段判断、目标关系判断或焦点判断。',
    'reviewState 表达复核阶段：Generator 投影为 generator_projected；Curator 复核后应通过 reconciliationOps 将相关 userGoal 标记为 curator_reviewed；用户明确确认才是 user_confirmed。',
    '`draftDispositions` 仅为 legacy input/output compatibility；除非必须兼容旧 artifact，不要新增 draft-only 语义。',
    '',
  ];
}

export interface CuratorPromptObjectContext {
  goalStateJson?: string;
  userGoalTree?: UserGoalTreeDocument | null;
  xNodeModel?: XNodeModelDocument | null;
  lastPolicyProjection?: XNodePolicyProjection | null;
  latestRuntimeProof?: RuntimeProofRecord | null;
  latestProofSignals?: RuntimeProofSignal[] | null;
}

export function buildCuratorSubagentPrompt(
  previousRoundConversation: string,
  currentUserMessage: string,
  currentGoalStateJsonOrContext: string | CuratorPromptObjectContext = "null",
  currentAgentRound = 0,
): string {
  const promptContext = typeof currentGoalStateJsonOrContext === "string"
    ? { goalStateJson: currentGoalStateJsonOrContext }
    : (currentGoalStateJsonOrContext ?? {});
  const currentGoalStateJson = promptContext.goalStateJson ?? "null";
  const currentUserGoalTreeJson = promptContext.userGoalTree ? JSON.stringify(promptContext.userGoalTree, null, 2) : "null";
  const currentXNodeModelJson = promptContext.xNodeModel ? JSON.stringify(promptContext.xNodeModel, null, 2) : "null";
  const currentPolicyProjectionJson = promptContext.lastPolicyProjection ? JSON.stringify(promptContext.lastPolicyProjection, null, 2) : "null";
  const currentRuntimeProofJson = promptContext.latestRuntimeProof ? JSON.stringify(promptContext.latestRuntimeProof, null, 2) : "null";
  const currentProofSignalsJson = promptContext.latestProofSignals ? JSON.stringify(promptContext.latestProofSignals, null, 2) : "[]";
  const isGoalTreeV2 = currentGoalStateJson.includes('"version": 2');
  const enableDraftGoal = isGoalTreeV2 && currentGoalStateJson.includes('"signal": "draft"');
  const goalStateExampleLines = isGoalTreeV2
    ? [
        '  "userGoalTree": {',
        '    "version": 1,',
        `    "agentRound": ${currentAgentRound},`,
        '    "updatedAt": "<ISO_TIMESTAMP>",',
        '    "currentFocusUserGoalId": "goal-root",',
        '    "rootUserGoalIds": ["goal-root"],',
        '    "userGoals": [',
        '      {',
        '        "id": "goal-root",',
        '        "parentId": null,',
        '        "assertion": "解释为何优先补 fresh real session proof",',
        '        "status": "executing",',
        '        "xNodeModelId": "xnode-goal-root",',
        `        "sinceRound": ${Math.max(currentAgentRound, 1)},`,
        `        "lastTouchedRound": ${Math.max(currentAgentRound, 1)}`,
        '      }',
        '    ]',
        '  },',
        '  "xNodeModels": [',
        '    {',
        '      "version": 1,',
        '      "userGoalId": "goal-root",',
        `      "agentRound": ${currentAgentRound},`,
        '      "updatedAt": "<ISO_TIMESTAMP>",',
        '      "currentFocusXNodeId": "goal-root",',
        '      "rootXNodeIds": ["goal-root"],',
        '      "nodes": [',
        '        {',
        '          "id": "goal-root",',
        '          "parentId": null,',
        '          "assertion": "解释为何优先补 fresh real session proof",',
        '          "status": "active",',
        '          "atomicity": "atomic",',
        '          "phase": "execute",',
        '          "why": { "summary": "当前工作仍服务于补 fresh real session proof", "confidence": "closed" },',
        '          "what": { "summary": "当前目标是补最小验证证据", "confidence": "closed" },',
        '          "flow": { "summary": "仍需先补验证再继续扩写", "confidence": "partial" },',
        '          "structure": { "summary": "当前 truth source 与对象边界已明确", "confidence": "closed" },',
        '          "runtimeProof": { "summary": "fresh real session proof 仍未补齐", "confidence": "open" },',
        `          "sinceRound": ${Math.max(currentAgentRound, 1)},`,
        `          "lastTouchedRound": ${Math.max(currentAgentRound, 1)},`,
        '          "priority": 0,',
        '          "order": 0',
        '        }',
        '      ],',
        '      "latestPolicyProjection": {',
        '        "xNodeId": "goal-root",',
        `        "derivedAtRound": ${currentAgentRound},`,
        '        "dimensions": {',
        '          "why": "closed",',
        '          "what": "closed",',
        '          "flow": "partial",',
        '          "structure": "closed",',
        '          "runtimeProof": "open"',
        '        },',
        '        "keyGaps": ["缺少 fresh real session proof"],',
        '        "nextStepType": "run_tests",',
        '        "confidence": 0.78,',
        '        "guidance": ["本轮主动作优先视为测试/验证/回归，而不是继续扩写实现。"]',
        '      }',
        '    }',
        '  ],',
        '  "lastPolicyProjection": {',
        '    "xNodeId": "goal-root",',
        `    "derivedAtRound": ${currentAgentRound},`,
        '    "dimensions": {',
        '      "why": "closed",',
        '      "what": "closed",',
        '      "flow": "partial",',
        '      "structure": "closed",',
        '      "runtimeProof": "open"',
        '    },',
        '    "keyGaps": ["缺少 fresh real session proof"],',
        '    "nextStepType": "run_tests",',
        '    "confidence": 0.78,',
        '    "guidance": ["本轮主动作优先视为测试/验证/回归，而不是继续扩写实现。"]',
        '  },',
        '  "certaintyAssessment": { // optional compatibility projection; may be omitted or null',
        '    "dimensions": {',
        '      "why": "closed",',
        '      "what": "closed",',
        '      "flow": "partial",',
        '      "structure": "closed",',
        '      "runtimeProof": "open"',
        '    },',
        '    "keyGaps": ["缺少 fresh real session proof"],',
        '    "nextStepType": "run_tests",',
        '    "confidence": 0.78',
        '  },',
        '  "latestRuntimeProof": {',
        '    "targetXNodeId": "goal-root",',
        `    "atRound": ${currentAgentRound},`,
        '    "resultSummary": "fresh real session proof 仍未补齐，当前应优先补最小验证证据",',
        '    "proofMode": "tests",',
        '    "proofStatus": "partial",',
        '    "evidence": ["缺少 fresh real session proof"],',
        '    "verificationMethod": ["运行最小相关测试或 runtime proof"]',
        '  },',
        '  "latestProofSignals": [',
        '    {',
        '      "id": "proof-goal-root-runtime-proof-partial",',
        '      "targetXNodeId": "goal-root",',
        `      "atRound": ${currentAgentRound},`,
        '      "type": "runtime-proof-partial",',
        '      "message": "当前 proof 仍不完整，应优先补最小验证证据。",',
        '      "suggestedNextStepType": "run_tests",',
        '      "evidence": ["缺少 fresh real session proof"]',
        '    }',
        '  ],',
        '  "reconciliationOps": [',
        '    {',
        '      "action": "mark_reviewed",',
        '      "targetUserGoalId": "goal-root"',
        '    }',
        '  ],',
        '  "goalState": {',
        '    "version": 2,',
        `    "agentRound": ${currentAgentRound},`,
        '    "updatedAt": "<ISO_TIMESTAMP>",',
        '    "rootGoalIds": ["goal-root"],',
        '    "currentFocusGoalId": "goal-root",',
        '    "nodes": [',
        '      {',
        '        "id": "goal-root",',
        '        "parentId": null,',
        '        "assertion": "解释为何优先补 fresh real session proof",',
        '        "kind": "goal",',
        '        "status": "active",',
        `        "signal": "${enableDraftGoal ? 'draft' : 'explicit'}",`,
        '        "atomicity": "atomic",',
        '        "phase": "execute",',
        `        "sinceRound": ${Math.max(currentAgentRound, 1)},`,
        `        "lastTouchedRound": ${Math.max(currentAgentRound, 1)},`,
        `        "lastConfirmedRound": ${Math.max(currentAgentRound, 1)},`,
        '        "priority": 0,',
        '        "order": 0',
        '      }',
        '    ],',
        '    "migrations": [],',
        '    "prunedCount": 0',
        '  }',
      ]
    : [
        '  "goalState": {',
        '    "version": 1,',
        `    "agentRound": ${currentAgentRound},`,
        '    "updatedAt": "<ISO_TIMESTAMP>",',
        '    "active": [',
        '      {',
        '        "id": "goal-format-rule",',
        '        "assertion": "持续按用户指定格式回复，直到收到终止信号",',
        '        "status": "active",',
        '        "sinceRound": 1,',
        '        "lastConfirmedRound": 2,',
        '        "signal": "explicit"',
        '      }',
        '    ],',
        '    "completed": [],',
        '    "migrations": [],',
        '    "prunedCount": 0',
        '  }',
      ];

  return [
    "# 角色",
    "你不是普通摘要器，而是在 before_agent_start 阶段工作的目标状态裁判与上下文守门员。你的职责不是机械复述上一轮做了什么，而是利用当前轮用户第一条消息这个后验信号，站在上一轮结束之后重新判断：哪些目标仍然有效、哪些已经完成、哪些只是被补充/纠偏、哪些真的被替代，然后产出可供下一轮主 Agent 继续依赖的 GoalStateDocument 与 SummaryEntry。",
    "",
    "# 输入",
    "以下包含四部分：",
    "1. 上一轮 agent-round 的完整对话记录",
    "2. 当前轮用户第一条消息",
    "3. 当前 object-first 运行态对象：userGoalTree / currentFocusXNodeModel / lastPolicyProjection / latestRuntimeProof / latestProofSignals（可能为空）",
    "4. 当前 GoalStateDocument compatibility bridge（可能为空）",
    "",
    "# 为什么这件事重要",
    "- 当前 object-first 运行态对象（userGoalTree / xNodeModel / proof / policy）是 V2.0 主输入真相源；若对象层已提供焦点与 proof，应优先基于对象层做后验判断。",
    "- GoalStateDocument 是 compatibility bridge / 文本投影层；当对象层与 GoalState 同时存在时，优先保证对象层语义稳定，再回写 GoalState 投影。",
    "- 若一条持续规则只写在摘要或历史对话里、却没有进入正式对象层（至少进入 userGoalTree / xNodeModel / GoalState bridge 之一），那么当旧对话被修剪后，这条规则会退出上下文并失效。",
    "- 从正式对象层关闭某个仍 active 的目标，等价于让主系统后续不再默认注入/优先遵守该目标；因此移除必须有明确 closureEvidence。",
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
    "先基于 object-first 运行态对象、GoalState compatibility bridge、上一轮对话与当前轮用户第一条消息，判断上一轮结束后哪些目标在当前轮到来后仍应继续保留，哪些已完成，哪些被补充/纠偏，哪些真的被替代。",
    "更新规则：",
    "- 若 object-first 运行态对象或 currentGoalState 中已有 active goal 且 closureEvidence 为空，默认保留该目标链；当前消息通常只是其下的一次输入、补充、澄清或推进。",
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
    "- 若 closureEvidence 为空，则不得无依据关闭 object-first 运行态对象或 currentGoalState 中仍 active 的目标。",
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
    ...goalStateExampleLines,
    "}",
    "```",
    "",
    "# 约束",
    "- 摘要不超过 800 字",
    "- JSON 必须合法，且最后的 ```json 代码块必须完整闭合",
    "- 若内容接近长度上限，优先压缩 Markdown 摘要与 nextSteps，不要输出截断的 JSON",
    "- goalState 必须最小化：只保留当前仍需注入的 active/completed/migration 事实，不要为了示例感补造多余 nodes",
    "- 当证据只支持一个当前焦点目标时，输出单节点 GoalTree 即可",
    "- 不要编造对话中没有的内容",
    "- 文件路径必须是对话中实际出现的",
    "- 除摘要和最后一个 JSON 代码块外，不要输出额外解释",
    ...(isGoalTreeV2 ? buildGoalTreeCuratorInstructions(enableDraftGoal) : []),
    "",
    "<current_user_goal_tree>",
    currentUserGoalTreeJson,
    "</current_user_goal_tree>",
    "",
    "<current_focus_x_node_model>",
    currentXNodeModelJson,
    "</current_focus_x_node_model>",
    "",
    "<current_policy_projection>",
    currentPolicyProjectionJson,
    "</current_policy_projection>",
    "",
    "<current_runtime_proof>",
    currentRuntimeProofJson,
    "</current_runtime_proof>",
    "",
    "<current_proof_signals>",
    currentProofSignalsJson,
    "</current_proof_signals>",
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

export function buildSessionSummarySearchGuidance(hasWarehouseEntries: boolean): string {
  if (!hasWarehouseEntries) return "";

  return [
    "--- 当前会话历史摘要检索 ---",
    "- SummaryCache 只包含近期窗口。",
    "- 如果需要回忆已被压缩出上下文的当前会话历史，可调用工具 `ptc_search_summary` 搜索当前 session 及 parentSession lineage 的 Summary 仓库。",
    "- 该检索默认优先覆盖 rotate 后的新 session 与其父链中的历史 curator 摘要。",
    "- 查询词优先使用：目标、文件路径、关键决策、报错词、blocker。",
    "--- 历史摘要检索结束 ---",
  ].join("\n");
}

export function buildGoalStateInjection(
  goalState: GoalStateAny,
  maxActiveItems = 5,
  certaintyAssessment?: CertaintyAssessment | null,
  policyProjection?: XNodePolicyProjection | null,
): string {
  const view = buildGoalViewModel(goalState, { maxSiblingActiveGoals: Math.max(0, maxActiveItems - 1) });
  return buildGoalStateInjectionFromView(view, certaintyAssessment, policyProjection);
}

export function buildGoalStateInjectionFromObjectSidecars(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
  maxActiveItems = 5,
  certaintyAssessment?: CertaintyAssessment | null,
  policyProjection?: XNodePolicyProjection | null,
  draftNodeIds?: Iterable<string> | null,
): string {
  const view = buildGoalViewModelFromObjectSidecars(userGoalTree, xNodeModels, {
    maxSiblingActiveGoals: Math.max(0, maxActiveItems - 1),
  });
  return buildGoalStateInjectionFromView(view, certaintyAssessment, policyProjection, draftNodeIds);
}

function buildGoalStateInjectionFromView(
  view: ReturnType<typeof buildGoalViewModel> | ReturnType<typeof buildGoalViewModelFromObjectSidecars>,
  certaintyAssessment?: CertaintyAssessment | null,
  policyProjection?: XNodePolicyProjection | null,
  draftNodeIds?: Iterable<string> | null,
): string {
  if (!view) return "";

  const lines: string[] = ["--- 当前目标状态 ---"];
  const draftNodeIdSet = draftNodeIds ? new Set(draftNodeIds) : null;
  const effectiveSignal = (id: string, signal?: "explicit" | "inferred" | "draft") => draftNodeIdSet?.has(id) ? "draft" : signal;
  const renderSignal = (signal?: "explicit" | "inferred" | "draft") => signal ? `[${signal}]` : "";

  if (view.focusPath.length > 0) {
    lines.push("当前焦点目标:");
    for (const item of view.focusPath) {
      const extra = item.atomicity || item.phase ? `[${item.atomicity ?? "undecided"}][${item.phase ?? "plan"}]` : "";
      lines.push(`- [${item.status}]${renderSignal(effectiveSignal(item.id, item.signal))}${extra ? extra : ""} ${item.assertion}`.trim());
    }
  } else {
    lines.push("当前焦点目标: 无");
  }

  if (view.siblingActiveGoals.length > 0) {
    lines.push("并行活跃目标:");
    for (const item of view.siblingActiveGoals) {
      lines.push(`- ${renderSignal(effectiveSignal(item.id, item.signal))}${item.phase ? `[${item.phase}]` : ""} ${item.assertion}`.trim());
    }
  }

  if (view.focusChildren.length > 0) {
    lines.push("焦点子目标:");
    for (const item of view.focusChildren) {
      lines.push(`- [${item.status}]${renderSignal(effectiveSignal(item.id, item.signal))}${item.phase ? `[${item.phase}]` : ""} ${item.assertion}`);
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

  const effectivePolicy = policyProjection ?? (certaintyAssessment ? projectPolicyFromCertaintyAssessment(certaintyAssessment) : null);
  if (effectivePolicy) {
    lines.push("当前 policy projection:");
    lines.push(
      `- why=${effectivePolicy.dimensions.why} what=${effectivePolicy.dimensions.what} flow=${effectivePolicy.dimensions.flow} structure=${effectivePolicy.dimensions.structure} runtimeProof=${effectivePolicy.dimensions.runtimeProof}`,
    );
    if (effectivePolicy.keyGaps.length > 0) {
      lines.push(`- 关键缺口: ${effectivePolicy.keyGaps.join("；")}`);
    }
    lines.push(`- 推荐下一步: ${effectivePolicy.nextStepType}`);
    if (policyProjection) {
      lines.push("- 来源: object policy projection（primary）");
    } else if (certaintyAssessment) {
      lines.push("- 来源: compatibility fallback from certaintyAssessment");
    }
  }

  lines.push(`最近更新: round ${view.updatedRound}`);
  lines.push("--- 目标状态结束 ---");
  return lines.join("\n");
}

export function buildUserGoalTreeInjection(
  userGoalTree: UserGoalTreeDocument,
  maxRootGoals = 5,
): string {
  if (userGoalTree.userGoals.length === 0) return "";

  const focusGoal = userGoalTree.currentFocusUserGoalId
    ? userGoalTree.userGoals.find((goal) => goal.id === userGoalTree.currentFocusUserGoalId) ?? null
    : null;
  const rootGoals = userGoalTree.userGoals
    .filter((goal) => goal.parentId === null)
    .slice(0, Math.max(0, maxRootGoals));
  const completedCount = userGoalTree.userGoals.filter((goal) => goal.status === "completed").length;

  const lines: string[] = ["--- 当前用户目标树 ---"];
  if (focusGoal) {
    lines.push("当前用户目标:");
    lines.push(`- [${focusGoal.status}] ${focusGoal.assertion}`);
  } else {
    lines.push(`当前用户目标: ${userGoalTree.completion?.treeComplete ? "用户目标树已完成" : "无"}`);
  }

  if (rootGoals.length > 0) {
    lines.push("根用户目标:");
    for (const goal of rootGoals) {
      lines.push(`- [${goal.status}] ${goal.assertion}`);
    }
  }

  lines.push(`- 对象统计: total=${userGoalTree.userGoals.length}, completed=${completedCount}, updatedRound=${userGoalTree.agentRound}`);
  if (userGoalTree.completion) {
    lines.push(`- completion: treeComplete=${userGoalTree.completion.treeComplete}, nextFocusUserGoalId=${userGoalTree.completion.nextFocusUserGoalId ?? "none"}`);
  }
  lines.push("--- 用户目标树结束 ---");
  return lines.join("\n");
}

export function buildXNodeModelInjection(xNodeModel: XNodeModelDocument | null): string {
  if (!xNodeModel || xNodeModel.nodes.length === 0) return "";

  const nodeById = new Map(xNodeModel.nodes.map((node) => [node.id, node]));
  const focusNode = xNodeModel.currentFocusXNodeId
    ? nodeById.get(xNodeModel.currentFocusXNodeId) ?? null
    : null;
  const fallbackNode = focusNode ?? xNodeModel.nodes[0] ?? null;
  if (!fallbackNode) return "";

  const focusPath = buildXNodeFocusPath(fallbackNode, nodeById);
  const lines: string[] = ["--- 当前 XNode 执行模型 ---", `- 绑定用户目标: ${xNodeModel.userGoalId}`];

  lines.push("当前 XNode 焦点路径:");
  for (const node of focusPath) {
    lines.push(`- [${node.status}][${node.atomicity}][${node.phase}] ${node.assertion}`);
  }

  lines.push("焦点五维摘要:");
  lines.push(`- why[${fallbackNode.why.confidence}]: ${fallbackNode.why.summary}`);
  lines.push(`- what[${fallbackNode.what.confidence}]: ${fallbackNode.what.summary}`);
  lines.push(`- flow[${fallbackNode.flow.confidence}]: ${fallbackNode.flow.summary}`);
  lines.push(`- structure[${fallbackNode.structure.confidence}]: ${fallbackNode.structure.summary}`);
  lines.push(`- runtimeProof[${fallbackNode.runtimeProof.confidence}]: ${fallbackNode.runtimeProof.summary}`);
  if (xNodeModel.latestRuntimeProof) {
    lines.push(`- 最新 proof: status=${xNodeModel.latestRuntimeProof.proofStatus}, mode=${xNodeModel.latestRuntimeProof.proofMode}`);
    if (xNodeModel.latestRuntimeProof.evidence.length > 0) {
      lines.push(`- proof evidence: ${xNodeModel.latestRuntimeProof.evidence.join("；")}`);
    }
  }
  if (xNodeModel.latestProofSignals && xNodeModel.latestProofSignals.length > 0) {
    const latestSignal = xNodeModel.latestProofSignals[0]!;
    lines.push(`- proof signal: ${latestSignal.type} — ${latestSignal.message}`);
  }
  if (xNodeModel.latestPolicyProjection) {
    lines.push(`- 当前 policy: ${xNodeModel.latestPolicyProjection.nextStepType} (confidence=${xNodeModel.latestPolicyProjection.confidence})`);
  }
  if (xNodeModel.completion) {
    lines.push(`- completion: localComplete=${xNodeModel.completion.localComplete}, modelComplete=${xNodeModel.completion.modelComplete}, nextOpenXNodeId=${xNodeModel.completion.nextOpenXNodeId ?? "none"}`);
  }
  lines.push(`- 模型统计: nodes=${xNodeModel.nodes.length}, updatedRound=${xNodeModel.agentRound}`);
  lines.push("--- XNode 执行模型结束 ---");
  return lines.join("\n");
}

function buildXNodeFocusPath(focusNode: XNode, nodeById: Map<string, XNode>): XNode[] {
  const path: XNode[] = [];
  let cursor: XNode | null = focusNode;

  while (cursor) {
    path.push(cursor);
    cursor = cursor.parentId ? (nodeById.get(cursor.parentId) ?? null) : null;
  }

  return path.reverse();
}

export function buildContextMethodProofPackets(input: {
  userGoalTree: UserGoalTreeDocument | null;
  xNodeModel: XNodeModelDocument | null;
  recentArtifacts?: ArtifactRef[];
  latestCommits?: XNodeCommit[];
  dynamicStateSource?: RuntimeContextHintSurface["dynamicStateSource"];
}): ContextMethodProofPackets {
  const focusUserGoal = input.userGoalTree?.currentFocusUserGoalId
    ? input.userGoalTree.userGoals.find((goal) => goal.id === input.userGoalTree?.currentFocusUserGoalId) ?? null
    : null;
  const focusUserGoalPath = buildUserGoalPath(focusUserGoal, input.userGoalTree?.userGoals ?? []);
  const nodeById = new Map((input.xNodeModel?.nodes ?? []).map((node) => [node.id, node]));
  const focusXNode = input.xNodeModel?.currentFocusXNodeId
    ? nodeById.get(input.xNodeModel.currentFocusXNodeId) ?? null
    : null;
  const fallbackXNode = focusXNode ?? input.xNodeModel?.nodes[0] ?? null;
  const focusXNodePath = fallbackXNode ? buildXNodeFocusPath(fallbackXNode, nodeById) : [];
  const sleepingUserGoals = (input.userGoalTree?.userGoals ?? [])
    .filter((goal) => goal.id !== input.userGoalTree?.currentFocusUserGoalId && goal.status !== "completed");
  const latestRuntimeProof = input.xNodeModel?.latestRuntimeProof ?? null;
  const currentFocusUserGoalId = input.userGoalTree?.currentFocusUserGoalId ?? null;
  const currentFocusXNodeModelId = input.xNodeModel?.id ?? focusUserGoal?.xNodeModelId ?? null;
  const currentFocusXNodeId = input.xNodeModel?.currentFocusXNodeId ?? null;
  const runtimeContextHintSurface = buildRuntimeContextHintSurface({
    dynamicStateSource: input.dynamicStateSource ?? (input.userGoalTree || input.xNodeModel ? "object-sidecars" : "unresolved_context_state"),
    focusUserGoalIdCandidate: currentFocusUserGoalId,
    focusXNodeModelIdCandidate: currentFocusXNodeModelId,
    focusXNodeIdCandidate: currentFocusXNodeId,
    focusXNode: fallbackXNode,
    policyProjection: input.xNodeModel?.latestPolicyProjection ?? null,
    latestRuntimeProof,
  });

  return {
    contextParameterPacket: {
      currentFocusUserGoalId,
      currentFocusXNodeModelId,
      currentFocusXNodeId,
      runtimeContextHintSurface,
      focusUserGoalPath,
      focusXNodePath,
      sleepingUserGoals,
      recentArtifacts: input.recentArtifacts ?? [],
      latestCommits: input.latestCommits ?? input.xNodeModel?.commitLog ?? [],
      latestRuntimeProof,
    },
    methodPackets: buildDefaultMethodPackets(),
    proofPacket: latestRuntimeProof && focusUserGoal && input.xNodeModel
      ? {
          targetUserGoalId: focusUserGoal.id,
          targetXNodeModelId: input.xNodeModel.id,
          targetXNodeId: latestRuntimeProof.targetXNodeId,
          proofStatus: latestRuntimeProof.proofStatus,
          evidence: latestRuntimeProof.evidence,
          verificationMethod: latestRuntimeProof.verificationMethod,
          userVisibleSummary: latestRuntimeProof.resultSummary,
        }
      : null,
  };
}

export function buildContextMethodProofPacketInjection(packets: ContextMethodProofPackets): string {
  const context = packets.contextParameterPacket;
  const lines: string[] = ["--- Context / Method / Proof Packets ---"];
  lines.push("ContextParameterPacket:");
  lines.push(`- currentFocusUserGoalId=${context.currentFocusUserGoalId ?? "none"}`);
  lines.push(`- currentFocusXNodeModelId=${context.currentFocusXNodeModelId ?? "none"}`);
  lines.push(`- currentFocusXNodeId=${context.currentFocusXNodeId ?? "none"}`);
  lines.push(`- focusUserGoalPath=${context.focusUserGoalPath.map((goal) => goal.id).join(" > ") || "none"}`);
  lines.push(`- focusXNodePath=${context.focusXNodePath.map((node) => node.id).join(" > ") || "none"}`);
  lines.push(`- sleepingUserGoals=${context.sleepingUserGoals.map((goal) => goal.id).join(", ") || "none"}`);
  lines.push(`- recentArtifacts=${context.recentArtifacts.map((artifact) => artifact.id).join(", ") || "none"}`);
  lines.push(`- latestCommits=${context.latestCommits.map((commit) => commit.commitId).join(", ") || "none"}`);
  lines.push(`- latestRuntimeProof=${context.latestRuntimeProof ? `${context.latestRuntimeProof.proofStatus}/${context.latestRuntimeProof.targetXNodeId}` : "none"}`);
  lines.push("Runtime Context Hint Surface:");
  lines.push(`- dynamicStateSource=${context.runtimeContextHintSurface.dynamicStateSource}`);
  lines.push(`- focusUserGoalIdCandidate=${context.runtimeContextHintSurface.focusUserGoalIdCandidate ?? "none"}`);
  lines.push(`- focusXNodeModelIdCandidate=${context.runtimeContextHintSurface.focusXNodeModelIdCandidate ?? "none"}`);
  lines.push(`- focusXNodeIdCandidate=${context.runtimeContextHintSurface.focusXNodeIdCandidate ?? "none"}`);
  lines.push(`- phaseCandidate=${context.runtimeContextHintSurface.phaseCandidate ?? "none"}`);
  lines.push(`- phaseEvidence=${context.runtimeContextHintSurface.phaseEvidence.join("；") || "none"}`);
  lines.push(`- policyHint=${context.runtimeContextHintSurface.policyHint ?? "none"}`);
  lines.push(`- proofStatusHint=${context.runtimeContextHintSurface.proofStatusHint ?? "none"}`);
  lines.push(`- warnings=${context.runtimeContextHintSurface.warnings.join("；") || "none"}`);
  lines.push("- constraint=Hints and candidates are for LLM reasoning only; they do not override the latest user input or LLM-owned decisions.");
  lines.push("MethodPacket:");
  lines.push("- method packets are advisory method references, not workflow commands.");
  for (const packet of packets.methodPackets) {
    lines.push(`- ${packet.methodRef}: ${packet.purpose}`);
    lines.push(`  advisoryOnly=${packet.advisoryOnly}`);
    lines.push(`  input=${packet.inputContract.join("；")}`);
    lines.push(`  output=${packet.outputContract.join("；")}`);
  }
  lines.push("ProofPacket:");
  if (packets.proofPacket) {
    lines.push(`- targetUserGoalId=${packets.proofPacket.targetUserGoalId}`);
    lines.push(`- targetXNodeModelId=${packets.proofPacket.targetXNodeModelId}`);
    lines.push(`- targetXNodeId=${packets.proofPacket.targetXNodeId}`);
    lines.push(`- proofStatus=${packets.proofPacket.proofStatus}`);
    lines.push(`- userVisibleSummary=${packets.proofPacket.userVisibleSummary}`);
  } else {
    lines.push("- none");
  }
  lines.push("--- Context / Method / Proof Packets 结束 ---");
  return lines.join("\n");
}

function buildRuntimeContextHintSurface(input: {
  dynamicStateSource: RuntimeContextHintSurface["dynamicStateSource"];
  focusUserGoalIdCandidate: string | null;
  focusXNodeModelIdCandidate: string | null;
  focusXNodeIdCandidate: string | null;
  focusXNode: XNode | null;
  policyProjection: XNodePolicyProjection | null;
  latestRuntimeProof: RuntimeProofRecord | null;
}): RuntimeContextHintSurface {
  const warnings: string[] = [];
  if (!input.focusUserGoalIdCandidate || !input.focusXNodeModelIdCandidate || !input.focusXNodeIdCandidate) {
    warnings.push("unresolved_context_state: No resolvable current focus. Do not silently create a root goal.");
  }

  return {
    dynamicStateSource: input.dynamicStateSource,
    focusUserGoalIdCandidate: input.focusUserGoalIdCandidate,
    focusXNodeModelIdCandidate: input.focusXNodeModelIdCandidate,
    focusXNodeIdCandidate: input.focusXNodeIdCandidate,
    phaseCandidate: warnings.length > 0 ? "unresolved_context_state" : input.focusXNode?.phase ?? null,
    phaseEvidence: input.focusXNode ? [
      `focused xNode ${input.focusXNode.id} has phase=${input.focusXNode.phase}`,
    ] : [],
    policyHint: input.policyProjection?.nextStepType ?? null,
    proofStatusHint: input.latestRuntimeProof?.proofStatus ?? null,
    warnings,
  };
}

function buildUserGoalPath(focusGoal: UserGoalTreeDocument["userGoals"][number] | null, userGoals: UserGoalTreeDocument["userGoals"]): UserGoalTreeDocument["userGoals"] {
  const byId = new Map(userGoals.map((goal) => [goal.id, goal]));
  const path: UserGoalTreeDocument["userGoals"] = [];
  let cursor = focusGoal;
  while (cursor) {
    path.push(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) ?? null : null;
  }
  return path.reverse();
}

function buildDefaultMethodPackets(): MethodPacket[] {
  return [
    {
      methodRef: "GoalRelationDecision",
      purpose: "先判断用户输入与 userGoalTree 的关系，再决定 projection ops；这是 LLM-owned 判断参考，不是脚本裁决。",
      advisoryOnly: true,
      whenToUse: ["每次处理用户消息前", "目标关系可能是 continuation/new/correction/switch/complete 时"],
      inputContract: ["current userGoalTree", "current xNodeModel", "latest user message", "recent context"],
      outputContract: ["relation", "targetUserGoalId", "targetXNodeModelId", "targetXNodeId", "parentUserGoalId", "producesNewUserGoal", "shouldCreateXNodeModel", "evidence", "confidence"],
    },
    {
      methodRef: "RuntimeProofValidation",
      purpose: "把当前 x-node 的 runtimeProof facet 与 RuntimeProofRecord 对齐，辅助 LLM 判断是否可收口。",
      advisoryOnly: true,
      whenToUse: ["完成实现切片后", "测试或运行态证据发生变化时"],
      inputContract: ["focused xNode", "latestRuntimeProof", "latestProofSignals"],
      outputContract: ["proofStatus", "evidence", "verificationMethod", "nextStepType"],
    },
    {
      methodRef: "PostNodeCommit",
      purpose: "节点运行后提交可恢复保存点；next focus 只是 hint，不是自动切焦点指令。",
      advisoryOnly: true,
      whenToUse: ["bounded atomic task 完成后", "需要记录 output/proof/state patch 时"],
      inputContract: ["targetUserGoalId", "targetXNodeModelId", "targetXNodeId", "resultStatus", "proofRefs", "statePatch"],
      outputContract: ["XNodeCommit", "latestCommits", "nextFocusHint(advisory-only)"],
    },
  ];
}

export function buildRuntimeProofInjection(xNodeModel: XNodeModelDocument | null): string {
  if (!xNodeModel?.latestRuntimeProof) return "";

  const lines: string[] = ["--- 当前 proof / signal 摘要 ---"];
  lines.push(`- targetXNodeId=${xNodeModel.latestRuntimeProof.targetXNodeId}`);
  lines.push(`- proofStatus=${xNodeModel.latestRuntimeProof.proofStatus}`);
  lines.push(`- proofMode=${xNodeModel.latestRuntimeProof.proofMode}`);
  lines.push(`- resultSummary=${xNodeModel.latestRuntimeProof.resultSummary}`);
  if (xNodeModel.latestRuntimeProof.evidence.length > 0) {
    lines.push(`- evidence=${xNodeModel.latestRuntimeProof.evidence.join("；")}`);
  }
  if (xNodeModel.latestRuntimeProof.verificationMethod.length > 0) {
    lines.push(`- verificationMethod=${xNodeModel.latestRuntimeProof.verificationMethod.join("；")}`);
  }
  if (xNodeModel.latestProofSignals && xNodeModel.latestProofSignals.length > 0) {
    lines.push("- proofSignals:");
    for (const signal of xNodeModel.latestProofSignals) {
      lines.push(`  - ${signal.type}: ${signal.message}${signal.suggestedNextStepType ? ` (suggest=${signal.suggestedNextStepType})` : ""}`);
    }
  }
  lines.push("--- proof / signal 摘要结束 ---");
  return lines.join("\n");
}

export function buildNextStepPolicyInjection(
  policyProjection?: XNodePolicyProjection | null,
  certaintyAssessment?: CertaintyAssessment | null,
): string {
  const effectivePolicy = policyProjection ?? (certaintyAssessment ? projectPolicyFromCertaintyAssessment(certaintyAssessment) : null);
  if (!effectivePolicy) return "";

  const lines: string[] = [
    "--- 当前运行时执行策略 ---",
    `- 当前 x-node policy projection: ${effectivePolicy.nextStepType}`,
    `- policy hint nextStepType: ${effectivePolicy.nextStepType}`,
    `- policy confidence=${effectivePolicy.confidence}`,
    `- 五维状态: why=${effectivePolicy.dimensions.why} what=${effectivePolicy.dimensions.what} flow=${effectivePolicy.dimensions.flow} structure=${effectivePolicy.dimensions.structure} runtimeProof=${effectivePolicy.dimensions.runtimeProof}`,
    "- 这是 advisory-only runtime hint，不应覆盖用户最新输入、工具证据或 LLM-owned 判断；若冲突，先显式说明再执行。",
  ];

  if (effectivePolicy.keyGaps.length > 0) {
    lines.push(`- 关键缺口: ${effectivePolicy.keyGaps.join("；")}`);
  }

  if (policyProjection) {
    lines.push("- policy source=x-node-policy (primary)");
  } else if (certaintyAssessment) {
    lines.push("- policy source=certainty-assessment (compatibility fallback)");
  }

  for (const guidance of effectivePolicy.guidance) {
    lines.push(`- ${guidance}`);
  }

  lines.push("--- 运行时执行策略结束 ---");
  return lines.join("\n");
}

function projectPolicyFromCertaintyAssessment(certaintyAssessment: CertaintyAssessment): XNodePolicyProjection {
  return {
    xNodeId: "compat-certainty-assessment",
    derivedAtRound: 0,
    dimensions: { ...certaintyAssessment.dimensions },
    keyGaps: [...certaintyAssessment.keyGaps],
    nextStepType: certaintyAssessment.nextStepType,
    confidence: certaintyAssessment.confidence,
    guidance: buildGuidanceFromNextStepType(certaintyAssessment.nextStepType),
  };
}

function buildGuidanceFromNextStepType(nextStepType: XNodePolicyProjection["nextStepType"]): string[] {
  switch (nextStepType) {
    case "plan_repair":
      return [
        "先做 direct-answer gate：若用户目的是简单高确定性请求，且无需项目上下文、多步决策、状态写入或 runtime proof，则直接回答，不展开递归 xNodeModel。",
        "否则进入目标确定性提升层（plan-certainty-improvement 节点）：把 why/what/flow/structure/runtimeProof 缺口转成 ContextParameterRequest，再获取最小必要信息参数。",
        "若多个确定性缺口互不依赖，优先并行调用 subagent / provider 获取参数；主 agent 汇合后统一生成 CertaintyAssessment、XNodeModelPatch 与 RuntimeProofRecord。",
        "不要在顶层穷举固定 tools/skills；先核对 truth source、完成定义与关键约束，不要在缺口未闭合前继续扩写代码。",
      ];
    case "generate_children":
      return [
        "当前焦点更像 composite；先拆出子目标/检查项，再推进具体实现。",
        "若已有 children，优先推进未完成 child，而不是把父目标直接当成单个实现任务。",
      ];
    case "execute_atomic_work":
      return [
        "将当前焦点视为 bounded atomic task，优先完成一个最小完整切片。",
        "只改完成该 atomic 产物所必需的文件，并立刻补最小验证。",
      ];
    case "run_tests":
      return [
        "本轮主动作优先视为测试/验证/回归，而不是继续扩写实现。",
        "先运行最小相关测试、构建或 runtime proof；只做让验证通过所需的最小修复。",
      ];
    case "seek_acceptance":
      return [
        "当前焦点优先进入验收/确认，而不是新增实现范围。",
        "先整理完成状态、验证证据与剩余风险，必要时请求用户确认或验收。",
      ];
    case "upward_regression":
      return [
        "先把注意力从局部完成项抬升到 parent / sibling，检查父层吸收条件。",
        "不要把 local complete 直接当成 parent complete，也不要继续深挖已完成局部。",
      ];
  }
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
