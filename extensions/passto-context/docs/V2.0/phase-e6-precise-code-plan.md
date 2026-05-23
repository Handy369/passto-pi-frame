# Phase E6 精确代码计划

> 目标：在 **不打断当前 replay / restore / status / fresh-proof 回归链** 的前提下，把当前主生产面从 `GoalTree / certainty / runtimeDraftGoalState` 混合驱动，收口为 **object-first + compatibility shrink**。  
> 日期：2026-05-20

> 状态更新（2026-05-21）：E6-1 已不止停留在“Curator 原生产出 object payload”。当前 `executeCurator(...)` 已向 `buildCuratorSubagentPrompt(...)` 传入 object-first runtime context（`userGoalTree / currentFocusXNodeModel / lastPolicyProjection / latestRuntimeProof / latestProofSignals`），`GoalStateDocument` 退为 compatibility bridge；本文件保留为当时的精确实施计划与切片依据。

---

## 0. 为什么现在进入 E6

E1-E5 已经把正式对象层接进主链：

- `UserGoalTreeDocument`
- `XNodeModelDocument`
- `XNodePolicyProjection`
- `RuntimeProofRecord / RuntimeProofSignal`
- `RuntimeProvisionalOverlay`

并且当前 runtime 已具备：

- `before-agent-start` 消费 effective object state
- restore / replay 恢复 object sidecars
- status / policy / completion surface 消费 sidecars
- E5 fresh real session proof

因此下一阶段的主要问题不再是“能力还没定义”，而是：

> **正式对象层已经存在，但 Curator 生产链、compatibility fallback 与 proof 脚本仍有较厚双轨。**

E6 的正确目标不是暴力删 legacy，而是：

> **先把主生产链切到 object-first，再把 compatibility layer 压缩到 adapter / replay bridge / fallback-only。**

---

## 1. 现状核对（基于当前代码）

### 1.1 Curator prompt / parser 仍以 `currentGoalState` 为主入口

> 注：本节描述的是 `2026-05-20` 进入 E6 时的基线，现状已不再如此。最新实现已将 Curator prompt 输入升级为 object-first runtime context，`currentGoalState` 不再是唯一主入口。

当前：

- `grc-subagent.ts`
  - `executeCurator(...)` 仍只把 `currentGoalStateJson` 传给 `buildCuratorSubagentPrompt(...)`
- `grc-prompts.ts`
  - prompt contract 仍以 `currentGoalState` 为当前目标真相源
  - 明确要求 `certaintyAssessment` 当前阶段必填
- `grc-curator-parser.ts`
  - 当前结构化解析字段包括：
    - `goalState`
    - `certaintyAssessment`
    - `latestRuntimeProof`
    - `latestProofSignals`
    - `draftGoalOp`
    - `draftDispositions`
  - **尚未解析**：
    - `userGoalTree`
    - `xNodeModels`
    - `lastPolicyProjection`

这说明当前 Curator 仍不是 object-first payload producer。

---

### 1.2 主链已具备 sidecar 写入 / 恢复能力

当前：

- `grc-state.ts`
  - `setCuratorObjectSidecars(...)`
  - `setRuntimeProvisionalOverlay(...)`
  - `restoreGRCState(...)` 可恢复：
    - `lastUserGoalTree`
    - `lastXNodeModels`
    - `lastPolicyProjection`
    - `runtimeProvisionalOverlay`
- `grc-restore.ts`
  - curator artifact replay 已消费：
    - `userGoalTree`
    - `xNodeModels`
    - `lastPolicyProjection`
    - `runtimeProvisionalOverlay`
- `before-agent-start-injection.ts`
  - 已优先使用 `getEffectiveObjectState(...)`
  - policy 注入优先使用 `currentPolicyProjection`，只有缺失时才 fallback 到 `certaintyAssessment`

这说明 sidecar 消费链已经 ready，主要缺口在 producer 主链。

---

### 1.3 `runtimeDraftGoalState` 仍是活跃兼容桥

当前：

- `index.ts` 的 `maybeApplyDraftGoalOpFromBranch(...)`
  - 仍会写 `runtimeDraftGoalState`
  - 同时也会写 `runtimeProvisionalOverlay`
- `scripts/draft-goal-fresh-proof.sh`
  - 仍以 `runtimeDraftGoalState` 为关键断言对象
