# Passto Context v1.1 代码对照审计

> ⚠️ 归档提示：当前实现请**优先参考** `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`。
> ⚠️ 命名映射：本文保留审计当时的旧术语；若出现 `/pta`、`manualMode`、`forced-on / forced-off`，请按当前实现理解为 `/ptc` 与 `runtimeMode` 的历史前身。
> 本文档保留为历史审计快照，不再单独作为当前代码实现依据。
>
> 审计目标：对照以下两份文档，核对当前**实际代码**已经落地了哪些 v1.1 能力、哪些只完成一部分、哪些仍未实现。
>
> - `DESIGN-GRC-v1.1.md`
> - `PASSTO_CONTEXT_V1_1_PLAN.md`
>
> 审计范围：`index.ts`、`types.ts`、`grc-state.ts`、`grc-context-manager.ts`、`grc-restore.ts`、`grc-ledger.ts`、`grc-curator-parser.ts`、`grc-subagent.ts`、`compaction.ts`、测试与脚本。

---

## 1. 结论摘要

基于实际代码与本地测试结果，当前实现已经完成了 **v1.1 的“前半段骨架”**，主要包括：

- agent-round / turn-round 主调度骨架
- post-round Reflector
- mid-run Reflector + `steer`
- `ObjectiveSnapshot` / `RequirementLedger` / `GoalState` / `SummaryCache` 这套结构化工作记忆前置层
- `grc-curator-artifact` / `grc-requirement-ledger` / `passto-round-boundary` 的持久化与恢复
- `before_agent_start` 的结构化注入
- `context` 主路径切到“最近 agent-round 原始消息 + 结构化状态”
- `session_before_compact` 的 curator-first 兜底复用
- 一组覆盖 ledger / curator parser / restore replay 的测试

但与 `DESIGN-GRC-v1.1.md` 和 `PASSTO_CONTEXT_V1_1_PLAN.md` 对比，当前**最关键未完成项**也非常明确：

1. **Delayed Curator 还没有正式落地**
   - 设计要求：`agent_end(N)` 处理 `round N-1`
   - 现状代码：Curator 仍在处理 **当前 agent-round**

2. **状态模型还没有迁移到完整的 v1.1 口径**
   - 代码里仍以 `processedUpToTurn`、`turnCount` 等旧 user-turn 兼容字段为主
   - 设计中的 `lastCuratedAgentRound`、`processedUpToAgentRound` 还不存在于运行态类型

一句话判断：

> **当前代码已经完成了 v1.1 的“结构化工作记忆 + 调度框架 + 持久化恢复”层，但尚未完成 v1.1 最关键的 Delayed Curator 闭环。**

---

## 2. 本次审计的验证依据

### 2.1 代码核对

重点核对了以下实现：

- `index.ts`
- `types.ts`
- `grc-state.ts`
- `grc-context-manager.ts`
- `grc-restore.ts`
- `grc-ledger.ts`
- `grc-curator-parser.ts`
- `grc-subagent.ts`
- `compaction.ts`

### 2.2 本地执行测试

已执行：

```bash
cd /Users/handy/dev/passto-ai/extensions/passto-context
npm run test:grc
```

结果：**全部通过**

- `test:ledger` 通过（7 tests）
- `test:curator` 通过（3 tests）
- `test:restore` 通过（8 tests）

说明：
- ledger 解析 / 投影链路可用
- curator 结构化输出解析可用
- artifact / ledger 恢复 replay 链路可用

---

## 3. 已完成：与 v1.1 设计一致的部分

### 3.1 agent-round / turn-round 调度骨架已落地

#### 已实现内容

- `agent_start` 时开启新的 agent-round
- `turn_end` 时递增当前 run 的 turn-round
- `agent_end` 时完成一轮 agent-round，并调度 post-round jobs

#### 代码证据

- `grc-state.ts:39` `startAgentRound()`
- `grc-state.ts:47` `incrementTurnRound()`
- `grc-state.ts:54` `finishAgentRound()`
- `index.ts:1246` `agent_start` 中调用 `startAgentRound(grcState)`
- `index.ts:1273` `turn_end` 中调用 `incrementTurnRound(grcState)`
- `index.ts:1328` `agent_end` 中调用 `finishAgentRound(grcState)`

