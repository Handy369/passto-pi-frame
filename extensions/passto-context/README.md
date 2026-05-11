# PasstoContext

> Pi CLI 智能上下文管理扩展 — 智能压缩、记忆注入、会话状态追踪

## 功能特性

### 🧠 智能压缩
用 AI 生成结构化的会话摘要，替代 Pi 默认的压缩方式。当对话过长时，PasstoContext 生成丰富的摘要，保留：

- **目标和意图**：用户想达成什么
- **已完成的任务**：具体完成了哪些步骤
- **关键决策**：做了哪些决定及其理由
- **修改的文件**：改动了哪些文件及改动内容
- **阻塞和问题**：遇到的错误、阻塞点、待解决问题
- **下一步**：接下来应该做什么

摘要自动保存到记忆系统，并在后续会话中自动注入。

### 💾 记忆系统
跨会话持久化记忆：

- 压缩后自动保存会话摘要
- 每次提问前搜索相关记忆并自动注入
- 自动清理过期记忆
- 当前公开命令面不再暴露手动记忆管理入口

### 🔄 GRC 认知循环（已启用）
当前版本已将 GRC（Generator-Reflector-Curator）集成到主扩展中，并已进入 v1.1 收敛主链：

> 最终架构说明：`docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`

- 主调度已切到 **agent-round / post-round**：`agent_end` 后后台启动 Reflector；Curator 在 `before_agent_start` 处理上一轮
- `before_agent_start` 会注入：基础 GRC prompt、`GoalState`、去重后的 `SummaryCache`、Reflector 建议、相关 principles
- `agent_start` 会写入 `passto-round-boundary`；`session_start` 会从 `grc-state` 与 `grc-curator-artifact` 恢复运行态与 Curator 事实态（含显式校验与 replay）
- 支持顶层 `runtimeMode = on | off` 运行态开关，可通过 `/ptc on|off` 切换
- 长运行单次任务中，当当前 run 内的 `turn-round` 达到 `midRunTurnThreshold` 时，会触发一次 mid-run Reflector，并持久化 `grc-mid-run-debug`
- Reflector / Curator 通过后台 `complete()` 异步运行，不阻塞主对话
- **Reflector** 负责产出顾问意见与 `principleOps`；**Curator** 负责产出 `summaryEntry + GoalStateDocument + signal`
- principles 现按 `hintCount + activeScore + conflictGroupId` 治理，长期低价值原则会自动衰减并删除，持久化到 `~/.passtocontext/memory/principles/principles-registry.json`
- `context` hook 当前优先走 `GoalState + SummaryCache + 最近 N 个 agent-round 原始消息`，不再注入 legacy `lastSummary` fallback
- `SummaryCache` 注入会自动排除最近已保留的 raw rounds，避免与 recent messages 重复；缓存溢出时会记录 eviction 日志
- `session_before_compact` 仅在存在 Curator 最新摘要时由扩展接管；否则完全回退 Pi 默认 compaction
- 遇到 `passto_planner_*` / `passto_executor_*` / `passto_builder_*` 等编排型工具时，GRC 会自动让行，暂停 prompt 注入、steer、context 修剪和自动触发
- widget 当前真实代码已对齐为紧凑格式：`Run:11 7.5k | 记:28.4K | 思:✓ | 理:✓`
- 若开启调试，日志目标应为 `~/.passtocontext/log/`，而不是把 debug/logger 文字直接显示在 TUI 中

### 📊 上下文追踪
实时会话监控，显示：

- 轮次数量
- Token 使用量（百分比）
- 修改的文件列表
- 使用的工具
- 做出的关键决策
- 遇到的错误

## 安装

这是 **目录风格** 扩展。

当前仓库推荐使用 **外部资源仓 + settings 挂载** 模式，而不是继续把源码直接复制进 `~/.pi/agent/extensions/`。

推荐做法：
- 将扩展保存在资源仓（例如 `~/dev/pi/extensions/passto-context`）
- 在 `~/.pi/agent/settings.json` 中通过 `extensions` 数组挂载资源仓
- 由 `~/.pi` 仅承担 runtime home 职责

