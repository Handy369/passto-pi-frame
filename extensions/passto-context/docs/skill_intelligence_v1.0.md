# PasstoContext Skill Intelligence / Runtime Proof 模块设计

> 版本：v1.0 | 状态：proposal | 更新：2026-05-16

---

## 1. 概述

Skill Intelligence 是 PasstoContext 面向 **Skill 运行时命中、效果验证、边界冲突识别与新 Skill 机会发现** 的独立设计模块。

它的目标不是替代现有 GRC 主链，也不是让 Reflector 直接生成或修改 Skill，而是为 `skills-maker` 提供一层基于真实运行证据的 **runtime-proof 输入面**。

一句话定义：

> **Skill Intelligence = 基于真实 agent / subagent transcript、skill catalog 与后验用户信号，对 Skill 的命中、效果、边界问题与沉淀机会做长期观察、结构化评估与证据聚合的独立能力层。**

---

## 2. Why

### 2.1 当前缺口

当前 PasstoContext 已具备：

- `before_agent_start -> Curator(previous-round)`
- `agent_end -> Reflector(current-round)`
- `GoalState + SummaryCache + recent raw rounds` 的上下文重建
- principles 的长期治理
- Summary 仓库的按需检索

这些能力足以支持“任务级上下文治理”，但还不能回答以下 Skill 相关问题：

1. 某个 Skill 在真实运行里是否真的被命中？
2. 命中是强命中、弱命中，还是误命中？
3. 命中之后是否真的带来了更好的执行效果？
4. 哪些自然用户请求反复暴露出 Skill 边界缺口？
5. 哪些重复出现的成功模式，已经值得新建 Skill？

---

### 2.2 为什么不能只依赖 benchmark

`skills-maker` 的黑盒盲测可以回答：

- 应命中时是否命中
- 不该命中时是否误命中
- 某次 description / routing 修改后是否通过控制实验

但它不能替代真实运行中的有机证据，因为真实使用环境还包含：

- 更自然的 prompt 分布
- 更复杂的上下文污染与邻接干扰
- subagent / nested transcript 中的真实命中路径
- 用户下一轮的纠偏、补充、继续等后验信号

因此 runtime-proof 必须由两部分构成：

1. **Organic Runtime Proof**：真实运行时观察证据
2. **Controlled Benchmark Proof**：skills-maker 黑盒验证证据

Skill Intelligence 只负责前者，并为后者提供输入素材、证据补强与迭代方向。

---

### 2.3 为什么不能直接扩张 Reflector

根据 `reflector_v1.2.md` 的现边界：

- Reflector 当前职责是目标对齐审计、原则综合与 `reference / script` 级能力候选
- 当前实现明确 **不输出 skill 候选**
- Skill 候选应由未来独立模块结合更长时间窗信号判断

因此，Skill Intelligence 的正确收敛方向不是让 Reflector 越权，而是新增一条独立链路：

- 不改写 GoalState
- 不接管 Curator
- 不把具体 Skill 结论塞进 principles
- 不直接自动写 Skill 文件

---

## 3. What

Skill Intelligence 的主输出不是“修改代码”，而是四类结构化产物：

### 3.1 SkillObservation

单个 agent-round 的 Skill 运行时观察事实。

它只记录**硬证据**，不直接做高层裁决。

例如：

- 读了哪些 `SKILL.md`
- 第一个读到的 Skill 是谁
- 是否在前 1~3 个动作内读取目标 Skill
- 是否来自顶层 agent 还是 subagent
- 是否发生 multi-skill thrash
- 读 Skill 之后前几个动作是什么
- 最终 round 是否成功结束

---

### 3.2 SkillAssessment

对单个 round 的 Skill 表现做分析性结论。

至少分两条轴：

#### A. Routing / Hit 轴

- `strong-hit`
- `weak-hit`
- `missed-positive`
- `false-positive`
- `correct-rejection`
- `boundary-ambiguous`
- `multi-skill-thrash`

#### B. Effect / Outcome 轴

- `effective`
- `partial`
- `ineffective`
- `harmful`
- `unknown`

即：

> 命中与效果是两个不同问题，不能混成单一 verdict。

---

### 3.3 SkillProofAggregate

按 **Skill 版本** 聚合的 runtime-proof 视图。

