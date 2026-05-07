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
- 支持手动保存：`/ctx save <标签>`
- 每次提问前搜索相关记忆并自动注入
- 自动清理过期记忆

### 🔄 GRC 认知循环（已启用）
当前版本已将 GRC（Generator-Reflector-Curator）集成到主扩展中：

- 对话达到阈值后自动触发 GRC 模式（默认第 6 个用户轮次）
- `before_agent_start` 注入基础 GRC prompt、Reflector 建议、相关 principles
- 支持 `manualMode = auto | forced-on | forced-off`，可通过 `/pta on|off` 切换
- `turn_end` 触发一次隐藏的 steer 反思，引导主 LLM 做 2-3 句回顾
- Reflector / Curator 通过后台 `complete()` 异步运行，不阻塞主对话
- Curator 会提取结构化摘要与 principles，并持久化到 `~/.passtocontext/memory/principles/`
- `context` hook 会用 Curator 摘要替换旧 turn，保留最近若干完整轮次
- `session_before_compact` 在 GRC 模式下会优先复用 Curator 最新摘要，而不是重新跑一次普通 compaction LLM
- Widget / status 已显示 GRC 状态：`◆ R:✓ C:⟳`

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

### `/ctx` — 显示会话状态

```
/ctx
```

显示当前会话统计：轮次、Token 用量、修改的文件、使用的工具、会话时长。

### `/ctx save <标签>` — 保存当前上下文

```
/ctx save auth 重构
/ctx save 调试会话
```

将当前会话上下文保存到记忆，附带标签。

### `/ctx search <查询>` — 搜索记忆

```
/ctx search OAuth2 实现
/ctx search 认证模块
```

在记忆库中搜索相关内容。

### `/ctx list` — 列出所有记忆

```
/ctx list
```

显示所有已保存的记忆及其预览。

### `/ctx forget <ID>` — 删除记忆

```
/ctx forget 2026-04-07-auth-a1b2
```

按 ID 删除指定记忆。

### `/ctx config` — 显示配置

```
/ctx config
```

显示当前 PasstoContext 配置。

### `/pta` / `/PTA` — GRC 控制台

```
/pta
/pta status
/pta on
/pta off
/pta reflect
/pta curate
/pta principles
/pta principles context hook
/pta config
```

用于查看和控制 GRC（Generator-Reflector-Curator）状态：

- `/pta` 或 `/pta status`：显示 GRC 完整状态
- `/pta on`：强制开启 GRC，并立即触发一次 steer + 后台分析
- `/pta off`：强制停用 GRC，暂停 prompt 注入、principles 注入、context 修剪、自动触发与 curator-aware compaction
- `/pta reflect`：只手动触发 Reflector
- `/pta curate`：只手动触发 Curator
- `/pta principles [query]`：列出或搜索 principles
- `/pta config`：显示 `grc` 配置

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
| `grc.grcTurnThreshold` | `6` | 达到多少个用户轮次后触发第一次 GRC |
| `grc.grcCooldownTurns` | `4` | 两次 GRC 之间至少间隔多少个用户轮次 |
| `grc.curatorKeepRecentTurns` | `4` | `context` 修剪时保留的最近完整轮次数 |
| `grc.subagentModel` | `gemini-3-flash` | Reflector / Curator 使用的模型 |
| `grc.subagentModelProvider` | `opencode` | Reflector / Curator 模型提供商 |
| `grc.maxReflectorTokens` | `1500` | Reflector 最大输出 Token |
| `grc.maxCuratorSummaryTokens` | `3000` | Curator 最大输出 Token |
| `grc.principlesDir` | `~/.passtocontext/memory/principles` | principles 持久化目录 |
| `grc.maxPrinciplesInjection` | `5` | 每次提问最多注入多少条 principle |
| `grc.maxPrinciples` | `100` | principles 最大保留数量 |
| `logLevel` | `info` | 日志级别：error、warn、info、debug |

> 注：`manualMode` 不在配置文件中声明，而是运行态状态，由 `/pta on` / `/pta off` 控制，并通过 `pi.appendEntry("grc-state", ...)` 持久化。

## 记忆存储

记忆以 YAML 文件形式存储在：

```
~/.passtocontext/memory/
├── sessions/       # 自动保存的会话摘要
├── entities/       # 实体知识
├── notes/          # 手动保存的笔记
└── principles/     # Curator 提取的全局经验原则
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

```
用户对话持续进行
    │
    ▼
turn_end 中累计用户轮次
    │
    ├─ < 阈值: 仅注入基础 GRC prompt / memory / principles
    │
    └─ >= 阈值: 激活 GRC
            │
            ├─ sendMessage(..., { deliverAs: "steer" }) 注入一次反思提示
            ├─ 后台启动 Reflector
            └─ 后台启动 Curator
                    │
                    ├─ Reflector: 产出可注入的顾问意见，或明确无实质建议
                    ├─ Curator: 产出结构化摘要 + principles
                    ├─ before_agent_start: 注入 Reflector 意见 + principles
                    └─ context: 用 Curator 摘要替换旧 turn
