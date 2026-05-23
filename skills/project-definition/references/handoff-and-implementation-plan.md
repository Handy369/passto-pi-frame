# Handoff and Implementation Plan

> **last_verified: 2026-05-14**
> migrated from: `product-design/skill.md` Step 5 + Step 6 + Step 7

## 作用

当流程、架构、功能、数据已经足够清晰，需要把它们**整合、自检、交接给实施阶段**时，进入本模块。

它处理三类输出：
- 设计总览与一致性检查
- UI/边界/鲁棒性补充
- 开发任务分解与验收计划

目标不是继续扩张方案，而是让实施方少猜、少回问、少返工。

---

## 适用场景

- “帮我把前面方案整合成可以交付工程的版本”
- “补一份 implementation plan / sprintable handoff”
- “给我关键页面、边界场景、验收用例和里程碑”
- “在进实施前做一次一致性检查”

---

## 核心输出

1. **系统设计概述**
2. **全局一致性检查报告**
3. **关键页面/交互与边界场景矩阵**
4. **鲁棒性与降级策略**
5. **开发任务分解（Epics / Stories）**
6. **验收测试清单（Given / When / Then）**
7. **里程碑计划（MVP / 增强 / 优化）**

---

## 工作方式

### 1. 先做一致性检查，再写计划
至少核对：
- 功能 ↔ 流程
- 架构 ↔ 流程
- 状态机 ↔ 数据模型
- 交互 ↔ 数据可见性
- 异常场景 ↔ 验收用例

### 2. 再补 UI / 边界 / 恢复路径
重点不是视觉精修，而是：
- 空态
- 错误态
- 极值
- 并发冲突
- 网络中断
- 破坏性操作确认与撤销

### 3. 最后把方案翻译成实施语言
输出应能直接支持：
- epic / story 拆解
- 依赖排序
- 验收口径
- 里程碑分阶段交付

---

## 推荐文档骨架

```markdown
## 1. Integrated Design Summary
- End-to-end overview
- Core rules
- Key decisions

## 2. Consistency Check
| Area | Finding | Impact | Recommended Fix |
|---|---|---|---|

## 3. Key Screens / Interaction Notes
| Screen / Surface | Purpose | Key States | Notes |
|---|---|---|---|

## 4. Edge Cases
| Scenario | Trigger | UI Behavior | User Recovery | Related Exception |
|---|---|---|---|---|

## 5. Implementation Backlog
| Epic / Story | Description | Dependency | Priority | Acceptance Hook |
|---|---|---|---|---|

## 6. Acceptance Checklist
- Given / When / Then ...

## 7. Milestones
- MVP
- Enhancement
- Optimization
```

---

## 自检问题

- 是否仍存在“看似清楚但无法实现”的断层？
- 验收用例是否覆盖正常、异常、边界、性能？
- 用户在边界场景下是否知道如何恢复？
- 是否有任务被拆出但没有技术支撑或业务价值？

---

## 回溯信号

- 数据缺失或状态定义不全 → 回到 `architecture-and-data.md`
- 需要额外架构支持 → 回到 `architecture-and-data.md`
- 主路径被边界设计推翻 → 回到 `core-flow-design.md`

---

## 与实施阶段的边界

本模块的终点是：
- handoff package
- implementation plan
- acceptance basis

不是：
- 直接开始写代码
- 直接修 bug
- 直接跑测试

一旦需要进入真实代码落地，应切换到：
- `project-implementation`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [core-flow-design.md](core-flow-design.md) | 主流程与异常闭环 |
| [architecture-and-data.md](architecture-and-data.md) | 模块与数据支撑 |
| [feature-map-and-prioritization.md](feature-map-and-prioritization.md) | 功能拆解与范围 |
| [delivery-and-alignment.md](delivery-and-alignment.md) | sprint 与对齐产出 |
