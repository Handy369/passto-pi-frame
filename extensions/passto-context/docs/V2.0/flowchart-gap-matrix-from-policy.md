# PasstoContext V2.0 流程图对照矩阵（从“policy projection / 兼容投影”开始，按用户目标树 / x-node-model 双层对象重判）

> 状态：Draft  
> 更新：2026-05-20  
> 目的：基于流程图 + 当前仓库文档/代码 + 用户新增澄清，重新判断从“policy projection / 兼容投影是否足够”开始的后续节点，到底哪些是**目标架构中已定义**、哪些是**仓库文档未显式化**、哪些是**代码只做到软消费/观测**、哪些仍然尚未实现。

---

## 1. 本次重判的关键前提

本次判断必须先接受以下对象分层，否则会得出错误结论：

### 1.1 用户目标树 与 Agent 递归目标树不是同一个对象

- **用户目标树**：用户层目标对象，树状，代表用户真正想完成的目标集合与层级。
- **Agent 递归目标树**：围绕某个用户目标展开的细分拆解树，是 Agent 为实现该用户目标而生成的内部执行树。
- **x-node-model**：某个用户目标对应的 Agent 递归目标树文件；既保存该用户目标下所有 agent goal 的递归结构，也是该用户目标的 agent-side 状态机文件。

因此：

> 流程图里的很多“目标推进”节点，若只拿当前仓库里的 `GoalTreeDocument` 去看，会误判为“对象不存在”；实际上它们在目标架构里对应的是 **用户目标树 + 每用户目标一个 x-node-model** 的双层结构。

---

### 1.2 Agent goal 的统一骨架不是普通 task 字段，而是五维方法骨架

任意 agent / subagent goal 的结构都以以下五维为骨架：

- why
- what
- flow
- structure
- runtime proof

这五维不仅是 Curator 产出 policy projection 时依赖的状态维度，也应被理解为：

> **Agent 目标对象的通用结构骨架。**

---

### 1.3 `nextStepType` 不是硬调度器，而是软约束策略信号

`nextStepType` 的正确角色是：

- 以 x-node-model 当前状态为基础
- 投影成 prompt 中的软约束策略
- 指导 LLM 自主判断下一步

而不是：

- if/else 强制执行的硬状态机
- 完全由代码主导的 workflow engine

所以当前设计哲学应表述为：

> **LLM 主导运作流程，脚本/状态/信号只负责提高可靠性、稳定性与可分析性。**

---

### 1.4 runtime-proof 不是附属测试，而是目标对象的一部分

agent/subagent 的上下文与输出都应理解为：

- **信息（参数/状态/对象）**
- **方法（执行方法 / proof 方法 / 自证明路径）**

的复合体。

因此 runtime-proof 不只是“跑完测试”这么简单，而是：

> **目标完成判断的一部分。**

若 runtime-proof 不符合预期，应输出结构化信号进入日志，供后续分析与迭代。

---

## 2. 重判口径

本文对每个流程图节点使用四个维度共同判断：

1. **目标架构是否已定义**：按用户本轮澄清，这个对象/机制在真实目标设计里是否存在
2. **仓库文档是否已显式化**：当前 `docs/V2.0` 是否已把它正式写清
3. **仓库代码是否已实现**：当前 runtime 是否已有明确承载
4. **最终判断**：
   - **A. 架构已定义 + repo 已显式化 + 代码已实现**
   - **B. 架构已定义 + repo 已显式化 + 代码仅软实现/观测**
   - **C. 架构已定义 + repo 未完整显式化 + 代码未正式承载**
   - **D. 架构未充分定义 + repo 未显式化 + 代码未实现**

---

## 3. 真相源

### 流程图
- `docs/V2.0/passto-context-2-0.excalidraw`

### 仓库文档
- `docs/V2.0/goal-tree-v2.0.md`
- `docs/V2.0/curator-v2.0.md`
- `docs/V2.0/implementation-plan.md`
- `docs/V2.0/runtime-gap-analysis.md`

### 当前代码
- `before-agent-start-injection.ts`
- `grc-prompts.ts`
- `grc-subagent.ts`
- `grc-goal-tree.ts`
- `grc-goal-view.ts`
- `ptc-status.ts`
- `index.ts`

### 用户本轮关键澄清（优先于我上一轮误判）
- 用户目标树 与 Agent 递归目标树不同
- x-node-model 是每个用户目标对应的 agent 递归目标树文件 / 状态机
- `nextStepType` 的调度是 soft prompt policy，不是硬调度器
- 上下文与输出都遵循“信息 + 方法”复合体
- runtime-proof 失败需发信号记日志

---

## 4. 逐节点对照矩阵

