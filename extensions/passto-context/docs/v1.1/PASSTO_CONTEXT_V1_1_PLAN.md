# PasstoContext v1.1 计划

> ⚠️ 归档提示：当前实现请**优先参考** `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`。
> ⚠️ 命名映射：本文保留计划阶段术语；若出现 `/pta`、`manualMode`、`forced-on / forced-off`，请按当前实现理解为 `/ptc` 与 `runtimeMode` 的旧命名。
> 本文档保留为历史计划与迁移过程记录，不再单独作为当前代码实现依据。
>
> 状态：部分已实现（2026-05-09 已按真实代码同步）  
> 范围：`extensions/passto-context`  
> 目标：在 `passto-context` 已主动修剪上下文、导致 Pi 原生 auto-compaction 可能长期不触发的前提下，补齐“目标保真、历史不断链、摘要可迭代”的缺口。

## 0. 当前代码落地概览（2026-05-09）

### 0.1 已实现

- `agent-round / turn-round` 术语与主调度已基本落地
- `agent_start` 持久化 `passto-round-boundary`
- Curator 已输出 `summaryEntry + GoalStateDocument + RequirementLedger + signal`，当前应进一步改为：**在 `agent_end(N)` 处理 `round N-1`，以便利用下一轮用户反馈做完成识别**
- `before_agent_start` 已注入 `ObjectiveSnapshot + GoalState + SummaryCache + Reflector advice + principles`
- `SummaryCache` 已支持 FIFO、去重最近 raw rounds、注入诊断与 overflow eviction 日志
- `context` 主路径已转向“最近 N 个 agent-round 原始消息 + GoalState/SummaryCache”，同时保留 `lastSummary` fallback
- `grc-curator-artifact` 已落地：Curator 完成后 append，`session_start` 时 replay 重建事实态
- `grc-reflector-artifact` 已落地：Reflector 完成后 append，`session_start` 时 replay 恢复最新轻状态
- artifact 恢复已具备显式校验与观测（rejected 数、summaryCacheRounds、goalStateRound、lastDiagnosis、lastReflectedRound）
- `/ptc status`（当时命名为 `/pta status`）已展示 `SummaryCache entries`、`Injected SummaryCache rounds`、`Latest Curator Artifact Round`、`Objective Snapshot`、`Requirement Ledger`、`GoalState Snapshot`、`Last Signal`
- `scripts/tui-regression.sh` 与 `scripts/midrun-regression.sh` 已通过

### 0.2 尚未实现 / 仍在设计

- Delayed Curator 的正式代码落地（当前设计已确认，代码仍需完全切换）
- 与 Delayed Curator 对齐的状态字段收敛
- 与 Delayed Curator 对齐的 Curator 输入/恢复语义收敛

> 注：`ObjectiveSnapshot` 已切换为 RequirementLedger 驱动的投影版本；当前未完成部分主要在 Delayed Curator 时序闭环。

### 0.3 当前定位

当前代码已经形成 **v1.1 过渡主链**，但尚未达到本计划最初设想的“完整 branch-scoped 工作记忆系统”。
已实现部分主要集中在：
- GoalState / SummaryCache 结构化上下文
- agent-round 边界
- Curator / Reflector artifact 持久化与恢复
- 运行观测与诊断补全

---

## 0.4 新增时序修正：Delayed Curator

针对当前设计中的一个关键缺陷，v1.1 计划补充如下时序修正：

- Curator 的“目标完成识别”不能只依赖 `round N` 自身
- 它往往需要读取用户在**下一条输入**里对 `round N` 结果的接受 / 纠正 / 补充 / 推进信号
- 因此，Curator 若在 `agent_end(N)` 直接处理 `round N`，会与其依赖条件发生时序冲突

为解决该问题，实施计划改为：