### 方式一：资源仓挂载（推荐）

```json
{
  "extensions": [
    "/Users/handy/dev/pi/extensions"
  ]
}
```

然后在 Pi 中执行：

```text
/reload
```

### 方式二：项目本地（项目级配置）

如果你希望仅对特定项目生效，可在项目内使用 `.pi/settings.json` 指向本地资源目录。

### 方式三：符号链接（兼容旧工作流，不再推荐作为主方案）

仅在你明确需要兼容旧式 `~/.pi/agent/extensions/` 开发方式时使用。对于当前仓库，优先采用资源仓 + settings 挂载方案。

```bash
# 链接到源码目录，修改源码后立即生效
mkdir -p ~/.pi/agent/extensions/passto-context
cd ~/.pi/agent/extensions/passto-context

SRC="/Users/handy/Library/Mobile Documents/com~apple~CloudDocs/Handy-AI/PasstoContext/code/passto-context"
ln -sf "$SRC/index.ts"        ./index.ts
ln -sf "$SRC/types.ts"        ./types.ts
ln -sf "$SRC/utils.ts"        ./utils.ts
ln -sf "$SRC/config.ts"       ./config.ts
ln -sf "$SRC/compaction.ts"   ./compaction.ts
ln -sf "$SRC/memory.ts"       ./memory.ts
ln -sf "$SRC/memory-index.ts" ./memory-index.ts
ln -sf "$SRC/context-tracker.ts" ./context-tracker.ts
ln -sf "$SRC/package.json"     ./package.json
```

### 验证安装

运行 Pi 并执行：

```text
/reload
```

你应该看到：`[PasstoContext] PasstoContext ready`（或界面上的通知），且无资源加载报错。

## 命令

PasstoContext 现在只保留 4 个公开命令：

### `/ptc` / `/ptc status` — 显示总状态

```
/ptc
/ptc status
```

显示当前 PasstoContext 总状态：
- Runtime on/off
- Memory / Tracking / Widget / GRC 开关
- 当前 session 统计
- round-centric 的 Reflector / Curator / SummaryCache / GoalState 核心观测

### `/ptc on` — 开启运行时功能

```
/ptc on
```

开启顶层 runtime 开关。开启后，PasstoContext 的实际行为仍由配置文件细项控制。

### `/ptc off` — 关闭运行时功能

```
/ptc off
```

关闭顶层 runtime 开关。关闭后会停用：
- memory 自动注入
- GRC prompt 注入
- principles 注入
- context 优化
- curator-aware compaction
- Reflector / Curator 后台任务

Widget 会保留极简关闭态提示：`PTC:off`。

### `/ptc config` — 直接打开配置文件

```
/ptc config
```

直接调用系统能力打开配置文件，无需用户手动查找路径。

## 配置

PasstoContext 使用 JSON 配置文件：

```
~/.passtocontext/config.json
```

首次运行时会自动创建默认配置。

### 默认配置