| 流程图节点 | 目标架构定义 | repo 文档状态 | repo 代码状态 | 判断 | 说明 |
|---|---|---|---|---|---|
| policy projection 是否足够支撑执行 / 仍需补兼容投影 | 已定义。对应 x-node-model 当前目标在 why/what/flow/structure/runtime proof 五维上的策略投影判断 | 已部分显式化为 `lastPolicyProjection` / `certaintyAssessment` / `nextStepType`，但未完全写成“x-node-model 状态判断 + policy 输出” | 已解析、注入、观测 | **B** | 当前实现已进入 policy-first 方向，但仍保留 `certaintyAssessment` 兼容投影 |
| policy projection 不足 / 继续补状态闭合 | 已定义。属于用户目标进入计划阶段时，x-node-model 引导 LLM 继续补 why/what/flow/structure/runtime proof 缺口 | 文档只写了 `plan_repair`，未写成“用户目标状态映射 + x-node-model 状态机” | 仅有 prompt 软策略 | **C** | 目标架构存在，但 repo 表达不完整 |
| 补策略所需证据 / extensions / skills | 已定义。属于 LLM 为补 policy projection 所需证据而选择工具/skills 的方法面 | repo 文档几乎未正式化 | repo 无 policy-driven routing contract | **C** | 架构存在，但 repo 未显式承接 |
| 确定性足够 / 执行 | 已定义。对应用户目标从计划阶段进入实施阶段 | repo 文档以 `execute_atomic_work` 表达，但未显式连回“用户目标状态映射” | 只有 nextStep prompt 注入 | **C** | 有软策略，无正式状态迁移模型 |
| 输出/更新目标实现方案 | 已定义。它不是独立硬 plan engine，而是某个用户目标对应 x-node-model 在计划阶段产出的执行方案部分 | 当前 repo 文档未把“目标实现方案”定义成 x-node-model 内的结构化对象 | 代码无正式 plan artifact | **C** | 不是“概念不存在”，而是 repo 未落正式对象 |
| 存在关联目标 切换焦点目标 | 已定义。用户目标树确认后会关联/产生/更新对应 x-node-model；局部完成后还要回到用户目标树继续判断下一用户目标 | repo 文档只写 `currentFocusGoalId` / transition，未区分“用户目标焦点”与“x-node-model 焦点” | 代码仅能显示 focus / transition | **C** | 仓库把两层焦点混在 GoalTree 视角里了 |
| 目标实现是否全部完成 | 已定义。某个 x-node-model 全完成 = 对应用户目标实现；再回到用户目标树判断下一步 | repo 文档未正式写出“两层完成语义” | 代码无双层完成判定 | **C** | 当前 repo 缺少 user-goal vs x-node-model completion contract |
| 输出总结到 x-node-model | 已定义。x-node-model 就是 agent 递归目标树文件与状态机文件 | repo 文档未正式定义 x-node-model 文件对象 | 代码无 x-node-model 文件承载 | **C** | 我上一轮把它判成未定义是错的；正确说法是 repo 未显式化/未实现 |
| 是否需要拆分子目标 / 细化执行flow | 已定义。属于 x-node-model 对某个用户目标的 agent-side 细分 | repo 文档只从 `generate_children` / `atomicity` 侧零散表达 | 代码仅软提示 | **C** | 架构存在，repo 仍未把 child planning 写成 x-node-model 行为 |
| 创建子目标 | 已定义。是 x-node-model 的递归扩展 | repo 文档有 GoalTree child 概念，但没有显式说“每个用户目标一个 x-node-model，children 属于该模型” | 代码结构可承载 child node，但无正式 child creation 流程 | **C** | 结构支持部分存在，语义对象未落正 |
| 是否存在子目标 | 已定义 | repo 文档部分显式化 | 代码 `focusChildren` 可投影 | **B** | 已有观测面，但还不是行为面 |
| 创建子目标并更新 子目标x-node-model | 已定义。严格说这里不是创建“另一个独立模型”，而是更新当前用户目标对应 x-node-model 内的子节点状态 | repo 文档未清楚区分“x-node-model 文件”与“内部 child nodes” | 代码无正式 update pipeline | **C** | 语义存在，repo 表达还混乱 |
| 子目标x-node-model 状态 | 已定义。child 作为 x-node-model 内节点，天然带五维骨架与状态 | repo 文档部分用 `GoalNode.status / atomicity / phase` 替代，但未纳入完整五维骨架 | 代码只承载部分状态字段 | **C** | 当前字段层偏窄，没完整承载 why/what/flow/structure/runtime proof 骨架 |
| LLM选择未完成的子目标 | 已定义。应由 LLM 基于 x-node-model 状态 + 软策略自主判断 | repo 文档未正式定义“child selection as LLM policy” | 代码无该层 contract | **C** | 这里不一定要写硬算法，但至少要有 soft policy contract |
| 切换焦点目标到子目标 | 已定义。属于 x-node-model 内部焦点迁移 | repo 文档只表达成 `currentFocusGoalId`，没写清用户目标焦点与 agent 焦点双层关系 | 代码仅被动存储 | **C** | 焦点切换语义不完整 |
| 不需要子目标 | 已定义。说明当前 agent goal 在 x-node-model 中可直接进入实施 | repo 文档用 `atomic` + `execute_atomic_work` 部分表达 | 代码仅软提示 | **B** | 软表达已存在，但还没接回 x-node-model 状态机 |
| 调用subagent执行 / 构建提示词 | 已定义。subagent 仍是 LLM 主导哲学的延伸，不是硬 worker pool | repo 文档未正式把 subagent 输出定义成“信息 + 方法 + proof”复合体 | `grc-subagent.ts` 仅服务 Curator/Reflector，不服务 x-node-model 执行 | **C** | 不是没 subagent，而是没把 subagent 接入执行主链 |
| 并行subagent执行 | 已定义，但属于 LLM 根据 x-node-model 与实现方案自主选择的工作方式，不应被误写成默认硬并行引擎 | repo 文档未正式化 | 代码未实现 | **C** | 目标架构存在，repo 未落 |
| 串行subagent执行 | 已定义，同上 | repo 文档未正式化 | 代码未实现 | **C** | 同上 |
| 测试/验证 subagent 执行的结果 | 已定义。输出结果天然包含 runtime-proof 或自证明方法 | repo 文档有 `run_tests` / `testing` / `pending_acceptance`，但未写成“信息 + 方法”复合输出验证 | 代码仅注入优先验证策略 | **C** | proof 语义存在，但 repo 没完整表达 |
| 验证通过，更新目标状态 | 已定义。proof 成立后应更新 x-node-model 状态，并可能映射回用户目标完成推进 | repo 文档有 phase 推进，但没接到双层状态映射 | 代码只有后验记录 | **C** | 当前还是记录层，不是 x-node-model 正式状态迁移 |
| 验证未通过，重新规划执行 | 已定义。proof 不符预期时应更新 x-node-model，并产生日志信号 | repo 文档只表达 `testing -> execute` / `plan_repair`，未定义 proof-failure signal | 代码无结构化 proof failure signal | **C** | 这里是一个明确缺口 |
| 存在父目标 | 已定义。属于 x-node-model 内部递归回退；同时完成某个 x-node-model 后还可能回到用户目标树上层 | repo 文档只有 `upward_regression` 的单层表达 | 代码只有软提示 | **C** | 当前 repo 没写清“模型内回退”与“用户目标层回退”区别 |
| 没有父目标 | 已定义。表示当前 x-node-model 已回到根，并可能对应用户目标完成 | repo 文档未正式定义 | 代码未实现 | **C** | 应与用户目标树切换语义联动 |
| 结束，所有目标完成 | 已定义。用户目标树全部完成才是全局完成 | repo 文档未正式区分“x-node-model 完成”与“用户目标树完成” | 代码无该全局收口器 | **C** | 当前仓库缺少最上层收口语义 |

