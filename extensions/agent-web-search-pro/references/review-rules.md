# Review Rules

对 `agent-web-search-pro` 的审查应基于 spec、implementation-method.json、当前官方 docs 与生成文件的动态一致性来完成，至少覆盖以下实现相关约束：

## 1. Exposure Consistency
- 必须是 `both`
- 必须同时存在命令入口与工具入口
- 不应错误退化为仅命令或仅工具

## 2. Isolation
- 所有工具名应带 `ext_agent_web_search_pro_` 前缀
- 应存在外部状态文件策略
- 命令入口应作为显式的人类触发路径

## 3. Source Integrity
- 不能伪造搜索结果
- 不能伪造 citations
- 若未配置真实 adapter，必须明确降级

## 4. Output Contract
- 工具返回必须包含 `content`
- `details` 应包含至少：`mode`, `summary`, `results`, `citations`, `degraded`
- 发生真实错误时应抛错，而不是伪装为普通成功
- 文本输出应具备截断保护

## 5. Docs Alignment
- 命令/工具注册方式必须符合当前 pi docs
- 不应使用未确认签名的 UI API
- 若实现使用 `ctx.ui.confirm`，应符合 docs 示例中的 boolean 语义；本实现当前未使用

## 6. State Behavior
- `.state.json` 的读写逻辑应闭环
- reset-state 工具应能清空状态
- 默认状态不应硬编码 target/planningDir
- session_start 应能处理损坏状态并恢复
