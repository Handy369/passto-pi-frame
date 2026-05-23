# PasstoContext V2.0 Phase E1 精确代码落地计划

> 状态：Draft  
> 更新：2026-05-20  
> 目标：在**不打断当前 GoalTree / certainty / nextStepType 生产链**的前提下，把 `UserGoalTreeDocument` 与 `XNodeModelDocument` 作为正式对象层接入当前 repo。  
> 方法：**先加 sidecar 真相源与 adapter，不先替换主生产面。**

---

## 1. 本计划基于的真实代码锚点

本计划不是抽象方案，而是基于当前仓库真实承载点制定：

### 1.1 当前目标状态主承载
- `types.ts`
  - `GoalStateAny`
  - `GoalTreeDocument`
  - `GoalNode`
  - `CertaintyAssessment`
  - `RuntimeDraftGoalState`
- `grc-state.ts`
  - `GRCState.curator.lastGoalState`
  - `getEffectiveGoalState()`
- `grc-goal-tree.ts`
  - `ensureGoalTreeDocument()`
  - `upgradeGoalStateToTree()`

### 1.2 当前注入主承载
- `before-agent-start-injection.ts`
  - 当前统一从 `getEffectiveGoalState(grcState)` 取目标态
- `grc-prompts.ts`
  - `buildGoalStateInjection()`
  - `buildNextStepPolicyInjection()`

### 1.3 当前 Curator 生产主承载
- `grc-subagent.ts`
  - `normalizeGoalStateForCurator()`
  - `executeCurator()`
- `index.ts`
  - Curator result reconcile
  - curator artifact append
  - state update

### 1.4 当前恢复主承载
- `grc-restore.ts`
  - `parseCuratorArtifactEntry()`
  - `replayCuratorArtifacts()`

### 1.5 当前 draft overlay 主承载
- `grc-draft-goal.ts`
  - `applyDraftGoalOpToGoalTree()`
- `grc-state.ts`
  - `runtimeDraftGoalState`
  - `getEffectiveGoalState()`

因此，Phase E1 不应另起状态系统，而应挂到这些现有锚点上。

---

## 2. E1 的边界：做什么 / 不做什么

## 2.1 E1 要做的

E1 只做四件事：

1. 在类型层正式引入：
   - `UserGoalTreeDocument`
   - `XNodeModelDocument`
   - `XNode`
2. 提供从当前 `GoalStateAny` **派生/映射**到这两个正式对象的 adapter
3. 在 state / artifact / restore 中把这两个对象作为 sidecar 真相源持久化
4. 在 before-agent-start 注入中让这两个对象开始可见，但不替换现有 GoalState 注入

## 2.2 E1 不做的

E1 **不做**：
- 不替换当前 `lastGoalState` 主生产链
- 不要求 Curator 本轮就直接产出 `UserGoalTreeDocument`
- 不把 `nextStepType` 改成 `XNodePolicyProjection`
- 不引入 `RuntimeProofRecord / RuntimeProofSignal` 主链
- 不把系统改成硬 scheduler
- 不重写 `/ptc status` 主输出结构

一句话：

> **E1 先建正式对象层，不抢现有 GoalTree 兼容链的生产职责。**

---

## 3. E1 目标架构：sidecar 正式对象层

Phase E1 后，运行时应同时存在两层承载：

### 3.1 兼容生产层（保留）
- `lastGoalState: GoalStateAny | null`
- `lastCertaintyAssessment: CertaintyAssessment | null`
- `runtimeDraftGoalState`

### 3.2 正式对象 sidecar 层（新增）
- `lastUserGoalTree: UserGoalTreeDocument | null`
- `lastXNodeModels: XNodeModelDocument[]`

### 3.3 为什么先用 sidecar

因为当前 repo 里：
- Curator prompt / parser / guard / replay / status 都围绕 GoalState 在工作
- 直接替换真相源风险太高

所以正确策略是：
- **先让正式对象存在并持续刷新**
- **再在 E2/E3 逐步把消费面迁过去**

---

## 4. 具体文件改动

## 4.1 `types.ts`

### 新增类型

#### 用户目标树
```ts
export interface UserGoalTreeDocument {
  version: 1;
  agentRound: number;
  updatedAt: string;
  currentFocusUserGoalId: string | null;
  rootUserGoalIds: string[];
  userGoals: UserGoalNode[];
}

export interface UserGoalNode {
  id: string;
  parentId: string | null;
  assertion: string;
  status: "identified" | "planning" | "executing" | "completed";
  xNodeModelId: string | null;
  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;
}
```

