# Shared Subagent Runtime 规范

## 目标

实现一个可被多个 extension 直接 import 的共享 TypeScript runtime，用于：
- 启动独立 `pi` CLI 子进程
- 解析 `--mode json` 事件流
- 统一汇总 progress / result / artifacts
- 提供 timeout / depth / cycle / tool scope guard

禁止依赖“一个 extension 直接调用另一个 extension 注册的 tool”。复用方式必须是 **runtime 级 import**，不是 **tool 名互调**。

---

## 非目标

不要让该 runtime：
- 负责业务 prompt 内容
- 提供 extension 间 tool 调用能力
- 绑定某个具体 extension 的状态结构
- 强制所有任务都持久化文件
- 直接承担全部 TUI 逻辑

---

## 强制原则

1. **只复用 runtime，不复用 tool 名。**
2. **固定协议，策略可配置。**
   - 固定：CLI builder、JSON 事件解析、artifact manifest schema
   - 可配置：tools / skills / extensions / model / thinking / URL resolver / UI render
3. **优先实现 `spawn`，再实现 `fork`。**
4. **所有 extension 必须通过统一 builder 构造 `pi` CLI 参数。**
5. **所有 extension 必须通过统一 parser 解析 `pi --mode json` 输出。**
6. **所有 extension 的子进程产物描述必须使用统一 artifact manifest schema。**
7. **所有子进程都必须有 timeout、depth guard、cycle prevention。**

---

## 目录结构

当前目录：

```txt
/Users/handy/.pi/agent/lib/passto-agent-runtime/
  index.ts
  types.ts
  cli.ts
  execution.ts
  events.ts
  progress.ts
  guards.ts
  artifacts.ts
  tui.ts
  utils.ts
```

禁止将该 runtime 放在 `~/.pi/agent/extensions/` 下，避免被 Pi 自动识别为 extension。后续若包化，可迁移为 `packages/passto-agent-runtime/`，但目录职责保持不变。

---

## 模块职责

### `types.ts`
只定义公共类型：
- `SessionMode`
- `PiChildRunOptions`
- `SubagentUsage`
- `ChildAgentEvent`
- `SubagentProgress`
- `SubagentRunResult`
- `ArtifactItem`
- `ArtifactManifest`
- `ArtifactUrlStrategy`

### `cli.ts`
只负责：
- `resolvePiInvocation()`
- `buildPiArgs(options)`
- 写入 / 清理 prompt temp file
- 写入 / 清理 fork snapshot temp file

### `execution.ts`
只负责：
- `spawn()` 子进程
- 监听 stdout / stderr
- timeout / abort / graceful shutdown / force kill
- 串联 parser、progress reducer、result collector
- 暴露 `runSubagent()`

### `events.ts`
只负责：
- 按行切分 stdout
- `JSON.parse`
- 将原始 Pi JSON 事件映射为 `ChildAgentEvent`
- 聚合 assistant / tool / usage / stopReason / error
- 对未知事件保留 raw，不中断主流程

### `progress.ts`
只负责：
- 根据 `ChildAgentEvent` 更新 `SubagentProgress`
- 维护 `currentTool` / `lastAssistantText` / `recentActivity`
- 提供 `summarizeProgress()`

### `guards.ts`
只负责：
- 默认 timeout
- depth 校验
- cycle prevention
- tool allowlist / option sanity check
- cwd/path 安全辅助

### `artifacts.ts`
只负责：
- artifact manifest schema
- manifest 写入与读取
- 按 URL strategy 生成展示链接

### `tui.ts`
只负责：
- 将 `SubagentProgress` 转为适合 `onUpdate` 的 content / details
- 不绑定具体业务 extension

### `index.ts`
只做统一导出。

---

## 核心类型

### SessionMode

```ts
type SessionMode = "spawn" | "fork";
```

### PiChildRunOptions

```ts
type PiChildRunOptions = {
  prompt: string;
  cwd: string;
  sessionMode?: SessionMode;
  forkSessionSnapshotJsonl?: string;

  model?: string;
  thinking?: "off" | "low" | "medium" | "high";

  tools?: string[];
  extensions?: string[];
  skills?: string[];

  noTools?: boolean;
  noExtensions?: boolean;
  noSkills?: boolean;
  noPromptTemplates?: boolean;
  noContextFiles?: boolean;
  offline?: boolean;
  noSession?: boolean;

  appendSystemPrompt?: string;
  extraArgs?: string[];

  timeoutMs?: number;
  maxDepth?: number;
  preventCycles?: boolean;
  parentDepth?: number;
  parentAgentStack?: string[];

  env?: Record<string, string>;
};
```

### SubagentUsage

```ts
type SubagentUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
};
```

### ChildAgentEvent

