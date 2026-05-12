# PasstoContext 运行时架构集成设计方案

> ⚠️ 归档提示：本文为历史设计文档，当前实现口径已由 `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md` 取代；阅读实现请**优先参考**最终架构文档。
> ⚠️ 命名映射：本文包含较多历史术语。阅读当前实现时，请将 `/pta` 视为 `/ptc`，将 `manualMode / forced-on / forced-off` 视为已迁移到顶层 `runtimeMode` 的旧兼容概念。
>
> 版本: v1.2（已按 2026-05-09 代码现状同步） | 日期: 2026-05-09
> 目标: 将 GRC (Generator-Reflector-Curator) 的 GRC 三元认知循环融入 passto-context，
> 通过 Pi CLI Extension 机制实现自动化的上下文管理升级。

---

## 1. 设计目标

### 1.1 核心目标

将 GRC 框架的 Generator-Reflector-Curator 循环**以上下文管理的形式**自然融入 Pi CLI 的所有对话中：

- 简单对话不受影响（GRC 不会触发）
- 复杂对话自动升级到 GRC 模式（基于 turn 数阈值）
- Curator 接管 Pi 的上下文压缩机制，以认知价值（而非 token 数量）驱动上下文修剪
- 跨会话积累"原则"记忆

### 1.2 非目标

- 不改变用户的对话体验（GRC 在后台运行，用户只看到 widget/status 弱提示）
- 不创建独立的 GRC extension（融入 passto-context）
- 不替换 Pi 的 session 文件机制（session 完整保留，修剪只在 LLM 视角）

### 1.3 核心关注: GRC 不是三段 prompt

**GRC 的实际能力依赖于对主 LLM 行为的多层面增强，而不是在主对话中注入三段文字。**

### 1.4 Generator 到底是什么

**Generator 就是主对话中的 LLM 本身**。它不是一个独立的模块或调用——Pi 中用户交互的那个 LLM 就是 Generator。

问题是：一个 LLM 在长对话中会退化——忘记初始目标、陷入局部方案、重复无效操作。GRC 的本质是**让 Generator 不退化**。

怎么做到？通过三个时间点、三种手段增强 Generator 的上下文质量：

```
Generator 增强的三个层面：

1. 系统层（before_agent_start → systemPrompt）
   │  永远生效，每次 LLM 调用都带上
   │
   ├── 基础认知框架（~200 tokens，始终注入）
   │   → 让 LLM 保持多方案思维、假设质疑的习惯
   │
   ├── Reflector 顾问意见（GRC 模式，R 完成后注入）
   │   → 让 LLM 知道旁观者发现了什么盲点和风险
   │   → LLM 在后续回答中会自然考虑这些意见
   │
   └── 相关 Principles（跨会话经验注入）
       → 让 LLM 站在历史经验上，不重复犯错

2. 上下文层（context hook → messages 修剪）
   │  每次 LLM 调用前重塑它"看到"的对话
   │
   └── Curator 摘要替换较早的历史记录
       → LLM 看到的不是 50 条零散消息，而是
         [结构化摘要] + [最近若干段完整历史记录]
       → 关键信息不会因为 token 限制被截断
       → 目标、决策、文件变更始终可见

3. 对话层（steer → 直接注入主对话流）
   │  在特定时刻触发 LLM 自我审视
   │
   └── GRC 触发时注入反思引导
       → LLM 暂停，回顾进展和方向
       → 这段反思本身也成为后续上下文的一部分
```

**这三层不是割裂的，而是协同的**：
- steer 让 Generator 产出一段反思 → 这段反思被 Reflector 和 Curator 读到 → 提升 R/C 的分析质量
- Reflector 的意见注入 systemPrompt → Generator 下次回答时考虑这些意见 → 修正方向
- Curator 的摘要替换较早的历史记录 → Generator 看到的上下文更聚焦 → 减少跑偏

### 1.5 术语统一（按 Pi 原生生命周期重新校正）

为避免把 passto-context 的设计建立在错误抽象上，后续文档统一以 **Pi 原生事件模型** 为准。

#### 1.5.1 Pi 原生生命周期（本节术语的前提）

一次 Pi 会话中的典型流程可概括为：

- `session_start`
- `session.prompt("...")`，等待用户输入本轮初始意图
- `input` 事件（扩展可在此做本地、非 LLM 的输入转换/处理）
- 进入 `prompt()` 对应的 agent 事件序列：
  - `before_agent_start`
  - `agent_start`
  - `turn_start`
  - `message_start / message_update* / message_end`
  - `tool_execution_start / tool_execution_update* / tool_execution_end`
  - `turn_end`
  - 重复若干个 `turn_start -> ... -> turn_end`
  - `agent_end`

其中需要特别校正两点：

- **`before_agent_start`** 属于一次 `prompt()` / agent 运行开始前的初始化干预点，适合做 system prompt 增强、上下文整理、原则注入等。
- **`steer` / `followUp` 都会表现为后续的 user message**，但它们不是“新的 prompt-round 起点”：
  - `steer`：在**当前 assistant turn 完成工具执行后、下一次 LLM 调用前**投递，用于运行中的即时干预。
  - `followUp`：在**当前 agent 工作收尾后**再投递，用于对本次 prompt 的后续补充、收尾或弥补。

#### 1.5.2 统一术语

- **弃用：`user-turn`**
  - 不再把 user message 直接当作 passto-context 的生命周期单位。
  - 原因：在 Pi 中，一个 `prompt()` / agent 生命周期内，除了用户的初始输入外，还可能插入 `steer` 与 `followUp` 形成额外的 user message；因此“user message 数量”不能稳定代表一次完整任务轮次。

