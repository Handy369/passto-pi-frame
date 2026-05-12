# PasstoContext v1.1 TODO / 收尾归档

> 状态：v1.1 收尾已完成（archived）
> 最终权威文档：`docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`
> 命名映射：本文中的 `/pta`、`manualMode` 等字段均为历史收尾阶段表述；当前公开命令面与主运维口径请以 `/ptc`、`runtimeMode` 为准。
> 背景设计文档：`DESIGN-GRC-v1.1.md`、`curator-v1.1.md`
> 历史过程文档：`PASSTO_CONTEXT_V1_1_PLAN.md`、`V1_1_CODE_AUDIT.md`、`V1_1_CONVERGED_ARCHITECTURE_DRAFT.md`
> 最后更新：2026-05-12

---

## 0. 使用说明

本文件不再承担 v1.1 的主设计职责，而是作为**收尾归档与完成判定清单**保留。

当你需要：

- 查看当前唯一主路径口径
  - 请优先阅读：`docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`
- 查看设计背景与理念
  - 请阅读：`DESIGN-GRC-v1.1.md`、`curator-v1.1.md`
- 查看迁移过程、历史计划与审计结论
  - 请阅读：`PASSTO_CONTEXT_V1_1_PLAN.md`、`V1_1_CODE_AUDIT.md`、`V1_1_CONVERGED_ARCHITECTURE_DRAFT.md`

---

## 1. v1.1 已完成的主路径收敛

### 1.1 调度与职责

- [x] Reflector 运行于 `agent_end`
- [x] Curator 运行于 `before_agent_start`
- [x] Curator 处理上一轮（previous-round）
- [x] `principleOps` 只由 Reflector 输出
- [x] Curator 输出收敛为 `summaryEntry + GoalStateDocument + signal`

### 1.2 上下文与工作记忆

- [x] `before_agent_start` 注入已收敛为：基础 GRC prompt、`GoalState`、去重后的 `SummaryCache`、Reflector advice、principles
- [x] `context` 主路径已收敛为：最近 N 个 agent-round 原始消息 + `GoalState` + `SummaryCache`
- [x] legacy `lastSummary` fallback 已退出主路径
- [x] `buildGoalStateInjection(...)` 与 `buildReflectorGoalContext(...)` 已共享同一焦点视图基线

### 1.3 状态与恢复

- [x] `session_start` 会从 `grc-state`、`grc-curator-artifact`、`grc-reflector-artifact` 恢复运行态与 GRC 轻事实态
- [x] `GoalState / SummaryCache / lastSignal / lastSummaryEntry` 可由 curator artifact replay 恢复
- [x] `lastAdvice / lastDiagnosis / lastReflectedAgentRound` 可由 reflector artifact replay 恢复
- [x] round-based 字段已进入主状态链：`currentAgentRound`、`currentTurnRound`、`lastReflectedAgentRound`、`lastCuratedAgentRound`、`processedUpToAgentRound`
- [x] 旧 `running` 状态在 restore 时会归一化为 `idle`

### 1.4 主路径删减

- [x] `RequirementLedger` 已退出 v1.1 主路径
- [x] `ObjectiveSnapshot` 已退出 v1.1 主路径
- [x] objective / ledger 注入链路已退出主路径
- [x] `/ptc status`（历史阶段原称 `/pta status`）不再展示 objective / ledger 相关观测项
- [x] `session_before_compact` 已收敛为 curator-only 接管；无 Curator summary 时完全回退 Pi 默认 compaction

### 1.5 命令与可观测性

- [x] `/ptc status`（历史阶段原称 `/pta status`）已收敛为 round-centric 核心观测
- [x] `/ptc status`（历史阶段原称 `/pta status`）当前核心字段为：
  - `Current agent-round`
  - `Current turn-round`
  - `Reflector status`
  - `Last reflected round`
  - `Curator status`
  - `Last curated round`
  - `SummaryCache entries`
  - `GoalState Snapshot`
  - `Last Signal`
  - `Latest Curator Artifact Round`
  - `Latest Reflector Diagnosis`
  - `Latest Reflector Advice`
- [x] mid-run Reflector 已具备 `grc-mid-run-debug` 持久化审计链

### 1.6 静态提示词单一维护源 / 双出口收敛

- [x] `references/generator-contract.md` 已成为静态单一维护源
- [x] `buildGeneratorCharterPrompt()` 已从 `generator-contract.md` 投影 Generator Charter，而不重复注入 Constitution
- [x] `APPEND_SYSTEM.md` 已收敛为 Constitution-only 静态出口
- [x] `session_start` 会自动同步 Constitution 投影到 `~/.pi/agent/APPEND_SYSTEM.md`
- [x] 自动同步具备安全边界：若 `generator-contract.md` 缺失，则跳过写盘，不使用 fallback 覆盖全局文件
- [x] `APPEND_SYSTEM.md` 不再作为手工编辑源