#### 对照结论

这部分已经符合 v1.1 从 user-turn 迁移到 agent-round / turn-round 的主方向。

---

### 3.2 `passto-round-boundary` 持久化已落地

#### 已实现内容

- 每次 `agent_start` 都会 append 一条 `passto-round-boundary`
- `grc-context-manager.ts` 已支持基于 round boundary 回放最近 agent-round 消息

#### 代码证据

- `types.ts:320` `AgentRoundBoundaryEntry`
- `index.ts:191` 定义 boundary entry
- `index.ts:199` `pi.appendEntry("passto-round-boundary", entry)`
- `grc-context-manager.ts:105` `findAgentRoundBoundaries()` 读取 boundary
- `grc-context-manager.ts:146` `getRecentAgentRoundMessages()`
- `grc-context-manager.ts:131` `serializeCurrentAgentRoundConversation()`

#### 对照结论

这部分是 v1.1 的关键前置能力，**已完成**。

---

### 3.3 post-round Reflector 已落地

#### 已实现内容

- `agent_end` 后会启动 post-round Reflector
- Reflector 结果会更新 `lastAdvice`
- Reflector 的 `principleOps` 会应用到 principle registry

#### 代码证据

- `index.ts:133` `getPostRoundTargets()`
- `index.ts:661` `startGRCBackgroundJobs()`
- `index.ts:726` 启动 Reflector
- `index.ts:743` Reflector 完成后写入 advice / principleOps

#### 对照结论

符合 v1.1 中“Reflector 在 `agent_end(N)` 立即处理 `round N`”的方向。

---

### 3.4 mid-run Reflector + steer 已落地

#### 已实现内容

- `turn_end` 累计 run 内 turn-round
- 达到 `midRunTurnThreshold` 后启动 mid-run Reflector
- 若有实质建议，通过 `deliverAs: "steer"` 注入当前 run
- 持久化 `grc-mid-run-debug`
- 同一 run 内避免重复 delivery

#### 代码证据

- `index.ts:122` 读取 `midRunTurnThreshold`
- `index.ts:127` append `grc-mid-run-debug`
- `index.ts:504` `startMidRunReflector()`
- `index.ts:605-611` `sendMessage(..., { deliverAs: "steer" })`
- `index.ts:1288-1300` `turn_end` 触发 mid-run 检查
- `index.ts:582` agent_end 后完成则跳过 steer
- `index.ts:600` 重复投递保护

#### 对照结论

这部分与 `DESIGN-GRC-v1.1.md` 的 mid-run 设计是**一致**的，属于 v1.1 已完成模块。

---

### 3.5 Curator 输出模型已升级到 `summaryEntry + GoalState + RequirementLedger + signal`

#### 已实现内容

- Curator 结构化输出已包含：
  - `summaryEntry`
  - `goalState`
  - `requirementLedger`
  - `signal`
- `parseCuratorOutput()` 已能从 markdown + JSON payload 中抽取这些结构

#### 代码证据

- `types.ts:280` `CuratorResult`
- `grc-curator-parser.ts:3` `parseCuratorOutput()`
- `grc-curator-parser.ts:31-44` 提取 `signal/summaryEntry/goalState/requirementLedger`
- `grc-subagent.ts:131` `executeCurator()`

#### 对照结论

这部分已经超过旧版 `lastSummary` 语义，符合 v1.1 的结构化 Curator 方向。

---

### 3.6 RequirementLedger 已落地，ObjectiveSnapshot 已切到 ledger 投影

#### 已实现内容

- 已定义完整 `RequirementLedger` 类型
- 已支持 `active / superseded / withdrawn`
- Curator artifact 恢复后可重建 latest ledger
- `ObjectiveSnapshot` 不再是启发式拼装，而是从 latest ledger 投影生成

#### 代码证据