- **prompt-round**
  - 定义：从一次 `session.prompt(用户初始意图)` 开始，到该次处理最终完成为止的生命周期。
  - 作用：
    - 表示“用户初始意图 → Pi 接收 → agent 完成”的完整外层交互单位。
    - 包含 `input` 事件，因此可承载本地、非 LLM 的输入转换/预处理。
    - 包含 `before_agent_start`，因此可作为 passto-context 在 agent 运行前统一做上下文管理与增强的入口。

- **agent-round**
  - 定义：一次 `agent_start -> agent_end` 的生命周期，是 agent 执行的外循环。
  - 作用：
    - 表示一次完整的 agent 运行周期。
    - 在该周期内，可以通过 `followUp` 方式补充 user message，使 agent 在原本收尾后继续追加 turn，用于收尾、补充、复核或弥补。
    - 也可以在该周期内通过 `steer` 插入 user message，对运行中方向进行纠偏。

- **turn-round**
  - 定义：一次 `turn_start -> turn_end` 的生命周期，是 agent 执行的内循环。
  - 作用：
    - 表示一次 LLM 生成 + 对应工具调用与结果回流的完整内循环。
    - 当满足条件时，可以在 turn-round 之间通过 `steer` 注入 user message，对当前 agent-round 进行“运行中”干预。
    - 适合作为“运行中卡住检测”“工具调用纠偏”“运行中反思”这类机制的计数单位。

- **message（消息层）**
  - 指单条 user / assistant / toolResult 消息对象本身。
  - 其中：
    - 第一个 turn 中出现的 user message，通常对应本次 `prompt-round` 的初始意图。
    - 后续 turn 中出现的 user message，可能来自 `steer` 或 `followUp`，属于 Pi 的运行期消息注入，而不应再被误称为新的“用户轮次”。

#### 1.5.3 后续显示与计数建议

> 本节只统一术语，不在此处强行绑定具体实现字段。

建议后续所有统计项都显式标明自己对应的层级：

- `prompt-round`：用于描述“用户一次初始请求到完成”的外层交互单位
- `agent-round`：用于描述一次 `agent_start -> agent_end`
- `turn-round`：用于描述一次 `turn_start -> turn_end`
- `message`：仅用于消息层观察，不再作为 GRC 生命周期主计数单位

如需在 widget 或状态页中显示指标，应直接写清楚是：

- 当前 agent-round 内的 `turn-round` 数
- 距离上次上下文修剪/摘要基线过去了多少个 `prompt-round` 或 `agent-round`
- 当前运行态新增的 `steer` / `followUp` 是否已经介入

### 1.6 三个角色的分工

| 角色 | 执行者 | 何时生效 | 通过什么机制 | 核心作用 |
|------|--------|---------|-------------|----------|
| **Generator** | 主对话 LLM | 每次 LLM 调用 | systemPrompt + context 修剪 + steer | 在增强的上下文中产出更好的工作结果 |
| **Reflector** | 独立 `complete()` | GRC 触发后异步 | 完整对话 → 顾问意见 → systemPrompt | 以旁观者视角审视，发现盲点和风险 |
| **Curator** | 独立 `complete()` | GRC 触发后异步 | 完整对话 → 结构化摘要 → context 修剪 | 知识提炼，让上下文保持高信噪比 |

**关键保障**：
- R 和 C 的 `complete()` 调用使用**完整的对话历史**作为输入（从 `sessionManager.getBranch()` 序列化），不是只看最近几条消息
- R 和 C 的 prompt 是**精心设计的专用 prompt**，不是通用指令，而是针对"分析一段对话"这个具体任务优化的
- R 和 C 的输出经过**结构化解析**后才注入，不是原文塞进 systemPrompt
- 如果 R 或 C 的输出质量不够，宁可不注入（空输出 → 跳过注入），不做降级注入
- Generator 的增强是**无感的**——LLM 不知道自己被增强了，它只是在更好的上下文中工作

---

## 2. 架构设计

### 2.1 整体架构

```
Pi Session 生命周期
│
├── session_start
│   ├── 加载配置
│   ├── 初始化 GRC 状态机
│   ├── 从 appendEntry 恢复 `grc-state`
│   ├── 回放 `grc-curator-artifact`，重建 GoalState / SummaryCache / lastSignal
│   ├── 对 artifact 做显式校验（agentRound / recordedAt / processedUpToUserTurn）
│   ├── 加载 principles registry
│   └── 初始化 widget / currentRun / orchestrator guard 运行态
│
├── before_agent_start （每次 prompt-round / agent-round 开始前）
│   ├── 如当前 runtime 未关闭（历史兼容条件为非 `forced-off`）且未让行 → 注入轻量 GRC 框架指令到 systemPrompt
│   ├── 注入 GoalStateDocument
│   ├── 注入去重后的 SummaryCache
│   ├── 如有 Reflector 顾问意见 → 注入 systemPrompt
│   └── 如当前 runtime 未关闭（历史兼容条件为非 `forced-off`）且未让行 → 注入当前可注入 principles
│
├── context （每次 LLM 调用前）
│   └── 优先保留最近 N 个 agent-round 原始消息；必要时再走 legacy curator summary fallback
│
├── agent_start
│   ├── 打开 currentRun，开始统计单次 agent-round 内部的 turn-round
│   └── 写入 `passto-round-boundary`
│
├── turn_end
│   ├── 更新 context-tracker（外层交互计数语义）
│   ├── 更新 widget
│   ├── currentRun.turnCount ++（turn-round 计数）
│   └── 若单次 agent-round 达到 `midRunTurnThreshold` → 触发 mid-run Reflector
│
├── agent_end
│   ├── 完成当前 agent-round 计数
│   ├── 后台启动 Reflector
│   ├── 按 `curatorEveryAgentRounds` 决定是否启动 Curator
│   └── Curator 成功后写入 `grc-curator-artifact`
│
├── session_before_compact （Pi 原生 compact 触发时）
│   └── 优先使用 Curator 最新摘要作为 compact 结果
│       若未满足条件则回退默认 compact 路径
│
└── session_shutdown
    ├── 持久化 `grc-state`
    ├── 对 principles registry 执行上限清理
    └── 清理资源
```

