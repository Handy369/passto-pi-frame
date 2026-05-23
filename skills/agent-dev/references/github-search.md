# GitHub 搜索

> **last_verified: 2025-04-06**

## 核心功能

GitHub 全局代码搜索和仓库搜索。

## 工具清单

| 工具 | 功能 | 权限需求 |
|------|------|---------|
| `searchCode` | 搜索代码（支持 qualifier） | 任意 token |
| `searchRepositories` | 搜索仓库（按关键字、语言、stars） | 任意 token |

## 使用方式

### 搜索代码

```typescript
import { searchCode } from '@github-tools/sdk'

const results = await searchCode(token)({
  q: 'react useState in:file language:typescript', // 查询字符串
  sort: 'indexed', // 可选: stars, forks, updated
  per_page: 30,
})
// 返回: total_count, incomplete_results, items[]
```

### 搜索仓库

```typescript
import { searchRepositories } from '@github-tools/sdk'

const repos = await searchRepositories(token)({
  q: 'nextjs starter template',
  sort: 'stars', // stars, forks, updated
  per_page: 20,
})
// 返回: total_count, items[]
```

## 搜索 Qualifiers

### 代码搜索 Qualifiers

| Qualifier | 说明 | 示例 |
|-----------|------|------|
| `in:file` | 在文件中搜索 | `function in:file` |
| `in:path` | 在路径中搜索 | `test in:path` |
| `in:repo` | 在特定仓库搜索 | `bug in:repo:facebook/react` |
| `language:` | 按语言过滤 | `language:javascript` |
| `size:` | 按文件大小过滤 | `size:>1000` |
| `extension:` | 按扩展名过滤 | `extension:ts` |
| `org:` | 在组织中搜索 | `config org:vercel` |
| `user:` | 在用户中搜索 | `api user:octocat` |
| `from:` | 按作者过滤 | `fix from:octocat` |
| `pushed:` | 按最近推送时间 | `bug pushed:>2024-01-01` |
| `created:` | 按创建时间 | `feature created:>2024-01-01` |

### 仓库搜索 Qualifiers

| Qualifier | 说明 | 示例 |
|-----------|------|------|
| `in:name` | 仓库名 | `nextjs in:name` |
| `in:description` | 描述 | `starter in:description` |
| `in:readme` | README | `docs in:readme` |
| `language:` | 编程语言 | `language:typescript` |
| `stars:>` | Star 数量 | `stars:>1000` |
| `forks:>` | Fork 数量 | `forks:>100` |
| `pushed:>` | 最近推送 | `pushed:>2024-01-01` |
| `topic:` | 主题 | `topic:react` |
| `user:` | 用户/组织 | `user:vercel` |
| `org:` | 组织 | `org:facebook` |
| `is:public` | 公开仓库 | `is:public starter` |
| `is:private` | 私有仓库 | `is:private` |
| `mirror:` | 镜像仓库 | `mirror:true` |

## 实用搜索示例

### 搜索 React Hooks

```
react useState useEffect in:file language:typescript
```

### 搜索 Vercel 项目的 Next.js 配置

```
next.config in:file org:vercel language:javascript
```

### 搜索热门 TypeScript 项目

```
language:typescript stars:>5000 pushed:>2024-01-01
```

### 搜索 React 主题的仓库

```
topic:react stars:>1000
```

### 搜索特定文件的代码

```
router.push in:file extension:tsx
```

## 搜索限制

- **代码搜索**：仅搜索默认分支
- **时间范围**：代码搜索可能有限制
- **结果数量**：API 返回最多 1000 条结果
- **分页**：使用 `page` 和 `per_page` 参数

## 性能优化

- 使用 `per_page` 限制每页结果
- 使用精确的 qualifier 减少结果集
- 避免宽泛的搜索词
- 使用 `mirror:false` 排除镜像

## 注意事项

- 搜索结果可能不完整（GitHub 搜索限制）
- 代码搜索只搜索默认分支
- 私有仓库需要相应权限
- 搜索 API 有速率限制

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器 |
| [references/github-repo.md](github-repo.md) | 仓库操作 |
| [references/github-issue.md](github-issue.md) | Issue 搜索 |
