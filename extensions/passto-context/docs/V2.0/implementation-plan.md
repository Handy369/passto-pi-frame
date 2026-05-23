# PasstoContext V2.0-R1 改造实施方案：统一 userGoal + xNodeModel 状态机

> 版本：v2.0-R1 | 状态：Implementation Plan + Structural Continuity Closed（P0–P5） | 更新：2026-05-22  
> 上游架构：`architecture-v2.0.md`  
> 目标：把当前 repo 中已经存在的 `UserGoalTreeDocument + XNodeModelDocument` object-first 实现，继续迭代为新的 Generator-first 统一 userGoal 机制：废弃 `draftGoalOp / provisional anchor` 主链，统一用 `reviewState` 表达复核阶段，并把 xNodeModel 固定为 agent 运行时状态机。Structural Continuity P0–P5 已完成落地，当前唯一主状态是收口维护与回归守护。

---

## 0. 最高设计约束：LLM-primary Context Runtime

本实施计划的最高约束来自 `architecture-v2.0.md`：PasstoContext 不以脚本状态机为中心，而以 LLM 的单轮运行质量与跨轮连续性为中心。

```text
上下文 = 用户输入 + passto-context 框架拼接 + 历史修剪 / 摘要 / 记忆恢复 + 当前目标 / 状态 / proof / 参数注入
LLM 运行输入 = 运行函数 / 方法论 + 信息参数
LLM 运行时 = 基于上下文推理 + 按需调用本地 runtime 工具 + 按需热加载更多信息 / skill / 文档 / 代码 / proof
输出结果 = 用户可感知 runtime proof + 新的信息参数 + 可复用运行函数 / 方法论片段（非每轮必需）
```

工程含义：

- `userGoalId` / `xNodeModelId` / `xNodeId` 是给 LLM 的稳定信息参数，不是让脚本替代 LLM 语义判断的控制柄。
- `GoalRelationDecision` 是 LLM-owned 的显式判断结果；脚本只能提供候选、参数、完整性 warning 与写入接口。
- `xNodeModel` 必须绑定且指向一个 `userGoalId`，因为它是该 userGoal 的 agent 执行分解；不存在脱离 userGoal 独立存在的 xNodeModel。
- 同一 agent round 只聚焦一个 focus userGoal；其他未完成目标是 sleeping / dormant，而不是消失或完成。
- 用户输入的新内容不等于新目标；只有产生新的 root / sibling / child userGoal 时才创建新的 xNodeModel，补充、纠偏、参数输入、继续执行或验收反馈应复用并 patch 既有 xNodeModel。
- post-node commit 是把本轮运行结果变成下一轮可用的信息参数与 proof；写回什么由 LLM 基于实际结果判断，脚本只负责保存、校验、展示与恢复。

---

## 1. 当前实现基线

当前代码已经完成第一轮 object-first 主线，但仍停留在“provisional overlay 主链 + draft 兼容桥”口径上。

### 已有基础

- `types.ts` 已有：
  - `UserGoalTreeDocument`
  - `UserGoalNode`
  - `XNodeModelDocument`
  - `XNodePolicyProjection`
  - `RuntimeProofRecord / RuntimeProofSignal`
- `grc-user-goal-tree.ts` 可从旧 `GoalState` / `GoalTree` 派生 user goal tree。
- `grc-x-node-model.ts` 可从旧 goal tree 派生 xNodeModel，并补 policy / proof / completion。
- `grc-state.ts#setCuratorObjectSidecars()` 已能持久化 object sidecars。
- `before-agent-start-injection.ts` 已优先消费 object sidecars。
- completion / proof / status / restore / replay 均已有覆盖。

### 主要偏差

| 领域 | 当前实现 | 新架构要求 |
|---|---|---|
| userGoal 状态 | `status: identified/planning/executing/completed` | 拆成 `executionState + reviewState + relationState`，旧 `status` 仅兼容 |
| 当前轮新目标 | `draftGoalOp` + `runtimeDraftGoalState` + `RuntimeProvisionalOverlay` | Generator 第一动作直接写 `UserGoalProjectionOp` 到 userGoalTree / xNodeModels |
| xNodeModel 创建 | 多从 GoalTree / draft overlay 派生 | 新 userGoal 只创建 skeleton；既有 userGoal 复用并 patch |
| before_agent_start | 仍可能注入 draft/provisional 诊断与兼容状态 | 只注入上一轮状态与 Generator-first 协议，不做前置语义识别 |
| Curator | 仍有 `draftDispositions` / provisional subtree 裁决语义 | 改为通用 reconciliation ops，可修正任何 reviewState 的 userGoal |
| 测试链 | `test:grc` 仍包含 `test:draft-goal` | draft 测试降为 legacy，新增 projection 主链测试 |

