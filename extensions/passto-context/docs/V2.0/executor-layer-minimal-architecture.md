# PasstoContext V2.0 执行器层最小架构方案（按“用户目标树 + x-node-model + LLM 主导软调度”重写）

> 状态：Draft  
> 更新：2026-05-20  
> 目标：在不推翻现有 GRC / GoalTree / Curator / Reflector / 注入链的前提下，把当前 V2.0 从“确定性判断 + 软消费观测层”推进到与流程图一致的 **最小执行稳定层**。  
> 核心原则：**LLM 才是核心；脚本、状态、信号、文件对象负责提高可靠性、稳定性与可分析性，而不是主导流程。**

---

## 1. Why：为什么这里不是“再加一个硬调度器”

上一种容易滑过去的错误，是把“从目标确定性开始补执行器层”理解成：

- 新增一个 code-enforced scheduler
- 由 if/else 或 DAG 引擎直接决定下一步
- LLM 只负责被动执行

这不符合当前目标架构。

当前更真实的设计哲学是：

1. **用户目标树** 是用户层目标对象
2. **x-node-model** 是每个用户目标对应的 agent 递归目标树 / 状态机文件
3. **nextStepType** 是基于 x-node-model 当前状态投影出的 prompt 软策略
4. **LLM** 在“信息 + 方法”的复合上下文里自主判断下一步
5. **脚本** 负责把这种判断变得更稳定、可持续、可观测、可复盘

因此本方案要补的，不是“硬控制器”，而是：

> **让 x-node-model 成为正式对象，让 soft policy、proof、signal 与用户目标树之间形成可持续的运行时主链。**

---

## 2. What：最小要补齐的不是“控制器”，而是五类对象

## 2.1 最小目标

补出一套最小 runtime 架构，使系统可以明确表达：

- 用户目标树如何存在
- 每个用户目标如何映射到一个 x-node-model
- x-node-model 如何以 why / what / flow / structure / runtime proof 为骨架
- x-node-model 如何投影出 `nextStepType` 软策略
- runtime-proof 不符合预期时如何产生结构化信号日志
- 某个 x-node-model 完成后，如何回到用户目标树继续推进

---

## 2.2 非目标

本方案**不打算**：

- 把系统改造成硬状态机工作流引擎
- 把 LLM 降成纯 worker
- 默认并行化所有 agent/subagent
- 用代码完全替代 LLM 对下一步的判断
- 在第一版就实现全自动无人值守递归执行

本方案只做：

> **把“LLM 主导”的执行哲学，落成最小可持续的文件对象、软策略投影与 proof/signal 机制。**

---

## 3. Structure：双层对象模型

## 3.1 UserGoalTreeDocument

用户目标树是最高层 truth source。它不负责细粒度执行，只负责：

- 用户当前有哪些目标
- 这些目标之间的层级/并列关系
- 当前用户层焦点目标是什么
- 每个用户目标对应哪个 x-node-model
- 该用户目标当前处于：确定 / 计划阶段 / 实施阶段 / 完成

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

### 语义说明

- `identified`：用户输入后在当轮识别确定
- `planning`：提高目标确定性到输出实施计划
- `executing`：确定性足够，按 x-node-model 实施
- `completed`：对应 x-node-model 全完成

---

## 3.2 XNodeModelDocument

每个用户目标都有一个对应的 x-node-model 文件。它是：

- agent 的递归目标树文件
- 该用户目标的 agent-side 状态机
- LLM 判断下一步的核心运行时对象

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

### 关键点

这里的五维不是附加字段，而是：

> **x-node 的原生骨架。**

这比当前 repo 里单独维护 `certaintyAssessment` 更完整，因为它把：

- 信息
- 方法
- 证据

一起装进目标节点本身。

---

## 3.3 XNodePolicyProjection

它对应当前 repo 里的 `nextStepType`，但要明确语义：

- 这是从 x-node-model 当前状态投影出来的软策略
- 供 before_agent_start 注入 prompt
- 指导 LLM 自主选择下一步
- 不是硬编码命令

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

### 正确角色

它更像：

- prompt-time policy projection
- LLM 的当前工作方式建议
- x-node-model 状态的可读摘要

而不是：

- code-enforced scheduler output

---

## 3.4 RuntimeProofRecord

任意 agent / subagent 输出都应是“信息 + 方法”的复合体，因此结果对象不能只写 summary，还要写 proof。

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

### 关键点

