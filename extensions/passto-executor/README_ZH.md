# Passto Executor

`passto-executor` 是一个面向 Pi 的、以任务为驱动的执行容器（execution container）。

它帮助调用者把以下输入：
- 项目或工作区
- 任务目标
- 期望产出物
- 执行偏好

转换成一次标准化的执行流程，包含：
- 上下文装配
- sandbox / worktree 隔离
- child runtime 启动
- 事件与结果采集
- 持久化的运行 artifacts

如果你是 **调用者 / 集成方**，最重要的一句话是：

> 你负责描述任务、项目上下文和目标输出；`passto-executor` 负责装配并运行执行容器，然后返回运行结果，并产出可检查的 artifacts。

---

## `passto-executor` 的用途

当你希望以一种比“直接调用一次 child agent”更结构化的方式执行任务时，可以使用 `passto-executor`。

典型场景包括：
- 针对一个项目运行 coding / review / debug 任务
- 在隔离的 temp copy 或 git worktree 中执行任务
- 运行单个 perspective，或多个 perspective
- 保留运行 artifacts 供后续检查
- 将旧的 subagent 风格请求迁移到更稳定的执行路径上

当调用者希望获得以下能力时，`passto-executor` 特别有用：
- 稳定的执行 contract
- 显式的 runtime policy
- 文件级持久化 artifacts 和结果
- 与主工作区隔离的执行环境

---

## `passto-executor` 不是什么

`passto-executor` **不是**：
- 一个完整的 builder / orchestrator 产品
- 一个完整的 legacy `subagent` shell 替代品
- 对所有 child profile / extension 组合都提供普遍 runtime parity 保证
- 一个在 child 发出 `agent_end` 后立刻退出的薄封装器

它的 runtime posture 是有意设计成 **process-oriented** 的。

这意味着 executor 管理的 run 会基于以下条件完成：
- 进程自然退出
- idle timeout
- hard timeout
- termination grace 行为

而不是基于调用者控制的 `agent-end` shutdown 语义。

---

## 核心执行模型

executor 遵循以下路径：

`task.md -> invocation -> assembly -> resolved context -> execution`

作为调用者，你通常有两种输入方式：

1. **task document 路径**
   - 提供一个 `task.md` 文件
2. **direct invocation 路径**
   - 在代码中直接构造 invocation 对象

这两条路径最终都会进入同一条 executor pipeline。

---

## 调用者需要提供什么输入

从实用角度看，调用者通常需要提供：

### 1. 项目 / 工作区上下文
例如：
- 仓库根目录或工作目录
- task document 路径
- sandbox / worktree strategy 等 runtime 选项

### 2. 任务目标
例如：
- 实现一个功能
- 审查导出 API 的稳定性
- 调查一个失败问题
- 生成或更新文件

### 3. 期望输出
例如：
- 一次代码修改
- 一份 review note
- 一个更新后的文件
- 一份结构化 run result
- 一个在 sandbox/worktree 中生成的 artifact

### 4. 可选执行偏好
例如：
- execution mode：`single`、`sequential`、`parallel`、`dag`
- sandbox strategy
- timeout policy
- 用于迁移场景的 compatibility 风格字段

executor 会基于这些输入装配实际运行时上下文。

---

## 如何指定期望输出

主要有两种方式。

### A. 在 `task.md` 中指定
`task.md` 可以描述：
- 任务本身
- 约束 / checklist
- 期望输出或 artifacts
- execution hints

适合：
- 任务需要被 review
- 任务需要被人编辑
- 任务需要作为文件级 contract 存在于仓库或共享给别人

### B. 在 direct invocation 中指定
你的 invocation 可以直接表达调用者意图，包括：
- task prompt/body
- inputs
- execution mode
- role/agent 偏好
- runtime policy

适合：
- 由更高层 orchestrator / builder 以程序方式驱动执行

---

## 输出结果去哪里拿

作为调用者，你应当从 **三个层面** 理解 executor 的输出。

### 1. API 直接返回的 run result
主要执行 API 会返回结构化的 `ExecutorRunResult`。

这是你查看以下信息的第一入口：
- 整体 success / failure
- 各 perspective 的 summary
- 聚合结果数据
- run 的高层状态

