---
name: agent-dev
description: >
  开发者工具技能集合，涵盖 GitHub 操作（仓库、PR、Issue、Workflow）和 Vercel 部署能力。
  
  使用此技能的场景：
  - GitHub 操作：创建/查看PR、Issue、Gist，管理仓库、搜索代码，管理Workflow
  - Vercel 部署：部署应用到 Vercel、获取预览链接、管理部署
  - DevOps 工作流：CI/CD 触发、代码审查、Issue 追踪
  
  应优先触发的场景：
  1. 用户提及 "GitHub"、"PR"、"Issue"、"仓库"、"Workflow"、"Actions"
  2. 用户提及 "deploy"、"部署"、"Vercel"、"预览链接"
  3. 用户需要代码审查、自动化工作流触发
  
  不要在以下场景触发：
  - 纯前端UI设计（使用 agent-design）
  - 文档处理（使用 agent-docs）
  - 互联网搜索（使用 agent-reach）
---

# Agent Dev — 开发者工具技能集合

> **last_verified: 2026-05-16**

## Top-level Boundary Pack

### current main output
- GitHub / Vercel / DevOps 工具操作结果，如 PR、Issue、Workflow、Gist、仓库管理、部署结果
- 基于外部开发者平台动作产生的状态、链接、评论、触发结果或部署回执

### current main action
- 操作 GitHub PR / Issue / Repo / Workflow / Gist / Search
- 触发或检查 CI/CD / GitHub Actions
- 部署到 Vercel、获取 preview 链接、管理部署状态
- 在开发者平台上执行只读或写入型协作动作

### should-trigger
当用户当前主目标是以下任一项时，优先进入本 Skill：
- 创建、查看、评论、合并 PR
- 创建、查看、评论、关闭 Issue
- 搜索 GitHub 仓库 / 代码 / Gist
- 触发或检查 Workflow / Actions / CI 状态
- 部署应用到 Vercel、获取预览链接、检查部署结果

### should-not-trigger
以下请求不应由本 Skill 接管：
- 直接写代码、修 bug、补测试、做本地实现验证
- 纯前端 UI 设计或交互方案设计
- 文档文件处理、PDF/Word/PPT/Excel 操作
- 纯互联网搜索或一般知识调研，不涉及 GitHub/Vercel 平台动作

### adjacent destination
- 代码实现 / 调试 / 测试 / review 主流程 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 文档文件处理 → `/Users/handy/.claude/skills/agent-docs/SKILL.md`
- 纯网页交互 / 浏览器自动化 → `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- 若只是一般知识问答、无需平台操作 → 直接回答或按需走 `doc-lookup`

### non-goals
即使命中本 Skill，也不要顺手扩做：
- 把平台操作任务扩成完整代码实现任务
- 在未确认的情况下执行高风险写操作（如 merge、关闭 Issue、生产部署）
- 因为用户提到 GitHub/Vercel，就默认接管所有开发工作
- 用平台动作替代本地代码验证或产品定义工作

### first action after hit
先判断当前目标平台与动作类型：PR / Issue / Repo / Workflow / Gist / Search / Vercel；再只读取对应单一 reference，先做最小权限判断（只读还是写入），必要时再请求用户确认高风险操作。

### positive examples
- “帮我看看这个仓库开着哪些 PR，并总结一下 #42 的风险。”
  - why should trigger: 主目标是 GitHub PR 浏览与评估
  - expected adopt signal: 先进入 PR 路径，读取 `github-pr.md`，再做只读查询
- “触发一下这个 repo 的 deploy workflow，跑完把链接发我。”
  - why should trigger: 主目标是 Workflow / CI 平台操作
  - expected adopt signal: 先读取 `github-workflow.md`，确认权限与目标 workflow，再触发并回报结果
- “把这个项目部署到 Vercel，先给我 preview 链接。”
  - why should trigger: 主目标是 Vercel 部署
  - expected adopt signal: 先走 `vercel-deploy.md`，默认 preview 而非 production

### negative examples
- “直接把这个 PR 里的冲突修掉并补测试。”
  - why should not trigger: 主输出物是代码实现与测试，不是平台操作
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “帮我做一个管理后台的视觉改版方案。”
  - why should not trigger: 这是 UI/产品方案定义，不是 GitHub/Vercel 动作
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`
- “帮我把这个 PDF 报告重新排版并导出。”
  - why should not trigger: 这是文档处理，不是开发者平台操作
  - correct destination: `/Users/handy/.claude/skills/agent-docs/SKILL.md`

## Overview

统一的开发者技能，整合 GitHub 操作和 Vercel 部署能力。支持代码审查、Issue 管理、Workflow 触发、项目部署等 DevOps 全链路工作流。

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 顶层平台动作路由入口；负责判定当前是 GitHub 还是 Vercel，以及先走哪个子路径 |
| `references/` | required | runtime | 承载 GitHub PR/Issue/Repo/Workflow/Gist/Search 与 Vercel 部署的分路径材料 |
| `references/*.md` | required | runtime | 每个 reference 对应一个清晰的平台动作簇，改变首动作与权限判断 |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 Skill 不需要独立脚本目录；平台动作主要由文档路由与工具/CLI 执行完成 |
| `templates/` | forbidden | runtime | 当前不存在需要被复用的模板工作流目录；先保持结构窄而清晰 |

## Quick Reference