- `types.ts:248` `ObjectiveSnapshot`
- `types.ts:261-278` `RequirementLedgerCategory/Status/UserRequirementLedger`
- `grc-ledger.ts:77` `parseRequirementLedgerEntry()`
- `grc-ledger.ts:98` `buildObjectiveSnapshotFromLedger()`
- `index.ts:808` Curator 完成后调用 `buildObjectiveSnapshotFromLedger(requirementLedger)`
- `grc-restore.ts:117` restore 时用 latest ledger 重建 snapshot

#### 对照结论

与 `PLAN` 中“ObjectiveSnapshot 已切换为 RequirementLedger 驱动的投影版本”的描述一致，属于 **已完成**。

---

### 3.7 `GoalState + SummaryCache + ObjectiveSnapshot` 的注入链路已落地

#### 已实现内容

`before_agent_start` 已真实注入：

- base GRC prompt
- `ObjectiveSnapshot`
- `GoalState`
- 去重后的 `SummaryCache`
- Reflector advice
- principles
- memory 注入（若启用）

#### 代码证据

- `index.ts:1049` `before_agent_start`
- `index.ts:1070` `buildObjectiveSnapshotInjection()`
- `index.ts:1080` `buildGoalStateInjection()`
- `index.ts:1093` `buildSummaryCacheInjection()`
- `index.ts:1109` `buildReflectorInjection()`
- `index.ts:1158` 注入诊断日志
- `grc-prompts.ts:222/248/283/296` 对应 injection builder

#### 对照结论

这部分与 v1.1 文档口径**一致**，是当前代码最扎实的已完成模块之一。

---

### 3.8 `context` 主路径已切到“最近 agent-round 原始消息 + 结构化状态”

#### 已实现内容

- `context` hook 会优先取最近若干个 agent-round 的原始消息
- `SummaryCache` 已通过 `before_agent_start` 注入，避免与 recent raw rounds 重复
- 旧 `lastSummary` 压缩消息仍保留为兼容 fallback

#### 代码证据

- `index.ts:1194` `getRecentAgentRoundMessages()`
- `index.ts:1204` 若存在 `lastSummary`，走 `optimizeContextMessages()` 兼容路径
- `index.ts:1217` 输出 `Context optimized using ...`
- `grc-context-manager.ts:146` recent round message 抽取
- `grc-context-manager.ts:35` legacy summary 注入压缩逻辑

#### 对照结论

这部分**部分符合** v1.1：
- 主路径方向对了
- 但仍保留旧 `lastSummary` 压缩策略作为 fallback

因此它更准确地属于：**已完成主路径迁移，但未完成最终形态**。

---

### 3.9 curator artifact / ledger 的持久化与 restore replay 已落地

#### 已实现内容

- Curator 完成后会追加：
  - `grc-curator-artifact`
  - `grc-requirement-ledger`
- `session_start` 会恢复：
  - `grc-state`
  - curator artifacts
  - requirement ledgers
- 会 replay artifact 重建：
  - `lastSummaryEntry`
  - `lastGoalState`
  - `summaryCache`
  - `lastSignal`
  - `lastRequirementLedger`
  - `lastObjectiveSnapshot`

#### 代码证据

- `types.ts:300` `CuratorArtifactEntry`
- `types.ts:311` `RequirementLedgerEntry`
- `index.ts:207` append `grc-curator-artifact`
- `index.ts:216` append `grc-requirement-ledger`
- `index.ts:878` `session_start`
- `index.ts:949` `restoreCuratorStateFromBranchEntries(...)`
- `grc-restore.ts:34` `replayCuratorArtifacts()`
- `grc-restore.ts:71` `restoreCuratorStateFromBranchEntries()`

#### 对照结论

这部分与 v1.1 文档描述**高度一致**，并且有测试覆盖。

---

### 3.10 `session_before_compact` 的 curator-first 兜底接管已落地

#### 已实现内容

- 若 GRC 已启用且 Curator 已产出 `lastSummary`，compaction 优先直接复用 curator summary
- 否则回退默认 LLM summary 路径

#### 代码证据

- `index.ts:999` `session_before_compact`
- `index.ts:1005` 计算 `curatorSummary`
- `index.ts:1016` debug 输出 `curator-summary/default-llm-summary`
- `compaction.ts:55` `if (options?.curatorSummary?.trim())`
- `compaction.ts:56` `Using curator summary for compaction`
- `compaction.ts:64` `strategy: "curator-summary"`