### 2.2 双模式运行

```
┌─────────────────────────────────────────────────┐
│ 普通模式 (外层轮次尚未达到阈值)                    │
│                                                 │
│  before_agent_start: 注入基础 GRC + principles   │
│  context: 不修剪（直通）                          │
│  turn_end: 计数 + tracking                       │
│  compact: 默认 passto-context 行为               │
│  status: 只显示基础信息                           │
│                                                 │
├──────────── 外层轮次达到阈值后进入 GRC ───────────┤
│                                                 │
│ GRC 模式（当前公开控制面已收敛到 runtime on/off；历史兼容层曾支持 forced-on / forced-off） │
│                                                 │
│  before_agent_start: 注入 GRC + principles       │
│                      + Reflector 顾问意见         │
│                      + Curator 增强提示           │
│  context: Curator 修剪较早的历史记录              │
│  turn_end: 触发后台 Reflector/Curator             │
│  compact: 原则提取 + Curator 摘要作为结果          │
│  status: 显示 GRC 运行状态                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2.3 Generator 增强的实现路径

**Generator 不需要独立实现，它的增强通过三个 hook 自然发生：**

```typescript
// 1. before_agent_start: 系统层增强
pi.on("before_agent_start", async (event, ctx) => {
  let prompt = event.systemPrompt;

  // 基础认知框架（仅在 GRC 允许接管时）
  if (!orchestrationSuspended && grcState.manualMode !== "forced-off") {
    prompt += buildBaseGRCPrompt();
  }

  // Reflector 顾问意见（GRC 模式 + R 已完成）
  if (grcState.mode === "grc" && grcState.reflector.lastAdvice) {
    prompt += buildReflectorInjection(grcState.reflector.lastAdvice);
  }

  // 当前可注入 Principles（不是按 prompt 搜索，而是从活跃原则池选择）
  if (!orchestrationSuspended && grcState.manualMode !== "forced-off") {
    const injectable = principles.listInjectable(config.maxPrinciplesInjection);
    if (injectable.length > 0) {
      prompt += formatPrinciplesForInjection(injectable);
    }
  }

  return { systemPrompt: prompt };
});

// 2. context: 上下文层增强
pi.on("context", async (event, ctx) => {
  if (grcState.mode === "grc" && grcState.curator.lastSummary) {
    return { messages: pruneContext(event.messages, grcState, config) };
  }
  // 普通模式: LLM 看到完整的原始消息
});

// 3. turn_end 或 agent_end: 对话层增强（steer）
// GRC 触发时，注入反思引导
pi.sendMessage({
  customType: "grc-reflection-steer",
  content: buildReflectionSteerPrompt(),
  display: false,
}, { deliverAs: "steer" });
// → LLM 在下一次处理前会看到这条，产出一段自我反思
// → 这段反思本身也成为对话历史的一部分
```

**Generator 增强的效果验证**（开发时需要对比测试）：
- 无 GRC 的 15 轮对话 vs 有 GRC 的 15 轮对话
- 观察: 目标保持度、方案漂移程度、重复操作次数
- 预期: 有 GRC 的对话在第 10 轮后仍能准确回溯初始目标

### 2.4 后台 Reflector/Curator 执行机制

**核心实现: 使用 `complete()` 独立调用 LLM**

```typescript
import { complete } from "@earendil-works/pi-ai";

// Reflector: 一次独立的 LLM 调用
async function executeReflector(
  conversationText: string,  // 序列化后的完整对话
  model: Model,
  auth: { apiKey: string; headers?: Record<string, string> },
  config: GRCConfig,
): Promise<string> {
  const prompt = buildReflectorPrompt(conversationText);

  const response = await complete(model, {
    messages: [{
      role: "user",
      content: [{ type: "text", text: prompt }],
      timestamp: Date.now(),
    }],
  }, {
    apiKey: auth.apiKey,
    headers: auth.headers,
    maxTokens: config.maxReflectorTokens,
  });

  return extractText(response);
}
```

**为什么用 `complete()` 而不是 fork session**：
- `complete()` 是轻量的单次 LLM API 调用，不需要创建 Pi 进程
- 输入是我们精确控制的序列化文本，不是整个 session context
- R/C 不需要工具调用能力，纯文本分析就够了
- 如果未来需要让 R/C 有工具能力（比如 Curator 需要读文件验证），再升级为 fork session

**对话序列化**：

```typescript
function serializeConversation(
  branch: Entry[],
  maxTokens: number,
): string {
  // 1. 从 sessionManager.getBranch() 获取当前分支所有 entry
  // 2. 提取 user/assistant/toolResult 消息
  // 3. 序列化为文本格式（类似 Pi compact 的 serializeConversation）
  // 4. 如果超过 maxTokens，从最旧的开始截断
  //    但保留: 第一条 user message（目标）+ 最近的 N 条
  // 5. 返回格式:
  //    [User]: 消息内容
  //    [Assistant]: 回复内容
  //    [Tool: bash]: 命令和结果摘要
  //    ...
}
```

**异步执行与结果管理**：

```typescript
// 在 turn_end 中启动（不 await）
let reflectorPromise: Promise<string> | null = null;
let curatorPromise: Promise<CuratorResult> | null = null;

// 启动
reflectorPromise = executeReflector(conversation, model, auth, config)
  .then(advice => {
    grcState.reflector.lastAdvice = advice;
    grcState.reflector.status = "done";
    fs.writeFile(reflectorPath, advice);  // 持久化备份
    return advice;
  })
  .catch(err => {
    grcState.reflector.status = "failed";
    logger.error("Reflector failed:", err);
    return "";
  });