必须强调：

> runtime-proof 不能只按 skill name 聚合，必须按 `descriptionHash` 或等价版本锚点分桶。

因为 Skill 的 `name / description / examples / boundary wording` 一旦修改，旧证据就不应与新证据直接混合。

---

### 3.4 SkillOpportunity

基于多轮观察与聚合分析产生的 Skill 沉淀机会。

例如：

- `tighten-description`
- `broaden-trigger`
- `add-positive-example`
- `add-negative-example`
- `split-skill`
- `merge-skills`
- `router-skill-opportunity`
- `create-new-skill`
- `retire-skill`
- `needs-benchmark`

这些机会只表达：

- 值得考虑什么改动
- 为什么值得
- 证据在哪里

它们**不是自动执行计划**。

---

## 4. Positioning / 与现有架构的关系

### 4.1 Skill Intelligence 的定位

Skill Intelligence 是 PasstoContext 中与 Curator / Reflector 并列的独立能力层：

- **Curator**：事实归档 + GoalState 更新
- **Reflector**：目标对齐审计 + 原则综合 + `reference/script` 候选
- **Skill Intelligence**：Skill 命中证据 + 效果评估 + 边界冲突 + 新 Skill 机会发现

---

### 4.2 不变量

Skill Intelligence 必须满足以下不变量：

1. **不新增第二个目标真相源**
   - 不替代 `GoalStateDocument`
   - 不维护独立 objective / ledger

2. **不直接改写 Curator / Reflector 主产物**
   - 不覆盖 `summaryEntry`
   - 不覆盖 `goalState`
   - 不覆盖 `reflector diagnosis`

3. **不直接产出 Skill 文件修改**
   - 只输出 observation / assessment / opportunity
   - 实际 Skill 修改仍由 `skills-maker` 或人工完成

4. **不把具体 Skill 结论混入 principles**
   - Skill 命中或某次误命中不属于跨目标方法论原则
   - 仅当抽象出跨技能、跨任务的稳定方法时，才可能进入 principles

5. **不让 organic runtime 证据替代 benchmark**
   - 真实运行证据是补强层，不是控制实验替代物

---

## 5. 非目标

本模块明确不追求以下事项：

1. 直接自动创建或修改 Skill 文件
2. 让 Reflector 直接输出 Skill 候选并落盘
3. 替代 `skills-maker` 的黑盒盲测框架
4. 让主 Agent 在当前任务 prompt 中持续注入 Skill proof 结果
5. 引入 embeddings / 向量检索来做 Skill 召回
6. 把 Skill 统计混入 `GoalStateDocument` 或 Principles Registry
7. 在 v1.0 一步完成完整可视化治理台

---

## 6. Design Principles

### 6.1 先观察，再评估

- `Observation` 记录硬证据
- `Assessment` 基于证据做分析

两者必须分层，避免“分析结论污染原始事实”。

---

### 6.2 先 runtime 证据，再 Skill 机会

SkillOpportunity 必须建立在：

- 多轮 observation
- 可回溯 assessment
- 明确的版本分桶

而不是单轮主观感觉。

---

### 6.3 subagent transcript 必须纳入主证据面

在真实环境下，Skill 命中常发生于 subagent / nested transcript。

因此：

> 只观察顶层 transcript 的实现，属于系统性漏检，不能接受。

---

### 6.4 Skill 版本必须可追踪

Skill 的命中率、误命中率、效果表现都必须按 Skill 版本观察。

版本锚点至少应包含：

- `skillPath`
- `name`
- `descriptionHash`
- `observedAt`

---

### 6.5 真实自然样本优先作为 benchmark 种子

Skill Intelligence 不替代 benchmark，但应为 `skills-maker` 提供：

- 自然正例样本
- 相邻误吸样本
- 边界模糊样本
- 重复未命中样本

从而让 benchmark 更接近真实使用环境。

---

## 7. 六段链定义（Why → What → Structure → Flow → Surface → Runtime Proof）

### 7.1 Why

见第 2 节：补齐 Skill 命中、效果与机会发现的真实运行证据面。

### 7.2 What

见第 3 节：输出 `SkillObservation / SkillAssessment / SkillProofAggregate / SkillOpportunity`。

### 7.3 Structure

见第 8 节：模块边界与数据结构。