```

### 当前实现状态（2026-05-07）

基于真实本地 Pi CLI 环境验证，以下能力已跑通：

- 扩展通过 `~/.pi/agent/settings.json` 挂载资源仓后可真实加载
- 第 6 个用户轮次会自动触发 GRC
- steer 反思会真实追加到主对话
- Reflector / Curator 会在后台真实调用模型
- Curator 摘要会真实驱动 `context` 修剪（日志可见 `15 -> 9 messages`）
- principles 会真实落盘到 `~/.passtocontext/memory/principles/`
- principle tags 由 LLM 直接生成，不再本地粗切中文
- tracker 的 `turnCount` 表示用户轮次；`grcState.turnCount` 表示 GRC 内部工作流计数
- Reflector 在“无实质建议”时会记录日志：`Reflector finished (no substantive advice)`
- `manualMode=forced-off` 会关闭 GRC prompt 注入、principles 注入、context 修剪和 curator-aware compaction
- `session_before_compact` 已实现 curator-first 策略，日志可见：`Using curator summary for compaction`

### 测试状态（2026-05-07）

基于本地真实 Pi CLI + 源码运行态测试，已验证：

- 扩展在 `--no-extensions --extension /Users/handy/dev/passto-ai/extensions/passto-context --no-skills` 隔离模式下可正常加载
- Pi 编译后的 jiti 产物中已包含 `/pta` 与 `/PTA` 命令注册
- Pi 编译后的 jiti 产物中已包含 curator-aware compaction 分支
- `grc-state.ts` 纯函数测试通过：
  - 第 6 轮 `shouldTriggerGRC() === true`
  - `forceActivateGRC()` 会进入 `mode="grc"` 且 `manualMode="forced-on"`
  - `forced-off` 会使 `shouldTriggerGRC()` / `shouldTriggerNextCycle()` 均返回 `false`
- 真实 TUI 回归脚本已通过：
  - `/pta status`
  - `/pta on`
  - `/pta off`
  - `/pta reflect`
  - `/pta curate`
  - `/reload` 后状态保持
  - `/new` 后 session-scoped GRC 状态重置
  - `/resume` 对话框可正常打开并切换到 All 视图
- 6.1/6.4 相关修复已验证：
  - `restoreGRCState()` 会把持久化的 `running` 恢复为 `idle`
  - shutdown / reload 后旧 Promise 不会污染新会话
  - principles 会在 session_start / session_shutdown 按上限清理

### 自动化验证

项目提供真实 Pi TUI 回归脚本：

```bash
npm test
```

或直接运行：

```bash
./scripts/tui-regression.sh
```

该脚本使用 `tmux` 驱动真实 Pi 全屏交互界面，断言以下行为：

- 扩展成功加载
- `/pta status` 初始状态正确
- `/pta on` / `/pta off` 会正确切换 `manualMode` 与 `mode`
- `/pta reflect` / `/pta curate` 可在真实 TUI 中触发
- `/reload` 后 `manualMode` 仍会恢复
- `/new` 后会创建新 session，且 `manualMode` / `mode` / `grcCycleCount` 重置
- `/resume` 对话框在真实 TUI 中可正常打开；由于 All 视图会混入全局历史 session，自动选择正确旧 session 目前不作为稳定脚本断言
- 持久化的 `running` 状态不会在 reload 后错误保留

## 常见问题

### "PasstoContext not initialized"

如果你仍在使用旧式目录安装，请确认扩展位于 `~/.pi/agent/extensions/passto-context/index.ts`（注意是 `passto-context/index.ts`，不是 `passto-context.ts`）。在当前资源仓方案下，应优先确认 `~/.pi/agent/settings.json` 已指向 `/Users/handy/dev/pi/extensions`，并通过 `/reload` 验证加载。

### 压缩使用了默认方式而非智能摘要

检查：
1. 压缩模型的 API Key 已在 Pi 中配置
2. 配置中的模型名称与可用模型匹配
3. 开启 debug 日志查看错误详情：设置 `"logLevel": "debug"`

### 记忆没有注入

检查：
1. 记忆功能已启用：`"memory": { "enabled": true }`
2. 记忆文件存在：`/ctx list`
3. 搜索功能正常：`/ctx search <关键词>`

### Widget 不显示

检查：
1. 追踪功能已启用：`"tracking": { "enabled": true, "showWidget": true }`
2. Pi 处于交互模式（非 print 模式）

## 项目结构

```
passto-context/
├── index.ts               # 主入口：事件注册、命令路由、GRC 集成
├── config.ts              # 配置加载
├── types.ts               # TypeScript 类型定义
├── utils.ts               # 工具函数
├── compaction.ts          # 智能压缩逻辑
├── memory.ts              # 记忆管理（高层接口）
├── memory-index.ts        # 内存搜索引擎
├── context-tracker.ts     # 会话状态追踪
├── grc-state.ts           # GRC 状态机
├── grc-prompts.ts         # Generator / Reflector / Curator prompt 模板
├── grc-subagent.ts        # Reflector / Curator 执行与解析
├── grc-principles.ts      # principles 存储、检索、命中统计
├── grc-context-manager.ts # Curator 摘要驱动的 context 修剪
├── DESIGN-GRC.md          # GRC 设计文档
├── TODO.md                # GRC 实施 TODO
├── scripts/
│   └── tui-regression.sh  # 真实 Pi TUI 回归脚本（tmux 驱动）
└── package.json           # 包清单 / 测试命令
```

---

**本扩展为PASSTO-AI私有项目，未经授权禁止使用、复制、分发或修改。**
