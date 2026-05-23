# Phase E7 Closure Note

> 状态：Closed  
> 日期：2026-05-21

## 目标

Phase E7 的目标不是继续清理 legacy 结构，也不是再发明一套新的验证体系，而是在 E6 已完成 object-first 收口的基础上，把：

- `RuntimeProofRecord`
- `RuntimeProofSignal`

从“设计对象 + 零散 prompt / 脚本 surface”正式收口为：

- Curator 正式产出对象
- artifact / state / restore / replay 正式持久化与恢复
- before-agent-start / status / diagnostics 正式消费
- provisional subtree 裁决时维持最小 proof / signal 一致性

也就是说，E7 的本质是：

> 让 proof-first runtime closure 成为当前主链的一部分，而不是继续停留在文档定义或零散验证文案中。

---

## 本次实际落地

### 1. Curator 已正式产出 proof object

当前 Curator payload 已稳定携带：

- `latestRuntimeProof`
- `latestProofSignals`

并且已补齐：

- proof round normalize
- signal id 回填
- proof 缺失时的最小 signal 合成
- top-level proof payload 缺失时，从 focused x-node model 保守回填

这意味着 proof 当前已经不再只是 x-node 内部隐含状态，而是：

> Curator artifact 的正式结构化产物。

---

### 2. proof object 已进入 artifact / state / restore / replay 主链

当前 proof object 已进入：

- curator artifact
- `GRCState.curator.latestRuntimeProof`
- `GRCState.curator.latestProofSignals`
- restore / replay 恢复路径

恢复后的运行态可继续拿到：

- 当前焦点 proof record
- proof signal 列表
- x-node model 内 latest proof surface

这标志着 proof 已具备跨轮恢复能力，不再是单轮临时值。

---

### 3. before-agent-start / status / diagnostics 已优先消费 top-level proof

当前运行面已正式接 proof object：

- `before-agent-start-injection.ts`
  - proof / signal 摘要已优先使用 `grcState.curator.latestRuntimeProof/latestProofSignals`
  - 仅在 top-level proof 缺失时才 fallback 到 `currentXNodeModel`
  - diagnostics 已显式记录 proof source：
    - `curator-top-level`
    - `x-node-model`

- `index.ts` → `/ptc status`
  - `latestRuntimeProof` 优先使用 top-level curator proof
  - `signalTypes` 优先使用 top-level curator proof signals

这意味着 proof object 已从“存在于结构里”进一步提升为：

> 运行时正式注入输入与正式状态观测面。

---

### 4. provisional subtree disposition 已补 proof consistency

E7 最后一刀补的是：

- confirm
- discard
- rewrite
- merge-into-existing

这些 provisional subtree 裁决动作之后，overlay 内的 proof / signal 不再允许悬空或继续指向失效 draft target。

当前已在 `grc-provisional-overlay.ts` 增加 proof target reconcile：

- **rewrite / remove subtree node**
  - 若 proof target 落在被删除节点上，不再保留悬空 target
  - 回落到 overlay 内仍有效的 target，并由 `enrichXNodeModel(...)` 重新收敛 surface

- **discard-subtree**
  - 若整个 provisional subtree 被丢弃，overlay 直接清空
  - proof / signal 不残留

- **merge-into-existing**
  - 不强行把 overlay proof 挂到 overlay 不存在的外部 confirmed 节点
  - 策略改为：保证不再继续指向失效 draft root，并在 overlay 自身可见节点集合内保持 proof surface 一致

这里的关键决策是：

> provisional overlay 的 proof / signal 一致性，首先必须对 overlay 自己可见的节点集合成立；不能为了“看起来已经 merge”而制造一个指向不存在节点的伪 target。

---

## 验证结果

### 自动化主回归

已通过：

- `npm run test:grc`

当前覆盖包括：

- curator output / normalize / proof contract
- restore / replay proof 恢复链
- before-agent-start 注入 proof surface
- `/ptc status` proof 观测面
- derivation / completion / round-state
- draft-goal runtime overlay 闭环
- provisional subtree disposition 与 proof consistency

### E7 相关专项验证

已通过：

- top-level curator proof 优先注入测试
- status runtime proof surface 测试
- curator round normalization proof 测试
- restore/replay proof 恢复测试
- provisional proof consistency 测试

### 真实 session proof

已通过：

- `scripts/draft-goal-fresh-proof.sh`

并已纳入：

- `npm run test:draft-goal`
- `npm run test:grc`

关键证据包括：

- assistant emitted `draftGoalOp` in fresh real session
- curator artifact persisted matching proof goal for round 1 replay chain
- curator artifact contains v2 goalState + signal + summaryEntry + runtime proof payload
- assistant echoed proof injection surface in a later real session turn
- runtimeProvisionalOverlay remained available as first-round bootstrap proof source
- logs confirm curator-origin proof payload + persistence / replay path

---

## 仍保留的兼容层

Phase E7 完成后，以下对象仍然保留，但定位更清楚：

- `GoalTreeDocument`
  - guard / replay / compatibility bridge
- `certaintyAssessment`
  - policy fallback / compatibility projection
- `runtimeDraftGoalState`
  - provisional compatibility bridge

但 proof 相关主链现在已经明确是：

- `RuntimeProofRecord`
- `RuntimeProofSignal`
- `GRCState.curator.latestRuntimeProof/latestProofSignals`
- `XNodeModelDocument.latestRuntimeProof/latestProofSignals`

也就是说，proof 已正式脱离“附属文案层”，进入运行时正式对象层。

---

## 结论

Phase E7 已闭合。

更准确地说，当前主链已经具备：

1. Curator 正式产出 `RuntimeProofRecord / RuntimeProofSignal`
2. artifact / state / restore / replay 稳定持久化与恢复 proof object
3. before-agent-start / status / diagnostics 正式消费 top-level proof surface
4. provisional subtree 的 confirm / discard / rewrite / merge 裁决后，proof / signal 不再悬空错挂
5. `npm run test:grc` 与 fresh real session proof 继续成立

因此当前系统的 proof 语义已从：

- 文档概念
- 脚本附注
- prompt 文案碎片

正式收口为：

> **运行时主链对象。**