---

## 2. 目标态

### 2.1 主链

```text
用户输入
  ↓
Generator 第一动作：判断当前输入对 userGoalTree 的影响
  ↓
调用/提交 UserGoalProjectionOps + XNodeModelOps
  ↓
直接持久化 lastUserGoalTree + lastXNodeModels
  ↓
围绕 currentFocusXNode 执行
  ↓
执行中持续 patch xNodeModel
  ↓
agent_end 后 Curator 异步 reconciliation
```

### 2.2 正式对象

```text
UserGoalTreeDocument
  └─ UserGoalNode
       ├─ executionState
       ├─ reviewState
       ├─ relationState
       ├─ status                 # 兼容派生字段，迁移期保留
       └─ xNodeModelId
            ↓
XNodeModelDocument
  └─ XNode[]                     # agent 状态机节点
```

### 2.3 非目标

- 不把主 LLM 改成硬 scheduler。
- 不要求 Generator 一次性拆完整递归树。
- 不在第一阶段暴力删除 restore / replay 仍依赖的 legacy 类型。
- 不把 Curator 改成 before_agent_start 的阻塞目标识别器。

---

## 3. 分阶段改造计划

## Phase R1-0：基线冻结与回归保护

### 目标

在改造前锁定当前行为，避免误伤 restore / replay / proof / status。

### 任务

1. 运行当前基线：

```bash
npm --prefix extensions/passto-context run test:grc
npm --prefix extensions/passto-context run test:curator-replay:strict
```

2. 记录当前会失败/通过的 legacy draft 测试边界。
3. 标记以下测试为后续迁移参考：
   - `tests/draft-goal-runtime.test.ts`
   - `tests/grc-provisional-overlay.test.ts`
   - `tests/provisional-proof-consistency.test.ts`
   - `tests/generator-charter-prompt.test.ts`
   - `tests/before-agent-start-injection.test.ts`

### 验收

- 有明确 baseline test result。
- 后续改造失败时能区分：是新架构预期变更，还是无意回归。

---

## Phase R1-1：UserGoalNodeV2 类型与兼容归一

### 目标

先让对象模型能表达新架构，不改变主流程。

### 涉及文件

- `types.ts`
- `grc-user-goal-tree.ts`
- `grc-curator-parser.ts`
- `grc-curator-normalizer.ts`
- `grc-state.ts`
- `grc-completion-closure.ts`
- `tests/user-goal-tree-derivation.test.ts`
- `tests/grc-completion-closure.test.ts`

### 任务

1. 在 `types.ts` 增加：

```ts
export type UserGoalExecutionState =
  | "identified"
  | "planning"
  | "executing"
  | "testing"
  | "pending_acceptance"
  | "completed";

export type UserGoalReviewState =
  | "generator_projected"
  | "curator_reviewed"
  | "user_confirmed";

export type UserGoalRelationState =
  | "active"
  | "revised"
  | "superseded"
  | "merged"
  | "split"
  | "migrated"
  | "discarded"
  | "reopened";
```

2. 扩展 `UserGoalNode`：

```ts
interface UserGoalNode {
  status: "identified" | "planning" | "executing" | "completed"; // legacy projection
  executionState?: UserGoalExecutionState;
  reviewState?: UserGoalReviewState;
  relationState?: UserGoalRelationState;
  source?: UserGoalSource;
}
```

3. 增加 normalization helper：

```ts
normalizeUserGoalNode(goal, defaults): UserGoalNode
mapExecutionStateToLegacyStatus(executionState): UserGoalNode["status"]
inferExecutionStateFromLegacyStatus(status): UserGoalExecutionState
```

4. 所有派生路径补默认值：

| 来源 | 默认 `reviewState` | 默认 `relationState` | 默认 `source.createdBy` |
|---|---|---|---|
| GoalState / GoalTree 派生 | `curator_reviewed` | `active` | `migration` |
| Curator payload | payload 优先，否则 `curator_reviewed` | payload 优先，否则 `active` | `curator` |
| restore legacy artifact | `curator_reviewed` | `active` | `restore` |

5. completion 逻辑改为优先读写 `executionState`，同时回填 legacy `status`。

### 验收

```bash
npm --prefix extensions/passto-context run test:derivation
npm --prefix extensions/passto-context run test:curator
npm --prefix extensions/passto-context run test:restore
```

---

## Phase R1-2：Projection 核心库，不先接工具

### 目标

实现纯函数级的 Generator-first 投影能力，先不接 Pi tool，降低风险。

### 新增文件

- `grc-user-goal-projection.ts`
- `tests/user-goal-projection.test.ts`

