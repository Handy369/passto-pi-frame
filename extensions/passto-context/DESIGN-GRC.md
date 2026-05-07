# PasstoContext GRC 框架集成设计方案

> 版本: v1.2 | 日期: 2026-05-07
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
   └── Curator 摘要替换旧 turn
       → LLM 看到的不是 50 条零散消息，而是
         [结构化摘要] + [最近 4 轮完整对话]
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
- Curator 的摘要替换旧 turn → Generator 看到的上下文更聚焦 → 减少跑偏

### 1.5 三个角色的分工

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
│   ├── 从 appendEntry 恢复 GRC 状态
│   └── 加载全局 principles
│
├── before_agent_start （每次用户提问）
│   ├── 如 manualMode != forced-off → 注入轻量 GRC 框架指令到 systemPrompt
│   ├── 如 manualMode != forced-off → 注入相关 principles
│   ├── 如有 Reflector 顾问意见 → 注入 systemPrompt
│   └── 不直接注入 Curator 摘要（Curator 主要通过 context hook 生效）
│
├── context （每次 LLM 调用前）
│   └── 如 Curator 已产出摘要 → 修剪旧 turn（LLM 视角）
│       保留: [Curator摘要] + [最近 N 个 turn 完整记录]
│
├── turn_end
│   ├── turn 计数器 ++
│   ├── 更新 context-tracker
│   ├── 检查是否达到 GRC 触发阈值
│   │   └── 如果达到:
│   │       ├── (1) steer 注入反思引导 prompt 到主对话
│   │       ├── (2) 后台 Reflector: complete() 异步调用
│   │       └── (3) 后台 Curator: complete() 异步调用
│   └── 更新 status/widget
│
├── agent_end
│   └── 更新 tracking 状态
│
├── session_before_compact （Pi 原生 compact 触发时）
│   └── 触发"原则提取"（从即将被压缩的消息中）
│       不做常规摘要压缩（Curator 已经在管理上下文大小）
│       返回 Curator 最新摘要作为 compact 结果
│
└── session_shutdown
    ├── 持久化 GRC 状态到 appendEntry
    ├── 提取本会话新增 principles → 全局文件
    └── 清理资源