#### x-node-model
```ts
export interface XNodeModelDocument {
  version: 1;
  userGoalId: string;
  agentRound: number;
  updatedAt: string;
  currentFocusXNodeId: string | null;
  rootXNodeIds: string[];
  nodes: XNode[];
}

export interface XNode {
  id: string;
  parentId: string | null;
  assertion: string;
  status: "active" | "suspended" | "completed";
  atomicity: GoalNodeAtomicity;
  phase: GoalNodePhase;
  why: XNodeFacet;
  what: XNodeFacet;
  flow: XNodeFacet;
  structure: XNodeFacet;
  runtimeProof: XNodeFacet;
  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;
  priority: number;
  order: number;
}

export interface XNodeFacet {
  summary: string;
  confidence: "open" | "partial" | "closed";
  evidence?: string[];
  method?: string[];
}
```

### 扩展 `GRCState`

在 `curator` 下新增：
```ts
lastUserGoalTree?: UserGoalTreeDocument | null;
lastXNodeModels?: XNodeModelDocument[];
```

### 扩展 `CuratorArtifactEntry`

新增可选字段：
```ts
userGoalTree?: UserGoalTreeDocument | null;
xNodeModels?: XNodeModelDocument[] | null;
```

### 设计说明

E1 不改：
- `GoalStateAny`
- `CuratorResult.goalState`

因为 E1 的目标不是替换生产输出，而是**增加 sidecar 对象**。

---

## 4.2 新建 `grc-user-goal-tree.ts`

### 职责
- 定义用户目标树 adapter / helper
- 从现有 `GoalStateAny` 派生 `UserGoalTreeDocument`

### 最小导出函数

```ts
export function deriveUserGoalTreeFromGoalState(goalState: GoalStateAny | null): UserGoalTreeDocument | null;
export function selectCurrentUserGoal(userGoalTree: UserGoalTreeDocument | null): UserGoalNode | null;
export function summarizeUserGoalTree(userGoalTree: UserGoalTreeDocument | null): { active: number; completed: number; focus: string | null } | null;
```

### E1 派生策略

E1 不追求复杂语义识别，先做**稳定派生**：

- 若 `goalState` 为 `GoalTreeDocument(version:2)`：
  - root 节点视作 user goals
  - child 节点暂不进入用户目标树层
  - `currentFocusGoalId` 若命中 root，则映射为 `currentFocusUserGoalId`
  - 若命中 child，则回溯到其 root 祖先，作为 focus user goal
- 若 `goalState` 为 `GoalStateDocument(version:1)`：
  - active/completed 各项直接映射为 root user goals

### 状态映射

最小映射规则：
- root active + phase ~ plan → `planning`
- root active + phase ~ execute/testing/pending_acceptance → `executing`
- root completed → `completed`
- brand-new / 缺乏 phase 时默认 `identified` 或 `planning`，推荐统一落 `planning`

E1 允许保守，关键是稳定、可 replay、可 restore。

---

## 4.3 新建 `grc-x-node-model.ts`

### 职责
- 从现有 `GoalStateAny + UserGoalTreeDocument` 派生 `XNodeModelDocument[]`
- 从当前 focus user goal 选择当前 x-node-model

### 最小导出函数

```ts
export function deriveXNodeModelsFromGoalState(
  goalState: GoalStateAny | null,
  userGoalTree: UserGoalTreeDocument | null,
): XNodeModelDocument[];

export function selectCurrentXNodeModel(
  userGoalTree: UserGoalTreeDocument | null,
  xNodeModels: XNodeModelDocument[],
): XNodeModelDocument | null;
```

### E1 派生策略

#### 若当前是 `GoalTreeDocument(version:2)`
- 每个 root user goal 生成一个 `XNodeModelDocument`
- 该 root 及其 descendants 一起映射为这个 x-node-model 的 nodes
- `currentFocusGoalId` 若属于该 root subtree，则映射到该 model 的 `currentFocusXNodeId`

#### 若当前是 `GoalStateDocument(version:1)`
- 每个 active/completed 项生成一个**单节点** x-node-model
- 这是 bootstrap 兼容路径，不追求复杂树

### 五维骨架填充策略

E1 阶段，五维先用**保守派生**：

- `why.summary = assertion`
- `what.summary = assertion`
- `flow.summary = phase/atomicity 的保守说明`
- `structure.summary = "derived from GoalState compatibility layer"`
- `runtimeProof.summary = "not yet first-class in E1"`

confidence 默认：
- `why/what = partial`
- `flow = partial`
- `structure = partial`
- `runtimeProof = open`

