# Core Flow Design

> **last_verified: 2026-05-14**
> migrated from: `product-design/skill.md` Step 1

## 作用

当需要先把一个功能性任务从“想法”收敛成**可执行的核心流程**时，进入本模块。

它处理的不是代码实现，而是把以下几层压成同一个定义产物：
- 任务本质
- 外部约束
- 工程鲁棒性
- 用户可用性

在本地 skill 体系里，它还承担书中“结构层”的一部分职责：
- 交互模式与顺序
- 概念模型
- 错误预防与恢复
- 让用户能理解整体流程如何组成一个可预测的系统

目标是输出一份可直接指导后续架构、功能、数据、UI 与实施计划的《核心流程设计文档》。

---

## 适用场景

- “帮我先把这个任务流程设计清楚”
- “把这个功能从用户路径到异常处理梳理出来”
- “我想先定义端到端流程，再谈架构和实现”
- “需要把业务流程、状态机、异常补偿、用户提示统一起来”

---

## 核心输出

保存为一个统一文档时，建议包含：

1. **任务声明与范围**
2. **用户视角端到端流程图**
3. **关键工程状态机**
4. **中间态数据与异常处理表**
5. **用户交互与参数映射**
6. **风险与妥协记录**

---

## 工作方式

### 1. 先抽出任务本质
先把用户请求压成：

```text
[角色] 在 [场景] 下，需要完成 [具体功能性任务]
```

必要时再补 JTBD：

```text
当 [情境]，我想要 [任务/动机]，以便 [结果]
```

### 2. 再注入外部约束
逐一确认：
- 外部系统接口
- 合规/权限/审批
- 组织协作边界
- 已有系统限制

要求：不要直接无视约束画理想流程，而要把约束变成流程中的真实分支和风险。

### 3. 再补工程鲁棒性
至少补这些：
- 状态转换
- 超时与重试
- 幂等
- 并发冲突
- 部分成功 / 部分失败
- 补偿逻辑
- 中间态持久化

### 4. 先统一概念模型与流程顺序
在画详细界面前，先确认：
- 当前对象在整个流程里被当成什么
- 用户动作与系统响应是否形成可预测顺序
- 同一类动作/状态/对象是否被一致表达

如果同一对象一会儿被当成“容器”，一会儿又被当成“地点”或“记录”，后续 UI 很容易出现歧义。

### 5. 错误设计不止是报错文案
优先顺序应是：
- 先预防错误发生
- 再让错误更难发生
- 再在发生后帮助识别与纠正
- 最后提供恢复路径（如重试、撤销、补偿）

### 6. 最后投影为用户可理解的交互流
用户必须在任一步都知道：
- 现在在哪
- 系统正在做什么
- 下一步能做什么
- 失败后怎么恢复
- 为什么当前步骤会自然地衔接到上一步

---

## 推荐文档骨架

```markdown
## 1. Task Statement and Scope
- JTBD:
- In scope:
- Out of scope:
- Preconditions:
- Downstream dependencies:

## 2. End-to-End Flow (User View)
- Mermaid flowchart

## 3. Core State Machine
- Mermaid stateDiagram

## 4. Exceptions and Intermediate Data
| Exception | Trigger | System Handling | Compensation | User-visible Recovery |
|---|---|---|---|---|

Intermediate data:
| Data | Why it exists | Created at | Cleared at |
|---|---|---|---|

## 5. Interaction and Parameter Mapping
| Parameter | Source | Default / Inference | Control / Surface |
|---|---|---|---|

## 6. Risks and Trade-offs
- 
```

---

## 质量标准

好的核心流程设计应满足：

- 用户主路径完整
- 关键分支完整
- 异常与补偿完整
- 参数来源完整
- 中间态清晰
- 用户可恢复路径明确
- 概念模型一致
- 关键步骤的顺序对用户而言合理，而不只是步骤更少

---

## 灵魂拷问

- 是否所有任务必经路径都被覆盖？
- 是否存在会破坏闭环的外部约束？
- 关键步骤是否都有超时、重试或补偿？
- 用户在任一步是否都知道当前状态和下一步动作？
- 是否有步骤只是为了系统内部方便，却不符合用户预期？
- 概念模型是否前后一致？
- 有没有把工程复杂度偷偷藏到“后面再说”？

---

## 何时继续到其他文档

- 需要系统模块与容器划分 → `architecture-and-data.md`
- 需要拆成功能树与优先级 → `feature-map-and-prioritization.md`
- 需要进入实施交接 → `handoff-and-implementation-plan.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [spec-and-scope.md](spec-and-scope.md) | 先定义目标、范围与验收 |
| [architecture-and-data.md](architecture-and-data.md) | 流程进入系统与数据设计 |
| [feature-map-and-prioritization.md](feature-map-and-prioritization.md) | 流程拆成功能结构 |
| [handoff-and-implementation-plan.md](handoff-and-implementation-plan.md) | 进入实施交接与验收计划 |