// 在 before_agent_start 中消费
if (grcState.reflector.status === "done" && grcState.reflector.lastAdvice) {
  // 注入
}
```

### 2.5 GRC 触发的完整时序（包含 Generator 增强点）

```
agent-round 1-5（普通模式）:
  Generator 增强: 仅系统层（基础 GRC prompt + 相关 principles）
  上下文层: 无修剪，LLM 看到原始完整消息
  对话层: 无 steer

第 6 个 agent-round（GRC 触发）:
  │
  ├── (1) grcState.mode = "grc"
  │
  ├── (2) 对话层增强: steer 注入反思引导
  │       pi.sendMessage({ content: reflectionSteer, ... }, { deliverAs: "steer" })
  │       → LLM 在下一次 LLM 调用前看到
  │       → Generator 产出一段自我反思（融入正常回复）
  │       → 这段反思成为对话历史的一部分
  │
  ├── (3) 启动 Reflector complete()（异步）
  │       输入: 截至第 6 个 agent-round 的完整对话历史 + Generator 产出的反思
  │
  └── (4) 启动 Curator complete()（异步）
          输入: 截至第 6 个 agent-round 的完整对话历史

第 7 个 agent-round（before_agent_start —— Generator 被全面增强）:
  │
  ├── 系统层增强:
  │   ├─ 基础 GRC prompt（始终）
  │   ├─ 相关 principles（始终）
  │   ├─ Reflector 已完成? → 顾问意见注入 systemPrompt
  │   └─ Reflector 未完成? → 跳过，下轮再检查
  │
  └── 上下文层增强 (context hook):
      ├─ Curator 已完成? → [结构化摘要] + [agent-round 5-7 的近期记录]
      └─ Curator 未完成? → 不修剪

  此时 Generator (LLM) 看到的上下文:
    systemPrompt: [基础GRC] + [相关原则] + [顾问意见]
    messages:     [结构化摘要] + [agent-round 5] + [agent-round 6 + 反思] + [agent-round 7]
    → Generator 在这个增强上下文中产出的回答质量显著高于平铺直叙的 50 条原始消息

第 10 个 agent-round（下一轮 GRC）:
  turnCount - lastGrcTriggerTurn >= cooldownTurns (4)
  且 R/C 不在运行中
  → 触发 cycle 2
  → 新的 steer 反思引导
  → 新的 R/C（输入: Curator 摘要 + agent-round 5-10）
```

---

## 3. Widget 与 Status 设计

### 3.1 设计原则

- **弱感知**: 用户不需要理解 GRC 是什么，只需知道"系统在帮我管理对话质量"
- **信息密度**: 在一行内传递关键信息
- **状态可辨**: 不同阶段有不同的视觉信号
- **不串场**: 不再占用共享 status 区，临时状态直接并入 PasstoContext 自身 widget
- **共存保护**: 遇到外部编排型 extension 时主动让行，不争夺 LLM 流程控制权

### 3.2 Widget 布局（输入框上方）

#### 3.2.1 当前实现（已同步）

当前代码中的 widget 已更新为紧凑实现：

```text
Run:{n} {contextUsage} | 记:{memoryBytes} | 思:{reflectorStatus} | 理:{curatorStatus}
```

其中：
- `Run` = 当前 agent-round 内的 turn-round 数
- 第二字段 = 当前上下文使用量（context usage tokens）
- `记` = memory footprint
- `思` / `理` = Reflector / Curator 运行态

#### 3.2.2 当前目标规格（已落地）

当前 widget 目标规格已落地为：

```text
Run:11 7.5k | 记:28.4K | 思:✓ | 理:✓
```

语义定义：
- `Run:11`
  - `Run` = **当前 agent-round 内的 turn-round 数**
  - 表示当前 `agent_start -> agent_end` 内已完成多少个 turn-round
- `7.5k`
  - 表示**当前上下文使用量**（context usage tokens）
  - 来自 `ctx.getContextUsage()` 一类运行时上下文指标
  - 不是 memory token，也不是 context window 总上限
- `记:28.4K`
  - 表示 memory 持久层的体量（字节/容量标签）
- `思:✓` / `理:✓`
  - 分别表示 Reflector / Curator 的**真实运行态**
  - 目标是与真实执行完成、失败、运行中严格同步

#### 3.2.3 显示原则

- widget 只保留少量关键指标，不再承载过多状态词
- 默认不在 widget 中显示 logger 文本
- 使用 `Run` 表示当前 agent-round 内的 turn-round 数，避免额外缩写造成理解门槛
- context usage 与 memory footprint 必须分开，不能混成一个字段
- 反思 / 梳理状态必须以真实 runtime 为准，不允许“看起来完成，实际未完成”的漂移

### 3.3 临时状态提醒

本轮确认后，运行态临时提醒不应承载 logger 文本，也不应与调试输出混用。

目标规则：
- 只显示面向用户的轻量运行态提示
- 不显示 debug/logger 行
- 若需要调试信息，写入持久化日志目录 `~/.passtocontext/log/`
- 临时提示若保留，仍可短暂并入 widget 末尾，但应与核心指标（`Run / context usage / memory / Reflector / Curator`）分离

### 3.4 实现说明

当前代码已完成以下同步：
- 保留 `Run` 作为当前 agent-round 内 turn-round 数的名称
- widget 第二字段已切换为 **当前上下文使用量**
- `记` 字段只显示 memory footprint，例如 `记:28.4K`
- `思` / `理` 的状态以真实 runtime 为准进行显示
- logger/debug 不再进入 widget/TUI，改为持久化到 `~/.passtocontext/log/`

---

## 4. 数据结构设计

### 4.1 GRC 状态机

> 注：以下代码块保留当前实现中的字段名 `turnCount` / `processedUpToTurn`，它们是实现命名；在术语层面应分别按“外层轮次计数 / 已处理到的历史基线”理解，而不再直接等同于旧的 `user-turn` 概念。

```typescript
// 新文件: grc-state.ts

