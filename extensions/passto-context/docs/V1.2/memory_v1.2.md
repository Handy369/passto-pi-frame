# PasstoContext Memory / SummaryWarehouse 模块设计

> 版本：v1.2 | 状态：current | 更新：2026-05-14

---

## 1. 概述

PasstoContext Memory / SummaryWarehouse 模块解决一个问题：

**让 PasstoContext 在当前 session 内，能够检索已被 `summaryCache` 挤出上下文的历史 `summaryEntry`。**

本模块不是通用 memory 重构，也不是跨会话知识库建设。它为当前 session 补齐最小可用的"历史摘要检索"能力，形成 `SummaryEntry → SummaryCache → Summary 仓库(当前 session) → Generator 按需检索` 完整闭环。

---

## 2. 设计边界

### 2.1 In Scope

- Curator 产出的 `summaryEntry` 补齐 session 定位信息
- 为当前 session 建立可检索的 Summary 仓库视图
- 给 Generator 注入"可以按需检索历史摘要"的运行时指引
- 提供最小检索工具 `ptc_search_summary`，供 Generator 搜索当前 session 历史 `summaryEntry`

### 2.2 Out of Scope

- 跨 session 搜索
- 接入 `memory.ts / memory-index.ts` 现有 YAML memory 体系
- embeddings / 向量检索 / 语义召回
- 自动把 Summary 仓库全文注入 prompt
- 新建独立持久化数据库或额外 summary 文件
- 直接恢复完整原始对话正文的工具

---

## 3. SummaryEntry 落地信息格式

每个 `summaryEntry` 在写入 `grc-curator-artifact` 前，由运行时补齐以下 session 定位字段：

### 3.1 必填字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `sessionFile` | `string` | 当前 session 文件路径，取自 `ctx.sessionManager.getSessionFile()` |
| `sessionEntryRange.startAgentEntryIndex` | `number` | 该轮 agent round 对应的 branch 起始 entry 索引 |
| `sessionEntryRange.endAgentEntryIndex` | `number` | 该轮 agent round 对应的 branch 结束 entry 索引 |

### 3.2 可选字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `sessionPointers.file` | `string` | 冗余的 session 文件引用 |
| `sessionPointers.searchQuery` | `string` | 检索友好关键词，由 Curator LLM 生成 |

### 3.3 设计原则

- **定位字段不由 Curator LLM 生成**。`sessionEntryIndex` 属于运行时事实，应由 extension 基于 `ctx.sessionManager.getBranch()` 计算。
- 辅助函数 `findAgentRoundBoundaryByRound(branch, agentRound)` 从 `grc-context-manager.ts` 提供，返回 `startEntryIndex`、`endEntryIndex`、`agentRound`。
- 补齐发生在 `index.ts` 中 Curator 完成后、`appendCuratorArtifactEntry(...)` 之前。

---

## 4. Summary 仓库架构

### 4.1 整体链路

```
evict（SummaryCache 挤出）→ 仓库（branch 中的 grc-curator-artifact）→ 检索（ptc_search_summary 工具）
```

### 4.2 仓库底表

仓库不引入新的物理存储，而是以逻辑查询层的方式构建：

```
当前 session Summary 仓库
= 当前 session branch 中全部 grc-curator-artifact.summaryEntry
```

- `summaryCache` 继续作为近期注入窗口
- 历史 `summaryEntry` 继续存放在当前 session 的 `grc-curator-artifact` 中
- "Summary 仓库"是建立在 branch 历史之上的**逻辑查询层**

优点：
1. 不需要新持久化格式
2. 不需要迁移历史文件
3. 不需要改 restore 主链
4. 最小成本获得当前 session 内历史摘要检索能力

### 4.3 模块划分

| 模块 | 文件 | 职责 |
|---|---|---|
| 仓库构建 | `summary-warehouse.ts` | 从 branch 提取全部 `summaryEntry`，构建可查询仓库视图 |
| 检索逻辑 | `summary-warehouse.ts` | 关键词匹配、排序、limit |
| 工具注册 | `index.ts` | 注册 `ptc_search_summary` 工具 |
| 定位补齐 | `index.ts` + `grc-context-manager.ts` | Curator 结果落库前补齐 session 定位字段 |

---

## 5. 仓库存储与检索逻辑

### 5.1 仓库构建

- 通过 `ctx.sessionManager.getBranch()` 获取当前 session branch
- 过滤 `customType = grc-curator-artifact` 的 entry
- 提取其中的 `summaryEntry` 集合
- 按 `agentRound` 去重（同一 round 多条时，保留最新/最完整条目）

### 5.2 检索策略

第一版采用简单关键词匹配，拼接以下字段参与搜索：

