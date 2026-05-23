---
name: doc-lookup
description: >
  官方文档查询工具。当用户询问语言、框架、库、API 的用法、配置、示例时，
  强制 LLM 优先查官方文档而非训练数据。

  使用此技能的场景：
  - 用户询问"如何使用 X 库/框架"
  - 用户询问"X API 的参数是什么"
  - 用户询问"如何配置 X"
  - 用户询问"X 的最新版本特性"
  - 用户询问"X 和 Y 有什么区别"
  - 用户提到具体技术名称（React, FastAPI, PostgreSQL 等）

  应优先触发的场景：
  1. 用户要求查找官方文档
  2. 用户询问技术实现细节

  不要在以下场景触发：
  - 用户询问纯概念性问题（不需要查文档）
  - 用户询问的是通用知识（不需要特定库文档）
  - 用户明确要求使用训练数据
---

# doc-lookup — 官方文档查询路由器

> **last_verified: 2026-05-16**

## Top-level Boundary Pack

### current main output
- 基于官方文档内容的答案、配置说明、API 用法、版本差异说明
- 明确来源 URL 的技术回答，而不是仅凭训练数据的泛化回答

### current main action
- 判断当前问题是否需要官方文档
- 识别技术类别并定位到对应 `references/*.md`
- 查找官方 URL
- 读取文档内容并基于文档回答
- 必要时把新官方 URL 追加到 `AUTO-ADDED-SOURCES`

### should-trigger
当用户当前主目标是以下任一项时，优先进入本 Skill：
- 询问某个语言、框架、库、API、工具的具体用法
- 询问配置、参数、示例、版本差异、迁移方式
- 明确要求“查官方文档”“不要靠记忆”“给我最新文档依据”
- 当前实现或定义问题的关键不在写代码，而在先确认权威技术来源

### should-not-trigger
以下请求不应由本 Skill 接管：
- 纯概念性讨论，不需要特定库/框架官方文档
- 通用常识、经验判断、纯头脑风暴
- 用户明确要求只用训练数据回答
- 主要任务已经是写代码、修 bug、做产品定义，而不是查技术文档来源

### adjacent destination
- 已经明确进入代码实现 / 调试 / 测试 / review → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 主要目标是产品定义、需求范围、方案梳理 → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 若只是一般知识问答且不依赖具体技术官方来源 → 直接回答，不必 adopt 本 Skill

### non-goals
即使命中本 Skill，也不要顺手扩做：
- 把文档查阅任务扩成完整代码实现
- 把“提到技术名词”误判成一定需要官方文档
- 用训练数据脑补文档未写的细节，却不显式标注缺口
- 为了收集链接而添加低质量或非权威 URL

### first action after hit
先判断问题是否真的依赖官方文档；若依赖，再先识别技术类别并在对应 `references/*.md` 中找官方 URL，然后读取文档内容，再回答。

### positive examples
- “React 19 的 `use` API 怎么用？给我基于官方文档的解释和链接。”
  - why should trigger: 用户明确要官方文档依据与具体 API 用法
  - expected adopt signal: 先定位 JS/TS references，读取官方 URL，再带来源回答
- “FastAPI 的依赖注入参数该怎么写？不要靠记忆回答。”
  - why should trigger: 这是具体框架用法，且明确要求文档依据
  - expected adopt signal: 先查 Python references 和官方文档，再基于文档说明参数/示例
- “PostgreSQL 15 和 16 在 logical replication 上有什么变化？”
  - why should trigger: 这是版本差异与技术细节问题，适合先查官方文档
  - expected adopt signal: 先定位数据库 references，读取官方资料并标注来源

### negative examples
- “帮我想一个适合中小团队的代码评审流程。”
  - why should not trigger: 这是通用流程设计，不依赖具体官方文档
  - correct destination: 直接回答或走定义/实施主流程
- “直接把这个 React 组件改掉，并补测试。”
  - why should not trigger: 主输出物是代码实现，不是文档查阅
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “你就凭经验说说 ORM 和 SQL 各自的优缺点。”
  - why should not trigger: 用户没有要求特定官方来源，且是泛概念比较
  - correct destination: 直接回答即可

