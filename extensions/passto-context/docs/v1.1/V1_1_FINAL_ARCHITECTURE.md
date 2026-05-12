# PasstoContext v1.1 最终架构说明

> 状态：finalized
> 依据：**以当前代码实现与回归测试为准**
> 更新时间：2026-05-09
>
> 本文档用于给出 v1.1 收敛后的**最终主路径口径**，避免继续参考已过时的草案、计划或迁移中间态。

---

## 1. 最终目标

v1.1 的目标不是维护一套越来越复杂的需求账本，而是把当前主路径收敛为：

- `GoalStateDocument`：当前目标单核
- `SummaryEntry / SummaryCache`：近期事实索引
- `Reflector`：当前轮方向评估与原则沉淀
- `Curator`：上一轮客观归档与目标状态更新

最终系统回答两个核心问题：

1. **当前最值得关注的目标是什么？**
2. **最近几轮是如何推进、迁移、完成或纠偏的？**

---

## 2. 当前保留的核心结构

### 2.1 GoalStateDocument

职责：
- 当前目标单核真相源
- 记录 active / completed / migrations / prunedCount
- 作为 Reflector 与主模型注入的共同目标基线

### 2.2 SummaryEntry

职责：
- 单轮结构化事实摘要
- 记录目标、已完成、关键决策、改动文件、状态、阻塞
- 作为 Curator 产物的客观事实层

### 2.3 SummaryCache

职责：
- 最近若干条 `SummaryEntry` 的滑动窗口
- 提供近期演进轨迹
- 避免每次都读取全部原始历史

### 2.4 Principles Registry

职责：
- Reflector 输出的 `principleOps` 的持久化落点
- 提供后续注入与经验沉淀

---

## 3. 已退出主路径的结构

以下结构已不再属于 v1.1 主路径：

- `RequirementLedger`
- `ObjectiveSnapshot`
- `grc-requirement-ledger`
- objective / ledger 注入链路
- `/ptc status` 中的 objective / ledger 观测项
- legacy `lastSummary` context fallback
- 扩展内自带 LLM compaction 分支

说明：
- 兼容字段仍可能在旧状态恢复或旧配置中存在
- 但不再作为当前主逻辑的核心依赖

---

## 4. 最终事件时序

### 4.1 session_start

职责：
- 加载配置
- 初始化 memory / tracker / principles / compaction handler
- 从 `grc-state`、`grc-curator-artifact`、`grc-reflector-artifact` 恢复状态
- 恢复 `GoalState / SummaryCache / lastSignal / lastSummaryEntry`
- 恢复 `lastAdvice / lastDiagnosis / lastReflectedAgentRound`

### 4.2 before_agent_start

职责：
- 启动 `Curator(previous-round)`
- 注入基础 GRC prompt
- 注入 GoalState 视图
- 注入 SummaryCache
- 注入 Reflector advice
- 注入 principles / memory

Curator 输入：
- `previousRoundConversation`
- `currentUserMessage`
- `currentGoalState`

Curator 输出：
- `summaryEntry`
- `goalState`
- `signal`

### 4.3 agent_start

职责：
- 开启新一轮 `agent-round`
- 写入 `passto-round-boundary`

### 4.4 turn_end

职责：
- `currentTurnRound++`
- 检查是否触发 mid-run Reflector

### 4.5 agent_end

职责：
- 完成 `current agent-round`
- 启动 `Reflector(current-round)`

Reflector 输入：
- `currentRoundConversation`
- `currentGoalState`
- `goalContext`
- `summaryCacheExcerpt`
- `recentCuratorArtifacts`
- `candidatePrinciples`

Reflector 输出：
- `advice`
- `diagnosis`
- `principleOps`
- `assetCandidates`（当前仅限 `reference / script`，不含 `skill`）
- `grc-reflector-artifact`（持久化后供 restore / replay）

### 4.6 session_before_compact

职责：
- **仅在存在 Curator 最新摘要时**由扩展接管 compaction
- 否则完全回退 Pi 默认 compaction

---

## 5. Context 主路径

当前 `context` 主路径只保留：

- 最近 N 个原始 `agent-round` 对话
- `GoalState` 注入
- `SummaryCache` 注入
- principles / memory 注入

不再保留：
- `lastSummary` 的 legacy fallback 注入
- objective / ledger 型结构化锚点

---

## 6. GoalState 注入与 ReflectorGoalContext 的统一

v1.1 最终实现中：

- `buildGoalStateInjection(...)`
- `buildReflectorGoalContext(...)`

都通过共享的 `buildGoalViewModel(...)` 生成视图。

这保证：
- 主模型在 `before_agent_start` 看到的目标焦点
- Reflector 在 `agent_end` 看到的目标焦点

