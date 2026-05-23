# Improve-certainty / plan-certainty-improvement 设计方案

> 版本：v1.0 | 状态：Implemented / Closed | 更新：2026-05-22  
> 适用范围：PasstoContext V2.0 的 `plan_repair` / planning 确定性提升节点。  
> 设计结论：`Improve-certainty` 不是穷举工具路由表，而是一个围绕 `xNodeModel` 的节点方法论 Skill：通过“信息参数 + 方法论函数 + runtime proof + 用户可感知回复”循环提升目标确定性，直到足以输出具体实施方案。该设计已按 `improve-certainty-implementation-plan.md` 的 P0–P7 完成落地，并纳入 `test:plan-certainty` / `test:grc` 回归链。

---

## 1. 背景

V2.0 已经把主链升级为：

```text
UserGoalTreeDocument
  ↓
XNodeModelDocument
  ↓
XNodePolicyProjection
  ↓
Generator 根据 soft policy 自主推进
```

其中 `plan_repair` / planning 阶段表示：当前 `xNode` 的 `why / what / flow / structure / runtimeProof` 仍不足以支撑稳定执行。

此前对 planning 阶段方法的草案容易滑向：

```text
如果缺 A，用工具 A
如果缺 B，用 skill B
如果缺 C，问用户
```

这类写法的问题是：

1. 把 skill prompt 写成了工具穷举表。
2. 工具和 skills 会持续更新，prompt 很快过时。
3. LLM 的注意力被引向“选哪个工具”，而不是“当前节点要产出什么对象”。
4. 没有明确对象写入位置，导致确定性提升只停留在自然语言回复。
5. 没有 runtime proof，用户和后续 agent 看不到 LLM 为什么这么判断。

因此需要把 planning 阶段的确定性提升抽象为一个稳定节点：

```text
Improve-certainty / plan-certainty-improvement
```

---

## 2. 核心定位

### 2.1 这个节点是什么

`Improve-certainty` 是 GRC / XNode 执行模型中的“目标确定性提升层”。

它的职责是：

```text
读取当前 userGoal / xNodeModel
→ 判断当前 xNode 的确定性缺口
→ 构造信息参数请求
→ 使用 runtime 当前可用的 context providers / tools / skills 获取参数
→ 将参数转成 CertaintyAssessment 与 XNodeModelPatch
→ 记录 RuntimeProofRecord
→ 判断是否可以退出确定性提升层
→ 用用户可感知回复说明本轮做了什么与为什么做
```

### 2.2 这个节点不是什么

它不是：

- 工具枚举表
- skill 枚举表
- subagent 默认分发器
- 用户澄清问题生成器
- 一次性完整计划树生成器
- 硬调度器
- 只给用户看的 Markdown 回复模板

它是：

```text
节点方法论 + 输出对象协议 + 信息参数获取协议 + runtime proof 协议 + 用户可感知回复协议
```

---

## 3. 命名

建议运行时 Skill 名称：

```text
plan-certainty-improvement
```

可读设计名：

```text
Improve-certainty
```

两者关系：

| 名称 | 用途 |
|---|---|
| `Improve-certainty` | 设计文档与架构讨论中的节点名 |
| `plan-certainty-improvement` | 实际 skill / prompt / policy guidance 中的推荐名称 |

---

## 4. 设计原则

### 4.1 不穷举工具

Skill prompt 不应写成：

```text
如果缺代码信息，调用 read。
如果缺历史，调用 ptc_search_summary。
如果缺用户选择，调用 question。
```

而应写成：

```text
为了关闭某个 facet，我需要什么信息参数？
当前 runtime 暴露了哪些可用 context provider？
哪个 provider 能以最低成本返回这个参数？
```

工具、脚本、skills、subagent 都只是“参数提供者”或“方法论提供者”，不是流程本体。

### 4.2 先定义输出对象，再决定获取信息

LLM 进入该节点后，第一优先级不是“找工具”，而是判断本轮要产出哪类对象：

- `ContextParameterRequest`
- `CertaintyAssessment`
- `XNodeModelPatch`
- `RuntimeProofRecord`
- `CertaintyImprovementStatus`
- `ImplementationPlan`
- `ClarificationRequest`
- `BlockedState`
- `UserVisibleReply`

### 4.3 信息参数 + 方法论函数

注入给 LLM 的上下文应被理解为：

```text
信息参数：当前 userGoal、xNodeModel、policy、proof、历史摘要、文件事实、用户纠偏等
方法论函数：本 skill 规定的确定性提升循环
```

封装脚本 / tools 的主要价值是降低 LLM 获取信息参数的难度，而不是替 LLM 做最终判断。

