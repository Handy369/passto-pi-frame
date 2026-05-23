# PasstoContext V2.0 总体架构

> 版本：v2.0 | 状态：Target Architecture | 更新：2026-05-22
>
> 本版取代旧的 `draftGoalOp / provisional anchor / RuntimeProvisionalOverlay` 主口径。
> V2.0 目标态只有归一的 `userGoal` 对象；所谓“draft”不再是弱化目标或旁路目标，而应收敛为 `userGoal.reviewState` 这类状态维度。

---

## 0. 最高设计约束：LLM-primary Context Runtime

PasstoContext 的底层模型不是“脚本状态机驱动 Agent”，而是 **LLM-primary context runtime**：

```text
上下文
= 用户输入
+ passto-context 框架拼接
+ 历史修剪 / 摘要 / 记忆恢复
+ 当前目标 / 状态 / proof / 参数注入

↓

LLM 运行输入
= 运行函数 / 方法论
+ 信息参数

↓

LLM 运行时
= 基于当前上下文推理
+ 按需调用本地 runtime 工具
+ 按需热加载更多信息 / skill / 文档 / 代码 / proof

↓

输出结果信息
= 使用者可感知的关键 runtime proof
+ 新的信息参数
+ 可复用的运行函数 / 方法论片段（用于验收与反馈迭代时，非每轮必需）
```

因此，`script` / `skill` / `tool` / schema / projection API 的定位都是辅助设施：

- 帮助 LLM 更稳定地获得信息参数，例如当前 `userGoalId`、`xNodeModelId`、`xNodeId`、目标路径、proof、artifacts 与历史摘要。
- 帮助 LLM 更容易加载或复用运行函数 / 方法论，例如 goal relation 判断、Improve-certainty、runtime proof 验收、post-node commit。
- 帮助运行过程提高确定性、执行效率与可靠性，例如持久化、回读验证、完整性检查、warning/signal 与恢复。
- 不替代 LLM 做语义目标裁决；找不到状态时不得静默创建 root goal；schema 校验或脚本建议不得覆盖用户输入与 LLM 明确判断。

工程实现中的 `userGoalTree`、`xNodeModel`、`GoalRelationDecision`、context packet、method packet、proof packet、post-node commit 都必须服务于这个约束：**给 LLM 提供稳定信息参数、清晰运行函数与可验收 proof 回路，而不是把脚本升级为主导语义的硬调度器。**

---

## 1. 核心结论

V2.0 的主链路是：

```text
用户输入
  ↓
主 Generator 第一动作：解释当前输入并更新 userGoalTree
  ↓
同步创建 / 复用 / patch 对应 xNodeModel
  ↓
Generator 围绕 currentFocusXNode 执行
  ↓
执行过程中持续细化 xNodeModel 状态机
  ↓
agent_end 后 Curator 异步复核和维护 userGoalTree / xNodeModel
```

关键原则：

1. **用户输入是真相源**：Generator 和 Curator 都只是对用户输入与执行证据的不同阶段解释快照。
2. **userGoalTree 是唯一用户目标对象层**：不存在 `draftGoalOp` 这种弱化版用户目标。
3. **reviewState 不是执行权**：`generator_projected / curator_reviewed / user_confirmed` 只表达解释/复核阶段，不表达是否可执行。
4. **任何 userGoal 都可以被更新**：无论处于哪个 reviewState，只要后续用户输入改变目标含义，都可以 revise / rollback / migrate / split / merge / reopen / complete。
5. **xNodeModel 是 agent 的实际工作对象**：它是对 userGoal 的拆解、细化解释与执行状态记录，是运行中持续生长的状态机，而不是一次性完整生成的静态计划树。
6. **xNodeModel 必须从属于 userGoal**：xNodeModel 是某个 userGoal 的 agent 执行分解，必须稳定指向一个 `userGoalId`，且 userGoal 应通过 `xNodeModelId` 指向对应模型；不存在脱离 userGoal 独立存在的 xNodeModel。
7. **单轮只有一个焦点 userGoal**：同一时点可以存在多个用户目标，但一个 agent round 只聚焦一个 focus userGoal；其他未完成目标处于 sleeping / dormant 状态，只有焦点完成、用户明确切换或 LLM 明确判断需要迁移时才转移焦点。
8. **新输入不等于新目标**：只有当用户输入产生新的 userGoal（root / sibling / child）时才创建新的 xNodeModel；补充、纠偏、参数输入、继续执行或验收反馈应复用并 patch 当前 userGoal 绑定的 xNodeModel。
9. **Curator 不阻塞主执行**：Curator 是异步延迟复核/维护机制，不是 before_agent_start 的前置目标识别器。