- `summary.goal`
- `summary.completed`
- `summary.keyDecisions`
- `summary.status`
- `summary.blockers`
- `summary.filesChanged.path`
- `sessionPointers.searchQuery`

### 5.3 排序原则

1. 先按命中数 / 命中字段数排序
2. 同分时按 `agentRound` 降序（优先返回较新的摘要）

---

## 6. ptc_search_summary 工具设计

### 6.1 输入契约

```json
{
  "query": "summaryCache evict",
  "limit": 5
}
```

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | `string` | 是 | 搜索关键词 |
| `limit` | `number` | 否 | 返回结果数量上限，默认 5 |

### 6.2 输出契约

每个命中项返回以下字段：

- `agentRound`
- `timestamp`
- `summary.goal`
- `summary.completed`
- `summary.keyDecisions`
- `summary.status`
- `summary.blockers`
- `summary.filesChanged`
- `sessionFile`
- `sessionEntryRange`
- `sessionPointers.searchQuery`

### 6.3 工具行为

1. 读取 `ctx.sessionManager.getBranch()`
2. 提取当前 session 全部历史 `summaryEntry`
3. 执行关键词匹配搜索
4. 返回 top N 结果

第一版不返回完整原始对话正文，不自动根据 `sessionEntryRange` 反查拼接全文。

---

## 7. Generator 运行时指引注入

### 7.1 注入位置

在 `before_agent_start` 钩子中注入 system prompt 片段。

### 7.2 注入文案

```md
--- 当前会话历史摘要检索 ---
- SummaryCache 只包含近期窗口。
- 如果需要回忆已被压缩出上下文的当前会话历史，可调用工具 `ptc_search_summary` 搜索当前 session 的 Summary 仓库。
- 查询词优先使用：目标、文件路径、关键决策、报错词、blocker。
--- 历史摘要检索结束 ---
```

### 7.3 设计原则

- 只注入**工具使用规则**，不注入整个 Summary 仓库内容
- 避免把"按需检索"重新做成"全量被动注入"
- 保持文案简短（2~3 条规则），不污染主 prompt

---

## 8. 验收标准

### 8.1 功能验收

**验收 A：定位信息存在**

任意新生成的 `grc-curator-artifact.summaryEntry` 中应包含：
- `sessionFile`
- `sessionEntryRange.startAgentEntryIndex`
- `sessionEntryRange.endAgentEntryIndex`

**验收 B：历史摘要不因 cache eviction 丢失**

在 `summaryCacheSize = N` 时，生成 `N + 2` 个 round 的摘要后：
- 最老条目不再出现在 `summaryCache` 中
- 但仍可通过 `ptc_search_summary` 检索到

**验收 C：Generator 知道可检索历史摘要**

`before_agent_start` 注入内容中应明确说明：
- `SummaryCache` 是近期窗口
- 历史摘要可通过 `ptc_search_summary` 搜索

**验收 D：工具结果可回指当前 session**

`ptc_search_summary` 返回结果中，命中项应包含：
- `sessionFile`
- `sessionEntryRange`

### 8.2 建议测试场景

**场景 1：按目标检索**

查询 `PasstoContext 记忆系统` 或 `summary 仓库`，预期命中相关轮次的 `summary.goal / status / keyDecisions`。

**场景 2：按文件路径检索**

查询 `index.ts` 或 `grc-state.ts`，预期命中包含对应 `filesChanged.path` 的摘要。

**场景 3：按问题词检索**

查询 `evict`、`summaryCache`、`generator`，预期命中讨论 cache / 检索 / 注入链路的历史摘要。

---

## 9. 风险与控制

| 风险 | 原因 | 控制措施 |
|---|---|---|
| branch 中历史 artifact 提取重复 | restore replay 与运行时 state 更新并存 | 构建时按 `agentRound` 去重，同 round 优先保留最新条目 |
| sessionEntryRange 计算错误 | round 边界与 previous-round 对应关系处理不严谨 | 基于 `findAgentRoundBoundaries(...)` 结果计算，只为 `targetPreviousAgentRound` 对应 boundary 落点 |
| 工具指引过长，污染主 prompt | 注入内容过多 | 仅保留 2~3 条最小使用规则，不注入历史内容本身 |
| 过早耦合 `memory.ts` | 设计边界不清 | 明确禁止接入 `memory.ts / memory-index.ts`，当前 session Summary 仓库单独实现 |

---

## 10. 非目标确认

本模块完成后，系统**仍然不会**具备以下能力：

- 跨 session 搜索历史摘要
- 统一 session summary 与 YAML memory 的大一统仓库
- 通过工具直接恢复完整原始对话文本
- 自动 embedding / 语义召回

这些能力若后续需要，应另开设计，不应混入本模块。

---

*版本：memory_v1.2 | 更新时间：2026-05-14*
