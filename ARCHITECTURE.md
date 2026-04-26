# ARCHITECTURE

本仓库是当前 Pi 自定义能力的主开发仓，职责已经不再只是“静态资源仓”，而是：
- 管理可加载的 Pi extensions / skills / themes / docs
- 管理部分与扩展强耦合的共享运行层（当前为 `lib/passto-agent-runtime`）
- 作为 stable main + feature worktree 的真实开发基础

---

## 1. 目录职责

### `extensions/`
存放可由 Pi 直接加载的扩展资源。

当前包含：
- 第一批低风险扩展
- 第二批已迁入的 `agent-web-search-pro`
- 已恢复的 `pi-subagent`

### `themes/`
存放 Pi 主题资源。

### `docs/`
存放迁移前后保留的设计文档、历史分析文档与参考材料。

### `lib/passto-agent-runtime/`
共享 subagent / orchestration runtime。

当前用途：
- 供 `pi-subagent` 直接 import
- 后续可作为 `extension-maker` 等 orchestration 类扩展的共享运行时基础

### `_hold/`
用于暂时存放尚未恢复到主加载路径的内容。

> 当前仓库已恢复 `pi-subagent`，但 `_hold/` 目录仍可作为后续迁移中的隔离区约定保留。

---

## 2. 运行模式

### stable main
- 仓库路径：`/Users/handy/dev/pi`
- 分支：`main`
- 语义：稳定、可加载、可 `/reload` 的默认资源集

### feature worktree
- 路径示例：`/Users/handy/worktree/pi-sandbox`
- 语义：未 merge feature 的真实开发工作区

### runtime home
- 路径：`~/.pi`
- 语义：Pi runtime、settings、sessions、auth、logs
- 不再承担主要源码开发职责

---

## 3. 资源加载方式

当前默认通过 `~/.pi/agent/settings.json` 挂载本仓资源：

```json
{
  "extensions": ["/Users/handy/dev/pi/extensions"],
  "themes": ["/Users/handy/dev/pi/themes"]
}
```

测试 feature worktree 时，可临时切换到：

```json
{
  "extensions": ["/Users/handy/worktree/pi-sandbox/extensions"],
  "themes": ["/Users/handy/worktree/pi-sandbox/themes"]
}
```

---

## 4. 当前分层原则

### 跟仓走的内容
适合继续纳入 git：
- 扩展源码
- skills / SKILL.md / references
- theme 文件
- 共享 runtime 代码（当前 `lib/passto-agent-runtime`）
- 与代码强关联的默认配置（例如 runtime contract defaults）

### 不跟仓走的内容
应视为 runtime state / local config：
- `.state.json`
- `extensions/models.dev-api.json`
- `extensions/agent-web-search-pro/config.json`
- session / logs / auth / tool stats

---

## 5. 当前迁移状态

### 已迁入并验证通过
- 第一批资源
- `agent-web-search-pro`
- `pi-subagent` + `lib/passto-agent-runtime`

### 仍待处理
- `extension-maker`
- 与历史文档相关的旧路径说明（仅在需要时清理）

---

## 6. 后续演化方向

### 短期
- 继续把剩余高耦合对象收进当前仓库或明确隔离
- 保持 main 可加载、可 `/reload`

### 中期
- 评估 `extension-maker` 与 `passto-agent-runtime` 的边界
- 决定是否进一步模块化共享 runtime

### 长期
- 若共享 runtime 被更多扩展依赖，可考虑：
  - 独立仓库
  - package 化
  - 明确版本边界