---

## 2. 对象层总览

V2.0 稳定对象层只有两类主对象：

```text
UserGoalTreeDocument
  └─ UserGoalNode
       └─ xNodeModelId
            ↓
XNodeModelDocument
  └─ XNode[]
```

### 2.1 UserGoalTreeDocument

用户目标树回答：

- 用户当前想完成什么
- 用户目标之间的层级、并列、迁移、合并、拆分关系是什么
- 当前焦点 userGoal 是哪个
- 每个 userGoal 绑定哪个 xNodeModel
- userGoal 当前执行生命周期与复核状态是什么

它不负责细粒度执行拆解；细粒度执行由 xNodeModel 承担。

### 2.2 XNodeModelDocument

xNodeModel 回答：

- Agent 如何理解、拆解、执行和验证某个 userGoal
- 当前执行焦点 xNode 是哪个
- 当前 xNode 的 why / what / flow / structure / runtimeProof 五维状态是什么
- 是否需要生成子 xNode、执行原子工作、运行测试、请求验收、向父层回归
- 当前 proof / proof signal 是否足以支持完成判断

正式定义：

> xNodeModel 是对 userGoal 的拆解和细化，是 agent 的实际工作对象；它记录 agent 对 userGoal 的细化解释、执行状态、proof 状态与回归路径。xNodeModel 是 agent 的运行时状态机。

---

## 3. UserGoalNode 状态模型

旧模型把 `status` 简化为 `identified / planning / executing / completed`，不足以表达“执行生命周期”和“解释复核阶段”的差异。

V2.0 目标态应拆为三组状态：

### 3.1 executionState：执行生命周期

```ts
type UserGoalExecutionState =
  | "identified"
  | "planning"
  | "executing"
  | "testing"
  | "pending_acceptance"
  | "completed";
```

含义：这个 userGoal 在作业流中的阶段。

### 3.2 reviewState：解释 / 复核阶段

```ts
type UserGoalReviewState =
  | "generator_projected"
  | "curator_reviewed"
  | "user_confirmed";
```

含义：该 userGoal 当前版本来自哪个解释阶段。

- `generator_projected`：主 Generator 在当前轮同步解释用户输入并投影出来；它是 effective userGoal，必须可执行。
- `curator_reviewed`：Curator 在 agent_end 后基于完整轮次轨迹异步复核过。
- `user_confirmed`：用户显式确认过；后续仍可因新的用户输入而变更，但需要更强证据或显式新输入。

注意：

```text
reviewState 不是执行状态。
reviewState 不决定是否执行。
reviewState 不表达是否可修正。
```

任何 reviewState 的 userGoal 都可以因后续用户输入被更新。

### 3.3 relationState：目标关系状态

```ts
type UserGoalRelationState =
  | "active"
  | "revised"
  | "superseded"
  | "merged"
  | "split"
  | "migrated"
  | "discarded"
  | "reopened";
```

含义：该 userGoal 与其他目标或后续目标版本的关系。

### 3.4 建议目标形态

```ts
interface UserGoalNodeV2 {
  id: string;
  parentId: string | null;
  assertion: string;

  executionState: UserGoalExecutionState;
  reviewState: UserGoalReviewState;
  relationState: UserGoalRelationState;

  xNodeModelId: string | null;

  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;

  source: {
    createdBy: "generator" | "curator" | "restore" | "migration";
    lastUpdatedBy: "generator" | "curator" | "user" | "system";
    sourceUserTurnId?: string;
    sourceAgentRound?: number;
    evidenceEntryIds?: string[];
  };
}
```

兼容迁移期可以保留旧字段：

```ts
status: "identified" | "planning" | "executing" | "completed";
```

但新语义应按 `executionState` 理解。

---

## 4. 废弃 draftGoalOp / provisional anchor 旁路

### 4.1 被废弃的旧口径

以下口径不再作为 V2.0 目标态：

```text
draftGoalOp 是当前轮临时目标
provisional anchor 是 userGoal 之外的临时对象
RuntimeProvisionalOverlay 是新目标主对象
draft 目标等 Curator confirm 后才正式执行
```

这些口径的问题是：

- 把当前用户输入放入一条弱化路径
- 当前轮 Generator 仍然 fallback 到普通上下文执行
- userGoalTree 与 xNodeModel 不能在本轮成为主执行对象
- 每轮都从用户新输入开始，导致新信息永远慢一拍进入 V2.0 主流程

