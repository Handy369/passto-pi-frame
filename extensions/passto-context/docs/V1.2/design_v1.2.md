# PasstoContext 主架构设计

> 版本：v1.2 | 状态：current | 更新：2026-05-14

---

## 1. 设计目标

### 1.1 核心目标

PasstoContext 的目标是：

1. **每轮 agent 完成后都有结构化复盘**
   - Reflector：在 `agent_end` 后异步运行的 LLM subagent，负责当前 round 的反思、风险识别、建议生成与 `principleOps`
   - Curator：在 `before_agent_start` 前异步运行的 LLM subagent，负责上一轮的客观归档与目标状态更新

2. **运行中卡住时有轻量即时纠偏**
   - 单次 agent 执行过长时，mid-run Reflector 通过极薄的 `steer` 介入

3. **上下文重建不再依赖单条叙事摘要**
   - 使用 `GoalStateDocument + SummaryCache + 最近 N 轮原始对话 + 记忆工具指令`
   - 每次 `context` 事件确定性重建上下文

4. **尽量不触发 Pi 原生 auto-compaction，但保留兼容**
   - 主路径：`context`
   - 兜底路径：`session_before_compact`

5. **不修改 Pi 原生 session 语义**
   - 不篡改 Pi session 核心结构
   - 仅通过 custom entry 追加边界标记与运行态审计信息

### 1.2 非目标

- 让 Reflector / Curator 拥有工具调用能力
- 用 subagent 递归审计原则库
- 替换 Pi 原生 compact 的底层实现
- 引入 embedding / 语义检索
- 重写 memory 系统

---

## 2. 统一术语

| 术语 | 含义 |
|------|------|
| prompt-round | 从一次 `session.prompt(...)` 开始，到该次外层调用完成为止 |
| agent-round | 一次 `agent_start -> agent_end` 的生命周期 |
| turn-round | 一次 `turn_start -> turn_end` 的生命周期 |
| message | 单条 user / assistant / toolResult / custom_message / branch_summary 消息对象 |

---

## 3. 总体架构

### 3.1 四条主链路

1. **post-round Reflector 链路**
   - `agent_end` 后异步启动 Reflector
   - 处理当前 round N
   - 输出 `advice + principleOps`

2. **pre-round Curator 链路**
   - `before_agent_start` 时异步启动 Curator
   - 读取上一轮完整对话与当前轮用户第一条消息
   - 输出 `SummaryEntry + GoalStateDocument + signal`

3. **mid-run Reflector 链路**
   - `turn_end` 计数达到阈值后异步启动 Reflector
   - 若存在实质建议，则通过极薄 `steer` 注入

4. **context 重建链路**
   - `context` 事件重建主上下文
   - 注入 GoalState、SummaryCache、最近 N 轮原始对话与记忆工具指令

### 3.2 已退出主路径的结构

以下结构已不再属于当前主路径：

- `RequirementLedger`
- `ObjectiveSnapshot`
- `grc-requirement-ledger`
- objective / ledger 注入链路
- `/ptc status` 中的 objective / ledger 观测项
- legacy `lastSummary` context fallback
- 扩展内自带 LLM compaction 分支

兼容字段仍可能在旧状态恢复或旧配置中存在，但不再作为当前主逻辑的核心依赖。

---

## 4. 事件时序（精简版）

### 4.1 session_start

- 加载配置
- 初始化 memory / tracker / principles / compaction handler
- 从 `grc-state`、`grc-curator-artifact`、`grc-reflector-artifact` 恢复状态
- 恢复 `GoalState / SummaryCache / lastSignal / lastSummaryEntry`
- 恢复 `lastAdvice / lastDiagnosis / lastReflectedAgentRound`
- 从 `references/generator-contract.md` 自动同步 Constitution 投影到 `~/.pi/agent/APPEND_SYSTEM.md`

> `buildGeneratorCharterPrompt()` 与 `APPEND_SYSTEM.md` 共享 `generator-contract.md` 作为静态单一维护源。若 `generator-contract.md` 缺失，则跳过 `APPEND_SYSTEM.md` 自动同步，不会用 fallback 覆盖全局文件。

### 4.2 before_agent_start

