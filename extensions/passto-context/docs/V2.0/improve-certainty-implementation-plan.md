# Improve-certainty 具体开发实施计划

> 版本：v1.0 | 状态：Implemented / Closed（P0–P7） | 更新：2026-05-22  
> 对应设计文档：`improve-certainty-design.md`  
> 目标：把 Improve-certainty / plan-certainty-improvement 从设计口径落成 PasstoContext V2.0 的 planning 阶段节点能力；P0–P7 已完成并纳入 `test:plan-certainty` 与 `test:grc` 回归链。

---

## 1. 目标与范围

### 1.1 用户目标

完成 Improve-certainty 的 plan 阶段交付：

```text
提升确定性
→ 输出设计方案
→ 输出具体开发实施计划
→ 将二者登记为 Improve-certainty 的最终 runtime proof
```

这意味着 Improve-certainty 的 plan 阶段不是只产出一个 prompt，也不是只判断“确定性是否足够”，而是由两个后续节点共同闭合：

1. `output-design-proposal`：输出 `improve-certainty-design.md`。
2. `output-implementation-plan`：输出 `improve-certainty-implementation-plan.md`。

这两个文档共同证明：

- why 已闭合：为什么需要 Improve-certainty。
- what 已闭合：它要产出哪些对象。
- flow 已闭合：它如何获取参数、提升确定性、写状态、退出。
- structure 已闭合：对象落在哪些状态面、文件、prompt、测试与 proof surface。
- runtimeProof 已闭合：设计方案和实施计划已真实写入文件并可回读验证。

### 1.2 本实施计划输出物

本文档本身是 `output-implementation-plan` 节点的产物，包含：

1. 开发目标与非目标。
2. 代码落点。
3. 分阶段任务切片。
4. 每个切片的修改对象、验收标准与验证命令。
5. 测试与 proof 策略。
6. 与 `improve-certainty-design.md` 的 runtime proof 绑定方式。
7. 后续如何把“输出设计方案 + 输出实施计划”加入 Improve-certainty 节点的后续动作。

---

## 2. 非目标

本计划不要求一次性实现完整硬调度器。

明确不做：

1. 不把 `plan_repair` 改成 code-enforced scheduler。
2. 不把所有 tools / skills 写死进 prompt。
3. 不重写整个 GRC / XNode 状态模型。
4. 不删除现有 compatibility bridge。
5. 不要求 provider 一次覆盖所有信息源。
6. 不要求一次性完成 UI / `/ptc status` 的完整可视化改造。

本计划只落地 Improve-certainty 的最小可运行主链：

```text
policy guidance
→ generator prompt / skill method
→ context parameter provider
→ xNodeModel patch
→ runtime proof record
→ 用户可感知回复
→ tests
```

---

## 3. 当前事实依据

本计划基于当前 repo 已存在的对象和文件：

| 能力 | 当前落点 |
|---|---|
| soft policy projection | `extensions/passto-context/grc-x-node-policy.ts` |
| Generator contract 注入 | `extensions/passto-context/grc-generator-contract.ts` + `references/generator-contract.md` |
| xNodeModel 类型 | `extensions/passto-context/types.ts` |
| userGoal/xNode 写入工具 | `extensions/passto-context/grc-user-goal-projection.ts` / `grc-user-goal-projection-tool.ts` |
| runtime proof 类型与生成逻辑 | `extensions/passto-context/grc-runtime-proof.ts` |
| before-agent-start 注入 | `extensions/passto-context/before-agent-start-injection.ts` / `before-agent-start-event.ts` |
| status surface | `extensions/passto-context/ptc-status.ts` |
| 回归脚本 | `extensions/passto-context/package.json` 的 `test:*` scripts |
| 设计文档 | `docs/V2.0/improve-certainty-design.md` |

---

## 4. 目标架构增量

### 4.1 新增 conceptual node

在 xNode 层把 Improve-certainty 的 plan 阶段理解为：

```text
direct-answer gate
  ├─ simple high-certainty intent → answer directly, no xNodeModel expansion
  └─ uncertain / multi-step intent → improve-certainty-plan
       ├─ output-design-proposal
       └─ output-implementation-plan
```