### 4.2 新口径

替代口径是：

```text
GeneratorProjectionOp 直接作用于 userGoalTree 和 xNodeModel。
```

也就是说，主 LLM 第一动作不是输出 `draftGoalOp`，而是显性生成并提交：

```text
UserGoalProjectionOps
XNodeModelOps
focus update
```

这些操作的结果直接持久化到：

```text
UserGoalTreeDocument
XNodeModelDocument[]
```

---

## 5. Generator-first 投影机制

### 5.1 为什么不在 before_agent_start 做语义识别

`before_agent_start` 如果额外运行 LLM projector，会产生阻塞：

```text
用户输入
  ↓
before_agent_start 等目标识别
  ↓
主 Generator 才能开始
```

目标识别本来就是主 LLM 理解用户输入的第一步；把它拆成前置 LLM 只会增加延迟、引入双解释器竞争，并放大一致性问题。

因此 V2.0 改为：

```text
before_agent_start 只注入状态和协议；
主 Generator 的第一执行动作是识别并更新 userGoal。
```

### 5.2 Generator 每轮动作顺序

```text
1. 读取当前用户输入、上一轮 userGoalTree、当前 xNodeModel、policy/proof/signal
2. 判断当前输入对 userGoalTree 的影响：
   - create
   - update
   - switch_focus
   - complete
   - reopen
   - migrate
   - split
   - merge
3. 生成 UserGoalProjectionOps
4. 同步创建 / 复用 / patch 对应 xNodeModel
5. 设置 currentFocusUserGoalId / currentFocusXNodeId
6. 围绕 currentFocusXNode 执行用户请求
7. 执行中持续更新 xNodeModel 状态机
8. 输出结果与 proof / verification method
```

### 5.3 推荐工具接口

为了让“本轮直接持久化”真实成立，推荐提供一个确定性工具：

```ts
interface ApplyUserGoalProjectionInput {
  source: "generator";
  sourceUserTurnId?: string;
  sourceAgentRound: number;
  idempotencyKey: string;

  userGoalOps: UserGoalProjectionOp[];
  xNodeModelOps: XNodeModelOp[];

  focus?: {
    currentFocusUserGoalId?: string | null;
    currentFocusXNodeId?: string | null;
  };
}
```

工具职责：

```text
不做语义判断；只做 schema 校验、引用完整性校验、幂等写入和持久化。
```

语义判断由主 Generator 完成。

---

## 6. UserGoalProjectionOp

`UserGoalProjectionOp` 是主 Generator 对统一 userGoalTree 的同步投影操作。

```ts
type UserGoalProjectionOp =
  | {
      action: "create_user_goal";
      goal: {
        assertion: string;
        parentId: string | null;
        executionState?: UserGoalExecutionState;
        reviewState: "generator_projected";
        relationState?: "active";
      };
      reason: string;
    }
  | {
      action: "update_user_goal";
      targetUserGoalId: string;
      patch: Partial<UserGoalNodeV2>;
      reason: string;
    }
  | {
      action: "switch_focus";
      targetUserGoalId: string;
      reason: string;
    }
  | {
      action: "complete_user_goal";
      targetUserGoalId: string;
      evidence: string;
      reason: string;
    }
  | {
      action: "reopen_user_goal";
      targetUserGoalId: string;
      reason: string;
    }
  | {
      action: "migrate_user_goal";
      fromUserGoalId: string;
      toGoalPatch: Partial<UserGoalNodeV2>;
      reason: string;
    }
  | {
      action: "split_user_goal";
      sourceUserGoalId: string;
      newGoals: Array<{ assertion: string; parentId: string | null }>;
      reason: string;
    }
  | {
      action: "merge_user_goals";
      sourceUserGoalIds: string[];
      targetGoal: { assertion: string; parentId: string | null };
      reason: string;
    };
```

重要约束：

```text
操作对象永远是 userGoal。
不存在 draft 弱化版目标。
```

---

## 7. xNodeModel 作为 agent 状态机

### 7.1 新 userGoal：只创建骨架

当 Generator 创建新 userGoal 时，不需要一次性完整拆解整棵 agent 递归目标树。

只需要创建 xNodeModel 骨架：

```text
XNodeModelDocument
  - userGoalId
  - currentFocusXNodeId
  - rootXNodeIds
  - root XNode
  - 初始 why / what / flow / structure / runtimeProof
  - 初始 policyProjection
```

