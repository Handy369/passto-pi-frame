# Prioritization and Roadmap

> **last_verified: 2026-05-14**
> migrated from: `agent-product-manager/references/prioritization-and-roadmap.md`

## 作用

这个模块负责回答两个最典型的 PM 问题：

- 我们应该先做什么？
- 为了做这个，我们决定不做什么？

它吸收原有 `roadmap-update.md`，并把路线图放回它真正的本质：

> roadmap 不是项目排期表，而是优先级和取舍的表达方式。

---

## 适用场景

- “帮我排一下路线图 / roadmap”
- “这个需求应该插队吗？”
- “新加这个，那什么要让位？”
- “季度目标下该怎么排 now/next/later？”
- “优先级争议很大，帮我结构化判断”

---

## 核心输出

1. 优先级排序
2. 取舍理由
3. Now / Next / Later 路线图
4. 风险与依赖说明
5. 容量约束下的建议方案

---

## 决策原则

### 1. Roadmap 是零和问题

新增任何事项，都应该触发：

> “那什么被推迟、取消或降级？”

### 2. 先 outcome，再 feature

优先考虑：
- 对核心目标的贡献
- 对关键用户段的价值
- 对风险/留存/收入的影响
- 是否解决了真实且高频的问题

而不是：
- 谁声音大
- 谁职位高
- 这个功能看起来很酷

### 3. Capacity 是硬约束

规划不是愿望清单。

如果容量不足：
- cut scope
- phase delivery
- move timeline
- 明确拒绝

---

## 常用框架

### RICE

```text
RICE = (Reach × Impact × Confidence) / Effort
```

适合：
- 在多个候选项之间做相对排序
- 需要更可辩护的决策过程

### MoSCoW

- Must
- Should
- Could
- Won't

适合：
- release scoping
- 与 stakeholder 对齐边界

### ICE

Impact × Confidence × Ease

适合：
- 早期粗排
- 数据不全但需要快速决定

### Value vs Effort

适合：
- 团队一起可视化 trade-off
- 找 quick wins 与 money pits

### Now / Next / Later

适合：
- 避免假精确日期
- 对外沟通与内部主题对齐

---

## 推荐模板

```markdown
## Decision Context
- Goal / objective:
- Constraints:
- Capacity:
- New information:

## Prioritization Table
| Item | User Value | Business Value | Confidence | Effort | Priority | Notes |
|---|---|---|---|---|---|---|

## Trade-offs
- If we do X, Y moves out
- Why Y moved:

## Roadmap View
### Now
- 
### Next
- 
### Later
- 

## Risks / Dependencies
| Item | Risk / Dependency | Owner | Need-by |
|---|---|---|---|
```

---

## 何时调整 roadmap

合理触发：
- 新证据改变价值判断
- 关键依赖延期
- 团队容量变化
- 战略方向变化
- 重大市场/竞品变化
- 上线结果推翻原有假设

不合理触发：
- 临时情绪
- 个别意见
- 没有说明 trade-off 的插单

---

## 输出要求

一个好的 prioritization / roadmap 产出，必须让人看懂：

- 为什么这个先做
- 为什么那个后做
- 代价是什么
- 哪些是承诺，哪些只是方向
- 哪些风险值得提前暴露

---

## 反模式

### 1. 把 roadmap 写成任务清单

修正：
- 用主题、目标、关键结果表达
- 任务级细节留给 execution 文档

### 2. 什么都想保留

修正：
- 强制写出 Won’t / deferred list

### 3. 把日期写得过于精确

修正：
- 优先用 now/next/later 或 quarter theme

### 4. 忽略依赖

修正：
- 每个高优先项都检查技术、团队、外部依赖

---

## 与其他文档的关系

- 若仍不确定问题值不值得做 → `discovery.md`
- 若缺研究证据支撑优先级 → `research.md`
- 若优先项已定，需要变成明确交付 → `spec-and-scope.md`
- 若路线确定，要推进到冲刺层 → `delivery-and-alignment.md`
- 若某项做完后需要复盘影响 → `metrics-and-learning.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [../SKILL.md](../SKILL.md) | 主路由器 |
| [research.md](research.md) | 为排序补证据 |
| [spec-and-scope.md](spec-and-scope.md) | 高优先项进入 spec |
| [delivery-and-alignment.md](delivery-and-alignment.md) | 路线图进入执行 |
| [metrics-and-learning.md](metrics-and-learning.md) | 用结果校正未来优先级 |