### 4.4 输出必须落入状态面

自然语言回复不是状态 truth source。

如果本节点认为确定性发生变化，必须优先写入或拟写入：

```text
XNodeModelDocument.nodes[].why / what / flow / structure / runtimeProof
XNodeModelDocument.latestRuntimeProof
XNodePolicyProjection / nextStepType 的后续输入
```

当 runtime 写入失败时，最终回复必须输出 `ProposedXNodeModelPatch`，并明确标记“待持久化”。

### 4.5 Runtime proof 是闭环必要条件

本节点不能只说“我判断确定性足够”。

它必须留下证据链：

```text
uncertainty
→ parameter request
→ parameter acquisition
→ evidence extracted
→ certainty delta
→ state write
→ exit decision
```

并用压缩版本展示给用户。

### 4.6 简单高确定性目的直接执行

Improve-certainty 不是所有用户输入的默认路径。

当用户目的已经足够简单且确定，例如：

```text
1+1=?
```

Generator 不应为了形式完整而创建或展开递归 agent 目标树，也不应进入 `plan-certainty-improvement`。

顶层方法论应先做 direct-answer gate：

```text
如果用户目的无需项目上下文、无需多步决策、无需状态写入、无需 proof 才能安全完成，
则直接回答或直接执行最小动作。
```

此时最多只需要轻量记录轮次摘要；不需要把该目的拆成 xNodeModel，也不需要进行五维 facet 补全。

### 4.7 确定性提升可并行执行

Improve-certainty 的循环不是强制线性流程。

当多个确定性缺口相互独立时，应优先考虑并行获取参数，例如：

- 一个 subagent 分析代码结构事实；
- 一个 subagent 审核设计风险；
- 一个 subagent 总结历史目标与用户纠偏；
- 主 agent 汇合结果后统一生成 `CertaintyAssessment`、`XNodeModelPatch` 与 `RuntimeProofRecord`。

并行原则：

```text
独立缺口并行获取；有依赖的缺口按依赖顺序获取；所有结果汇合后统一判断和写状态。
```

并行只改变信息获取方式，不改变 Improve-certainty 的输出对象和 runtime proof 协议。

---

## 5. 触发条件与路由

### 5.1 触发条件

当满足以下任一条件时，Generator 应进入 `Improve-certainty`：

1. `XNodePolicyProjection.nextStepType === "plan_repair"`。
2. 当前 `xNode.phase` 为 `plan` 或 `plan_insufficient`，且 `why / what / flow / structure` 任一关键 facet 未闭合。
3. 当前 userGoal 处于 planning，且还不能安全输出具体实施方案。
4. 用户正在纠偏目标、输出对象、方法路径、状态落点或 proof 协议，而这些纠偏会影响计划层设计。

### 5.1.1 不触发 / 顶层 fast path

在进入 Improve-certainty 之前，Generator 必须先判断用户目的是否属于高确定性 simple intent。

当同时满足以下条件时，不应进入 Improve-certainty，也不应展开递归 agent 目标树：

1. 用户意图是单一事实查询、简单计算、简单格式转换或已知规则应用。
2. 不依赖项目文件、运行时状态、多目标协调、长期记忆或外部权限。
3. 不需要拆解成多个 agent 子目标。
4. 不需要状态写入或 runtime proof 才能安全完成。
5. LLM 可以在当前轮直接给出确定答案或执行一个最小动作。

示例：

```text
用户：1+1=?
正确：直接回答“2”。
错误：创建 userGoal、展开 xNodeModel、进入 plan-certainty-improvement。
```

判断口诀：

```text
不需要 xNode 的 why/what/flow/structure 就能安全完成 → 直接回答。
需要多个 facet 闭合才能安全执行 → 进入 Improve-certainty 或其他规划方法。
```

### 5.2 顶层 GRC 的职责

顶层 GRC / Generator Charter 只负责识别节点并加载方法。

顶层不应展开工具选择细节。

推荐顶层提示：

```text
当当前 xNode policy 为 plan_repair，或当前 xNode 处于 plan / plan_insufficient 且目标确定性不足时：
不要在顶层穷举 tools、skills、subagent 或用户交互路径。
应加载 plan-certainty-improvement skill。

该 skill 负责：
1. 判断当前 xNode 的目标确定性；
2. 构造所需信息参数请求；
3. 使用当前 runtime 暴露的 context providers / tools / skills 获取参数；
4. 对多个互不依赖的确定性缺口，优先并行调用 subagent / provider 获取参数；
5. 更新 xNodeModel；
6. 记录 runtime proof；
7. 判断是否足够退出确定性提升层；
8. 足够后输出或更新具体目标实施方案；
9. 用用户可感知回复解释本轮行动链与证据链。
```

