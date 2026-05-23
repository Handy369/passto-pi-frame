# passto-agent-runtime

共享的 sub-agent / agent harness runtime。职责：
- 启动独立 `pi` CLI 子进程
- 构造统一 CLI 参数
- 管理上下文模式（`spawn` / `fork`）
- 处理 temp prompt / fork session snapshot
- 解析 `--mode json` 事件流
- 汇总 progress / result / artifacts
- 执行 timeout / depth / cycle guard
- 为宿主 extension 提供统一的 TUI 渲染辅助

该目录不是 Pi extension。它是供多个 extension 直接 import 的共享运行核心。

---

## 目标定位

将该 runtime 作为 agent harness 的运行核心，用于统一承载：
- 上下文管理
- 环境配置
- 独立 `pi` 子进程调用
- 运行状态观测
- 子任务产物持久化

未来它应成为：
- `extension-maker` Step 6 isolated review 的底层执行器
- `pi-subagent` 的共享执行内核
- 其他 orchestrator / planner / reviewer extension 的复用核心

---

## 当前目录

```txt
/Users/handy/.pi/agent/lib/passto-agent-runtime/
  index.ts
  types.ts
  cli.ts
  events.ts
  progress.ts
  guards.ts
  artifacts.ts
  tui.ts
  execution.ts
  USAGE.md
  EXAMPLES.md
```

未来预留：

```txt
/Users/handy/.pi/agent/lib/passto-agent-runtime/agents/
  default.md
  reviewer.md
  researcher.md
  ...
```

这些 `agents/*.md` 用于 agent profile / agent harness 配置，作用等价于当前 `pi-subagent/agents/default.md` 一类 agent 文件：
- 定义 agent 的 system prompt
- 定义默认 model / thinking
- 定义默认工具白名单
- 定义默认 skills / extensions 注入策略
- 定义该 agent profile 的用途（review / research / planning / execution）

当前版本已经实现 `agents/*.md` 的加载与解析，并支持通过 `runSubagent({ agent: "default" | "reviewer" | ... })` 使用 profile 默认值。

当前已包含的 profile 示例：
- `default`
- `reviewer`
- `coder`
- `experimenter`（用于按固定 experiment brief 执行 benchmark / A/B / 消融实验，并回收 artifacts）
- `ralph-executor`（用于默认注入 `ralph-wiggum`，供 `pi-subagent` 在 Ralph loop 场景下使用）

---

## Pi CLI 官方支持参数（基于 `pi --help` 验证）

以下为当前 Pi CLI 官方已支持的主要参数。

### Provider / Model
- `--provider <name>`
- `--model <pattern>`
- `--api-key <key>`
- `--models <patterns>`
- `--thinking <level>`

### Prompt / Output
- `--system-prompt <text>`
- `--append-system-prompt <text>`
- `--mode <mode>`
- `--print`, `-p`

### Session / Context
- `--continue`, `-c`
- `--resume`, `-r`
- `--session <path>`
- `--fork <path>`
- `--session-dir <dir>`
- `--no-session`

### Tools / Runtime Surface
- `--no-tools`
- `--tools <tools>`
- `--extension`, `-e <path>`
- `--no-extensions`, `-ne`
- `--skill <path>`
- `--no-skills`, `-ns`
- `--prompt-template <path>`
- `--no-prompt-templates`, `-np`
- `--theme <path>`
- `--no-themes`
- `--no-context-files`, `-nc`

### Utility / Runtime
- `--export <file>`
- `--list-models [search]`
- `--verbose`
- `--offline`
- `--help`, `-h`
- `--version`, `-v`

### Extension-registered CLI flags（当前环境可见）
- `--subagent-max-depth <value>`
- `--subagent-prevent-cycles`

说明：
- 这些参数是当前 `pi --help` 明确列出的官方支持项。
- 共享 runtime 不等于自动支持所有参数；是否支持取决于 `cli.ts` 的 builder / parser 是否已实现。

---

## passto-agent-runtime 当前已实现支持的输入参数

当前统一入口为：
- `runSubagent(options, callbacks?, signal?)`
- `buildPiArgs({ options, inherited, systemPromptPath, forkSessionPath })`

### `PiChildRunOptions` 当前已实现支持

#### 核心运行参数
- `prompt`
- `cwd`
- `agent`
- `sessionMode` (`spawn` / `fork`)
- `forkSessionSnapshotJsonl`

