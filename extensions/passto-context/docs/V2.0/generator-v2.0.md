# PasstoContext V2.0 Generator 设计

> 版本：v2.0 | 状态：Draft | 更新：2026-05-20

---

## 1. V2.0 Generator 的核心升级

V1.x / 早期 V2 文档里，Generator 的升级重点主要放在：
- 即时目标识别
- 五维工作框架
- upward regression 防漂移

这些仍然成立，但在当前正式口径下，Generator 的真正职责应改写为：

> **在当前轮先确认当前服务的是哪个用户目标，再围绕该用户目标对应的 x-node-model 推进。**

因此 V2.0 Generator 的关键变化是：

| 维度 | 旧口径 | 新口径 |
|---|---|---|
| 目标对象 | 单层 GoalTree / focus goal | 用户目标树 + 当前用户目标对应的 x-node-model |
| 当前轮识别 | 继续已有 goal / 新 goal | 继续已有 user goal / 识别新的 user goal |
| 工作对象 | focus goal 节点 | 当前 user goal 对应的 x-node-model 焦点节点 |
| 下一步判断 | GoalTree + nextStepType | x-node-model + policy projection + nextStepType |
| 输出语义 | 结果为主 | 结果 + 方法 + proof |

---

## 2. 当前轮首先要做什么：确认当前用户目标

### 2.1 问题

如果当前轮不先区分“用户目标”和“agent 目标节点”，就会出现：
- 把 agent 内部递归目标误当成用户真正目标
- 把局部 x-node 焦点切换误当成用户目标切换
- 把 `GoalTree focus` 的变化误解释为用户需求层发生变化

### 2.2 正确做法

Generator 在处理用户消息时，第一步不是先找“下一个 task”，而是先判断：

1. 这条消息服务于哪个**已有用户目标**？
2. 还是引入了一个**新的独立用户目标**？

当前实现主入口是 `applyUserGoalProjection`：Generator 直接把新目标、补充、纠偏、完成、重开、迁移、拆分或合并投影到正式 `UserGoalTreeDocument` / `XNodeModelDocument`，而不是再走 `draftGoalOp` / provisional overlay 旁路。复核阶段由 `reviewState` 表达：Generator 写入默认为 `generator_projected`，Curator 后验确认后转为 `curator_reviewed`，用户明确确认才是 `user_confirmed`。

判断依据仍然是：
- **why**：这条消息的动机服务于哪个已有目标
- **what**：它指向的成果物是否属于已有用户目标

但这里的判断对象已经从“单层 goal”提升到了“用户目标树层”。

---

## 3. 用户目标确认后，才进入 x-node-model

一旦确认当前服务的是哪个用户目标，Generator 才进入下一层：

- 读取该用户目标对应的 `x-node-model`
- 找到当前 `currentFocusXNodeId`
- 在 why / what / flow / structure / runtime proof 五维骨架上推进
- 参考 policy projection 自主判断下一步

因此 Generator 的执行顺序应写成：

```text
先确认 user goal
  ↓
绑定 / 读取对应 x-node-model
  ↓
确定当前 x-node focus
  ↓
围绕五维骨架推进
  ↓
输出结果 + proof / 方法
```

---

## 4. 五维工作框架在 V2.0 中的准确位置

五维框架本身不变：
- Why
- What
- Flow
- Structure
- Runtime Proof

但它们在 V2.0 里的作用不再只是“Generator 的思维 checklist”，而是：

> **x-node 的原生骨架 + Generator 的方法论消费框架。**

换句话说：
- x-node-model 负责把五维状态显式化
- Generator 负责消费这些五维状态并继续推进

### 对应关系

| 维度 | 在 x-node-model 中 | 在 Generator 中 |
|---|---|---|
| Why | 当前节点存在理由、与父层关系 | 判断当前动作是否仍服务当前 user goal |
| What | 当前节点产出物与完成定义 | 收敛本轮真正产出对象 |
| Flow | 当前节点达成路径 | 判断下一步先拆、先做、先测还是先回退 |
| Structure | truth source / 对象 / 依赖关系 | 判断该查什么、改什么、依赖什么 |
| Runtime Proof | 证据与验证方法 | 判断当前结论是否已被现实支撑 |