### 7.4 Flow

见第 9 节：事件时序与处理流程。

### 7.5 Surface

见第 10 节：命令面、导出面、与 `skills-maker` 的衔接面。

### 7.6 Runtime Proof

见第 11 节：organic proof 与 controlled proof 的双证据闭环。

---

## 8. Structure

### 8.1 模块划分

建议新增以下模块：

| 模块 | 文件 | 职责 |
|---|---|---|
| Skill Catalog | `skill-catalog.ts` | 扫描可用 Skill，提取 `name / description / path / descriptionHash` |
| Skill Observer | `skill-observer.ts` | 从 transcript / nested subagent result 中提取 Skill 读取与首动作证据 |
| Skill Assessor | `skill-assessor.ts` | 基于 observation + user message + skill catalog 做 routing/effect 分析 |
| Skill Proof Registry | `skill-proof-registry.ts` | 按 Skill 版本聚合 proof 数据与机会信号 |
| Skill Review Export | `skill-review-export.ts` | 导出供 `skills-maker` 或人工审阅的 proof/review bundle |

---

### 8.2 推荐数据结构

#### 8.2.1 SkillCatalogItem

```ts
interface SkillCatalogItem {
  skillPath: string;
  skillName: string;
  description: string;
  descriptionHash: string;
  loadedAt: string;
}
```

---

#### 8.2.2 SkillReadEvent

```ts
interface SkillReadEvent {
  skillPath: string;
  skillName?: string;
  descriptionHash?: string;
  source: "top-agent" | "subagent";
  subagentDepth: number;
  toolCallIndex: number;
  actionIndexWithinRun: number;
}
```

---

#### 8.2.3 SkillObservation

```ts
interface SkillObservation {
  version: 1;
  sessionId: string;
  agentRound: number;
  timestamp: string;

  currentUserMessage: string;

  skillReads: SkillReadEvent[];
  firstSkillRead?: SkillReadEvent;
  firstThreeActions: Array<{
    index: number;
    toolName: string;
    summary: string;
  }>;

  targetSkillReadWithinFirst3: boolean;
  multiSkillRead: boolean;
  multiSkillThrash: boolean;
  subagentSkillReadDetected: boolean;

  executionOutcome: {
    completed: boolean | null;
    hasErrorSignal: boolean;
    notes?: string;
  };
}
```

说明：
- `targetSkillReadWithinFirst3` 在一般自然运行里未必总能确定 target，因此可在 v1.0 退化为：
  - `anySkillReadWithinFirst3`
  - `firstSkillReadWithinFirst3`
- 若是 benchmark 或显式针对某 Skill 的评估任务，可再额外挂 `expectedSkillPath`。

---

#### 8.2.4 SkillAssessment

```ts
interface SkillAssessment {
  version: 1;
  sessionId: string;
  agentRound: number;
  timestamp: string;

  observationRef: {
    sessionId: string;
    agentRound: number;
  };

  routingVerdict:
    | "strong-hit"
    | "weak-hit"
    | "missed-positive"
    | "false-positive"
    | "correct-rejection"
    | "boundary-ambiguous"
    | "multi-skill-thrash";

  effectVerdict:
    | "effective"
    | "partial"
    | "ineffective"
    | "harmful"
    | "unknown";

  primarySkillPath?: string;
  adjacentSkillPaths?: string[];

  confidence: number;
  evidence: string[];
  rationale: string;

  nextActionHints?: string[];
}
```

---

#### 8.2.5 SkillProofAggregate

```ts
interface SkillProofAggregate {
  version: 1;
  skillPath: string;
  skillName: string;
  descriptionHash: string;
  firstSeenAt: string;
  lastSeenAt: string;

  totals: {
    observations: number;
    assessments: number;
  };

  routing: {
    strongHit: number;
    weakHit: number;
    missedPositive: number;
    falsePositive: number;
    correctRejection: number;
    boundaryAmbiguous: number;
    multiSkillThrash: number;
  };

  effect: {
    effective: number;
    partial: number;
    ineffective: number;
    harmful: number;
    unknown: number;
  };

  adjacentConfusions: Array<{
    skillPath: string;
    count: number;
  }>;

  samplePrompts: {
    positives: string[];
    negatives: string[];
    boundaries: string[];
  };
}
```