### 核心类型

```ts
export type UserGoalProjectionOp =
  | CreateUserGoalOp
  | UpdateUserGoalOp
  | SwitchFocusUserGoalOp
  | CompleteUserGoalOp
  | ReopenUserGoalOp
  | MigrateUserGoalOp
  | SplitUserGoalOp
  | MergeUserGoalsOp;

export type XNodeModelOp =
  | CreateXNodeModelSkeletonOp
  | PatchXNodeModelOp
  | PatchXNodeOp
  | AddXNodeOp
  | CompleteXNodeOp
  | SwitchFocusXNodeOp;
```

### 核心函数

```ts
applyUserGoalProjectionToObjectState(input: {
  current: {
    userGoalTree: UserGoalTreeDocument | null;
    xNodeModels: XNodeModelDocument[];
  };
  userGoalOps: UserGoalProjectionOp[];
  xNodeModelOps?: XNodeModelOp[];
  focus?: {
    currentFocusUserGoalId?: string | null;
    currentFocusXNodeId?: string | null;
  };
  source: "generator" | "curator" | "restore" | "migration";
  sourceAgentRound: number;
  sourceUserTurnId?: string;
  nowIso: string;
  idempotencyKey?: string;
}): {
  userGoalTree: UserGoalTreeDocument;
  xNodeModels: XNodeModelDocument[];
  warnings: string[];
}
```

### 行为要求

1. `create_user_goal`：
   - 创建 `reviewState="generator_projected"`
   - `executionState` 默认 `identified` 或 `planning`
   - `relationState="active"`
   - 自动分配 `xNodeModelId`
   - 自动创建 xNodeModel skeleton，除非同一批 ops 已显式提供

2. `update_user_goal`：
   - 可更新任何 reviewState 的 userGoal
   - 更新后 `lastTouchedRound` 与 `source.lastUpdatedBy`
   - 不自动重建 xNodeModel，只 patch root/current xNode assertion 或 facets

3. `switch_focus`：
   - 切换 `currentFocusUserGoalId`
   - 若目标没有 xNodeModel，则创建 skeleton

4. `complete_user_goal`：
   - 设置 `executionState="completed"`
   - 同步 legacy `status="completed"`
   - 可选择把对应 xNodeModel open 节点完成或保留 pending_acceptance

5. `migrate/split/merge`：
   - 不删除旧目标，优先更新 `relationState`
   - 新目标绑定新 xNodeModel skeleton
   - 可在 xNodeModel 中保留迁移证据

6. 引用完整性：
   - `currentFocusUserGoalId` 必须存在或为 null
   - 每个 active/open userGoal 应有 xNodeModel
   - `currentFocusXNodeId` 必须属于当前 xNodeModel

### 验收

```bash
node --experimental-strip-types --test extensions/passto-context/tests/user-goal-projection.test.ts
npm --prefix extensions/passto-context run test:derivation
```

---

## Phase R1-3：xNodeModel skeleton / incremental patch 正式化

### 目标

把 xNodeModel 固定为“agent 状态机”，而不是 GoalTree 派生树或 draft subtree。

### 涉及文件

- `grc-x-node-model.ts`
- `grc-x-node-policy.ts`
- `grc-runtime-proof.ts`
- `grc-completion-closure.ts`
- `tests/x-node-model-derivation.test.ts`
- `tests/user-goal-projection.test.ts`

### 任务

1. 增加：

```ts
buildXNodeModelSkeleton(input: {
  userGoal: UserGoalNode;
  agentRound: number;
  nowIso: string;
  focus?: boolean;
}): XNodeModelDocument
```

2. 增加：

```ts
patchXNodeModelIncrementally(model, op): XNodeModelDocument
```

3. skeleton 默认 root xNode：

```text
id = userGoal.id 或 stable xnode id
parentId = null
assertion = userGoal.assertion
status = active
atomicity = undecided
phase = plan
why/what/flow/structure/runtimeProof = partial/open 初始 facet
```

4. policy/proof/completion enrichment 保持自动派生，不要求 Generator 手写全量字段。

### 验收

- 创建新 userGoal 时只生成单 root xNode。
- patch 既有 userGoal 不会重建整个 xNodeModel。
- policyProjection 可从 skeleton 派生出合理 `nextStepType`。

```bash
npm --prefix extensions/passto-context run test:derivation
node --experimental-strip-types --test extensions/passto-context/tests/user-goal-projection.test.ts
```

---

## Phase R1-4：接入 `applyUserGoalProjection` 工具

### 目标

让 Generator 能在当前轮第一动作直接持久化 userGoalTree + xNodeModel。

### 涉及文件

