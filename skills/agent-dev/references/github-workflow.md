# GitHub Workflow / Actions 操作

> **last_verified: 2025-04-06**

## 核心功能

GitHub Actions Workflow 管理：列表、触发、检查状态、重试、取消。

## 工具清单

| 工具 | 功能 | 权限需求 |
|------|------|---------|
| `listWorkflows` | 列出仓库中的所有 Workflow | Actions: Read |
| `listWorkflowRuns` | 列出 Workflow 运行记录 | Actions: Read |
| `getWorkflowRun` | 获取运行详情（状态、耗时、触发者） | Actions: Read |
| `listWorkflowJobs` | 列出运行中的 Jobs 及步骤状态 | Actions: Read |
| `triggerWorkflow` | 触发 workflow_dispatch 事件 | Actions: Write |
| `cancelWorkflowRun` | 取消正在运行的 Workflow | Actions: Write |
| `rerunWorkflowRun` | 重新运行（全部或仅失败的 Job） | Actions: Write |

## 使用方式

### 列出 Workflows

```typescript
import { listWorkflows } from '@github-tools/sdk'

const workflows = await listWorkflows(token)({
  owner: 'vercel',
  repo: 'ai',
})
// 返回: id, name, path, state, created_at
```

### 列出运行记录

```typescript
import { listWorkflowRuns } from '@github-tools/sdk'

const runs = await listWorkflowRuns(token)({
  owner: 'vercel',
  repo: 'ai',
  workflowId: 'ci.yml', // 或 workflow ID
  branch: 'main', // 可选，按分支过滤
  status: 'completed', // 可选: queued, in_progress, completed
  event: 'push', // 可选: push, pull_request, workflow_dispatch
})
```

### 获取运行详情

```typescript
import { getWorkflowRun } from '@github-tools/sdk'

const run = await getWorkflowRun(token)({
  owner: 'vercel',
  repo: 'ai',
  runId: 12345678,
})
// 返回: status, conclusion, duration, triggered_by, commit
```

### 列出 Jobs 和步骤

```typescript
import { listWorkflowJobs } from '@github-tools/sdk'

const jobs = await listWorkflowJobs(token)({
  owner: 'vercel',
  repo: 'ai',
  runId: 12345678,
})
// 返回: 每个 job 的 name, status, conclusion, steps
```

### 触发 Workflow

```typescript
import { triggerWorkflow } from '@github-tools/sdk'

await triggerWorkflow(token)({
  owner: 'vercel',
  repo: 'ai',
  workflowFileName: 'deploy.yml',
  ref: 'main', // 分支/tag
  inputs: {
    environment: 'preview',
    version: '1.0.0',
  }, // 可选，workflow_dispatch 的输入参数
})
```

### 取消运行

```typescript
import { cancelWorkflowRun } from '@github-tools/sdk'

await cancelWorkflowRun(token)({
  owner: 'vercel',
  repo: 'ai',
  runId: 12345678,
})
```

### 重新运行

```typescript
import { rerunWorkflowRun } from '@github-tools/sdk'

// 重新运行全部 Jobs
await rerunWorkflowRun(token)({
  owner: 'vercel',
  repo: 'ai',
  runId: 12345678,
})

// 仅重新运行失败的 Jobs
await rerunWorkflowRun(token)({
  owner: 'vercel',
  repo: 'ai',
  runId: 12345678,
  enableJobs: false, // 默认为 false，仅运行失败的 job
})
```

## Preset: ci-ops

```typescript
import { createGithubAgent } from '@github-tools/sdk'

const ciOps = createGithubAgent({
  model: 'anthropic/claude-sonnet-4-20250514',
  token: process.env.GITHUB_TOKEN!,
  preset: 'ci-ops',
})

const result = await ciOps.generate({
  prompt: 'Check the latest CI run on vercel/ai and fix any failures.',
})
```

## 常见 Workflow 触发

| Event | 触发条件 |
|-------|---------|
| `push` | 分支推送 |
| `pull_request` | PR 打开/更新 |
| `workflow_dispatch` | 手动触发（需要定义 inputs） |
| `schedule` | Cron 定时 |
| `repository_dispatch` | API 触发 |

## 注意事项

- `workflow_dispatch` 需要在 workflow 文件中定义 `inputs`
- 取消正在运行的 workflow 后，可能需要几分钟状态更新
- 重新运行会使用相同的触发事件和输入
- Actions 权限需要仓库管理员或特定 Actions 权限

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器 |
| [references/github-repo.md](github-repo.md) | 仓库操作 |
| [references/vercel-deploy.md](vercel-deploy.md) | Vercel 部署 |
