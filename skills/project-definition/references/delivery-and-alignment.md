# Delivery and Alignment

> **last_verified: 2026-05-14**
> migrated from: `agent-product-manager/references/delivery-and-alignment.md`

## 作用

当问题已经不是“做不做”，而是“怎么让它顺利推进并让所有人理解一致”时，进入 Delivery and Alignment。

本模块整合：
- `sprint-planning.md`
- `stakeholder-update.md`

原因很简单：

> 执行与同步，本质上是同一个系统的两个面：内部承诺与外部对齐。

---

## 适用场景

- sprint planning
- 决定本迭代做什么、不做什么
- 对齐 owner / dependency / blocker
- 给领导、工程、跨团队伙伴写 update
- 需要风险升级、请求决策、同步状态

---

## 核心输出

1. Sprint Goal
2. Capacity 评估
3. Sprint Backlog
4. 风险 / blocker / dependency 列表
5. Stakeholder update（按受众改写）
6. 需要升级的决策与 ask

---

## 内部执行：Sprint Planning

### 关键问题
- 这个 sprint 最重要的目标是什么？
- 哪些是 P0，哪些是 stretch？
- 团队实际可用容量是多少？
- 哪些依赖最容易拖慢进度？
- 如果中途出问题，先砍谁？

### 推荐模板

```markdown
## Sprint Plan
**Goal:**
**Dates:**

### Capacity
| Person | Available Days | Notes |
|---|---|---|

### Backlog
| Priority | Item | Owner | Estimate | Dependency |
|---|---|---|---|---|

### Risks
| Risk | Impact | Mitigation |
|---|---|---|

### Cut Line
- If needed, cut in this order:
```

### 原则
- 只给一个 sprint goal
- 只承诺 70-80% 容量
- stretch 项明确标注
- carryover 要问清为什么没完成

---

## 外部对齐：Stakeholder Update

不同 audience 需要不同版本：

### Leadership / Exec
关注：
- 结果
- 风险
- ask
- 关键里程碑

### Engineering
关注：
- 正在做什么
- blocker 在哪里
- 哪些决策影响工程推进

### Cross-functional
关注：
- 什么时间影响到他们
- 需要他们何时给 input
- 他们要准备什么

### Customer-facing
关注：
- 用户收益
- timing
- known limitations

---

## Update 通用模板

```markdown
Status: Green / Yellow / Red

TL;DR:

Progress:
- 

Risks:
- 

Decisions needed:
- 

Next milestones:
- 
```

---

## 风险沟通原则

### 早点黄，不要装绿

Yellow 不是失败，而是有效风险管理。

### 风险要包含 4 件事
- 风险是什么
- 影响是什么
- 为什么会发生
- 我们需要什么帮助

### Ask 要具体
坏 ask：
- 需要大家支持

好 ask：
- 需要在周五前决定方案 A / B
- 需要平台团队在 4 月 20 日前提供接口

---

## ADR / Decision 记录建议

当出现重要 trade-off 时，建议最少记录：

```markdown
## Decision
- Context:
- Options considered:
- Recommendation:
- Consequences:
- Owner:
```

这能减少反复解释，也有利于后续回溯。

---

## 反模式

### 1. 用 update 汇报忙碌，不汇报结果

修正：
- 所有 update 先写 outcome / risk / ask

### 2. sprint 塞满 100% 容量

修正：
- 留 20-30% buffer

### 3. blocker 讲得很晚

修正：
- 在 Yellow 阶段就说，不等 Red

### 4. 同一段话发给所有受众

修正：
- 对 exec、engineering、partner 分别重写

---

## 与其他文档的关系

- 若执行前范围还不清楚 → `spec-and-scope.md`
- 若执行中需要重新取舍 → `roadmap-and-prioritization.md`
- 若执行后要看是否有效 → `metrics-and-learning.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [../SKILL.md](../SKILL.md) | 主路由器 |
| [spec-and-scope.md](spec-and-scope.md) | 执行前确认边界 |
| [roadmap-and-prioritization.md](roadmap-and-prioritization.md) | 执行前后的取舍调整 |
| [metrics-and-learning.md](metrics-and-learning.md) | 执行结果复盘 |
