# passto-agent-runtime 示例

## 规则

所有示例都必须只从统一入口 import：

```ts
import {
  runSubagent,
  renderProgressUpdate,
  renderFinalResult,
  createArtifactManifest,
  addArtifactItem,
  writeArtifactManifest,
  resolveArtifactLinks,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";
```

不要从内部文件直接 import。

---

## 示例 1：在 extension tool 中执行 isolated review

适用场景：
- 生成代码后执行独立审查
- 输出严格 JSON
- 将 review 结果写入 `review.json`
- 在 TUI 中实时显示 subagent 运行状态

```ts
import * as fs from "node:fs";
import * as path from "node:path";
import {
  runSubagent,
  renderProgressUpdate,
  renderFinalResult,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";

async function runIsolatedReview(params: {
  targetDir: string;
  reviewPrompt: string;
  reviewPath: string;
}, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined) {
  try {
    const result = await runSubagent(
      {
        agent: "reviewer",
        prompt: params.reviewPrompt,
        cwd: params.targetDir,
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

    let review: any;
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
    review.runtime = {
      runId: result.runId,
      success: result.success,
      exitCode: result.exitCode,
      stopReason: result.stopReason,
      errorMessage: result.errorMessage,
      usage: result.usage,
    };

    fs.writeFileSync(params.reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf-8");

    return renderFinalResult({
      ...result,
      finalOutputText: `✅ Review written to ${params.reviewPath}`,
    });
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Isolated review failed: ${error instanceof Error ? error.message : String(error)}` }],
      details: { shouldContinue: false },
    };
  }
}
```

---

## 示例 1.5：直接使用 `agent: "reviewer"` 的最小 review 调用

适用场景：
- 已有 `agents/reviewer.md`
- 不想每次重复传 model / tools / timeout / maxDepth

```ts
import {
  runSubagent,
  renderProgressUpdate,
  renderFinalResult,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";

async function runReviewWithProfile(args: {
  cwd: string;
  prompt: string;
}, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined) {
  const result = await runSubagent(
    {
      agent: "reviewer",
      prompt: args.prompt,
      cwd: args.cwd,
    },
    {
      onProgress(progress) {
        onUpdate?.(renderProgressUpdate(progress));
      },
    },
    signal,
  );

  return renderFinalResult(result);
}
```

说明：
- `agent: "reviewer"` 会加载 `agents/reviewer.md`
- frontmatter 中的 model / thinking / tools / sessionMode / timeoutMs / maxDepth 会作为默认值
- 调用方若显式传这些字段，则调用方优先

---

## 示例 1.6：直接使用 `agent: "experimenter"` 执行实验 brief

适用场景：
- 已有 `agents/experimenter.md`
- 父 agent 已在 `program.md` 中写好 experiment brief 或可直接传入自包含 brief
- 希望 child 在固定 edit surface 内执行实验并回收结果

```ts
import {
  runSubagent,
  renderProgressUpdate,
  renderFinalResult,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";

async function runExperimentBrief(args: {
  cwd: string;
  prompt: string;
}, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined) {
  const result = await runSubagent(
    {
      agent: "experimenter",
      prompt: args.prompt,
      cwd: args.cwd,
    },
    {
      onProgress(progress) {
        onUpdate?.(renderProgressUpdate(progress));
      },
    },
    signal,
  );

  return renderFinalResult(result);
}
```

说明：
- `agent: "experimenter"` 会加载 `agents/experimenter.md`
- 适合 benchmark / routing / A/B / 消融实验这类“先有 brief，再受控执行”的 child task
- 建议父 agent 先在 `program.md` 中维护 `Delegated Execution Contract` 与 `Subagent execution brief template`

---

## 示例 2：只读 research 子任务

适用场景：
- 读取本地代码与文档
- 可选 web 搜索
- 汇总为 markdown 或 JSON

```ts
import {
  runSubagent,
  renderProgressUpdate,
  renderFinalResult,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";

async function runResearchTask(args: {
  cwd: string;
  prompt: string;
}, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined) {
  const result = await runSubagent(
    {
      prompt: args.prompt,
      cwd: args.cwd,
      sessionMode: "spawn",
      tools: ["read", "bash", "web_search"],
      noSession: true,
      noContextFiles: true,
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

  return renderFinalResult(result);
}
```

---

## 示例 3：fork 模式继续父会话上下文

适用场景：
- 已有父会话快照
- 子任务需要继承该上下文继续分析

```ts
import {
  runSubagent,
  renderProgressUpdate,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";

async function runForkContinuation(args: {
  cwd: string;
  prompt: string;
  forkSessionSnapshotJsonl: string;
}, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined) {
  return runSubagent(
    {
      prompt: args.prompt,
      cwd: args.cwd,
      sessionMode: "fork",
      forkSessionSnapshotJsonl: args.forkSessionSnapshotJsonl,
      tools: ["read", "bash"],
      timeoutMs: 600_000,
      maxDepth: 2,
      preventCycles: true,
    },
    {
      onProgress(progress) {
        onUpdate?.(renderProgressUpdate(progress));
      },
    },
    signal,
  );
}
```

要求：
- `forkSessionSnapshotJsonl` 必传
- `sessionMode: "fork"` 时缺失 snapshot 会直接抛错

---

## 示例 4：生成 artifact manifest

适用场景：
- 子任务写出 `review.json`
- 希望同时写一份统一产物清单

```ts
import {
  createArtifactManifest,
  addArtifactItem,
  writeArtifactManifest,
  resolveArtifactLinks,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";

function writeArtifacts(runId: string, targetDir: string, reviewPath: string) {
  const manifest = createArtifactManifest(runId, "extension-maker");

  addArtifactItem(manifest, {
    kind: "review-json",
    path: reviewPath,
    title: "Review Result",
    mediaType: "application/json",
  });

  const artifactsPath = `${targetDir}/artifacts.json`;
  writeArtifactManifest(artifactsPath, manifest);

  const links = resolveArtifactLinks(manifest, { type: "file" });
  return { artifactsPath, links };
}
```

---

## 示例 5：在 extension tool 中组合最小完整返回

适用场景：
- 宿主 extension 希望直接返回标准 tool result

```ts
import {
  runSubagent,
  renderProgressUpdate,
  renderFinalResult,
} from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";

async function executeTool(_id: string, params: { cwd: string; prompt: string }, signal: AbortSignal | undefined, onUpdate: ((partial: any) => void) | undefined) {
  try {
    const result = await runSubagent(
      {
        prompt: params.prompt,
        cwd: params.cwd,
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

    return renderFinalResult(result);
  } catch (error) {
    return {
      content: [{ type: "text", text: `❌ Subagent failed: ${error instanceof Error ? error.message : String(error)}` }],
      details: { shouldContinue: false },
    };
  }
}
```

---

## 示例 6：extension-maker Step 6 的推荐模式

目标：
- 读取 spec / implementation-method / generated code / 官方 docs
- 要求 isolated reviewer 返回 strict JSON
- 自动写入 `review.json`
- 若解析失败，自动降级为 fail

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

推荐处理流程：

```ts
const result = await runSubagent(...);

let review;
try {
  review = JSON.parse(result.finalOutputText);
} catch {
  review = {
    verdict: "fail",
    findings: ["Subagent did not return valid JSON."],
    criticalIssues: [result.finalOutputText || result.errorMessage || result.stderr],
    suggestedFixes: ["Fix the review prompt so it returns strict JSON."],
  };
}

review.reviewedBySubagent = true;
review.subagentMode = "spawn";
review.provenance = result.provenance;
fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf-8");
```

---

## 禁止模式

### 禁止 1：重复实现自己的 spawn + parse 逻辑
不要在宿主 extension 里再写一套：
- `spawn("pi", ...)`
- stdout JSON line parser
- timeout kill
- progress reducer

这些必须统一复用 shared runtime。

### 禁止 2：直接 import 内部文件
不要这样写：

```ts
import { runSubagent } from "/Users/handy/.pi/agent/lib/passto-agent-runtime/execution.ts";
```

必须这样写：

```ts
import { runSubagent } from "/Users/handy/.pi/agent/lib/passto-agent-runtime/index.ts";
```

### 禁止 3：默认给写工具
review / analysis / research 场景不要默认给：
- `edit`
- `write`

除非任务确实需要。

### 禁止 4：假设业务 JSON 一定合法
当 prompt 要求返回 strict JSON 时，调用方仍必须做：

```ts
try {
  JSON.parse(result.finalOutputText);
} catch {
  // fallback
}
```

---

## 最短可复制模板

```ts
const result = await runSubagent(
  {
    prompt,
    cwd,
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

return renderFinalResult(result);
```