---

#### 8.2.6 SkillOpportunity

```ts
interface SkillOpportunity {
  version: 1;
  id: string;
  timestamp: string;

  type:
    | "tighten-description"
    | "broaden-trigger"
    | "add-positive-example"
    | "add-negative-example"
    | "split-skill"
    | "merge-skills"
    | "router-skill-opportunity"
    | "create-new-skill"
    | "retire-skill"
    | "needs-benchmark";

  relatedSkills: string[];
  confidence: number;
  rationale: string;
  evidence: string[];

  supportingRounds: number[];
  suggestedDeliverable?: "skill" | "benchmark" | "doc";
}
```

---

### 8.3 Artifact 建议

建议新增 custom entry 类型：

- `grc-skill-observation-artifact`
- `grc-skill-assessment-artifact`
- `grc-skill-opportunity-artifact`（可选，按阈值生成）

设计原则：

- Observation 是主证据
- Assessment 是分析层
- Opportunity 是聚合后产物
- 不把这些结构直接混入 `GoalStateDocument` 或 `Principles Registry`

---

## 9. Flow

### 9.1 高层流程

```text
session_start
  ├─ 加载 Skill Catalog Snapshot
  └─ 恢复 Skill proof registry（如存在）

agent_start ... agent_end
  └─ agent_end 后由 SkillObserver 生成 SkillObservation

before_agent_start（下一轮）
  ├─ Curator 处理 previous-round
  ├─ 读取上一轮 SkillObservation
  ├─ 结合当前用户第一条消息与 Curator signal
  └─ 生成上一轮 SkillAssessment

周期性 / 阈值触发
  ├─ 聚合 proof
  ├─ 识别 opportunity
  └─ 导出 review / proof bundle 供 skills-maker 使用
```

---

### 9.2 详细时序

#### A. `session_start`

1. 扫描当前可用 Skill 列表
2. 提取 `name + description + skillPath`
3. 计算 `descriptionHash`
4. 缓存当前 session 的 Skill Catalog Snapshot

目的：
- 后续 observation 与 assessment 都能绑定到 Skill 版本

---

#### B. `agent_end`

SkillObserver 处理当前 round transcript：

1. 抽取 tool calls
2. 识别 `read .../SKILL.md`
3. 递归展开 subagent tool result 中的 nested transcript
4. 提取：
   - 第一个 Skill 读取
   - 前 1~3 个动作
   - 是否多 Skill 读链
   - 是否出现 thrash
5. 生成 `SkillObservation`

这里的实现应优先采用**确定性逻辑**，而不是 LLM 推断。

---

#### C. `before_agent_start`（下一轮）

SkillAssessor 处理上一轮 observation：

输入建议包括：

- `previousRoundObservation`
- `previousRoundConversation`（必要时）
- `currentUserMessage`
- `currentGoalState`
- `curatorSignal`
- `skillCatalogSnapshot`

分析目标：

1. 上一轮是否应该命中某 Skill
2. 命中的 Skill 是否合理
3. 命中后效果如何
4. 若存在问题，属于 missed-positive / false-positive / boundary / thrash 中哪类

注意：

- `currentUserMessage` 与 `curatorSignal` 是 effect 判断的重要后验证据
- 但它们不是唯一证据，不能机械地把 `advance = effective`、`correct = harmful`

---

#### D. 周期性聚合

在以下条件之一满足时，可触发 proof 聚合与机会发现：

1. 某 Skill 在最近窗口中多次被 `missed-positive`
2. 某 Skill 在最近窗口中多次 `false-positive`
3. 相邻两 Skill 重复发生边界混淆
4. 多次出现“无 Skill 读取但模式重复成功”
5. 多次出现 strong-hit 但 effect 为 `partial / ineffective`

---

### 9.3 机会识别规则（建议）

#### 规则 A：Repeated Missed Positive

若同一 Skill 版本在近期窗口内重复出现：

- `missed-positive >= threshold`

则候选：

- `broaden-trigger`
- `add-positive-example`
- `needs-benchmark`

---

#### 规则 B：Repeated False Positive

若某 Skill 反复误吸本应由相邻 Skill 处理的请求，则候选：

- `tighten-description`
- `add-negative-example`
- `needs-benchmark`

---

#### 规则 C：Repeated Adjacent Confusion