- **Reflector 在 `agent_end(N)` 处理 `round N`**
- **Curator 在 `agent_end(N)` 处理 `round N-1`**
- Curator 处理 `round N-1` 时，额外读取：
  - `round N-1` 的完整对话
  - `round N` 的用户反馈信号（最少第一条用户消息）

这样 Curator 才能更可靠地完成：

- 完成识别
- signal 判断
- RequirementLedger 更新
- GoalState 更新

这个调整意味着：

- 最新一轮会暂时处于“未 curator 归档”状态
- 但该轮仍存在于最近原始上下文中，第一版可接受
- 最新一轮会暂时处于“未 curator 归档”状态，直到下一轮用户反馈到来后才可稳定判断是否完成

## 1. 背景与问题定义

### 1.1 当前现状

`passto-context` v1.0 已具备：

- `before_agent_start` 注入基础 GRC prompt / principles / memory
- `agent_end` 触发 Reflector；Curator 改为在 `agent_end(N)` 处理 `round N-1`
- `context` hook 在旧方案中主要依赖单条 Curator 摘要兜底被修剪历史；v1.1 已转向结构化上下文重建
- `session_before_compact` 在 GRC 模式下优先复用 Curator 结果
- `/ptc` 命令面（历史阶段为 `/pta` 控制台）、TUI 回归、并发与恢复保护

同时，Pi 自身也有一套成熟的原生 compaction 机制：

- 按 token budget 保留最近上下文
- 用结构化 summary 替换历史
- 通过 `previousSummary -> newSummary` 形成迭代摘要链
- 显式保留：Goal / Constraints / Progress / Decisions / Next Steps / Critical Context

### 1.2 核心矛盾

`passto-context` 会在每次 LLM 调用前，通过 `context` hook 先行修剪上下文。

这会带来两个后果：

1. 主模型的实时上下文变小，Pi 原生 **auto-compaction** 触发概率下降
2. 一旦 auto-compaction 长期不触发，`passto-context` 事实上接管了“长期上下文管理”的职责

也就是说：

> 不能再默认依赖 Pi 原生 auto-compaction 在关键时刻自动兜底。

因此，`passto-context` v1.1 必须内建一套“原生 compact 哲学的补偿机制”。

---

## 2. v1.0 的关键缺口

### 2.1 旧方案只有单条最新 Curator 摘要，长期上下文承载能力不足

当前主要依赖：

- `grcState.curator.lastSummary`

问题：

- 它只代表“最近一次” Curator 输出
- 不代表“所有已经被修剪掉的历史”
- 不具备类似 Pi 原生 `previousSummary -> newSummary` 的累计能力

### 2.2 目标没有被独立锚定

当前“目标是什么”主要靠以下机制间接保留：

- 旧版 Curator 摘要中的 `## 目标`
- `serializeConversation(..., preserveFirstUserMessage: true)`
- 偶发触发的原生 compaction summary
- 相关命中的 memory 注入

问题：

- [部分已补齐] 已有一个 branch-scoped、每轮固定注入的“当前目标锚点”（`ObjectiveSnapshot` MVP）
- 但目标、约束、偏好、非目标、成功标准仍未被 RequirementLedger 级别地单独维护

### 2.3 用户输入缺少长期结构化沉淀

当前用户历史主要存在于：

- 原始 session branch
- 被动进入 compaction / curator 摘要
- 零散进入 memory

问题：

- 没有“用户需求账本（ledger）”
- 无法稳定表达“用户后续修订了哪些要求”
- 无法明确解决同一目标的多次修正、撤销、补充

### 2.4 `context` 修剪主要按近轮消息窗口组织，不够接近 Pi 原生 compact

当前更像：

- 保留最近 N 轮
- 其余主要由单条最新 Curator 摘要兜底

问题：

- 不具备原生 compact 的结构化历史迭代能力
- 没有把被修剪历史持续整合进一份 branch 级状态
- `lastSummary` 太脆弱，难以承载长期工作链

---

## 3. v1.1 设计目标

### 3.1 总目标

