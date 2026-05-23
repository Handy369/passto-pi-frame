# PasstoContext V2.0 用户目标树与 x-node-model 模型

> 版本：v2.0 | 状态：Draft | 更新：2026-05-20

---

## 1. 设计目标

V2.0 的目标模型不应再把“用户目标”和“Agent 递归目标树”混成一个单层 GoalTree。

本文件要正式区分两个对象：

1. **用户目标树（UserGoalTreeDocument）**
2. **每个用户目标对应的 x-node-model（XNodeModelDocument）**

从而让系统具备：

1. **用户层目标表达**：用户真正想完成什么，层级关系如何
2. **agent-side 递归表达**：围绕某个用户目标，Agent 如何进一步拆解与推进
3. **五维骨架表达**：why / what / flow / structure / runtime proof 进入节点原生结构
4. **双层完成闭环**：x-node-model 完成 ≠ 整体用户目标树完成
5. **软策略投影**：基于 x-node-model 当前状态生成 `nextStepType`

---

## 2. 双层对象结构

## 2.1 用户目标树：UserGoalTreeDocument

用户目标树是用户层 truth source，用来表达：
- 用户当前有哪些目标
- 它们之间的层级/并列关系
- 当前焦点用户目标是什么
- 每个用户目标对应哪个 x-node-model
- 该用户目标当前处于哪个状态

```ts
interface UserGoalTreeDocument {
  version: 1;
  agentRound: number;
  updatedAt: string;

  currentFocusUserGoalId: string | null;
  rootUserGoalIds: string[];
  userGoals: UserGoalNode[];
}

interface UserGoalNode {
  id: string;
  parentId: string | null;
  assertion: string;

  status: "identified" | "planning" | "executing" | "completed";

  xNodeModelId: string | null;
  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;
}
```

### 状态语义

- `identified`：用户输入后在当轮识别确定
- `planning`：提高目标确定性直到产出实施计划
- `executing`：确定性足够，按 x-node-model 推进
- `completed`：对应 x-node-model 已整体完成

---

## 2.2 x-node-model：XNodeModelDocument

每个用户目标都映射到一个 `x-node-model` 文件。它是：
- Agent 围绕该用户目标展开的递归目标树
- 该用户目标的 agent-side 状态机
- LLM 当前轮消费的核心执行对象

```ts
interface XNodeModelDocument {
  version: 1;
  userGoalId: string;
  agentRound: number;
  updatedAt: string;

  currentFocusXNodeId: string | null;
  rootXNodeIds: string[];
  nodes: XNode[];

  latestPolicyProjection?: XNodePolicyProjection | null;
  latestRuntimeProof?: RuntimeProofRecord | null;
  latestProofSignals?: RuntimeProofSignal[];
}
```

---

## 2.3 x-node：Agent 目标节点的五维骨架

任意 x-node 都应以五维为原生骨架，而不是把五维只放到 Curator 的附加字段里。

```ts
interface XNode {
  id: string;
  parentId: string | null;
  assertion: string;

  status: "active" | "suspended" | "completed";
  atomicity: "atomic" | "composite" | "undecided";
  phase: "plan" | "plan_insufficient" | "execute" | "testing" | "pending_acceptance" | "complete";

  why: XNodeFacet;
  what: XNodeFacet;
  flow: XNodeFacet;
  structure: XNodeFacet;
  runtimeProof: XNodeFacet;

  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;
  priority: number;
  order: number;
}

interface XNodeFacet {
  summary: string;
  confidence: "open" | "partial" | "closed";
  evidence?: string[];
  method?: string[];
}
```

### 关键语义

这里的五维不是“后验评分表”，而是：

> **agent 目标对象本身的结构。**

也就是说，x-node 既包含：
- 信息
- 方法
- 证据

也包含其当前闭合状态。

---

## 3. Atomic / Composite 与 Phase

虽然 V2.0 已从单层 GoalTree 口径切到 UserGoalTree + XNodeModel，但 `atomicity` 与 `phase` 依然保留，并且它们的归属应该落在 **x-node** 层，而不是用户目标树层。

### 3.1 atomicity

```ts
type XNodeAtomicity = "atomic" | "composite" | "undecided";
```

#### atomic
- 当前节点是一个 bounded work item
- 可直接进入实施 / proof
- 不要求继续拆 children