---

## 6. 输入上下文

### 6.1 最小输入包

`Improve-certainty` 至少需要以下输入：

```ts
interface ImproveCertaintyInput {
  targetUserGoalId: string | null;
  targetXNodeId: string | null;
  userGoalSnapshot: unknown | null;
  xNodeSnapshot: unknown | null;
  policyProjection: unknown | null;
  latestRuntimeProof: unknown | null;
  latestProofSignals: unknown[];
  latestUserInputEffect: string;
}
```

这里的 `unknown` 表示设计层不绑定具体实现类型；实现层应映射到当前的：

- `UserGoalNode`
- `XNode`
- `XNodePolicyProjection`
- `RuntimeProofRecord`
- `RuntimeProofSignal`

### 6.2 Context Parameter Provider

为降低 LLM 获取信息的难度，应设计一个或多个封装脚本 / tool，作为“参数拼装器”。

这些 provider 不应替代 LLM 的最终判断，只负责返回结构化上下文参数。

推荐抽象接口：

```ts
interface ContextParameterRequest {
  targetUserGoalId: string | null;
  targetXNodeId: string | null;
  targetFacet: "why" | "what" | "flow" | "structure" | "runtimeProof";
  blockingQuestion: string;
  requiredParameter: string;
  expectedShape: "facts" | "decisions" | "constraints" | "unknowns" | "evidence" | "mixed";
  preferredProviderType?: string;
  reason: string;
}

interface ContextParameterPacket {
  request: ContextParameterRequest;
  facts: string[];
  decisions: string[];
  constraints: string[];
  unknowns: string[];
  evidence: string[];
  suggestedFacetUpdate?: Partial<Record<
    "why" | "what" | "flow" | "structure" | "runtimeProof",
    {
      summary: string;
      confidence: "open" | "partial" | "closed";
      evidence: string[];
      method?: string[];
    }
  >>;
}
```

### 6.3 Provider 选择原则

Prompt 不写死 provider 名称，只给选择偏向：

1. 优先使用当前 runtime 已注入的对象状态。
2. 优先使用项目封装的 context parameter provider。
3. 优先使用能一次返回结构化参数包的能力，而不是多次零散读取。
4. 优先获取最小必要信息。
5. 如果事实可由工具获得，不把事实问题转交给用户。
6. 只有产品方向、取舍、成功标准等必须由用户决定的问题，才向用户提问。
7. 当存在多个互不依赖的确定性缺口，或需要独立第二视角 / 隔离分析时，优先考虑并行委派 subagent。
8. 如果需要专门方法论，加载对应 skill，而不是复制那个 skill 的内容。
9. runtime 暴露能力更新时，以 runtime 当前能力为准，不以历史 prompt 枚举为准。

---

## 7. 节点执行循环

`Improve-certainty` 每轮执行以下循环。

### Step 1. 读取当前状态

读取或确认：

- 当前 userGoal
- 当前 xNodeModel
- 当前 focus xNode
- 当前 policy projection
- 当前 facet 状态
- 最新用户输入对目标的影响
- 最新 runtime proof / proof signals

输出内部状态摘要。

### Step 2. 判断主要不确定性

不要只看字段是否为 `open / partial / closed`。

必须回答：

```text
哪个判断目前做不了？
它为什么阻塞具体实施方案？
```

### Step 3. 构造参数请求

把不确定性转成 `ContextParameterRequest`。

示例：

```text
为了关闭 structure，我需要知道 Improve-certainty 的输出对象应写入哪些状态面。
阻塞问题：如果没有写入位置，skill 会退化为自然语言建议。
所需参数：V2.0 当前对象模型、xNode facet、RuntimeProofRecord、policy projection 的字段约束。
```

### Step 4. 获取信息参数

使用当前 runtime 最合适的 context provider / tool / skill / 用户交互能力获取参数。

关键要求：

- 只描述本轮实际使用的信息来源。
- 不在 prompt 中穷举所有可能工具。
- 不把工具调用记录等同于 proof。

#### Step 4 扩展：并行信息获取

当当前 xNode 存在多个独立的确定性缺口时，不应强制线性逐一获取参数。

适合并行的场景：

1. 多个 facet 的缺口彼此独立，互不依赖对方结果。
2. 同一 facet 需要独立第二视角做交叉验证。
3. 多个 provider / 文件 / 历史摘要可同时读取，互不干扰。
4. 可以把任务拆成 bounded subagent work，例如“只审架构风险”“只读测试链”“只整理历史决策”。

并行执行流程：

