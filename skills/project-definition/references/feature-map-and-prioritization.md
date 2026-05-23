# Feature Map and Prioritization

> **last_verified: 2026-05-14**
> migrated from: `product-design/skill.md` Step 3

## 作用

当核心流程和系统承载方式已有基本定义，需要把方案拆成**功能结构、依赖关系与优先级**时，进入本模块。

它负责回答：
- 这个方案到底包含哪些功能与内容特性？
- 哪些是用户可见功能，哪些是支撑能力？
- 哪些必须先做，哪些可以延后？
- 哪些功能没有架构承载或流程依据？

---

## 适用场景

- “把这个方案拆成模块/功能/子功能”
- “帮我做功能地图和依赖矩阵”
- “哪些是 MVP，哪些是以后再做？”
- “这个功能集合能不能按 RICE / MoSCoW 排优先级？”

---

## 核心输出

1. **功能结构树**
2. **功能-架构映射矩阵**
3. **功能依赖说明**
4. **优先级分层（如 RICE / MoSCoW）**
5. **缺口与回溯建议**

---

## 工作方式

### 1. 从流程节点长出功能，不从想象列功能
每个叶子功能都应能追溯到：
- 一个用户动作
- 一个系统反馈
- 一个异常/补偿处理
- 一个后台能力

### 2. 先分功能层，再排序
建议至少分：
- 用户主路径功能
- 管理/运维/审计功能
- 鲁棒性/异常处理功能
- 集成/数据/通知类支撑功能
- 内容与运营支持特性

### 3. 优先级必须同时看三件事
每个候选 feature / content item 都至少要看：
- **战略匹配度**：是否直接服务当前目标
- **用户价值**：是否显著降低阻碍、提高完成率或清晰度
- **可行性**：时间、资源、技术、维护成本是否允许

### 4. 优先级必须带 trade-off
新增任何 Must-have 都应同时回答：
- 哪个东西因此延后？
- 哪个边界因此收缩？
- 是否只是把“想法”误当成“本期必须项”？

### 5. 好点子不等于当前范围
对于明显有价值、但不适合当前版本的条目，应明确归入：
- later
- dependency first
- content not ready
- needs validation

而不是模糊地留在 MVP 里。

---

## 推荐文档骨架

```markdown
## 1. Feature / Content Tree
- Module
  - Feature or content capability
    - Sub-feature

## 2. Feature to Architecture Mapping
| Feature | Supporting Module | Dependencies |
|---|---|---|

## 3. Prioritization
| Item | Strategic Fit | User Value | Feasibility | Effort | Risk | Priority | Rationale |
|---|---|---|---|---|---|---|---|

## 4. MVP Scope
- Must have:
- Should have:
- Could have:
- Won't now:

## 5. Content Readiness
| Content item | Owner | Update frequency | Notes |
|---|---|---|---|
```

---

## 自检问题

- 每个必要功能是否都有架构模块承载？
- 是否有高优先级功能其实不服务核心流程？
- 是否把支撑能力误当成用户价值功能？
- MVP 是否仍能形成完整闭环？

---

## 回溯信号

- 必要功能无架构承载 → 回到 `architecture-and-data.md`
- 用户调整优先级导致主流程变化 → 回到 `core-flow-design.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [core-flow-design.md](core-flow-design.md) | 功能必须源自流程 |
| [architecture-and-data.md](architecture-and-data.md) | 功能必须有系统承载 |
| [roadmap-and-prioritization.md](roadmap-and-prioritization.md) | 更高层的路线图与取舍 |
| [handoff-and-implementation-plan.md](handoff-and-implementation-plan.md) | 进入实施任务拆解 |
