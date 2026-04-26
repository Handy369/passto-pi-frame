# passto-agent-runtime 使用规范

## 入口

统一从以下入口 import：

```ts
import {
  runSubagent,
  renderProgressUpdate,
  renderFinalResult,
  createArtifactManifest,
  addArtifactItem,
  writeArtifactManifest,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";
```

禁止直接依赖内部文件路径（如 `./execution.ts`、`./progress.ts`），避免未来内部重构破坏调用方。

---

## 核心能力

### 必用函数
- `runSubagent(options, callbacks?, signal?)`

### 常用 UI helper
- `renderProgressUpdate(progress)`
- `renderFinalResult(result)`

### 常用 artifact helper
- `createArtifactManifest(runId, producer, items?)`
- `addArtifactItem(manifest, item)`
- `writeArtifactManifest(path, manifest)`
- `resolveArtifactLinks(manifest, strategy)`

---

## `runSubagent()`

```ts
const result = await runSubagent(options, callbacks, signal);
```

### 参数

#### `options: PiChildRunOptions`
必须提供：

```ts
{
  prompt: string;
  cwd: string;
}
```

常用可选字段：

```ts
{
  agent?: string;
  sessionMode?: "spawn" | "fork";
  forkSessionSnapshotJsonl?: string;

  model?: string;
  thinking?: string;

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
  completionPolicy?: "agent-end" | "process-exit";
  idleTimeoutMs?: number;
  terminateGraceMs?: number;
  maxDepth?: number;
  preventCycles?: boolean;
  parentDepth?: number;
  parentAgentStack?: string[];

  env?: Record<string, string>;
}
```

#### `callbacks?: RunSubagentCallbacks`

```ts
{
  onEvent?: (event) => void;
  onProgress?: (progress) => void;
}
```

#### `signal?: AbortSignal`
用于取消子进程。

---

## 最小调用示例

```ts
const result = await runSubagent(
  {
    prompt: "Read the target files and return a strict JSON summary.",
    cwd: targetDir,
    sessionMode: "spawn",
    tools: ["read", "bash"],
    noSession: true,
    noContextFiles: true,
    offline: true,
    timeoutMs: 600_000,
    maxDepth: 1,
    preventCycles: true,
  },
  {
    onProgress(progress) {
      onUpdate?.(renderProgressUpdate(progress));
    },
  },
  signal,
);
```

---

## Agent Profile 用法

若 `agents/*.md` 已定义 profile，可直接传：

```ts
const result = await runSubagent({
  agent: "reviewer",
  prompt: reviewPrompt,
  cwd: targetDir,
});
```

含义：
- `agent: "reviewer"` 会加载 `agents/reviewer.md`
- frontmatter 中的 `model / thinking / tools / sessionMode / timeoutMs / completionPolicy / idleTimeoutMs / terminateGraceMs / maxDepth` 会作为默认值
- 若调用方显式再传 `model / tools / timeoutMs` 等，则调用方参数优先
- agent 正文会作为基础 `systemPrompt`
- `appendSystemPrompt` 会追加在 agent 正文后面，而不是覆盖它

推荐：
- review 场景优先用 `agent: "reviewer"`
- 通用场景可用 `agent: "default"`
- Ralph loop 场景可用 `agent: "ralph-executor"`

说明：若未显式传 `completionPolicy / idleTimeoutMs / terminateGraceMs`，runtime 会先读取 `agent/lib/passto-agent-runtime/config.json` 的 `subagent.defaults`，只有在配置缺失时才使用极小技术 fallback。

### `completionPolicy` 说明

#### `agent-end`
- 在 runtime 观察到 `agent_end` 后尽快收尾
- 适合很短的一次性 child task
- 不等待 `agent_end` 之后的更晚输出

#### `process-exit`
- 不把 `agent_end` 当作进程结束条件
- 等待 child process 自然退出
- 配合 `idleTimeoutMs` 与 `timeoutMs` 一起使用
- 更适合多阶段、可继续推进、或可能在 `agent_end` 后仍有输出的 child

### 何时推荐 `process-exit`

优先推荐 `process-exit` 用于：
- 长耗时子任务
- 可能在一个 child process 中推进多轮的任务
- `ralph-loop` 这类 continuation / loop 风格执行
- 想要更接近 Paperclip 单次 run 生命周期模型的场景