#### composite
- 当前节点更像一个组合目标
- 需要生成或推进 children
- 下一步通常不是直接交付最终产物

#### undecided
- 当前轮尚不足以稳定判断 atomic / composite
- 应先补 why/what/flow/structure 缺口

---

### 3.2 phase

```ts
type XNodePhase =
  | "plan"
  | "plan_insufficient"
  | "execute"
  | "testing"
  | "pending_acceptance"
  | "complete";
```

### 语义

| Phase | 含义 |
|---|---|
| `plan` | 目标已识别，正在收敛计划 |
| `plan_insufficient` | 当前计划不足，需要补 why/what/flow/structure |
| `execute` | 可以直接推进实施 |
| `testing` | 实施已完成，当前重点是 proof |
| `pending_acceptance` | proof 基本成立，等待用户确认 |
| `complete` | 当前 x-node 已完成 |

### 关键点

- 用户目标树表达的是用户目标状态
- x-node 的 `phase` 表达的是 agent-side 执行推进状态
- 两者不能混写成一个字段

---

## 4. 软策略投影：XNodePolicyProjection

`nextStepType` 不应再被理解成从 GoalTree 静态枚举里生硬挑出来的执行命令，而应来自 x-node-model 的当前状态投影。

```ts
interface XNodePolicyProjection {
  xNodeId: string;
  derivedAtRound: number;

  dimensions: {
    why: "open" | "partial" | "closed";
    what: "open" | "partial" | "closed";
    flow: "open" | "partial" | "closed";
    structure: "open" | "partial" | "closed";
    runtimeProof: "open" | "partial" | "closed";
  };

  keyGaps: string[];
  nextStepType:
    | "plan_repair"
    | "generate_children"
    | "execute_atomic_work"
    | "run_tests"
    | "seek_acceptance"
    | "upward_regression";

  confidence: number;
  guidance: string[];
}
```

### 正确理解

它是：
- 状态摘要
- prompt-time soft policy
- 方法论提示

不是：
- 代码级硬调度输出

---

## 5. RuntimeProofRecord / RuntimeProofSignal

### 5.1 RuntimeProofRecord

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

### 5.2 RuntimeProofSignal

```ts
interface RuntimeProofSignal {
  id: string;
  targetXNodeId: string;
  atRound: number;

  type:
    | "runtime-proof-failed"
    | "runtime-proof-partial"
    | "runtime-proof-missing"
    | "runtime-proof-conflicted";

  message: string;
  suggestedNextStepType?: XNodePolicyProjection["nextStepType"];
  evidence?: string[];
}
```

### 关键语义

proof 不再只是“测试过没过”，而是目标对象的一部分。

如果 proof 不符合预期：
- 不能只在自然语言中提一句
- 应正式产生日志信号
- 后续由 Curator / runtime / replay / status 面共同消费

---

## 6. 完成语义：必须双层闭环

## 6.1 x-node-model 完成

表示：
- 某个用户目标对应的 agent 递归目标树已整体完成
- 对应用户目标可以从 `executing` 推进到 `completed`

## 6.2 用户目标树完成

表示：
- 用户层目标链整体收口
- 或当前上层用户目标所有子目标均已完成

### 正确链路

```text
x-node-model 全完成
  ↓
对应 user goal.completed
  ↓
读取 UserGoalTreeDocument
  ↓
LLM 在软约束下判断下一个 user goal
```

因此：

> **local complete ≠ x-node-model complete ≠ user goal tree complete**

---

## 7. 过渡期与兼容态说明

当前 repo 里已有的：
- `GoalTreeDocument`
- `GoalNode`
- `certaintyAssessment`
- `nextStepType`

在目标态里，应被重新理解为：

- `GoalTreeDocument`：过渡期兼容结构，或 `XNodeModelDocument` 的早期简化承载
- `GoalNode`：早期 x-node 近似物
- `certaintyAssessment`：`XNodePolicyProjection` 的兼容摘要投影
- `nextStepType`：soft policy projection 的可见字段

也就是说，V2.0 不是否定当前兼容实现，而是要求文档与后续实现逐步收口到正式对象层。

---

## 8. 一句话

> V2.0 的目标模型核心，不是“把 GoalTree 再做复杂一点”，而是正式区分 **用户目标树** 和 **每个用户目标对应的 x-node-model**，并让五维骨架、soft policy、runtime proof 都落到 x-node 这一层。