# GitHub Gist 操作

> **last_verified: 2025-04-06**

## 核心功能

Gist 代码片段管理：创建、更新、删除、评论。

## 工具清单

| 工具 | 功能 | 权限需求 |
|------|------|---------|
| `listGists` | 列出 Gist（用户或特定用户） | Gists: Read |
| `getGist` | 获取 Gist 详情及文件内容 | Gists: Read |
| `listGistComments` | 列出 Gist 的评论 | Gists: Read |
| `createGist` | 创建新 Gist | Gists: Write |
| `updateGist` | 更新 Gist 描述或文件 | Gists: Write |
| `deleteGist` | 删除 Gist | Gists: Write |
| `createGistComment` | 在 Gist 下发表评论 | Gists: Write |

## 使用方式

### 列出 Gist

```typescript
import { listGists } from '@github-tools/sdk'

// 列出认证用户的 Gist
const myGists = await listGists(token)({})

// 列出特定用户的 Gist
const userGists = await listGists(token)({
  username: 'octocat',
})
```

### 获取 Gist 详情

```typescript
import { getGist } from '@github-tools/sdk'

const gist = await getGist(token)({
  gistId: 'abc123def456',
})
// 返回: description, files, public, created_at, updated_at
// files 对象包含每个文件的 content, filename, language
```

### 创建 Gist

```typescript
import { createGist } from '@github-tools/sdk'

const newGist = await createGist(token)({
  description: 'My useful script',
  public: false, // true 公开，false 私密
  files: {
    'script.js': {
      content: 'console.log("Hello World");',
    },
    'readme.md': {
      content: '# Usage\n\nRun with `node script.js`',
    },
  },
})
```

### 更新 Gist

```typescript
import { updateGist } from '@github-tools/sdk'

// 更新描述
await updateGist(token)({
  gistId: 'abc123def456',
  description: 'Updated description',
})

// 更新文件
await updateGist(token)({
  gistId: 'abc123def456',
  files: {
    'script.js': {
      content: 'console.log("Updated content");',
    },
    'new-file.ts': {
      content: 'const x = 1;',
    },
  },
})
```

### 删除 Gist

```typescript
import { deleteGist } from '@github-tools/sdk'

await deleteGist(token)({
  gistId: 'abc123def456',
})
```

### Gist 评论

```typescript
import { listGistComments, createGistComment } from '@github-tools/sdk'

// 列出评论
const comments = await listGistComments(token)({
  gistId: 'abc123def456',
})

// 添加评论
await createGistComment(token)({
  gistId: 'abc123def456',
  body: 'Great code! Could you also add type annotations?',
})
```

## Gist vs Repository

| 特性 | Gist | Repository |
|------|------|-----------|
| 用途 | 代码片段分享 | 完整项目 |
| 版本控制 | 有限 | 完整 Git |
| 组织 | 单文件或多文件 | 多目录 |
| 可见性 | 公开/私密 | 公开/私有 |
| 协作 | 评论 | Issues/PR |
| 大小限制 | 10MB 单文件 | 100MB 单文件 |

## 常见用途

- **分享代码片段**：快速分享几行代码
- **配置备份**：保存 dotfiles
- **笔记**：Markdown 格式的笔记
- **临时脚本**：一次性使用的脚本

## 注意事项

- 私密 Gist 不是真正的私有，只是无法被搜索
- Gist 有 10MB 单文件限制
- 删除 Gist 无法恢复
- 无法在 Gist 中创建目录

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器 |
| [references/github-repo.md](github-repo.md) | 仓库文件操作 |
| [references/github-search.md](github-search.md) | 搜索公开 Gist |
