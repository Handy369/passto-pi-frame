# PasstoContext GRC v1.1 主设计文档

> ⚠️ 归档提示：当前实现请**优先参考** `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`。
> ⚠️ 命名映射：本文保留 v1.1 编写时术语；若出现 `/pta`、`manualMode`、`forced-on / forced-off`，请按当前实现理解为 `/ptc` 与顶层 `runtimeMode` 的历史前身。
> 本文档保留为主设计背景与边界说明，不再单独作为当前代码实现依据。
>
> 版本：v1.1
> 状态：主设计收缩版
> 最后更新：2026-05-09

---

## 0. 文档定位

本文档是 v1.1 的主设计文档，只保留：

- GRC 总体架构
- Pi 生命周期中的触发点与职责分工
- Reflector / Curator / context / compaction 的边界
- 状态模型、配置口径、实施路径
- Curator 详细设计文档入口

Curator 的详细数据结构、更新规则、GoalState 设计、Summary 分层记忆设计统一下沉至：

- `./curator-v1.1.md`

主设计文档不重复展开 Curator 内部细节。

---

## 1. 设计目标

### 1.1 核心目标

PasstoContext v1.1 的目标是：

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

v1.1 不试图解决：

- 让 Reflector / Curator 拥有工具调用能力
- 用 subagent 递归审计原则库
- 替换 Pi 原生 compact 的底层实现
- 在本轮方案中引入 embedding / 语义检索
- 在本轮方案中重写 memory 系统

---

## 2. Pi 生命周期与统一术语

### 2.1 Pi 原生生命周期

一次典型 Pi 运行流程：

- `session_start`
- `session.prompt(...)`
- `input`
- `before_agent_start`
- `agent_start`
- `turn_start`
- `context`
- `before_provider_request`
- `after_provider_response`
- `message_start / message_update* / message_end`
- `tool_execution_start / tool_execution_update* / tool_execution_end`
- `turn_end`
- 重复若干次 `turn_start -> turn_end`
- `agent_end`

运行中追加注入：

- `steer`
- `followUp`

### 2.2 统一术语

#### prompt-round

从一次 `session.prompt(...)` 开始，到该次外层调用完成为止。

#### agent-round

一次 `agent_start -> agent_end` 的生命周期。

#### turn-round

一次 `turn_start -> turn_end` 的生命周期。

#### message

单条 user / assistant / toolResult / custom_message / branch_summary 消息对象。

#### user-turn

v1.1 不再使用 `user-turn` 作为主调度术语。

---

## 3. v1.1 总体架构

### 3.1 四条主链路

v1.1 由四条主链路组成：

1. **post-round Reflector 链路**
   - `agent_end` 后异步启动 Reflector
   - 处理当前 `round N`
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

### 3.2 Curator 子文档入口

Curator 的详细设计统一见：

- `./curator-v1.1.md`

该子文档覆盖：

- `GoalStateDocument` 设计
- `SummaryEntry / SummaryCache / Summary 仓库`
- Curator 输入输出契约
- Curator 更新规则
- GoalState 的归一化树结构

主设计文档只保留 Curator 的运行边界与集成方式。

### 3.3 Curator 运行模型

Curator 的实现实体是一个**异步 LLM subagent**。

实现方式：

- 本地代码负责收集输入、构造 prompt、发起异步模型调用、解析结果、校验结果、持久化结果
- Curator 的语义判断由 LLM 完成
- 本地代码不承担目标裁决与摘要生成语义

与当前实现对齐的关键接口：

- `buildCuratorSubagentPrompt(...)`
- `executeTextCompletion(...)`
- `parseCuratorOutput(...)`
- `executeCurator(...)`

### 3.4 Reflector 运行模型

Reflector 的实现实体也是一个**异步 LLM subagent**。

实现方式：

- 本地代码负责构造 Reflector prompt、异步模型调用、结果解析与 `principleOps` 应用
- Reflector 负责 advice 生成与 `principleOps` 提取
- Reflector 的判断必须相对当前目标基线进行，而不能只基于对话文本本身

与当前实现对齐的关键接口：

- `buildReflectorSubagentPrompt(...)`
- `executeTextCompletion(...)`
- `parseReflectorOutput(...)`
- `executeReflector(...)`

### 3.5 Reflector 输入契约

Reflector 的最小输入不应再是单一 `conversation`。

v1.1 目标输入应至少包含：

```ts
interface ReflectorInput {
  currentRoundConversation: string;
  currentGoalState: GoalStateDocument | null;
}
```

推荐进一步收敛为“对话 + 焦点目标视图”，避免直接注入整棵树：