- `verificationMethod` 是方法面
- `evidence` 是信息面
- `proofStatus` 是状态面

它们必须一起存在。

---

## 3.5 RuntimeProofSignal

当 runtime-proof 不符合预期时，不能只把结果静默吞掉或只在自然语言里一笔带过，而应产生日志信号。

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

### 作用

- 供后期分析迭代
- 供 status / artifact / session replay 观测
- 供下一轮 prompt 注入时提醒 LLM

---

## 4. Flow：最小运行主链

## 4.1 会话开始：先处理用户目标树

```text
用户输入到来
  ↓
主 Agent 在当轮识别 / 确认用户目标
  ↓
更新 UserGoalTreeDocument
  ↓
为当前用户目标关联 / 创建对应 XNodeModelDocument
```

### 关键语义

- 用户目标树负责“用户到底想完成什么”
- x-node-model 负责“Agent 如何把它递归拆解并推进”

---

## 4.2 before_agent_start：Curator 后验确认 / 更新

```text
下一轮 before_agent_start
  ↓
Curator 审核确认 / 更新用户目标树
  ↓
Curator 审核确认 / 更新当前用户目标对应的 x-node-model
  ↓
生成/更新 XNodePolicyProjection
  ↓
把 x-node-model 状态 + policy 注入主 Agent prompt
```

### 这里的主轴不是“自动执行”，而是“稳定上下文”

脚本做的事：

- 恢复对象状态
- 对齐目标上下文
- 投影方法与策略
- 暴露当前 proof 缺口

真正决定下一步的仍然是 LLM。

---

## 4.3 计划阶段：提高确定性直到输出实施计划

若当前用户目标处于 `planning`：

- 主 Agent 读取当前用户目标的 x-node-model
- 在 why/what/flow/structure/runtime proof 五维上补齐缺口
- 必要时扩展 / 更新 x-node-model 节点
- 当确定性足够时，产出实施计划并把用户目标状态推进为 `executing`

这里的“目标实现方案”不应作为另一个独立的硬对象，而更适合被表达为：

- x-node-model 根节点或焦点节点上的 `flow / structure / method` 更新
- 或 x-node-model 内专门的 plan 子节点

---

## 4.4 实施阶段：按 x-node-model 推进

若当前用户目标处于 `executing`：

- LLM 读取 x-node-model 当前焦点节点
- 根据 `XNodePolicyProjection.nextStepType` 的软约束判断下一步
- 可能做的动作包括：
  - 补 plan
  - 生成 children
  - 直接执行 atomic 节点
  - 运行 proof / tests
  - 向上回归 parent / sibling
  - 请求用户验收

这里的核心不是脚本强制选动作，而是：

> **脚本把当前状态和方法论稳定地摆到 LLM 面前，让 LLM 更稳定地做出正确的下一步。**

---

## 4.5 完成阶段：x-node-model 完成后回到用户目标树

```text
某个 x-node-model 全部完成
  ↓
对应 user goal 标记 completed
  ↓
主 Agent 读取 UserGoalTreeDocument
  ↓
软约束 prompt 指导 LLM 判断下一个 user goal
```

所以“完成”必须分两层：

1. **x-node-model 完成**：某个用户目标已实现
2. **用户目标树完成**：整个用户侧目标集合已完成

---

## 5. `nextStepType` 的最小落地方式（软调度版本）

这里保留当前 repo 已有的 `nextStepType` 枚举，但重新解释其角色。

## 5.1 `plan_repair`

表示：
- x-node 当前 why/what/flow/structure 仍有关键缺口
- LLM 应优先补计划/定义/依赖，而不是盲目执行

脚本职责：
- 注入缺口
- 记录当前 policy
- 允许 LLM 自主调用工具 / skills 补齐

---

## 5.2 `generate_children`

表示：
- 当前 x-node 更像 composite
- 应在当前 x-node-model 中进一步细分子目标

脚本职责：
- 允许 x-node-model 扩展 nodes
- 记录 child 变化
- 更新焦点与 policy

不要求：
- 代码硬生成 child 列表

child 仍可以由 LLM 基于软约束生成。

---

## 5.3 `execute_atomic_work`

表示：
- 当前焦点节点已足够 bounded
- LLM 应把它当作单个最小完整切片推进

脚本职责：
- 稳定注入当前 x-node 上下文
- 记录执行结果
- 回收 runtime proof

---

## 5.4 `run_tests`

表示：
- 当前焦点更缺 proof 而不是缺实现
- LLM 应优先验证 / 回归 / runtime 观察