---

## 5. `nextStepType` 在 Generator 侧的正确消费方式

V2.0 中，`nextStepType` 的本质是：
- 从 `x-node-model` 投影出来的 soft policy
- 不是主链硬切换器

### Generator 应如何消费

#### `plan_repair`
表示：
- 当前 why/what/flow/structure 仍有关键缺口
- 本轮应优先补计划/定义/依赖，而不是盲目执行

#### `generate_children`
表示：
- 当前 x-node 更像 composite
- 本轮应继续细化子目标，而不是直接交付最终产物

#### `execute_atomic_work`
表示：
- 当前 x-node 已足够 bounded
- 本轮应把它当作一个最小完整工作切片推进

#### `run_tests`
表示：
- 当前更缺 proof 而不是缺实现
- 本轮应优先验证/复测/runtime 观察

#### `seek_acceptance`
表示：
- 当前节点或当前用户目标已经足够完成
- 本轮应优先收口与验收，而不是继续扩 scope

#### `upward_regression`
表示：
- 当前局部节点已经完成
- 本轮应回到 parent / sibling，或回到用户目标树更高层重新判断

### 关键约束

Generator 不应把这些枚举当作“必须执行的命令”，而应把它们理解为：

> **当前运行时状态对 LLM 的策略提示。**

---

## 6. 当前轮输出必须是“结果 + 方法 + proof”

V2.0 Generator 的输出不应只有结果摘要。

至少应同时包含：
- 结果信息
- 方法路径
- proof / 自证明方式
- 若 proof 不足，对应的 proof gap 或 signal

这与“上下文 = 信息 + 方法”的设计哲学对齐：
- 输入是信息 + 方法
- 输出也应是信息 + 方法 + proof

---

## 7. 当前轮的目标切换与 x-node 扩展

### 7.1 新用户目标

若当前轮识别到新的独立用户目标：
- 主 Agent 在当轮确认该用户目标
- 绑定 / 创建对应的 x-node-model
- 围绕该新用户目标推进
- 下一轮 `before_agent_start` 由 Curator 审核确认/更新

### 7.2 已有用户目标内的新子问题

若不是新用户目标，而是已有用户目标内需要进一步拆解：
- 不应切换用户目标树层
- 而应在当前用户目标对应的 `x-node-model` 内扩展 children / 调整焦点

这是 V2.0 最关键的边界之一：

> **用户目标切换** 和 **x-node 内部焦点迁移** 不是同一种变化。

---

## 8. Upward Regression 的重新定位

旧口径里，upward regression 常被写成 GoalTree 内部的完成后回退规则。

在 V2.0 里应拆成两层：

### 8.1 x-node-model 内部 upward regression

当当前 x-node local complete 时：
- 先检查 parent / sibling
- 决定是否回到上层节点
- 不默认继续深挖已完成局部

### 8.2 用户目标树层回退

当某个 x-node-model 整体完成时：
- 对应 user goal.completed
- 再回到用户目标树判断是否切换下一个用户目标

因此：
- local complete ≠ x-node-model complete
- x-node-model complete ≠ user goal tree complete

---

## 9. 与当前 repo 的过渡态关系

当前 repo 中已经存在：
- GoalTree 视图注入
- certaintyAssessment
- nextStepType soft consumer
- Generator Charter 中的 why/what 粗判

在正式口径下，这些可被重新解释为：
- GoalTree 视图：当前 x-node-model 的兼容摘要视图
- certaintyAssessment：`XNodePolicyProjection` 的兼容投影字段
- nextStepType：policy projection 字段
- 即时目标识别：用户目标树层的当前轮识别能力

因此这份文档不是要求 Generator 推翻现有行为，而是要求后续文档和实现都按这套双层对象语义收口。

---

## 10. 一句话

> V2.0 Generator 的核心升级，不是“更聪明地找下一个 task”，而是：**先确认当前服务的是哪个用户目标，再围绕对应 x-node-model 在 why/what/flow/structure/runtime proof 五维骨架中推进，并把 `nextStepType` 当作软策略而不是硬命令来消费。**