### 2. 持久化的 run artifacts
如果使用 file-backed storage，executor 会持久化以下 artifacts：
- manifest metadata
- events
- result records
- failure records

适合：
- 审计
- 运行后排查
- 被其他工具后续读取
- 在进程结束后继续调试

### 3. sandbox / worktree / project 中的文件产物
如果 child task 会修改文件或生成 artifacts，那么这些输出会存在于执行工作区中。

根据 sandbox strategy，它可能位于：
- 原始 project root
- temp-copy sandbox
- git worktree

如果启用了 preserve，或 run 在 preserve-on-failure 策略下失败，你可以直接检查这些文件。

---

## 应该使用哪个 API

## 稳定 root API：`@handy/passto-executor`

大多数调用者应从 root package 开始。

主要入口：
- `executeInvocation(invocation, options)`
- `executeTaskDoc(taskDocPath, options)`
- `taskDocToInvocation(taskDoc)`
- `assembleExecutorContext(invocation, options)`

root package 也提供 compatibility helpers：
- `legacyRequestToInvocation(request)`
- `legacyRequestToRuntimePolicy(request)`
- `legacyRequestToExecuteOptions(request, options)`
- `executeLegacyRequest(request, options)`

常用类型包括：
- `ExecutorInvocation`
- `ResolvedExecutorRunContext`
- `ExecutorRuntimePolicy`
- `ExecutorRunResult`
- `SandboxCleanupPolicy`

## 高级入口

如果你需要更底层的 helper 或更贴近实现的 surface，可使用：
- `@handy/passto-executor/executor-core`
- `@handy/passto-executor/compatibility`

这些更适合高级集成，而不是普通调用者。

---

## 推荐的调用者使用路径

### 路径 1：执行一个经过 review 的 `task.md`
适合：
- 任务文件由人编写或 review 过
- 你需要一个持久、可检查的执行 contract

典型流程：
1. 创建 `task.md`
2. 调用 `executeTaskDoc(taskDocPath, options)`
3. 检查返回的 `ExecutorRunResult`
4. 如有需要，再检查持久化 artifacts 或保留下来的 sandbox/worktree

### 路径 2：执行一个程序化构造的 invocation
适合：
- 更高层工具动态生成任务
- 你已经在代码中持有结构化状态

典型流程：
1. 构造 `ExecutorInvocation`
2. 调用 `executeInvocation(invocation, options)`
3. 检查返回的 `ExecutorRunResult`
4. 如需更深层审计，再检查 run artifacts

### 路径 3：迁移 legacy 风格请求
适合：
- 你手头有旧的 subagent 风格调用
- 你希望渐进迁移，而不是一次性重写所有逻辑

典型流程：
1. 通过 compatibility helpers 适配
2. 使用 `executeLegacyRequest(...)` 或分步转换
3. 后续逐步迁移到标准 invocation / task-doc 路径

---

## 最小示例

### 示例：执行一个 task document

```ts
import { executeTaskDoc } from "@handy/passto-executor";

const result = await executeTaskDoc("./examples/phase4-dag.task.md", {
  runId: "example-run-1",
  agent: "default",
});

console.log(result.status);
```

### 示例：执行一个 direct invocation

```ts
import { executeInvocation } from "@handy/passto-executor";

const result = await executeInvocation({
  task: "Review the exported API and write a short note",
  cwd: "/path/to/project",
  expectedOutput: "A short review note saved in the project workspace",
  perspectives: [
    {
      id: "review",
      prompt: "Review the exported API and summarize risks.",
    },
  ],
}, {
  runId: "example-run-2",
  agent: "reviewer",
});

console.log(result.status);
```

### 示例：执行一个 legacy 风格请求

```ts
import { executeLegacyRequest } from "@handy/passto-executor";

const result = await executeLegacyRequest({
  task: "review the exported API",
  cwd: "/path/to/project",
  role: "reviewer",
  mode: "single",
  checklist: ["Check API stability"],
}, {
  runId: "compat-run",
  agent: "default",
});
```

---

## Sandbox 与工作区行为

支持的策略包括：
- `noop`
- `temp-copy`
- `worktree`

你可以通过它们控制任务运行在哪里，以及文件输出落在哪里。

### 实用建议
- 只有在你明确想原地操作时才用 `noop`
- 需要轻量隔离时用 `temp-copy`
- 针对仓库任务，优先使用 `worktree`