来自同一套焦点选择逻辑，不会再因为两套不同渲染逻辑而漂移。

共享视图当前包含：
- 当前焦点目标
- 并行活跃目标
- 最近完成目标
- 最近目标迁移
- updatedRound

---

## 7. Compaction 最终口径

扩展当前不再维护第二套内置 LLM compaction summarize 流程。

`session_before_compact` 的行为只有两种：

1. **有 Curator summary**
   - 扩展返回自定义 compaction
   - `details.strategy = "curator-summary"`

2. **无 Curator summary**
   - 扩展返回 `undefined`
   - Pi 使用默认 compaction

这使 compaction 职责足够清晰：
- 扩展只负责复用已有高质量 Curator 结果
- 不再与 Pi 默认 compact 形成两套并行摘要系统

---

## 8. 状态模型最终口径

### 8.1 主观测字段

Reflector：
- `status`
- `lastAdvice`
- `lastDiagnosis`
- `processedUpToAgentRound`
- `lastReflectedAgentRound`

Reflector 轻状态恢复口径：
- `grc-reflector-artifact` 在 `session_start` / `/reload` 时只 replay latest 轻状态视图
- 不把历史 artifact 数组回填进 `GRCState`
- latest artifact replay 后，`processedUpToAgentRound` 与 `lastReflectedAgentRound` 必须同时对齐到该 artifact 的 `agentRound`
- `/ptc status` 只展示 latest diagnosis / advice 等观测结果，而不是历史列表

Curator：
- `status`
- `lastSummary`
- `lastSummaryEntry`
- `lastGoalState`
- `lastSignal`
- `summaryCache`
- `processedUpToAgentRound`
- `lastCuratedAgentRound`

### 8.2 兼容字段

以下字段仍保留，但已降级为兼容层：

- `turnCount`
- `processedUpToTurn`
- `grcTurnThreshold`
- `grcCooldownTurns`
- `curatorKeepRecentTurns`
- `curatorEveryAgentRounds`

原则：
- 可以继续读取旧状态 / 旧配置
- 但当前主路径不再依赖这些字段驱动核心行为

---

## 9. /ptc status 最终口径

`/ptc status` 当前保留以下核心观测项：

- current agent-round
- current turn-round
- Reflector status
- last reflected round
- Curator status
- last curated round
- SummaryCache entries
- last signal
- latest curator artifact round
- latest reflector diagnosis
- latest reflector advice
- GoalState snapshot
- principles stored
- orchestrator guard
- context usage

已移除或降权：
- objective / ledger
- injected summary cache rounds
- latest summary entry
- legacy prompt-rounds
- legacy turnCount
- 其他迁移阶段调试项

---

## 10. 当前测试覆盖

当前回归入口分层如下：

- `npm run test:grc`
  - 快速 Node 回归链
- `npm run test:tmux`
  - 真实 Pi / tmux 集成回归聚合链（`test:tui + test:midrun + test:reflector-replay`）
- `npm run test:regression`
  - 当前主回归链，串联 `test:grc + test:tmux`

其中 `npm run test:grc` 覆盖：

- Curator 输出解析
- Curator artifact restore
- Reflector artifact restore
- Reflector latest diagnosis replay（含 `processedUpToAgentRound` / `lastReflectedAgentRound` 对齐语义）
- Reflector 输入与 prompt 注入
- GoalState 注入与 ReflectorGoalContext 对齐
- previous-round slicing
- compaction handler 的 curator-only 接管
- round-based state 字段更新与 restore
- `/ptc status` 的收敛口径

其中 `npm run test:tmux` 额外覆盖：

- `/ptc status` / `/ptc on` / `/ptc off` / `/ptc config`
- `/reload` 后 runtime 状态恢复
- `/new` 后 session-scoped 运行态重置
- mid-run Reflector 的 `grc-mid-run-debug` 审计链
- Reflector artifact 的真实 append / replay / reload 恢复
- `Latest Reflector Diagnosis` / `Latest Reflector Advice` 的真实 TUI 展示与恢复

---

## 11. 当前代码基线结论

PasstoContext v1.1 现已收敛为：

- `before_agent_start -> Curator(previous-round)`
- `agent_end -> Reflector(current-round)`
- `GoalState + SummaryCache + recent raw rounds` 重建工作上下文
- `session_before_compact` 仅复用 Curator summary，否则回退 Pi 默认
- `/ptc status` 以 round-centric 核心观测为准

这是当前维护、继续迭代与未来 v1.2 演进应参考的**唯一主路径口径**。

> 命名说明：历史文档中若仍出现 `/pta`、`manualMode`、`forced-on/off` 等旧表述，应视为迁移前术语；当前公开命令面与主运维口径统一使用 `/ptc` 与 `runtimeMode`。