## Overview

强制 LLM 优先使用官方文档，而非训练数据。当 SKILL 有 URL 时直接查，
没有时搜索并异步添加。核心原则：**训练数据不可靠，官方文档才是真理**。

## SKILL 位置（供 LLM 使用）

```
技能根目录: ~/.claude/skills/doc-lookup/
references 目录: ~/.claude/skills/doc-lookup/references/
```

**修改规则：添加 URL 时，只添加到 references/*.md 文件的
AUTO-ADDED-SOURCES 区域内，格式为：**

```markdown
- **名称**: URL # added: YYYY-MM-DD | by: LLM-name
```

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 顶层路由入口；负责判断是否真的需要官方文档、先读哪类 references、何时退出 |
| `references/` | required | runtime | 承载技术类别到官方 URL 的映射，是命中后首个读取面 |
| `references/*.md` | required | runtime | 分类维护官方文档 URL；支持最小分类定位与增量补录 |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 Skill 的职责是文档路由与来源约束，不需要脚本层 |
| `AUTO-ADDED-SOURCES` 区域 | required | runtime | 为新增官方 URL 提供唯一允许写入的位置，避免把补录逻辑扩散到文件其他区域 |

## Quick Reference

| 任务 | 方式 | references |
|------|------|------------|
| JS/TS 框架文档 | 查官方 | → javascript.md |
| Python 框架文档 | 查官方 | → python.md |
| Go 生态文档 | 查官方 | → go.md |
| Rust 生态文档 | 查官方 | → rust.md |
| Java/JVM 文档 | 查官方 | → java.md |
| .NET 文档 | 查官方 | → dotnet.md |
| 数据库文档 | 查官方 | → databases.md |
| DevOps 工具文档 | 查官方 | → devops.md |
| 移动开发文档 | 查官方 | → mobile.md |
| AI/ML 框架文档 | 查官方 | → ai-ml.md |
| 其他技术文档 | 搜索 + 添加 | → other.md |

## 决策树

### Q1: 用户询问的是技术文档/库/框架/语言吗？
- **否** → 退出，不使用此 Skill
- **是** → Q2

### Q2: references/ 中有这个库的 URL 吗？
- **是** → 直接查官方文档
- **否** → Q3

### Q3: Web Search 能找到有效文档吗？
- **能** → 添加到 AUTO-ADDED-SOURCES → 读取文档 → 基于文档回答
- **不能** → 使用训练数据，注明可能过时

## 工作流程（强制执行）

### 完整流程（已知库 + 未知库）

```
1. 查找 URL
   ├── 已知库 → 从 references/*.md 获取 URL
   └── 未知库 → Web Search 搜索 → 评估权威性 → 添加到 AUTO-ADDED-SOURCES

2. 读取文档内容（必须执行）
   └── 使用 Jina Reader 读取 URL: curl -s "https://r.jina.ai/URL"

3. 基于文档内容回答（强制执行）
   - 回答的唯一来源 = 刚读取的文档内容
   - 不能混用训练数据
   - 如果文档和训练数据冲突，以文档为准
   - 如果文档没有覆盖的问题，注明"文档未提及"

4. 注明来源
   └── 在回答中标注: 来源: [URL]

5. 告知添加位置
   └── 在回答末尾告知 URL 已添加的位置
```

### ⚠️ 关键原则

**回答 = 文档内容，不是训练数据**

LLM 可能会用训练数据回答，但必须克制这种倾向：
- 训练数据是过时的、不准确的
- 文档才是最新、最准确的答案
- 如果文档内容与训练数据不一致，**必须以文档为准**

### 示例流程

```
用户问: 如何在 Hono 中使用中间件？

LLM 流程:
1. 从 javascript.md 找到 Hono URL: https://hono.dev/
2. 读取文档内容 (curl -s "https://r.jina.ai/https://hono.dev/docs/guides/middleware")
3. 基于文档内容回答（不能凭记忆）
4. 注明: 来源: https://hono.dev/docs/guides/middleware
5. 告知: Hono 已添加到 javascript.md 第 278 行
```

## 多 URL 策略

同一库可能有多个 URL，按以下顺序读取：
1. 官方文档
2. 官方中文镜像（如果存在）
3. 权威社区文档
4. 其他

读取时：依次读取，直到获得足够信息。

## URL 添加规则（强制执行）

当发现有效 URL 时，**直接添加**并告知用户位置。

### 步骤 1：评估标准（必须满足）
- 来源：官方文档 或 知名权威机构
- 内容：与目标库直接相关
- 质量：有实质内容（不是简单的首页）
- 补充：不重复已有 URL

### 步骤 2：直接添加（无需询问）

找到有效 URL 后，**立即调用 edit 或 write 工具添加**到 AUTO-ADDED-SOURCES 区域。

**必须使用工具**：
- `edit` 工具：追加内容到 AUTO-ADDED-SOURCES 区域内
- 或 `write` 工具：写入完整文件

**格式必须与原有条目一致**：
```markdown
### [库名]
- **官方文档**: [URL]
- added: YYYY-MM-DD | by: LLM-name
```

**关键要求**：
- **只添加一个 URL**：官方文档 URL，不要添加多个
- **添加到 AUTO-ADDED-SOURCES 区域内**：不是其他位置
- **目标文件**：`~/.claude/skills/doc-lookup/references/{category}.md`
- **必须实际调用工具**：不能只是嘴上说添加，必须真正执行 edit/write

### 步骤 3：在回答末尾告知用户

**格式**：
```
---
已将 [库名] 添加到 doc-lookup
   文件: ~/.claude/skills/doc-lookup/references/{category}.md
   位置: 第 N 行
---
```

### ⚠️ 强制要求
- **直接添加，无需询问**：用户授权时没有额外信息需要确认
- **先添加，再告知位置**：添加完成后在回答末尾告知
- **必须添加到 AUTO-ADDED-SOURCES**：不能添加到其他位置
- **必须告知具体文件和行号**：方便用户核查

## references/ 索引

| 文档 | 覆盖范围 | last_verified |
|------|----------|---------------|
| [references/javascript.md](references/javascript.md) | JS/TS 生态 | 2026-04-06 |
| [references/python.md](references/python.md) | Python 生态 | 2026-04-06 |
| [references/go.md](references/go.md) | Go 生态 | 2026-04-06 |
| [references/rust.md](references/rust.md) | Rust 生态 | 2026-04-06 |
| [references/java.md](references/java.md) | Java/JVM | 2026-04-06 |
| [references/dotnet.md](references/dotnet.md) | .NET | 2026-04-06 |
| [references/databases.md](references/databases.md) | 数据库 | 2026-04-06 |
| [references/devops.md](references/devops.md) | DevOps/Cloud | 2026-04-06 |
| [references/mobile.md](references/mobile.md) | 移动开发 | 2026-04-06 |
| [references/ai-ml.md](references/ai-ml.md) | AI/ML | 2026-04-06 |
| [references/other.md](references/other.md) | 其他 | 2026-04-06 |

## Best Practices

### DO
- **强制查官方**：即使知道答案，也要查官方文档确认
- **注明来源**：告诉用户信息来自哪个 URL
- **异步添加**：发现有效 URL 时主动添加
- **多源验证**：有疑问时读多个 URL 交叉验证
- **明确路径**：修改时使用完整路径 `~/.claude/skills/doc-lookup/references/*.md`

### DON'T
- **不依赖训练数据**：不直接用训练数据回答技术问题
- **不假设最新**：不假设训练数据是最新的
- **不添加低质量 URL**：只添加权威来源
- **不修改已有内容**：只在 AUTO-ADDED-SOURCES 区域追加

## Dependencies

- Web Search（agent-reach skill）
- URL 读取工具（Jina Reader 或 curl）

---

## Related

| 关联文档 | 说明 |
|----------|------|
| [references/javascript.md](references/javascript.md) | JS/TS 生态 URL |
| [references/python.md](references/python.md) | Python 生态 URL |
| [references/go.md](references/go.md) | Go 生态 URL |