---

## Execution modes

支持的执行模式：
- `single`
- `sequential`
- `parallel`
- `dag`

使用建议：
- `single`：只有一个主 perspective
- `sequential`：执行顺序重要
- `parallel`：各 perspective 相互独立
- `dag`：perspective 之间存在显式依赖关系

当前 DAG 支持是有边界的，不是一个完整的通用 workflow engine。

---

## 按调用者场景选择示例

根据你的调用场景选择对应 example。

### 我只想跑一个简单任务
从这里开始：
- `examples/phase1-sample.task.md`

适合：
- 只有一个主任务
- 想先理解最小 task-doc 输入形态

### 我想跑有先后顺序的多步骤任务
使用：
- `examples/phase2-sequential.task.md`

适合：
- 后续步骤依赖前序步骤结果
- 希望一个 perspective 完成后再执行下一个

### 我想并发执行多个相互独立的 perspective
使用：
- `examples/phase2-parallel.task.md`
- `examples/phase3-bounded-parallel.task.md`

适合：
- 各 perspective 互不依赖
- 希望通过并发提升速度
- 需要 bounded concurrency 而不是无限 fan-out

### 我想在失败后保留 debug 工作区
使用：
- `examples/phase3-debug-preserve-sandbox.task.md`

适合：
- 想在执行后检查生成文件
- 需要保留 sandbox/workspace 做排查

### 我在迁移旧的 subagent 风格调用
使用：
- `examples/phase3-compat-legacy-invocation.task.md`

适合：
- 你正在从 legacy request shape 迁移
- 你需要一个 compatibility-oriented 的示例

### 我需要 dependency-aware execution
使用：
- `examples/phase4-dag.task.md`

适合：
- 某些 perspective 必须等待其他 perspective
- 你需要显式建模依赖，而不仅是 sequential / parallel

### 我希望更安全地隔离仓库级任务
使用：
- `examples/phase4-worktree-sandbox.task.md`

适合：
- 希望在 git worktree 中执行
- 希望文件输出与主 working tree 隔离

### 完整示例列表
- `examples/phase1-sample.task.md`
- `examples/phase2-sequential.task.md`
- `examples/phase2-parallel.task.md`
- `examples/phase3-bounded-parallel.task.md`
- `examples/phase3-debug-preserve-sandbox.task.md`
- `examples/phase3-compat-legacy-invocation.task.md`
- `examples/phase4-dag.task.md`
- `examples/phase4-worktree-sandbox.task.md`

---

## Compatibility

Compatibility 支持的目标是迁移，不是完整的历史 shell 模拟。

参考：
- `compatibility/README.md`
- `compatibility/MIGRATION_GUIDE.md`

当你需要把 legacy request shape 迁移到标准 executor path 上时，请使用 compatibility helpers。

---

## Runtime posture 与限制

### Executor lifecycle
Executor child lifecycle 是按 process-oriented 设计的：
- child completion 会被统一归一化为 `process-exit`
- 调用方传入的 `agent-end` 偏好在 executor run 内部会被忽略
- run 的完成取决于自然退出、idle timeout、hard timeout 和 terminate grace 行为

### Ralph / loop-style execution
更底层的 runtime stack 已经证明：当 child profile 配置正确时，Ralph 风格 loop execution 是可以运行的。

`passto-executor` 也会把 `ralph-loop` run shape 到合适的 child profile 和 process-oriented lifecycle。

但调用者仍不应假设：每一种 profile / extension / runtime 组合都已经在所有场景下完成 full parity 证明。

参考：
- `RUNTIME_LIMITATION_NOTE.md`

---

## 目录说明

- `executor-core/` — 更底层的 runtime pipeline、execution logic、orchestration、persistence 和 sandbox primitives
- `compatibility/` — legacy 风格请求适配的 migration helpers 与说明文档
- `examples/` — 示例 task documents
- `test/` — parser、execution、orchestration、sandbox、persistence、compatibility 相关测试

---

## 一句话总结

`passto-executor` 是一个 process-oriented、task-driven 的执行容器：你提供任务意图、项目上下文和目标输出，它负责装配执行环境、执行任务，并产出可供后续检查的隔离工作区和持久化 artifacts。
