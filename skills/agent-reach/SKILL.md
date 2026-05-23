---
name: agent-reach
description: >
  互联网研究、网页读取与多平台信息提取技能。当前搜索主链路已内置稳定的
  DeepSeek smart-search（由 agent-browser 驱动网页版 DeepSeek）并统一输出
  research-v1 contract；网页读取、GitHub、视频字幕、社交平台提取继续按平台路由。

  使用此技能的场景：
  用户想要从互联网查找、阅读或提取信息，包括：研究问题搜索、新闻/文章/产品调研、
  查询 GitHub 代码仓库、从 URL 读取网页内容、获取视频信息或字幕、在社交平台搜索帖子、
  搜索股票/财经数据、或转录播客音频。

  应优先触发的场景：
  1. 用户分享了一个 URL 并要求阅读、提取信息，或明确表示需要从互联网获取数据。
  2. 用户提出研究问题，希望得到带来源的结构化搜索结果。
  3. 提及以下平台：Twitter、GitHub、YouTube、V2EX 等公开互联网平台的阅读或搜索。

  不要在以下场景触发：
  用户想要创建或编辑代码、询问本地文件、仅进行不需要互联网数据的对话、
  明确表示不需要联网，或当前主目标其实是 web 应用运行态调试 / 测试验证
  （该场景应转到 browser-runtime-observation）。
---

# Agent Reach — 互联网信息访问路由器

> **last_verified: 2026-05** | 如遇工具行为异常，请检查各 references/ 中的平台说明

## Overview