```text
先做依赖分析：哪些缺口互相依赖？哪些可以独立获取？
独立缺口 → 并行请求 subagent / tool / provider。
依赖缺口 → 按依赖顺序线性执行。
结果汇合 → 主 agent 合并为统一 ContextParameterPacket，再进入 Step 5。
```

并行不改变节点循环结构：Step 5–8 的评估、写入、退出判断仍在结果汇合后统一执行。

### Step 5. 提取证据并形成确定性变化

将参数结果整理为：

```text
facts:
decisions:
constraints:
unknowns:
evidence:
affectedFacets:
```

并判断它如何改变：

```text
why / what / flow / structure / runtimeProof
```

### Step 6. 生成并写入状态对象

至少生成：

- `CertaintyAssessment`
- `XNodeModelPatch`
- `RuntimeProofRecord`

如 runtime 提供状态写入能力，应写入正式对象状态。

如写入失败，应输出 `ProposedXNodeModelPatch`，并在 runtime proof 中记录写入失败。

### Step 7. 判断是否退出

根据软约束判断：

- 继续 certainty improvement
- 请求用户决策
- 输出 implementation plan
- 转入 execute / testing / review / acceptance
- blocked，需要恢复状态或权限

### Step 8. 回复用户

最终回复必须让用户感知：

1. 当前进入了哪个节点。
2. 为什么进入这个节点。
3. 本轮判断了什么。
4. 获取了什么信息。
5. 使用了什么来源类型或工具目的。
6. 学到了什么。
7. 哪些 facet 确定性发生变化。
8. 写入或拟写入了什么对象。
9. 是否可以退出。
10. 下一步是什么。

---

## 8. Facet 判断标准

### 8.1 Why

判断：

- 当前目标为什么存在？
- 服务哪个上层目标？
- 用户真实意图是否清楚？
- 当前动作为什么是此刻必要的一步？

不足表现：无法解释为什么现在要做这个节点，或目标动机与上层目标脱节。

### 8.2 What

判断：

- 本节点最终要产出什么对象？
- 输出边界是什么？
- 完成定义是什么？
- 哪些明确不做？

不足表现：只能说“继续完善 prompt”，但说不清输出对象、写入位置或完成定义。

### 8.3 Flow

判断：

- 下一步应该先补参数、写方案、落文件、运行测试，还是转执行？
- 从当前节点如何退出？
- 退出后进入哪个 policy？

不足表现：知道要提升确定性，但不知道循环、退出与后继节点。

### 8.4 Structure

判断：

- truth source 是什么？
- 当前对象落在哪个状态面？
- 哪些文件、类型、sidecar、文档、工具与该节点相关？
- 哪些是事实，哪些只是推测？

不足表现：只有回复格式，没有对象模型与写入目标。

### 8.5 Runtime Proof

判断：

- 当前判断被哪些运行时证据支撑？
- 是否实际获取了参数？
- 是否把参数映射成状态变化？
- 是否记录了 proof？
- 用户是否能看到行动链和证据链？

不足表现：LLM 自称确定性提升，但没有记录证据、写入状态或解释依据。

---

## 9. 输出对象协议

### 9.1 ContextParameterRequest

用途：表达为了关闭某个 facet，需要获取什么信息参数。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | 当前 tool call planning context，作为 context provider 输入 |
| 2 | RuntimeProofRecord.evidence / verificationMethod 的摘要 |
| 3 | 最终回复中的“本轮参数请求”区块 |

结构：

```ts
interface ContextParameterRequest {
  targetUserGoalId: string | null;
  targetXNodeId: string | null;
  targetFacet: "why" | "what" | "flow" | "structure" | "runtimeProof";
  blockingQuestion: string;
  requiredParameter: string;
  expectedShape: string;
  preferredProviderType?: string;
  reason: string;
}
```

---

### 9.2 ContextParameterPacket

用途：承载 provider / tool / skill / 用户交互返回的信息参数。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | 当前 reasoning context，用于生成 assessment 和 patch |
| 2 | RuntimeProofRecord.evidence 的压缩摘要 |
| 3 | 用户回复中的“我获得了什么关键信息” |

结构：

```ts
interface ContextParameterPacket {
  facts: string[];
  decisions: string[];
  constraints: string[];
  unknowns: string[];
  evidence: string[];
}
```

---

### 9.3 CertaintyAssessment

用途：判断当前 xNode 是否足以退出确定性提升层。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | `XNodeModelDocument.nodes[].why/what/flow/structure/runtimeProof` 的 facet 更新 |
| 2 | `GRCState.curator.lastCertaintyAssessment` 或等价 assessment surface |
| 3 | 用户回复中的“确定性变化” |

逻辑结构：