#### Provider / 模型相关
- `provider`
- `model`
- `thinking`

#### 工具 / 资源范围
- `tools`
- `extensions`
- `skills`
- `noTools`
- `noExtensions`
- `inheritParentExtensions`
- `noSkills`
- `noPromptTemplates`
- `noContextFiles`
- `offline`
- `noSession`

#### Prompt / CLI 附加项
- `appendSystemPrompt`
- `extraArgs`

#### Guard / Orchestration
- `timeoutMs`
- `completionPolicy`
- `idleTimeoutMs`
- `terminateGraceMs`
- `maxDepth`
- `preventCycles`
- `parentDepth`
- `parentAgentStack`
- `env`

说明：若调用方未显式传 `completionPolicy / idleTimeoutMs / terminateGraceMs`，runtime 会默认读取 `config.json` 中的 `subagent.defaults`。代码中仅保留极小技术 fallback，供配置缺失时兜底。

### 当前运行时优先级

对于 `provider / model / thinking / inheritParentExtensions / extensions`，当前优先级为：

1. 调用方显式 child options
2. agent profile frontmatter 默认值
3. 父进程 CLI fallback
4. runtime 技术默认值

说明：
- parent `--extension / --no-extensions` 不属于普通 fallback 值；只有在 child 显式设置 `inheritParentExtensions: true` 时才会进入 CLI builder。
- `provider` fallback 与 extension inheritance 是分离判断的，因此 runtime 会针对高风险组合发出 warning，而不是默认假设 provider 一定可用。

---

## 当前已实现的 CLI builder 映射

以下参数已由 `cli.ts` 明确支持并映射到实际 `pi` CLI 调用：

### 固定添加
- `--mode json`
- `-p`

### Session 模式
- `sessionMode: "spawn"` + `noSession !== false` → `--no-session`
- `sessionMode: "fork"` + `forkSessionPath` → 当前实现映射为 `--session <path>`

说明：
- 当前 runtime 的 `fork` 语义是“使用 forked session snapshot 文件作为会话输入源”。
- 当前实现没有直接用 `--fork <path>`，而是用 temp session file + `--session <path>` 来运行。
- 这是 runtime 的当前实现策略，不代表 Pi CLI 不支持 `--fork`。

### 模型与 provider / thinking
- `provider` → `--provider`
- `model` → `--model`
- `thinking` → `--thinking`
- 当前行为：原样透传 Pi 官方 thinking level（如 `off` / `minimal` / `low` / `medium` / `high` / `xhigh`）

### 工具
- `tools` → `--tools a,b,c`
- `noTools` → `--no-tools`

### 扩展 / 技能 / prompt template
- `extensions[]` → `--extension`
- `noExtensions` → `--no-extensions`
- `skills[]` → `--skill`
- `noSkills` → `--no-skills`
- `noPromptTemplates` → `--no-prompt-templates`

### 上下文 / 网络
- `noContextFiles` → `--no-context-files`
- `offline` → `--offline`
- `appendSystemPrompt` → `--append-system-prompt <tempfile>`

### 额外参数
- `extraArgs[]` → 原样追加到 CLI args 尾部（在 prompt 前）

---

## 当前支持“继承并透传”的父进程参数

`parseInheritedCliArgs()` 当前会从父进程 `argv` 中读取并继承/透传一部分参数。

### 当前会继承并透传
#### extensionArgs
- `--extension`, `-e`
- `--no-extensions`, `-ne`

默认行为不是自动继承。当前 runtime 只有在子任务显式设置 `inheritParentExtensions: true` 时，才会把这些父进程 extension 参数继续传给 child。
如果子任务需要一个精确且隔离的 extension surface，可保持 `inheritParentExtensions: false`，这样 child 只使用自身显式配置的 `extensions` / `noExtensions` 策略。

#### alwaysProxy
- `--skill`
- `--prompt-template`
- `--theme`
- `--session-dir`
- `--api-key`
- `--system-prompt`
- `--models`
- `--no-skills`, `-ns`
- `--no-prompt-templates`, `-np`
- `--no-themes`
- `--verbose`

#### fallback only（仅当子任务 options 未显式指定时）
- `--provider`
- `--model`
- `--thinking`
- `--tools`
- `--no-tools`