```json
{
  "compaction": {
    "enabled": true,
    "model": "gemini-3-flash",
    "modelProvider": "opencode",
    "maxSummaryTokens": 4000,
    "preserveRecentTurns": 3
  },
  "memory": {
    "enabled": true,
    "dir": "~/.passtocontext/memory",
    "maxInjectionTokens": 2000,
    "maxMemoryFiles": 500,
    "maxMemoryAgeDays": 90,
    "autoExtract": true
  },
  "tracking": {
    "enabled": true,
    "showWidget": true
  },
  "grc": {
    "enabled": true,
    "grcTurnThreshold": 5,
    "grcCooldownTurns": 4,
    "midRunTurnThreshold": 15,
    "curatorKeepRecentTurns": 4,
    "curatorEveryAgentRounds": 1,
    "keepRecentAgentRounds": 3,
    "maxContextPercent": 8,
    "summaryCacheSize": 8,
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

> 注：`grcTurnThreshold / grcCooldownTurns / curatorKeepRecentTurns / curatorEveryAgentRounds` 为 **deprecated 兼容字段**，示例中保留仅用于旧配置平滑迁移。

### 配置项说明

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `compaction.enabled` | `true` | 启用智能压缩 |
| `compaction.model` | `gemini-3-flash` | 生成摘要的模型 |
| `compaction.modelProvider` | `opencode` | 模型提供商 |
| `compaction.maxSummaryTokens` | `4000` | 摘要最大 Token 数 |
| `compaction.preserveRecentTurns` | `3` | 压缩时保留最近 N 个完整轮次 |
| `memory.enabled` | `true` | 启用记忆系统 |
| `memory.maxInjectionTokens` | `2000` | 每次注入的最大 Token 数 |
| `memory.maxMemoryAgeDays` | `90` | 自动删除超过此天数的记忆 |
| `memory.maxMemoryFiles` | `500` | 最多保留的记忆条数 |
| `tracking.enabled` | `true` | 启用会话状态追踪 |
| `tracking.showWidget` | `true` | 在编辑器 Widget 区域显示状态 |
| `grc.enabled` | `true` | 启用 GRC 认知循环 |
| `grc.grcTurnThreshold` | `5` | [deprecated] 仅为旧状态恢复保留，v1.1 主路径不再使用 |
| `grc.grcCooldownTurns` | `4` | [deprecated] 仅为旧状态恢复保留，v1.1 主路径不再使用 |
| `grc.midRunTurnThreshold` | `15` | 单次 `agent_start -> agent_end` 内，`turn-round` 达到该阈值仍未结束时，触发一次运行中 Reflector |
| `grc.curatorKeepRecentTurns` | `4` | [deprecated] 仅为旧配置兼容保留，当前主路径不再依赖 |
| `grc.curatorEveryAgentRounds` | `1` | [deprecated] Curator 已改为 `before_agent_start` 每轮处理上一轮，主路径不再依赖 |
| `grc.keepRecentAgentRounds` | `3` | `context` 主路径中至少保留的最近 agent-round 原始消息轮数 |
| `grc.maxContextPercent` | `8` | `context` 主路径的滑窗触发阈值，占当前模型 `contextWindow` 的百分比 |
| `grc.summaryCacheSize` | `8` | `SummaryCache` 的 FIFO 容量 |
| `grc.maxGoalStateActive` | `8` | `GoalState` 注入时最多展示多少条 active 项 |
| `grc.subagentModel` | `gemini-3-flash` | Reflector / Curator 使用的模型 |
| `grc.subagentModelProvider` | `opencode` | Reflector / Curator 模型提供商 |
| `grc.maxReflectorTokens` | `1500` | Reflector 最大输出 Token |
| `grc.maxCuratorSummaryTokens` | `3000` | Curator 最大输出 Token |
| `grc.principlesDir` | `~/.passtocontext/memory/principles` | principles 持久化目录 |
| `grc.maxPrinciplesInjection` | `5` | 每次提问最多注入多少条 principle |
| `grc.maxPrinciples` | `100` | principles 的硬上限保护阈值（主要治理已改为 hint/activeScore 驱动） |
| `grc.orchestratorToolPrefixes` | `[...]` | 检测到这些工具前缀时，GRC 自动让行 |
| `grc.widgetNoticeMaxChars` | `24` | Widget 临时提醒的最大字符数 |
| `logEnabled` | `true` | 是否输出 PasstoContext 日志（调试信息应写入 `~/.passtocontext/log/`） |
| `logLevel` | `info` | 日志级别：error、warn、info、debug |

> 注：顶层运行态开关为 `runtimeMode = on | off`，不在配置文件中声明，而是由 `/ptc on` / `/ptc off` 控制，并通过 `pi.appendEntry("grc-state", ...)` 持久化。

## 记忆存储

记忆以 YAML 文件形式存储在：

```
~/.passtocontext/memory/
├── sessions/       # 自动保存的会话摘要
├── entities/       # 实体知识
├── notes/          # 兼容保留的笔记目录（当前公开命令不再暴露手动保存入口）
└── principles/     # Curator 提取的全局经验原则（registry JSON）
```

示例记忆文件：

```yaml
# ~/.passtocontext/memory/sessions/2026-04-07-1030-session-a1b2.yaml
type: session_summary
created: "2026-04-07T10:30:00.000Z"
tags:
  - auth
  - refactor