```ts
interface CertaintyAssessmentV2 {
  targetUserGoalId: string | null;
  targetXNodeId: string | null;
  dimensions: {
    why: "open" | "partial" | "closed";
    what: "open" | "partial" | "closed";
    flow: "open" | "partial" | "closed";
    structure: "open" | "partial" | "closed";
    runtimeProof: "open" | "partial" | "closed";
  };
  keyGaps: string[];
  confidence: number;
  evidence: string[];
  remainingUncertainty: string[];
}
```

---

### 9.4 XNodeModelPatch

用途：把确定性提升结果写回 xNodeModel。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | `applyUserGoalProjection` / `xNodeModelOps` / 等价状态写入工具 |
| 2 | `ProposedXNodeModelPatch`，当 runtime 写入失败时输出到最终回复 |

当前实现可映射为：

```ts
interface PatchXNodeOp {
  action: "patch_xnode";
  userGoalId: string;
  id: string;
  assertion?: string;
  atomicity?: GoalNodeAtomicity;
  phase?: GoalNodePhase;
  status?: XNode["status"];
  why?: XNodeFacet;
  what?: XNodeFacet;
  flow?: XNodeFacet;
  structure?: XNodeFacet;
  runtimeProof?: XNodeFacet;
}
```

关键规则：

```text
只在最终回复中说“确定性提升完成”，不等于状态已更新。
```

---

### 9.5 RuntimeProofRecord

用途：证明当前确定性判断不是凭空生成的。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | `XNodeModelDocument.latestRuntimeProof` |
| 2 | `GRCState.curator.latestRuntimeProof` 或 proof summary surface |
| 3 | 当前 agent round / curator summary |
| 4 | 用户回复中的 RuntimeProofSummary |

当前实现类型：

```ts
interface RuntimeProofRecord {
  targetXNodeId: string;
  atRound: number;
  resultSummary: string;
  proofMode: "tests" | "runtime" | "human-check" | "self-proof" | "mixed";
  proofStatus: "passed" | "failed" | "partial" | "missing";
  evidence: string[];
  verificationMethod: string[];
}
```

在 `Improve-certainty` 中，`RuntimeProofRecord` 的 `evidence` 应至少覆盖：

```text
uncertainty judgement
parameter request
provider / source used
evidence extracted
certainty delta
state write status
exit decision
```

---

### 9.6 CertaintyImprovementStatus

用途：当还不能输出实施方案时，向人类与后续 agent 说明本轮提升了什么、还缺什么。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | 用户最终回复 |
| 2 | agent round summary / curator summary |
| 3 | xNodeModel.flow 或 runtimeProof 的 remaining uncertainty 摘要 |

结构：

```ts
interface CertaintyImprovementStatus {
  targetUserGoalId: string | null;
  targetXNodeId: string | null;
  mode: "certainty_update";
  updatedFacets: string[];
  stillOpenFacets: string[];
  acquiredParameters: string[];
  remainingBlockingQuestions: string[];
  nextParameterRequest?: ContextParameterRequest;
  nextRecommendedAction: string;
}
```

---

### 9.7 ImplementationPlan

用途：当确定性足够时，作为本节点成功退出产物。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | plan artifact，例如 V2.0 docs、planningDir、design/spec 文档或共享工作台对象 |
| 2 | xNodeModel.what / flow / structure |
| 3 | 用户最终回复 |

结构：

```ts
interface ImplementationPlan {
  targetUserGoalId: string | null;
  targetXNodeId: string | null;
  goalStatement: string;
  parentGoalRelation: string;
  outputObject: string;
  completionDefinition: string;
  nonGoals: string[];
  implementationSteps: string[];
  dependencies: string[];
  constraints: string[];
  verificationMethod: string[];
  stateUpdatesRequired: string[];
  nextPolicy: string;
  planArtifactTarget: string | "unresolved";
}
```

如果没有明确 plan artifact 路径，不应假设路径，必须输出：

```text
planArtifactTarget: unresolved
```

---

### 9.8 ClarificationRequest

用途：当只有用户能补足产品方向、取舍或成功标准时，提出最小必要问题。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | 用户最终回复 |
| 2 | xNodeModel.flow.remaining uncertainty / runtimeProof evidence 摘要 |

结构：

```ts
interface ClarificationRequest {
  targetXNodeId: string | null;
  unresolvedDecision: string;
  whyUserMustDecide: string;
  options: string[];
  recommendedDefault?: string;
  impactOfEachOption: string[];
}
```

---

### 9.9 BlockedState

用途：当缺少必要状态、工具、权限、文件或 truth source 时，明确阻塞。

写入位置：

