# PasstoContext V2.0 版本设计

> 版本：v2.0 | 状态：Mainline Closed（E1–E7）+ Improve-certainty Closed（P0–P7）+ Structural Continuity Closed（P0–P5） | 更新：2026-05-22

---

## 1. 版本定位

V2.0 不是对 V1.x 的小补丁，而是把 PasstoContext 从“围绕单层 GoalState 做后验跟踪”，升级为“围绕**用户目标树 + 每用户目标一个 x-node-model** 做持续执行稳定化”。

### 最高设计约束：LLM-primary Context Runtime

PasstoContext 的底层模型不是脚本状态机驱动 Agent，而是 **LLM-primary context runtime**：

```text
上下文 = 用户输入 + passto-context 框架拼接 + 历史修剪 / 摘要 / 记忆恢复 + 当前目标 / 状态 / proof / 参数注入
LLM 运行输入 = 运行函数 / 方法论 + 信息参数
LLM 运行时 = 基于上下文推理 + 按需调用本地 runtime 工具 + 按需热加载更多信息 / skill / 文档 / 代码 / proof
输出结果 = 用户可感知 runtime proof + 新的信息参数 + 可复用运行函数 / 方法论片段（非每轮必需）
```

因此，`script` / `skill` / `tool` / schema / projection API 只是辅助设施，用于提高确定性、执行效率与运行可靠性。它们应帮助 LLM 获得稳定 `userGoalId` / `xNodeModelId` / `xNodeId`、目标路径、proof、artifacts、历史摘要与方法论函数，但不能替代 LLM 做语义目标裁决，也不能在状态缺失时静默创建新的 root goal。

V1.x 解决的是：
- Curator 能后验归档目标状态
- Reflector 能做 post-round 审计
- Generator 能消费多层上下文

V2.0 要解决的是：
- 用户目标和 Agent 递归目标树不再混成一个对象
- 每个用户目标都有一个对应的 `x-node-model`
- `x-node-model` 既是 agent 递归目标树文件，也是该用户目标的 agent-side 状态机
- `x-node-model` 必须稳定关联并指向一个 `userGoalId`，因为它是该 userGoal 的执行分解，不能脱离 userGoal 单独存在
- `nextStepType` 不再被理解为硬调度器，而是从 `x-node-model` 投影出的软策略信号
- `runtime-proof` 被提升为目标对象的一部分；proof 不符合预期时应产生结构化日志信号

### 核心命题

> **从“目标文本跟踪”升级为“用户目标树 + x-node-model + LLM 主导软调度”的执行稳定层。**

---

## 2. 核心对象模型

### 2.1 用户目标树（UserGoalTreeDocument）

用户目标树是用户层 truth source，表示：
- 用户当前有哪些目标
- 目标之间的层级/并列关系
- 当前用户层焦点目标是什么
- 每个用户目标对应哪个 `x-node-model`
- 每个用户目标当前处于哪个状态

用户目标状态分四类：
- **确定**：用户输入后在当轮被识别确认
- **计划阶段**：提高目标确定性，直到输出实施计划
- **实施阶段**：确定性足够后，按 `x-node-model` 推进
- **完成**：对应 `x-node-model` 已整体完成

### 2.2 x-node-model（XNodeModelDocument）

每个用户目标都对应一个 `x-node-model` 文件。它是：
- 围绕该用户目标展开的 agent 递归目标树
- 该用户目标的 agent-side 状态机
- LLM 判断下一步的核心运行时对象

任意 agent/subagent 目标节点都以五维骨架表达：
- why
- what
- flow
- structure
- runtime proof

这五维不是额外装饰，而是 `x-node-model` 中每个节点的原生结构。

### 2.3 软策略投影（XNodePolicyProjection）

`nextStepType` 在 V2.0 中的正确角色是：
- 基于 `x-node-model` 当前状态投影出的软策略
- 在 `before_agent_start` 中注入 prompt
- 指导 LLM 自主判断下一步

它不是：
- code-enforced scheduler
- BPM / DAG 式硬工作流引擎

### 2.4 Runtime Proof 与 Signal