只有在以下场景更适合 `agent-end`：
- 很短的一次性 child task
- 已确认 `agent_end` 就是你想要的唯一完成边界
- 为兼容旧行为而临时保留

### Contract config 放置位置

通用 lifecycle 默认值放在：
- `agent/lib/passto-agent-runtime/config.json`
- path: `subagent.defaults`

contract-specific lifecycle 默认值放在：
- `agent/lib/passto-agent-runtime/config.json`
- path: `subagent.contracts.<contractName>`

例如 `ralph-loop`：
- `subagent.contracts["ralph-loop"]`

示例：

```json
{
  "subagent": {
    "defaults": {
      "completionPolicy": "process-exit",
      "idleTimeoutMs": 15000,
      "terminateGraceMs": 5000
    },
    "contracts": {
      "ralph-loop": {
        "completionPolicy": "process-exit",
        "idleTimeoutMs": 60000,
        "terminateGraceMs": 10000
      }
    }
  }
}
```

---

## 推荐使用模式

### 模式 A：隔离审查 / review
用于：
- 代码审查
- 生成审计
- spec / implementation contract 一致性校验

推荐参数：

```ts
{
  agent: "reviewer",
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

要求：
- prompt 必须要求返回严格 JSON
- 宿主 extension 负责解析 JSON 并写入目标产物（如 `review.json`）

---

### 模式 B：只读研究 / research
用于：
- 本地代码调研
- 文档对照
- 资料汇总

推荐参数：

```ts
{
  sessionMode: "spawn",
  tools: ["read", "bash", "web_search"],
  noSession: true,
  noContextFiles: true,
  timeoutMs: 600_000,
  maxDepth: 1,
  preventCycles: true,
}
```

要求：
- 默认不要给 `edit` / `write`
- prompt 必须要求引用来源或文件路径

---

### 模式 C：fork 继续上下文
用于：
- 继承父会话快照继续深入分析
- 多轮 follow-up 子任务

推荐参数：

```ts
{
  sessionMode: "fork",
  forkSessionSnapshotJsonl: snapshot,
  tools: ["read", "bash"],
  timeoutMs: 600_000,
  maxDepth: 2,
  preventCycles: true,
}
```

要求：
- `sessionMode: "fork"` 时必须传 `forkSessionSnapshotJsonl`
- 若缺失 snapshot，runtime 会直接报错

---

## 如何获得运行状态

### 实时状态
通过 `callbacks.onProgress(progress)` 获取。

`progress` 结构包含：

```ts
{
  runId,
  phase,
  elapsedMs,
  currentTool,
  currentToolArgsPreview,
  lastAssistantText,
  recentActivity,
  usage,
  stopReason,
  errorMessage,
  exitCode,
}
```

### 最终状态
通过返回值 `result.progress` 获取最终快照。

---

## 如何在 TUI 中渲染

### 标准接法：tool streaming

```ts
const result = await runSubagent(
  options,
  {
    onProgress(progress) {
      onUpdate?.(renderProgressUpdate(progress));
    },
  },
  signal,
);
```

### 标准接法：最终返回

```ts
return renderFinalResult(result);
```

### 规则
- runtime 提供标准 progress schema
- 宿主 extension 决定是否直接使用 helper
- 宿主 extension 也可读取 `progress` 自己渲染更复杂的 UI

禁止宿主 extension 修改 progress schema。

---

## 返回结果

`runSubagent()` 返回：

```ts
{
  runId,
  cwd,
  sessionMode,
  exitCode,
  success,
  stopReason,
  errorMessage,
  usage,
  messages,
  stderr,
  rawEvents,
  finalOutputText,
  progress,
  artifacts,
  provenance,
}
```

### 最常用字段
- `result.success`
- `result.finalOutputText`
- `result.errorMessage`
- `result.stderr`
- `result.usage`
- `result.provenance`

### `finalOutputText`
表示最后一个 assistant 文本输出。若子进程 prompt 要求返回 strict JSON，调用方通常应：

```ts
const data = JSON.parse(result.finalOutputText);
```

若解析失败，调用方必须自行降级处理，不要假设 runtime 自动理解业务 JSON 结构。

---

## Artifact 用法

### 创建 manifest

```ts
const manifest = createArtifactManifest(result.runId, "extension-maker");
addArtifactItem(manifest, {
  kind: "review-json",
  path: reviewPath,
  title: "Review Result",
  mediaType: "application/json",
});
writeArtifactManifest(artifactsPath, manifest);
```

### 生成 URL

```ts
const links = resolveArtifactLinks(manifest, { type: "file" });
```

### 规则
- artifact schema 统一
- URL 通过 strategy 生成
- 不要让每个 extension 自己拼接不兼容的 URL 格式

---

## Guard 行为

runtime 默认提供并执行：
- timeout
- depth guard
- cycle prevention
- fork 必需参数校验
- `tools` / `noTools` 冲突校验
- cwd 校验

### 调用方必须知道
- `maxDepth` 太小会直接拒绝运行
- `preventCycles: true` 时，重复 stack 会直接报错
- `timeoutMs` 超时后会终止子进程

---

## 错误处理要求

调用方必须处理以下情况：

### 1. runtime 抛错
例如：
- 缺少 `cwd`
- fork 无 snapshot
- depth exceeded
- cycle detected

标准处理：
- catch 错误
- 返回可读错误信息
- 不要假设子进程一定能启动

### 2. 子进程执行失败
例如：
- `result.success === false`
- `result.exitCode !== 0`
- `result.stopReason === "error"`
- `result.stopReason === "aborted"`

标准处理：
- 检查 `errorMessage`
- 检查 `stderr`
- 检查 `finalOutputText`

### 3. 业务 JSON 解析失败
例如：

```ts
let data;
try {
  data = JSON.parse(result.finalOutputText);
} catch {
  data = fallbackFailureObject;
}
```

禁止将业务 JSON 解析失败视为 runtime bug；这通常是 prompt 或子进程输出不满足约束。

---

## 对调用方的强制要求

1. 只从 `index.ts` import。
2. 优先使用 `agent: "reviewer"`（review）或 `agent: "default"`（通用），只有明确需要覆盖时才手写完整参数。
3. 优先使用 `spawn`，只有明确需要继承上下文时才用 `fork`。
4. review / analysis 默认只给读工具。
5. prompt 必须明确输出格式，尤其是要求 strict JSON 时。
6. 需要 streaming UI 时，使用 `onProgress + renderProgressUpdate`。
7. 需要统一最终结果展示时，使用 `renderFinalResult`。
8. 需要持久化产物时，使用统一 artifact manifest。
9. 不要在宿主 extension 内重复实现 `spawn + parse + timeout` 逻辑。

---

## 推荐模板：review 场景

```ts
try {
  const result = await runSubagent(
    {
      prompt: reviewPrompt,
      cwd: targetDir,
      sessionMode: "spawn",
      tools: ["read", "bash"],
      noSession: true,
      noContextFiles: true,
      offline: true,
      timeoutMs: 600_000,
      maxDepth: 1,
      preventCycles: true,
    },
    {
      onProgress(progress) {
        onUpdate?.(renderProgressUpdate(progress));
      },
    },
    signal,
  );

  let review;
  try {
    review = JSON.parse(result.finalOutputText);
  } catch {
    review = {
      verdict: "fail",
      findings: ["Subagent did not return valid JSON."],
      criticalIssues: [result.finalOutputText || result.errorMessage || result.stderr],
      suggestedFixes: ["Fix the subagent prompt so it returns strict JSON."],
    };
  }

  review.reviewedBySubagent = true;
  review.subagentMode = "spawn";
  review.provenance = result.provenance;

  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf-8");
  return renderFinalResult({ ...result, finalOutputText: `✅ Review written to ${reviewPath}` });
} catch (error) {
  return {
    content: [{ type: "text", text: `❌ Isolated review failed: ${error instanceof Error ? error.message : String(error)}` }],
    details: { shouldContinue: false },
  };
}
```

---

## 当前适用范围

当前 runtime 已适用于：
- isolated review
- read-only research
- fork continuation
- progress streaming
- artifact manifest persistence

若未来新增能力，必须优先扩展 `index.ts` 导出与本文件，而不是让调用方直接依赖内部实现细节。
