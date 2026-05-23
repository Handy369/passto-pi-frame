# Phase E6 Closure Note

> 状态：Closed  
> 日期：2026-05-21

## 目标

Phase E6 的目标不是删除 legacy 结构，而是在不打断 replay / restore / status / fresh-proof 回归链的前提下，把当前主生产面从：

- `GoalTreeDocument`
- `certaintyAssessment`
- `runtimeDraftGoalState`

混合驱动，进一步收口为：

- `UserGoalTreeDocument`
- `XNodeModelDocument`
- `XNodePolicyProjection`
- `RuntimeProvisionalOverlay`

也就是说，E6 的本质是：

> 让 object-first 成为主消费链，让 GoalTree / certainty / runtimeDraftGoalState 退到 compatibility bridge。

---

## 本次实际落地

### 1. Curator 已进入 object-first 输入 / 输出主链

Curator 当前不仅输出已正式携带：

- `userGoalTree`
- `xNodeModels`
- `lastPolicyProjection`

而且输入侧也已升级为 object-first runtime context：

- `userGoalTree`
- `currentFocusXNodeModel`
- `lastPolicyProjection`
- `latestRuntimeProof`
- `latestProofSignals`
- `goalState` 仅保留为 compatibility bridge / 文本投影层

主链 apply 时：

- 优先消费 Curator 原生 object sidecars
- 仅在缺失时才 fallback 到从 `GoalState` 派生

这意味着 `GoalTreeDocument` 不再是 Curator 主输入 / 主输出的唯一语义承载。

---

### 2. GoalTree 已降级为 adapter / guard bridge

以下运行面已优先转到 object-first：

- `grc-goal-view.ts`
  - 已新增 object-sidecar 原生视图构造
- `grc-goal-context.ts`
  - 已支持从 `UserGoalTreeDocument + XNodeModelDocument[]` 构造 goal context
- `grc-goal-transition.ts`
  - 已优先基于 object sidecars 生成 transition summary
- `before-agent-start-injection.ts`
  - diagnostics 已显式区分 `object-sidecars-primary` 与 `goal-state-fallback`

当前 `GoalTreeDocument` 的保留角色是：

- curator guard bridge
- replay / migration bridge
- prompt fallback view

而不再是新增 surface / helper 的默认主对象。

---

### 3. runtimeDraftGoalState 已退为 compatibility bridge

在 E5 之后，draft / provisional 的主运行时对象已经是：

- `runtimeProvisionalOverlay.userGoalState`
- `runtimeProvisionalOverlay.xNodeState`

E6 进一步把：

- `runtimeDraftGoalState`

收口为：

- compatibility bridge
- replay-friendly draft proof bridge
- 旧脚本兼容层

当前主链语义已明确为：

- `runtimeProvisionalOverlay` 为 primary
- `runtimeDraftGoalState` 为 bridge mirror

---

### 4. certaintyAssessment 已退为 fallback-only

当前主 policy 对象已经收口到：

- `XNodePolicyProjection`
- `lastPolicyProjection`

E6 后：

- prompt / runtime surface 已明确 object policy 为主
- `certaintyAssessment` 保留为 compatibility projection
- 仅在 object policy 缺失时才 fallback 使用 certainty

也就是说，`certaintyAssessment` 的定位已从“半主对象”收紧为：

> compatibility fallback / payload stabilizer / legacy output surface

---

### 5. 主消费链已稳定收口为 object-first

当前代码口径可概括为：

```text
effective main path
  = UserGoalTreeDocument
  + XNodeModelDocument
  + XNodePolicyProjection
  + RuntimeProvisionalOverlay
```

对应地：

- `GoalTreeDocument`：adapter / guard / replay bridge
- `runtimeDraftGoalState`：compatibility bridge
- `certaintyAssessment`：fallback-only projection

这标志着 E6 的主要目标已经闭合：

> object-first 已成为主生产面，legacy bridge 已压缩到兼容层。

---

## 验证结果

### 自动化

已通过：

- `npm run test:grc`
- `npm run test:regression`

覆盖：

- curator payload / apply
- restore / replay
- reflector / goal context
- before-agent-start injection / event
- status surface
- derivation / completion
- draft-goal runtime proof

### E6 相关专项验证

已通过：

- object-sidecar goal view / context alignment 测试
- object-sidecar transition summary 测试
- before-agent-start object-first diagnostics 验证

### 真实 session proof

已通过：

- `scripts/draft-goal-fresh-proof.sh`

关键证据包括：

- `runtimeProvisionalOverlay` persisted as primary first-round bootstrap proof source
- `runtimeDraftGoalState` remained available as compatibility bridge
- curator artifact contains v2 goalState + object sidecars + runtime proof payload
- logs confirm runtime overlay + curator-origin proof payload + shutdown persistence path

---

## 仍保留的过渡层

Phase E6 完成后，以下结构仍保留用于兼容与回放：

- `GoalTreeDocument`
- `runtimeDraftGoalState`
- `certaintyAssessment`
- `draftDispositions`

但它们现在的定位已经明确变成：

> compatibility / adapter / guard / replay-friendly bridge

而不是主消费链本身。

---

## 结论

Phase E6 已闭合。

更准确地说，当前主链已经具备：

1. Curator 原生产出 object-first payload
2. apply / replay / before-agent-start / status 优先消费 object sidecars
3. `runtimeProvisionalOverlay` 成为 provisional 主对象
4. `GoalTreeDocument` / `runtimeDraftGoalState` / `certaintyAssessment` 全部退到兼容桥角色
5. 全量回归与真实 session proof 继续成立（截至 `2026-05-21`，`npm run test:regression` 全绿）