这两个 child 不是普通文档副产物，而是 Improve-certainty plan 阶段的必需后续节点。

同时，顶层必须保留 simple intent fast path：当用户目的无需递归 agent 目标树即可完成时，直接回答或执行最小动作，不进入 Improve-certainty。

### 4.2 新增 plan 阶段完成条件

Improve-certainty 的 plan 阶段完成条件：

```text
1. 设计方案已输出到 docs/V2.0/improve-certainty-design.md。
2. 具体开发实施计划已输出到 docs/V2.0/improve-certainty-implementation-plan.md。
3. 两个文档均进入 docs/V2.0/README.md 索引。
4. runtime proof 记录二者为 plan 阶段 evidence。
5. xNodeModel 中 Improve-certainty plan 节点的 why/what/flow/structure/runtimeProof 均可判断为 closed。
6. 后续 policy 可以从 plan_repair 转为 execute_atomic_work 或 generate_children。
```

### 4.3 新增 runtime proof 口径

Improve-certainty plan 阶段的最终 proof 不只是测试通过，而是：

```text
RuntimeProofRecord {
  targetXNodeId: "improve-certainty-plan"
  proofMode: "mixed"
  proofStatus: "passed"
  evidence: [
    "improve-certainty-design.md exists and defines node methodology/output objects/runtime proof/user-visible reply",
    "improve-certainty-implementation-plan.md exists and defines concrete implementation slices/tests/proof strategy",
    "README.md indexes both artifacts",
    "rg/read verification confirms key terms and sections"
  ]
  verificationMethod: [
    "read docs/V2.0/improve-certainty-design.md",
    "read docs/V2.0/improve-certainty-implementation-plan.md",
    "rg key terms",
    "run targeted tests after P1/P2 implementation"
  ]
}
```

---

## 5. 开发切片总览

| Phase | 名称 | 目标 | 主要文件 | 验证 |
|---|---|---|---|---|
| P0 | 文档 proof 收口 | 使设计方案 + 实施计划成为 plan 阶段 proof | V2.0 docs / README | read + rg |
| P1 | Policy guidance 接入 | `plan_repair` 明确路由到 `plan-certainty-improvement`，并保留 simple intent fast path | `grc-x-node-policy.ts` | policy tests |
| P2 | Generator contract 接入 | before-agent-start prompt 注入节点方法、direct-answer gate 与 subagent 并行方法 | `references/generator-contract.md` / `grc-generator-contract.ts` | generator prompt tests |
| P3 | Context parameter provider | 为 LLM 拼装确定性参数包，并支持并行 packet 汇合 | 新增 provider module / optional tool | provider unit tests |
| P4 | Projection / patch 约定 | 把 certainty delta 写入 xNodeModel facet；fast path 不强制写 xNodeModel | `grc-user-goal-projection.ts` 相关测试 | projection tests |
| P5 | Runtime proof 主链 | 把 Improve-certainty 行动链写入 RuntimeProofRecord，并区分 fast path proof | `grc-runtime-proof.ts` | proof tests |
| P6 | 用户可感知回复 surface | prompt 要求最终回复展示压缩 proof；简单高确定性请求直接回复 | contract / prompt tests | prompt tests |
| P7 | 回归链接入 | 防止退化为工具穷举表 | `package.json` / tests | `npm run test:grc` |

### 5.1 实施完成状态

截至 2026-05-22，P0–P7 已全部完成。当前实现状态如下：

| Phase | 完成状态 | 实际验证面 |
|---|---|---|
| P0 | 已完成 | docs 可回读，README 已索引 design / implementation plan |
| P1 | 已完成 | `tests/x-node-policy.test.ts` |
| P2 | 已完成 | `tests/generator-charter-prompt.test.ts` 与 contract sync 测试 |
| P3 | 已完成 | `tests/grc-plan-certainty-context.test.ts` |
| P4 | 已完成 | `tests/user-goal-projection.test.ts` |
| P5 | 已完成 | `tests/grc-runtime-proof-improve-certainty.test.ts` |
| P6 | 已完成 | Generator charter / prompt surface 测试 |
| P7 | 已完成 | `test:plan-certainty` 已接入 `test:grc` |