```ts
interface ReflectorGoalContext {
  currentFocusGoalId: string | null;
  focusPath: Array<{
    id: string;
    assertion: string;
    status: "active" | "suspended" | "completed";
  }>;
  siblingActiveGoals: Array<{
    id: string;
    assertion: string;
  }>;
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

- `方向评估` 必须依赖当前目标基线
- `盲点 / 风险 / 建议` 应相对当前焦点目标链判断
- `principleOps` 应来自“围绕目标执行后的经验”，而不是脱离目标的空洞常识

---

## 4. 事件职责与时序

### 4.1 `before_agent_start`

职责：

- 启动 Curator Async LLM Subagent
- 注入基础 GRC prompt
- 注入最近 Reflector advice
- 注入 principles
- 注入记忆工具指令

Curator 输入：

- `previousRoundConversation`
- `currentUserMessage`
- `currentGoalState`

Curator 输出：

- `SummaryEntry`
- `GoalStateDocument`
- `signal`

### 4.2 `agent_start`

职责：

- 初始化本轮运行态
- 写入 `passto-round-boundary`

### 4.3 `turn_end`

职责：

- `currentTurnRound++`
- 检查是否触发 mid-run Reflector

### 4.4 `agent_end`

职责：

- `totalAgentRounds++`
- 异步启动 Reflector，处理当前 `round N`
- 不在 `agent_end` 启动 Curator

Reflector 输入：

- `currentRoundConversation`
- `currentGoalState`
- 可选：`goalContext`

Reflector 输出：

- `advice`
- `principleOps`

### 4.5 `context`

职责：

- 注入 `GoalStateDocument`
- 注入 `SummaryCache`
- 注入记忆工具指令
- 保留最近 `keepRecentAgentRounds` 轮原始对话

### 4.6 `session_before_compact`

职责：

- 优先复用 Curator 最新结果
- 不足时回退默认 compact 路径

---

## 5. 高层时序图

```text
prompt-round 开始
  │
  ├─ input
  │
  ├─ before_agent_start
  │    ├─ 启动 Curator Async LLM Subagent
  │    ├─ Curator 读取 previousRoundConversation
  │    ├─ Curator 读取 currentUserMessage
  │    ├─ Curator 读取 currentGoalState
  │    ├─ Curator 生成 SummaryEntry
  │    ├─ Curator 更新 GoalStateDocument
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
  │    ├─ context
  │    │    └─ 重建上下文
  │    ├─ LLM / 工具执行
  │    └─ turn_end
  │         ├─ currentTurnRound++
  │         └─ 若达到阈值 → mid-run Reflector + steer
  │
  └─ agent_end
       ├─ totalAgentRounds++
       ├─ 异步启动 Reflector
       ├─ Reflector 读取 currentRoundConversation
       ├─ Reflector 读取 currentGoalState / goalContext
       ├─ Reflector 输出 advice
       └─ Reflector 输出 principleOps