- `index.ts`
- `types.ts`
- `grc-state.ts`
- `grc-user-goal-projection.ts`
- `tests/apply-user-goal-projection-tool.test.ts`（新增）
- `tests/before-agent-start-event.test.ts`
- `tests/index-restore-replay.test.ts`

### 工具形态

```ts
pi.registerTool({
  name: "applyUserGoalProjection",
  label: "Apply User Goal Projection",
  description: "Persist Generator's first-step projection into UserGoalTree and XNodeModel sidecars.",
  parameters: Type.Object({
    userGoalOps: Type.Array(...),
    xNodeModelOps: Type.Optional(Type.Array(...)),
    focus: Type.Optional(...),
    idempotencyKey: Type.String(...),
  }),
  execute(...) { ... }
});
```

### 执行逻辑

1. 读取当前 `getEffectiveObjectState(grcState)`。
2. 调用 `applyUserGoalProjectionToObjectState()`。
3. 调用 `setCuratorObjectSidecars()` 更新内存状态。
4. 写入 branch artifact / runtime cache，确保 session 恢复可见。
5. 返回简洁结果：

```json
{
  "ok": true,
  "currentFocusUserGoalId": "...",
  "currentFocusXNodeId": "...",
  "createdUserGoalIds": [],
  "updatedUserGoalIds": [],
  "warnings": []
}
```

### 关键约束

- 工具不做语义判断。
- 工具只做 schema / 引用 / 幂等 / 持久化。
- 若 projection 失败，应返回结构化错误，不部分写入。
- 若重复 idempotencyKey，应返回已应用结果。

### 验收

- 工具调用后，同一轮后续 `getEffectiveObjectState()` 能读到新 userGoal / xNodeModel。
- branch restore 后仍可读到。

```bash
node --experimental-strip-types --test extensions/passto-context/tests/apply-user-goal-projection-tool.test.ts
npm --prefix extensions/passto-context run test:restore
```

---

## Phase R1-5：Generator prompt / contract 改为 Projection-first

### 目标

让主 LLM 的协议从“可输出 draftGoalOp”改成“第一步提交 userGoal projection”。

### 涉及文件

- `references/generator-contract.md`
- `grc-generator-contract.ts`
- `grc-prompts.ts`
- `before-agent-start-injection.ts`
- `tests/generator-charter-prompt.test.ts`
- `tests/before-agent-start-injection.test.ts`

### 任务

1. `generator-contract.md` 中把 Instant Goal Recognition 改写为：
   - 先判断当前输入对 `userGoalTree` 的影响。
   - 若是新目标，调用 `applyUserGoalProjection` 创建 `userGoal + xNodeModel skeleton`。
   - 若是既有目标更新，调用 `applyUserGoalProjection` patch 既有对象。
   - 然后围绕 `currentFocusXNode` 执行。

2. `buildGeneratorCharterPrompt()` 删除 draftGoal runtime 协议。

3. `grc.prompts` 不再出现：
   - `draftGoalOp`
   - `provisional goal interpretation`
   - `若无需创建 draft`

4. before_agent_start 诊断不再标记 `:provisional` / `:goal-state-bridge` 为主链提示；legacy 可放入 debug-only。

### 验收

```bash
npm --prefix extensions/passto-context run test:reflector
npm --prefix extensions/passto-context run test:context-manager
```

断言重点：

- prompt 中出现 `applyUserGoalProjection` / `UserGoalProjectionOp`。
- prompt 中不再鼓励输出 `draftGoalOp`。

---

## Phase R1-6：废弃 RuntimeProvisionalOverlay 主消费路径

### 目标

让 effective object state 不再由 provisional overlay 覆盖，而由已经持久化的 object sidecars 直接表示。

### 涉及文件

- `grc-provisional-overlay.ts`
- `grc-state.ts`
- `before-agent-start-injection.ts`
- `grc-policy-surface.ts`
- `ptc-status.ts`
- `index.ts`
- `tests/grc-provisional-overlay.test.ts`
- `tests/provisional-proof-consistency.test.ts`
- `tests/before-agent-start-injection.test.ts`

### 任务

1. 修改 `getEffectiveObjectStateFromGRCState()`：

```text
默认只返回 lastUserGoalTree + lastXNodeModels。
RuntimeProvisionalOverlay 不再参与主链覆盖。
```

2. `RuntimeProvisionalOverlay` 保留为 legacy restore/replay artifact 类型，但不再是 current effective state。

3. 停用 `maybeApplyDraftGoalOpFromBranch()` 主链调用。

4. `draftGoalEnabled` 配置冻结：
   - 默认 false 保持。
   - 新逻辑不再依赖它。
   - 后续可迁移为 `legacyDraftGoalEnabled`。