- 多个测试仍直接断言 draft goal overlay 的 GoalTree 表现

这说明 draft/provisional 主语义虽已进入 object overlay，但 legacy draft bridge 还没压到 fallback-only。

---

### 1.4 `certaintyAssessment` 仍是广泛 compatibility fallback

当前：

- `grc-prompts.ts`
  - 明确要求 v2 GoalTree 输出时 `certaintyAssessment` 必填
- `before-agent-start-injection.ts`
  - `buildNextStepPolicyInjection(currentPolicyProjection, certaintyAssessment)`
- `grc-curator-normalizer.ts`（通过现有测试可见）
  - 当模型缺失 certaintyAssessment 时会保守回填
- 多个脚本 / 测试仍以 `certaintyAssessment.nextStepType` 为主断言之一

这说明 policy 虽已对象化，但 certainty 还不是严格意义上的 fallback-only。

---

## 2. E6 总目标

把当前运行面收口为：

```text
Curator 原生产出 object payload
  ↓
state / restore / replay 优先存取 object sidecars
  ↓
before-agent-start / status / policy / proof surface 优先消费 object sidecars
  ↓
GoalTree / certainty / runtimeDraftGoalState 仅保留为 compatibility bridge
```

---

## 3. 切片总览

E6 建议拆成四刀，按依赖顺序推进：

1. **E6-1 Curator object-first payload**
2. **E6-2 GoalTree 降级为 adapter / guard bridge**
3. **E6-3 runtimeDraftGoalState shrink**
4. **E6-4 certaintyAssessment shrink**

其中只有 E6-1 是硬前置；后面三刀都应建立在 Curator 原生 sidecar 已接主链的前提上。

---

## 4. E6-1：Curator object-first payload

### Why

当前最大结构缺口不是消费层，而是生产层：

- Curator prompt 仍以 `currentGoalState` 为主
- parser 仍不解析 object sidecars
- `index.ts` 中 sidecars 仍主要依赖从 `goalState` 派生 / 回填

如果不先改这一层，后续 shrink 只能停留在“消费优先级调整”，不是主链真收口。

### What

让 Curator 在 JSON payload 中原生产出：

- `userGoalTree`
- `xNodeModels`
- `lastPolicyProjection`（或同语义字段，最终在 parser 收口成该字段）
- 继续保留：
  - `goalState`
  - `certaintyAssessment`
  - `draftDispositions`
  - `latestRuntimeProof`
  - `latestProofSignals`

即：

> 当前阶段不是删掉 compatibility 字段，而是 **新增 object-first producer contract**。

### 改动面

#### A. `types.ts`
- 确认 `CuratorResult` 与 `CuratorArtifactEntry` 支持：
  - `userGoalTree?: UserGoalTreeDocument | null`
  - `xNodeModels?: XNodeModelDocument[] | null`
  - `lastPolicyProjection?: XNodePolicyProjection | null`

#### B. `grc-prompts.ts`
- 改 `buildCuratorSubagentPrompt(...)`
- 在 V2 路径中明确要求：
  - GoalTree compatibility output 继续保留
  - 但 JSON payload **必须原生产出** `userGoalTree / xNodeModels`
  - policy projection 优先以 object 形式输出，`certaintyAssessment` 仅作 compatibility 字段继续保留
- 在 prompt 示例 JSON 中补这些字段

#### C. `grc-curator-parser.ts`
- 解析：
  - `userGoalTree`
  - `xNodeModels`
  - `lastPolicyProjection`
- 若这些字段缺失：
  - 允许先返回 null / []
  - 不在 parser 中做复杂推导

#### D. `grc-subagent.ts`
- 初版计划：`executeCurator(...)` 先保持 `currentGoalState` 输入不变，仅让执行后返回的 `CuratorResult` 携带解析出的 sidecars
- 实际落地（2026-05-21）：`executeCurator(...)` 已进一步前推到 object-first 输入真相源，会在调用 prompt builder 前先构造并传入：
  - `goalStateJson`
  - `userGoalTree`
  - `xNodeModel`
  - `lastPolicyProjection`
  - `latestRuntimeProof`
  - `latestProofSignals`
  从而让 Curator 输入与输出两侧都进入 object-first 主链。

