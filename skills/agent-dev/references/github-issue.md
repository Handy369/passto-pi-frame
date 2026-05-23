# GitHub Issue 操作

> **last_verified: 2025-04-06**

## 核心功能

完整的 Issue 管理能力：列表、查看详情、创建、评论、关闭。

## 工具清单

| 工具 | 功能 | 权限需求 |
|------|------|---------|
| `listIssues` | 列出 Issue，可按状态/标签过滤 | Issues: Read |
| `getIssue` | 获取 Issue 完整详情 | Issues: Read |
| `createIssue` | 创建新 Issue | Issues: Write |
| `addIssueComment` | 在 Issue 下发表评论 | Issues: Write |
| `closeIssue` | 关闭 Issue（completed/not_planned） | Issues: Write |

## 使用方式

### 列出 Issue

```typescript
import { listIssues } from '@github-tools/sdk'

const issues = await listIssues(token)({
  owner: 'vercel',
  repo: 'ai',
  state: 'open', // 'open' | 'closed' | 'all'
  labels: 'bug,high-priority', // 逗号分隔
})
```

### 获取 Issue 详情

```typescript
import { getIssue } from '@github-tools/sdk'

const issue = await getIssue(token)({
  owner: 'vercel',
  repo: 'ai',
  issueNumber: 42,
})
// 返回: title, body, labels, assignees, comments, state
```

### 创建 Issue

```typescript
import { createIssue } from '@github-tools/sdk'

const newIssue = await createIssue(token)({
  owner: 'vercel',
  repo: 'ai',
  title: 'Bug: Something is broken',
  body: '## Description\n\nWhen I do X, Y happens...\n\n## Steps to reproduce\n\n1. Go to...\n2. Click on...',
  labels: ['bug'],
  assignees: ['username'],
})
```

### 发表评论

```typescript
import { addIssueComment } from '@github-tools/sdk'

await addIssueComment(token)({
  owner: 'vercel',
  repo: 'ai',
  issueNumber: 42,
  body: 'Thanks for reporting! I will look into this.',
})
```

### 关闭 Issue

```typescript
import { closeIssue } from '@github-tools/sdk'

// 标记为已完成
await closeIssue(token)({
  owner: 'vercel',
  repo: 'ai',
  issueNumber: 42,
  stateReason: 'completed',
})

// 标记为不会修复
await closeIssue(token)({
  owner: 'vercel',
  repo: 'ai',
  issueNumber: 42,
  stateReason: 'not_planned',
})
```

## Issue 分类工作流 (issue-triage)

```typescript
import { createGithubAgent } from '@github-tools/sdk'

const triager = createGithubAgent({
  model: 'anthropic/claude-sonnet-4-20250514',
  token: process.env.GITHUB_TOKEN!,
  preset: 'issue-triage',
  additionalInstructions: 'Focus on bug reports. Label them appropriately.',
})

const result = await triager.generate({
  prompt: 'Triage new issues on vercel/ai, add labels and summarize.',
})
```

## Issue 模板

### Bug Report

```markdown
## Description
[Clear description of the bug]

## Steps to Reproduce
1.
2.
3.

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Environment
- Package version:
- Node version:
- OS:
```

### Feature Request

```markdown
## Problem
[Problem being solved]

## Proposed Solution
[Your solution]

## Alternatives Considered
[Alternative approaches]
```

## 注意事项

- 创建 Issue 前检查是否已有重复
- 使用标签分类 Issue
- 评论保持建设性
- 关闭 Issue 提供原因

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器 |
| [references/github-pr.md](github-pr.md) | PR 操作 |
| [references/github-search.md](github-search.md) | 搜索已有 Issue |
