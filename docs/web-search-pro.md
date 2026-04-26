# web-search-pro 扩展核心需求与流程实现说明（修订版）

## 1. 概述

实现一个高级网络搜索工具 `web_search_pro`，面向人类用户或其他 LLM Agent，通过递归多轮"分析‑搜索‑抓取‑判断"循环自动收集并验证信息，直到获得足以回答问题的知识。搜索阶段支持多搜索引擎（如 Tavily、Google、Bing 等），可按策略并行或回退调用，提高信息的全面性与鲁棒性。整体过程模拟专业调研：不断缩小信息缺口、按需切换站点类型、深入页面、直至信息充分。

## 2. 目标使用者

- **人类用户**：直接在对话中使用，获得详细的调研式回答。
- **其他 LLM Agent**：作为子工具被调用，接收结构化查询参数，返回结构化回答及来源列表，便于 Agent 间协同。

因此，工具接口需同时适应两种调用方式：

- 自然语言 query（人类友好）
- 可选的 context 与 required_format 参数（Agent 友好）

## 3. 依赖组件

- **agent-reach skill**：决策树技能，根据查询与已知信息推荐最佳搜索站点类型（如 search_engine、zhihu、xiaohongshu 等）。由宿主环境提供，若缺失则使用内置规则回退。
- **多搜索引擎适配器**：支持 Tavily 及其他自定义引擎（如 Google CSE、Bing API、SerpAPI 等）。通过适配器模式统一接口，允许运行时配置。
- **HTTP 客户端**：用于抓取目标页面的原始 HTML，需处理各种内容类型和编码。
- **文本抽取与摘要能力**：利用 LLM 或本地算法，从网页中提取相关内容并生成针对当前问题的摘要。

## 4. 工具注册信息

- **名称**：`web_search_pro`
- **描述**：递归多源智能搜索工具，适用于人工或 Agent 调用。利用多搜索引擎和定向站点检索，反复筛选、深入阅读页面，直到信息足以回答问题。支持自定义最大轮次、包含站点类型和搜索引擎偏好。
- **参数**：
  - `query`（string，必填）：用户或 Agent 提出的问题。
  - `context`（string，可选）：已有的背景信息，由调用方传入（Agent 常用）。
  - `max_rounds`（number，默认 5）：最大递归搜索轮次。
  - `include_sites`（array of string，可选）：强制包含的站点类型，会与 agent-reach 推荐合并。
  - `engines`（array of string，可选）：指定使用的搜索引擎列表，如 `["tavily", "google"]`。默认为 `["tavily"]`，宿主可配置全局默认集。

## 5. 核心递归流程

### 5.1 初始化

- 创建信息池 `knowledge`（数组，每项包含 content、source_url、relevance_score 等）。
- 当前轮次 `round = 0`，子问题栈 `sub_queries = [query]`。
- 若调用方提供了 `context`，将其作为一条初始 knowledge 条目（标记来源为"caller"）。

### 5.2 循环（当 round < max_rounds 且 sub_queries 非空）

#### （1）意图识别与站点选择

取 `sub_queries` 队首的当前查询 `q`，结合已有 knowledge 合成摘要。调用 agent-reach 技能（若有），传入 `{ query: q, context: knowledge_summary }`，获得推荐站点类型数组 `sites`。若无此技能或调用失败，则根据 `q` 关键词使用规则回退（例：含"经验/推荐"→ `["xiaohongshu","zhihu"]`；含"新闻/最新"→ `["news","search_engine"]`）。

#### （2）多引擎定向搜索

对 `sites` 中每个类型生成对应搜索式：

- 通用搜索引擎：直接使用 `q`
- 特定站点：`site:domain.com q`（例如 `site:zhihu.com 如何学习 Rust`）

遍历配置的搜索引擎列表（来自参数 `engines` 或全局默认）。对每个搜索式，并行调用所有启用的搜索引擎，设置合理超时（如 5s）。收集各引擎返回的结果，合并并去除重复 URL（以 URL 为主键）。每条记录包含标题、URL、摘要、来自哪个引擎。若所有引擎均失败，标记本轮无结果并跳过。

#### （3）摘要分析与深度筛选

对合并后的候选列表 `candidates`，评估每条摘要与当前 `q` 的相关性（0‑1）、信息密度、可信度。

实现方式：调用 LLM 批量评分，或使用基于关键词的快速打分。仅保留得分 > 阈值（如 0.6）的条目，按得分降序排列，取前 N 条（N ≤ 3）作为待抓取目标。若无足够条目，可降低阈值（如 0.4）至最低保留 1‑2 条。

#### （4）页面内容抓取与抽取

对待抓取 URL 发起 GET 请求（设置 User‑Agent、超时 8s、最大响应体积 2MB）。遵守 robots.txt（可预检查或直接依赖网站响应）。跳过需登录或返回 403 的页面。从 HTML 中提取正文文本：优先查找 `<article>`、`<main>` 标签，其次使用可读性算法（如 Mozilla Readability），去除导航、广告等。将正文截取至 3000 字符。

#### （5）内容分析与信息提取

为每页正文调用 LLM，提示词："从以下网页内容中，提取与问题'q'直接相关的关键事实、观点、数据。用中文简练总结，不超过3句话，并保留原文最重要的引用句。"得到结构化摘要，生成新信息条目，包含：

```
source_url, title, snippet, extracted_content, summary, relevance_score
```

#### （6）信息融合与采纳

