# Vercel 部署

> **last_verified: 2025-04-06**

## 核心功能

将应用部署到 Vercel，支持多种部署方式。

## 部署原则

1. **始终部署为 preview**，除非用户明确要求 production
2. **目标**：让项目链接到 Vercel，实现 git-push 自动化部署
3. **选择最优方式**：按优先级选择部署方法

## 部署方式决策树

```
1. .vercel/ 存在 + git remote
   └── Git Push（推荐）
   
2. .vercel/ 存在 + 无 git remote
   └── vercel deploy CLI
   
3. .vercel/ 不存在 + CLI 已认证
   └── vercel link → deploy
   
4. .vercel/ 不存在 + CLI 未认证
   └── 安装/认证 → link → deploy
   
5. 沙箱环境（无认证）
   └── No-Auth Fallback 脚本
```

## 方式一：Git Push（推荐）

### 前提条件
- `.vercel/` 目录存在
- 有 git remote

### 步骤

```bash
# 1. 确认远程存在
git remote get-url origin

# 2. 询问用户确认（不自动推送）
echo "This project is connected to Vercel via git. Push to deploy?"

# 3. 用户确认后执行
git add .
git commit -m "deploy: update"
git push

# 4. 获取预览 URL
sleep 5
vercel ls --format json
```

### 注意事项
- 永远不要在未确认前推送
- 非 main 分支创建 preview 部署
- main/production 分支创建 production 部署

## 方式二：Vercel CLI 直接部署

### 前提条件
- `.vercel/` 目录存在
- 无 git remote 或不想用 git 方式

### 步骤

```bash
# Preview 部署
vercel deploy [path] -y --no-wait

# 查看部署状态
vercel inspect <deployment-url>

# Production 部署（需要用户明确要求）
vercel deploy [path] --prod -y --no-wait
```

## 方式三：Link + Deploy

### 前提条件
- Vercel CLI 已安装并认证
- 项目未链接

### 步骤

```bash
# 1. 选择团队
vercel teams list --format json
# 展示团队列表，让用户选择

# 2. 链接项目（推荐 repo-based）
vercel link --repo --scope <team-slug>

# 3. 部署
git push  # 如果有 remote
# 或
vercel deploy -y --no-wait --scope <team-slug>
```

### Link 类型

| 类型 | 文件 | 说明 |
|------|------|------|
| 标准链接 | `.vercel/project.json` | 按目录名匹配 |
| Repo 链接 | `.vercel/repo.json` | 按 git remote 匹配（推荐） |

## 方式四：No-Auth Fallback（沙箱环境）

### 使用场景
- claude.ai / Codex 沙箱
- 无法运行 `vercel login`

### Claude.ai 环境

```bash
bash ~/.claude/skills/deploy-to-vercel/resources/deploy.sh [path]
```

### Codex 环境

```bash
skill_dir=""  # 或获取 skill 目录路径
bash "$skill_dir/resources/deploy-codex.sh" [path]
```

### 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `path` | 要部署的目录或 .tgz 文件 | 当前目录 |

### 返回结果

```json
{
  "previewUrl": "https://my-app-abc123.vercel.app",
  "claimUrl": "https://vercel.com/claim-deployment?code=..."
}
```

### 告诉用户

```
Deployment successful!
Preview URL: https://my-app-abc123.vercel.app
Claim URL: https://vercel.com/claim-deployment?code=...

View your site at the Preview URL.
To transfer this deployment to your Vercel account, visit the Claim URL.
```

## 项目状态检测

```bash
# 1. 检查 git remote
git remote get-url origin 2>/dev/null

# 2. 检查 .vercel/ 配置
cat .vercel/project.json 2>/dev/null || cat .vercel/repo.json 2>/dev/null

# 3. 检查 CLI 认证
vercel whoami 2>/dev/null

# 4. 列出可用团队
vercel teams list --format json 2>/dev/null
```

## 团队选择

当用户属于多个团队时：

```bash
vercel teams list --format json
```

展示团队 slug 列表：
```
Available teams:
- my-team
- personal
- company-org

Which team would you like to deploy to?
```

选择后，后续命令使用 `--scope <team-slug>`。

## 输出格式

### 成功部署

```
✅ Deployment successful!
🔗 Preview URL: https://my-app-abc123.vercel.app
📋 Deployment ID: depl_abc123def456

View your site at the Preview URL.
```

### Production 部署

```
✅ Production deployment successful!
🔗 Live URL: https://my-app.vercel.app
```

## 故障排除

### 网络限制错误

```
Deployment failed due to network restrictions.

To fix this:
1. Go to https://claude.ai/settings/capabilities
2. Add *.vercel.com to the allowed domains
3. Try deploying again
```

### CLI 认证失败

Fallback 到 no-auth 脚本。

### 权限问题

确保 Token 有足够的部署权限。

## 注意事项

- 永远使用 preview 模式，除非明确要求 production
- 不自动推送 git，必须用户确认
- 不 fetch/ping 部署 URL 验证
- 敏感文件（.env）不会被上传

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器 |
| [references/github-workflow.md](github-workflow.md) | GitHub Actions CI/CD |
| [references/github-repo.md](github-repo.md) | 仓库操作 |
