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
| `logLevel` | `info` | 日志级别：error、warn、info、debug |

## 记忆存储

记忆以 YAML 文件形式存储在：

```
~/.passtocontext/memory/
├── sessions/     # 自动保存的会话摘要
├── entities/     # 实体知识
└── notes/        # 手动保存的笔记
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
├── index.ts           # 主入口：事件注册、命令路由
├── config.ts          # 配置加载
├── types.ts           # TypeScript 类型定义
├── utils.ts           # 工具函数
├── compaction.ts       # 智能压缩逻辑
├── memory.ts          # 记忆管理（高层接口）
├── memory-index.ts    # 内存搜索引擎
├── context-tracker.ts # 会话状态追踪
└── package.json       # 包清单
```

---

**本扩展为PASSTO-AI私有项目，未经授权禁止使用、复制、分发或修改。**