最小骨架示例：

```ts
interface XNodeModelSkeleton {
  version: 1;
  userGoalId: string;
  currentFocusXNodeId: string;
  rootXNodeIds: string[];
  nodes: [XNode];
  latestPolicyProjection?: XNodePolicyProjection | null;
  latestRuntimeProof?: RuntimeProofRecord | null;
  latestProofSignals?: RuntimeProofSignal[];
}
```

### 7.2 既有 userGoal：复用并 patch

如果当前用户输入是对既有目标的补充、纠正或推进：

```text
复用原 xNodeModel
  ↓
patch root xNode / current focus xNode / policy / proof
  ↓
必要时生成或废弃局部子节点
  ↓
继续执行当前 focus xNode
```

不能因为用户补充输入就重建整棵 xNodeModel。

### 7.3 xNodeModel 的生长阶段

xNodeModel 随 agent 实际执行逐步生长：

```text
1. skeleton：新 userGoal 只建立 root xNode
2. refinement：补 why / what / flow / structure / runtimeProof
3. decomposition：必要时生成 children
4. execution：执行当前 atomic xNode
5. proof：记录测试、运行态、人类验收或自证明
6. regression：子节点完成后回归父节点
7. completion：modelComplete 后推动 userGoal 进入 completed / pending_acceptance
```

这样可以避免：

- 过度规划
- 错误拆树
- 状态树与实际执行脱节
- 每轮重建导致历史执行证据丢失

---

## 8. XNodePolicyProjection

`XNodePolicyProjection` 是从当前 xNodeModel 状态提炼出的软策略对象。

它包含：

- why / what / flow / structure / runtimeProof 五维闭合状态
- key gaps
- nextStepType
- confidence
- guidance

典型 `nextStepType`：

```ts
type XNodeNextStepType =
  | "plan_repair"
  | "generate_children"
  | "execute_atomic_work"
  | "run_tests"
  | "seek_acceptance"
  | "upward_regression";
```

它的职责是指导 Generator，而不是硬调度 Generator。

---

## 9. RuntimeProofRecord / RuntimeProofSignal

proof 是 xNodeModel 状态的一部分。

每个关键执行结果都应尽量留下：

- resultSummary
- proofMode
- proofStatus
- evidence
- verificationMethod

当 proof 不足时，应形成 signal：

- `runtime-proof-missing`
- `runtime-proof-partial`
- `runtime-proof-failed`
- `runtime-proof-conflicted`

proof signal 反向影响当前 xNode 的 policyProjection，而不是直接替代 Generator 判断。

---

## 10. 事件时序

### 10.1 session_start

职责：

- 加载配置
- 恢复 GRCState / SummaryCache / artifact
- 恢复 lastUserGoalTree / lastXNodeModels
- 恢复当前 focus、proof、policyProjection
- 冻结或兼容读取旧 GoalTree / draft 相关 bridge

### 10.2 before_agent_start

职责降级为：

```text
状态注入 + 协议注入
```

它应该做：

1. 注入上一轮 effective userGoalTree
2. 注入当前 focus userGoal 对应的 xNodeModel
3. 注入 policyProjection / proof / proofSignals
4. 注入 SummaryCache / 历史检索指导 / Reflector Advice / Principles
5. 注入 Generator-first 协议：每轮第一步必须投影并更新 userGoal / xNodeModel

它不应该做：

```text
额外 LLM 目标识别
额外 LLM 目标拆解
阻塞主 Generator 的 semantic projector
```

### 10.3 Generator 执行

职责：

1. 第一动作识别当前用户输入对 userGoalTree 的影响
2. 生成并提交 UserGoalProjectionOps
3. 创建 xNodeModel skeleton 或 patch 既有 xNodeModel
4. 围绕 currentFocusXNode 执行
5. 执行过程中持续更新 xNodeModel 状态机
6. 记录 proof / signal / completion

### 10.4 agent_end

职责：

- finish agent round
- 持久化 Generator 已提交的 userGoalTree / xNodeModel 更新
- 启动 Curator 异步复核
- 启动 Reflector 异步审计

### 10.5 Curator 异步复核

Curator 读取：

- 当前轮用户输入
- assistant 输出
- 工具调用证据
- Generator 提交的 userGoal / xNode 更新
- 上一轮 userGoalTree / xNodeModels

输出 reconciliation：

- mark_reviewed
- revise_user_goal
- supersede_user_goal
- discard_user_goal
- merge_user_goals
- split_user_goal
- advance_execution_state
- update_xnode_model
- adjust_focus

