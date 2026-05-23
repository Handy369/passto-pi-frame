# Phase E7 Proof Mainchain Plan

> 目标：在 **不打断当前 object-first / replay / restore / status / fresh-proof 回归链** 的前提下，把 `RuntimeProofRecord / RuntimeProofSignal` 从设计对象收口为 **Curator 正式产出、状态主链消费、provisional subtree 一致承接** 的运行时一等对象。  
> 日期：2026-05-21

---

## 0. 为什么现在进入 E7

E4-E6 已经完成了当前主链的关键收口：

- E4：双层完成闭环已落地
- E5：provisional overlay 已落地
- E6：主消费链已收口为 object-first，legacy bridge 已压缩到 compatibility 层

当前剩余的主要缺口，不再是：

- GoalTree 是否还是主对象
- policy 是否还是 certainty-first
- provisional overlay 是否存在

而是：

> **proof 虽然已在设计文档、测试断言与部分 prompt surface 中出现，但仍未完整成为 Curator → artifact → restore/replay → injection/status 的正式主链对象。**

因此 E7 的目标不是继续清理 legacy，也不是引入硬 scheduler，而是：

> **完成 proof-first runtime closure。**

---

## 1. 现状核对（基于当前设计与已落地阶段）

### 1.1 proof contract 已在设计层明确，但主链闭合仍不完整

当前设计文档已经明确给出：

- `RuntimeProofRecord`
- `RuntimeProofSignal`

并且对象挂载位置已清楚：

- `XNodeModelDocument.latestRuntimeProof`
- `XNodeModelDocument.latestProofSignals`

说明 proof 在 V2.0 中并不是附属文案，而是 x-node-model 的正式运行时组成部分。

---

### 1.2 Curator 是 proof 的正式 producer，但当前实现口径仍偏混合态

根据 `curator-v2.0.md`：

- Generator 负责输出结果 + 方法 + proof hint
- Curator 负责在下一轮 `before_agent_start`：
  - 回收 `RuntimeProofRecord`
  - 记录 `RuntimeProofSignal`
  - 与 user goal tree / x-node-model / policy 一起注入下一轮

因此 E7 的核心生产责任链应是：

```text
Generator output / runtime evidence
  ↓
Curator parse + normalize
  ↓
RuntimeProofRecord / RuntimeProofSignal
  ↓
artifact / state / restore / replay
  ↓
injection / status / diagnostics
```

---

### 1.3 provisional subtree 已要求与 proof 一致裁决

根据：

- `draft-goal-runtime-spec-v1.md`
- `design-draft-goal-recognition.md`

provisional subtree 不只是结构对象，也允许携带：

- provisional proof
- proof gap
- proof signal

因此下一轮 Curator 在处理：

- confirm
- revise
- discard
- subtree rewrite

时，也必须考虑：

- 哪些 proof 可保留
- 哪些 proof 应废弃
- 哪些 proof signal 需要继续保留用于后续分析

这意味着 E7 不能只做 confirmed sidecar proof，还必须补：

> **proof 与 provisional subtree disposition 的最小一致性。**

---

## 2. E7 总目标

把当前 proof 相关能力收口为：

```text
Curator 正式产出 RuntimeProofRecord / RuntimeProofSignal
  ↓
state / artifact / restore / replay 稳定持久化与恢复
  ↓
before-agent-start / status / diagnostics 消费 proof object
  ↓
provisional subtree 裁决时维持 proof / signal 一致性
```

也就是说，E7 完成后，proof 应具备以下地位：

- 正式对象
- 正式日志信号
- 正式注入输入
- 正式状态观测面

而不再只是：

- 测试脚本附注
- prompt 文案碎片
- 自然语言里的“我已经验证过了”

---

## 3. 切片总览

E7 建议拆成四刀：

1. **E7-1 Proof contract + Curator producer**
2. **E7-2 Persist / restore / replay**
3. **E7-3 Injection / status / diagnostics**
4. **E7-4 Provisional proof consistency**

