---
name: agent-web-search-pro
description: 增强型 Web 搜索扩展。适用于通用网页搜索、读取 URL 正文、站点定向搜索（GitHub / YouTube / Twitter / V2EX 等）、多轮检索与结构化来源输出。支持命令态与工具态双暴露，优先返回精简摘要，并强调严格来源引用、状态恢复与稳定降级。
---

# agent-web-search-pro

这是一个面向 Agent 与人类用户的增强型 Web 搜索扩展。

## 适用场景
- 用户要求“搜索网页 / 查资料 / 找来源”
- 用户提供 URL，希望读取并提取正文
- 需要按站点定向搜索，如 GitHub、YouTube、Twitter、V2EX
- 需要先搜索，再对候选结果做进一步阅读
- 需要结构化结果：标题、链接、摘要、来源
- 需要适配 Agent / workflow 的程序化调用

## 暴露方式
本扩展采用 `both`：
- **命令态**：`/web-search-pro`
- **工具态**：`ext_agent_web_search_pro_search`
- **辅助工具**：`ext_agent_web_search_pro_reset_state`

## 当前实现状态
当前版本已实现：
- 命令与工具双入口
- 搜索 / URL 阅读 / 站点搜索模式识别
- 外部状态文件 `.state.json`
- `session_start` 时的状态校验与损坏恢复
- 输出截断保护，避免超长文本结果
- 严格的降级输出策略：未接入真实搜索/抓取 adapter 时，不伪造来源
- 工具执行中保留“真实异常抛出”与“无 adapter 的降级返回”区分

当前版本仍未内置真实联网 adapter，因此实际搜索与抓取能力需要在后续实现中接入。

## 使用方式
### 命令
```text
/web-search-pro <query-or-url>
```

示例：
```text
/web-search-pro 最新的 Pi extension 文档
/web-search-pro https://example.com/article
```

### 工具
工具名：`ext_agent_web_search_pro_search`

建议输入字段：
- `query?: string`
- `url?: string`
- `site?: string`
- `language?: string`
- `limit?: number`
- `deepRead?: boolean`
- `sort?: string`

## 输出原则
- 默认返回精简摘要
- 优先给出结构化来源
- 没有来源时必须明确说明是降级结果
- 避免输出无来源结论
- 超长文本结果会被截断，并追加截断提示

## 状态与恢复
状态文件：`.state.json`

保存内容包括：
- `currentStep`
- `startedAt`
- `exposureMode`
- `lastQuery?`
- `lastUrl?`
- `lastMode?`
- `lastResultCount?`

如果状态文件损坏或结构非法，扩展会在会话启动时自动回退到默认状态。

## 相关文件
- `index.ts`：扩展入口
- `implementation-method.json`：基于官方 docs 推导的实现契约
- `references/usage.md`：用法说明
- `references/architecture.md`：结构与状态模型
- `references/future-adapter-notes.md`：真实搜索/抓取 adapter 接入说明
- `references/codegen-mapping.md`：本地 spec->code 映射
- `references/review-rules.md`：动态审查规则
