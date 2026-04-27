# MIGRATION STATUS

## 当前状态
本仓库已从“候选资源仓”升级为当前 Pi 自定义能力的主开发仓。

## 已完成
- 第一批扩展迁移并验证加载
- docs 收拢
- `agent-web-search-pro` 核心源码迁入并验证 `/reload`
- `pi-subagent` 通过引入 `lib/passto-agent-runtime` 恢复成功
- stable main 加载成功
- feature worktree E2E 加载成功

## 当前 stable 入口
- 仓库：`/Users/handy/dev/pi`
- settings 默认挂载：
  - `/Users/handy/dev/pi/extensions`

## 当前 feature 工作流
- 从 `main` 创建 worktree
- feature worktree 可直接通过 settings 切换做真实 Pi E2E
- 无需先 merge 才能测试

## 暂未完成
- `extension-maker` 迁移与去硬编码收口

## 当前建议
- 将本仓库视为唯一主要开发入口
- 不再从 `~/.pi` 主目录开展 feature 开发
- 后续剩余高耦合对象继续按仓库边界明确化原则处理