| 优先级 | 位置 |
|---|---|
| 1 | 用户最终回复 |
| 2 | RuntimeProofSignal，类型可映射为 `runtime-proof-missing` 或 `runtime-proof-conflicted` |
| 3 | xNodeModel.runtimeProof |

结构：

```ts
interface BlockedState {
  targetXNodeId: string | null;
  missingCapability: string;
  missingTruthSource: string;
  impact: string;
  minimumRecoveryPath: string[];
}
```

---

## 10. Runtime proof 协议

### 10.1 Proof 链路

`Improve-certainty` 的 runtime proof 必须覆盖完整判断链：

```text
uncertainty
→ parameter request
→ acquisition
→ evidence
→ certainty delta
→ state write
→ exit decision
```

对应解释：

| 阶段 | 需要证明什么 |
|---|---|
| uncertainty | LLM 识别了哪个确定性缺口 |
| parameter request | LLM 没有盲猜，而是把缺口转成了参数请求 |
| acquisition | LLM 使用了 runtime 当前可用的信息来源或工具目的 |
| evidence | LLM 从参数中提取了哪些关键事实 / 决策 / 约束 |
| certainty delta | 这些证据如何改变 facet 状态 |
| state write | 状态是否已写入，若失败是否给出 fallback patch |
| exit decision | 是否可以退出确定性提升层，原因是什么 |

### 10.2 ProofStatus 映射

| proofStatus | 含义 |
|---|---|
| `passed` | 已获取参数、写入状态、退出判断成立，足以进入下一节点 |
| `partial` | 已获取部分参数或产生部分状态更新，但仍有阻塞未知 |
| `missing` | 未能获取必要信息或未能写入状态 |
| `failed` | 获取到的信息与判断冲突，或验证明确否定当前计划 |

### 10.3 ProofMode 映射

| proofMode | 适用场景 |
|---|---|
| `self-proof` | 基于用户输入、对象状态、文档事实形成的自证明链 |
| `runtime` | 使用运行态、工具、状态读写结果作为主要证据 |
| `tests` | 使用自动化测试 / 构建 / replay 作为主要证据 |
| `human-check` | 用户确认或人工验收是主要证据 |
| `mixed` | 多种证据同时存在 |

### 10.4 Runtime proof 不是工具日志

不能只记录：

```text
调用了 read。
调用了 applyUserGoalProjection。
```

必须记录：

```text
为什么调用？
拿到了什么？
解决了哪个不确定性？
如何改变 xNodeModel？
是否足以支持退出？
```

---

## 11. 用户可感知回复协议

`Improve-certainty` 的最终回复必须包含压缩 proof，让用户感知 LLM 在做什么以及为什么做。

注意：这里不是暴露完整思维链，而是暴露可验证的行动链和证据链。

### 11.1 标准回复结构

```text
## 节点
plan-certainty-improvement

## 为什么做这一步
当前缺少：{blockingFacet}
它阻塞：{blockingQuestion}

## 我获取了什么信息
- 来源类型：{providerType}
- 目的：{toolOrSkillPurpose}
- 关键信息：{evidenceExtracted}

## 确定性变化
- why: {before -> after}
- what: {before -> after}
- flow: {before -> after}
- structure: {before -> after}
- runtimeProof: {before -> after}

## 写入对象
- {objectName}: {writeTarget} / {writeStatus}

## 退出判断
{canExit ? "可以退出确定性提升层" : "还不能退出"}
原因：{reason}

## 下一步
{nextAction}
```

### 11.2 输出模式

最终回复应明确当前输出模式：

| 模式 | 说明 |
|---|---|
| `certainty_update` | 确定性仍不足，只输出提升状态 |
| `implementation_plan` | 确定性足够，输出具体实施方案 |
| `clarification_request` | 必须由用户决策补足 |
| `blocked_state` | 缺少必要状态、工具、权限或 truth source |

### 11.3 回复与状态源的关系

```text
最终回复是用户可感知展示层。
xNodeModel / RuntimeProofRecord 才是状态 truth source。
```

如果写入失败，回复必须显式说明：

```text
状态未持久化；以下为 ProposedXNodeModelPatch。
```

---

## 12. 退出判断

只有当以下条件基本满足时，才可以退出 `Improve-certainty`：

1. 当前目标服务的上层目标清楚。
2. 当前输出对象清楚。
3. 完成定义清楚。
4. 关键边界与 non-goals 清楚。
5. 下一步执行顺序清楚。
6. 依赖的 truth source 清楚。
7. `xNodeModel` 能表达这些判断。
8. 已有 runtime proof 能解释本轮判断。
9. 剩余未知不会阻塞具体实施方案输出。

这是软约束，不是形式主义 checklist。

