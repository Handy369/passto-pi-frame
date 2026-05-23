# PasstoContext V2.0 Curator 设计

> 版本：v2.0 | 状态：Draft | 更新：2026-05-20

---

## 1. V2.0 Curator 的核心升级

V1.x / 早期 V2 文档中，Curator 的升级重点主要写成：
- GoalTree 更新
- policy projection（早期以 `certaintyAssessment` 兼容字段承载）
- draft 处理

当前主链已更新：Curator 不再以 `draftDispositions` 作为唯一后验动作，而是通过通用 `reconciliationOps` 复核任意 userGoal / xNodeModel；`draftDispositions` 仅保留 legacy compatibility。

这些仍然部分成立，但在当前正式口径下，Curator 的核心职责应改写为：

> **在下一轮 `before_agent_start`，审核确认 / 更新用户目标树，并审核确认 / 更新当前用户目标对应的 x-node-model。**

因此 Curator 不只是“归档 GoalState”，而是要同时处理两层对象：

1. 用户目标树层
2. x-node-model 层

---

## 2. Curator 的输入对象

Curator 在 V2.0 中应基于以下对象做后验判断：

- `previousRoundConversation`
- `currentUserMessage`
- `UserGoalTreeDocument`
- 当前焦点用户目标对应的 `XNodeModelDocument`
- 最近的 proof / proof signal（若有）

它的视角不是“当前轮要做什么”，而是：

> **当前轮到来后，上一轮对用户目标和 agent 递归目标树的理解，哪些需要被确认、修正、补充或关闭。**

---

## 3. Curator 的三层判断

V2.0 Curator 的后验判断，应从单层 signal 升级为三层：

### 第一层：用户目标树层判断

判断：
- 当前用户消息是在继续已有用户目标，还是引入新用户目标
- 某个用户目标是否从 identified → planning → executing → completed 发生了状态变化
- 当前用户层焦点目标是否需要切换

### 第二层：x-node-model 结构判断

判断：
- 当前用户目标对应的 x-node-model 是否需要新增/修正/关闭节点
- 当前焦点 x-node 是否发生 atomic/composite / phase / parent-child / sibling 变化
- 当前局部完成是否应 upward regression 到 parent / sibling

### 第三层：五维与 proof 判断

判断：
- why / what / flow / structure / runtime proof 哪些维度仍未闭合
- key gaps 是什么
- 推荐的 `nextStepType` 是什么
- proof 是否需要沉淀为 `RuntimeProofRecord`
- proof 不符合预期时，是否需要 `RuntimeProofSignal`

其中五维口径应统一理解为：
- **why**：当前目标为什么存在、服务哪个更上层目标
- **what**：当前轮真正要产出的对象与完成定义是什么
- **structure**：当前 truth source、正式对象、兼容桥与边界是什么
- **flow**：不仅是“下一步做什么”，还包括结果如何 parse / validate / persist / replay / inject 进入下一轮；也就是执行流 + 闭环控制流
- **runtime proof**：当前判断已被哪些现实证据支撑；若证据不足/部分成立/冲突，应显式输出 proof gap / signal

---

## 4. Curator 输出对象

### 4.1 用户目标树更新 / reconciliationOps

Curator 应输出更新后的 `UserGoalTreeDocument`，或输出可应用到当前 object sidecars 的 `reconciliationOps`。`reconciliationOps` 是当前 V2 主链的后验修正合同，用于 `mark_reviewed`、`revise_user_goal`、`advance_execution_state`、`update_xnode_model`、`adjust_focus` 等通用动作。

Curator 应输出更新后的 `UserGoalTreeDocument`，至少包含：
- `currentFocusUserGoalId`
- `rootUserGoalIds`
- `userGoals[]`
- 每个用户目标的状态变化
- 每个用户目标对应的 `xNodeModelId`

---

### 4.2 x-node-model 更新

Curator 应输出更新后的 `XNodeModelDocument`，至少包含：
- `currentFocusXNodeId`
- `rootXNodeIds`
- `nodes[]`
- 每个节点的五维骨架状态
- atomicity / phase / parent-child / focus 的修正结果

---

### 4.3 Policy Projection

Curator 应在 x-node-model 更新完成后，生成新的 `XNodePolicyProjection`：
- 五维闭合状态
- key gaps
- `nextStepType`
- confidence
- guidance