Curator 可以更新任何 reviewState 的 userGoal；不是只有 `generator_projected` 状态才可修正。

---

## 11. 职责边界

### 11.1 Generator

| 负责 | 不负责 |
|---|---|
| 当前轮同步解释用户输入 | 作为唯一最终真相源 |
| 直接更新 userGoalTree | 异步长期一致性审计 |
| 创建/复用/patch xNodeModel | 一次性完整生成所有递归目标树 |
| 推进 xNodeModel 状态机 | 把 policyProjection 当硬命令 |
| 执行当前 focus xNode | 替代 Curator 做后验复核 |
| 记录 proof / method | 替代 Reflector 做偏移审计 |

### 11.2 Curator

| 负责 | 不负责 |
|---|---|
| 异步复核 Generator 的目标解释 | 阻塞主回复 |
| 维护 userGoalTree 长期一致性 | 成为用户输入之外的真相源 |
| 对任何 userGoal 做 revise / migrate / merge / split / complete | 只处理 draft / provisional 目标 |
| 对 xNodeModel 提供后验校准 | 每轮重建整棵 xNodeModel |
| 生成/校准 policyProjection 与 proof signal | 代替主 Generator 执行当前工作 |

### 11.3 Reflector

| 负责 | 不负责 |
|---|---|
| 当前轮目标对齐审计 | 写 userGoalTree 主状态 |
| 偏移归因 | 写 xNodeModel 主状态 |
| 原则综合 | 生成 policyProjection |
| 能力资产候选 | 代替 Curator reconciliation |

---

## 12. 完成语义

### 12.1 xNodeModel 完成

表示：

- 某个 userGoal 对应的 agent 状态机已经完成当前可完成的执行闭环
- 所有必要子 xNode 已完成或被明确放弃/迁移
- proof 支持完成判断

字段：

```text
XNodeModelDocument.completion
  - localComplete
  - modelComplete
  - completedNodeCount
  - openNodeCount
  - nextOpenXNodeId
```

### 12.2 userGoal 完成

表示：

- 用户目标本身达到完成或待验收状态
- 对应 xNodeModel 的完成结果已经回归到 userGoalTree

字段：

```text
UserGoalTreeDocument.completion
  - treeComplete
  - completedUserGoalIds
  - openUserGoalIds
  - nextFocusUserGoalId
```

链路：

```text
xNodeModel.modelComplete
  ↓
UserGoal.executionState = completed / pending_acceptance
  ↓
UserGoalTree.completion 更新
  ↓
Generator 判断是否 upward regression / seek acceptance / 切换下一目标
```

---

## 13. 兼容与迁移

当前 repo 里仍可能存在：

- `GoalTreeDocument`
- `certaintyAssessment`
- `draftGoalOp`
- `DraftDisposition`
- `runtimeDraftGoalState`
- `RuntimeProvisionalOverlay`

V2.0 目标态对这些对象的定位是：

```text
legacy compatibility bridge / replay bridge / migration artifact
```

约束：

1. 不再把它们作为新设计的主对象。
2. 不再新增依赖 `draftGoalOp` 的主链能力。
3. 不再把 provisional overlay 描述为 V2.0 正式用户目标层。
4. 新实现应围绕 `UserGoalTreeDocument + XNodeModelDocument + UserGoalProjectionOps`。
5. 旧对象只允许服务 restore / replay / fallback / migration，且应逐步 shrink。

迁移阶段建议：

```text
Phase A：UserGoalNode 增加 reviewState / relationState / source
Phase B：新增 applyUserGoalProjection 工具，支持 Generator 同步提交
Phase C：Generator prompt 改为第一步输出/提交 UserGoalProjectionOps
Phase D：xNodeModel skeleton / patch / incremental state-machine 落地
Phase E：Curator 从 draft disposition 改为通用 reconciliation ops
Phase F：冻结 draftGoalOp / RuntimeProvisionalOverlay 主链入口，保留兼容读取
Phase G：replay / restore 证据充分后删除或收窄 legacy bridge
```

---

## 14. 最终一句话

> V2.0 的总体架构核心，是让主 Generator 在每轮第一步把最新用户输入直接投影并持久化到统一的 userGoalTree，同时创建或更新该 userGoal 对应的 xNodeModel 状态机；随后围绕 currentFocusXNode 执行。Curator 只做异步复核和长期一致性维护。不存在 draft 弱化版目标，也不存在 userGoal 之外的 provisional 目标主链。