```

### 2.2 双模式运行

```
┌─────────────────────────────────────────────────┐
│ 普通模式 (turn < 阈值)                           │
│                                                 │
│  before_agent_start: 注入基础 GRC + principles   │
│  context: 不修剪（直通）                          │
│  turn_end: 计数 + tracking                       │
│  compact: 默认 passto-context 行为               │
│  status: 只显示基础信息                           │
│                                                 │
├─────────────── turn >= 阈值 ────────────────────┤
│                                                 │
│ GRC 模式 (当前实现支持 forced-on / forced-off)     │
│                                                 │
│  before_agent_start: 注入 GRC + principles       │
│                      + Reflector 顾问意见         │
│                      + Curator 增强提示           │
│  context: Curator 修剪旧 turn                    │
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

  // 基础认知框架（始终）
  prompt += buildBaseGRCPrompt();

  // Reflector 顾问意见（GRC 模式 + R 已完成）
  if (grcState.mode === "grc" && grcState.reflector.lastAdvice) {
    prompt += buildReflectorInjection(grcState.reflector.lastAdvice);
  }

  // 相关 Principles（始终，如果有匹配的）
  const relevant = searchPrinciples(event.prompt, principles, config.maxPrinciplesInjection);
  if (relevant.length > 0) {
    prompt += formatPrinciplesForInjection(relevant);
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
import { complete } from "@mariozechner/pi-ai";

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
turn 1-5 (普通模式):
  Generator 增强: 仅系统层（基础 GRC prompt + 相关 principles）
  上下文层: 无修剪，LLM 看到原始完整消息
  对话层: 无 steer

turn 6 (turn_end —— GRC 触发):
  │
  ├── (1) grcState.mode = "grc"
  │
  ├── (2) 对话层增强: steer 注入反思引导
  │       pi.sendMessage({ content: reflectionSteer, ... }, { deliverAs: "steer" })
  │       → LLM 在下一轮工具处理后看到
  │       → Generator 产出一段自我反思（融入正常回复）
  │       → 这段反思成为对话历史的一部分
  │
  ├── (3) 启动 Reflector complete()（异步）
  │       输入: turn 1-6 完整对话 + Generator 产出的反思
  │
  └── (4) 启动 Curator complete()（异步）
          输入: turn 1-6 完整对话

turn 7 (before_agent_start —— Generator 被全面增强):
  │
  ├── 系统层增强:
  │   ├─ 基础 GRC prompt（始终）
  │   ├─ 相关 principles（始终）
  │   ├─ Reflector 已完成? → 顾问意见注入 systemPrompt
  │   └─ Reflector 未完成? → 跳过，下轮再检查
  │
  └── 上下文层增强 (context hook):
      ├─ Curator 已完成? → [结构化摘要] + [turn 5-7 完整记录]
      └─ Curator 未完成? → 不修剪

  此时 Generator (LLM) 看到的上下文:
    systemPrompt: [基础GRC] + [相关原则] + [顾问意见]
    messages:     [结构化摘要] + [turn 5] + [turn 6 + 反思] + [turn 7]
    → Generator 在这个增强上下文中产出的回答质量显著高于平铺直叙的 50 条原始消息

turn 10 (turn_end —— 下一轮 GRC):
  turnCount - lastGrcTriggerTurn >= cooldownTurns (4)
  且 R/C 不在运行中
  → 触发 cycle 2
  → 新的 steer 反思引导
  → 新的 R/C（输入: Curator 摘要 + turn 5-10）
```

---

## 3. Widget 与 Status 设计

### 3.1 设计原则

- **弱感知**: 用户不需要理解 GRC 是什么，只需知道"系统在帮我管理对话质量"
- **信息密度**: 在一行内传递关键信息
- **状态可辨**: 不同阶段有不同的视觉信号
- **不干扰**: 永远不弹 notify，只用 widget/status

### 3.2 Widget 布局（输入框上方）

**普通模式**:
```
T:5 | 📝3 | ⏱12m
```
- T: turn 数
- 📝: 修改的文件数
- ⏱: 会话时长

**GRC 模式**（升级后多一个段）:
```
T:8 | 📝5 | ⏱20m | ◆ R:✓ C:⟳
```
- ◆: GRC 模式激活标识（固定显示，区别于普通模式）
- R:✓ / R:⟳ / R:✗ : Reflector 状态（完成/运行中/失败）
- C:✓ / C:⟳ / C:✗ : Curator 状态

**状态字符含义**:
```
⟳  运行中（subagent 正在执行）
✓  完成（结果已注入或待注入）
✗  失败（降级，不影响主对话）
·  空闲（等待下次触发）
```

**完整的状态演变**:
```
T:1 | 📝0 | ⏱1m                         ← 普通模式
T:3 | 📝2 | ⏱5m                         ← 普通模式
T:6 | 📝3 | ⏱10m | ◆ R:⟳ C:⟳           ← GRC 刚触发
T:7 | 📝4 | ⏱12m | ◆ R:✓ C:⟳           ← Reflector 完成
T:8 | 📝5 | ⏱15m | ◆ R:✓ C:✓           ← 都完成，已注入
T:9 | 📝5 | ⏱18m | ◆ R:· C:·           ← 冷却中
T:10| 📝6 | ⏱20m | ◆ R:⟳ C:⟳           ← 下一轮 GRC
```

### 3.3 Status（底部状态栏）

仅在 GRC 状态变化时短暂显示，随后清除：

```typescript
// GRC 触发时
ctx.ui.setStatus("grc", "◆ GRC activated — analyzing conversation");

// Reflector 完成时
ctx.ui.setStatus("grc", "◆ Reflector: 3 suggestions ready");

// Curator 完成时
ctx.ui.setStatus("grc", "◆ Curator: context optimized, 2 principles extracted");

// 5 秒后清除
setTimeout(() => ctx.ui.setStatus("grc", undefined), 5000);
```

### 3.4 实现

```typescript
function formatGRCWidget(
  tracker: ContextTracker,
  grcState: GRCState,
): string {
  const state = tracker.getState();
  const parts: string[] = [];

  // 基础信息（始终显示）
  parts.push(`T:${state.turnCount}`);

  if (state.filesModified.length > 0) {
    parts.push(`📝${state.filesModified.length}`);
  }

  const elapsed = Math.round((Date.now() - state.startTime) / 60000);
  parts.push(`⏱${elapsed}m`);

  // GRC 模式信息（仅 GRC 模式显示）
  if (grcState.mode === "grc") {
    const r = statusChar(grcState.reflector.status);
    const c = statusChar(grcState.curator.status);
    parts.push(`◆ R:${r} C:${c}`);
  }

  return parts.join(" | ");
}

function statusChar(status: SubagentStatus): string {
  switch (status) {
    case "running": return "⟳";
    case "done": return "✓";
    case "failed": return "✗";
    case "idle": return "·";
  }
}
```

---

## 4. 数据结构设计

### 4.1 GRC 状态机

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
  grcTurnThreshold: number;       // 默认 6
  grcCooldownTurns: number;       // 默认 4
  curatorKeepRecentTurns: number;  // 默认 4
  subagentModel: string;           // 默认 "gemini-3-flash"
  subagentModelProvider: string;   // 默认 "opencode"
  maxReflectorTokens: number;      // 默认 1500
  maxCuratorSummaryTokens: number; // 默认 3000
  principlesDir: string;           // 默认 "~/.passtocontext/memory/principles"
  maxPrinciplesInjection: number;  // 默认 5
  maxPrinciples: number;           // 默认 100
}
```

### 4.3 文件系统布局

```
~/.passtocontext/
├── config.json                    # 配置（新增 grc 字段）
├── memory/
│   ├── sessions/                  # 现有
│   ├── entities/                  # 现有
│   ├── notes/                     # 现有
│   └── principles/                # 新增: 全局原则
└── grc/                           # 新增: GRC 工作目录
    ├── reflector-1.md             # Reflector 输出（持久化备份）
    ├── curator-1.md               # Curator 输出（持久化备份）
    └── ...
```

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
你是一个上下文整理专家。你的任务是将一段对话整理为高质量的结构化摘要，
并提取可复用的经验原则。

# 输入
以下是完整的对话记录。

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

# 任务二: 原则提取
从这段对话中提取可复用的经验。每条原则用以下格式标记：
<!-- PRINCIPLE: {"content":"原则内容","tags":["标签1","标签2"]} -->

其中：
- content: 原则正文
- tags: 1-4 个简短标签，由 LLM 直接生成
- tags 必须适合检索，不要是整句

原则必须满足：
- 具体（不是"要写好代码"这种废话）
- 可复用（适用于类似场景）
- 从实际执行中总结（不是常识）
- 每次提取 0-3 条（没有值得提取的就不提取）

# 约束
- 摘要不超过 800 字
- 不要编造对话中没有的内容
- 文件路径必须是对话中实际出现的

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

**Curator 摘要用于 context 修剪（替换旧 turn 的 user message）**：
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
   turn1                 turn2              turn3        turn4

Curator 已处理到 turn2, curatorKeepRecentTurns = 2:

修剪后:
  [curator_summary_as_user_msg, user3, ass3, user4, ass4, ...]
   ↑ 替换 turn1-2             turn3        turn4 (保留最近2个turn)
```

### 6.2 Turn 边界检测

```typescript
interface TurnBoundary {
  startIndex: number;  // 这个 turn 的第一条 user message 在 messages[] 中的索引
  endIndex: number;    // 这个 turn 的最后一条消息（下一个 user msg 之前）
  turnNumber: number;
}

function findTurnBoundaries(messages: Message[]): TurnBoundary[] {
  // turn 从每条 role="user" 的消息开始
  // 到下一条 role="user" 之前的所有消息结束
  // 注意: compaction summary message 不算 turn 边界
}
```

### 6.3 与 Pi Compact 的互斥

```
Curator 通过 context hook 修剪
  → LLM 看到的 token 始终 ≈ curator_summary + 最近 4 turn
  → 通常 < 30k tokens
  → 远低于 contextWindow (200k)
  → Pi compact 条件 (contextTokens > contextWindow - reserveTokens) 不满足
  → Pi compact 不触发

极端情况（单个 turn 内 tool 输出巨大）:
  → context hook 修剪后仍然超限
  → Pi compact 触发
  → session_before_compact 中:
    → 使用 Curator 最新摘要
    → 触发原则提取
    → 返回增强的 compact 结果
```

---

## 7. 全局原则记忆（v1.0 基础 + v2.0 规划）

### 7.1 v1.0: 基础实现（本次）

**存储**: YAML 文件，复用 passto-context 的格式
```yaml
type: principle
created: "2026-05-07T10:30:00.000Z"
tags:
  - typescript
  - pi-extension
content: |
  在 Pi extension 中，使用 context hook 修剪消息比直接
  操作 session 文件更安全，因为 session 是 append-only 的。
metadata: |
  source: session-abc-cycle-2
  hitCount: 3
  lastUsed: 2026-05-07
```

**检索**: 关键词匹配（复用 memory-index.ts 的搜索逻辑）
**注入**: `before_agent_start` 中搜索与 prompt 相关的 principles，注入 systemPrompt
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

目前 v1.0 的注入是"每次 before_agent_start 都搜索注入"，这有两个问题：
- 注入的 principles 可能与当前 turn 不相关（关键词匹配太粗糙）
- 每次都注入会浪费 systemPrompt 的 token 预算

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
| `index.ts` | 修改 | 集成 GRC 到事件链与 `/pta` 命令 |
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
// 提取: <!-- PRINCIPLE: ... --> 标记

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
  summary: string;              // 结构化摘要
  principles: PrincipleDraft[]; // 提取的原则（含 LLM 生成 tags）
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
| Curator 输出空洞无内容 | 结构化摘要仍可保留，但 principles 可为 0 条 |
| manualMode = forced-off | 不注入 GRC prompt / principles，不做 context 修剪，不启用 curator-aware compaction |
| 模型 API Key 缺失 | GRC 降级: 只做 prompt 注入，不启动 R/C |
| .grc/ 目录写入失败 | 日志警告，R/C 结果仍在内存中可用 |
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
    "grcTurnThreshold": 6,
    "grcCooldownTurns": 4,
    "curatorKeepRecentTurns": 4,
    "subagentModel": "gemini-3-flash",
    "subagentModelProvider": "opencode",
    "maxReflectorTokens": 1500,
    "maxCuratorSummaryTokens": 3000,
    "principlesDir": "~/.passtocontext/memory/principles",
    "maxPrinciplesInjection": 5,
    "maxPrinciples": 100
  },
  "logLevel": "info"
}
```

---

## 11. 当前实现与真实验证状态（2026-05-07）

基于本地真实 Pi CLI 环境（通过 `~/.pi/agent/settings.json` 挂载当前资源仓）已验证：

- 扩展可真实加载并在 print/continue 模式下稳定运行
- 第 6 个用户轮次会自动触发 GRC
- steer 反思会真实追加到主对话
- Reflector / Curator 会在后台真实调用模型
- Curator 摘要已真实驱动 `context` 修剪，日志可见 `15 -> 9 messages`
- principles 已真实落盘到 `~/.passtocontext/memory/principles/`
- principle tags 已改为由 LLM 直接生成，而非本地中文粗切词
- `passto-context-state.turnCount` 已修正为“用户轮次”；`grcState.turnCount` 保持 GRC 内部计数语义
- Reflector 在无实质建议时会保留 `status=done`、`lastAdvice=null`，并输出日志 `Reflector finished (no substantive advice)`
- `/pta` / `/PTA` 已实现，支持 `status / on / off / reflect / curate / principles / config`
- `manualMode = auto | forced-on | forced-off` 已落地到状态机
- `session_before_compact` 已实现 curator-first compaction，日志可见 `Using curator summary for compaction`
- 隔离加载测试已确认编译后的 jiti 产物中包含 `/pta` 注册与 curator-aware compaction 分支
- 6.1 已落地：
  - R/C 失败会降级，不阻塞主对话
  - 缺少模型/API Key 时会记录 warning，并在有 UI 时提示用户
  - 旧 session 的后台 Promise 通过 session generation 守卫，不能回写新会话状态
- 6.4 已落地：
  - `restoreGRCState()` 会把持久化的 `running` 状态恢复为 `idle`
  - `session_start` / `session_shutdown` 会执行 principles 上限清理
  - shutdown 会限时等待后台任务收尾，再持久化状态并 reset module state
- 真实 TUI 回归脚本 `scripts/tui-regression.sh` 已通过，覆盖：
  - `/pta status`
  - `/pta on`
  - `/pta off`
  - `/pta reflect`
  - `/pta curate`
  - `/reload` 后状态恢复与 running→idle 修复
  - `/new` 后 session-scoped 状态重置
  - `/resume` 对话框打开与 All 视图切换
- 额外探测结论：`/resume` 的实际“恢复到指定旧 session”在自动化脚本中暂不稳定，因为 All 视图会混入全局历史 session，排序与默认焦点不固定；该项保留为人工补充回归

## 附录 A: Pi Extension API 关键约束

1. Session 是 append-only，不能删除历史消息
2. `context` hook 返回的 messages 只影响 LLM 看到的内容
3. `before_agent_start` 的 systemPrompt 是链式的
4. `pi.sendMessage({ deliverAs: "steer" })` 在 turn 间注入
5. `pi.appendEntry()` 不参与 LLM 上下文
6. `complete()` 来自 `@mariozechner/pi-ai`，可直接调用 LLM
7. `ctx.ui.setWidget()` 设置输入框上方的信息
8. `ctx.ui.setStatus()` 设置底部状态栏

## 附录 B: 与 APPEND_SYSTEM.md 的关系

GRC 的基础 prompt 注入与 APPEND_SYSTEM.md 是互补关系:
- APPEND_SYSTEM.md: 规范 LLM 的执行行为（工具策略、输出规范）
- GRC 基础 prompt: 植入认知习惯（多方案思维、假设质疑）
- GRC 不修改也不替代 APPEND_SYSTEM.md
