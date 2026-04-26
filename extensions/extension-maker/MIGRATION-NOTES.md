# extension-maker migration notes

当前迁移状态：
- 主体源码已迁入 `extensions/extension-maker/`
- 共享 runtime 依赖已由仓库根 `lib/passto-agent-runtime/` 提供
- regression 脚本已从旧 `~/.pi` 绝对路径改为相对 import
- `SKILL.md` 与 regression README 已更新为新仓执行方式

## 当前策略
- 优先保证 extension 可在当前资源仓结构下加载
- 历史设计文档中残留的旧路径说明可后续按需继续清理

## 当前已修复的关键点
- `references/regression/run-minimal-subagent-regression.mjs`
- `SKILL.md`
- `references/regression/README.md`

## 后续建议
- `/reload` 验证 extension 是否可正常加载
- 如需执行 regression，用仓库根运行方式，不再使用 `~/.pi` 旧路径