这样做的目的不是完美语义，而是：

> **先让 x-node 成为正式可持久化对象。**

---

## 4.4 `grc-state.ts`

### 变更点

#### `createInitialGRCState()`
在 `curator` 下初始化：
```ts
lastUserGoalTree: null,
lastXNodeModels: [],
```

#### `updateCuratorStatus(...)`
扩展参数非常危险，不建议继续堆 positional 参数。

### E1 推荐动作

不要在 E1 继续扩大 `updateCuratorStatus(...)` 参数列表。

而是：
1. 保持 `updateCuratorStatus(...)` 只负责现有字段
2. 新增一个更小的 helper：

```ts
export function setCuratorObjectSidecars(
  state: GRCState,
  payload: {
    userGoalTree?: UserGoalTreeDocument | null;
    xNodeModels?: XNodeModelDocument[];
  },
): GRCState
```

这样能避免继续污染超长 positional 参数函数。

#### `restoreGRCState(...)`
增加 restore：
- `lastUserGoalTree`
- `lastXNodeModels`

#### `serializeGRCState(...)`
保持 JSON 深拷贝即可，无需额外逻辑。

---

## 4.5 `grc-restore.ts`

### `parseCuratorArtifactEntry(...)`
新增可选解析：
```ts
userGoalTree: value.userGoalTree && typeof value.userGoalTree === 'object' ? value.userGoalTree as ... : null,
xNodeModels: Array.isArray(value.xNodeModels) ? value.xNodeModels as ... : null,
```

### `replayCuratorArtifacts(...)`
在 replay curator artifact 时：
- 先按现有链路恢复 `goalState / certainty / signal`
- 再把 `userGoalTree / xNodeModels` 写回 sidecar

### 原则

E1 restore 仍然以：
- `goalState`

作为主生产恢复字段；

`userGoalTree / xNodeModels` 是：
- 可选 sidecar
- 缺失时允许在 session_start 后重新派生

---

## 4.6 `index.ts`

这是 E1 最关键的接线位置。

### 接线点 A：Curator result reconcile 后

当前链路：
- `reconcileCuratorGoalState(previousGoalState, result)`
- 产出 `normalizedGoalState`
- 更新 `grcState`
- append curator artifact

### E1 新动作

在拿到 `normalizedGoalState` 后，立即做：

```ts
const derivedUserGoalTree = deriveUserGoalTreeFromGoalState(normalizedGoalState);
const derivedXNodeModels = deriveXNodeModelsFromGoalState(normalizedGoalState, derivedUserGoalTree);
```

然后：
- 写入 `grcState.curator.lastUserGoalTree`
- 写入 `grcState.curator.lastXNodeModels`
- append curator artifact 时一并持久化

### 接线点 B：draft overlay 应用后

当前已有：
- `applyDraftGoalOpToGoalTree(...)`
- `runtimeDraftGoalState`

E1 不要求把 draft overlay 改写到新对象层；
只要求在有 `runtimeDraftGoalState` 时，`before-agent-start` 取 effective goal state 后，仍能重新派生：
- effective userGoalTree
- effective xNodeModels

### 关键原则

E1 不做：
- 不直接从 Curator raw output 读取 userGoalTree/xNodeModels
- 优先从已 reconcile 的 `normalizedGoalState` 派生，降低接线面风险

---

## 4.7 `grc-prompts.ts`

### 现状
当前已经有：
- `buildGoalStateInjection()`
- `buildNextStepPolicyInjection()`

### E1 推荐新增，而不是替换

新增：

```ts
export function buildUserGoalTreeInjection(userGoalTree: UserGoalTreeDocument): string;
export function buildXNodeModelInjection(xNodeModel: XNodeModelDocument | null): string;
```

### `buildUserGoalTreeInjection()` 最小输出

建议输出：
- 当前 focus user goal
- root user goals
- 每个 user goal 的 status
- 当前 user goal 绑定的 x-node-model id

### `buildXNodeModelInjection()` 最小输出

建议输出：
- 当前 focus x-node
- focus path
- direct children
- atomicity / phase
- 五维闭合摘要（先简单）

### E1 特别注意

不要在 E1 删除或替换：
- `buildGoalStateInjection()`

原因：
- 当前主模型与测试仍围绕它
- E1 只需把新对象注入为**补充块**

---

## 4.8 `before-agent-start-injection.ts`

这是 E1 的实际消费入口。

### 现状
当前顺序：
1. Generator Charter
2. effective goal state injection
3. next step policy injection
4. summary cache
5. search guidance
6. reflector
7. principles
8. memory