type GRCMode = "normal" | "grc";
type SubagentStatus = "idle" | "running" | "done" | "failed";

type GRCManualMode = "auto" | "forced-on" | "forced-off";

interface GRCState {
  mode: GRCMode;
  manualMode: GRCManualMode;
  turnCount: number;
  grcCycleCount: number;

  reflector: {
    status: SubagentStatus;
    lastAdvice: string | null;
    processedUpToTurn: number;
  };

  curator: {
    status: SubagentStatus;
    lastSummary: string | null;
    processedUpToTurn: number;
    principlesExtracted: number;
  };

  activatedAtTurn: number | null;
  lastGrcTriggerTurn: number;
}
```

### 4.2 配置扩展

```typescript
interface GRCConfig {
  enabled: boolean;
  grcTurnThreshold: number;        // 默认 5
  grcCooldownTurns: number;        // 默认 4
  midRunTurnThreshold: number;     // 默认 15
  curatorKeepRecentTurns: number;  // 默认 4
  subagentModel: string;           // 默认 "gemini-3-flash"
  subagentModelProvider: string;   // 默认 "opencode"
  maxReflectorTokens: number;      // 默认 1500
  maxCuratorSummaryTokens: number; // 默认 3000
  principlesDir: string;           // 默认 "~/.passtocontext/memory/principles"
  maxPrinciplesInjection: number;  // 默认 5
  maxPrinciples: number;           // 默认 100
  orchestratorToolPrefixes: string[]; // 默认 ["passto_planner_", "passto_executor_", "passto_builder_"]
  widgetNoticeMaxChars: number;    // 默认 24
}
```

### 4.3 文件系统布局

```
~/.passtocontext/
├── config.json                    # 配置（含 grc 字段）
└── memory/
    ├── sessions/                  # 现有
    ├── entities/                  # 现有
    ├── notes/                     # 现有
    └── principles/
        └── principles-registry.json  # 当前原则 registry 主存储
```

> 当前实现未采用独立 `.grc/` 工作目录持久化 Reflector / Curator 原文结果。
> 运行态审计主要依赖 session appendEntry（如 `grc-state`、`grc-mid-run-debug`）与日志。

---

## 5. Prompt 设计（核心）

### 5.0 设计原则

**Prompt 不是指令，是任务定义。**

R/C 的 prompt 不是"请你反思一下"这种模糊指令，而是**完整的任务定义**：
- 明确的角色设定
- 明确的输入格式
- 明确的输出结构
- 明确的质量标准
- 明确的禁止事项

### 5.1 基础 GRC 框架注入（始终注入到 systemPrompt，~200 tokens）

```markdown
--- PasstoContext 认知增强 ---
在处理复杂问题时，请自然地:
- 先理清真正的需求（区分表面需求和底层需求）
- 考虑是否有替代方案
- 关注假设是否成立
这不是强制格式，只是思维习惯的提醒。
```

### 5.2 Steer 反思引导（GRC 触发时通过 sendMessage 注入主对话）

```markdown
[PasstoContext] 当前对话已进行较多轮交互。
在继续之前，请用 2-3 句话简要回顾:
1. 到目前为止的主要进展
2. 当前方向是否仍然正确
然后继续你的工作。
```

目的: 让主对话的 LLM 产出一段 Generator 性质的自我评估。
约束: 不超过 3 句话，不中断工作流。

### 5.3 Reflector Subagent Prompt（独立 complete() 调用）

```markdown
# 角色
你是一个高级技术顾问，负责审视一段人机协作的对话记录。
你的意见将被注入到正在进行的对话中，作为参考。

# 输入
以下是完整的对话记录，包括用户需求、AI回复、工具调用和执行结果。

# 任务
分析这段对话，输出简洁的顾问意见。严格遵循以下结构：

## 方向评估
当前工作是否偏离了用户最初的目标？（1-2句）

## 盲点
列出 0-3 个可能被忽略的重要因素。
如果没有发现盲点，必须只写：无
不要编造不存在的问题。

## 风险
列出 0-2 个当前方案的具体风险。
只有真正具体、可操作的风险才允许写出。
如果没有明确风险，必须只写：无
禁止写泛泛而谈的风险，如"可能有性能问题"。

## 建议
给出 0-3 条具体改进建议。每条建议必须：
- 指向具体的代码/文件/设计决策
- 说明为什么要改
- 说明怎么改
如果没有实质改进建议，必须只写：无
禁止输出"继续保持"、"维持现状"、"无需改进"这类低信息量建议。

# 约束
- 总输出不超过 400 字
- 不要复述对话内容
- 不要给出用户没有问的额外建议
- 不要为了凑结构而编造问题、风险或建议
- 宁可明确写"无"，也不要写空洞正确话术

<conversation>
{serialized_conversation}
</conversation>
```

### 5.4 Curator Subagent Prompt（独立 complete() 调用）

```markdown
# 角色
你是一个上下文整理专家兼原则库策展器。你的任务是将一段对话整理为高质量的结构化摘要，
并基于当前原则库输出最小原则操作集 principleOps。

# 输入
以下包含两部分：
1. 当前完整对话记录
2. 当前整个原则库（可能为空）

# 任务一: 结构化摘要
生成一份摘要，严格使用以下结构（缺失的部分写"无"）：

## 目标
用户想完成什么（1-2句）

## 已完成
- 具体完成了什么（列表，每项 1 句）

## 关键决策
- 决策内容 → 原因（列表）

## 修改的文件
- 文件路径: 改动说明（列表）

## 当前状态
工作进展到哪里了（1-2句）

## 下一步
接下来应该做什么（1-3项）

## 注意事项
需要警惕的问题（如有）

# 任务二: principleOps
在摘要之后，额外输出一个 JSON 代码块：
```json
{ "principleOps": [ ... ] }
```