content: |
  ## 目标
  - 重构认证模块

  ## 已完成
  - 将 JWT 迁移到 OAuth2
  - 安装 passport.js

  ## 关键决策
  - 选择 passport.js 而非自研 OAuth 实现
```

## 依赖要求

- Pi CLI（需支持扩展）
- Node.js >= 18.0.0
- 压缩模型需要在 Pi 的认证系统中配置 API Key

## 工作原理

### 压缩流程

```
会话过长（Pi 自动触发）
    │
    ▼
session_before_compact 事件触发
    │
    ▼
PasstoContext 调用 LLM 生成结构化摘要
    │
    ▼
摘要保存到 ~/.passtocontext/memory/
    │
    ▼
下次提问时通过 before_agent_start 注入摘要
    │
    ▼
Pi 以压缩后的上下文继续运行
```

### 记忆注入流程

```
用户发送提问
    │
    ▼
before_agent_start 事件触发
    │
    ▼
PasstoContext 搜索相关记忆
    │
    ▼
最相关的内容格式化后追加到系统提示词
    │
    ▼
LLM 看到相关历史而不增加 Token 负担
```

### GRC 工作流（当前实现）

为避免 turn 语义混淆，文档统一使用：

- **prompt-round**：一次用户初始请求到该次处理结束
- **agent-round**：一次完整 `agent_start -> agent_end`
- **turn-round**：一次内部 `turn_start -> turn_end`

```
用户提交 prompt
    │
    ▼
before_agent_start
    │  ├─ 注入 base GRC prompt
    │  ├─ 注入 GoalState
    │  ├─ 注入去重后的 SummaryCache
    │  ├─ 注入 Reflector advice
    │  └─ 注入 principles
    ▼
agent_start
    │  └─ 写入 passto-round-boundary
    │
    ├─ turn_start ... turn_end（turn-round 1）
    ├─ turn_start ... turn_end（turn-round 2）
    ├─ ...
    │
    ├─ 若当前 run 内的 turn-round 达到 midRunTurnThreshold
    │      └─ 触发一次 mid-run Reflector，并写入 grc-mid-run-debug
    │
    └─ agent_end
            │
            ├─ 完成 current agent-round 计数
            ├─ 后台启动 Reflector
            └─ Reflector 完成后保留 advice / principleOps
                    │
before_agent_start
    │
    ├─ Curator: previousRoundConversation + currentUserMessage + currentGoalState
    ├─ Curator: summaryEntry + GoalState + signal
    ├─ session_start: replay grc-curator-artifact 重建事实态
    └─ context: 保留最近 N 个 agent-round 原始消息，并注入 GoalState + SummaryCache