#### 对照结论

符合 v1.1“`session_before_compact` 作为兜底路径”的精神。

---

### 3.11 观测与测试基线已建立

#### 已实现内容

- `/ptc status`（审计当时命名为 `/pta status`）已展示 Objective / Ledger / GoalState / SummaryCache / Artifact 相关状态
- 提供 `test:ledger` / `test:curator` / `test:restore` / `test:grc`
- 提供 `test:midrun` / `test:tui` 脚本入口

#### 代码证据

- `index.ts:1740+` `/ptc status`（审计当时命名为 `/pta status`）
- `index.ts:1784` `Injected SummaryCache rounds`
- `index.ts:1787` `Latest Curator Artifact Round`
- `package.json`：`test:ledger`、`test:curator`、`test:restore`、`test:grc`、`test:midrun`、`test:tui`

#### 对照结论

这部分是非常重要的“实现基线保障”，**已完成**。

---

## 4. 部分完成：已具雏形，但未达到 v1.1 终态

### 4.1 状态模型只完成“兼容扩展”，尚未迁移到完整 `GRCStateV11`

#### 现状

代码中的 `GRCState` 仍然是旧结构扩展版，而不是文档里的完整 `GRCStateV11`。

当前实际状态字段包含：

- `turnCount`（legacy compatibility）
- `totalAgentRounds`
- `currentAgentRound`
- `currentTurnRound`
- `reflector.processedUpToTurn`
- `curator.processedUpToTurn`
- `lastObjectiveSnapshot`
- `lastRequirementLedger`
- `summaryCache`

但**尚未出现**：

- `lastCuratedAgentRound`
- `processedUpToAgentRound`

#### 代码证据

- `types.ts:122` `interface GRCState`
- `types.ts:140-141` `lastObjectiveSnapshot / lastRequirementLedger`
- `grc-state.ts` 全文件未出现 `lastCuratedAgentRound / processedUpToAgentRound`

#### 对照结论

属于：**部分完成**。

---

### 4.2 `context` 已走 v1.1 主路径，但仍保留 legacy `lastSummary` 压缩 fallback

#### 现状

- 最近 agent-round 原始消息已经是主路径
- 但如果 `grcState.curator.lastSummary` 存在，仍会调用 `optimizeContextMessages()` 注入 `grc-curator-summary`
- 这是旧模型“单条 summary 覆盖旧历史”的语义残留

#### 代码证据

- `index.ts:1204` `optimizeContextMessages(messages, { summary: grcState.curator.lastSummary, ... })`
- `grc-context-manager.ts:35` 生成 `grc-curator-summary`

#### 对照结论

属于：**过渡态已完成，终态未完成**。

---

## 5. 未完成：v1.1 设计中的关键缺口

### 5.1 Delayed Curator 还没有正式落地

#### 设计要求

`DESIGN-GRC-v1.1.md` / `PASSTO_CONTEXT_V1_1_PLAN.md` 的正式口径是：

- Reflector 在 `agent_end(N)` 处理 `round N`
- Curator 在 `agent_end(N)` 处理 `round N-1`

#### 实际代码现状

当前 Curator 明确仍在处理**当前 agent-round**：

- `startGRCBackgroundJobs()` 中取的是 `serializeCurrentAgentRoundConversation(...)`
- 日志直接写着 `empty current agent-round conversation`
- 传给 Curator 的 `agentRoundAtStart` 也是当前轮
- artifact 记录的 `agentRound` 也是 `agentRoundAtStart`

#### 代码证据

- `index.ts:700` `const curatorConversation = serializeCurrentAgentRoundConversation(...)`
- `index.ts:721` `Skipped Curator: empty current agent-round conversation`
- `index.ts:783` `Starting Curator (agentRound=${agentRoundAtStart}...)`
- `index.ts:796` `executeCurator(..., agentRoundAtStart)`
- `index.ts:832` curator artifact `agentRound: agentRoundAtStart`

#### 对照结论

这是当前与 v1.1 主设计之间**最大的未完成项**。