#### E. `index.ts`
- Curator result apply 路径优先使用：
  - `reconciledResult.userGoalTree`
  - `reconciledResult.xNodeModels`
  - `reconciledResult.lastPolicyProjection`
- 仅当 Curator 未给出 sidecars 时，才回退到现有派生链

### 验收标准

- `grc-curator-parser.ts` 单测覆盖 `userGoalTree + xNodeModels + lastPolicyProjection`
- `CuratorArtifactEntry` 可持久化并 restore/replay 这些字段
- `index.ts` 在 Curator 原生 sidecars 存在时，不再依赖从 `goalState` 再派生
- `npm run test:grc` 通过
- 后续收口验证（2026-05-21）：`npm run test:regression` 全绿，说明 E6-1 的 object-first 输入升级未打断 tmux / replay / midrun 主回归链

### 建议新增测试

- `tests/grc-curator-output.test.ts`
  - 新增 object payload 解析场景
- `tests/index-restore-replay.test.ts`
  - 新增原生 object payload replay 优先级场景
- 可新增：`tests/grc-curator-object-sidecars.test.ts`
  - 只测“原生 sidecars 优先于派生 fallback”

---

## 5. E6-2：GoalTree 降级为 adapter / guard bridge

> 状态：已落地（2026-05-21）

### Why

当前多个模块仍直接围绕 `GoalTreeDocument` 主逻辑工作：

- `grc-curator-guard.ts`
- `grc-goal-view.ts`
- `grc-goal-transition.ts`
- `grc-goal-context.ts`

它们会让 compatibility layer 继续扮演主对象，而不是桥。

### What

目标不是删除 GoalTree，而是把它降级成：

- curator guard bridge
- replay / migration bridge
- prompt fallback view

而新的主消费对象优先变成：

- `UserGoalTreeDocument`
- `XNodeModelDocument`

### 改动面

#### A. `grc-goal-view.ts`
- 明确区分：
  - object-native summary
  - legacy GoalTree summary
- 若有 object sidecars，则优先基于 sidecars 生成可视摘要

#### B. `grc-goal-context.ts`
- 优先从 `UserGoalTreeDocument` / 当前 `XNodeModelDocument` 派生焦点上下文
- GoalTree 仅作 fallback

#### C. `grc-goal-transition.ts`
- 优先比较 object sidecars 的 focus / completion / migration 信号
- GoalTree 只作为兼容迁移摘要来源

#### D. `grc-curator-guard.ts`
- 当前 guard 仍 heavily dependent on GoalTree
- E6-2 的策略不是重写全部 guard，而是：
  - 保留 GoalTree guard
  - 增加 object-sidecar 一致性检查
  - 至少能识别 “goalState 与 sidecars 明显冲突” 的场景

### 验收标准

- 新 surface / helper 优先消费 object sidecars
- GoalTree 在这些模块中只剩 fallback / adapter 角色
- 不破坏现有 replay 与 status 输出

### 已完成结果
- `grc-goal-view.ts` 已新增 object-sidecar 原生视图构造
- `grc-goal-context.ts` 已支持从 object sidecars 构造 reflector goal context
- `grc-goal-transition.ts` 已优先基于 object sidecars 生成 transition summary
- `before-agent-start-injection.ts` diagnostics 已显式区分 `object-sidecars-primary` 与 `goal-state-fallback`
- GoalTree 保留为 fallback / replay / guard bridge

---

## 6. E6-3：runtimeDraftGoalState shrink

> 状态：已落地（2026-05-21）

### Why

E5 后真正的 provisional 主对象已经是：

- `runtimeProvisionalOverlay.userGoalState`
- `runtimeProvisionalOverlay.xNodeState`

但当前仍保留旧桥：

- `runtimeDraftGoalState`

它不应继续扮演 draft/provisional 的主语义对象。

### What

把 `runtimeDraftGoalState` 收口为：

- GoalTree compatibility bridge
- replay-friendly draft proof bridge
- 旧脚本兼容层

### 改动面

#### A. `index.ts`
- `maybeApplyDraftGoalOpFromBranch(...)` 中保留双写，但明确：
  - `runtimeProvisionalOverlay` 为主
  - `runtimeDraftGoalState` 为 compatibility mirror
- 日志可增加 source label，避免调试时把主桥误认成真相源

