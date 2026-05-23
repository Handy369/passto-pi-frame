# 搜索工具

> **last_verified: 2026-05**

当前默认优先：统一入口 `scripts/research-search.sh`；其内部默认 DeepSeek smart-search（通过 `agent-browser` 驱动网页版 DeepSeek 做聚合深度搜索），Exa 作为 fallback 第二优先。DeepSeek 主链路现已完整内聚在当前 skill 内，不再依赖外部 `browser-test` runner。

## 统一入口（首选）

```bash
/Users/handy/.claude/skills/agent-reach/scripts/research-search.sh --query "你的研究问题"
```

行为：
- 默认先走 DeepSeek smart-search
- DeepSeek 失败时自动回退 Exa `--research`
- 输出统一 contract：`coreFindings` / `evidencePoints` / `evidenceExcerpts` / `sourceLinks` / `uncertainties`
- 对 DeepSeek 结果会进一步做结构化 normalizer 处理，补齐/收敛 `citationsByFinding`、`uncertaintyStructured`、canonical `sourceLinks`，并在可用时提供 `sourcePageExcerpts`

## DeepSeek smart-search（首选执行器）

已接入脚本：

```bash
/Users/handy/.claude/skills/agent-reach/scripts/deepseek-search.sh --query "你的研究问题"
```

Exa fallback 脚本：

```bash
/Users/handy/.claude/skills/agent-reach/scripts/exa-search.sh --research --query "你的研究问题"
```

### 行为
- 调用 `scripts/deepseek-search.sh`
- 其内部再调用 `scripts/deepseek_search_runner.py`
- 自动打开 DeepSeek 网页版
- 开启“智能搜索”
- 提交研究问题
- 等待回答
- 提取回答正文与来源链接
- 若回答存在结构化 section（如 `[CORE_FINDINGS]` / `[SOURCE_SITES]` / `[SOURCE_URLS]`），优先消费这些高置信 source declaration
- 若 DeepSeek 输出被截断或 section 不完整，会尝试 answer candidate 聚合、source section recovery、非结构化 answer 归纳
- 若 DeepSeek 失败，再尝试 Exa fallback
- 若 Exa fallback 也失败，`summary` 会尽量透传真实 Exa 错误摘要（如 `HTTP 401 INVALID_API_KEY`、`429`、`5xx`）
- 运行证据默认写入 `~/.agent-reach/evidence/deepseek-search/<requestId>/`

### 输出
默认返回 JSON，包含：
- `channel`
- `provider`
- `route`
- `status`
- `summary`
- `requestId`
- `answerText`
- `coreFindings`
- `evidencePoints`
- `evidenceExcerpts`
- `uncertainties`
- `uncertaintyStructured`
- `sourceLinks`
- `sourceDomains`
- `sourceCount`
- `citationsByFinding`
- `sourcePageExcerpts`
- `evidenceDir`
- `verdictPath`
- `rawExtractionPath`
- `searchDiagnostics`

补充说明：
- `citationsByFinding`：按 finding 维度给出最相关 canonical source URL，避免把整组 shared source pool 广播给每条结论
- `uncertaintyStructured`：把不确定性拆成 `conflicts` / `stalenessRisks` / `coverageGaps` / `general`
- `sourceLinks`：优先保留 DeepSeek 明确声明的 `SOURCE_SITES`↔`SOURCE_URLS` canonical 来源；当存在至少 3 组配对时，会主动过滤页面 link cluster 中的低置信额外链接

如需简洁文本：

```bash
/Users/handy/.claude/skills/agent-reach/scripts/research-search.sh --text --query "你的研究问题"
```

### 使用场景
| 场景 | 推荐 |
|-----|------|
| 通用互联网研究 | DeepSeek smart-search |
| 需要聚合多来源并生成中文研究结论 | DeepSeek smart-search |
| 需要保留运行证据、来源 gate、verdict | DeepSeek smart-search |
| 需要 finding→source 精确引用 | DeepSeek smart-search |
| 需要结构化 uncertainty 判断 | DeepSeek smart-search |
| 需要把搜索链路完整内嵌到 agent-reach skill | DeepSeek smart-search |
| DeepSeek 不可用时的 fallback | Exa |

## Exa AI 搜索（fallback）

基于 Exa 官方 Search API：
- `POST https://api.exa.ai/search`
- 认证：`x-api-key: YOUR_API_KEY`
- 官方文档：`https://exa.ai/docs/reference/search-api-guide`
- API reference：`https://exa.ai/docs/reference/search`

已接入本地脚本：

```bash
/Users/handy/.claude/skills/agent-reach/scripts/exa-search.sh --query "你的研究问题"
```

环境变量：
- `EXA_API_KEY` 或 `AGENT_REACH_EXA_API_KEY`
- 可选：`EXA_BASE_URL`
- 默认会自动加载 `~/.agent-reach/env`（可用 `AGENT_REACH_ENV_FILE` 覆盖）

推荐本地稳定配置：
```bash
mkdir -p ~/.agent-reach
cat > ~/.agent-reach/env <<'EOF'
EXA_API_KEY="<your-exa-key>"
EOF
chmod 600 ~/.agent-reach/env
```

推荐模式：
- `--research`：让 Exa 直接输出中文研究结论 + 证据 + 来源
- 默认会尽量优先官方/权威域名，并对来源去重
- 默认会对前 N 个结果用 Jina Reader 抓正文摘录，增强证据质量
- `--jina-enrich-top-n <n>`：控制抓正文的结果数
- `--no-jina-enrich`：关闭正文增强
- `--no-prefer-official`：关闭官方源优先排序

高质量 AI 搜索引擎，擅长技术和代码搜索。

```bash
mcporter call 'exa.web_search_exa(query: "query", numResults: 5)'
mcporter call 'exa.get_code_context_exa(query: "code question", tokensNum: 3000)'
```

### 使用场景

| 场景 | 参数 |
|-----|------|
| 网页搜索 | `web_search_exa(query: "...", numResults: 5)` |
| 代码搜索 | `get_code_context_exa(query: "...", tokensNum: 3000)` |

### 特点

- 擅长英文内容和技术文档
- 支持代码上下文搜索
- 结果质量高

## 与其他搜索工具对比

| 工具 | 来源 | 适用场景 |
|-----|------|---------|
| DeepSeek smart-search | agent-reach（内置 runner + agent-browser） | 聚合深度搜索、研究总结、来源提取 |
| Exa Search API | agent-reach | fallback 英文/技术/代码搜索 |
| 智谱搜索 | my-mcp-tools | 中文搜索 |
| GitHub 搜索 | agent-reach (dev.md) | 仓库/代码搜索 |

---

## Related

| 关联文档 | 关联内容 |
|----------|----------|
| [SKILL.md](../SKILL.md) | 主路由器，含 DeepSeek → Exa 降级链 |
| [references/web.md](web.md) | 搜索结果页面读取（DeepSeek / Exa 搜索 → 读取链接）|
| [references/dev.md](dev.md) | GitHub 代码搜索（Exa擅长代码，但 gh CLI 也可搜索仓库）|
| [../scripts/deepseek-search.sh](../scripts/deepseek-search.sh) | DeepSeek 搜索入口脚本 |
| [../scripts/deepseek_search_runner.py](../scripts/deepseek_search_runner.py) | DeepSeek + agent-browser 自包含运行链路 |
