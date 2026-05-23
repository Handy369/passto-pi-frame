# GitHub Pull Request 操作

> **last_verified: 2025-04-06**

## 核心功能

完整的 Pull Request 操作能力：列表、查看详情、创建、合并、评论。

## 工具清单

| 工具 | 功能 | 权限需求 |
|------|------|---------|
| `listPullRequests` | 列出 PR，可按状态过滤 | PR: Read |
| `getPullRequest` | 获取 PR 完整详情（diff、body、合并状态） | PR: Read |
| `createPullRequest` | 创建新 PR | PR: Write |
| `mergePullRequest` | 合并 PR（merge/squash/rebase） | PR: Write |
| `addPullRequestComment` | 在 PR 下发表评论 | PR: Write |

## 使用方式

### 列出 PR

```typescript
import { listPullRequests } from '@github-tools/sdk'

const prs = await listPullRequests(token)({
  owner: 'vercel',
  repo: 'ai',
  state: 'open', // 'open' | 'closed' | 'all'
})
```

### 获取 PR 详情

```typescript
import { getPullRequest } from '@github-tools/sdk'

const pr = await getPullRequest(token)({
  owner: 'vercel',
  repo: 'ai',
  prNumber: 42,
})
// 返回: diff stats, body, merge status, reviewers, commits
```

### 创建 PR

```typescript
import { createPullRequest } from '@github-tools/sdk'

const newPr = await createPullRequest(token)({
  owner: 'vercel',
  repo: 'ai',
  title: 'feat: add new feature',
  body: '## What\n\nThis PR adds...',
  head: 'feature-branch',
  base: 'main',
})
```

### 合并 PR

```typescript
import { mergePullRequest } from '@github-tools/sdk'

await mergePullRequest(token)({
  owner: 'vercel',
  repo: 'ai',
  prNumber: 42,
  mergeMethod: 'squash', // 'merge' | 'squash' | 'rebase'
  commitTitle: 'feat: add new feature (#42)',
})
```

### 发表评论

```typescript
import { addPullRequestComment } from '@github-tools/sdk'

await addPullRequestComment(token)({
  owner: 'vercel',
  repo: 'ai',
  prNumber: 42,
  body: 'LGTM! Great work on this feature.',
})
```

## 代码审查工作流

### 完整审查流程

```
1. listPullRequests → 列出 open PRs
2. getPullRequest → 获取 PR 详情
3. listCommits → 查看提交历史
4. getFileContent → 查看变更文件
5. addPullRequestComment → 添加审查意见
```

### 审查要点

- **功能性**：代码逻辑是否正确实现需求
- **安全性**：是否有安全漏洞、敏感信息泄露
- **性能**：是否有性能问题
- **可维护性**：代码结构、命名、注释
- **测试**：是否有足够的测试覆盖

## Preset: code-review

```typescript
import { createGithubAgent } from '@github-tools/sdk'

const reviewer = createGithubAgent({
  model: 'anthropic/claude-sonnet-4-20250514',
  token: process.env.GITHUB_TOKEN!,
  preset: 'code-review',
})

const result = await reviewer.generate({
  prompt: 'Review PR #42 on vercel/ai and summarize the changes',
})
```

## 注意事项

- 创建 PR 前确认 head 分支存在
- 合并前检查 PR 状态（无冲突、可合并）
- 评论使用 Markdown 格式更清晰
- 敏感操作需要用户确认

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器 |
| [references/github-repo.md](github-repo.md) | 仓库操作、文件读写 |
| [references/github-workflow.md](github-workflow.md) | CI/CD 相关 |
| [references/vercel-deploy.md](vercel-deploy.md) | 部署相关 |