5. 相关测试迁移：
   - draft/provisional 单测可保留为 legacy suite。
   - 从 `test:grc` 主链移除 `test:draft-goal`。
   - 新增 projection suite 进入 `test:grc`。

### 验收

- before_agent_start 注入只反映已持久化 object sidecars。
- 没有 tool projection 时，不会凭 assistant 末尾 JSON 自动制造 provisional overlay。
- 旧 artifact restore 不崩溃。

```bash
npm --prefix extensions/passto-context run test:context-manager
npm --prefix extensions/passto-context run test:restore
npm --prefix extensions/passto-context run test:grc
```

---

## Phase R1-7：Curator 从 draftDisposition 改为 reconciliation ops

### 目标

Curator 不再“确认 draft”，而是异步复核任何 userGoal / xNodeModel 状态。

### 涉及文件

- `types.ts`
- `grc-curator-parser.ts`
- `grc-curator-normalizer.ts`
- `grc-curator-guard.ts`
- `grc-subagent.ts`
- `grc-prompts.ts`
- `tests/grc-curator-output.test.ts`
- `tests/curator-goal-guard.test.ts`
- `tests/grc-curator-producer-v2-bootstrap.test.ts`

### 新类型

```ts
type CuratorReconciliationOp =
  | { action: "mark_reviewed"; targetUserGoalId: string }
  | { action: "revise_user_goal"; targetUserGoalId: string; patch: Partial<UserGoalNode> }
  | { action: "supersede_user_goal"; targetUserGoalId: string; successorUserGoalId?: string; reason: string }
  | { action: "discard_user_goal"; targetUserGoalId: string; reason: string }
  | { action: "merge_user_goals"; sourceUserGoalIds: string[]; targetUserGoalId: string }
  | { action: "split_user_goal"; sourceUserGoalId: string; newGoals: Array<{ assertion: string }> }
  | { action: "advance_execution_state"; targetUserGoalId: string; executionState: UserGoalExecutionState }
  | { action: "update_xnode_model"; targetUserGoalId: string; xNodeModelOps: XNodeModelOp[] }
  | { action: "adjust_focus"; currentFocusUserGoalId?: string | null; currentFocusXNodeId?: string | null };
```

### 任务

1. Curator prompt 要求输出 `reconciliationOps`。
2. parser/normalizer 支持 `reconciliationOps`。
3. guard 层应用 reconciliation ops，并复用 R1-2 projection 核心库。
4. `draftDispositions` 只作为 legacy input，可转换为 reconciliation ops 或忽略。
5. Curator 可以修正任何 reviewState：
   - `generator_projected`
   - `curator_reviewed`
   - `user_confirmed`

### 验收

```bash
npm --prefix extensions/passto-context run test:curator
npm --prefix extensions/passto-context run test:curator-replay:strict
```

---

## Phase R1-8：状态面、README、脚本与测试链收口

### 目标

让人类和后续 agent 看到的新口径一致，不再从 status / README / scripts 入口加载旧口径。

### 涉及文件

- `ptc-status.ts`
- `widget-status.ts`
- `docs/V2.0/README.md`
- `docs/V2.0/generator-v2.0.md`
- `docs/V2.0/curator-v2.0.md`
- `package.json`
- `tests/widget-status.test.ts`
- `tests/grc-goal-state-summary.test.ts`

### 任务

1. `/ptc status` 增加或调整显示：
   - current userGoal assertion
   - `executionState`
   - `reviewState`
   - `relationState`
   - current xNode phase / nextStepType / proof

2. Widget 保持简洁，但内部数据源优先新字段。

3. README 文档索引：
   - 标记 `design-draft-goal-recognition.md` 为 Deprecated。
   - 标记 `draft-goal-runtime-spec-v1.md` 为 Deprecated / Legacy。
   - `implementation-plan.md` 指向本 R1 方案。

4. `package.json`：
   - 新增 `test:projection`
   - `test:grc` 包含 projection 主链。
   - legacy draft 测试移到 `test:legacy-draft`，不作为 V2.0 主 gate。

### 验收

```bash
npm --prefix extensions/passto-context run test:status
npm --prefix extensions/passto-context run test:grc
```

---

## Phase R1-9：真实 session proof

### 目标

证明新架构不仅单测成立，也能在真实 Pi session 中完成当前轮 Generator-first 持久化。

### 新增脚本

- `scripts/user-goal-projection-fresh-proof.sh`

### proof 场景

1. 启动 fresh session。
2. 用户输入一个新独立目标。
3. Generator 被提示调用 `applyUserGoalProjection`。
4. 当前轮内状态中出现：
   - 新 userGoal
   - `reviewState=generator_projected`
   - xNodeModel skeleton
   - `currentFocusUserGoalId`
   - `currentFocusXNodeId`