---

## 6. P0：文档 proof 收口

### 6.1 目标

把 Improve-certainty 的 plan 阶段交付物闭合为两个文档：

1. `improve-certainty-design.md`
2. `improve-certainty-implementation-plan.md`

并把它们登记到 V2.0 README 索引。

### 6.2 修改文件

- `extensions/passto-context/docs/V2.0/improve-certainty-design.md`
- `extensions/passto-context/docs/V2.0/improve-certainty-implementation-plan.md`
- `extensions/passto-context/docs/V2.0/README.md`

### 6.3 验收标准

- 两个文档都存在。
- README 索引包含两个文档。
- `improve-certainty-design.md` 包含：
  - `ContextParameterRequest`
  - `RuntimeProofRecord`
  - `用户可感知回复`
  - `不穷举工具`
- `improve-certainty-implementation-plan.md` 包含：
  - P0–P7 切片
  - 目标代码落点
  - 验证命令
  - final runtime proof 口径

### 6.4 验证命令

```bash
rg "improve-certainty-design|improve-certainty-implementation-plan" extensions/passto-context/docs/V2.0/README.md
rg "ContextParameterRequest|RuntimeProofRecord|用户可感知|不穷举" extensions/passto-context/docs/V2.0/improve-certainty-design.md
rg "P0|P1|P2|P3|P4|P5|P6|P7|final runtime proof" extensions/passto-context/docs/V2.0/improve-certainty-implementation-plan.md
```

---

## 7. P1：Policy guidance 接入

### 7.1 目标

更新 `plan_repair` guidance，使其不再泛泛提示“补计划”，而是稳定引导到：

```text
plan-certainty-improvement
```

### 7.2 修改文件

- `extensions/passto-context/grc-x-node-policy.ts`
- `extensions/passto-context/tests/x-node-policy*.test.ts` 或新增测试文件

### 7.3 设计要求

`buildPolicyGuidance("plan_repair")` 应表达：

1. 当前优先进入 `plan-certainty-improvement`。
2. 但在进入前先做 direct-answer gate：简单高确定性目的直接回答，不展开递归 xNodeModel。
3. 先构造信息参数请求，不穷举工具。
4. 多个独立确定性缺口可并行调用 subagent / provider 获取参数。
5. 输出对象包括：
   - `CertaintyAssessment`
   - `XNodeModelPatch`
   - `RuntimeProofRecord`
   - `ImplementationPlan` 或 `CertaintyImprovementStatus`
6. 必须记录用户可感知 proof summary。
7. 若确定性足够，退出 planning 并进入后续 execute/test/review 节点。

### 7.4 示例 guidance

```ts
case "plan_repair":
  return [
    "先做 direct-answer gate：若用户目的是简单高确定性请求且无需项目上下文、多步决策、状态写入或 runtime proof，则直接回答，不展开递归 xNodeModel。",
    "否则进入 plan-certainty-improvement 节点：先提升目标确定性，再输出或更新具体实施方案。",
    "不要在顶层穷举 tools/skills；先把 why/what/flow/structure/runtimeProof 缺口转成 ContextParameterRequest，再使用当前 runtime 可用 provider 获取参数。",
    "若多个确定性缺口互不依赖，优先并行调用 subagent / provider 获取参数，主 agent 汇合后统一评估和写状态。",
    "本节点输出应落到 CertaintyAssessment、XNodeModelPatch、RuntimeProofRecord，以及 ImplementationPlan 或 CertaintyImprovementStatus。",
    "最终回复需展示压缩 runtime proof：为什么做、用了什么信息、确定性如何变化、写入了什么对象、是否退出。",
  ];
```

### 7.5 验收标准

