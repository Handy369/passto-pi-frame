# Compatibility Governance Plan

> 状态：Draft  
> 日期：2026-05-21

## 目标

这份文档不是重新争论 V2.0 主线是否成立，而是在 **E6 object-first 收口** 与 **E7 proof 主链化** 已闭合之后，基于当前代码事实回答：

> **`GoalTreeDocument`、`certaintyAssessment`、`runtimeDraftGoalState` 这三类 compatibility bridge 现在还剩什么职责？哪些应保留，哪些应冻结，哪些可继续 shrink？**

本文依据以当前实现为准，重点核对了：
- `grc-state.ts`
- `before-agent-start-injection.ts`
- `grc-curator-normalizer.ts`
- `grc-goal-tree.ts`
- `grc-provisional-overlay.ts`
- `grc-policy-surface.ts`
- `grc-restore.ts`
- `index.ts`
- `grc-prompts.ts`

---

## 1. 总结结论

> 当前治理计划是 **post-V2 hardening backlog**，不是 V2.0 主线完成前的阻塞项。

当前三类 compatibility bridge 都**还不是纯死代码**，但其角色已经清晰分化：

1. `GoalTreeDocument`
   - 仍然是 **v1/v2 目标状态兼容层、draft disposition apply 桥、restore/replay 兼容载体、旧 surface 的 fallback 目标视图载体**
   - 不再是 object-first 主链的新增默认对象

2. `certaintyAssessment`
   - 仍然是 **Curator 输出合同稳定器、policy fallback、旧 runtime surface 的兼容策略摘要**
   - 已不再是主策略对象；主策略对象是 `lastPolicyProjection`

3. `runtimeDraftGoalState`
   - 仍然是 **generator 当轮 draftGoalOp 的 GoalTree bridge、before-agent-start 的兼容 goal-state bridge、fresh-proof / replay-friendly 的过渡镜像**
   - 已不再是 provisional 主对象；主对象是 `RuntimeProvisionalOverlay`

因此当前治理原则不是“立刻删除”，而是：

> **保留仍参与真实运行链的 bridge；冻结其能力边界；新增实现一律 object-first；待 bridge 的 runtime 责任被完全替换后再 shrink / retirement。**

当前执行建议：

- 不立即删除 `GoalTreeDocument` / `certaintyAssessment` / `runtimeDraftGoalState`
- 不把 compatibility shrink 作为 V2.0 release blocker
- 新增实现若涉及目标、策略、proof、provisional/subtree 裁决，一律从 object-first 主对象进入
- 只有当 fresh-session / replay / restore / status surface 证据表明某个 bridge 的 runtime 责任已完全消失时，才进入 shrink / retirement

---

## 2. 三类 compatibility bridge 的代码事实盘点

## 2.1 `GoalTreeDocument`

### 当前仍在承担的职责

#### A. v1 / v2 目标状态兼容与升级桥
代码依据：
- `grc-goal-tree.ts`
  - `isGoalTreeDocument(...)`
  - `ensureGoalTreeDocument(...)`
  - `upgradeGoalStateToTree(...)`
  - `downgradeTreeToGoalState(...)`

说明：
- 当前系统仍允许 `GoalStateDocument | GoalTreeDocument` 共同进入部分逻辑
- `GoalTreeDocument` 仍承担 v1 → v2 升级与必要的回写桥接职责

#### B. draft disposition apply 的操作载体
代码依据：
- `grc-curator-guard.ts` 的 `applyDraftDispositionsToGoalState(...)`
- `grc-provisional-overlay.ts` 中先把 `XNodeModelDocument` 临时转成 `GoalTreeDocument`，再复用 draft disposition apply 逻辑

说明：
- 当前 subtree rewrite / discard / merge 的部分兼容处理仍借助 GoalTree 形状完成
- 这说明 `GoalTreeDocument` 仍是 **draft 裁决桥**，而不是只剩展示层

#### C. restore / replay / artifact 兼容载体
代码依据：
- `grc-restore.ts`
- `grc-curator-parser.ts`
- `grc-curator-normalizer.ts`
- `grc-state.ts`

说明：
- Curator artifact 仍解析、恢复和归一化 `goalState`
- object sidecars 已是主链，但 `goalState` 仍保留在 artifact / restore 中作为兼容载体

#### D. fallback goal view / transition / summary 载体
代码依据：
- `before-agent-start-injection.ts` 先取 `effectiveGoalState`
- `grc-goal-view.ts` / `grc-goal-transition.ts` / `grc-goal-state-summary.ts`