推荐顺序：

```text
E7-1 → E7-2 → E7-3 → E7-4
```

原因：
- 先定 contract 与 producer
- 再补持久化链
- 再补消费面
- 最后处理 provisional subtree 一致性

---

## 4. E7-1：Proof contract + Curator producer

### Why

当前 proof 的主要缺口不是“完全没有概念”，而是：

- contract 虽已设计，但未稳定成为实现主合同
- Curator 虽被定义为 proof producer，但尚未形成清晰的 object-first proof 生产链

如果不先固定 contract 和 producer，后续 replay / status / provisional 只能围绕松散字段修补。

### What

以 `goal-tree-v2.0.md` 为准，稳定最小 contract：

#### `RuntimeProofRecord`
- `targetXNodeId`
- `atRound`
- `resultSummary`
- `proofMode`
- `proofStatus`
- `evidence`
- `verificationMethod`

#### `RuntimeProofSignal`
- `id`
- `targetXNodeId`
- `atRound`
- `type`
- `message`
- `suggestedNextStepType?`
- `evidence?`

并明确生产职责：

- Generator：输出结果 + 方法 + proof hint
- Curator：归并为正式 `RuntimeProofRecord / RuntimeProofSignal`

### 改动面

#### A. `types.ts`
- 核对并收敛 `RuntimeProofRecord` / `RuntimeProofSignal` 的最小字段合同
- 确认其在 `XNodeModelDocument` / `CuratorResult` / `CuratorArtifactEntry` 中的挂载位置

#### B. `grc-prompts.ts`
- 在 Curator V2 prompt 中明确要求：
  - 若上一轮输出包含明确 proof / verification path，则回收为 `RuntimeProofRecord`
  - 若 proof 缺失 / 冲突 / 不完整，则必须产出 `RuntimeProofSignal`
- 在 prompt 示例中补 proof payload 结构

#### C. `grc-curator-parser.ts`
- 解析：
  - `latestRuntimeProof`
  - `latestProofSignals`
- 对缺失字段做保守兼容，但不在 parser 中做复杂语义推理

#### D. `grc-curator-normalizer.ts`
- 做最小 normalize：
  - proof signal id 回填
  - target round 回填
  - 允许空 evidence，但不允许非法 type

#### E. `index.ts`
- Curator apply 路径正式接纳 proof object
- proof object 与 userGoalTree / xNodeModels / policy 一起进入 object-first result apply

### 验收标准

- Curator JSON payload 可稳定携带 `latestRuntimeProof + latestProofSignals`
- parser / normalize 单测覆盖：
  - passed proof
  - missing proof signal
  - conflicted proof signal
- `npm run test:grc` 通过

---

## 5. E7-2：Persist / restore / replay

### Why

如果 proof object 只存在于单轮 Curator 结果里，而不能稳定进入：

- artifact
- state
- restore / replay

那么它仍不是运行时主链对象。

### What

把 proof object 收口到：

- curator artifact
- `GRCState.curator` 持久化面
- restore / replay 消费面

让系统能跨轮恢复：

- 当前焦点 x-node 的 latest proof
- 当前 proof signals

### 改动面

#### A. `grc-state.ts`
- 确认 `GRCState.curator` 中 proof 对象的稳定承载位置
- 提供必要 setter / restore helper

#### B. `grc-restore.ts`
- replay curator artifacts 时恢复：
  - `latestRuntimeProof`
  - `latestProofSignals`
- 明确 proof payload 缺失时的兼容行为

#### C. curator artifact append / parse
- 确认 artifact entry 中 proof payload 是正式字段，而非附加文本

### 验收标准

- proof object 可进入 curator artifact
- restore / replay 后 proof object 仍可被 state 读取
- 至少一条 replay 测试覆盖 proof payload 恢复

---

## 6. E7-3：Injection / status / diagnostics

### Why

proof 若不能进入：