提供对全互联网的搜索、阅读、提取能力，覆盖 Twitter、GitHub、YouTube、V2EX 等平台，SKILL.md 包含路由决策树和常用工具索引，复杂场景需按需阅读对应分类的 references/*.md。

当前搜索主链路已升级为统一 research 输出：优先走 `scripts/research-search.sh`，默认使用 DeepSeek smart-search，失败时自动回退 Exa `--research`。DeepSeek 主链路已完整内聚到当前 skill（`scripts/deepseek-search.sh` + `scripts/deepseek_search_runner.py`），由 `agent-browser` 驱动网页版 DeepSeek，并把运行证据、回答抽取、source recovery、normalization 全部落在本 skill 内。输出 contract 已对齐 `research-v1`，除 `coreFindings` / `evidencePoints` / `sourceLinks` 外，还支持 `citationsByFinding`、`uncertaintyStructured`、canonical `sourceLinks` 收敛，以及可选 `sourcePageExcerpts`。

## Current Capability Boundary

### 当前稳定能力
- 统一搜索入口：优先使用 `scripts/research-search.sh`，默认 DeepSeek → Exa fallback
- 自包含 DeepSeek 主链路：`scripts/deepseek-search.sh` 调用 `scripts/deepseek_search_runner.py`，不再依赖外部 `browser-test` runner
- 统一输出契约：返回 `research-v1` 结构化结果，而不是只返回原始搜索命中
- 运行证据留存：DeepSeek 路径会把截图、DOM probe、HAR、原始抽取结果、normalized research 输出写入 `~/.agent-reach/`
- 来源精修：支持 `SOURCE_SITES`↔`SOURCE_URLS` 配对、canonical `sourceLinks` 收敛、父路径/泛路径去重
- 引用精修：支持 `citationsByFinding`，尽量为每条 finding 选择最相关的单条 canonical source URL
- 风险表达：支持 `uncertaintyStructured`，将不确定性拆成 `conflicts` / `stalenessRisks` / `coverageGaps` / `general`
- 非结构化兜底：即使 DeepSeek 没有输出完整 section，仍会尝试 answer candidate 聚合、source section recovery 与非结构化 answer 归纳

### 当前已知边界
- DeepSeek 路径依赖网页版可访问性、可交互性与已登录态；匿名态/无专用 profile 时不保证稳定可用
- DeepSeek 路径依赖本机已安装 `agent-browser`；若缺失则只能走 Exa fallback
- Exa fallback 默认从 `~/.agent-reach/env` 自动加载 `EXA_API_KEY` / `AGENT_REACH_EXA_API_KEY`；若未配置则 fallback 不保证可用
- `sourcePageExcerpts` 为可选增强项；若未启用或抓取失败，不影响主 contract，但证据摘录会减少
- 当上游回答未明确声明来源、或 source section 被严重截断时，`citationsByFinding` 仍可能退化为“基于 best-effort 的近似映射”
- `sourceLinks` 现已优先保留高置信 canonical 来源，但不等于对每个 research 问题都能拿到完美、完整、无歧义的来源集合
- 本 skill 不负责 web 应用运行态调试、console/network/perf 诊断；该类任务应转到 `browser-runtime-observation`

### 使用建议
- 默认把 DeepSeek 路径视为“高质量研究输出优先”，把 Exa 视为“稳定 fallback / 英文技术搜索补位”
- 对需要 downstream agent 精确引用的任务，优先消费 `citationsByFinding`，不要只看 `sourceLinks`
- 对高风险任务，不要只信 `coreFindings`；应同时检查 `uncertaintyStructured` 与 `sourceLinks`
- 如需排查某个 web 页面当前到底渲染了什么、请求了什么、报了什么错，不要继续停留在本 skill，应切到 `browser-runtime-observation`

---

## Quick Reference

| 任务 | 工具 | 详细文档 |
|------|------|----------|
| 读取/搜索网页 | DeepSeek smart-search / Jina Reader / Exa Search API | → [web.md](references/web.md) |
| 互联网研究 / 英文 / 技术 / 代码搜索 | `scripts/research-search.sh`（DeepSeek → Exa fallback） | → [search.md](references/search.md) |
| GitHub 仓库/Issue/PR/代码 | gh CLI | → [dev.md](references/dev.md) |
| YouTube/B站字幕/播客转录 | yt-dlp / bili-cli | → [video.md](references/video.md) |
| Twitter/X 推文/时间线 | twitter CLI | → [social.md](references/social.md) |
| 小红书笔记/评论 | xhs CLI | → [social.md](references/social.md) |
| 抖音视频解析 | douyin MCP | → [social.md](references/social.md) |
| V2EX 帖子/API | curl / API | → [social.md](references/social.md) |
| Reddit 帖子/搜索 | rdt CLI | → [social.md](references/social.md) |
| LinkedIn 资料/职位/人才 | linkedin MCP | → [career.md](references/career.md) |

---

## 路由决策树

### Q1: 用户提供了 URL？

- **是** → 直接用对应平台工具读取（见下方 URL 路由表）
- **否** → Q2

### Q2: 用户需要搜索？

- **是** → 优先走 `scripts/research-search.sh`；其内部默认 DeepSeek smart-search（agent-browser 驱动网页版 DeepSeek）并自动在失败时回退 Exa
- **否** → Q3

### Q3: 用户指定了平台？

- **是** → 查平台路由表，跳到对应 references/
- **否** → 默认先用 `scripts/research-search.sh`；只有 DeepSeek 不可用或未满足来源 gate 时才降级到 Exa

### Q4: 涉及多个平台/复合意图？

- **是** → 按优先级依次 read 对应的 references/，合并结果
- **否** → Q5

### Q5: 工具执行失败？

- **是** → 从 Fallback 降级链（见下方）尝试下一个工具
- **否** → Q6

### Q6: 所有渠道均失败？

- **是** → 明确告知用户，说明尝试了哪些工具及失败原因
- **否** → 验证输出后返回

#### URL 路由表

| URL 特征 | 工具 | 详细文档 |
|----------|------|----------|
| GitHub 仓库/Issue/PR | `gh repo view` / `gh issue view` | [dev.md](references/dev.md) |
| 微信公众号 | Exa MCP 或 Camoufox | [web.md](references/web.md) |
| YouTube/B站/抖音视频 | `yt-dlp --dump-json` | [video.md](references/video.md) |
| 通用网页 | `curl r.jina.ai/URL` | [web.md](references/web.md) |
| 其他平台 | 查平台路由表 | 见下方 |

#### 平台路由表

| 平台 | 详细文档 |
|------|----------|
| Twitter/X | [social.md](references/social.md) |
| 小红书 | [social.md](references/social.md) |
| 抖音 | [social.md](references/social.md) |
| V2EX | [social.md](references/social.md) |
| Reddit | [social.md](references/social.md) |
| B站（字幕/元数据）| [video.md](references/video.md) |
| B站（内容/评论）| [social.md](references/social.md) |
| YouTube | [video.md](references/video.md) |
| GitHub | [dev.md](references/dev.md) |
| LinkedIn | [career.md](references/career.md) |
| 通用网页/RSS | [web.md](references/web.md) |

---

## Fallback 降级链

当首选工具失败时，按以下顺序降级：

### 网页读取

1. `curl -s "https://r.jina.ai/URL"` — Jina Reader（推荐）
2. `mcporter call 'web-reader.webReader(...)'` — Web Reader MCP
3. `curl -s "URL"` — 原始 curl（内容可能不干净）
4. 告知用户该 URL 无法读取，提供原始 URL

### 搜索

统一入口：`scripts/research-search.sh`

1. DeepSeek smart-search（`scripts/deepseek-search.sh`）
2. Exa Search API research fallback（`scripts/exa-search.sh --research`）
3. 智谱搜索（MCP）
4. 告知用户搜索不可用

默认目标是产出 `research-v1` 结构化结果，而不是仅返回原始搜索命中。优先保留：
- `coreFindings`
- `evidencePoints`
- `sourceLinks`
- `citationsByFinding`
- `uncertaintyStructured`

### 视频字幕

1. 字幕轨道（`--write-sub`，最可靠）
2. 自动字幕（`--write-auto-sub`，可能有重复行）
3. 仅获取元数据（`--dump-json`）— 最后手段

### 平台工具

1. 平台 CLI（gh, yt-dlp, xhs, twitter, rdt）— 首选
2. MCP 工具（douyin, linkedin-scraper 等）— 备选
3. Jina Reader — 通用兜底
4. 告知用户该操作不可用

### 通用原则

- 每个降级步骤记录失败原因
- 返回结果时说明使用了哪个渠道
- 若所有渠道均失败，明确告知用户

---

## 详细文档索引

根据需求阅读对应文档（按需加载，不要一次性读完）：

| 文档 | 覆盖范围 | last_verified |
|------|----------|---------------|
| [references/search.md](references/search.md) | DeepSeek / Exa Search API 搜索 | 2026-05 |
| [references/web.md](references/web.md) | 通用网页、公众号、RSS | 2026-05 |
| [references/video.md](references/video.md) | YouTube、B站字幕、播客转录 | 2025-04 |
| [references/dev.md](references/dev.md) | GitHub CLI | 2025-04 |
| [references/social.md](references/social.md) | Twitter、小红书、抖音、V2EX、Reddit | 2025-04 |
| [references/career.md](references/career.md) | LinkedIn | 2025-04 |

---

## Best Practices

### ✅ DO

- **互联网资料搜索优先走统一入口**：优先使用 `scripts/research-search.sh`，其内部默认 DeepSeek → Exa research fallback
- **DeepSeek 运行证据默认写到 `~/.agent-reach/`**：不要把这类临时/运行态产物写进用户业务仓库
- **Exa key 优先放在 `~/.agent-reach/env`**：由 `deepseek-search.sh` / `research-search.sh` / `exa-search.sh` 自动加载；建议文件权限保持 `600`
- **优先返回结构化 research contract**：搜索结果默认保留 `research-v1` 字段；只有用户明确要简洁可读文本时再使用 `--text`
- **优先相信结构化来源声明**：当 DeepSeek answer 中存在 `[SOURCE_SITES]` / `[SOURCE_URLS]` 时，应以这些 canonical 来源为主，而不是页面上顺手出现的额外链接
- **优先使用零配置渠道**：Jina Reader、gh CLI、yt-dlp、rdt 都是开箱即用
- **网页阅读用 Jina Reader**：`curl -s "https://r.jina.ai/URL"` 比直接 curl 更干净
- **GitHub 操作用 gh CLI**：已认证用户可获得更完整的数据
- **视频字幕用 yt-dlp**：支持 YouTube、B站、抖音等平台
- **先测试命令再返回结果**：确保命令能正常执行
- **使用 `/tmp/` 存储临时文件**：不要污染用户的工作区

### ❌ DON'T

- **不要在用户 workspace 创建文件**：临时文件用 `/tmp/`，持久数据用 `~/.agent-reach/`
- **不要假设用户已登录**：大多数渠道支持公开访问
- **不要返回原始命令输出**：先解析 JSON，整理成易读的格式
- **不要忽略错误信息**：如 "command not found"，先检查工具是否安装

---

## Common Pitfalls

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `curl: command not found` | curl 不可用 | 使用 `python3 -c "import urllib.request; ..."` 替代 |
| `gh: command not found` | gh CLI 未安装 | 使用 Jina Reader 读取 GitHub 页面 |
| `rdt: command not found` | rdt CLI 未安装 | 改用 Reddit 公开 API |
| `yt-dlp: command not found` | yt-dlp 未安装 | `pip install yt-dlp` 或 `brew install yt-dlp` |
| `No subtitles found` | 视频无字幕 | 尝试获取视频描述或自动字幕 |
| `Rate limit exceeded` | API 限流 | 添加 `--delay` 或等待后重试 |
| `Access denied` | 需要认证 | 询问用户是否提供 cookies |
| `403 Forbidden` | 服务器 IP 被封 | 使用代理或跳过该平台 |
| DeepSeek 聊天页无输入框 | 未登录、页面改版或被风控 | 优先检查登录态/profile，再降级到 Exa |
| `agent-browser: command not found` | 本机缺少执行器 | 安装 `agent-browser`，否则只能走 Exa fallback |
| `missing EXA_API_KEY` / Exa fallback unavailable | 未配置 `~/.agent-reach/env` 或 key 不可用 | 在 `~/.agent-reach/env` 中设置 `EXA_API_KEY=...`，并保持权限 `600` |
| Exa fallback failed: `HTTP 401/429/5xx` | key 无效、限流或上游异常 | 查看 `summary` 中透传的 Exa 错误摘要，先修 key / 重试 / 降级 |

---

## Verification

### 渠道状态检查

```bash
~/.local/pipx/venvs/agent-reach/bin/agent-reach doctor
```

### 预期输出示例

**成功**：返回搜索结果列表
**失败**：返回错误信息或空结果

### 质量检查

- 搜索结果是否相关？
- 网页内容是否完整提取？
- 视频信息是否包含关键元数据？

---

## Channel Configuration

如需配置高级渠道（需要认证的平台）：

| 渠道 | 认证方式 | 配置命令 |
|------|----------|----------|
| Twitter | Cookie | `agent-reach configure twitter-cookies "COOKIE_STRING"` |
| 小红书 | Cookie | `xhs login` 或 `agent-reach configure xhs-cookies` |
| 雪球 | Cookie | `agent-reach configure --from-browser chrome` |
| Groq (播客转录) | API Key | `agent-reach configure groq-key YOUR_KEY` |

安装指南：https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md

---

## Dependencies

核心工具（自动安装）：
- `curl` — 系统自带
- `gh` — GitHub CLI
- `yt-dlp` — 视频下载
- `rdt` — Reddit CLI
- `mcporter` — MCP 客户端
- `twitter` — Twitter CLI

完整安装：`~/.local/pipx/venvs/agent-reach/bin/agent-reach install --env=auto`

---

## Adjacent Track (deferred)

- **web 现状观察 / 开发调试 / 测试验证** 不属于本 skill 的主交付物。
- 该类需求的下一条主线应使用 `browser-runtime-observation`：看 DOM / console / network / performance / screenshot / Lighthouse / a11y 等真实运行态证据；若需要底层原语或专项排障资料，再下钻 `chrome-devtools-mcp`。
- 当前建议：先把 `agent-reach` 的稳定搜索能力收口完成；完成后再单独设计 `browser-runtime-observation` 如何接入现有 CI / 测试验证链路，并由 `chrome-devtools-mcp` 承载底层 reference。