5. 下一轮 before_agent_start 注入能看到该 userGoal / xNodeModel。
6. Curator agent_end 后可 mark_reviewed 或 revise。

### 验收

```bash
npm --prefix extensions/passto-context run test:grc
npm --prefix extensions/passto-context run test:curator-replay:strict
npm --prefix extensions/passto-context run test:regression:strict
```

---

## 4. Structural Continuity 重设计划（P0–P5）

状态：**Implemented / Closed（P0–P5）**，更新于 2026-05-22。

以下 P0–P5 是 R1 之后的结构连续性修复切片，用于修复当前暴露出的根因：`userGoalId / xNodeModelId` 文档级 identity 与关联不稳定、LLM 缺少目标关系判断方法论、UserGoal / XNodeModel schema 不能承载 output / method / parameters / proof / commit，以及节点运行后缺少状态提交。

当前完成状态：

| 切片 | 状态 | 代码 / 测试 proof |
|---|---|---|
| P0 | 已完成 | `tests/structural-continuity.test.ts` 锁定 identity warning、sidecar 缺失与 post-node commit guard |
| P1 | 已完成 | `types.ts` / `grc-x-node-model.ts` / `grc-user-goal-tree.ts` 提供 `XNodeModelDocument.id`、`userGoal.xNodeModelId` 与双向 identity normalization |
| P2 | 已完成 | `GoalRelationDecision` contract、`applyUserGoalProjection` consistency warning、Generator contract 注入与 `tests/goal-relation-decision.test.ts` |
| P3 | 已完成 | `ContextParameterPacket` / `MethodPacket` / `ProofPacket` / `ContextMethodProofPackets` 及 `tests/context-method-proof-packets.test.ts` |
| P4 | 已完成 | `XNodeCommit` / `XNodeModelDocument.commitLog` / `completeXNodeWithCommit`，`ContextParameterPacket.latestCommits` 默认回读 `xNodeModel.commitLog` |
| P5 | 已完成 | `before-agent-start` 已注入 Context / Method / Proof packets；文档状态与最终回归已同步 |

收口验证：

```bash
npm --prefix extensions/passto-context run test:structural-continuity
npm --prefix extensions/passto-context run test:plan-certainty
npm --prefix extensions/passto-context run test:projection
node --experimental-strip-types --test extensions/passto-context/tests/before-agent-start-injection.test.ts extensions/passto-context/tests/context-method-proof-packets.test.ts
```

最近一次 P5 回归结果：`test:structural-continuity` 11 passed；`test:plan-certainty` 22 passed；`test:projection` 43 passed；before-agent-start + context/method/proof packet 6 passed。

### P0：Failing tests 锁定根因

目标：先用失败测试保护结构连续性，不再让实现继续依赖语义重建。

测试应覆盖：

1. `xNodeModel` 必须有稳定 `id`，并满足：
   - `userGoal.xNodeModelId === xNodeModel.id`
   - `xNodeModel.userGoalId === userGoal.id`
2. 缺失 `userGoalId` / `xNodeModelId` 时不得静默创建新 root goal；应产生 identity-resolution warning / signal，交由 LLM 判断。
3. 用户输入若是补充、纠偏、继续执行、验收反馈或参数输入，不应创建新的 userGoal / xNodeModel，而应复用当前 focus userGoal 绑定的 xNodeModel。
4. 新 root / sibling / child userGoal 创建时，必须同步创建绑定该 userGoal 的 xNodeModel skeleton。
5. 节点完成后必须能提交 commit，使下一轮 before-agent-start 看到完成状态、proof、artifacts 与 next focus。

推荐测试入口：新增 `test:structural-continuity`，并接入 `test:grc` / `test:regression:strict`。

### P1：Identity-bearing UserGoal / XNodeModel schema

目标：把 userGoal / xNodeModel 从语义关联升级为文档级 identity 关联。

最小 schema 方向：

```ts
interface UserGoalNode {
  id: string;
  parentId: string | null;
  xNodeModelId: string;
  focusState?: "focused" | "sleeping";
  intendedOutput?: OutputSpec;
  outputLocation?: string;
  methodRef?: string;
  inputParameterRefs?: string[];
  lastCommitId?: string;
}

interface XNodeModelDocument {
  id: string;
  userGoalId: string;
  currentFocusXNodeId: string | null;
  rootXNodeIds: string[];
  nodes: XNode[];
  artifacts?: ArtifactRef[];
  parameterPackets?: ContextParameterPacketRef[];
  commitLog?: XNodeCommit[];
}
```

