# agent-web-search-pro migration notes

当前迁移策略：
- 已迁入核心源码目录
- 未迁入运行态状态文件：`.state.json`
- 未迁入含敏感信息的 `config.json`
- 未迁入生成工件：
  - `review.json`
  - `implementation-method.json`
  - `extension-generator-spec.json`

## 配置策略
推荐优先使用环境变量：
- `TAVILY_API_KEY`

如确需本地文件配置，可复制：
- `config.example.json` -> `config.json`

并确保 `config.json` 不提交到 git。

## 当前行为
`providers/config.ts` 的读取顺序：
1. `config.json`
2. 环境变量（如 `TAVILY_API_KEY`）
3. 默认值（如 `https://r.jina.ai`）

## 后续建议
- 在仓库根 `.gitignore` 或目录级规则中忽略 `extensions/agent-web-search-pro/config.json`
- 若需要保留历史工件，可单独归档到 `docs/generated-artifacts/`