任意 agent/subagent 的上下文与输出，都应理解为：
- **信息**（参数/状态/对象）
- **方法**（执行方法/验证方法/自证明路径）

的复合体。

因此：
- `runtime-proof` 是目标对象的一部分
- proof 不符合预期时，必须输出结构化信号进入日志，供后续分析和迭代

---

## 3. 文档索引

| 文档 | 职责 |
|---|---|
| `README.md` | V2.0 总览与索引（本文） |
| `architecture-v2.0.md` | 总体架构、事件时序、双层对象流 |
| `goal-tree-v2.0.md` | 用户目标树 + x-node-model 的正式对象模型 |
| `generator-v2.0.md` | Generator 如何在当前轮识别用户目标、创建/更新 x-node-model、消费软策略 |
| `curator-v2.0.md` | Curator 如何在下一轮 before_agent_start 审核确认/更新用户目标树与 x-node-model |
| `design-draft-goal-recognition.md` | **Deprecated / Legacy**：旧 draftGoalOp / provisional anchor 推演；V2 主链已改为 `applyUserGoalProjection` + `reviewState` |
| `draft-goal-runtime-spec-v1.md` | **Deprecated / Legacy**：旧 provisional overlay runtime spec；仅作为历史背景与兼容层参考 |
| `flowchart-gap-matrix-from-policy.md` | 从“policy projection / 兼容投影”开始的流程图节点重判矩阵 |
| `improve-certainty-design.md` | Improve-certainty / plan-certainty-improvement 设计：planning 确定性提升节点的方法论、输出对象、runtime proof 与用户可感知回复协议；当前已按 P0–P7 落地 |
| `improve-certainty-implementation-plan.md` | Improve-certainty 具体开发实施计划：P0–P7 开发切片、代码落点、测试策略、回归接入与最终实施收口 proof；当前状态为 Implemented / Closed |
| `executor-layer-minimal-architecture.md` | “执行器层”最小补齐方案（按软调度哲学重写） |
| `implementation-plan.md` | 分阶段实施计划；Structural Continuity P0–P5 已完成落地，用 LLM-primary context runtime 约束重设 identity、GoalRelationDecision、context/method/proof packet、post-node commit 与 before-agent-start 注入 |
| `runtime-gap-analysis.md` | 当前 repo 与目标架构之间的 gap 分析 |
| `phase-e5-closure-note.md` | Phase E5：provisional overlay 闭环落地说明 |
| `phase-e6-precise-code-plan.md` | Phase E6：object-first compatibility shrink 精确代码计划 |
| `phase-e6-closure-note.md` | Phase E6：object-first 收口完成后的 closure note |
| `phase-e7-proof-mainchain-plan.md` | Phase E7：RuntimeProofRecord / RuntimeProofSignal 主链化计划 |
| `phase-e7-closure-note.md` | Phase E7：proof-first runtime closure 完成后的 closure note |
| `v2-mainline-closure-note.md` | V2.0 主线收口说明：E1–E7 已落地后的当前状态与下一步候选 |
| `compatibility-governance-plan.md` | compatibility bridge 治理盘点：保留边界、冻结规则、shrink 候选与 object-first 守门约束 |

---

## 4. 从 V1.x 到 V2.0 的核心变化

| 维度 | V1.x | V2.0 |
|---|---|---|
| 目标对象 | 单层 GoalState | 用户目标树 + 每用户目标一个 x-node-model |
| Agent 目标骨架 | 隐式文本理解 | why / what / flow / structure / runtime proof 五维骨架 |
| 目标识别时机 | 主要靠 Curator 后验 | 主 Agent 当前轮确认用户目标 + 下一轮 Curator 审核确认/更新 |
| 执行状态机 | 单层 active/completed 语义 | 用户目标状态 + x-node-model 内部 phase/atomicity/焦点迁移 |
| 下一步判断 | Prompt 提示为主 | `x-node-model -> XNodePolicyProjection -> nextStepType` 软策略投影 |
| proof 语义 | 验证多为附属动作 | runtime-proof 是目标对象的一部分 |
| 错误处理 | 测试失败/判断失败分散存在 | proof failure 进入结构化 signal log |

