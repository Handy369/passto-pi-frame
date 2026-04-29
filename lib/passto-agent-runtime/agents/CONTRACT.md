# Agent Profile Contract

本目录下的 `*.md` 文件定义 `passto-agent-runtime` 的 agent profile。

## 作用

每个 agent profile 同时承担两部分职责：
1. **frontmatter**：定义可机器消费的默认运行配置
2. **正文**：定义该 agent 的 `systemPrompt`

运行时入口：
- `loadAgentProfile()`
- `applyAgentProfileDefaults()`
- `runSubagent({ agent: "..." })`

---

## 文件结构

每个 agent 文件必须采用以下结构：

```md
---
name: reviewer
description: Isolated review agent
model: PASSTOAI-TW/HubTo-TW/qwen3.6-plus
thinking: low
tools: read,bash,grep,find,ls
skills:
extensions:
sessionMode: spawn
timeoutMs: 600000
maxDepth: 1
---

这里是该 agent 的 system prompt 正文。
```

---

## Frontmatter 字段

### 必填字段

#### `name`
- 类型：`string`
- 作用：agent 标识名
- 要求：应与文件名语义一致
- 示例：
  - `name: reviewer`
  - `name: default`

---

### 可选字段

#### `description`
- 类型：`string`
- 作用：agent 简介

#### `model`
- 类型：`string`
- 作用：默认模型
- 示例：
  - `model: PASSTOAI-TW/HubTo-TW/qwen3.6-plus`
  - `model: openai/gpt-4o`

#### `thinking`
- 类型：`string`
- 作用：默认 thinking level
- 当前允许值应与 Pi CLI 对齐：
  - `off`
  - `minimal`
  - `low`
  - `medium`
  - `high`
  - `xhigh`
- 说明：runtime 可能对部分值做兼容映射（例如 `minimal -> low`）

#### `tools`
- 类型：`comma-separated string`
- 作用：默认工具白名单
- 示例：
  - `tools: read,bash,grep,find,ls`
- 空值：等价于未设置

#### `skills`
- 类型：`comma-separated string`
- 作用：默认技能列表
- 示例：
  - `skills: /abs/path/a,/abs/path/b`
- 空值：等价于未设置

#### `extensions`
- 类型：`comma-separated string`
- 作用：默认 extension 路径列表
- 示例：
  - `extensions: /abs/path/ext-a.ts,/abs/path/ext-b.ts`
- 空值：等价于未设置

#### `inheritParentExtensions`
- 类型：`boolean string`
- 作用：是否继承父进程 CLI 中的 `--extension / --no-extensions`
- 示例：
  - `inheritParentExtensions: false`
- 典型场景：子任务需要一个精确、隔离、不受父进程 extension 污染的工具面

#### `sessionMode`
- 类型：`string`
- 允许值：
  - `spawn`
  - `fork`
- 作用：默认上下文模式

#### `timeoutMs`
- 类型：`number string`
- 作用：默认超时时间（毫秒）
- 示例：
  - `timeoutMs: 600000`

#### `maxDepth`
- 类型：`number string`
- 作用：默认最大 delegation 深度
- 示例：
  - `maxDepth: 1`

---

## 正文（Body）

frontmatter 之后的正文会被视为：
- `systemPrompt`

要求：
- 正文必须是该 agent 的稳定角色定义
- 不要把运行参数写进正文
- 运行参数必须放在 frontmatter

---

## 优先级规则

运行时参数优先级必须固定为：

### 1. 调用方显式参数
来自：
- `runSubagent(options)`

### 2. agent profile frontmatter 默认值
来自：
- `agents/*.md`

### 3. runtime 内建默认值
来自：
- `guards.ts`
- `cli.ts`
- 其他 runtime 默认逻辑

---

## 优先级示例

### 示例 1：调用方覆盖 model

agent profile：

```md
---
name: reviewer
model: PASSTOAI-TW/HubTo-TW/qwen3.6-plus
---
```

调用：

```ts
runSubagent({
  agent: "reviewer",
  model: "openai/gpt-4o",
  prompt,
  cwd,
})
```

结果：
- 最终使用 `openai/gpt-4o`
- frontmatter 的 `model` 仅作为默认值

---

### 示例 2：调用方未传 tools

agent profile：

```md
---
name: reviewer
tools: read,bash,grep,find,ls
---
```

调用：

```ts
runSubagent({
  agent: "reviewer",
  prompt,
  cwd,
})
```

结果：
- 最终使用 frontmatter 中的 `tools`

---

## System Prompt 合并规则

`systemPrompt` 的优先级不是覆盖，而是合并。

当前规则：
- agent profile 正文 = 基础 `systemPrompt`
- `options.appendSystemPrompt` = 调用方追加 prompt
- 最终运行时会拼接：

```txt
[agent profile 正文]

[appendSystemPrompt]
```

结论：
- `appendSystemPrompt` 不会替换 agent 正文
- 它只会附加在后面

---

## 空值规则

以下字段若为空：
- `skills:`
- `extensions:`
- `tools:`

当前解析行为：
- 等价于未设置
- runtime 不应将空字符串当作有效值

---

## 未知字段规则

当前要求：
- 不要在 frontmatter 中写未支持字段
- LLM 生成 agent 文件时，禁止幻想字段

例如以下字段当前不属于 contract：
- `memory`
- `safetyLevel`
- `delegationStrategy`
- `artifactPolicy`
- `provider`

未来若需要支持，必须先更新本文件，再更新 runtime 解析逻辑。

---

## 对 LLM / 调用方的强制要求

1. 必须遵守本文件中的 frontmatter 字段名。
2. 不要发明 contract 外字段。
3. review / analysis agent 默认应倾向只读工具。
4. 若 agent profile 需要 strict JSON 输出要求，应放在正文里，而不是 frontmatter。
5. 调用方若显式传值，必须理解自己会覆盖 frontmatter 默认值。

---

## 当前实现已消费的字段

当前 `passto-agent-runtime` 已实际解析并消费以下 frontmatter：
- `name`
- `description`
- `model`
- `thinking`
- `tools`
- `skills`
- `extensions`
- `sessionMode`
- `timeoutMs`
- `maxDepth`
- 正文 `systemPrompt`

任何其他字段当前都不会被 runtime 正式支持。
