# GitHub 仓库操作

> **last_verified: 2025-04-06**

## 核心功能

仓库元数据获取、文件读写、分支管理、提交历史查看。

## 工具清单

| 工具 | 功能 | 权限需求 |
|------|------|---------|
| `getRepository` | 获取仓库元数据（stars、language、默认分支等） | Contents: Read |
| `listBranches` | 列出所有分支 | Contents: Read |
| `getFileContent` | 读取文件或目录列表 | Contents: Read |
| `createOrUpdateFile` | 创建或更新文件并提交 | Contents: Write |
| `listCommits` | 列出提交历史 | Contents: Read |
| `getCommit` | 获取提交详情（变更文件、diff） | Contents: Read |
| `getBlame` | 获取文件每行的最后修改提交 | Contents: Read |

## 使用方式

### 获取仓库信息

```typescript
import { getRepository } from '@github-tools/sdk'

const repo = await getRepository(token)({
  owner: 'vercel',
  repo: 'ai',
})
// 返回: stars, language, defaultBranch, description, topics, etc.
```

### 列出分支

```typescript
import { listBranches } from '@github-tools/sdk'

const branches = await listBranches(token)({
  owner: 'vercel',
  repo: 'ai',
})
```

### 读取文件内容

```typescript
import { getFileContent } from '@github-tools/sdk'

// 读取文件
const file = await getFileContent(token)({
  owner: 'vercel',
  repo: 'ai',
  path: 'README.md',
  ref: 'main', // 分支名，默认为 default branch
})

// 读取目录
const dir = await getFileContent(token)({
  owner: 'vercel',
  repo: 'ai',
  path: 'src', // 目录路径
})
// 返回: 文件列表（每个包含 name, type, sha, size）
```

### 创建/更新文件

```typescript
import { createOrUpdateFile } from '@github-tools/sdk'

// 创建新文件
await createOrUpdateFile(token)({
  owner: 'vercel',
  repo: 'ai',
  path: 'docs/new-feature.md',
  content: '# New Feature\n\nDescription...',
  message: 'docs: add new feature documentation',
  branch: 'main',
})

// 更新文件
await createOrUpdateFile(token)({
  owner: 'vercel',
  repo: 'ai',
  path: 'README.md',
  content: 'Updated content',
  message: 'docs: update README',
  sha: 'abc123', // 文件的 SHA，需要更新时提供
})
```

### 查看提交历史

```typescript
import { listCommits } from '@github-tools/sdk'

const commits = await listCommits(token)({
  owner: 'vercel',
  repo: 'ai',
  sha: 'main', // 分支或 commit hash
  path: 'src/index.ts', // 可选，按文件过滤
  author: 'username', // 可选，按作者过滤
  since: '2024-01-01', // 可选，开始时间
  until: '2024-12-31', // 可选，结束时间
})
```

### 获取提交详情

```typescript
import { getCommit } from '@github-tools/sdk'

const commit = await getCommit(token)({
  owner: 'vercel',
  repo: 'ai',
  ref: 'abc123', // commit SHA
})
// 返回: message, author, files changed, additions, deletions
```

### 获取文件 Blame

```typescript
import { getBlame } from '@github-tools/sdk'

const blame = await getBlame(token)({
  owner: 'vercel',
  repo: 'ai',
  path: 'src/index.ts',
})
// 返回: 每行的 commit hash, author, date
```

## Preset: repo-explorer

```typescript
import { createGithubAgent } from '@github-tools/sdk'

const explorer = createGithubAgent({
  model: 'anthropic/claude-sonnet-4-20250514',
  token: process.env.GITHUB_TOKEN!,
  preset: 'repo-explorer',
})

const result = await explorer.generate({
  prompt: 'Explore the vercel/ai repository and summarize its structure.',
})
```

## 路径格式

- 使用 `/` 分隔路径：`src/components/Button.tsx`
- 相对路径从仓库根目录开始
- 目录路径返回文件列表

## 注意事项

- 创建/更新文件需要提供 commit message
- 更新文件需要先获取当前 SHA
- 敏感信息不要直接写入仓库，使用环境变量
- 大文件考虑使用 Git LFS

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器 |
| [references/github-pr.md](github-pr.md) | PR 创建和合并 |
| [references/github-search.md](github-search.md) | 代码搜索 |