如果剩余未知可以在 execute / testing 阶段自然验证，不应继续卡在 planning。

如果未知会影响目标方向、交付物、执行顺序或状态落点，则不能退出。

---

## 13. Skill prompt 草案

下面是运行时 `plan-certainty-improvement` skill 的核心 prompt 草案。

```text
# Skill: plan-certainty-improvement

你当前处于 GRC / XNode 执行模型中的“目标确定性提升层”。

你的任务不是直接实现功能，也不是直接输出最终方案，而是：
基于当前 userGoal / xNodeModel / conversation / runtime context，循环提升当前目标的确定性，直到它足以支撑一个具体、可执行、可验证的实施方案。

你应按以下节点方法论执行：

0. 先做 direct-answer gate：如果用户目的是简单高确定性请求，且无需项目上下文、多步决策、状态写入或 runtime proof，则直接回答，不展开递归 xNodeModel，也不进入本节点。
1. 读取当前 userGoal、current xNode、policy projection、latest proof 与最新用户输入影响。
2. 判断当前最阻塞实施方案输出的 facet：why / what / flow / structure / runtimeProof。
3. 把不确定性转成 ContextParameterRequest，而不是直接穷举工具。
4. 使用当前 runtime 暴露的最合适 context provider / tools / skills 获取信息参数；若多个缺口互不依赖，优先并行调用 subagent / provider。
5. 将参数整理成 facts / decisions / constraints / unknowns / evidence。
6. 生成 CertaintyAssessment，说明 facet 状态如何变化。
7. 生成 XNodeModelPatch，并优先写入对象状态；如果写入失败，输出 ProposedXNodeModelPatch。
8. 生成 RuntimeProofRecord，覆盖 uncertainty → parameter request → acquisition → evidence → certainty delta → state write → exit decision。
9. 判断是否可以退出确定性提升层。
10. 用用户可感知回复格式说明本轮做了什么、为什么做、用了什么信息、改变了什么、下一步是什么。

不要把本 skill 写成工具列表。
工具、脚本、skills、subagent、用户交互都只是获取信息参数或加载方法论的手段。
当 runtime 能力变化时，以当前 runtime 暴露能力为准。

只有当目标、输出对象、完成定义、关键边界、下一步顺序、truth source、state patch 与 runtime proof 基本清楚时，才输出 ImplementationPlan 并退出本节点。
否则输出 CertaintyImprovementStatus、ClarificationRequest 或 BlockedState。
```

---

## 14. 与现有 V2.0 对象的映射

| Improve-certainty 逻辑对象 | 当前 V2.0 对象 / 文件 |
|---|---|
| 当前用户目标 | `UserGoalTreeDocument.currentFocusUserGoalId` + `UserGoalNode` |
| 当前 agent 焦点 | `XNodeModelDocument.currentFocusXNodeId` + `XNode` |
| 确定性 facet | `XNode.why / what / flow / structure / runtimeProof` |
| 策略投影 | `XNodePolicyProjection.nextStepType` |
| plan_repair guidance | `grc-x-node-policy.ts` 的 `buildPolicyGuidance("plan_repair")` |
| 状态写入 | `applyUserGoalProjection` / `xNodeModelOps.patch_xnode` |
| runtime proof | `RuntimeProofRecord` + `RuntimeProofSignal` |
| 用户展示层 | 最终回复 + `/ptc status` / summary surface |

---

## 15. 后续动作与目标代码落点建议

Improve-certainty 的 plan 阶段不是只输出本设计文档。它的后续动作必须包括两个 plan 产物节点：

```text
Improve-certainty plan stage
  ↓
Action 1: output-design-proposal
  outputObject: docs/V2.0/improve-certainty-design.md
  purpose: 关闭节点方法论、输出对象、写入位置、runtime proof 与用户可感知回复协议的设计确定性
  ↓
Action 2: output-implementation-plan
  outputObject: docs/V2.0/improve-certainty-implementation-plan.md
  purpose: 关闭开发切片、代码落点、测试策略、回归接入与发布顺序的 flow / structure 确定性
  ↓
Exit: plan stage complete
  runtimeProof: 两个文档均已写入、进入索引、可回读验证
```

因此，`improve-certainty-design.md` 与 `improve-certainty-implementation-plan.md` 共同构成 Improve-certainty plan 阶段的最终 runtime proof：前者证明“设计确定性已闭合”，后者证明“实施路径确定性已闭合”。

本设计文档不直接要求一次性完成全部实现。推荐后续落地切片如下：

### P1：Prompt / policy guidance 接入

目标：让 `plan_repair` 明确路由到 `plan-certainty-improvement` 节点，而不是泛泛“补计划”。