```

---

## 6. Reflector / Curator 职责边界

### 6.1 Reflector

Reflector 负责：

- 当前 round 的反思
- 相对当前 GoalState 的方向评估
- 风险识别
- 建议生成
- `principleOps`

Reflector 依赖输入：

- `currentRoundConversation`
- `currentGoalState`
- 推荐补充 `ReflectorGoalContext`

Reflector 不负责：

- `GoalStateDocument` 更新
- `SummaryEntry` 生成
- SummaryCache 维护

### 6.2 Curator

Curator 负责：

- 上一轮客观事实归档
- `SummaryEntry` 生成
- `GoalStateDocument` 更新
- `signal` 生成
- SummaryCache 推进

Curator 不负责：

- `principleOps`
- 原则提取
- advice 生成

### 6.3 principleOps 归属

`principleOps` 在 v1.1 中完全归属 Reflector。

Curator 输出契约中不包含 `principleOps`。

---

## 7. agent-round 边界定位方案

### 7.1 正式方案

在 `agent_start` 写入 custom entry：

- `passto-round-boundary`

边界用于：

- 定位上一轮原始对话
- 保留最近 N 轮 agent-round 原始消息
- 记录 SummaryEntry 的 entry 范围

### 7.2 约束

- `event.messages` 不作为 agent-round 边界定位主依据
- `sessionManager.getBranch()` + custom entry 是主路径

---

## 8. context 主路径

`context` 事件负责：

1. 构建注入到 system prompt 的结构化信息
   - GoalStateDocument
   - SummaryCache
   - 记忆工具指令

2. 裁剪原始 messages
   - 仅保留最近 `keepRecentAgentRounds` 轮 agent-round 原始对话

Curator 详细注入结构见：

- `./curator-v1.1.md`

---

## 9. 数据模型摘要

### 9.1 Curator 输出摘要

```ts
interface CuratorResult {
  summaryEntry: SummaryEntry;
  goalState: GoalStateDocument;
  signal: GoalSignal;
}
```

### 9.2 Reflector 输入 / 输出摘要

```ts
interface ReflectorGoalContext {
  currentFocusGoalId: string | null;
  focusPath: Array<{
    id: string;
    assertion: string;
    status: "active" | "suspended" | "completed";
  }>;
  siblingActiveGoals: Array<{
    id: string;
    assertion: string;
  }>;
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

interface ReflectorResult {
  advice: string;
  principleOps: PrincipleOp[];
  hasSubstantiveContent: boolean;
}
```

### 9.3 Curator 详细设计入口

以下内容不在主文档重复展开：

- `SummaryEntry` 字段定义
- `GoalStateDocument` 完整类型
- `SummaryCache` 结构
- Curator 更新规则
- GoalState 树结构

统一入口：

- `./curator-v1.1.md`

---

## 10. 运行态状态模型

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
  };
}
```

---

## 11. 配置方案

### 11.1 示例配置

```json
{
  "grc": {
    "enabled": true,
    "midRunTurnThreshold": 15,
    "keepRecentAgentRounds": 3,
    "summaryCacheSize": 15,
    "maxGoalStateActive": 5,
    "subagentModel": "gemini-3-flash",
    "subagentModelProvider": "opencode",
    "maxReflectorTokens": 1500,
    "maxCuratorSummaryTokens": 3000,
    "principlesDir": "~/.passtocontext/memory/principles",
    "maxPrinciplesInjection": 5,
    "maxPrinciples": 100,
    "orchestratorToolPrefixes": [
      "passto_planner_",
      "passto_executor_",
      "passto_builder_"
    ],
    "widgetNoticeMaxChars": 24
  }
}
```

### 11.2 字段说明

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `grc.enabled` | `true` | 是否启用 Generator / Reflector / Curator 整体机制 |
| `grc.midRunTurnThreshold` | `15` | 单次 agent-round 内多少个 turn-round 后触发 mid-run Reflector |
| `grc.keepRecentAgentRounds` | `3` | context 中保留最近多少轮原始 agent-round 对话 |
| `grc.summaryCacheSize` | `15` | SummaryCache 的 FIFO 大小 |
| `grc.maxGoalStateActive` | `5` | GoalState 中 active 目标上限 |
| `grc.widgetNoticeMaxChars` | `24` | widget 动态提示最大字符数 |

### 11.3 废弃字段

以下字段在 v1.1 视为废弃：

- `grc.grcTurnThreshold`
- `grc.grcCooldownTurns`
- `grc.curatorEveryAgentRounds`
- `grc.curatorKeepRecentTurns`

---

## 12. 关键设计决策

1. 删除旧的激活阈值补丁体系
2. 以 `agent-round` 作为 post-round 分析主单位
3. 以 `turn-round` 作为运行中纠偏主单位
4. 以 `context` 作为主路径，`session_before_compact` 作为兜底路径
5. Curator 作为异步 LLM subagent 在 `before_agent_start` 执行
6. Reflector 作为异步 LLM subagent 在 `agent_end` 执行
7. `principleOps` 完全归属 Reflector
8. Curator 详细设计下沉到 `./curator-v1.1.md`

---

## 13. 风险与约束

| 风险 | 说明 | 缓解 |
|------|------|------|
| Curator 每轮执行增加模型成本 | 每次 `before_agent_start` 都会多一次模型调用 | 保持输入紧凑、强化结果复用与失败降级 |
| GoalState 质量受 Curator 输出质量影响 | 输出错误会污染长期状态 | 加强 JSON 校验、失败降级、保留旧版 GoalState |
| Reflector 原则提取质量不稳定 | `principleOps` 可能过度创建或合并 | 限制单轮 `principleOps` 数量、失败时跳过原则应用 |
| mid-run Reflector 反复纠偏造成噪音 | 运行中频繁 `steer` 可能打断模型 | 每个 agent-round 最多触发一次 mid-run Reflector，且 steer 保持极薄 |

---

## 14. 实施路径

### Phase 1：术语与状态字段迁移

- 明确弃用 `user-turn`
- 新增 `totalAgentRounds`
- 新增 `currentAgentRound`
- 新增 `currentTurnRound`

### Phase 2：边界标记与切片

- `agent_start` 写入 `passto-round-boundary`
- 实现按 round 边界切片原始对话

### Phase 3：Reflector / Curator 执行链路调整

- `agent_end` 启动 Reflector 处理 `round N`
- `before_agent_start` 启动 Curator 处理上一轮
- `principleOps` 从 Curator 调用链迁移到 Reflector 调用链
- Reflector 输入从单一 `conversation` 升级为 `currentRoundConversation + currentGoalState`
- 优先引入 `ReflectorGoalContext`，避免直接注入整棵 GoalState

### Phase 4：Curator 数据模型与主文档拆分

- Curator 输出收敛为 `SummaryEntry + GoalStateDocument + signal`
- Curator 详细设计下沉至 `./curator-v1.1.md`
- 主设计文档删除 Curator 重复展开内容

### Phase 5：context 重建主路径

- 注入 GoalState
- 注入 SummaryCache
- 注入最近 N 轮原始 agent-round
- 注入记忆工具指令

### Phase 6：compaction 兜底路径

- `session_before_compact` 优先复用 Curator 结果
- 不足时回退默认 compact

---

## 15. 最终结论

PasstoContext v1.1 的主设计收敛为：

- Reflector：异步 LLM subagent，运行于 `agent_end`，负责 `advice + principleOps`
- Curator：异步 LLM subagent，运行于 `before_agent_start`，负责 `SummaryEntry + GoalStateDocument + signal`
- context：主上下文重建路径
- session_before_compact：兜底路径
- Curator 详细设计统一由 `./curator-v1.1.md` 承接