- `plan_repair` guidance 包含 `plan-certainty-improvement`。
- guidance 包含 direct-answer gate / simple high-certainty intent fast path。
- guidance 包含 subagent / provider 并行获取参数的原则。
- guidance 包含 `ContextParameterRequest` 或等价“参数请求”概念。
- guidance 包含 `RuntimeProofRecord` 或 runtime proof 概念。
- guidance 不包含固定工具清单。

### 7.6 验证命令

```bash
node --experimental-strip-types --test extensions/passto-context/tests/x-node-policy.test.ts
npm --prefix extensions/passto-context run test:projection
```

如当前没有 `x-node-policy.test.ts`，新增最小测试并纳入 `test:projection` 或 `test:reflector` 中合适分组。

---

## 8. P2：Generator contract 接入

### 8.1 目标

让 before-agent-start 注入的 Generator Charter 在遇到 `plan_repair` / planning 确定性不足时，明确采用 `plan-certainty-improvement` 方法。

### 8.2 修改文件

- `extensions/passto-context/references/generator-contract.md`
- `extensions/passto-context/grc-generator-contract.ts`
- `extensions/passto-context/tests/generator-charter-prompt.test.ts`
- `extensions/passto-context/tests/before-agent-start-injection.test.ts`

### 8.3 设计要求

Generator contract 新增 Planning Certainty Improvement 段落：

```text
当 userGoal.executionState=planning，或当前 xNode policy=plan_repair，且 why/what/flow/structure/runtimeProof 不足以输出具体实施方案时：

- 先做 direct-answer gate：如果用户目的是简单高确定性请求，且无需项目上下文、多步决策、状态写入或 runtime proof，则直接回答，不展开递归 xNodeModel；
- 否则加载 plan-certainty-improvement 方法；
- 不在顶层穷举工具；
- 把不确定性转成 ContextParameterRequest；
- 使用 runtime 当前可用 context providers 获取参数；
- 当多个确定性缺口互不依赖时，优先并行调用 subagent / provider，主 agent 汇合结果后统一评估；
- 输出并写入 CertaintyAssessment / XNodeModelPatch / RuntimeProofRecord；
- 若足够，输出 ImplementationPlan；
- 若不足，输出 CertaintyImprovementStatus / ClarificationRequest / BlockedState；
- 最终回复必须展示压缩 runtime proof。
```

### 8.4 验收标准

- 注入 prompt 包含 `plan-certainty-improvement`。
- 注入 prompt 包含 simple high-certainty direct-answer gate。
- 注入 prompt 包含 subagent / provider 并行获取参数的方法引导。
- 注入 prompt 包含“不要穷举工具”或等价约束。
- 注入 prompt 包含输出对象与 runtime proof。
- 现有 fallback lines 不与新口径冲突。

### 8.5 验证命令

```bash
npm --prefix extensions/passto-context run test:reflector
npm --prefix extensions/passto-context run check:append-system
```

---

## 9. P3：Context parameter provider

### 9.1 目标

新增最小 provider，帮助 LLM 从当前状态拼装 Improve-certainty 所需参数包。

### 9.2 建议新增文件

- `extensions/passto-context/grc-plan-certainty-context.ts`
- `extensions/passto-context/tests/grc-plan-certainty-context.test.ts`

可选：后续再注册为工具。

- `extensions/passto-context/index.ts`
- tool name 可为 `collectPlanCertaintyContext`，但命名不是重点。

### 9.3 数据结构

```ts
export interface PlanCertaintyContextRequest {
  targetUserGoalId?: string | null;
  targetXNodeId?: string | null;
  targetFacet: "why" | "what" | "flow" | "structure" | "runtimeProof";
  blockingQuestion: string;
  requiredParameter: string;
  expectedShape?: "facts" | "decisions" | "constraints" | "unknowns" | "evidence" | "mixed";
}

export interface PlanCertaintyContextPacket {
  request: PlanCertaintyContextRequest;
  targetUserGoal: {
    id: string;
    assertion: string;
    executionState?: string;
    reviewState?: string;
  } | null;
  targetXNode: {
    id: string;
    assertion: string;
    phase: string;
    atomicity: string;
    facetStatus: Record<string, string>;
  } | null;
  policyProjection: unknown | null;
  latestRuntimeProof: unknown | null;
  proofSignals: unknown[];
  facts: string[];
  decisions: string[];
  constraints: string[];
  unknowns: string[];
  evidence: string[];
}
```