在 Pi 原生 auto-compaction 长期不触发的情况下，`passto-context` 仍然能够：

- 保证“当前目标”不丢失
- 保证“已修剪历史”不断链
- 保证“历史摘要”可迭代而不是只保留最后一次
- 保证“用户需求修订”有独立结构化存储
- 让 `context` 修剪尽量继承 Pi 原生 compact 的设计哲学

### 3.2 设计原则

1. **目标单独锚定**，不再只依赖摘要正文
2. **历史上下文可持续重建**，不再只看最后一次 Curator 输出
3. **用户需求结构化沉淀**，不直接全量 raw 注入
4. **分层注入**：system / context / retrieval 各司其职
5. **兼容 Pi 原生 compact**：若原生 `/compact` 或 auto-compaction 真的触发，结果至少要能作为当前会话恢复与上下文重建的高价值输入
6. **尽量小步升级**：v1.1 先完成机制补偿，不重写整个 GRC

---

## 4. v1.1 目标架构

v1.1 引入三层长期上下文结构：

### 4.1 Objective Snapshot（目标锚点）

作用：

- 稳定表达当前对话 / 当前分支最重要的用户目标信息
- 每次 `before_agent_start` 固定注入 systemPrompt

建议结构：

```ts
interface ObjectiveSnapshot {
  primaryGoal: string;
  constraints: string[];
  preferences: string[];
  nonGoals: string[];
  successCriteria: string[];
  openQuestions: string[];
  updatedAtTurn: number;
  sourceTurnIds: string[];
}
```

说明：

- `primaryGoal`: 当前主要目标
- `constraints`: 约束条件，如技术栈、时限、边界
- `preferences`: 用户偏好，如输出风格、实现方式
- `nonGoals`: 明确不做什么
- `successCriteria`: 什么算完成
- `openQuestions`: 仍需确认的问题

### 4.2 User Requirement Ledger（用户需求账本）

作用：

- 从用户消息中持续提取需求增量
- 记录“新增 / 修订 / 撤销”的要求
- 作为 Objective Snapshot 的上游事实层

建议结构：

```ts
interface RequirementLedgerItem {
  id: string;
  category: "goal" | "constraint" | "preference" | "non-goal" | "success" | "question";
  content: string;
  status: "active" | "superseded" | "withdrawn";
  sourceTurnId: string;
  createdAtTurn: number;
  supersededBy?: string;
}
```

说明：

- 不直接把所有 raw user message 原文注入 LLM
- 而是提取稳定的需求事实
- 通过状态机表达“已被新要求覆盖”或“用户已撤销”

### 4.3 运行态状态模型（v1.1 摘要版）

为让 Delayed Curator 与当前代码接线关系清晰，v1.1 计划中的运行态应至少覆盖以下字段：

```ts
interface GRCStateV11 {
  mode: "normal" | "grc";
  manualMode: "auto" | "forced-on" | "forced-off";

  totalAgentRounds: number;
  currentAgentRound: number | null;
  currentTurnRound: number;

  reflector: {
    status: "idle" | "running" | "done" | "failed";
    lastAdvice: string | null;
    lastCompletedAgentRound: number;
    startedAt: number | null;
  };

  curator: {
    status: "idle" | "running" | "done" | "failed";
    lastSummaryEntry: SummaryEntry | null;
    lastGoalState: GoalStateDocument | null;
    lastCuratedAgentRound: number;
    processedUpToAgentRound: number;
    startedAt: number | null;
  };

  summaryCache: SummaryCache;
}
```

最关键的新增状态语义：

- `lastCuratedAgentRound`：最近一次被 Curator 成功归档的稳定轮次
- `processedUpToAgentRound`：Curator 已处理到哪个 agent-round，用于恢复与幂等保护
- Curator 状态字段后续需明确区分“当前运行轮次”和“最近一次已稳定归档轮次”

旧字段迁移口径：

- `turnCount`
- `grcTurnThreshold`
- `grcCooldownTurns`
- `processedUpToTurn`（旧 user-turn 语义）