说明：
- 尽管 object-sidecars-primary 已是优先路径，但 `goalState` 仍支撑 fallback goal view、transition summary 与部分摘要逻辑

### 当前不应再承担的职责
- 不应再作为新 feature 的默认 truth source
- 不应再承接新的“主策略对象”语义
- 不应再扩展成新的主运行时对象层

### 治理分类
- **必须保留（当前阶段）**
  - v1/v2 升级桥
  - artifact / replay / restore 兼容载体
  - draft disposition apply 复用桥
- **冻结不再扩展**
  - 任何新的主语义字段
  - 新 surface 的 primary data source 身份
- **可继续 shrink 候选**
  - 将更多 transition / summary / view 逻辑改为 object-sidecars-primary，逐步降低对 `GoalTreeDocument` fallback 的依赖

---

## 2.2 `certaintyAssessment`

### 当前仍在承担的职责

#### A. Curator 输出合同稳定器（已从“提示词必填”降级为“可省略，运行时补齐”）
代码依据：
- `grc-prompts.ts`
  - 当前已改为：`certaintyAssessment` 仅作为 compatibility projection / fallback-only 字段保留，可输出，也允许省略或为 null
- `grc-curator-parser.ts`
- `grc-curator-normalizer.ts`
  - 当 Curator 未显式产出时，优先从 `lastPolicyProjection` / x-node policy 回填；若 object policy 也缺失，再回填保守默认值

说明：
- 当前 `certaintyAssessment` 仍是 Curator 输出 payload 的 compatibility 稳定器
- 但它已经不再是提示词合同层面的必填字段
- 它的存在价值是：即使 object policy 缺失，surface 仍有最小保守策略可用

#### B. runtime policy fallback
代码依据：
- `before-agent-start-injection.ts`
  - `buildNextStepPolicyInjection(currentPolicyProjection, certaintyAssessment)`
- `grc-prompts.ts`
  - `buildNextStepPolicyInjection(...)` 中若无 `policyProjection`，会从 `certaintyAssessment` 投影兼容 policy
- `grc-policy-surface.ts`
  - 若当前拿不到 x-node policy，则 fallback 到 `certaintyAssessment`

说明：
- 当前 runtime surface 仍允许：
  - primary = `lastPolicyProjection`
  - fallback = `certaintyAssessment`

#### C. 旧 surface / diagnostics 的兼容摘要
代码依据：
- `before-agent-start-injection.ts` diagnostics
- `grc-policy-surface.ts`
- 多个相关测试明确验证 compatibility fallback 路径仍存在

说明：
- 当前它仍承担运行态观测面上的兼容摘要角色

### 当前不应再承担的职责
- 不应再被视为主策略对象
- 不应驱动新增 object-first 逻辑的上游真相源
- 不应继续膨胀为与 `XNodePolicyProjection` 并列的长期正式对象

### 治理分类
- **必须保留（当前阶段）**
  - Curator payload compatibility 稳定器
  - policy fallback
- **冻结不再扩展**
  - 不新增专属语义，不再丰富为独立主对象体系
- **本轮已完成的 shrink**
  - 已从“提示词必填”降为“可省略 / 可为 null，由运行时内部补齐”
- **后续 shrink 候选**
  - 当 restore/replay/status/diagnostics 对 object policy 的依赖进一步稳定后，可评估减少 artifact/state 对 `lastCertaintyAssessment` 的镜像依赖

---

## 2.3 `runtimeDraftGoalState`

### 当前仍在承担的职责

#### A. generator 当轮 draftGoalOp 的 GoalTree bridge
代码依据：
- `index.ts` → `maybeApplyDraftGoalOpFromBranch(...)`
  - 当前仍先以 `baseGoalState` 为基础应用 `draftGoalOp`
  - 成功后写入 `setRuntimeDraftGoalState(...)`

说明：
- 这表明当轮 draft anchor 的一个兼容可见面仍然是 GoalTree bridge，而不是只有 overlay

#### B. effectiveGoalState 的优先来源
代码依据：
- `grc-state.ts`
  - `getEffectiveGoalState(...) = runtimeDraftGoalState?.goalState ?? lastGoalState`
- `before-agent-start-injection.ts`
  - 注入链仍以 `effectiveGoalState` 作为 goal-state bridge 输入

说明：
- 只要 runtimeDraftGoalState 存在，它当前仍会直接影响注入阶段看到的 goal-state 兼容视图

#### C. fresh-proof / replay-friendly draft bridge
代码依据：
- `grc-state.ts` restore 逻辑
- `before-agent-start-injection.ts` diagnostics 会显式标记 `goal-state-bridge`
- `phase-e6-closure-note.md` 也已明确它保留为 compatibility / replay-friendly draft proof bridge