### 9.4 Provider 行为

Provider 只做信息拼装，不做最终判断。

它应：

1. 根据 target id 定位 userGoal / xNode。
2. 读取当前 facet 状态。
3. 附带最新 policy projection。
4. 附带 latest runtime proof / proof signals。
5. 输出 facts / decisions / constraints / unknowns / evidence。
6. 支持接收多个并行子任务返回的 packet，并汇合为统一 packet。
7. 不修改状态。
8. 不决定是否退出。

### 9.5 验收标准

- 给定完整 object state，能返回目标 userGoal 与 xNode 摘要。
- target 不存在时，返回 unknowns，而不是抛出非预期异常。
- packet 中 evidence 能说明来源。
- 能把多个独立 subagent / provider packet 汇合为统一 facts / decisions / constraints / unknowns / evidence。
- provider 不包含固定工具清单。

### 9.6 验证命令

```bash
node --experimental-strip-types --test extensions/passto-context/tests/grc-plan-certainty-context.test.ts
```

---

## 10. P4：Projection / patch 约定

### 10.1 目标

确保 Improve-certainty 的确定性变化能写入 xNode facet，而不是只写回复。

### 10.2 修改文件

通常无需修改主实现，现有 `patch_xnode` 已支持：

```ts
why?: XNodeFacet;
what?: XNodeFacet;
flow?: XNodeFacet;
structure?: XNodeFacet;
runtimeProof?: XNodeFacet;
```

主要补测试和示例。

候选文件：

- `extensions/passto-context/tests/user-goal-projection.test.ts`
- `extensions/passto-context/tests/user-goal-projection-tool.test.ts`

### 10.3 验收标准

- `patch_xnode` 可更新五维 facet。
- facet evidence / method 可保留。
- 写入失败时 warning 明确。
- Generator prompt 要求失败时输出 `ProposedXNodeModelPatch`。
- simple high-certainty direct-answer fast path 不要求创建或 patch xNodeModel。

### 10.4 验证命令

```bash
npm --prefix extensions/passto-context run test:projection
```

---

## 11. P5：Runtime proof 主链

### 11.1 目标

让 Improve-certainty 的判断链可以落入 `RuntimeProofRecord`。

### 11.2 修改文件

- `extensions/passto-context/grc-runtime-proof.ts`
- `extensions/passto-context/tests/*runtime-proof*.test.ts` 或新增测试
- 可能涉及 `grc-policy-surface.ts` / `ptc-status.ts` 的展示增强

### 11.3 设计要求

新增或复用 builder：

```ts
buildPlanCertaintyRuntimeProof(input: {
  targetXNodeId: string;
  atRound: number;
  uncertainty: string;
  parameterRequest: string;
  providerUsed: string;
  parallelSubagents?: Array<{ task: string; resultSummary: string; evidence: string[] }>;
  evidenceExtracted: string[];
  certaintyDelta: string[];
  stateWrite: string;
  exitDecision: string;
}): RuntimeProofRecord
```

同时支持 simple high-certainty fast path proof：

```ts
buildDirectAnswerFastPathProof(input: {
  userInputSummary: string;
  reasonNoXNodeNeeded: string;
  answerOrActionSummary: string;
  evidence: string[];
}): RuntimeProofRecord
```

输出：

```ts
{
  proofMode: "mixed" | "self-proof" | "runtime",
  proofStatus: "passed" | "partial" | "missing" | "failed",
  evidence: [
    "uncertainty: ...",
    "parameterRequest: ...",
    "providerUsed: ...",
    "evidenceExtracted: ...",
    "certaintyDelta: ...",
    "stateWrite: ...",
    "exitDecision: ..."
  ],
  verificationMethod: [...]
}
```

### 11.4 验收标准