这些字段在 v1.1 中不再承担主调度职责，可在迁移期保留兼容，但应逐步让位给 agent-round / turn-round 语义。

---

## 5. 注入编排顺序（v1.1）

### 5.1 第一层：System Prompt

在 `before_agent_start` 中固定注入 Objective Snapshot：

```md
--- 当前会话目标锚点 ---
目标：...
约束：...
偏好：...
非目标：...
成功标准：...
未决问题：...
--- 目标锚点结束 ---
```

原因：

- `systemPrompt` 是最高优先级指导层
- 最适合放稳定目标与约束
- 不依赖 memory 命中
- 不依赖当前 turn 内容是否提到目标关键词

### 5.2 第二层：Context Messages

当前 v1.1 主路径不依赖单条长期摘要 message，而是依赖：

- `GoalStateDocument`
- `SummaryCache`
- 最近 N 轮真实 agent-round 原始消息
- 记忆工具指令

作用：

- 用结构化状态 + 最近原始上下文重建工作现场
- 当历史信息已被剪除时，由 LLM 按记忆工具指令自行检索，而不是预先维护一条长期聚合摘要

### 5.3 第三层：真实最近消息

保留：

- 最近若干轮真实 user / assistant / toolResult / bashExecution
- 真实最近工作现场

原因：

- 模型解决当前任务时仍需看到最新局部细节
- 不应全部被摘要吞掉

### 5.4 第四层：Retrieval 补充层

继续保留：

- session summaries
- principles
- notes
- entities

但它们定位为：

> 相关补充层，而不是“目标永远在”的主保障层。

---

## 6. Micro-compaction：弥补原生 compact 缺席

### 6.1 核心判断

因为 `passto-context` 会提前修剪上下文：

- Pi 原生 auto-compaction 触发概率下降
- 原生 structured compaction 的自动收益可能长期缺席

所以 `passto-context` v1.1 需要一个内部补偿机制：

> **Micro-compaction**：轻量级、增量式、分支级摘要更新。

### 6.2 行为目标

当前 v1.1 的 micro-compaction 目标不是维护一条持续 merge 的 branch 累计摘要，而是：

- 在原生 compact 未触发时
- 通过 `GoalStateDocument + SummaryCache + 最近 N 轮原始对话 + 记忆工具指令`
- 重建足够可靠的上下文工作现场

### 6.3 当前更新逻辑

每次 Curator 成功后，当前代码会稳定更新：

- `SummaryEntry`
- `GoalStateDocument`
- `RequirementLedger`
- `ObjectiveSnapshot`（由 ledger 投影）
- `SummaryCache`

而不是维护一条额外的 branch-scoped merge summary。

### 6.4 当前原则

1. `GoalStateDocument` 负责任务推进状态
2. `RequirementLedger` 负责用户需求事实层
3. `ObjectiveSnapshot` 负责当前目标锚点
4. `SummaryCache` 负责近窗口摘要层
5. 历史信息若被 context 剪除，由记忆工具指令引导 LLM 自行检索

---

## 7. 与 Pi 原生 compact 的关系

### 7.1 不再依赖其“必然自动触发”

v1.1 的假设是：

- 原生 auto-compaction 可能长期不发生
- 不能再把它当保底机制

### 7.2 但仍要兼容其结果

如果用户手动 `/compact` 或 auto-compaction 的确触发：

- `session_before_compact` 生成的 summary 仍然是高价值输入
- 它仍然是当前会话恢复与上下文重建的高价值输入
- 不能当成一次性可丢弃信息

### 7.3 原生 compact 的设计哲学要被继承

v1.1 需要继承 Pi 原生 compact 的三点核心：

1. **previousSummary 迭代更新**
2. **结构化保留 Goal / Constraints / Progress / Decisions / Next Steps / Critical Context**
3. **不要依赖“只看最后一版摘要”**

---