| 任务 | 工具/方式 | 详细文档 |
|------|----------|----------|
| 代码审查 PR | GitHub PR 工具集 | → `references/github-pr.md` |
| Issue 管理 | GitHub Issue 工具集 | → `references/github-issue.md` |
| 仓库操作 | 文件读写、分支管理 | → `references/github-repo.md` |
| Workflow/CI | 触发、检查、重试 | → `references/github-workflow.md` |
| Gist 管理 | 创建/更新/删除 Gist | → `references/github-gist.md` |
| 代码搜索 | GitHub 全局搜索 | → `references/github-search.md` |
| **部署到 Vercel** | CLI/Git Push/Fallback | → `references/vercel-deploy.md` |

## 路由决策树

### Q1: 用户要做什么？
- **Pull Request 操作**（审查、创建、合并、评论）→ `github-pr.md`
- **Issue 操作**（创建、查看、评论、关闭）→ `github-issue.md`
- **仓库操作**（读写文件、分支、提交历史）→ `github-repo.md`
- **Workflow/CI**（触发、检查、重试）→ `github-workflow.md`
- **Gist**（创建/管理代码片段）→ `github-gist.md`
- **代码搜索**（搜索仓库、代码）→ `github-search.md`
- **部署到 Vercel** → `vercel-deploy.md`

### Q2: 需要什么级别的权限？
- **只读操作**（浏览、搜索、审查）→ 使用 read-only 工具
- **写操作**（创建PR、部署）→ 可能需要用户确认

### Q3: 环境限制？
- **沙箱环境**（无CLI认证）→ 使用 no-auth fallback
- **完整终端** → 使用 CLI 直接操作

## 技能关系图

```
agent-dev (Meta Router)
│
├── GitHub Operations (基于 @github-tools/sdk)
│   ├── github-repo (仓库)
│   │   └── getRepository, listBranches, getFileContent, createOrUpdateFile
│   ├── github-pr (Pull Request)
│   │   └── listPullRequests, getPullRequest, createPullRequest, mergePullRequest
│   ├── github-issue (Issue)
│   │   └── listIssues, getIssue, createIssue, addIssueComment, closeIssue
│   ├── github-workflow (Workflow/Actions)
│   │   └── listWorkflows, triggerWorkflow, rerunWorkflowRun
│   ├── github-gist (Gist)
│   │   └── createGist, updateGist, deleteGist
│   └── github-search (搜索)
│       └── searchCode, searchRepositories
│
└── Deployment
    └── vercel-deploy
        ├── Git Push (推荐)
        ├── Vercel CLI
        └── No-Auth Fallback
```

## Preset 路由参考

| 预设 | 包含功能 | 使用场景 |
|------|---------|---------|
| `code-review` | PR列表、详情、文件内容、提交历史、代码搜索 | 代码审查 |
| `issue-triage` | Issue列表、创建、评论、关闭、仓库搜索 | Issue 分类处理 |
| `repo-explorer` | 所有只读工具 | 只读浏览仓库 |
| `ci-ops` | Workflow触发、检查、重试 | CI/CD 操作 |
| `maintainer` | 全部36个工具 | 完整维护操作 |

## 详细文档索引

| 文档 | 覆盖范围 | last_verified |
|------|----------|---------------|
| [references/github-pr.md](references/github-pr.md) | PR 操作、审查、合并、评论 | 2025-04-06 |
| [references/github-issue.md](references/github-issue.md) | Issue 创建、查看、评论、关闭 | 2025-04-06 |
| [references/github-repo.md](references/github-repo.md) | 仓库元数据、文件操作、分支 | 2025-04-06 |
| [references/github-workflow.md](references/github-workflow.md) | GitHub Actions、Workflow 触发 | 2025-04-06 |
| [references/github-gist.md](references/github-gist.md) | Gist 创建、更新、评论 | 2025-04-06 |
| [references/github-search.md](references/github-search.md) | 代码/仓库搜索 | 2025-04-06 |
| [references/vercel-deploy.md](references/vercel-deploy.md) | Vercel 部署、四种部署方式 | 2025-04-06 |

## Best Practices

### ✅ DO
- 使用 Preset 限制工具范围，减少上下文消耗
- 写操作（创建Issue、合并PR）前先询问用户确认
- 部署始终使用 preview 模式，除非用户明确要求 production
- 使用 `getFileContent` 读取文件时注意路径格式

### ❌ DON'T
- 不要在未确认的情况下合并 PR
- 不要删除 Gist 或关闭 Issue，除非用户明确要求
- 不要在生产环境部署未确认的代码
- 不要忽略 GitHub Token 权限要求

## Common Pitfalls

| 问题 | 原因 | 解决 |
|------|------|------|
| 工具调用失败 | Token 权限不足 | 检查 Token 是否有对应权限 |
| 部署失败 | 网络限制 | 使用 no-auth fallback 脚本 |
| PR 无法合并 | 有冲突或状态不允许 | 先检查 PR 状态和冲突 |
| Workflow 触发失败 | 权限不足 | 检查 PAT 的 Actions 权限 |

## Dependencies

| 工具 | 用途 | 安装 |
|------|------|------|
| Node.js | 运行 @github-tools/sdk | `brew install node` |
| GitHub Token | 认证（建议 Fine-grained） | GitHub Settings → Developer settings |
| Vercel CLI | 部署（可选） | `npm install -g vercel` |
| Git | 代码提交推送 | `brew install git` |

## Token 配置参考

### GitHub Fine-grained Token 权限

| 权限 | 级别 | 需要的操作 |
|------|------|-----------|
| Metadata | Read-only | 始终需要 |
| Contents | Read/Write | 文件操作 |
| Pull requests | Read/Write | PR 操作 |
| Issues | Read/Write | Issue 操作 |
| Gists | Read/Write | Gist 操作 |
| Actions | Read/Write | Workflow 操作 |

*本技能基于 [@github-tools/sdk](https://github.com/vercel-labs/github-tools) 和 [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) 聚合构建*