说明：
- 当前它仍对可恢复性与 proof 证据链有现实价值

### 当前不应再承担的职责
- 不应再被视为 draft / provisional 的 primary object
- 不应替代 `RuntimeProvisionalOverlay`
- 不应成为未来 subtree 级操作的新承载层

### 治理分类
- **必须保留（当前阶段）**
  - generator draftGoalOp 的兼容桥
  - goal-state 注入 bridge
  - replay-friendly draft proof bridge
- **冻结不再扩展**
  - 不再新增围绕它的主逻辑分支
- **可继续 shrink 候选**
  - 当 before-agent-start / replay / fresh-proof 已可完全依赖 overlay + object sidecars 时，评估是否把其存在性降到更窄的镜像层

---

## 3. 治理总原则

## 3.1 object-first 是唯一新增实现入口

从现在开始，新增功能若涉及：
- 用户目标树
- x-node-model
- 当前策略对象
- proof / signal
- provisional / subtree 裁决

应优先接入：
- `UserGoalTreeDocument`
- `XNodeModelDocument`
- `XNodePolicyProjection`
- `RuntimeProofRecord / RuntimeProofSignal`
- `RuntimeProvisionalOverlay`

而不是先做在：
- `GoalTreeDocument`
- `certaintyAssessment`
- `runtimeDraftGoalState`

---

## 3.2 compatibility bridge 只能做三类事

允许继续存在的 bridge 职责，仅限于：
1. **adapter**：旧输入 / 旧对象升级到当前对象
2. **fallback**：主对象缺失时提供最小可用保守输出
3. **replay-friendly bridge**：为恢复、回放、诊断维持兼容观察面

超出这三类的新增职责，原则上都应拒绝。

---

## 3.3 新增代码必须显式标注 primary / fallback source

当前代码里已经有较好的模式，例如：
- `before-agent-start-injection.ts`
  - `object-sidecars-primary`
  - `goal-state-fallback`
- policy injection
  - `policyProjection`
  - `certaintyFallback`

后续新增 surface 也应延续此模式：

> **任何兼容桥路径都必须在命名、diagnostics 或注释里显式标识为 fallback / compatibility。**

避免未来维护者误把 fallback 当 primary。

---

## 4. 下一步 shrink 候选清单

### S1. Goal view / transition / summary 继续去 GoalTree-first — 已完成（2026-05-21）
结果：
- `grc-goal-view.ts` / `grc-goal-transition.ts` / `grc-goal-state-summary.ts` 已进一步收口到 object-sidecars-primary
- `before-agent-start` goal-state injection 与 Reflector goalContext 也已切到 object-sidecars-primary
- GoalTree / goalState 仅保留 compatibility fallback / bridge 角色
- draft signal 的 `[draft]` 可见性通过 `runtimeDraftGoalState` 提供最小 bridge 保留，但不再把 GoalTree 抬回主对象
- 验证：`tests/before-agent-start-injection.test.ts`、`tests/grc-goal-view-alignment.test.ts`、`tests/reflector-input.test.ts`、`tests/reflector-grounding.test.ts`、`npm run test:reflector`、`npm run test:context-manager` 通过

### S2. `certaintyAssessment` 从“提示词必填”降级为“运行时可内部补齐”
前提：
- Curator object policy 稳定
- restore / replay / diagnostics 对 object policy 覆盖充分

### S3. `runtimeDraftGoalState` 缩到更窄的 mirror 层
前提：
- `before-agent-start` 与 fresh proof 已能完全依赖 overlay/object sidecars
- 不再需要以 GoalTree bridge 形式向 prompt 暴露 draft 状态

### S4. 兼容桥回归测试分层
目标：
- 把“主链回归”和“兼容桥未破坏回归”分层表达
- 防止为了照顾 bridge 语义而模糊主链验收标准

---

## 5. 明确不建议的动作

当前阶段**不建议**：
- 暴力删除 `GoalTreeDocument`
- 直接移除 `certaintyAssessment`
- 直接废弃 `runtimeDraftGoalState`
- 在没有 fresh-session / replay / restore 证据的情况下宣布 compatibility bridge 可清理

因为代码事实显示它们仍参与真实运行链，而不只是历史残留。

---

## 6. 一句话

> 当前三类 compatibility bridge 仍有真实运行时职责，但都已经不再是主对象；接下来的正确动作不是“立刻删掉”，而是：**锁死其 bridge 边界，让所有新增实现继续走 object-first，并在证据充分后逐步 shrink / retirement。**