支持的操作：
- `create`
- `reuse`
- `merge`
- `conflict`

治理原则：
- 默认优先级：`reuse > merge > create`
- 仅在现有原则不能覆盖时才 `create`
- 明显策略相反时才 `conflict`
- 每次最多输出 3 个 ops
- 没有值得操作时输出 `{ "principleOps": [] }`

# 约束
- 摘要不超过 800 字
- principleOps 必须是合法 JSON
- 不要编造对话中没有的内容
- 文件路径必须是对话中实际出现的

<principles_registry>
{principles_registry_json}
</principles_registry>

<conversation>
{serialized_conversation}
</conversation>
```

### 5.5 注入格式

**Reflector 意见注入到 systemPrompt**：
```markdown

--- 顾问意见（自动生成，仅供参考）---
{parsed_reflector_advice}
--- 顾问意见结束 ---

```

注意: 不是原文注入。`parsed_reflector_advice` 是经过以下处理的：
1. 验证输出包含预期的 section（方向评估/盲点/风险/建议）
2. 如果输出格式不对或过短 → 丢弃，不注入
3. 如果输出超过 maxReflectorTokens → 截断
4. 识别 Reflector 的显式空值协议（如"无"），并将其视为无实质建议，不注入 systemPrompt

**Curator 摘要用于 context 修剪（替换较早的历史消息片段）**：
```markdown
[上下文摘要 - 以下是之前对话的整理结果]

{curator_summary}

[摘要结束 - 以下是最近的完整对话记录]
```

---

## 6. Context 修剪机制

### 6.1 修剪逻辑

```
原始 messages（发给 LLM 前，context hook 介入）:
  [user1, ass1, tool1, user2, ass2, tool2, user3, ass3, user4, ass4, ...]
   早期片段1             早期片段2         近期片段3   近期片段4

Curator 已处理到前两段历史片段，curatorKeepRecentTurns = 2:

修剪后:
  [curator_summary_as_user_msg, user3, ass3, user4, ass4, ...]
   ↑ 替换较早片段1-2        近期片段3        近期片段4（保留最近2段）
```

### 6.2 历史消息片段边界检测（当前实现近似）

```typescript
interface TurnBoundary {
  startIndex: number;  // 当前实现中，这段历史片段的第一条 role="user" 消息索引
  endIndex: number;    // 这段历史片段的最后一条消息（下一个 role="user" 之前）
  turnNumber: number;
}

function findTurnBoundaries(messages: Message[]): TurnBoundary[] {
  // 当前实现按每条 role="user" 的消息起点近似切分历史片段
  // 到下一条 role="user" 之前的所有消息结束
  // 注意: compaction summary message 不算这里的近似边界
}
```

### 6.3 与 Pi Compact 的互斥

```
Curator 通过 context hook 修剪
  → LLM 看到的 token 始终 ≈ curator_summary + 最近 4 段保留记录
  → 通常 < 30k tokens
  → 远低于 contextWindow (200k)
  → Pi compact 条件 (contextTokens > contextWindow - reserveTokens) 不满足
  → Pi compact 不触发

极端情况（单个 turn-round 内 tool 输出巨大）:
  → context hook 修剪后仍然超限
  → Pi compact 触发
  → session_before_compact 中:
    → 使用 Curator 最新摘要
    → 触发原则提取
    → 返回增强的 compact 结果
```

---

## 7. 全局原则记忆（v1.0 基础 + v2.0 规划）

### 7.1 v1.0: 当前实现（已升级到 registry + principleOps 治理）

**存储**: 单文件 registry（`principles-registry.json`），每条原则带治理元信息：
- `sources`
- `hintCount`
- `activeScore`
- `hintTimestamps`
- `mergeCount`
- `conflictGroupId`

**写入方式**: Curator 不再直接吐出“新增原则列表”，而是输出 `principleOps`，由本地治理层应用：
- `create`
- `reuse`
- `merge`
- `conflict`

**检索**:
- `search(query, limit)`: 用于用户查询 `/ptc principles`（历史阶段原称 `/pta principles`）
- `listInjectable(limit)`: 用于 `before_agent_start` 注入活跃原则池

**注入**: `before_agent_start` 中按活跃度与冲突消解后的 injectable principles 注入 systemPrompt
**注入格式**:
```markdown
--- 经验原则（来自历史会话）---
- {principle_1}
- {principle_2}
---
```

### 7.2 v2.0 规划（下版本迭代核心需求，记录在 TODO-v2.md）

> 以下是 v2.0 的设计方向，本次不实现，但需要在 v1.0 架构中预留扩展点。

**7.2.1 原则的优雅使用时机**

目前实现的注入已从“按 prompt 关键词搜索”切换到“从活跃原则池中选择 injectable principles”，但仍有两个可继续优化的问题：
- 活跃原则池仍未做到严格场景感知，可能与当前 turn 相关性不足
- 每次都注入仍会消耗 systemPrompt token 预算

v2.0 方向：
- **语义相关性**: 用 embedding 替代关键词匹配（需要额外的 embedding 模型）
- **阶段感知**: 在不同的对话阶段注入不同类型的 principles
  - 开始阶段: 注入架构/设计类 principles
  - 编码阶段: 注入实践/模式类 principles
  - 调试阶段: 注入排错/经验类 principles
- **自动标签**: Curator 在提取 principles 时自动分类标签
- **衰减机制**: principles 的注入权重随时间衰减，但被命中时刷新
- **冲突检测**: 新 principle 与旧 principle 矛盾时，提示用户选择

**7.2.2 原则的生命周期管理**

- **合并**: 多条相似 principles 合并为一条（由 Curator 在空闲时执行）
- **验证**: principles 是否仍然有效（技术栈变化可能使旧原则过时）
- **分级**: 区分"强原则"（多次验证）和"弱原则"（单次提取）
- **导出/导入**: 团队共享 principles

**7.2.3 全局记忆 → 认知图谱**

从扁平的 principle 列表演化为结构化的认知图谱：
- 实体: 项目、技术栈、人、模式
- 关系: "项目X使用技术Y"、"模式A适用于场景B"
- 推理: 基于图谱推断未明确记录的知识

**v1.0 预留的扩展点**:
- `grc-principles.ts` 的接口设计为 `search(query, options?)` 形式，options 可扩展
- principles 的 YAML 格式中保留 `metadata` 字段，用于存储未来需要的元信息
- `before_agent_start` 的注入逻辑封装为可替换的策略函数

---

## 8. 模块设计

### 8.1 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `types.ts` | 修改 | 新增 GRCConfig, GRCState 等类型 |
| `config.ts` | 修改 | 默认配置新增 grc 字段 |
| `grc-state.ts` | **新建** | GRC 状态机管理 |
| `grc-prompts.ts` | **新建** | GRC prompt 模板（核心） |
| `grc-subagent.ts` | **新建** | Reflector/Curator 的 complete() 调度 |
| `grc-principles.ts` | **新建** | 原则提取、存储、检索 |
| `grc-context-manager.ts` | **新建** | context hook 修剪逻辑 |
| `index.ts` | 修改 | 集成 GRC 到事件链与 `/ptc` 命令（历史阶段原称 `/pta`） |
| `compaction.ts` | 修改 | GRC 模式下 compact 行为变更（curator-first） |
| `context-tracker.ts` | 修改 | widget 融合 GRC 状态 |
| `utils.ts` | 修改 | 新增辅助函数 |

### 8.2 grc-subagent.ts — 核心执行引擎

这是 GRC 能力的关键文件。它不只是"调度"，而是**控制 R/C 的输入质量和输出质量**。

```typescript
/** 序列化对话历史，为 R/C 准备输入 */
function serializeConversation(
  branch: Entry[],
  options: {
    maxTokens: number;
    preserveFirstUserMessage: boolean;  // 保留第一条（目标）
    preserveRecentTurns: number;        // 保留最近 N 个 turn
    includeToolResults: boolean;        // 是否包含工具输出
    toolResultMaxChars: number;         // 工具输出截断长度
  }
): string