## 8. v1.1 的最小实现范围

### 8.1 已实现（相对本计划的替代落地）

1. `ObjectiveSnapshot` 已切换为 RequirementLedger 驱动的投影：由 Curator 原生产出 ledger，本地只做 parse / restore / projection，并在 `before_agent_start` 固定注入
2. `GoalStateDocument` 继续承担任务推进状态层职责
3. `SummaryCache` 继续承担近期摘要职责
4. `before_agent_start` 已固定注入 `ObjectiveSnapshot + GoalState + SummaryCache`
5. `context` hook 已不再只依赖旧的 `lastCuratorSummary` fallback，而是优先消费最近 agent-round 原始消息 + ObjectiveSnapshot/GoalState/SummaryCache
6. Curator 成功后会写入 `grc-curator-artifact`，形成可 replay 的 branch-scoped 事实链
7. `RequirementLedger` 会独立持久化为 `grc-requirement-ledger`，并在 `session_start` 恢复最新 ledger 后重建 `lastObjectiveSnapshot`
8. `/ptc status`（当时命名为 `/pta status`）已展示 Objective Snapshot / Requirement Ledger / GoalState / SummaryCache / artifact 相关状态
9. 回归测试已扩展到 TUI / mid-run / ledger / curator parser / restore replay 多条真实链路

### 8.2 仍建议实现（本计划原目标未完成部分）

10. Delayed Curator 的正式代码落地：`agent_end(N)` 处理 `round N-1`
11. `/ptc config`（当时命名为 `/pta config`）展示更明确的 v1.1 结构化工作记忆配置
12. TUI widget 增加更准确的 delayed-curator 状态提示

### 8.3 暂不做

1. 不做 embedding 级语义检索
2. 不做复杂 LLM 冲突裁决
3. 不伪造历史 `role=user` 消息
4. 不修改 Pi 原生 compact 底层实现
5. 不在 v1.1 做完整 token-budget 驱动重写

---

## 9. 配置建议（v1.1）

建议新增 / 保留与当前 v1.1 主线直接相关的 `grc` 配置项：

```json
{
  "grc": {
    "enableObjectiveSnapshot": true,
    "enableRequirementLedger": true,
    "objectiveMaxItems": 8,
    "requirementLedgerMaxItems": 80
  }
}
```

说明：

- `enableObjectiveSnapshot`: 是否启用目标锚点
- `enableRequirementLedger`: 是否启用用户需求账本
- `objectiveMaxItems`: 目标锚点最多保留多少条结构项
- `requirementLedgerMaxItems`: ledger 容量上限

---

## 10. 事件职责与数据持久化

### 10.0 事件职责表（v1.1 摘要版）

| 事件 | v1.1 职责 |
|------|-----------|
| `session_start` | 加载配置、恢复状态、加载 principles、恢复 SummaryCache / GoalState |
| `before_agent_start` | 注入 base GRC prompt、最近 Reflector advice、principles、memory/tool guidance |
| `agent_start` | 初始化当前 agent-round 运行态；写入 `passto-round-boundary` |
| `turn_end` | `currentTurnRound++`；检查 mid-run Reflector 触发 |
| `agent_end` | `totalAgentRounds++`；启动 Reflector 处理 `round N`；若 `N >= 2` 启动 Curator 处理 `round N-1` |
| `context` | 注入 GoalState + SummaryCache；只保留最近 N 轮 agent-round 原始对话 |
| `session_before_compact` | 优先复用 Curator 结果；否则回退默认 compact 路径 |
| `session_shutdown` | 等待后台任务收尾、持久化状态、清理资源 |

### 10.1 Session 持久化

建议通过 `pi.appendEntry()` 持久化以下 custom entry：

- `grc-curator-artifact`
- `grc-requirement-ledger`

原因：

- 这些状态应跟随 session / branch 演化
- 不应依赖内存变量
- 可在 `/reload` / `/resume` / `/new` 中恢复

