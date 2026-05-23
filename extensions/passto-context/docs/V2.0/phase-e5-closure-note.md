# Phase E5 Closure Note

> 状态：Closed  
> 日期：2026-05-20

## 目标

Phase E5 的目标是把 draft / provisional 能力从“GoalTree 上多一个 `signal=draft` 的过渡近似物”，正式收口为：

- confirmed object state
- runtime provisional overlay
- effective visible state
- 下一轮 Curator 对 provisional interpretation 及其派生 subtree 的后验裁决

---

## 本次实际落地

### 1. confirmed / provisional / effective 三层分离

已在 runtime state 中正式引入：

- `RuntimeProvisionalUserGoalState`
- `RuntimeProvisionalXNodeState`
- `RuntimeProvisionalOverlay`

并把它挂入：

- `GRCState.curator.runtimeProvisionalOverlay`

当前运行时的对象层读取语义为：

```text
effective object state = confirmed sidecars + runtime provisional overlay
```

其中：

- confirmed sidecars：`lastUserGoalTree` / `lastXNodeModels`
- provisional overlay：当前轮主 Agent 暂时建立的 user-goal / x-node anchor
- effective visible state：`before_agent_start`、policy surface、status surface 实际消费的对象层视图

---

### 2. Generator 当前轮可正式写入 provisional anchor

当前轮识别到新目标时，不再只写：

- `runtimeDraftGoalState.goalState`

还会正式写入：

- `runtimeProvisionalOverlay`

主实现位于：

- `grc-provisional-overlay.ts`
- `index.ts`
- `grc-state.ts`

当前最小闭环支持：

- provisional user goal anchor
- provisional x-node-model root
- effective object state 注入到 `before-agent-start`

---

### 3. Curator disposition 已接入 provisional overlay

下一轮 Curator 的：

- `confirm-draft`
- `revise-draft`
- `discard-draft`
- subtree rewrite 风格 `nodeEdits`

现在不仅作用于 GoalTree compatibility layer，也会作用于：

- `RuntimeProvisionalOverlay`

主实现位于：

- `applyDraftDispositionsToRuntimeProvisionalOverlay()`
- `index.ts`

这意味着修正对象已经从“单个 draft 节点”提升为：

> provisional interpretation + derived subtree

---

### 4. replay / restore / status / policy 已收口

以下运行面已正式承接 E5：

- `before-agent-start-injection.ts`
  - 优先读取 effective object state
- `grc-policy-surface.ts`
  - policy snapshot 可消费 provisional overlay 的当前焦点 x-node
- `grc-restore.ts`
  - restore / replay 可恢复 `runtimeProvisionalOverlay`
- `ptc-status.ts`
  - `/ptc status` 新增 `Runtime Provisional Overlay`

---

### 5. proof surface 已与 provisional object state 对齐

当 effective x-node 来自 provisional overlay 时：

- proof / proof signal surface 会反映 provisional 焦点
- runtime-proof 缺口不再只停留在 compatibility GoalState 文案
- proof / policy / completion surface 已围绕 effective object state 收口

---

## 验证结果

### 自动化

已通过：

- `npm run test:grc`

覆盖：

- curator
- restore / replay
- reflector
- before-agent-start injection / event
- status surface
- derivation / completion
- draft-goal real session proof

### 真实 session proof

已通过：

- `scripts/draft-goal-fresh-proof.sh`

关键证据包括：

- assistant emitted `draftGoalOp`
- curator artifact persisted
- curator artifact contains v2 goalState + signal + summaryEntry + runtime proof payload
- runtime draft overlay persisted
- logs confirm runtime overlay + curator-origin proof payload + shutdown persistence path

---

## 仍保留的过渡层

Phase E5 完成后，以下过渡层仍保留用于兼容：

- `runtimeDraftGoalState`
- `GoalTreeDocument` compatibility layer
- `draftDispositions` 作为 provisional subtree rewrite 的早期承载

它们现在的定位是：

> compatibility / adapter / replay-friendly bridge

而不是最终对象口径本身。

---

## 结论

Phase E5 已闭合。

更准确地说，当前主链已经具备：

1. 当前轮 provisional anchor 正式写入 runtime overlay
2. effective object state 可见并可被主 Agent 后续消费
3. 下一轮 Curator 可对 provisional interpretation / subtree 做后验裁决
4. replay / restore / status / proof / policy surface 全部收口到该运行模型