```

### 当前实现状态（2026-05-09）

基于真实本地 Pi CLI 环境验证，以下能力已跑通：

- 扩展通过 `~/.pi/agent/settings.json` 挂载资源仓后可真实加载
- 主调度已切到 `agent_end -> Reflector` 与 `before_agent_start -> Curator(previous-round)`
- `agent_start` 会持久化 `passto-round-boundary`，用于按 agent-round 切分当前轮输入与 recent rounds
- Curator 事实模型已升级为 `summaryEntry + GoalStateDocument + signal`
- `before_agent_start` 已真实注入 `GoalState + SummaryCache + Reflector advice + principles`
- `SummaryCache` 注入会自动避开最近 raw rounds，减少重复信息
- `context` 主路径已改为“最近 agent-round 原始消息 + GoalState/SummaryCache”，并移除了 `lastSummary` 兼容 fallback
- `grc-curator-artifact` 已落地：Curator 完成后增量持久化，`session_start` 可 replay 恢复 `GoalState / SummaryCache / lastSignal / lastSummaryEntry`，并会记录 rejected artifact 数与恢复后的 cache rounds
- `grc-curator-artifact` 已作为 Curator 主持久化载体，`session_start` 会恢复 `GoalState / SummaryCache / lastSignal / lastSummaryEntry`
- artifact 恢复已具备显式校验与观测：会记录 rejected 数、恢复后的 `summaryCacheRounds`、`goalStateRound`
- principles 会真实落盘到 `~/.passtocontext/memory/principles/principles-registry.json`，治理方式为 `principleOps + registry`
- `/ptc status` 已收敛为总状态视图：`Runtime`、`Memory / Tracking / Widget / GRC`、`Current agent-round`、`Current turn-round`、`Reflector status`、`Curator status`、`SummaryCache entries`、`GoalState Snapshot`、`Last Signal`、`Latest Curator Artifact Round`
- Reflector 在“无实质建议”时会记录日志：`Reflector finished (no substantive advice)`
- `runtimeMode=off` 会关闭 GRC prompt 注入、principles 注入、context 修剪和 curator-aware compaction
- `session_before_compact` 已实现 curator-only 接管策略，日志可见：`Using curator summary for compaction`
- logger 目标目录已切换为 `~/.passtocontext/log/`
- widget 当前代码已使用 `Run / context usage / 记 / 思 / 理` 结构

### 测试状态（2026-05-09）

基于本地真实 Pi CLI + 源码运行态测试，已验证：

- 扩展在 `--no-extensions --extension /Users/handy/dev/passto-ai/extensions/passto-context --no-skills` 隔离模式下可正常加载
- Pi 编译后的 jiti 产物中已包含 `/ptc` 命令注册
- Pi 编译后的 jiti 产物中已包含 curator-aware compaction 分支
- `grc-state.ts` 纯函数与状态恢复测试通过：
  - `setRuntimeMode()` 会正确持久化 `runtimeMode = on | off`
  - 新 round 字段会在 restore 时保留并将 running 状态归一化为 idle
  - round-based 状态字段已进入主回归链
- `npm run test:grc` 已覆盖：
  - Curator 输出解析
  - Curator artifact restore / replay
  - Reflector 输入与 prompt 注入
  - GoalState 注入与 ReflectorGoalContext 对齐
  - context manager 的 previous-round 切片
  - compaction 的 curator-only 接管
  - `/ptc status` 的收敛口径
  - round-state 更新与恢复
- 真实 TUI 回归脚本已覆盖：
  - `/ptc status`
  - `/ptc on`
  - `/ptc off`
  - `/ptc config`
  - `/reload` 后 runtime 状态保持
  - `/new` 后 session-scoped 运行态重置
  - `/resume` 对话框可正常打开并切换到 All 视图
- 6.1/6.4 相关修复已验证：
  - `restoreGRCState()` 会把持久化的 `running` 恢复为 `idle`
  - shutdown / reload 后旧 Promise 不会污染新会话
  - principles 会在 session_start / session_shutdown 按上限清理

### 自动化验证

项目提供两类真实 Pi TUI 回归脚本：

### 基础 TUI 回归

```bash
npm test
# 或
npm run test:tui
```

或直接运行：

```bash
./scripts/tui-regression.sh
```

该脚本使用 `tmux` 驱动真实 Pi 全屏交互界面，断言以下行为：

- 扩展成功加载
- `/ptc status` 初始状态正确
- `/ptc on` / `/ptc off` 会正确切换 `runtimeMode`
- `/ptc config` 会触发系统打开配置文件
- `/reload` 后 `runtimeMode` 仍会恢复
- `/new` 后会创建新 session，且 `runtimeMode` / `mode` 重置
- `/resume` 对话框在真实 TUI 中可正常打开；由于 All 视图会混入全局历史 session，自动选择正确旧 session 目前不作为稳定脚本断言
- 持久化的 `running` 状态不会在 reload 后错误保留

### Mid-run Reflector 回归

当修改 `startMidRunReflector()`、`midRunTurnThreshold`、`grc-mid-run-debug`、`grc-mid-run-reflection-steer` 或其他 mid-run stuck detection 逻辑时，运行：

```bash
npm run test:midrun
```

或直接运行：

```bash
./scripts/midrun-regression.sh
```

该脚本同样基于 `tmux` 驱动真实 Pi 会话，并验证：

- 当测试配置将 `midRunTurnThreshold` 设为 `2` 时，长运行任务期间会落盘 `grc-mid-run-debug`
- session jsonl 中出现 `phase=triggered`
- session jsonl 中出现 `phase=delivered`
- 调试 entry 中记录 `runTurn=2` 与 `threshold=2`
- 若本次 session jsonl 额外出现 `grc-mid-run-reflection-steer`，可作为补充证据

相比只观察 pane 文本，`test:midrun` 以 session jsonl 中的持久化审计 entry 为主判据，更适合稳定回归。`grc-mid-run-debug` 是稳定主证据，`grc-mid-run-reflection-steer` 是否单独落盘取决于当前会话记录形态，因此不作为唯一硬性断言。

## 常见问题

### "PasstoContext not initialized"

如果你仍在使用旧式目录安装，请确认扩展位于 `~/.pi/agent/extensions/passto-context/index.ts`（注意是 `passto-context/index.ts`，不是 `passto-context.ts`）。在当前资源仓方案下，应优先确认 `~/.pi/agent/settings.json` 已指向 `/Users/handy/dev/pi/extensions`，并通过 `/reload` 验证加载。

### 压缩使用了默认方式而非智能摘要

检查：
1. 压缩模型的 API Key 已在 Pi 中配置
2. 配置中的模型名称与可用模型匹配
3. 开启日志排查：设置 `"logEnabled": true`
4. 如需更多细节，进一步设置 `"logLevel": "debug"`
5. 调试日志请优先查看 `~/.passtocontext/log/`

### 记忆没有注入

检查：
1. 记忆功能已启用：`"memory": { "enabled": true }`
2. 当前不是 `/ptc off` 状态
3. 历史记忆文件已存在于 `~/.passtocontext/memory/`

### Widget 不显示

检查：
1. 追踪功能已启用：`"tracking": { "enabled": true, "showWidget": true }`
2. Pi 处于交互模式（非 print 模式）

## 项目结构

```
passto-context/
├── index.ts                 # 主入口：事件注册、命令路由、GRC 集成
├── config.ts                # 配置加载
├── types.ts                 # TypeScript 类型定义
├── utils.ts                 # 工具函数
├── compaction.ts            # compaction handler（curator-only 接管）
├── memory.ts                # 记忆管理（高层接口）
├── memory-index.ts          # 内存搜索引擎
├── context-tracker.ts       # 会话状态追踪
├── grc-state.ts             # GRC 状态机
├── grc-prompts.ts           # Reflector / Curator prompt 与注入文本构造
├── grc-subagent.ts          # Reflector / Curator 执行与解析
├── grc-principles.ts        # principles 存储、检索、命中统计
├── grc-context-manager.ts   # agent-round 边界检测与 context 修剪
├── grc-goal-context.ts      # GoalState → ReflectorGoalContext
├── grc-goal-view.ts         # GoalState 共享焦点视图模型
├── grc-restore.ts           # grc-state / curator-artifact 恢复链
├── ptc-status.ts            # `/ptc status` 文本 formatter
├── docs/
│   └── v1.1/
│       ├── V1_1_FINAL_ARCHITECTURE.md   # v1.1 最终权威口径
│       ├── TODO.md                      # v1.1 收尾归档
│       ├── DESIGN-GRC-v1.1.md          # 主设计背景
│       ├── curator-v1.1.md             # Curator 详细设计
│       ├── PASSTO_CONTEXT_V1_1_PLAN.md # 历史计划文档
│       └── V1_1_CODE_AUDIT.md          # 历史审计文档
├── tests/                    # Node 回归测试
├── scripts/
│   ├── tui-regression.sh     # 真实 Pi TUI 回归脚本（tmux 驱动）
│   └── midrun-regression.sh  # mid-run Reflector 回归脚本
└── package.json              # 包清单 / 测试命令
```

---

**本扩展为PASSTO-AI私有项目，未经授权禁止使用、复制、分发或修改。**