---

## 5. V2.0 的运行哲学

### 5.1 LLM 才是核心

V2.0 不追求把系统改造成硬流程引擎。

正确理解应是：
- LLM 主导运作流程
- 脚本/状态/文件对象/信号只负责提高稳定性、可靠性与可分析性

### 5.2 上下文 = 信息 + 方法

Generator / subagent 被注入的上下文不是“参数堆砌”，而是：
- 用户目标树
- 当前用户目标对应的 x-node-model
- 当前 proof 与 signal
- 五维方法骨架
- 软策略提示

共同构成的“信息 + 方法”复合上下文。

### 5.2.1 五维运行口径

V2.0 中，x-node-model 的任意节点、以及围绕该节点构造的 prompt / policy / proof，都应统一落在以下五维口径中：

1. **Why**
   - 当前目标为什么存在
   - 它服务于哪个更上层目标
   - 当前动作为什么是此刻必要的一步
2. **What**
   - 当前轮真正要产出的对象是什么
   - 完成定义、验收口径、成功条件是什么
3. **Structure**
   - 当前依赖的 truth source、正式对象、兼容桥、文件/状态边界是什么
   - 哪些对象是主语义承载，哪些只是投影、摘要或 fallback
4. **Flow**
   - 当前对象如何推进到下一状态
   - 它既包含执行流（先做什么、后做什么、是否拆分/回退/补验证），也包含闭环控制流（如何 parse / validate / persist / replay / inject 进入下一轮）
   - 因此 Flow 不是狭义“下一步做什么”，而是“对象如何持续推进并闭环”
5. **Runtime Proof**
   - 当前判断被哪些现实证据支撑
   - 若证据不足、部分成立或冲突，应显式反映为 proof gap / signal，而不是靠自然语言模糊带过

这五维不是附加注释，而是 V2.0 中上下文装配、policy 投影、Curator 后验判断与 replay/restore 闭环的统一设计口径。

### 5.3 输出 = 信息 + 方法 + proof

agent/subagent 的输出不应只有结果摘要，还应包含：
- 结果信息
- 运行方法 / 验证方法
- proof 或自证明路径
- 若 proof 不成立，对应的 signal

---

## 6. 当前实现状态的准确表述

截至 `2026-05-22`，V2.0 主线已完成从“设计口径”到“运行时主链”的第一轮闭合；Improve-certainty / plan-certainty-improvement 已完成 P0–P7 实施收口；Structural Continuity P0–P5 也已完成 identity、GoalRelationDecision、context/method/proof packet、post-node commit 与 before-agent-start 注入闭环。

已正式落地到当前 repo 主链的对象与闭环包括：
- 用户目标树（`UserGoalTreeDocument`）
- x-node-model（`XNodeModelDocument`）
- soft policy projection（`XNodePolicyProjection` / `lastPolicyProjection`）
- runtime-proof object 与 signal（`RuntimeProofRecord` / `RuntimeProofSignal`）
- provisional overlay
- 双层 completion closure

当前运行时更准确的描述不是“V2.0 还没实现”，而是：

- 主消费链已经收口到 object-first：
  - `UserGoalTreeDocument`
  - `XNodeModelDocument`
  - `XNodePolicyProjection`
  - `RuntimeProofRecord / RuntimeProofSignal`