- proof evidence 不只是工具调用名。
- proof 能表达 certainty delta。
- proof 能记录并行 subagent / provider 的任务摘要、结果摘要与证据。
- fast path proof 能说明为什么不需要展开 xNodeModel。
- state write 失败时 proofStatus 不能是 `passed`。
- 文档 proof 场景可以用 `mixed/passed` 表示。

### 11.5 验证命令

```bash
node --experimental-strip-types --test extensions/passto-context/tests/grc-runtime-proof-improve-certainty.test.ts
npm --prefix extensions/passto-context run test:status
```

---

## 12. P6：用户可感知回复 surface

### 12.1 目标

让 LLM 在该节点回复用户时稳定输出压缩 proof。

### 12.2 修改位置

主要是 prompt / contract，不建议硬编码回复模板：

- `extensions/passto-context/references/generator-contract.md`
- `extensions/passto-context/grc-generator-contract.ts`
- 相关 prompt tests

### 12.3 回复模板

```text
## 节点
plan-certainty-improvement

## 为什么做这一步
当前缺少：...
它阻塞：...

## 我获取了什么信息
- 来源类型：...
- 目的：...
- 关键信息：...

## 确定性变化
- why: ...
- what: ...
- flow: ...
- structure: ...
- runtimeProof: ...

## 写入对象
- CertaintyAssessment: ...
- XNodeModelPatch: ...
- RuntimeProofRecord: ...
- ImplementationPlan / CertaintyImprovementStatus: ...

## 退出判断
...

## 下一步
...
```

### 12.4 验收标准

- prompt 要求展示“为什么做”。
- prompt 要求展示“用了什么信息来源类型”。
- prompt 要求展示“确定性变化”。
- prompt 要求展示“写入对象与状态”。
- prompt 不要求暴露完整思维链。

### 12.5 验证命令

```bash
npm --prefix extensions/passto-context run test:reflector
```

---

## 13. P7：回归链接入

### 13.1 目标

把 Improve-certainty 关键契约纳入回归链，防止以后退化。

### 13.2 修改文件

- `extensions/passto-context/package.json`
- 新增 / 调整 tests

### 13.3 建议测试分组

新增：

```json
"test:plan-certainty": "node --experimental-strip-types --test tests/x-node-policy.test.ts tests/grc-plan-certainty-context.test.ts tests/grc-runtime-proof-improve-certainty.test.ts tests/user-goal-projection.test.ts tests/generator-charter-prompt.test.ts"
```

并接入：

```json
"test:grc": "... && npm run test:plan-certainty && ..."
```

也可以先把新增测试挂到已有 `test:projection` / `test:reflector`，避免脚本过细。

### 13.4 验收标准

- `npm run test:grc` 覆盖 Improve-certainty 主契约。
- 测试能防止：
  - `plan_repair` guidance 丢失 `plan-certainty-improvement`；
  - prompt 重新变成工具穷举表；
  - provider 不返回结构化 packet；
  - runtime proof 只记录工具名；
  - xNode facet patch 失效。

### 13.5 验证命令

```bash
npm --prefix extensions/passto-context run test:plan-certainty
npm --prefix extensions/passto-context run test:grc
```

当前收口验证结果：

- `test:plan-certainty`：22 passed。
- `test:grc`：all suites passed，且已包含 `test:plan-certainty`。

---

## 14. 实施顺序、并行策略与提交边界

Improve-certainty 的开发不必完全线性推进。P1–P5 中存在多个可独立实施的切片，应优先使用 subagent 并行执行以提升效率。

### 14.1 并行 subagent 执行策略

| 并行组 | 子任务 | 建议 agent | 模式 | 说明 |
|---|---|---|---|---|
| Group A | P1：`plan_repair` guidance + policy tests | `coder` | `spawn` | 纯 policy 文本与小测试 |
| Group B | P2：Generator contract + prompt tests | `coder` | `spawn` | contract 注入与 fallback lines |
| Group C | P3：Context provider module + packet merge tests | `coder` | `spawn` | 独立新模块与单测 |
| Group D | P5：Runtime proof builder + proof tests | `coder` | `spawn` | 扩展 proof builder 与 tests |
| Group E | Review：fast path / subagent 并行口径审查 | `reviewer` | `spawn` | 独立找过度展开或并行误用风险 |