### E1 接入策略

在 `effectiveGoalState` 取到后，增加：

```ts
const effectiveUserGoalTree = deriveUserGoalTreeFromGoalState(effectiveGoalState);
const effectiveXNodeModels = deriveXNodeModelsFromGoalState(effectiveGoalState, effectiveUserGoalTree);
const currentXNodeModel = selectCurrentXNodeModel(effectiveUserGoalTree, effectiveXNodeModels);
```

然后注入：
- `buildUserGoalTreeInjection(effectiveUserGoalTree)`
- `buildXNodeModelInjection(currentXNodeModel)`

### 顺序建议

推荐插入在：
- `goal-state injection` 之后
- `next-step-policy injection` 之前

原因：
- 先保留旧 GoalState 兼容块
- 再补正式对象块
- 最后让 `nextStepType` 继续沿现有 certainty 链路工作

---

## 5. E1 不改动的文件

以下文件 E1 不建议改，或者只做最小类型兼容：

- `grc-curator-parser.ts`
- `grc-curator-guard.ts`
- `grc-subagent.ts`
- `ptc-status.ts`
- `widget-status.ts`
- `grc-goal-view.ts`
- `grc-goal-state-summary.ts`

### 原因

这些文件当前已经稳定服务 GoalTree 兼容主链。
E1 若同步大改，会把“新增正式对象层”和“替换主消费面”两个任务混在一起。

E1 的原则是：

> **先加 sidecar，不扩大战线。**

---

## 6. 测试计划

基于当前测试目录，E1 至少补以下测试：

## 6.1 新建测试

### `tests/user-goal-tree-derivation.test.ts`
覆盖：
- V1 goalState → UserGoalTreeDocument
- V2 goalTree → UserGoalTreeDocument
- child focus 回溯到 root user goal
- status 映射稳定

### `tests/x-node-model-derivation.test.ts`
覆盖：
- V1 goalState → 单节点 x-node-model
- V2 goalTree → 每 root 一个 x-node-model
- currentFocusXNodeId 映射
- subtree 划分稳定
- 五维默认填充

---

## 6.2 更新现有测试

### `tests/before-agent-start-injection.test.ts`
新增断言：
- 注入中出现 user goal tree 块
- 注入中出现 x-node-model 块
- draft overlay 场景下，注入使用 effective goal state 派生结果

### `tests/index-restore-replay.test.ts`
新增断言：
- curator artifact 持久化 `userGoalTree / xNodeModels`
- restore 后 sidecar 恢复成功

### `tests/draft-goal-runtime.test.ts`
新增断言：
- 应用 draft 后，通过 effective goal state 派生出的 userGoalTree/xNodeModel 焦点同步变化

---

## 7. 实施顺序

严格按这个顺序做，避免断链：

### Step 1：加类型，不接消费
- `types.ts`

### Step 2：加派生 adapter
- `grc-user-goal-tree.ts`
- `grc-x-node-model.ts`

### Step 3：接 state sidecar
- `grc-state.ts`

### Step 4：接 curator result 后派生 + persist
- `index.ts`
- `grc-restore.ts`

### Step 5：接 before-agent-start 注入
- `grc-prompts.ts`
- `before-agent-start-injection.ts`

### Step 6：补测试
- 新建/修改 tests

这个顺序的好处是：
- 每一步都可单独验证
- 即便中途停下，现有 GoalTree 主链仍能跑

---

## 8. E1 完成标准

满足以下条件，才算 E1 完成：

1. `types.ts` 中已正式存在：
   - `UserGoalTreeDocument`
   - `XNodeModelDocument`
   - `XNode`
2. Curator result reconcile 后，会从 `normalizedGoalState` 派生 sidecar：
   - `lastUserGoalTree`
   - `lastXNodeModels`
3. curator artifact 已持久化这两个 sidecar 对象
4. restore 后能恢复 sidecar 对象
5. before-agent-start 注入中可见：
   - user goal tree 摘要
   - 当前 x-node-model 摘要
6. 现有 `GoalStateInjection + nextStepPolicyInjection` 仍保持可用
7. 现有回归不被破坏

---

## 9. 一句话

> Phase E1 的正确做法，不是立刻把 `GoalTreeDocument` 推翻，而是：**沿着 `index.ts → grc-state.ts → grc-restore.ts → before-agent-start-injection.ts` 这条现有主链，先把 `UserGoalTreeDocument` 和 `XNodeModelDocument` 作为 sidecar 正式对象层接进去，并持续由当前 `GoalStateAny` 稳定派生。**