这里的 `nextStepType` 是：
- 下一轮 prompt 应注入给 Generator 的软策略
- 不是 Curator 对主链的硬命令

---

### 4.4 RuntimeProofRecord / RuntimeProofSignal

当上一轮输出包含明确的 proof / 自证明信息时：
- Curator 应回收为 `RuntimeProofRecord`

当 proof 不符合预期或互相冲突时：
- Curator 应记录为 `RuntimeProofSignal`

例如：
- `runtime-proof-failed`
- `runtime-proof-partial`
- `runtime-proof-missing`
- `runtime-proof-conflicted`

---

## 5. Curator Prompt 的正确工作目标

旧口径常把 Curator prompt 写成“维护 GoalTree”。

在 V2.0 正式口径下，它更准确的目标应是：

1. 审核当前用户消息对用户目标树的影响
2. 审核当前用户目标对应的 x-node-model 是否需要修正
3. 基于五维与 proof 生成 soft policy
4. 把结果变成下一轮可注入的“信息 + 方法”复合上下文

因此 Curator prompt 不应只强调：
- active / completed
- atomicity / phase

还必须强调：
- 用户目标层 vs x-node 层的区分
- 五维骨架是目标对象的一部分
- proof signal 是正式输出，不是自然语言附注
- flow 既覆盖目标推进顺序，也覆盖 Curator 结果如何被 parse / validate / persist / replay / inject 回主链；若闭环控制流断裂，即使上游判断大体正确，也不能算主链稳定

---

## 6. Draft / Provisional 语义的重新定位

旧文档把 draft goal 主要放在“GoalTree signal 枚举”层讨论。

在 V2.0 正式口径下，更准确的理解是：
- draft / provisional 语义主要服务于“当前轮先有 anchor，下一轮再裁决”
- 它本质上是 **用户目标树或 x-node-model 的 provisional overlay 问题**
- 而不是单纯给 GoalNode 多一个 signal 枚举就结束

因此 Curator 在处理 draft / provisional 时，应具有：
- confirm
- revise
- discard
- 必要时对子树做结构修正

也就是说，Curator 的修正对象不一定只是一个节点，而可能是：
- 当前 provisional user goal
- 或其派生的整段 x-node subtree

这部分详细运行时闭环，见：
- `design-draft-goal-recognition.md`
- `draft-goal-runtime-spec-v1.md`

---

## 7. Curator 与 Generator 的职责边界

## 7.1 Generator

Generator 负责：
- 当前轮确认当前服务哪个用户目标
- 围绕对应 x-node-model 推进
- 输出结果 + 方法 + proof

Generator 不负责：
- 写 confirmed 用户目标树
- 对上一轮状态做最终裁决

---

## 7.2 Curator

Curator 负责：
- 下一轮后验审核确认 / 更新用户目标树
- 审核确认 / 更新 x-node-model
- 生成 policy projection
- 记录 proof / proof signal

Curator 不负责：
- 替主 Agent 直接执行当前轮工作
- 把系统改成硬 scheduler

---

## 8. 与当前 repo 的兼容关系

当前 repo 中已存在的：
- `GoalTreeDocument`
- `GoalNode`
- `certaintyAssessment`
- `draftDispositions`

在正式口径下可重新解释为：

- `GoalTreeDocument`：过渡期兼容结构，或 x-node-model 的简化承载
- `GoalNode`：早期 x-node 近似物
- `certaintyAssessment`：`XNodePolicyProjection` 的兼容投影字段 / 早期承载物
- `draftDispositions`：provisional overlay / subtree 修正机制的早期近似物

因此，Curator 的后续实现方向不是继续扩大单层 GoalTree 的字段，而是逐步正式化：
- UserGoalTreeDocument
- XNodeModelDocument
- XNodePolicyProjection
- RuntimeProofRecord
- RuntimeProofSignal

同时应坚持一条实现约束：
- **对象层是主真相源，摘要/Markdown 是兼容 envelope / 人类可读投影层**
- 若对象层已足以表达结果，解析与回放主链不应被摘要层格式偶发漂移所阻断
- RuntimeProofSignal

---

## 9. 一句话

> V2.0 Curator 的升级，不是把摘要做得更复杂，而是：**在下一轮 before_agent_start，把“上一轮系统以为自己在为哪个用户目标工作、其对应 x-node-model 推进到哪里、这些判断有没有 proof 支撑”这三件事正式审核确认并更新。**