关键约束：

- `XNodeModelDocument.id` 不再缺省；不能只靠 `model.userGoalId` 作为文档身份。
- `userGoal.xNodeModelId` 与 `xNodeModel.id` 必须可回读验证。
- `xNodeModel.userGoalId` 必须指向真实存在的 userGoal。
- legacy restore / replay 可用 migration / normalization 补齐 `id`，但不能让新写入继续缺失。

### P2：LLM-owned GoalRelationDecision

目标：让主 LLM 在处理最新用户输入时先显式判断目标关系，再决定是否投影状态；脚本只辅助，不强制裁决。

建议合同：

```ts
interface GoalRelationDecision {
  relation:
    | "new_root"
    | "new_sibling_of_focus"
    | "new_child_of_focus"
    | "update_current_focus"
    | "switch_focus_to_existing"
    | "complete_current_focus"
    | "no_goal_change";
  focusUserGoalIdBefore: string | null;
  targetUserGoalId: string | null;
  targetXNodeModelId: string | null;
  targetXNodeId: string | null;
  parentUserGoalId: string | null;
  producesNewUserGoal: boolean;
  shouldCreateXNodeModel: boolean;
  expectedOutput?: OutputSpec;
  outputLocation?: string;
  methodRef?: string;
  requiredParameterRefs?: string[];
  evidence: string[];
  confidence: "low" | "medium" | "high";
}
```

设计口径：

- 第一段只判断用户输入与 userGoalTree 的关系：new root、focus sibling、focus child、update current、switch、complete、no change。
- 第二段才根据 `producesNewUserGoal` 决定是否创建 xNodeModel。
- 如果不是新 userGoal，必须沿用当前 focus userGoal 的 `xNodeModelId` 并 patch 既有 xNodeModel。
- 脚本可提供 suggested candidates / integrity warnings，但最终 decision 由 LLM 明确承担。

### P3：Context packet / Method packet / Proof packet

目标：把 before-agent-start 注入与工具热加载重新整理成 LLM 可消费的信息参数与运行函数包。

建议拆分：

```ts
interface ContextParameterPacket {
  currentFocusUserGoalId: string | null;
  currentFocusXNodeModelId: string | null;
  currentFocusXNodeId: string | null;
  focusUserGoalPath: UserGoalNode[];
  focusXNodePath: XNode[];
  sleepingUserGoals: UserGoalNode[];
  recentArtifacts: ArtifactRef[];
  latestCommits: XNodeCommit[];
  latestRuntimeProof: RuntimeProofRecord | null;
}

interface MethodPacket {
  methodRef: string;
  purpose: string;
  whenToUse: string[];
  inputContract: string[];
  outputContract: string[];
}

interface ProofPacket {
  targetUserGoalId: string;
  targetXNodeModelId: string;
  targetXNodeId: string;
  proofStatus: RuntimeProofRecord["proofStatus"];
  evidence: string[];
  verificationMethod: string[];
  userVisibleSummary: string;
}
```

要求：

- context packet 提供信息参数，不替代 LLM 判断。
- method packet 提供热加载方法论函数，例如 GoalRelationDecision、Improve-certainty、runtime proof 验收、post-node commit。
- proof packet 让输出可被用户验收，也能作为下一轮反馈迭代输入。

### P4：Post-node commit protocol

目标：节点执行后必须把结果写成下一轮可恢复的信息参数和 proof，而不是只留在自然语言总结中。

建议合同：

```ts
interface XNodeCommit {
  commitId: string;
  userGoalId: string;
  xNodeModelId: string;
  xNodeId: string;
  resultStatus: "completed" | "partial" | "blocked";
  outputRefs: ArtifactRef[];
  proofRefs: RuntimeProofRecord[];
  statePatch: {
    phase?: XNode["phase"];
    status?: XNode["status"];
    nextFocusXNodeId?: string | null;
    updatedFacets?: Partial<Record<"why" | "what" | "flow" | "structure" | "runtimeProof", XNodeFacet>>;
  };
  evidence: string[];
}
```

原则：

- commit 是 LLM 对运行结果的显式状态提交；脚本负责保存、校验、展示、恢复。
- 完成一个 bounded atomic task 后，应检查是否要向父层回归或切换 next focus。
- commit 必须能被 before-agent-start 注入为下一轮参数。

### P5：before-agent-start 注入重构

目标：让下一轮 LLM 获得稳定 identity 参数、目标关系上下文、method packet 与 proof packet，避免从上下文语义重建。

注入应优先展示：

