# PasstoContext V2.0 Provisional Anchor Runtime Spec v1

> 状态：Deprecated / Legacy  
> 废弃日期：2026-05-22  
> 替代口径：`architecture-v2.0.md` + `implementation-plan.md` R1；当前轮通过 `applyUserGoalProjection` 写入正式 userGoal，复核阶段由 `reviewState` / Curator `reconciliationOps` 表达。  
> 历史目标：补齐“当前轮先有 provisional anchor、下一轮 Curator 可裁决修正”的运行时闭环  
> 适用范围：仅作为 legacy compatibility 背景，不再作为 V2.0 主链实现依据。

---

## 1. 问题重新定义

在统一后的 V2.0 正式口径中，当前轮主 Agent 的工作链是：

```text
确认当前 user goal
  ↓
读取 / 绑定对应 x-node-model
  ↓
围绕 x-node-model 推进
```

因此当当前轮用户引入新的独立用户目标时，真正的问题不再只是“有没有 draft signal”，而是：

> **当前轮是否允许先建立一个 provisional user-goal anchor，以及围绕它建立 provisional x-node-model。**

---

## 2. 基本原则

### 2.1 当前轮必须允许有 provisional anchor

否则：
- 当前轮无法稳定挂载新的 user goal
- 也无法围绕该 goal 产生 agent-side 递归树

### 2.2 下一轮 Curator 必须保留裁决权

否则：
- 当前轮误判会直接变成 confirmed 真相源
- 破坏 GRC 的后验纠偏价值

### 2.3 confirmed 与 provisional 必须分层

不能把当前轮 provisional 直接覆盖 confirmed 用户目标树 / x-node-model。

因此至少要区分：
- confirmed state
- provisional overlay
- effective visible state

---

## 3. 三层状态

### 3.1 Confirmed State

由 Curator 最近一次确认：
- `UserGoalTreeDocument`
- 已确认的 `XNodeModelDocument`

### 3.2 Provisional Overlay

由当前轮主 Agent 产生：
- provisional user goal
- provisional x-node-model
- 或围绕已有 confirmed user goal 产生的 provisional subtree rewrite

### 3.3 Effective Visible State

注入给当前轮后续运行时消费面的可见状态：

```text
effective state = confirmed state + provisional overlay
```

最小实现可先允许：
- provisional 层直接覆盖当前焦点 user goal / x-node-model 的可见视图

---

## 4. 最小对象建议

### 4.1 RuntimeProvisionalUserGoalState

```ts
interface RuntimeProvisionalUserGoalState {
  baseUserGoalTreeRound: number | null;
  sourceAgentRound: number;
  createdAt: string;
  userGoalTree: UserGoalTreeDocument;
  source: "generator";
}
```

### 4.2 RuntimeProvisionalXNodeState

```ts
interface RuntimeProvisionalXNodeState {
  baseXNodeModelRound: number | null;
  sourceAgentRound: number;
  createdAt: string;
  xNodeModel: XNodeModelDocument;
  source: "generator";
}
```

### 4.3 Effective State

```text
effectiveUserGoalTree = provisionalUserGoalTree ?? confirmedUserGoalTree
effectiveXNodeModel = provisionalXNodeModel ?? confirmedXNodeModel
```

---

## 5. 主 Agent 当前轮写入协议

主 Agent 若识别到当前轮需要建立 provisional anchor，应显式声明：

- 创建新的 provisional user goal
- 或更新现有 user goal 下的 provisional x-node subtree

最小协议可以是：
- `create-provisional-user-goal`
- `create-provisional-xnode-root`
- `refine-provisional-xnode-subtree`

此处最小目标不是一次性定义复杂 patch 语言，而是：

> **让当前轮主 Agent 能把 provisional anchor 正式写进 runtime overlay。**

---

## 6. 下一轮 Curator 的裁决对象

Curator 下一轮不能只看一个 draft node，而必须同时裁决：
- provisional user goal 是否成立
- provisional x-node-model 是否成立
- 围绕它展开的 subtree 是否保留、重挂、合并或重写

因此 Curator 的 disposition 至少需要覆盖：
- confirm
- revise
- discard
- subtree rewrite

---

## 7. 为什么 subtree rewrite 是必要的

如果上一轮主 Agent 围绕错误的 provisional anchor 已经展开了 agent-side 递归树，那么修正就不可能只靠：
- 改 assertion
- 删除一个节点

还需要支持：
- 局部 child 改挂
- phase 回退
- atomicity 修正
- focus 重定向
- 部分 subtree 保留、部分重写

因此该 spec 的裁决单位天然是：

> **provisional interpretation + derived subtree**

而不是单个节点。

---

## 8. 与 proof 的关系

因为 x-node 的原生骨架包含 `runtimeProof`，所以 provisional subtree 也必须允许包含：
- provisional proof 记录
- proof gap
- proof signal

下一轮 Curator 在裁决 provisional subtree 时，也应允许同时修正：
- 哪些 proof 可保留
- 哪些 proof 应废弃
- 哪些 proof signal 应继续保留用于后续分析

---

## 9. 最小实施边界

本 spec v1 最小只要求：

1. 当前轮可建立 provisional user goal anchor
2. 当前轮可建立 provisional x-node-model anchor
3. effective visible state 能让主 Agent 后续继续消费该 provisional anchor
4. 下一轮 Curator 能对 provisional anchor 及其 subtree 做 confirm / revise / discard
5. 必要时允许 subtree rewrite

不要求：
- 一开始就定义极其复杂的 patch DSL
- 一开始就支持所有 UI surface 完整可编辑

---

## 10. 一句话

> Provisional Anchor Runtime 的正确闭环不是“给 GoalNode 多一个 draft 标记”，而是：**让当前轮先有 provisional user-goal / x-node anchor 以便执行，再让下一轮 Curator 对整段 provisional interpretation 及其派生 subtree 做后验裁决与结构修正。**