```ts
type ChildAgentEvent =
  | { type: "assistant"; text: string; raw: unknown }
  | { type: "tool_call"; toolName: string; argsPreview?: string; raw: unknown }
  | { type: "tool_result"; toolName: string; text?: string; raw: unknown }
  | { type: "usage"; usage: SubagentUsage; raw: unknown }
  | { type: "status"; stopReason?: string; errorMessage?: string; raw: unknown }
  | { type: "stderr"; text: string }
  | { type: "done"; exitCode: number };
```

### SubagentProgress

```ts
type SubagentProgress = {
  runId: string;
  phase: "starting" | "running" | "finishing" | "done" | "error";
  startedAt: number;
  updatedAt: number;
  elapsedMs: number;

  currentTool?: string;
  currentToolArgsPreview?: string;
  lastAssistantText?: string;
  recentActivity: string[];

  usage: SubagentUsage;
  stopReason?: string;
  errorMessage?: string;
  exitCode?: number;
};
```

### Artifact types

```ts
type ArtifactItem = {
  kind: string;
  path: string;
  title?: string;
  mediaType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

type ArtifactManifest = {
  runId: string;
  createdAt: string;
  producer: string;
  items: ArtifactItem[];
};

type ArtifactUrlStrategy =
  | { type: "none" }
  | { type: "file" }
  | { type: "local-server"; baseUrl: string }
  | { type: "custom"; resolve: (item: ArtifactItem) => string | undefined };
```

### SubagentRunResult

```ts
type SubagentRunResult = {
  runId: string;
  cwd: string;
  sessionMode: SessionMode;

  exitCode: number;
  success: boolean;
  stopReason?: string;
  errorMessage?: string;

  usage: SubagentUsage;
  messages: unknown[];
  stderr: string;
  rawEvents?: unknown[];

  finalOutputText: string;
  progress: SubagentProgress;

  artifacts?: ArtifactManifest;

  provenance: {
    reviewedBySubagent: boolean;
    subagentMode: SessionMode;
    transport: "pi-cli-json";
    runtimeVersion: string;
  };
};
```

---

## CLI Builder 规范

所有 extension 必须调用：

```ts
buildPiArgs(options: PiChildRunOptions): string[]
```

### 强制规则

1. 固定添加：
   - `--mode json`
   - `-p`
2. 若 `noSession !== false`，默认添加：
   - `--no-session`
3. `sessionMode === "fork"` 时必须提供 fork snapshot；缺失时直接报错。
4. `model` / `thinking` / `tools` / `skills` / `extensions` 必须统一在 builder 展开为 CLI 参数。
5. `noTools` / `noExtensions` / `noSkills` / `noPromptTemplates` / `noContextFiles` / `offline` 必须统一由 builder 转成 CLI 开关。
6. prompt 必须统一作为最终任务输入，不允许业务 extension 自己拼接 CLI 位置参数。
7. 对 runtime 暴露但 CLI 不支持的字段，builder 必须显式报错，禁止静默忽略。
8. thinking level 兼容映射必须集中维护在 builder，不允许散落在业务 extension。

---

## JSON 事件解析规范

所有 extension 必须通过共享 parser 处理 `pi --mode json` 输出。

### 强制规则

1. stdout 必须按行缓冲并解析。
2. 每个非空行都必须尝试 `JSON.parse`。
3. 已知事件必须映射为 `ChildAgentEvent`。
4. 未知事件不得中断流程，必须保留到 `rawEvents`。
5. stderr 必须单独收集，不参与 JSON 解析。
6. parser 不负责 UI。
7. parser 不依赖业务 extension 的 prompt 或状态结构。

### 禁止事项

- 禁止让每个业务 extension 自己写一套 JSON parser。
- 禁止依赖动态猜测 stdout 文本格式。

---

## 执行模型规范

共享 runtime 必须暴露：

```ts
type RunSubagentCallbacks = {
  onEvent?: (event: ChildAgentEvent) => void;
  onProgress?: (progress: SubagentProgress) => void;
};

async function runSubagent(
  options: PiChildRunOptions,
  callbacks?: RunSubagentCallbacks,
  signal?: AbortSignal,
): Promise<SubagentRunResult>
```

### 运行流程

1. 校验 options
2. 应用 guard
3. 构造 CLI args
4. 如有 `appendSystemPrompt`，写 temp file
5. 如为 `fork`，写 fork snapshot temp file
6. `spawn()` 子进程
7. 解析 stdout JSON 与 stderr
8. 根据事件更新 progress
9. 持续回调 `onEvent` / `onProgress`
10. 正常完成、超时、abort 或异常退出后统一收敛为 `SubagentRunResult`
11. 清理所有 temp 文件

---

## Guard 规范

### 必选 guard

1. **Timeout Guard**
   - 每个子进程必须有 timeout
   - 默认 10 分钟
   - 超时后先 graceful terminate，再 force kill