- 当前轮目标识别主入口是 `applyUserGoalProjection`；旧 `draftGoalOp` / `RuntimeProvisionalOverlay` 只保留为 legacy compatibility，不再是新增实现默认路径。
- Curator 后验维护主入口是 `reconciliationOps`；旧 `draftDispositions` 只保留为 legacy parser / artifact 兼容字段。
- Curator 输入 / 输出两侧都已进入 object-first 主链
- `before-agent-start`、restore / replay、`/ptc status`、proof surface 已优先消费 object sidecars
- `grc-goal-view.ts` / `grc-goal-transition.ts` / `grc-goal-state-summary.ts` 及其关键上层消费面（`before-agent-start` goal-state injection、Reflector goalContext）已进一步收口到 object-sidecars-primary；GoalTree / goalState 仅保留 compatibility fallback / bridge 角色
- `nextStepType` 已稳定处于 soft policy 语义，而不是硬调度器
- 双层完成闭环与 proof-first runtime closure 都已通过阶段实现与回归验证落地
- Improve-certainty / plan-certainty-improvement 已完成 P0–P7：policy guidance、Generator contract、context provider、projection patch、runtime proof、用户可感知回复 surface 与回归链接入均已落地
- Structural Continuity 已完成 P0–P5：`userGoalId / xNodeModelId / xNodeId` identity 参数、LLM-owned `GoalRelationDecision`、Context / Method / Proof packets、`XNodeCommit` / `commitLog`、`latestCommits` 注入与 before-agent-start packet surface 均已落地
- curator replay 验证已分层为 smoke / strict companion：`test:curator-replay` 负责 reload/replay 稳定性，`test:curator-replay:strict` 负责 round-2 object-rich artifact、policy/proof/status surface 与 replay 对齐契约；最近一次 strict proof 已在 `deepseek/deepseek-v4-flash` 下通过

与此同时，repo 仍保留有意识的过渡层：
- `GoalTreeDocument`
- `certaintyAssessment`
- `runtimeDraftGoalState`

它们当前的角色是 compatibility bridge / fallback-only / replay-friendly bridge，而不再是新增实现的默认主对象。

因此更准确的判断应是：

> **V2.0 主线（E1–E7）已经闭合；当前系统已从 GoalTree 兼容态跨入 object-first 主链阶段，后续重点不再是“把主线补出来”，而是主线收口、兼容层治理、验证覆盖与长期演进节奏。**

### 6.1 Post-V2 Hardening Backlog（非阻塞）

以下事项不再阻塞 V2.0 主线完成判断；它们属于 post-V2 的硬化、治理与维护 backlog。

| 优先级 | 事项 | 当前判断 | 触发时机 |
|---|---|---|---|
| P1 | compatibility bridge 治理 | 保留 `GoalTreeDocument` / `certaintyAssessment` / `runtimeDraftGoalState` 的现有 adapter / fallback / replay-friendly bridge 职责，冻结新增主语义；不立即删除 | 当新增目标、策略、proof、provisional 相关实现时，必须走 object-first；当 fresh-session / replay / restore 证据充分后再评估 shrink / retirement |
| P1 | 验证分层维护 | 保留 smoke / strict 双层验证口径，不继续无边界扩写测试 | replay / restore / status / proof surface 发生变更时，更新对应 smoke 或 strict 契约 |
| P2 | strict harness 可维护性 | 当前 strict companion 已通过；后续可考虑抽出共享校验器，降低 shell inline Python 维护成本 | 当 smoke / strict 脚本重复逻辑继续增加，或 CI/nightly 需要更清晰错误归因时 |
| P2 | 主线文档真相源维护 | 当前 README / closure note / compatibility governance / strict plan 已能表达主状态 | 当代码事实改变 compatibility bridge 边界、release gate 或 proof surface 时同步更新 |

当前 release / pre-merge 推荐 gate：

```bash
npm --prefix extensions/passto-context run test:regression:strict
```

日常开发可按范围选择：

- Improve-certainty / planning 确定性相关改动：`npm --prefix extensions/passto-context run test:plan-certainty`
- 普通 GRC 改动：`npm --prefix extensions/passto-context run test:grc`
- curator replay / restore / status surface 改动：`npm --prefix extensions/passto-context run test:curator-replay:strict`
- release / merge 前：`npm --prefix extensions/passto-context run test:regression:strict`

---

## 7. 一句话

> V2.0 的目标，不是让系统做更多事，而是让系统围绕“用户目标树 + x-node-model”更稳定地知道：当前真正服务的是哪个用户目标、Agent 内部递归树推进到哪里、下一步该怎么做、以及这些判断有没有 runtime-proof 支撑；而截至 `2026-05-22`，这条主线已经完成第一轮 runtime 闭合，Improve-certainty / plan-certainty-improvement 也已完成 P0–P7 实施收口。