说明：
- shared runtime 当前采用“显式 child options 优先，agent profile defaults 次之，父 CLI fallback 再次之”的策略。
- `--provider` 当前不再作为 alwaysProxy 直接透传，而是作为 fallback provider 使用，以避免 child CLI 中重复注入 `--provider`。
- parent extension surface 与 provider fallback 是两件独立的事：即使 child 继承到了 provider 名称，也不代表它已经继承了 provider 所依赖的 extension 注册面。
- 当前 warning 机制已支持：
  - `provider_without_extension_inheritance`
  - `provider_with_no_child_extensions`
  - `profile_model_overrides_parent_model`

---

## 当前未直接建模但可通过 `extraArgs` 透传的官方参数

以下官方参数，当前 `PiChildRunOptions` 未为其提供专门字段，但调用方可临时通过 `extraArgs` 使用：
- `--models`
- `--theme`
- `--verbose`
- `--fork`
- `--continue`
- `--resume`
- `--export`
- `--list-models`

说明：
- 这类参数并非完全不可用，而是当前 runtime 还没有把它们升级为一等配置字段。
- 若这些能力会被多个调用方反复使用，应未来正式加入 `PiChildRunOptions`。

---

## 当前明确未支持或不建议的用法

### 1. 不建议让调用方自己拼 `spawn("pi", ...)`
必须统一走：
- `runSubagent()`
- `buildPiArgs()`

### 2. 不建议直接依赖内部文件
必须从：
- `index.ts`
导入

### 3. 当前已实现 `agents/*.md` 的 profile loader，但仍未实现完整 registry
当前已经支持：
- 直接传 `agent: "reviewer"`
- 自动读取 `agents/reviewer.md` 并应用默认值

当前仍未实现：
- 更完整的 provider/model/profile registry
- profile 继承链
- profile 级 schema 校验错误报告体系

---

## 未来扩展方向：`agents/*.md`

未来应在该 runtime 中增加：

### 目录
```txt
passto-agent-runtime/agents/
  default.md
  reviewer.md
  researcher.md
  planner.md
```

### 目标
让调用方不再每次手工传完整 options，而是通过 agent profile 启动子任务，例如：

```ts
runSubagent({
  agent: "reviewer",
  prompt,
  cwd,
})
```

### `agents/*.md` 应承担的配置职责
每个 agent profile 未来应至少能定义：
- `systemPrompt`
- `description`
- `defaultModel`
- `defaultThinking`
- `defaultTools`
- `defaultSkills`
- `defaultExtensions`
- `defaultSessionMode`
- `defaultTimeoutMs`
- `defaultMaxDepth`
- `promptPreamble` / `promptPostamble`

### 未来关系
- `agents/*.md` = agent definition layer
- `passto-agent-runtime` = execution / context / environment harness layer

也就是说：
- `agent.md` 决定“跑什么样的子代理”
- runtime 决定“如何跑起来、如何管理上下文与环境、如何观测结果”

这将替代当前 `pi-subagent/agents/default.md` 在运行时中的角色。

---

## 该 runtime 当前已经实现的核心能力

### 运行核心
- 独立 `pi` 子进程启动
- `spawn` / `fork` 上下文模式
- temp prompt file
- temp fork session snapshot file

### 运行保护
- timeout
- depth guard
- cycle prevention
- cwd 校验
- tools/noTools 冲突校验

### 事件与状态
- `--mode json` 解析
- assistant / tool / usage / stderr / done 事件归一化
- progress reducer
- final result 归一化

### UI 与产物
- TUI progress helper
- final result helper
- artifact manifest helper

---

## 当前建议

### 对调用方
- review / analysis 场景优先使用 `agent: "reviewer"` + `spawn`
- 默认只开放读工具
- prompt 明确要求 strict JSON 时，调用方仍必须自行 `JSON.parse(result.finalOutputText)` 并做 fallback
- 统一使用 `renderProgressUpdate()` / `renderFinalResult()` 做最小 TUI 接入

### 对未来实现者
- 将 `agents/*.md` 作为 agent harness 的 profile 层引入
- 将 provider/model/thinking/tools/skills/extensions 的默认策略从调用点搬到 profile 层
- 将该 runtime 继续收敛为 agent harness 的运行核心，而不是只做 subagent 工具助手

---

## 相关文档
- `USAGE.md`：调用方式
- `EXAMPLES.md`：可复制示例