/** 执行 Reflector，返回结构化结果 */
async function executeReflector(
  conversation: string,
  model: Model,
  auth: AuthInfo,
  config: GRCConfig,
): Promise<ReflectorResult>

/** 解析并验证 Reflector 输出 */
function parseReflectorOutput(raw: string): ReflectorResult | null
// 验证: 必须包含"方向评估"section
// 验证: 不能全是空洞的"没问题"
// 验证: 建议必须是具体的

/** 执行 Curator，返回结构化结果 */
async function executeCurator(
  conversation: string,
  model: Model,
  auth: AuthInfo,
  config: GRCConfig,
): Promise<CuratorResult>

/** 解析并验证 Curator 输出 */
function parseCuratorOutput(raw: string): CuratorResult | null
// 验证: 必须包含"目标"和"已完成"section
// 验证: 文件路径必须在对话中出现过
// 提取: 末尾 JSON 代码块中的 principleOps

interface ReflectorResult {
  advice: string;          // 格式化后的顾问意见
  hasSubstantiveContent: boolean;  // 是否有实质内容（vs 空洞确认）
  sections: {
    direction: string;
    blindSpots: string[];
    risks: string[];
    suggestions: string[];
  };
}

interface PrincipleDraft {
  content: string;
  tags: string[];
}

