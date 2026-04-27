# passto-pi-frame

当前 Pi 自定义能力的主开发仓，对应 GitHub 仓库 `Handy369/passto-pi-frame`。

本仓库管理：
- `extensions/`：Pi 可直接加载的扩展
- `docs/`：设计、迁移与维护文档
- `lib/passto-agent-runtime/`：供 `pi-subagent`、`extension-maker` 等复用的共享 runtime 组件

## Repository model
- `~/.pi` 仅作为 Pi runtime home
- `/Users/handy/dev/pi` 是稳定主开发仓
- `/Users/handy/worktree/pi-*` 是 feature worktree
- 真实 Pi E2E 通过临时切换 `~/.pi/agent/settings.json` 指向目标 worktree 完成

## 基本约束
- 不在本仓管理 `~/.pi` runtime state
- `main` 分支代表稳定可运行资源集
- feature 开发通过 `git worktree` 进行
- 敏感配置、本地缓存、运行时状态文件不入仓

## 当前工作模式
### stable
- `/Users/handy/dev/pi` -> `main`

### feature worktree
- `/Users/handy/worktree/pi-*`

### runtime
- `~/.pi` 仅承担 runtime home（settings / sessions / auth / logs）

## 典型 E2E 流程
1. 在 feature worktree 中开发
2. 临时将 `~/.pi/agent/settings.json` 指向该 worktree
3. 在 Pi 中执行 `/reload`
4. 在真实 Pi 中验证行为
5. 验证通过后 merge 回 `main`
6. 将 settings 切回 stable

## Notes
- `~/.pi` 不再作为主开发仓使用
- 新功能开发与真实 E2E 验证均基于本仓及其 worktree 完成
- 迁移与退役记录保存在 `ARCHITECTURE.md` 与 `/Users/handy/pi-move/` 下

更多说明见：
- `ARCHITECTURE.md`
- `/Users/handy/pi-move/16-worktree-workflow.md`
- `/Users/handy/pi-move/18-migration-success-summary.md`
- `/Users/handy/pi-move/20-old-pi-repo-retirement.md`