---

## 2. 已补齐的回归测试

### 2.1 主回归链

- [x] `npm run test:grc`
  - [x] `test:curator`
  - [x] `test:restore`
  - [x] `test:reflector`
  - [x] `test:context-manager`
  - [x] `test:compaction`
  - [x] `test:status`
  - [x] `test:round-state`
- [x] `npm run test:tmux`
  - [x] `test:tui`
  - [x] `test:midrun`
  - [x] `test:reflector-replay`
- [x] `npm run test:regression`
  - [x] `test:grc`
  - [x] `test:tmux`

### 2.2 新增 / 已覆盖的关键验证点

- [x] GoalState 注入与 ReflectorGoalContext 焦点对齐
- [x] Reflector prompt 包含 goalState / goalContext
- [x] Curator artifact restore 与 replay
- [x] Reflector artifact restore 与 replay
- [x] `session_before_compact` 仅在存在 Curator summary 时接管
- [x] `/ptc status`（历史阶段原称 `/pta status`）不再依赖 Objective / Ledger
- [x] round-based 状态字段更新与恢复
- [x] `buildGeneratorCharterPrompt()` 契约测试已覆盖
- [x] `APPEND_SYSTEM.md` / `generator-contract.md` 导出边界测试已覆盖
- [x] `ensureAppendSystemPromptSync()` 自动同步测试已覆盖（missing target / unchanged / missing contract skip）

### 2.3 TUI / 集成脚本

- [x] `npm test`
- [x] `npm run test:tui`
- [x] `npm run test:midrun`
- [x] `npm run test:reflector-replay`
- [x] `npm run test:tmux`

### 2.4 完整回归复验（2026-05-12）

- [x] 已实际执行 `npm run test:regression`
- [x] `test:grc` 全通过
- [x] `test:tmux` 全通过
- [x] `test:tui` 通过：`/ptc status`、`/ptc on`、`/ptc off`、`/reload`、`/new`、`/resume` 入口正常
- [x] `test:midrun` 通过：`grc-mid-run-debug` 与 `grc-mid-run-reflection-steer` 均在真实会话中落盘/可见
- [x] `test:reflector-replay` 通过：`grc-reflector-artifact` 可落盘，`/reload` 后 `Latest Reflector Diagnosis/Advice` 与 round 字段恢复保持一致
- [x] 本次复验未发现新的 Batch 5 阻塞问题

---

## 3. 文档收尾状态

- [x] 已新增最终架构文档：`docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`
- [x] `README.md` 已加入最终架构入口链接
- [x] `README.md` 已同步 `/ptc status`（历史阶段原称 `/pta status`）最终口径
- [x] `README.md` 已同步 context / compaction 主路径说明
- [x] `README.md` 已同步 `generator-contract.md → buildGeneratorCharterPrompt() / APPEND_SYSTEM.md` 双出口与自动同步说明
- [x] `V1_1_GENERATOR_PROMPT_ARCHITECTURE.md` 已同步自动同步实现现状、验证覆盖与“非手工编辑源”口径
- [x] `V1_1_FINAL_ARCHITECTURE.md` 已在 `session_start` 总览中纳入 `APPEND_SYSTEM.md` 自动同步说明
- [x] 本文件已从“实施 TODO”改写为“收尾归档”文档

---

## 4. v1.1 完成判定

满足以下条件即可认为 v1.1 主线完成：

- [x] Reflector 输入升级为 `conversation + currentGoalState + goalContext`
- [x] Curator 从 `agent_end` 挪到 `before_agent_start`
- [x] Curator 输出收敛为 `SummaryEntry + GoalStateDocument + signal`
- [x] `principleOps` 只由 Reflector 输出
- [x] RequirementLedger / ObjectiveSnapshot 退出 v1.1 主路径
- [x] `/ptc status`（历史阶段原称 `/pta status`）与状态模型完成同步
- [x] 关键回归测试补齐并通过

结论：**PasstoContext v1.1 收尾完成。**

---

## 5. 不属于 v1.1 收尾的后续方向

以下项目可留待 v1.2 或后续迭代，不作为 v1.1 阻塞项：

- 继续删除仅为兼容保留的 deprecated 字段
- 为旧草案 / 计划 / 审计文档统一补“已被 FINAL_ARCHITECTURE 取代”的顶部提示
- 更强的 GoalState focus 选择策略
- 更强的 Summary 仓库检索体验
- Reflector / Curator 更复杂的工具调用能力
- principles 语义检索与共享治理