依赖约束：

- P4 需在 Group C 初版后验证 provider packet 与 xNode facet patch 的类型兼容。
- P7 需在所有并行组完成、冲突合并后执行。
- 多个 subagent 不应同时编辑同一文件相邻区域；若必须改同一文件，由主 agent 统一合并。

回收策略：

```text
每个 subagent 返回 changed_files、verification_command、risk_notes。
主 agent 合并后统一运行 npm run test:grc。
```

### 14.2 推荐提交边界

推荐按以下保存点实现：

### Commit 1：Docs proof closure

内容：

- `improve-certainty-design.md`
- `improve-certainty-implementation-plan.md`
- README 索引

验证：

```bash
rg "improve-certainty-design|improve-certainty-implementation-plan" extensions/passto-context/docs/V2.0/README.md
```

### Commit 2：Policy guidance + tests

内容：

- 修改 `grc-x-node-policy.ts`
- 新增 policy test

验证：

```bash
npm --prefix extensions/passto-context run test:projection
```

### Commit 3：Generator contract + prompt tests

内容：

- 更新 `references/generator-contract.md`
- 更新 fallback lines（如需要）
- 更新 prompt tests

验证：

```bash
npm --prefix extensions/passto-context run test:reflector
npm --prefix extensions/passto-context run check:append-system
```

### Commit 4：Context provider

内容：

- 新增 provider module
- 新增 provider tests
- 可选注册 tool

验证：

```bash
node --experimental-strip-types --test extensions/passto-context/tests/grc-plan-certainty-context.test.ts
```

### Commit 5：Runtime proof builder + status surface

内容：

- 新增 / 扩展 proof builder
- 测试 proof record 内容
- 必要时增强 status surface

验证：

```bash
npm --prefix extensions/passto-context run test:status
```

### Commit 6：Full regression

内容：

- 接入 package script
- 全链回归

验证：

```bash
npm --prefix extensions/passto-context run test:grc
```

---

## 15. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| prompt 又变成工具清单 | skill 过时、LLM 机械路由 | 测试禁止固定工具穷举，强调 provider 抽象 |
| provider 变成判断器 | LLM 被脚本替代，失去方法论判断 | provider 只返回 packet，不输出 exit decision |
| proof 只记录工具名 | runtime proof 不可解释 | proof builder 强制 uncertainty/evidence/delta/state/exit 字段 |
| 状态写入失败被自然语言掩盖 | 后续 agent 无法恢复状态 | prompt 要求 ProposedXNodeModelPatch + proofStatus!=passed |
| planning 无限循环 | 无法进入 execute | 明确退出软约束与 ImplementationPlan 输出条件 |
| 实施计划和设计方案脱节 | 后续开发无依据 | README 索引 + 文档互链 + tests 引用关键术语 |

---

## 16. Improve-certainty 后续动作定义

把“输出设计方案”和“输出实施方案”正式加入 Improve-certainty 的后续动作：

```text
Improve-certainty plan stage
  ↓
Action 1: output-design-proposal
  outputObject: docs/V2.0/improve-certainty-design.md
  purpose: 关闭 why / what / structure / runtime proof 协议的设计确定性
  proof: 文件存在、可回读、包含节点方法论/输出对象/runtime proof/用户可感知回复
  ↓
Action 2: output-implementation-plan
  outputObject: docs/V2.0/improve-certainty-implementation-plan.md
  purpose: 关闭 flow / implementation sequencing / test strategy / rollout 确定性
  proof: 文件存在、可回读、包含 P0–P7 切片、代码落点、验证命令、final proof 口径
  ↓
Exit: plan stage complete
  nextPolicy: execute_atomic_work 或 generate_children
```

### 16.1 对 xNodeModel 的建议表达