脚本职责：
- 记录 `RuntimeProofRecord`
- 若 proof 不符合预期，记录 `RuntimeProofSignal`

---

## 5.5 `seek_acceptance`

表示：
- 当前 x-node 或当前用户目标已经足够完成
- 需要用户确认，而不是继续扩展范围

脚本职责：
- 汇总 proof
- 在状态面显式暴露“等待验收”

---

## 5.6 `upward_regression`

表示：
- 当前局部节点已完成
- 应回到 parent / sibling，或回到用户目标树更高层

脚本职责：
- 记录焦点迁移
- 暴露当前迁移对象
- 让 LLM 在上层上下文重新判断下一步

---

## 6. Surface：建议新增 / 重构的文件对象与接线位置

## 6.1 建议新增对象文件

### `user-goal-tree.ts`
负责：
- `UserGoalTreeDocument` 类型与读写
- 用户目标状态迁移工具

### `x-node-model.ts`
负责：
- `XNodeModelDocument` 类型与读写
- x-node 五维骨架辅助

### `x-node-policy.ts`
负责：
- 从 x-node-model 提炼 `XNodePolicyProjection`
- 生成注入 prompt 的软约束文本

### `runtime-proof.ts`
负责：
- `RuntimeProofRecord`
- `RuntimeProofSignal`
- proof result -> signal 的转换

### `x-node-injection.ts`
负责：
- 把用户目标树 + 当前 x-node-model + policy + proof signal 注入上下文

---

## 6.2 对现有 GRC 主链的最小改法

### 现有 `GoalTreeDocument`
不必立刻删除，但它更适合被视为：

- 过渡期的通用 goal-state 结构
- 或 x-node-model 的临时简化载体

长期应收敛到：

- `UserGoalTreeDocument`
- `XNodeModelDocument`

双层正式对象。

### `before-agent-start-injection.ts`
当前：
- 注入 goal state + certainty + next step policy

应演进为：
- 注入用户目标树摘要
- 注入当前用户目标对应的 x-node-model
- 注入 policy projection
- 注入 proof signal 摘要

### `grc-subagent.ts`
当前：
- 只服务 Curator / Reflector

应演进为：
- 保持 Curator / Reflector 不变
- 后续允许把“执行型 subagent 输出”也纳入 `RuntimeProofRecord` 范式

---

## 7. Runtime Proof：如何证明这不是又一层只会显示的文档设计

至少要拿到以下真实证据，才能说执行稳定层真的落成：

1. 真实 session 中存在 `UserGoalTreeDocument`
2. 真实 session 中存在按 user goal 分文件的 `XNodeModelDocument`
3. before_agent_start 真正注入 x-node-model 五维骨架，而不只是平铺 goal state
4. `nextStepType` 真正由 x-node-model 投影得到，而不是孤立字段
5. 某次 runtime-proof 失败后，真实产生 `RuntimeProofSignal`
6. 某个 x-node-model 完成后，真实把对应用户目标标记 completed
7. 完成一个用户目标后，真实回到用户目标树判断下一个目标

如果做不到这些，就仍然只是：

- 观测层增强
- 而不是执行稳定层落地

---

## 8. 最小实施顺序

## Phase E1：先补双层对象，不急着改调度

先做：
- `UserGoalTreeDocument`
- `XNodeModelDocument`
- x-node 五维骨架持久化

目标：
- 先把真实对象层立住

---

## Phase E2：把 `nextStepType` 改写成 x-node policy projection

再做：
- `XNodePolicyProjection`
- before_agent_start 注入重写

目标：
- 让 soft scheduling 真正基于 x-node-model，而不是基于抽象 goalState

---

## Phase E3：补 runtime-proof record / signal

再做：
- proof 记录对象
- proof failure signal
- status / replay / artifact 可观测面

目标：
- 让“信息 + 方法 + proof”真正闭环

---

## Phase E4：补双层完成推进

最后做：
- x-node-model 完成 -> user goal completed
- user goal tree 继续推进

目标：
- 补齐局部完成到全局推进的双层闭环

---

## 9. 一句话

> 从“目标确定性”开始补齐执行器层，正确方向不是造一个更硬的 scheduler，而是把 **用户目标树 → 每用户目标一个 x-node-model → x-node policy projection → LLM 主导执行 → runtime-proof signal → 回到用户目标树继续推进** 这条主链正式落到对象、注入、记录与信号层。 