- 当前 `currentFocusUserGoalId`
- 当前 `currentFocusXNodeModelId`
- 当前 `currentFocusXNodeId`
- focus userGoal path / xNode path
- sleeping / dormant userGoals 摘要
- identity integrity warnings
- latest post-node commits
- latest runtime proof / proof signals
- 可用 method packets / 当前推荐方法论

不得做的事：

- 不在 before-agent-start 阶段替 LLM 判断最新用户输入是不是新目标。
- 不因 sidecar 缺失静默创建 root goal。
- 不把 policy projection 当硬调度命令。

验收：fresh session 中，LLM 应能基于注入参数明确判断“当前消息是新 root / sibling / child / update current / switch / no goal change”，并能正确复用或创建 xNodeModel。

---

## 5. 依赖顺序

```text
R1-0 baseline
  ↓
R1-1 UserGoalNodeV2 类型
  ↓
R1-2 projection 纯函数核心
  ↓
R1-3 xNode skeleton / patch
  ↓
R1-4 applyUserGoalProjection 工具
  ↓
R1-5 Generator prompt/contract
  ↓
R1-6 provisional overlay 主链降级
  ↓
R1-7 Curator reconciliation ops
  ↓
R1-8 surfaces/docs/scripts
  ↓
R1-9 real session proof
```

可并行项：

- R1-8 文档更新可在 R1-5 后与 R1-7 并行。
- R1-9 脚本骨架可在 R1-4 后先写，但最终 proof 必须等 R1-7/R1-8 后跑。
- legacy draft 测试迁移可与 R1-6 并行。

不可并行项：

- R1-4 必须等 R1-2/R1-3。
- R1-6 必须等 R1-4/R1-5，否则会失去当前轮新目标写入能力。
- R1-7 必须等 R1-2，因为 reconciliation 应复用 projection 核心。

---

## 6. 风险与防护

| 风险 | 防护 |
|---|---|
| 过早移除 provisional overlay 导致新目标无法当前轮持久化 | 必须先完成 `applyUserGoalProjection` 工具，再降级 overlay |
| 新字段破坏旧 artifact restore | `status` 保留；parser/restore 对缺失新字段补默认值 |
| Generator 不调用 projection 工具 | prompt 明确“第一动作”；status/injection 显示 projection 缺失 warning；fresh proof 验证 |
| Curator 与 Generator 同时改同一目标冲突 | 使用 `lastTouchedRound/source/evidence`，Curator 输出 reconciliation reason；必要时保留 conflict signal |
| xNodeModel 被重建导致 proof 丢失 | patch 默认增量，只有 migrate/split/merge 才允许结构性变更；proof target reconcile 必须保留 |
| legacy 测试大量失败 | 先迁移为 legacy suite，再逐步删除；主 gate 只保护新主链 |

---

## 7. 每阶段推荐 gate

| 阶段 | 最小 gate |
|---|---|
| R1-1 | `test:derivation` + `test:restore` |
| R1-2 | `user-goal-projection.test.ts` |
| R1-3 | `test:derivation` + projection test |
| R1-4 | projection tool test + `test:restore` |
| R1-5 | `test:reflector` + `test:context-manager` |
| R1-6 | `test:context-manager` + `test:restore` + `test:grc` |
| R1-7 | `test:curator` + `test:curator-replay:strict` |
| R1-8 | `test:status` + `test:grc` |
| R1-9 | `test:regression:strict` |

---

## 8. 完成定义

R1 完成时必须满足：

1. `UserGoalNode` 正式支持：
   - `executionState`
   - `reviewState`
   - `relationState`
   - `source`
2. Generator 当前轮可通过 `applyUserGoalProjection` 直接持久化 userGoalTree + xNodeModel。
3. 新 userGoal 创建时只生成 xNodeModel skeleton，不做完整递归拆树。
4. 既有 userGoal 更新时复用并 patch 原 xNodeModel。
5. `draftGoalOp / RuntimeProvisionalOverlay` 不再是 V2.0 主链入口。
6. Curator 输出通用 reconciliation ops，而不是 draft disposition 主语义。
7. before_agent_start 注入的新协议与 `architecture-v2.0.md` 一致。
8. README / status / tests 不再把 provisional overlay 描述为当前主设计。
9. `npm --prefix extensions/passto-context run test:regression:strict` 通过。
10. 至少一个 fresh session proof 证明：新用户输入在当前轮内进入 userGoalTree + xNodeModel。

---

## 9. 一句话

> 这轮改造不是删除旧代码，而是先补上 Generator-first 的 `applyUserGoalProjection` 主入口，让当前轮用户输入直接落到统一 userGoalTree 和 xNodeModel 状态机；之后再把 `draftGoalOp / provisional overlay / draftDispositions` 降级为 legacy bridge，并让 Curator 改为通用 reconciliation 机制。