> 结论：**当前运行时代码仍是“current-round Curator”，不是“Delayed Curator / one-round-late Curator”。**

---

### 5.2 `lastCuratedAgentRound / processedUpToAgentRound` 未进入状态模型

#### 现状

文档中这些字段已被定义为 v1.1 关键状态，但实际代码里没有。

#### 对照结论

**未完成**。

---

## 6. 对照清单：当前代码对应 v1.1 计划完成度

| 模块 | 当前状态 | 结论 |
|---|---|---|
| agent-round / turn-round 主调度 | 已实现 | 完成 |
| `passto-round-boundary` | 已实现 | 完成 |
| post-round Reflector | 已实现 | 完成 |
| mid-run Reflector + steer | 已实现 | 完成 |
| Curator 结构化输出（summaryEntry/goalState/ledger/signal） | 已实现 | 完成 |
| RequirementLedger | 已实现 | 完成 |
| ObjectiveSnapshot 由 ledger 投影 | 已实现 | 完成 |
| GoalState + SummaryCache 注入 | 已实现 | 完成 |
| `grc-curator-artifact` 持久化与 replay restore | 已实现 | 完成 |
| `grc-requirement-ledger` 持久化与 restore | 已实现 | 完成 |
| `/ptc status`（审计当时命名为 `/pta status`）可观测性 | 已实现 | 完成 |
| curator-first compaction | 已实现 | 完成 |
| context 主路径迁移到 recent agent-rounds | 已实现 | 完成（过渡态） |
| 旧 `lastSummary` fallback 清理 | 未完成 | 部分完成 |
| Delayed Curator | 未实现 | 未完成 |
| v1.1 完整状态模型迁移 | 未实现 | 部分完成 |

---

## 7. 当前最准确的阶段判断

如果把 v1.1 粗分为两大层：

### A. 结构化工作记忆前置层
包括：
- round 边界
- GoalState
- RequirementLedger
- ObjectiveSnapshot
- SummaryCache
- artifact / replay restore
- before_agent_start 注入
- mid-run / post-round 基础调度

**这一层已经基本完成。**

### B. 延迟判定层
包括：
- Delayed Curator
- `lastCuratedAgentRound` / `processedUpToAgentRound` 对应的状态语义收敛
- 当前轮与已归档轮的语义区分

**这一层还没有真正进入代码。**

因此当前最准确的定位是：

> **v1.1 已完成“结构化事实层 + 注入层 + 恢复层”，但尚未完成“Delayed Curator 延迟判定层”。**

---

## 8. 建议的下一步实现顺序

按风险最小、收益最高的顺序，建议这样推进：

### Step 1：先落地 Delayed Curator

目标：把当前

- `serializeCurrentAgentRoundConversation()`
- `agentRoundAtStart`

改为：

- 在 `agent_end(N)` 取 `round N-1` 的完整对话
- 同时读取 `round N` 的用户反馈信号
- Curator 的输出 round 以被 adjudicate 的上一轮为准

这是最核心的时序修正。

---

### Step 2：迁移状态模型到 v1.1 口径

新增至少这两个字段：

- `lastCuratedAgentRound`
- `processedUpToAgentRound`

并逐步弱化：

- `processedUpToTurn`
- `turnCount` 的 legacy 语义

---

### Step 3：补 Delayed Curator 回归测试

至少新增：

- Delayed Curator round 选择测试
- 当前轮 / 已归档轮状态区分测试
- restore / replay 与 delayed-curator 组合测试

---

## 9. 最终结论

### 已完成

- v1.1 的结构化工作记忆底座已经成型
- 当前代码已经不再只是“单条 lastSummary + 旧式 GRC”
- `RequirementLedger -> ObjectiveSnapshot`、`GoalState`、`SummaryCache`、artifact replay 都已真实落地

### 未完成

- **Delayed Curator 仍未切换**
- **完整 v1.1 状态模型未迁移完成**

### 当前最准确的一句话

> **现在的代码已经完成了 v1.1 的“前置结构化记忆层”，但还没有完成 v1.1 最关键的 Delayed Curator 闭环层。**