- 启动 **Curator(previous-round)**
- 注入基础 GRC prompt
- 注入 GoalState 视图
- 注入 SummaryCache
- 注入 Reflector advice
- 注入 principles / memory（principles 按"人工宪法原则层 > 普通历史经验层"解释）

### 4.3 agent_start

- 开启新一轮 `agent-round`
- 写入 `passto-round-boundary`

### 4.4 turn_end

- `currentTurnRound++`
- 检查是否触发 mid-run Reflector

### 4.5 agent_end

- 完成 `current agent-round`
- 启动 **Reflector(current-round)**

### 4.6 session_before_compact

- **仅在存在 Curator 最新摘要时**由扩展接管 compaction
- 否则完全回退 Pi 默认 compaction

### 4.7 高层时序图

```text
prompt-round 开始
  │
  ├─ input
  │
  ├─ before_agent_start
  │    ├─ 启动 Curator Async LLM Subagent（处理上一轮）
  │    ├─ Curator 生成 SummaryEntry + GoalStateDocument + signal
  │    ├─ 注入基础 GRC prompt
  │    ├─ 注入 Reflector advice
  │    ├─ 注入 principles
  │    └─ 注入记忆工具指令
  │
  ├─ agent_start
  │    └─ appendEntry("passto-round-boundary", ...)
  │
  ├─ turn-round #1..#N
  │    ├─ turn_start
  │    ├─ context          → 重建上下文
  │    ├─ LLM / 工具执行
  │    └─ turn_end
  │         ├─ currentTurnRound++
  │         └─ 若达到阈值 → mid-run Reflector + steer
  │
  └─ agent_end
       ├─ totalAgentRounds++
       ├─ 异步启动 Reflector（处理当前轮）
       ├─ Reflector 输出 advice
       └─ Reflector 输出 principleOps
```

---

## 5. 职责边界

### 5.1 Curator

| 负责 | 不负责 |
|------|--------|
| 上一轮客观事实归档 | principleOps |
| SummaryEntry 生成 | 原则提取 |
| GoalStateDocument 更新 | advice 生成 |
| signal 生成 | |
| SummaryCache 推进 | |

Curator 是异步 LLM subagent，详细设计见 `./curator-v1.1.md`。

### 5.2 Reflector

| 负责 | 不负责 |
|------|--------|
| 当前 round 的反思 | GoalStateDocument 更新 |
| 相对当前 GoalState 的方向评估 | SummaryEntry 生成 |
| 风险识别 | SummaryCache 维护 |
| 建议生成 | |
| principleOps | |

Reflector 是异步 LLM subagent，详细设计见 `./reflector-v1.1.md`。

### 5.3 principleOps 归属

`principleOps` 完全归属 Reflector。Curator 输出契约中不包含 `principleOps`。

---

## 6. Context 主路径

`context` 事件负责：

1. **构建注入到 system prompt 的结构化信息**
   - GoalStateDocument
   - SummaryCache
   - 记忆工具指令

2. **裁剪原始 messages**
   - 仅保留最近 `keepRecentAgentRounds` 轮 agent-round 原始对话

当前 context 注入只保留：

- 最近 N 个原始 `agent-round` 对话
- GoalState 注入
- SummaryCache 注入
- principles / memory 注入（principles 内部优先级：**人工宪法原则层 > 普通历史经验层**）

不再保留：
- `lastSummary` 的 legacy fallback 注入
- objective / ledger 型结构化锚点

---

## 7. 核心数据模型

### 7.1 GoalStateDocument

职责：当前目标单核真相源。

- 记录 active / completed / migrations / prunedCount
- 作为 Reflector 与主模型注入的共同目标基线

### 7.2 SummaryEntry

职责：单轮结构化事实摘要。

- 记录目标、已完成、关键决策、改动文件、状态、阻塞
- 作为 Curator 产物的客观事实层

### 7.3 SummaryCache

职责：最近若干条 `SummaryEntry` 的滑动窗口。

- 提供近期演进轨迹
- 避免每次都读取全部原始历史

### 7.4 Principles Registry

职责：principles 的单一运行时存储源，统一承载人工宪法原则与 Reflector 历史经验原则。