#### B. `before-agent-start-injection.ts`
- 继续以 `getEffectiveObjectState(...)` 为主
- draft 相关 debug / diagnostics 中，优先显示 provisional overlay 命中，而不是 draft GoalTree 命中

#### C. proof 脚本
- `scripts/draft-goal-fresh-proof.sh`
  - 从“必须断言 runtimeDraftGoalState”调整为：
    - 必须断言 `runtimeProvisionalOverlay`
    - `runtimeDraftGoalState` 作为兼容额外检查项

### 验收标准

- 新 proof 口径把 `runtimeProvisionalOverlay` 作为主证据
- `runtimeDraftGoalState` 仍保留但不再是唯一必经断言

### 已完成结果
- `index.ts` 已明确日志语义：`runtimeProvisionalOverlay` 为 primary，`runtimeDraftGoalState` 为 bridge
- `before-agent-start-injection.ts` 已优先显示 provisional overlay 命中
- `scripts/draft-goal-fresh-proof.sh` 已改为 overlay-first proof，draft state 退为兼容校验

---

## 7. E6-4：certaintyAssessment shrink

> 状态：已落地（2026-05-20）

### Why

当前 policy object 已存在：

- `XNodePolicyProjection`
- `lastPolicyProjection`

但 prompt / tests / scripts 仍普遍把 `certaintyAssessment` 当半主对象使用。

### What

把 `certaintyAssessment` 收口为：

- compatibility fallback
- LLM payload 稳定器
- 旧脚本兼容输出

### 改动面

#### A. `grc-prompts.ts`
- 仍要求输出 `certaintyAssessment`
- 但在 contract 文字中明确：
  - `lastPolicyProjection` / object policy 为主
  - `certaintyAssessment` 为 compatibility projection

#### B. `before-agent-start-injection.ts`
- 保持现有优先级：
  - `currentPolicyProjection`
  - fallback `certaintyAssessment`
- 增加更明确的 debug source 标识，便于回归验证 fallback 是否真的只在缺失时发生

#### C. 测试 / 脚本
- 减少“只断言 certaintyAssessment.nextStepType”
- 优先断言：
  - `lastPolicyProjection.nextStepType`
  - prompt 中 `当前 x-node policy projection:`
- certainty 只断言 fallback 路径存在且兼容

### 验收标准

- 生产口径中 policy 是主对象
- certainty 是 fallback-only
- 所有关键回归仍通过

### 已完成结果
- prompt / runtime surface 已明确 `lastPolicyProjection` / object policy 为主
- `certaintyAssessment` 已退为 compatibility projection / fallback-only
- 关键回归已通过 `npm run test:grc`

---

## 8. 推荐实施顺序

### Step 1
先做 **E6-1 Curator object-first payload**。

### Step 2
补 **E6-1 回归**：
- parser
- replay
- state apply priority

### Step 3
再做 **E6-3 / E6-4** 中较轻的一刀（建议先 E6-4）

### Step 4
最后做 **E6-2 GoalTree shrink**，因为它最容易牵动 guard / summary / transition。

推荐顺序：

```text
E6-1 → E6-4 → E6-3 → E6-2
```

原因：
- 先补 producer
- 再压 policy fallback
- 再压 draft bridge
- 最后再处理 GoalTree 主逻辑残留

---

## 9. 回归要求

E6 每一刀后都至少跑：

```bash
npm run test:grc
```

E6-1 / E6-3 落地后建议额外跑：

```bash
npm run test:curator-replay
./scripts/draft-goal-fresh-proof.sh
```

若改动触及 restore / replay / event 注入主链，建议最终补跑：

```bash
npm run test:regression
```

---

## 10. 最小完成定义

E6 不要求一轮完成全部 compatibility 删除。

E6 的最小完成定义是：

1. Curator 已能原生产出 object sidecars
2. 主链 apply / replay / injection 已优先消费 object sidecars
3. `runtimeDraftGoalState` 与 `certaintyAssessment` 明确退到 compatibility 角色
4. GoalTree 不再是新增实现的默认主对象

---

## 11. 一句话

> E6 的正确做法不是“删旧状态”，而是：**先让 Curator 与主链原生站到 `UserGoalTreeDocument + XNodeModelDocument + XNodePolicyProjection + RuntimeProvisionalOverlay` 这一侧，再把 GoalTree / certainty / runtimeDraftGoalState 稳定压缩成 bridge。**
