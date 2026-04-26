# Usage

## Command Entry
命令入口：

```text
/web-search-pro <query-or-url>
```

行为：
- 传入普通文本时，走 `search` 模式
- 传入 URL 时，走 `read-url` 模式
- 当前默认 `deepRead=false`
- 若未接入真实 adapter，则返回明确降级说明
- 文本结果会经过截断保护，避免超长输出

## Tool Entry
工具入口：`ext_agent_web_search_pro_search`

参数建议：

```json
{
  "query": "latest pi extension docs",
  "site": "github.com",
  "language": "en",
  "limit": 5,
  "deepRead": true,
  "sort": "relevance"
}
```

或：

```json
{
  "url": "https://example.com/article",
  "deepRead": true
}
```

## Output Shape
文本结果包含：
- `mode`
- `summary`
- `degraded`
- `error`（如有）
- `results`
- `citations`
- 截断提示（如超限）

工具 `details` 中包含结构化字段：
- `mode`
- `summary`
- `results`
- `citations`
- `degraded`
- `error`

## Error / Degraded Semantics
- 当未配置真实搜索/抓取 adapter 时，返回 `degraded: true`
- 当运行中出现真实异常时，工具执行应抛出错误，而不是伪装成普通成功结果

## Reset State
扩展还提供：
- `ext_agent_web_search_pro_reset_state`

用于删除 `.state.json`，清理最近一次查询上下文。