---

## 5. 重判后的总结合理表述

### 5.1 哪些是我上一轮误判的

我上一轮最明显的误判是：

- 把 `x-node-model` 视为“流程图出现但概念未定义”
- 把后半段理解成“应该补一个更硬的执行调度器”

基于本轮澄清，这两个判断都不准确。

更准确地说：

- `x-node-model` 在目标架构里是**明确存在且居于核心地位**的对象
- `nextStepType` 代表的是 **x-node-model -> prompt policy -> LLM 自主判断** 的软调度哲学

---

### 5.2 当前真正的 gap 是什么

当前真正的 gap 不是“后半段没有设计”，而是：

> **这些设计大量存在于真实目标架构与方法论中，但当前 repo 文档和代码没有把“用户目标树 ↔ x-node-model ↔ soft policy ↔ runtime-proof signal”这条主链完整显式化。**

也就是说，当前仓库已实现的主要是：

- GRC 注入层
- policy projection / compatibility projection 的软消费层
- GoalTree / status / widget 的观测层
- Curator / Reflector 的后验处理层

而尚未完整落成的是：

- 用户目标树对象
- x-node-model 文件对象
- 用户目标状态 -> x-node-model 状态映射
- x-node-model 内五维骨架持久化
- 基于 x-node-model 的 soft policy projection
- `certaintyAssessment` 作为兼容投影继续保留的过渡层
- runtime-proof 失败信号日志
- x-node-model 完成 -> 用户目标树继续推进 的双层闭环

---

## 6. 下一步文档/实现应优先显式化的对象

按优先级，建议先显式化以下对象，而不是继续只扩展 `GoalTreeDocument`：

1. **UserGoalTreeDocument**
   - 用户层目标树
2. **XNodeModelDocument**
   - 每个用户目标对应一个 agent 递归目标树文件
3. **XNodePolicyProjection**
   - 从 x-node-model 当前状态投影出 prompt 软策略
4. **RuntimeProofRecord**
   - 结果 proof / 自证明信息结构
5. **RuntimeProofSignalLog**
   - proof 不符合预期时的结构化日志信号

配套最小架构方案见：
- `docs/V2.0/executor-layer-minimal-architecture.md`

---

## 7. 一句话

> 从“policy projection / 兼容投影是否足够”开始，V2.0 后半段并不是没有设计；更准确地说，是 **真实设计已经存在于“用户目标树 + 每用户目标一个 x-node-model + LLM 主导软调度 + runtime-proof 信号化”这套架构里，但当前 repo 还没有把它完整显式化并正式落到代码。**