```ts
{
  action: "patch_xnode",
  userGoalId: "goal-improve-certainty-plan-stage",
  id: "improve-certainty-plan",
  phase: "complete",
  why: {
    confidence: "closed",
    summary: "Improve-certainty 作为 planning 确定性提升节点存在，用于避免 plan_repair 退化为工具穷举或伪方案输出。",
    evidence: ["improve-certainty-design.md"]
  },
  what: {
    confidence: "closed",
    summary: "Plan 阶段产物为设计方案与具体开发实施计划两个文档。",
    evidence: ["improve-certainty-design.md", "improve-certainty-implementation-plan.md"]
  },
  flow: {
    confidence: "closed",
    summary: "后续开发按 P0–P7 切片推进，从 policy guidance 到 generator contract、provider、projection、proof、用户回复与回归链。",
    evidence: ["improve-certainty-implementation-plan.md"]
  },
  structure: {
    confidence: "closed",
    summary: "对象落点覆盖 V2.0 docs、grc-x-node-policy、generator contract、provider、projection、runtime proof、tests 与 README 索引。",
    evidence: ["improve-certainty-design.md", "improve-certainty-implementation-plan.md"]
  },
  runtimeProof: {
    confidence: "closed",
    summary: "设计方案与实施计划已写入文件并进入索引，可作为 Improve-certainty plan 阶段最终 runtime proof。",
    evidence: [
      "docs/V2.0/improve-certainty-design.md",
      "docs/V2.0/improve-certainty-implementation-plan.md",
      "docs/V2.0/README.md"
    ]
  }
}
```

---

## 17. Final runtime proof 与实施收口 proof

Improve-certainty 的最终 proof 分两层：

1. **Plan 阶段 proof**：设计方案与实施计划均已写入、进入 README 索引，并可通过 read / rg 验证。
2. **Implementation proof**：P0–P7 已落地到代码、prompt contract、provider、projection、runtime proof 与回归链，并通过专门回归与完整 GRC 回归。

```text
proofMode: mixed
proofStatus: passed
target: improve-certainty-implementation
resultSummary:
  Improve-certainty 已完成从 plan proof 到 P0–P7 实施收口。设计方案定义节点方法论、输出对象、信息参数获取、状态写入、runtime proof 与用户可感知回复协议；实施计划定义并追踪 P0–P7 开发切片、代码落点、测试策略与回归接入方式；当前 package scripts 已提供 test:plan-certainty，并已接入 test:grc。

evidence:
  - docs/V2.0/improve-certainty-design.md exists and is indexed
  - docs/V2.0/improve-certainty-implementation-plan.md exists and is indexed
  - package.json defines test:plan-certainty
  - test:grc runs test:plan-certainty before test:round-state
  - tests/x-node-policy.test.ts covers plan_repair guidance and no fixed tool enumeration
  - tests/grc-plan-certainty-context.test.ts covers provider packet and merge behavior
  - tests/grc-runtime-proof-improve-certainty.test.ts covers proof chain and signals
  - tests/user-goal-projection.test.ts covers xNode facet patch and fast path no-op
  - tests/generator-charter-prompt.test.ts covers Generator charter surface

verificationMethod:
  - rg README index and implementation status
  - npm --prefix extensions/passto-context run test:plan-certainty
  - npm --prefix extensions/passto-context run test:grc
```

当前验证结果：

```text
test:plan-certainty → 22 passed
test:grc → all suites passed, includes test:plan-certainty
```

---

## 18. 后续维护口径

本实施计划已完成，不再继续追加 P8+ 切片作为默认动作。

后续只有在以下情况才回到本文档更新：

1. `plan-certainty-improvement` 的输出对象、状态写入协议或 proof 协议发生变化。
2. `test:plan-certainty` 的覆盖范围发生实质调整。
3. `test:grc` 的回归链顺序或 release gate 发生变化。
4. 后续 review 发现 P0–P7 中任一切片的实现与文档口径不一致。

日常维护建议：

```bash
npm --prefix extensions/passto-context run test:plan-certainty
npm --prefix extensions/passto-context run test:grc
```

若只是普通业务实现，不应把本文档作为继续扩写计划的入口；应按具体变更进入对应 implementation / debug / review 流程。
