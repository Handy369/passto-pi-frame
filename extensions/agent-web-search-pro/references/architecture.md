# Architecture

## Exposure
该扩展采用 `both` 暴露：
- `pi.registerCommand("web-search-pro", ...)`
- `pi.registerTool({ name: "ext_agent_web_search_pro_search", ... })`

同时包含辅助工具：
- `ext_agent_web_search_pro_reset_state`

## Core Flow
统一执行路径：`executeSearchLikeFlow()`

步骤：
1. 读取 `.state.json`
2. 识别模式：
   - `search`
   - `read-url`
   - `site-search`
3. 调用 `runSearchAdapter()`
4. 更新最近一次查询状态
5. 对输出应用截断保护
6. 返回文本结果与结构化 details

## State Model
状态文件：`.state.json`

字段：
- `currentStep`
- `startedAt`
- `exposureMode`
- `lastQuery?`
- `lastUrl?`
- `lastMode?`
- `lastResultCount?`

## State Validation
在 `session_start` 事件中：
- 尝试读取当前状态
- 若 JSON 损坏或结构非法，则回写默认状态
- 若可读，则重新持久化规范化后的状态

## Isolation
- 所有工具名统一使用前缀：`ext_agent_web_search_pro_`
- 命令入口作为人类显式触发路径
- 使用外部状态文件而不是仅依赖内存

## Degradation Policy
当前未接入真实搜索/抓取 adapter。
因此：
- 返回明确 `degraded: true`
- 不生成伪造 `results` 或 `citations`
- `summary` 与 `error` 明确指出缺少 adapter

## Error Policy
- `No search/fetch adapter configured` 属于允许的降级信息
- 真实执行异常应抛出错误，由宿主框架处理

## Output Guard
文本输出通过 `truncateHead` + `DEFAULT_MAX_LINES` / `DEFAULT_MAX_BYTES` 做截断保护，避免输出过长。