2. **Depth Guard**
   - 使用环境变量传递：
     - `PI_SUBAGENT_DEPTH`
     - `PI_SUBAGENT_MAX_DEPTH`
     - `PI_SUBAGENT_STACK`
     - `PI_SUBAGENT_PREVENT_CYCLES`
   - 超 depth 必须直接拒绝运行

3. **Cycle Prevention**
   - 若 stack 检测到循环，必须直接拒绝运行

4. **Tool Scope Guard**
   - 默认不要暴露全部工具
   - review / analysis 场景默认只给读工具

5. **Session Isolation Guard**
   - 高隔离场景默认建议：
     - `--no-session`
     - `--no-context-files`
     - `--offline`

### 可选 guard

- prompt budget helper，可在 prompt 中注入最大 reasoning/tool cycle 提示

---

## TUI 规范

### 原则

- runtime 统一产出 `SubagentProgress`
- 宿主 extension 决定如何渲染

### 强制规则

1. runtime 必须提供 progress snapshot。
2. runtime 可提供 `summarizeProgress()` 与 `renderProgressContent()` helper。
3. runtime 不得硬绑定某个 extension 的 UI 组件。
4. 业务 extension 不得修改底层 progress schema。

### 结论

- **状态协议固定**
- **UI 渲染可定制**

禁止使用“完全动态识别 UI”的方案。

---

## Artifact 规范

所有子进程产物必须使用统一 manifest：

```json
{
  "runId": "review-abc123",
  "createdAt": "2026-04-24T10:00:00.000Z",
  "producer": "extension-maker",
  "items": [
    {
      "kind": "review-json",
      "path": "/abs/path/review.json",
      "title": "Review Result",
      "mediaType": "application/json"
    }
  ]
}
```

### 强制规则

1. manifest schema 固定。
2. URL 不直接硬编码在 manifest 中。
3. URL 必须通过 `ArtifactUrlStrategy` 生成。
4. 不同 extension 必须复用同一 artifact schema。
5. 若无产物，可不生成 manifest；若生成，则必须合法。

### 结论

- **manifest 固定**
- **URL strategy 可配置**

禁止让每个 extension 自己拼接一套不兼容的 URL / path 输出格式。

---

## 与现有 `pi-subagent` 的关系

### 强制迁移方向

1. 先从现有 `pi-subagent/runner.ts` 提取通用执行逻辑到共享 runtime。
2. 保留原 `subagent` extension，但它只能作为共享 runtime 的一个消费方。
3. 不允许未来继续在多个 extension 中重复维护各自的 `spawn + parse + timeout` 实现。

---

## 对 `extension-maker` 的接入要求

Step 6 必须直接 import 共享 runtime，不再依赖 request + steer + gate 诱导主进程调用外部 `subagent` tool。

### 接入流程

1. 读取 review 所需输入：
   - spec
   - implementation-method.json
   - review-rules.md
   - 官方 docs 摘要
2. 构建 review prompt
3. 调用 `runSubagent()`，使用 `spawn`
4. 接收 progress 并更新 tool onUpdate
5. 取得 `SubagentRunResult`
6. 写入 `review.json`
7. 可选写入 `artifacts.json`
8. Step gate 只检查：
   - `review.json`
   - `verdict`
   - provenance

### 推荐默认参数

```ts
{
  sessionMode: "spawn",
  tools: ["read", "bash"],
  noSession: true,
  noContextFiles: true,
  offline: true,
  timeoutMs: 600_000,
  maxDepth: 1,
  preventCycles: true,
}
```

---

## 实施顺序

### Phase 1
先实现：
- `types.ts`
- `cli.ts`

### Phase 2
再实现：
- `events.ts`
- `progress.ts`
- `execution.ts`

要求：先跑通 `spawn`。

### Phase 3
再实现：
- `guards.ts`
- `artifacts.ts`
- `tui.ts`

### Phase 4
让 `pi-subagent` 改为使用共享 runtime。

### Phase 5
让 `extension-maker` Step 6 接入共享 runtime。

### Phase 6
补测试，至少覆盖：
- spawn 成功
- fork 缺少 snapshot 报错
- timeout 终止
- abort 终止
- depth/cycle guard
- parser 对未知事件兼容
- artifact manifest 生成

---

## 最终决策

1. 共享 subagent 能力必须以 **TypeScript runtime** 形式复用。
2. 独立执行必须通过新的 `pi` CLI 子进程实现。
3. stdio / JSON 捕获必须通过统一 parser 实现，不做动态猜测。
4. TUI 必须统一 progress schema，但允许宿主自定义 render。
5. 持久化输出必须统一为 artifact manifest，URL 通过 strategy 生成。
6. `extension-maker` Step 6 必须迁移到该 runtime，才能获得真正独立的审查机制。