interface CuratorResult {
  summary: string;          // 结构化摘要
  principleOps: PrincipleOp[];
  sections: {
    goal: string;
    completed: string[];
    decisions: string[];
    files: string[];
    status: string;
    nextSteps: string[];
    warnings: string[];
  };
}
```

### 8.3 其他模块

（保持与 v1.0 设计相同，不重复。主要变化在 8.2 和 Widget 设计。）

---

## 9. 错误处理

| 场景 | 处理 |
|------|------|
| Reflector complete() 失败 | status="failed", widget 显示 R:✗, 不注入, 不影响主对话 |
| Curator complete() 失败 | status="failed", widget 显示 C:✗, 不修剪 context, 回退到普通 compact |
| Reflector 输出格式错误 | parseReflectorOutput 返回 null, 视为失败 |
| Curator 输出格式错误 | parseCuratorOutput 返回 null, 视为失败 |
| Reflector 输出空洞无内容 | hasSubstantiveContent=false, 跳过注入，并记录 `Reflector finished (no substantive advice)` |
| Curator 输出空洞无内容 | 结构化摘要仍可保留，但 `principleOps` 可为空 |
| compatibility `manualMode = forced-off`（现主口径等价于 `runtimeMode=off`） | 不注入 GRC prompt / principles，不做 context 修剪，不启用 curator-aware compaction |
| 检测到外部编排工具 | Orchestrator Guard 生效，GRC 进入让行/观察模式 |
| 模型 API Key 缺失 | GRC 降级: 只做 prompt 注入，不启动 R/C |
| mid-run Reflector 触发后无实质建议 | 记录 `finished-no-advice` 审计 entry，不重复投递 steer |
| context 修剪后消息格式错误 | 回退: 返回原始 messages |
| 两个 R/C 同时运行（并发冲突） | 状态机保证: running 状态时不触发新的 |

---

## 10. 配置默认值

```json
{
  "compaction": { "enabled": true, "model": "gemini-3-flash", "..." : "..." },
  "memory": { "enabled": true, "..." : "..." },
  "tracking": { "enabled": true, "showWidget": true },
  "grc": {
    "enabled": true,
    "grcTurnThreshold": 5,
    "grcCooldownTurns": 4,
    "midRunTurnThreshold": 15,
    "curatorKeepRecentTurns": 4,
    "curatorEveryAgentRounds": 1,
    "keepRecentAgentRounds": 2,
    "summaryCacheSize": 6,
    "maxGoalStateActive": 8,
    "subagentModel": "gemini-3-flash",
    "subagentModelProvider": "opencode",
    "maxReflectorTokens": 1500,
    "maxCuratorSummaryTokens": 3000,
    "principlesDir": "~/.passtocontext/memory/principles",
    "maxPrinciplesInjection": 5,
    "maxPrinciples": 100,
    "orchestratorToolPrefixes": ["passto_planner_", "passto_executor_", "passto_builder_"],
    "widgetNoticeMaxChars": 24
  },
  "logEnabled": true,
  "logLevel": "info"
}
```

---

## 11. 当前实现与真实验证状态（2026-05-09）

基于本地真实 Pi CLI 环境（通过 `~/.pi/agent/settings.json` 挂载当前资源仓）已验证：

- 扩展可真实加载并在 print/continue 模式下稳定运行
- 主调度已切到 `agent_end -> post-round jobs`；Reflector 每轮运行，Curator 按 `curatorEveryAgentRounds=1` 默认每轮运行
- `agent_start` 会写入 `passto-round-boundary`，用于按 agent-round 回放与 recent rounds 重建
- Curator 输出已升级为 `summaryEntry + GoalStateDocument + RequirementLedger + signal`
- `before_agent_start` 已真实注入 `ObjectiveSnapshot + GoalState + SummaryCache + Reflector advice + principles`
- SummaryCache 注入会排除最近 raw rounds，避免与最近 agent-round 原始消息重复
- `context` 主路径已切到“最近 agent-round 原始消息 + ObjectiveSnapshot/GoalState/SummaryCache”；旧 `lastSummary` 仍保留为兼容 fallback
- principles 已真实落盘到 `~/.passtocontext/memory/principles/principles-registry.json`
- principles 治理已升级为 `principleOps + registry`：支持 `create / reuse / merge / conflict`
- `grc-curator-artifact` 已落地：Curator 完成后会增量持久化；`session_start` 会 replay artifact 重建 `GoalState / SummaryCache / lastSignal / lastSummaryEntry`
- `RequirementLedger` 已落地：Curator 原生产出 ledger，并持久化为 `grc-requirement-ledger`；`session_start` 会恢复最新 ledger 并重建 `lastObjectiveSnapshot`
- `ObjectiveSnapshot` 当前不再是启发式事实源，而是由 active ledger items 投影得到：`goal -> primaryGoal`，`constraint / preference / non-goal / success / question` 分别映射到对应字段
- artifact 恢复已具备显式校验与观测：校验 `agentRound / recordedAt / processedUpToUserTurn`，并记录 rejected 数、summaryCacheRounds、goalStateRound
- `/ptc` 命令面（历史阶段曾暴露 `/pta` / `/PTA`）已实现，支持 `status / on / off / reflect / curate / principles / config`
- `/ptc status`（历史阶段原称 `/pta status`）已可观测 `SummaryCache entries`、`Injected SummaryCache rounds`、`Latest Curator Artifact Round`、`Objective Snapshot`、`Requirement Ledger`、`GoalState Snapshot`、`Last Signal`
- Reflector 在无实质建议时会保留 `status=done`、`lastAdvice=null`，并输出日志 `Reflector finished (no substantive advice)`
- Mid-run Reflector 已落地：
  - 单次 agent-round 内的 turn-round 达到 `midRunTurnThreshold` 时触发
  - 会持久化 `grc-mid-run-debug` 审计 entry（如 `triggered` / `delivered` / `failed`）
- 历史兼容字段 `manualMode = auto | forced-on | forced-off` 已落地到状态机；当前公开控制面已收敛为 `runtimeMode = on | off`
- Orchestrator Guard 已落地：检测到 `passto_planner_` / `passto_executor_` / `passto_builder_` 等工具前缀时，GRC 自动让行
- widget 当前代码已更新为 `Run / context usage / 记 / 思 / 理` 结构
- logger 已不再通过 TUI 承载；若开启调试，持久化到 `~/.passtocontext/log/`
- `session_before_compact` 已实现 curator-first compaction，日志可见 `Using curator summary for compaction`
- `restoreGRCState()` 会把持久化的 `running` 状态恢复为 `idle`
- `session_start` / `session_shutdown` 会执行 principles 上限清理；shutdown 会限时等待后台任务收尾，再持久化状态并 reset module state
- 真实 TUI 回归脚本 `scripts/tui-regression.sh` 已通过
- Mid-run 回归脚本 `scripts/midrun-regression.sh` 已通过
- 额外探测结论：`/resume` 的实际“恢复到指定旧 session”在自动化脚本中暂不稳定，因为 All 视图会混入全局历史 session，排序与默认焦点不固定；该项保留为人工补充回归

## 附录 A: Pi Extension API 关键约束

1. Session 是 append-only，不能删除历史消息
2. `context` hook 返回的 messages 只影响 LLM 看到的内容
3. `before_agent_start` 的 systemPrompt 是链式的
4. `pi.sendMessage({ deliverAs: "steer" })` 在 turn 间注入
5. `pi.appendEntry()` 不参与 LLM 上下文
6. `complete()` 来自 `@earendil-works/pi-ai`，可直接调用 LLM
7. `ctx.ui.setWidget()` 设置输入框上方的信息
8. `ctx.ui.setStatus()` 设置底部状态栏（PasstoContext 后续不应再用其承载 logger/debug 输出）

## 附录 B: 与 APPEND_SYSTEM.md 的关系

GRC 的基础 prompt 注入与 APPEND_SYSTEM.md 是互补关系:
- APPEND_SYSTEM.md: 规范 LLM 的执行行为（工具策略、输出规范）
- GRC 基础 prompt: 植入认知习惯（多方案思维、假设质疑）
- GRC 不修改也不替代 APPEND_SYSTEM.md