若 Skill A 与 Skill B 反复互相误吸，则候选：

- `split-skill`
- `merge-skills`
- `router-skill-opportunity`

具体取决于：

- 是一个 Skill 过宽，还是两个 Skill 过近
- 是需要拆边界，还是需要上层路由器

---

#### 规则 D：Strong Hit but Poor Effect

若 repeated `strong-hit` 但 effect 多为 `partial / ineffective`，则说明：

> routing 可能是对的，但 Skill 内容或 workflow 本身有问题。

候选：

- `tighten-description`（少数情况）
- 更常见是：更新 Skill 正文 workflow
- `needs-benchmark`

---

#### 规则 E：Repeated No-Skill Successful Pattern

若多次出现：

- 没读任何 Skill
- 但通过相近流程稳定成功完成某类任务

则候选：

- `create-new-skill`

这类机会最适合被导出给 `skills-maker` 进一步验证。

---

## 10. Surface

### 10.1 默认运行面

v1.0 默认采用**被动观察面**：

- 不把 SkillAssessment 持续注入主任务 prompt
- 不打扰主 Agent 执行
- 只在后台记录 observation / assessment / proof aggregate

原因：

- 防止当前任务 prompt 被治理层信息污染
- Skill proof 不应成为主执行时的强约束

---

### 10.2 命令面（建议，不要求 v1.0 全做）

可考虑新增：

```text
/ptc skills status
/ptc skills status <skill-name>
/ptc skills proof export
/ptc skills review export
```

建议语义：

- `/ptc skills status`
  - 总览近期 Skill 命中、误命中、机会数
- `/ptc skills status <skill-name>`
  - 查看某个 Skill 当前版本的 proof 摘要
- `/ptc skills proof export`
  - 导出结构化 JSON
- `/ptc skills review export`
  - 导出供浏览器或 `skills-maker` 消费的 review bundle

---

### 10.3 与 skills-maker 的衔接面

Skill Intelligence 的主要外部价值，不在主对话，而在于为 `skills-maker` 提供：

1. 自然正例 / 反例 / 边界 prompt 样本
2. versioned runtime-proof 证据
3. 邻接混淆矩阵
4. 新 Skill 候选模式
5. benchmark 建议项

建议导出产物包括：

- `skill-proof-model.json`
- `skill-opportunities.json`
- `skill-benchmark-seeds.json`

---

## 11. Runtime Proof

### 11.1 双证据模型

Skill 的 runtime-proof 不应由单一来源定义，而应由两类证据构成：

#### A. Organic Runtime Proof

来自真实自然使用环境下的运行观察：

- transcript 中是否读取目标 Skill
- 是否在前 1~3 个动作内读取
- 是否存在 subagent 命中
- 是否多 Skill thrash
- 命中后效果如何
- 用户下一轮是否继续/纠偏/补充

#### B. Controlled Benchmark Proof

来自 `skills-maker` 的黑盒盲测：

- 应命中正例
- 不该命中反例
- 边界混合样例
- 修改前后回归对比

---

### 11.2 两者关系

Organic Runtime Proof 回答：

- 用户自然会怎么问
- 真实环境中是否命中
- 命中后有无实际帮助
- 哪些边界问题是真实高频问题

Controlled Benchmark Proof 回答：

- Skill 版本在控制环境中是否满足设计边界
- 修改 Skill 表面后，正例/反例/边界是否回归通过

两者关系是：

> **Organic 提供现实证据与样本源，Controlled 提供可重复验证与版本回归。**

---

### 11.3 闭环

推荐闭环如下：

```text
真实运行中发现 missed-positive / false-positive / no-skill-success pattern
  ↓
Skill Intelligence 聚合并导出自然样本
  ↓
skills-maker 基于样本设计 benchmark case
  ↓
修改 skill name / description / examples / boundary
  ↓
黑盒 benchmark 验证新版本
  ↓
新版本回到真实运行环境继续观察
  ↓
比较 descriptionHash 前后 runtime-proof 变化
```

这才是 Skill Runtime Proof 的完整闭环。

---

## 12. 与 GRC / Memory / Principles 的边界

### 12.1 与 Curator 的边界

Curator 仍只负责：

- `SummaryEntry`
- `GoalStateDocument`
- `signal`

