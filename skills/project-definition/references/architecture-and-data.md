# Architecture and Data

> **last_verified: 2026-05-14**
> migrated from: `product-design/skill.md` Step 2 + Step 4

## 作用

当核心流程已经明确，需要把它映射成**系统结构与数据结构**时，进入本模块。

它把两件强关联的事情放在一起：
- 系统架构承载什么流程
- 数据模型如何支撑状态与一致性

目标不是写技术炫技文档，而是回答：
- 每一步流程由谁承载？
- 哪些数据必须被持久化？
- 状态如何转换并保持一致？
- 哪些外部约束会反向影响架构？

---

## 适用场景

- “基于这个流程给我一个系统架构方案”
- “帮我设计模块职责和数据模型”
- “这个流程需要什么服务、表、状态字段与索引？”
- “外部系统限制会如何影响架构与数据一致性？”

---

## 核心输出

1. **系统架构图（Container / Module 级）**
2. **模块职责表**
3. **技术选型建议与理由**
4. **逻辑数据模型**
5. **状态持久化映射**
6. **数据流转说明**
7. **架构一致性自检**

---

## 输入前提

开始前应已有：
- 核心流程
- 关键状态机
- 主要异常处理方式
- 基本外部约束

如果这些还不清楚，先回到：
- `core-flow-design.md`

---

## 工作方式

### 1. 先从流程反推模块
每个用户动作、系统反馈、异步状态变化，都必须能映射到：
- 一个前端/客户端承载点
- 一个后端服务/模块责任点
- 一个数据持久化位置
- 一个外部依赖边界

### 2. 先定职责，再谈技术
先回答：
- 哪些模块必须存在？
- 边界怎么划？
- 谁拥有状态？
- 谁负责校验、幂等、补偿？

再决定：
- 单体 / 模块化单体 / 服务化
- SQL / NoSQL / cache / queue
- 同步 / 异步 / 事件驱动

### 3. 数据模型必须服务状态机
每个关键状态都要能回答：
- 存在哪个实体上？
- 由哪个字段表达？
- 由什么动作触发转换？
- 转换失败如何恢复？

### 4. 先保证一致性，再谈扩展性
优先明确：
- source of truth
- 幂等键
- 乐观锁/版本号
- 事务边界
- eventual consistency 的可接受范围

---

## 推荐文档骨架

```markdown
## 1. System Architecture
- Mermaid container / module diagram

## 2. Module Responsibilities
| Module | Responsibility | Related Flow Step | Interface Summary |
|---|---|---|---|

## 3. Tech Choices
| Decision | Recommendation | Why | Trade-off |
|---|---|---|---|

## 4. Logical Data Model
| Entity | Key Fields | Constraints | Relations | Notes |
|---|---|---|---|---|

## 5. State Persistence Mapping
| Entity | State Enum | Storage Field | Transition Trigger |
|---|---|---|---|

## 6. Data Flow
- request path
- async path
- compensation path

## 7. Consistency Checks
- 
```

---

## 自检问题

- Step1 的所有关键流程是否都有模块承载？
- 是否出现循环依赖或单点故障？
- 状态机是否能被数据字段完整表达？
- 是否存在无法可靠补偿的状态跃迁？
- 外部接口限制是否会破坏原流程闭环？

---

## 回溯信号

出现以下情况时，应回溯 `core-flow-design.md`：
- 必须引入的组件与原流程假设冲突
- 一致性要求与原异常处理逻辑矛盾
- 外部系统约束让原流程不可落地
- 架构复杂度明显破坏用户体验或交付节奏

---

## 何时继续到其他文档

- 需要拆成功能树与范围优先级 → `feature-map-and-prioritization.md`
- 需要做实施交接、任务拆解、验收计划 → `handoff-and-implementation-plan.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [core-flow-design.md](core-flow-design.md) | 上游核心流程定义 |
| [feature-map-and-prioritization.md](feature-map-and-prioritization.md) | 功能层拆解与排序 |
| [handoff-and-implementation-plan.md](handoff-and-implementation-plan.md) | 实施交接与验收 |