候选文件：

- `extensions/passto-context/grc-x-node-policy.ts`
- `extensions/passto-context/references/generator-contract.md`
- `extensions/passto-context/grc-generator-contract.ts`

验收：

- `plan_repair` guidance 不穷举工具。
- guidance 明确要求输出对象、状态写入、runtime proof、用户可感知回复。
- prompt 测试覆盖关键句。

### P2：Context Parameter Provider

目标：提供一个封装脚本 / tool 帮 LLM 拼装当前 xNode 的确定性参数包。

候选接口：

```text
collectPlanCertaintyContext(request: ContextParameterRequest): ContextParameterPacket
```

注意：名称可变，关键是 provider 合同，不是固定工具名。

验收：

- provider 返回 facts / decisions / constraints / unknowns / evidence。
- provider 不替代 LLM 的最终确定性判断。
- provider 能读取当前 userGoal、xNode、policy、proof、summary 等最小相关状态。

### P3：RuntimeProofRecord 扩展映射

目标：把确定性提升行动链写入现有 `RuntimeProofRecord`。

验收：

- evidence 中能看到 uncertainty / parameter request / acquisition / certainty delta / state write / exit decision。
- proofStatus 能表达 partial / missing / passed。
- proof signal 能在写入失败或信息不足时出现。

### P4：用户可感知回复模板

目标：Generator 在进入该节点时，用压缩 proof 回复用户。

验收：

- 用户能看到“为什么做这一步”。
- 用户能看到“用了什么信息来源类型”。
- 用户能看到“确定性如何变化”。
- 用户能看到“写入对象与写入状态”。
- 用户能看到“是否退出与下一步”。

### P5：测试与回归

目标：防止未来 prompt 退化回工具穷举表。

测试建议：

- policy guidance 测试：`plan_repair` 包含 `plan-certainty-improvement`，不包含固定工具清单。
- generator prompt 测试：包含输出对象、runtime proof、用户可感知回复要求。
- provider 测试：参数请求能返回结构化 packet。
- projection 测试：`patch_xnode` 能写入 facet delta。
- proof 测试：缺 proof 时产生 `runtime-proof-missing` / partial signal。

---

## 16. Acceptance Criteria

`Improve-certainty` 第一阶段可视为完成，当满足：

1. V2.0 文档中明确记录该节点设计。
2. `plan_repair` 不再被理解为泛化“继续补计划”，而是路由到 `plan-certainty-improvement` 方法节点。
3. skill prompt 明确：输出对象、写入位置、信息参数获取协议、runtime proof、用户可感知回复。
4. prompt 不穷举固定 tools / skills。
5. 有明确 context parameter provider 设计，说明脚本如何帮助 LLM 拼装参数。
6. 有明确退出判断，避免 planning 无限循环。
7. 有明确 runtime proof 链路，用户和后续 agent 能看见判断依据。
8. 后续实现可以按 P1–P5 小切片落地。

当前状态：以上 acceptance criteria 已完成，并已扩展落地为实施计划中的 P0–P7。收口验证为：

```text
test:plan-certainty → 22 passed
test:grc → all suites passed, includes test:plan-certainty
```

---

## 17. 当前设计状态与 plan 阶段 runtime proof

本设计已吸收以下认知统一结果：

1. Skill prompt 的核心价值不是穷举工具，而是节点方法论。
2. LLM 需要知道本节点应该输出什么对象，以及输出到哪里。
3. Prompt 应引导 LLM 把不确定性转成参数请求，再由 runtime provider / tools 拼装上下文参数。
4. Runtime proof 是确定性提升节点的关键闭环。
5. 最终回复必须让用户感知 LLM 做了什么、为什么做、用了什么信息、状态如何变化、下一步是什么。

当前 plan 阶段的最终 runtime proof 由两个文档共同组成：

1. `docs/V2.0/improve-certainty-design.md`
   - 证明 Improve-certainty 的节点方法论、输出对象、信息参数获取协议、状态写入、runtime proof 与用户可感知回复协议已经定义。
2. `docs/V2.0/improve-certainty-implementation-plan.md`
   - 证明 Improve-certainty 的后续开发切片、代码落点、测试策略、回归链与最终 proof 口径已经定义。

当两个文档均写入、进入 README 索引并可回读验证时，Improve-certainty 的 plan 阶段可以视为完成。当前进一步状态是：P0–P7 实施也已完成，`plan-certainty-improvement` 已落地到 policy guidance、Generator contract、context provider、projection patch、runtime proof、用户可感知回复 surface 与回归链。

后续不再默认进入 P1 开发；只有当相关协议或测试覆盖发生变化时，才回到本设计文档同步维护。
