# Codegen Mapping Protocol (Updated)

本文档定义 Spec -> index.ts 映射规则。

## 0. 官方文档优先 (Official Docs First)
- **CRITICAL**: 在开始编写代码前，**必须** 调用 `ext_maker_read_docs` 读取 `extensions.md` 和 `tui.md`。
- 所有 API 调用、参数类型定义、TUI 组件用法，必须**严格基于读取到的最新文档**，不得依赖过时的记忆。
- 在真正生成代码前，必须先从 docs 中提炼一份 **当前实现方法摘要**。
- 这份摘要必须写入目标目录中的 `implementation-method.json`，作为后续 codegen 与 review 的共同契约。
- `implementation-method.json` 至少覆盖：
  - exposure / command / tool 注册策略
  - state / step / path / slug 策略
  - `ctx.ui.select` 的当前签名与返回值语义
  - `ctx.ui.input` 的当前签名
  - `ctx.ui.confirm` 的返回值类型与参数方式
  - `ctx.ui.editor` 的参数方式
- 后续代码只能依据这份从 docs 推导出的实现方法来写，不能凭记忆猜测。

## 0.5 需求分类到实现结构的映射

根据 Spec 中的 `requirementCategory`，`implementation-method.json` **必须**包含对应的结构：

| requirementCategory | 必须包含的额外字段 |
|---------------------|-------------------|
| `simple-tool` | 无额外要求 |
| `provider-wrapper` | `adapterDesign`: 描述外部 API/CLI 的封装方式 |
| `stateful-workflow` | `orchestratorDesign`: 状态机/流程控制描述；`behaviorContract`: 行为到实现的映射 |
| `recursive-research-engine` | `loopDesign`: 循环设计；`knowledgeStructure`: 知识积累结构；`sufficiencyLogic`: 充分性判断逻辑；`behaviorContract`: 行为到实现的映射 |
| `multi-agent-orchestrator` | `loopDesign`: 编排循环；`delegationModel`: 委派模型；`aggregationStrategy`: 结果聚合策略；`behaviorContract`: 行为到实现的映射 |

### `recursive-research-engine` 的 loopDesign 必须包含
```json
{
  "loopDesign": {
    "entryCondition": "循环何时开始（如：初始查询已接收且有待解答问题）",
    "bodyDescription": "每轮循环执行的操作序列",
    "terminationCondition": "循环何时终止（充分性判断、最大轮次、错误）",
    "maxIterations": "最大迭代次数",
    "stateAccumulation": "每轮如何更新知识池/状态"
  },
  "knowledgeStructure": {
    "pool": "知识池的数据结构",
    "gaps": "缺口的追踪方式",
    "sources": "来源管理方式"
  },
  "sufficiencyLogic": {
    "criteria": "充分性的判断标准",
    "checkPoint": "在循环的哪个节点执行判断"
  }
}
```

### 降级实现禁止规则
**严禁**将 `recursive-research-engine` / `multi-agent-orchestrator` / `stateful-workflow` 类别的需求实现为：
- 单次函数调用（无循环、无状态机）
- 仅有 provider 调用，无编排逻辑
- 缺少 Spec 中 `mandatoryBehaviors` 列出的任一行为

如果实现不符合需求类别要求的结构，则属于 **降级实现 (Downgraded Implementation)**，review 阶段必须判定为 fail。

## 1. Exposure Model Mapping
- Pi 官方机制中：
  - `pi.registerCommand()` = 用户通过 `/command` 显式触发
  - `pi.registerTool()` = 暴露给 LLM，LLM 可自行判断是否调用
  - 两者可并存
- 生成代码前，必须先根据用户选择确定暴露方式：
  - `command-only`
  - `tool-only`
  - `both`
- 该选择必须进入 state/spec，并最终映射到具体注册方式。

## 2. Command-First Isolation
- 对于 workflow/orchestrator 类扩展，默认优先推荐 `command-only` 或 `both`，避免无意触发。
- **前缀**: 所有 tools 必须带有 `ext_{slug}_` 前缀。
- **Guard**: `buildPrompt` 中必须注入隔离保护语。

## 3. State Machine
- **Interface**: `interface {Slug}State { target, planningDir, currentStep, startedAt }`
- **Helpers**: `saveState`, `loadState`, `removeState`.
- **Logic**: `next` tool 负责 `currentStep++` 并 `saveState`.

## 4. Prompt Construction
- **Dynamic**: `buildPrompt(state, step)` 根据 step 返回不同指令。
- **Rules**: 禁止跳步，必须指定完成后调用哪个 tool。

## 5. TUI Component Mapping
- 如果 Spec 中定义了交互，查阅 `tui.md` 与 `extensions.md` 确定使用 `ctx.ui` 的哪个方法。
- 不要把 UI API 当成固定常识；必须从当前 docs 中重新推导实现方法。

### 动态推导要求（必须遵守）
- 对以下方法，生成前必须重新从 docs 推导：
  - `ctx.ui.select`
  - `ctx.ui.input`
  - `ctx.ui.confirm`
  - `ctx.ui.editor`
- 对每个方法，都要先确认：
  - 当前参数形状是什么
  - 返回值类型是什么
  - 调用方应如何消费该返回值
- 如果 docs 不能支持某种写法，就不能生成该写法。
- 如果有疑问，必须再次调用 `ext_maker_read_docs(topic="tui")`，不得猜测。

### 生成规则
- **Select**: 根据 docs 推导其参数方式与返回值；若业务内部需要 key/value，先使用 docs 允许的显示结构，再在代码里建立 `label -> key` 映射。
- **Input**: 根据 docs 推导其参数方式；不得假设支持默认值参数，除非 docs 明确写出。
- **Confirm**: 根据 docs 推导返回值，并据此写条件逻辑；不得想当然把返回值当字符串。
- **Editor**: 根据 docs 推导参数语义；只有 docs 明确支持时，才能把第二参数当作预填内容或其他用途。
- **Notify**: 调用方式与 level 语义必须符合 docs。

## 6. Review Generation
- Review 阶段不得依赖静态枚举规则直接扫代码。
- 必须先读取 `implementation-method.json`，并把它视为本次实现的显式契约。
- 必须验证：
  - `implementation-method.json` 是否与官方 docs + spec 一致
  - 生成产物是否真正实现了 `implementation-method.json`
  - **对于 workflow/system 类别：是否实现了编排循环、知识模型、充分性判断等行为要求**
- Review 必须优先通过 `subagent` 在隔离上下文中执行，避免主上下文污染。
- 如果使用 subagent，推荐 `mode: "spawn"`，并在任务中明确提供：
  - spec 路径
  - implementation-method.json 路径
  - 目标文件路径
  - 当前步骤目标
  - 需要对照的官方 docs 主题
  - **需求类别及其对应的行为要求**

## 7. Artifacts
- **Method Contract**: `implementation-method.json`
- **Code**: `index.ts`
- **Docs**: `SKILL.md` (Workflow), `references/` (Rules).
- **State**: `.state.json` (Runtime).