将新条目与 knowledge 池合并。对于每条新条目：

- 若 URL 已存在且内容高度相似（可用摘要文本相似度判断）→ 丢弃。
- 若包含已有条目未覆盖的新事实、新数据、不同视角 → 采纳，并存入 knowledge。

可通过 LLM 简单判断："新旧信息是否重复？是/否"。

#### （7）充分性判断

将原始 `query` 和当前 knowledge 摘要（所有采纳条目的 summary 拼接）发送给 LLM，询问：

> 已知信息是否足以完整、准确、可靠地回答该问题？回答"充分"或"不充分"，并列出仍缺失的关键信息点（以 JSON 数组形式）。

- 若"充分"，退出循环，转向最终回答生成。
- 若"不充分"，LLM 返回缺失信息点列表 `gaps`。

#### （8）生成下一轮子问题

根据 `gaps` 和已有 knowledge，调用 LLM 生成 1‑3 个新的具体搜索子查询（如"X 的副作用有哪些 2025"），追加到 `sub_queries` 队列。过滤掉与历史查询高度重复的条目。同时，本轮若未获得任何有效新信息，也提前结束循环（防止空转）。

`round++`，回到第 5.2 步。

### 5.3 最终回答生成

汇总 knowledge 中所有采纳信息，发送给 LLM，要求基于这些信息生成对原始 `query` 的详细回答，并严格标注每条信息的引用来源（格式：`[标题](URL)`）。

返回结构体包含：

- `answer`：回答文本（Markdown 格式）
- `sources`：列表，每项含 title、url、relevance（high/medium）
- `rounds_used`：实际花费轮次
- `sufficient`：信息是否充分（bool）
- `engine_stats`：各搜索引擎调用次数、成功次数的简要统计（便于诊断）

## 6. 多搜索引擎适配器设计

为支持不同搜索引擎，定义一个通用接口，内部实现对应 API 调用。配置层面允许环境变量或运行时参数选择引擎。

```typescript
interface SearchEngine {
  name: string;
  search(query: string, options?: { maxResults?: number }): Promise<SearchResult[]>;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}
```

- **Tavily 适配器**：复用现有 `callTavilySearch`，但改造为返回 `SearchResult[]`。
- **Google 自定义搜索**：通过 Google Custom Search JSON API。
- **Bing 搜索**：通过 Bing Web Search API。
- **SerpAPI**：兼容多个底层引擎的聚合器。

每个适配器需处理配额、速率限制和错误。

初始化时，根据参数 `engines` 或全局配置动态实例化对应的适配器列表。搜索时，对所有适配器发出并发请求，使用 `Promise.allSettled` 收集结果。

## 7. 关键函数与模块划分

- `mergeSearchResults(engineResults)`：合并多个引擎的结果，按 URL 去重，优先保留 snippet 更长的版本。
- `evaluateRelevanceBatch(candidates, query)`：批量评估相关性（调用 LLM 或规则），返回带评分的结果列表。
- `fetchAndExtractText(url)`：通用抓取+正文提取，需处理常见反爬（如设置 Cookie、Referer，逐步完善）。
- `summarizePage(content, focusQuery)`：针对 `focusQuery` 提取摘要，见流程 5.2 第5步。
- `isSufficient(query, knowledge)`：充分性判断，见流程 5.2 第7步。
- `generateSubQueries(query, gaps, knowledge)`：生成下一轮搜索子查询。
- `useAgentReach(query, context)`：调用 agent-reach 技能接口，外部提供。
- `fallbackSiteDecision(query)`：当 agent-reach 不可用时的规则决策。

## 8. 数据结构

### Knowledge 条目

```typescript
{
  source_url: string;
  title: string;
  snippet: string;
  extracted_content: string;
  summary: string;
  relevance_score: number;
  adopted: boolean;
  source_engine?: string; // 来自哪个搜索引擎
}
```

### 搜索结果候选项

```typescript
{ title, url, snippet, engine }
```

### 工具返回结构

见 5.3。

## 9. 充分性判断标准（LLM 提示用）

同原版，略。

## 10. 错误处理与边界情况

- **多引擎全部故障**：标记本轮无结果，若连续两轮无新信息，则强制终止循环并生成基于已有知识的回答。
- **单页面抓取失败**：不阻塞流程，记录错误并跳过该 URL。
- **低质量或无结果**：适当降低筛选阈值，最少保留一条候选。
- **递归保护**：同一 URL 不重复抓取；同一子查询不重复搜索；设置总执行时间上限（如 90s），超时退出并给出当前最佳回答。
- **Robots 与合规**：可集成 robots.txt 检查库或简单基于响应状态跳过。
- **面向 Agent 调用**：返回结构严格遵循定义的 JSON Schema，便于程序解析。answer 中引用格式统一。

## 11. 实现注意事项

- 设计为独立的 `web_search_pro` 工具，不修改原有 `web_search`。
- 多引擎支持通过配置实现，在 `pi.registerTool` 执行时可读取环境变量（如 `SEARCH_ENGINES="tavily,google"`）作为默认值，参数 `engines` 可覆盖。
- Agent 调用时可能传入 `context`（如"已知天气查询失败，请搜索备用信息"），该上下文直接注入 knowledge，使搜索更具针对性。
- 所有 LLM 调用应设定结构化输出格式（JSON）以便程序解析，如充分性判断返回 `{"sufficient": false, "gaps": ["2025年税率", "免税额度"]}`。