- Reflector 输出的 `principleOps` 的持久化落点
- 提供后续注入与经验沉淀

当前语义：
- `origin=manual && promoted=true`：人工宪法原则，注入时优先于普通历史经验层，且不参与自动衰减/删除
- 其余条目：普通历史经验原则，继续参与 `hintCount + activeScore + conflictGroupId` 治理
- 人工宪法原则当前不走 review/HTML 编辑链，直接手改 `principles-registry.json` 维护

### 7.5 GoalState 注入与 ReflectorGoalContext 的统一

`buildGoalStateInjection(...)` 与 `buildReflectorGoalContext(...)` 都通过共享的 `buildGoalViewModel(...)` 生成视图，保证主模型在 `before_agent_start` 与 Reflector 在 `agent_end` 看到的目标焦点来自同一套逻辑。

共享视图包含：
- 当前焦点目标
- 并行活跃目标
- 最近完成目标
- 最近目标迁移
- updatedRound

### 7.6 Reflector 输入契约

```ts
interface ReflectorGoalContext {
  currentFocusGoalId: string | null;
  focusPath: Array<{
    id: string;
    assertion: string;
    status: "active" | "suspended" | "completed";
  }>;
  siblingActiveGoals: Array<{ id: string; assertion: string }>;
  recentMigrations: Array<{
    fromGoalId: string | null;
    toGoalId: string;
    reason: string;
  }>;
}

interface ReflectorInput {
  currentRoundConversation: string;
  currentGoalState: GoalStateDocument | null;
  goalContext?: ReflectorGoalContext | null;
}
```

设计原则：
- 方向评估必须依赖当前目标基线
- 盲点 / 风险 / 建议应相对当前焦点目标链判断
- principleOps 应来自"围绕目标执行后的经验"

### 7.7 Curator 输出摘要

```ts
interface CuratorResult {
  summaryEntry: SummaryEntry;
  goalState: GoalStateDocument;
  signal: GoalSignal;
}
```

### 7.8 Reflector 输出摘要

```ts
interface ReflectorResult {
  advice: string;
  principleOps: PrincipleOp[];
  hasSubstantiveContent: boolean;
}
```

---

## 8. Compaction 最终口径

扩展当前不再维护第二套内置 LLM compaction summarize 流程。

`session_before_compact` 的行为只有两种：

| 条件 | 行为 |
|------|------|
| 有 Curator summary | 扩展返回自定义 compaction，`details.strategy = "curator-summary"` |
| 无 Curator summary | 扩展返回 `undefined`，Pi 使用默认 compaction |

---

## 9. 状态模型最终口径

### 9.1 主观测字段

**Reflector：**
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

**Curator：**
- `status`
- `lastSummary`
- `lastSummaryEntry`
- `lastGoalState`
- `lastSignal`
- `summaryCache`
- `processedUpToAgentRound`
- `lastCuratedAgentRound`

### 9.2 兼容字段

以下字段仍保留，但已降级为兼容层：

- `turnCount`
- `processedUpToTurn`
- `grcTurnThreshold`
- `grcCooldownTurns`
- `curatorKeepRecentTurns`
- `curatorEveryAgentRounds`

原则：可以继续读取旧状态 / 旧配置，但当前主路径不再依赖这些字段驱动核心行为。

---

## 10. 配置字段表

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `grc.enabled` | `true` | 是否启用 Generator / Reflector / Curator 整体机制 |
| `grc.midRunTurnThreshold` | `15` | 单次 agent-round 内多少个 turn-round 后触发 mid-run Reflector |
| `grc.keepRecentAgentRounds` | `3` | context 中保留最近多少轮原始 agent-round 对话 |
| `grc.summaryCacheSize` | `15` | SummaryCache 的 FIFO 大小 |
| `grc.maxGoalStateActive` | `5` | GoalState 中 active 目标上限 |
| `grc.subagentModel` | `gemini-3-flash` | Subagent 使用的模型 |
| `grc.subagentModelProvider` | `opencode` | Subagent 模型提供者 |
| `grc.maxReflectorTokens` | `1500` | Reflector 输出 token 上限 |
| `grc.maxCuratorSummaryTokens` | `3000` | Curator 摘要 token 上限 |
| `grc.principlesDir` | `~/.passtocontext/memory/principles` | 原则存储目录 |
| `grc.maxPrinciplesInjection` | `5` | 注入 context 的原则数量上限 |
| `grc.maxPrinciples` | `100` | 原则库总量上限 |
| `grc.orchestratorToolPrefixes` | `[passto_planner_, passto_executor_, passto_builder_]` | Orchestrator 工具前缀过滤 |
| `grc.widgetNoticeMaxChars` | `24` | Widget 动态提示最大字符数 |

