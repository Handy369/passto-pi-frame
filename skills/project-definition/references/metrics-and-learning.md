# Metrics and Learning

> **last_verified: 2026-05-14**
> migrated from: `agent-product-manager/references/metrics-and-learning.md`

## 作用

当功能已上线、实验已运行、季度已推进，需要回答“结果如何、意味着什么、下一步做什么”时，进入 Metrics and Learning。

本模块吸收原有 `metrics-review.md`，并向前推进一步：

> PM 不是看指标的人，而是把指标转成决策的人。

---

## 适用场景

- 周 / 月 / 季度指标复盘
- 某个指标异常波动，需要初步判断
- 上线后效果 review
- 需要从 OKR / North Star / activation / retention 角度评价工作是否有效
- 需要决定加码、修正、停止还是继续实验

---

## 核心输出

1. Summary
2. Metric Scorecard
3. Trend Analysis
4. Bright Spots
5. Areas of Concern
6. Recommended Actions
7. Open Questions / Needed Follow-up

---

## 分析顺序

### 1. 先确认 metric hierarchy

优先按层级看：
- North Star
- L1 健康指标（acquisition / activation / engagement / retention / revenue / satisfaction）
- L2 诊断指标

### 2. 先看对比，不看绝对值

任何数字都至少要带一个对比：
- vs 上周期
- vs 目标
- vs 基线
- vs 分群

### 3. 先看变化，再讨论原因

需要区分：
- 真趋势
- 噪音
- 事件性波动
- 数据质量问题

### 4. 必须落到 action

每次 metrics review 最后都要至少回答：
- 继续加码什么
- 停止什么
- 需要深挖什么
- 需要启动什么实验

---

## 推荐模板

```markdown
## Summary
- Overall health:
- Biggest movement:
- Why it matters:

## Scorecard
| Metric | Current | Previous | Change | Target | Status |
|---|---|---|---|---|---|

## Key Insights
- 

## Bright Spots
- 

## Concerns
- 

## Recommended Actions
| Action | Owner | Why | Urgency |
|---|---|---|---|

## Caveats
- 
```

---

## 常用指标视角

### North Star
问：
- 这个指标是否真的代表用户获得价值？
- 团队能否通过产品工作影响它？

### Activation
问：
- 新用户是否更快到达价值时刻？
- 哪一步阻塞最严重？

### Engagement
问：
- 用户是否反复回到核心行为？
- 是浅层活跃还是高质量活跃？

### Retention
问：
- 新 cohort 是否变好？
- 留存曲线是持续下滑还是趋于稳定？

### Monetization
问：
- 价值是否转化成收入、扩张或付费意愿？

### Satisfaction
问：
- 用户是否感知到改善？
- support burden 是否下降？

---

## PM 判断框架

### 当指标变好了
不要立刻庆祝，先问：
- 是不是由核心用户段驱动？
- 是不是短期事件性提升？
- 是否以牺牲其他指标为代价？

### 当指标变差了
不要立刻归因，先问：
- 定义有没有变化？
- 是否有外部事件？
- 是否是某个 segment 在拖累整体？
- 哪个 L2 指标能帮我们解释？

### 当指标没变化
问：
- 是方案本身无效？
- 还是 adoption 不足？
- 还是观察窗口太短？
- 还是目标指标选错了？

---

## 推荐行动分类

### Build more
当证据显示方向有效，值得加码。

### Fix / iterate
方向没错，但体验或 adoption 有阻碍。

### Investigate
信号异常，但尚不能归因。

### Stop / deprioritize
投入与结果不成正比，或假设被证伪。

### Monitor
现在不行动，但设定观察点。

---

## 反模式

### 1. 只写数字，不写故事

修正：
- 每个关键指标变化都说明 why it matters

### 2. 只写原因，不写置信度

修正：
- 区分 observation 与 hypothesis

### 3. 只做复盘，不产生后续动作

修正：
- 每次 review 必须输出 owner + next step

### 4. 盯着 vanity metrics

修正：
- 回到 North Star 与 L1 指标

---

## 与其他文档的关系

- 若结果提示方向有误 → 回到 `discovery.md`
- 若结果暴露新的用户问题 → `research.md`
- 若结果支持继续推进某方向 → `spec-and-scope.md` 或 `roadmap-and-prioritization.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [../SKILL.md](../SKILL.md) | 主路由器 |
| [discovery.md](discovery.md) | 当结果推翻原问题定义 |
| [research.md](research.md) | 需要补用户/市场解释 |
| [roadmap-and-prioritization.md](roadmap-and-prioritization.md) | 结果影响下一轮取舍 |
| [spec-and-scope.md](spec-and-scope.md) | 结果支持新一轮定义 |