### 10.2 不建议仅存成全局 memory

原因：

- 这三类状态是 **branch-scoped / session-scoped 工作记忆**
- 不是纯长期知识库
- 不宜只靠 retrieval 搜索命中后再注入

---

## 11. 风险与注意事项

### 11.1 风险：目标锚点过长

处理：

- 目标锚点只保留最重要信息
- 系统注入必须有长度上限
- 优先保留 primaryGoal / constraints / successCriteria

### 11.2 风险：Requirement Ledger 冲突累积

处理：

- 支持 `superseded` / `withdrawn`
- 显式记录覆盖关系
- 后续可引入人工检查或 LLM reconciliation

### 11.3 风险：Delayed Curator 的尾轮未归档

处理：

- 接受“最后一轮在下一轮用户反馈到来前暂未 curator 归档”这一设计现实
- 依赖最近原始上下文与记忆工具检索兜底
- 不在第一版额外引入 provisional curator

### 11.4 风险：与外部编排扩展冲突

处理：

- v1.1 仍遵守当前 orchestrator guard
- 在 `passto_planner_*` / `passto_executor_*` 活跃时：
  - 暂停自动 GRC 注入
  - 但可继续维护低侵入式 ledger / summary 状态（仅状态更新，不干预主 LLM）

---

## 12. 迭代拆分建议

### 12.1 已完成的前置过渡层

- agent-round / turn-round 主调度迁移
- GoalStateDocument
- SummaryCache
- `passto-round-boundary`
- `grc-curator-artifact`
- `/ptc status`（当时命名为 `/pta status`）的 GoalState / SummaryCache / artifact 观测
- 回归测试扩展（TUI / mid-run）

### 12.2 下一阶段（建议视为新的 v1.1-a）

- Delayed Curator 正式代码落地
- Curator 输入改为：`target round 对话 + next round 用户反馈信号`
- Requirement Ledger / GoalState 的更新全面切到 delayed-curator 语义

### 12.3 后续阶段（建议视为新的 v1.1-b）

- Delayed Curator 的回归与稳定性打磨
- Curator 输入窗口与“下一条用户反馈信号”提取策略优化
- `/ptc status`（当时命名为 `/pta status`）更清晰地区分 current-round 与 curated-round

### 12.4 后续阶段（建议视为新的 v1.1-c）

- 基于真实使用情况，评估是否还需要额外的长期摘要机制
- 若未来有新需求，再单独立项，而不是默认作为 v1.1 主线
- widget / UX 微调
- branch-scoped 工作记忆链闭环

---

## 13. 验收标准

### 13.1 已部分满足

1. `context` 修剪已不再完全依赖旧的 `lastCuratorSummary`
2. 主模型每轮已能看到结构化的 `ObjectiveSnapshot + GoalState + SummaryCache`
3. Curator 事实态已可通过 `grc-curator-artifact` 持久化与恢复
4. 即使 reload / resume，GoalState / SummaryCache / lastSignal / lastRequirementLedger 也有独立恢复链

### 13.2 完整 v1.1 仍需满足

1. 即使原生 auto-compaction 长期不触发，目标仍不会在多轮修剪后丢失
2. 主模型每轮都能看到稳定、简洁的 Objective Snapshot
3. 用户需求修订可被追踪，而不是只存在于原始对话里
4. Delayed Curator 与下一轮用户反馈保持时序一致，不再在当前轮过早判断完成
5. 若原生 `/compact` 触发，Curator 结果仍可作为兜底复用输入

---

## 14. 一句话总结

`passto-context v1.1` 的核心不是“再加更多摘要”，而是：

> **用 `GoalState + SummaryCache + 最近原始对话 + 记忆工具指令` 重建上下文，并通过 Delayed Curator 保证“完成识别”与用户下一轮反馈在时序上对齐。**

这样即使 Pi 原生 auto-compaction 很少触发，`passto-context` 仍能继承其最重要的设计价值。