SkillAssessment 可使用 Curator 的 `signal` 作为 effect 判断证据之一，但不能把 Skill 评估逻辑并入 Curator 主职责。

---

### 12.2 与 Reflector 的边界

Reflector 仍只负责：

- 目标对齐与偏移归因
- advice
- principleOps
- `reference / script` 候选

Skill Intelligence 不应让 Reflector 越权输出 Skill 候选。

---

### 12.3 与 Principles 的边界

以下内容不应直接进入 principles：

- 某个具体 Skill 的命中率结论
- 某次误命中案例
- 某个相邻 Skill 冲突统计
- 某个版本的 description 缺陷

这些属于 Skill 运行证据层，不属于跨目标通用方法论。

---

### 12.4 与 SummaryWarehouse 的边界

若未来需要回溯“历史某轮的 SkillObservation / SkillAssessment”，可参考 SummaryWarehouse 的模式：

- 不做全量主动注入
- 保持按需检索
- 保留 session / round 指针

但 v1.0 不要求先做跨 session Skill 仓库。

---

## 13. 风险与控制

| 风险 | 原因 | 控制措施 |
|---|---|---|
| 只看顶层 transcript 导致漏检 | skill 命中发生在 subagent 中 | 观察器必须递归解析 subagent tool result |
| 把命中与效果混为一谈 | verdict 设计过粗 | routing / effect 双轴拆分 |
| 修改 Skill 后旧证据污染新版本 | proof 未按版本分桶 | 强制使用 `descriptionHash` |
| 机会判断过早 | 单轮样本被误当趋势 | 只对聚合后 repeated pattern 产出 opportunity |
| 把 Skill 证据注入主 prompt 造成噪音 | 治理层干扰执行层 | v1.0 只做后台观察，不默认注入 |
| Skill 结论反向污染 GoalState / principles | 责任边界不清 | 严格分离 artifact 与存储域 |

---

## 14. MVP 建议

### Phase 1：Observation Only

先实现：

- `skill-catalog.ts`
- `skill-observer.ts`
- `grc-skill-observation-artifact`

目标：

- 记录 Skill 读取证据
- 支持 subagent nested transcript
- 记录前 1~3 个动作与 multi-skill 情况

这是最小、最稳、最高价值的第一步。

---

### Phase 2：Assessment

新增：

- `skill-assessor.ts`
- `grc-skill-assessment-artifact`

目标：

- 基于上一轮 observation + 当前用户消息 + curator signal
- 产出 routing / effect 双轴结论

---

### Phase 3：Aggregate + Opportunity Export

新增：

- `skill-proof-registry.ts`
- `skill-review-export.ts`

目标：

- 聚合 proof
- 输出 opportunities
- 导出给 `skills-maker`

---

## 15. 验收标准

### 15.1 Observation 验收

1. 任意发生 Skill 读取的 round，都能记录：
   - 读取的 `SKILL.md` 路径
   - 首个 Skill 读取顺序
   - 是否来自 subagent
2. 对 nested subagent transcript 的 Skill 读取不漏检
3. 可记录前 1~3 个动作摘要

---

### 15.2 Assessment 验收

1. 单轮可同时输出 routing verdict 与 effect verdict
2. assessment 的 evidence 能回指 observation 事实
3. `currentUserMessage + curatorSignal` 能作为 effect 的后验证据被引用
4. 不把 assessment 结果写入 GoalState 或 principles

---

### 15.3 Aggregate / Opportunity 验收

1. proof 可按 `descriptionHash` 分版本统计
2. repeated missed-positive / false-positive 可触发 opportunity
3. 无 Skill 读取但重复成功的模式可触发 `create-new-skill` 候选
4. 导出产物可供 `skills-maker` 直接消费

---

## 16. 一句话结论

Skill Intelligence 的正确收敛方向是：

> **在 PasstoContext 中新增一条独立于 Curator / Reflector / Principles 的 Skill 运行证据链，用真实 transcript、subagent 命中与后验用户信号持续验证 Skill 的命中与效果，并把这些证据结构化沉淀为 versioned runtime-proof 与 opportunity bundle，供 skills-maker 做 benchmark、迭代与新 Skill 设计。**

---

*版本：skill_intelligence_v1.0 | 更新时间：2026-05-16*
