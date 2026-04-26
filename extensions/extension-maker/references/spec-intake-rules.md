# Spec Intake Rules

在生成 `extension-generator-spec.json` 时，遵循以下规则：

1. **黑盒分析优先**: 必须先基于 `references/black-box-design-protocol.md` 分析输入/输出/状态。
2. **暴露方式先决**: 必须明确用户选择的暴露方式：`command-only` / `tool-only` / `both`。
3. **需求分类 (Requirement Category)**: 必须在 Step 1 采集阶段判断需求类别，并在 Spec 中显式声明 `requirementCategory`。
4. **Workflow 设计**: 确保步骤清晰 (Start -> Next -> ... -> Done)。
5. **State Model**: 必须定义 `currentStep`、`planningDir`，以及本次实现所需的 `exposureMode`。
6. **Isolation**: 工具名必须包含唯一 slug 前缀。
7. **Review**: 如果用户要求高质量交付，必须开启 `review.enabled: true`。

## 需求分类体系 (Requirement Categories)

生成 Spec 前，必须将用户需求归类到以下 **5 类之一**：

| 类别 | 信号词 | 示例 |
|------|--------|------|
| `simple-tool` | 单输入→单输出、无状态、无多步 | "格式化 JSON"、"复制到剪贴板" |
| `provider-wrapper` | 封装外部 API/CLI、薄转换层 | "封装 Tavily API"、"基于 curl 的抓取器" |
| `stateful-workflow` | 多步用户交互流程、状态机、用户确认 | "多步设置向导"、"交互式代码审查" |
| `recursive-research-engine` | 多轮自主循环、知识积累、充分性判断、缺口检测 | "递归网络研究员"、"深度分析引擎" |
| `multi-agent-orchestrator` | 协调多个子 Agent、委派、聚合 | "专业 Agent 团队"、"委派任务路由器" |

### 分类判定规则
- 若需求描述中出现 **循环/递归/多轮/反复/迭代** → 至少 `recursive-research-engine`
- 若需求描述中出现 **知识池/知识库/积累/记忆** → 至少 `recursive-research-engine`
- 若需求描述中出现 **充分性/是否足够/判断/决策** → 至少 `recursive-research-engine`
- 若需求描述中出现 **缺口/补充/子查询/进一步搜索** → 至少 `recursive-research-engine`
- 若需求描述中出现 **多个 Agent / 委派 / 协调 / 分工** → `multi-agent-orchestrator`
- 若需求描述中出现 **多步流程 / 状态机 / 用户确认点** → `stateful-workflow`
- 若需求仅为调用外部 API 并返回结果 → `provider-wrapper`
- 若需求为简单输入输出转换 → `simple-tool`

**关键原则**: 宁可高估不可低估。若信号词命中多个类别，选择更复杂的那个。

## 各分类的 Mandatory Spec Fields

### 所有分类必须包含（当前基线）
- `slug`, `name`, `description`, `userGoal`, `exposureMode`, `blackBoxAnalysis`, `workflow`, `interfaces`, `isolation`, `review`

### `stateful-workflow` 及以上必须额外包含
- `requirementCategory`: 5 类之一
- `complexityTier`: `"simple" | "moderate" | "complex" | "system"`
  - `simple-tool` → `"simple"`
  - `provider-wrapper` → `"simple"` 或 `"moderate"`
  - `stateful-workflow` → `"moderate"`
  - `recursive-research-engine` → `"system"`
  - `multi-agent-orchestrator` → `"system"`
- `orchestrationRequirements`: 数组，描述需要的控制流结构（循环、状态机、协调等）
- `mandatoryBehaviors`: 数组，列出实现中 **必须** 存在的行为（每个行为必须是可验证的）
- `terminationCriteria`: 描述系统如何/何时决定停止（对于有循环或状态机的需求）

### `recursive-research-engine` 和 `multi-agent-orchestrator` 还必须额外包含
- `knowledgeModel`: 跨轮次积累的知识/信息结构
- `roundControl`: { maxRounds, sufficiencyCheck, gapDetection, subqueryStrategy }
- `multiRoundLoop`: 明确描述主编排循环的进入条件、循环体、终止条件

## Spec Schema 示例（recursive-research-engine 分类）

```json
{
  "requirementCategory": "recursive-research-engine",
  "complexityTier": "system",
  "orchestrationRequirements": [
    { "type": "main-loop", "description": "主循环：搜索→评估充分性→检测缺口→生成子查询→积累知识→循环直到充分或达到最大轮次" },
    { "type": "knowledge-accumulation", "description": "知识池：跨轮次存储已发现事实、已验证来源、待解答问题" }
  ],
  "mandatoryBehaviors": [
    "多轮递归搜索，至少支持 N 轮迭代",
    "每轮结束时执行充分性判断",
    "检测知识缺口并生成针对性子查询",
    "维护跨轮次知识池",
    "达到充分标准或最大轮次时终止"
  ],
  "terminationCriteria": "当知识池中所有关键问题已被充分回答，或达到最大轮次限制时终止循环",
  "knowledgeModel": {
    "pool": "已发现的事实与引用",
    "gaps": "待解答的问题列表",
    "verifiedSources": "已验证来源列表"
  },
  "roundControl": {
    "maxRounds": 5,
    "sufficiencyCheck": "评估当前知识是否覆盖所有关键问题",
    "gapDetection": "比较已知与未知，识别缺口",
    "subqueryStrategy": "针对每个缺口生成定向子查询"
  },
  "multiRoundLoop": "进入条件: 初始查询已接收且有未解答问题; 循环体: 搜索→积累→评估; 终止条件: 充分或达最大轮次"
}
```

参考 Schema: `extension-generator-spec.schema.json`.
