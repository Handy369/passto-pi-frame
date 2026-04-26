# pi-resources

本仓库是当前 Pi 自定义能力的主开发仓。

当前管理内容包括：
- extensions
- themes
- docs
- 与扩展强耦合的共享 runtime（当前为 `lib/passto-agent-runtime`）

## 基本约束
- 不管理 `~/.pi` runtime state
- `main` 分支代表稳定可运行资源集
- feature 开发通过 git worktree 进行
- 真实 Pi 运行时通过 `~/.pi/agent/settings.json` 挂载本仓资源

## 当前工作模式
### stable
- `/Users/handy/dev/pi` -> `main`

### feature worktree
- `/Users/handy/worktree/pi-xxx`

### runtime
- `~/.pi` 仅承担 runtime home（settings / sessions / auth / logs）

## 典型 E2E 流程
1. 在 feature worktree 中开发
2. 临时将 `~/.pi/agent/settings.json` 指向该 worktree
3. 在 Pi 中执行 `/reload`
4. 验证通过后 merge 回 `main`
5. 将 settings 切回 stable

更多说明见：
- `ARCHITECTURE.md`
- `/Users/handy/pi-move/16-worktree-workflow.md`
- `/Users/handy/pi-move/18-migration-success-summary.md`