- `before-agent-start` 注入
- status
- diagnostics

则它仍然无法真正影响下一轮 LLM 判断，也无法稳定观测。

### What

让 proof object 成为可消费的注入与观测面：

- 注入 proof / signal 摘要
- status 显示 proof status / latest signal
- diagnostics 标注 proof source

### 改动面

#### A. `before-agent-start-injection.ts`
- 基于正式 proof object 注入：
  - latest proof summary
  - latest proof status
  - latest proof signal types
- 明确 proof source label，避免混淆为自然语言摘要

#### B. `ptc-status.ts`
- 新增或增强 proof 观测面：
  - latest runtime proof
  - latest proof signals

#### C. diagnostics / logs
- 对 proof object 的来源与状态加 source / status 标识
- 至少能明确区分：
  - proof present
  - proof missing
  - signal emitted

### 验收标准

- `before-agent-start` system prompt 可见正式 proof / signal 摘要
- `/ptc status` 至少一处可稳定看到 proof signal
- 相关注入 / status 测试覆盖 proof object 而不是字符串兜底

---

## 7. E7-4：Provisional proof consistency

### Why

根据 draft/provisional 设计，provisional subtree 可以携带：

- provisional proof
- proof gap
- proof signal

因此 Curator 在处理：

- confirm
- revise
- discard
- subtree rewrite

时，不能只修结构，不修 proof 归属。

### What

建立最小一致性规则：

- provisional subtree 被 confirm 时，相关 proof 可保留进入 confirmed 对象
- provisional subtree 被 discard 时，相关 proof 不应误挂到 confirmed x-node
- provisional subtree 被 rewrite 时，proof / signal 至少支持：
  - 保留
  - 丢弃
  - 重挂到新的 `targetXNodeId`

### 改动面

#### A. `grc-provisional-overlay.ts` / disposition apply 路径
- 核对 draft disposition 应用时，proof / signal 的保留、丢弃、重挂策略

#### B. `index.ts`
- Curator disposition reconcile 时，同步处理 provisional proof payload

#### C. tests
- 覆盖：
  - confirm provisional subtree with proof
  - discard provisional subtree with proof signal
  - subtree rewrite retargets proof signal

### 验收标准

- confirm / discard / rewrite 不会把 proof 错挂到错误 x-node
- provisional proof signal 在裁决后保持最小一致性
- 回归链通过

---

## 8. 非目标

E7 **不做**：

- 不引入硬 scheduler
- 不继续扩大 legacy 清理范围
- 不重写 GoalTree guard 主逻辑
- 不一次性统一所有 proof ontology
- 不新增复杂 UI 编辑面
- 不把所有 signal 收口成单一大事件系统

一句话：

> **E7 只做 proof mainchain closure，不做新一轮大重构。**

---

## 9. 回归要求

E7 每一刀后都至少跑：

```bash
npm run test:grc
```

E7-1 / E7-2 后建议额外跑：

```bash
npm run test:curator-replay
./scripts/draft-goal-fresh-proof.sh
```

E7-3 / E7-4 若触及注入与 provisional 裁决，建议最终补跑：

```bash
npm run test:regression
```

---

## 10. 完成定义

当以下条件满足时，可视为 E7 闭合：

1. 某次真实 session 中出现结构化 `RuntimeProofRecord`
2. proof 缺失 / 冲突 / 不完整时，真实生成 `RuntimeProofSignal`
3. Curator artifact 可稳定携带 proof object
4. `before-agent-start` 注入能显示 proof / signal 摘要
5. `/ptc status` 或 replay 至少一处稳定观测 proof signal
6. provisional subtree 的 confirm / discard / rewrite 不会把 proof 错挂到错误 x-node

---

## 11. 一句话

> E7 的正确方向不是“再发明一种验证体系”，而是：**把 `RuntimeProofRecord / RuntimeProofSignal` 从设计对象升级为运行时主链对象，并补齐它与 provisional subtree 裁决的一致性闭环。**
