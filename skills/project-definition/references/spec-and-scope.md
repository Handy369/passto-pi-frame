# Spec and Scope

> **last_verified: 2026-05-14**
> migrated from: `agent-product-manager/references/spec-and-scope.md`

## 作用

当问题方向已经足够清晰，需要把它收敛为一个可执行定义时，进入 Spec and Scope。

本模块主要吸收原有 `write-spec.md`，并进一步强调：

> spec 的本质不是“写长文档”，而是把边界说清楚，把取舍说清楚，把成功定义说清楚。

同时补充一条范围层原则：
> **scope 是战略在当前版本的可执行投影。它不仅要定义“做什么”，也要定义“不做什么”；不仅包括功能，也包括内容。**

---

## 适用场景

- “帮我把这个想法写成 spec / PRD”
- “把这个问题定义成一个 v1”
- “帮我明确 goals / non-goals”
- “怎么防止这个需求越写越大？”
- “我要给设计和工程一个清晰版本”

---

## 核心输出

1. Problem Statement
2. Goals
3. Non-goals
4. User Stories
5. Requirements（P0/P1/P2）
6. Acceptance Criteria
7. Success Metrics
8. Open Questions
9. Phasing / Timeline Considerations

---

## spec 生成顺序

### 1. 先定义问题，不先定义功能

最少要说清：
- 谁遇到这个问题
- 在什么场景下遇到
- 当前损失是什么
- 为什么值得现在解决

### 2. 先写目标，再写需求

目标应该是 outcome：
- 降低 time-to-value
- 提高 activation
- 减少 support burden
- 提高 conversion / retention

而不是：
- 增加一个页面
- 提供一个入口
- 新增一个按钮

### 3. 先写 non-goals，再写完整 scope

这是防范围膨胀最有效的步骤之一。

### 4. requirements 必须分层

建议固定写成：
- P0 / Must Have
- P1 / Nice to Have
- P2 / Future Consideration

### 5. 需求不是功能堆，先回到战略
每条重要 requirement 最好都能追溯到：
- 一个目标
- 一个用户需求
- 一个成功标准

如果一条需求无法说明自己服务哪个目标、哪个用户问题，它通常只是一个想法，不一定属于当前 scope。

### 6. scope 要同时覆盖功能与内容
不要只写：
- 页面
- 按钮
- 流程
- API

还应考虑是否需要明确：
- 错误提示
- 空状态
- 帮助文案
- 引导内容
- 审核/发布/维护内容
- 内容 owner 与更新频率

---

## 推荐模板

```markdown
## Problem Statement
- Who is affected:
- What is happening:
- Why it matters now:
- Evidence:

## Goals
- 

## Non-goals
- 

## User Stories
- As a [user], I want [capability], so that [benefit]

## Requirements
### P0
- 
### P1
- 
### P2
- 

## Acceptance Criteria
- [ ] 

## Success Metrics
- Leading:
- Lagging:

## Open Questions
| Question | Owner | Blocking? |
|---|---|---|

## Phasing
- v1:
- v1.1:
- later:
```

---

## 需求写法四原则

### 1. 正向描述
优先写系统应如何帮助用户达成目标，而不是只写“不允许什么”。

### 2. 具体
少写：
- 智能
- 重点
- 高级
- 友好

多写：
- 在什么条件下
- 系统展示什么
- 用户可以做什么
- 如何判断完成

### 3. 避免主观词
像“时尚、专业、流畅、强大”这类词，如果没有对应标准，都会制造歧义。

### 4. 可验证
每条关键 requirement 都应该能回答：
- 如何判断它已满足？
- 如何判断它未满足？

---

## 好 spec 的标准

### Problem Statement
必须足够短，但足够扎实。

### Goals
3-5 条即可，且必须可验证。

### Strategic Context
最好能用极短篇幅说明：
- 本次 scope 服务哪些目标
- 目标之间有何优先级
- 成功标准是什么
- 哪些团队会用这份文档做判断

### Non-goals
要敢写，不要模糊。

### User Stories
写用户价值，不写 UI 控件。

### Acceptance Criteria
必须可测，不要出现“友好、流畅、直观”这种无法验证的词。

### Open Questions
真的不知道的才写进去，并标 owner。

---

## 常见框架

### User Story

```text
As a [specific user], I want [capability], so that [benefit].
```

### Given / When / Then

```text
Given [context]
When [action]
Then [expected result]
```

### MoSCoW / P0-P2

用于把 scope 分出层级，避免“全部都重要”。

---

## Spec 压缩规则

当需求太大时，不要试图写一个覆盖全部的大文档，优先：

1. 把问题切成阶段
2. 只定义 v1
3. 明确什么被延后
4. 设计上为未来保留扩展性，但实现上不提前做

---

## 反模式

### 1. 文档很长，但边界不清晰

修正：
- 加强 non-goals
- 明确 P0/P1/P2

### 2. 把工程任务当作用户需求

修正：
- 用户 story 与工程 task 分层表达

### 3. 成功标准模糊

修正：
- 改成 adoption / activation / completion / error / retention 等具体指标

### 4. open questions 太多

修正：
- 区分 blocking 与 non-blocking
- 优先解决最影响启动的前 3 个问题

---

## 从 spec 到执行

当 spec 已经清晰，下一步通常是：
- 若要决定是否排期 → `roadmap-and-prioritization.md`
- 若已确认进入执行 → `delivery-and-alignment.md`
- 若仍缺证据支撑某个需求点 → `research.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [../SKILL.md](../SKILL.md) | 主路由器 |
| [discovery.md](discovery.md) | spec 前的探索阶段 |
| [research.md](research.md) | 为 spec 补证据 |
| [roadmap-and-prioritization.md](roadmap-and-prioritization.md) | spec 进入优先级排序 |
| [delivery-and-alignment.md](delivery-and-alignment.md) | spec 进入 sprint / 对齐 |
