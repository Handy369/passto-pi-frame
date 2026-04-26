# Local Codegen Mapping

本文件是针对 `agent-web-search-pro` 的本地代码映射说明，供后续审查步骤引用。

## Spec -> Implementation
- `exposureMode: both`
  - 映射为：同时注册 `pi.registerCommand()` 与 `pi.registerTool()`
- `slug: agent-web-search-pro`
  - 工具前缀映射为：`ext_agent_web_search_pro_`
- `state strategy`
  - 映射为：外部 `.state.json` 文件 + `loadState/saveState/removeState/isValidState`
- `workflow`
  - 映射为：统一执行函数 `executeSearchLikeFlow()`
- `search/read-url/site-search`
  - 映射为：`detectMode()` + `runSearchAdapter()`
- `严格来源引用`
  - 映射为：无真实来源时返回 `degraded: true`，不伪造 `results/citations`
- `稳定性与容错`
  - 映射为：`session_start` 状态恢复 + 输出截断保护 + 区分降级结果与真实异常

## Docs-derived Constraints
- 命令注册使用 `pi.registerCommand(name, { description, handler })`
- 工具注册使用 `pi.registerTool({ name, label, description, parameters, execute })`
- `ctx.ui.notify(message, level)` 可用于命令执行提示
- `ctx.ui.confirm(title, message)` 从 docs 示例可推导返回 boolean，但本实现未使用
- 未从当前 docs 明确推导出的 `ctx.ui.select/input/editor` 不在本实现中使用

## Review Focus
审查时重点检查：
1. 暴露方式是否与 `both` 一致
2. 工具名前缀是否隔离
3. 是否使用外部状态文件
4. 是否存在伪造来源风险
5. 返回结构是否稳定
6. 是否已移除 target/planningDir 的默认硬编码
7. 是否具备状态损坏恢复与输出截断保护