### 废弃字段

- `grc.grcTurnThreshold`
- `grc.grcCooldownTurns`
- `grc.curatorEveryAgentRounds`
- `grc.curatorKeepRecentTurns`

---

## 11. /ptc status 最终口径

当前保留以下核心观测项：

- current agent-round / current turn-round
- Reflector status / last reflected round
- Curator status / last curated round
- SummaryCache entries
- last signal
- latest curator artifact round
- latest reflector diagnosis / advice
- GoalState snapshot
- principles stored
- orchestrator guard
- context usage

已移除或降权：objective / ledger、injected summary cache rounds、latest summary entry、legacy prompt-rounds、legacy turnCount 及其他迁移阶段调试项。

---

## 12. 测试覆盖概览

### 12.1 测试入口

| 命令 | 覆盖范围 |
|------|----------|
| `npm run test:grc` | 快速 Node 回归链（含 `test:draft-goal`：`draftGoalOp` 单测 + fresh real session proof） |
| `npm run test:tmux` | 真实 Pi / tmux 集成回归聚合链（`test:tui + test:midrun + test:reflector-replay`） |
| `npm run test:regression` | 主回归链，串联 `test:grc + test:tmux` |

### 12.2 test:grc 覆盖

- Curator 输出解析 / artifact restore
- Reflector artifact restore / latest diagnosis replay（含 `processedUpToAgentRound` / `lastReflectedAgentRound` 对齐语义）
- Reflector 输入与 prompt 注入
- GoalState 注入与 ReflectorGoalContext 对齐
- previous-round slicing
- compaction handler 的 curator-only 接管
- round-based state 字段更新与 restore
- `/ptc status` 的收敛口径
- `draftGoalOp` 的解析、首轮空 `lastGoalState` bootstrap、runtime overlay 与 fresh real session proof

### 12.3 test:tmux 额外覆盖

- `/ptc status` / `/ptc on` / `/ptc off` / `/ptc config`
- `/reload` 后 runtime 状态恢复
- `/new` 后 session-scoped 运行态重置
- mid-run Reflector 的 `grc-mid-run-debug` 审计链
- Reflector artifact 的真实 append / replay / reload 恢复
- Latest Reflector Diagnosis / Latest Reflector Advice 的真实 TUI 展示与恢复

---

## 13. 风险与约束

| 风险 | 说明 | 缓解 |
|------|------|------|
| Curator 每轮执行增加模型成本 | 每次 `before_agent_start` 都会多一次模型调用 | 保持输入紧凑、强化结果复用与失败降级 |
| GoalState 质量受 Curator 输出质量影响 | 输出错误会污染长期状态 | 加强 JSON 校验、失败降级、保留旧版 GoalState |
| Reflector 原则提取质量不稳定 | `principleOps` 可能过度创建或合并 | 限制单轮 `principleOps` 数量、失败时跳过原则应用 |
| mid-run Reflector 反复纠偏造成噪音 | 运行中频繁 `steer` 可能打断模型 | 每个 agent-round 最多触发一次 mid-run Reflector，且 steer 保持极薄 |

---

## 14. 最终结论

PasstoContext 现已收敛为：

- `before_agent_start → Curator(previous-round)`
- `agent_end → Reflector(current-round)`
- `GoalState + SummaryCache + recent raw rounds` 重建工作上下文
- principles 注入已显式分层为：**人工宪法原则层 > 普通历史经验层**
- `session_before_compact` 仅复用 Curator summary，否则回退 Pi 默认
- `/ptc status` 以 round-centric 核心观测为准
- Curator / Reflector 详细设计分别见子文档

---

*版本：design_v1.2 | 更新时间：2026-05-14*
