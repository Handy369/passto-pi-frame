# Discovery

> **last_verified: 2026-05-14**
> migrated from: `agent-product-manager/references/discovery.md`

## 作用

当问题还很模糊、机会尚未成型、方向还在讨论中时，进入 discovery。

目标不是立刻产出 PRD，而是回答：

- 这到底是不是一个值得解决的问题？
- 是谁在痛？什么时候痛？痛到什么程度？
- 现在他们如何解决？
- 真正的机会在哪里？
- 最危险的假设是什么？
- 最便宜的验证路径是什么？

这部分吸收了原有：
- `brainstorm.md`
- `product-brainstorming.md`

并将其统一为一个更强的 PM 思考入口。

---

## 适用场景

当用户说这些话时，优先进入 discovery：

- “我想梳理一个产品机会”
- “我们可能该做 X，但我不确定值不值得”
- “帮我 brainstorm 一下这个方向”
- “这个问题到底根因是什么？”
- “从产品和工程的角度一起拆这个想法”
- “先别写方案，先把问题想清楚”

---

## 核心输出

discovery 阶段的标准输出不是完整文档，而是以下 5 类之一：

1. **问题陈述**
2. **机会地图**
3. **候选解法列表**
4. **关键假设与验证计划**
5. **推荐下一步**

---

## 工作方式

### 1. 先 framing，不先 solutioning

优先澄清：
- 谁是用户？
- 他们要完成什么任务？
- 卡点出现在哪个情境？
- 不解决会怎样？
- 为什么是现在？

如果用户一上来就说“我们要做一个功能”，先回问：

- 这个功能替谁解决什么问题？
- 不做会失去什么？
- 当前替代方案是什么？
- 为什么不是更小的办法？

### 2. 先发散，再收敛

发散阶段至少探索：
- 直接解法
- 更小版本
- 更激进版本
- 完全相反的方案
- 删除某一步而不是新增功能
- 流程、策略、默认值、约束、自动化 等非 feature 解法

收敛阶段则问：
- 哪条路径最可能有效？
- 最大不确定性是什么？
- 下一步是研究、实验、原型还是直接 spec？

### 3. 用户提出的功能，不等于真正需求
用户或利益相关者说“我们需要一个 X 功能”时，不要直接照单全收。
先继续追问：
- 这个建议试图缓解什么困难？
- 这个困难发生在什么任务或流程里？
- 为什么现有办法不够？
- 这个建议是在解决根因，还是只是在缓解表象？

很多时候，人们说出来的是“他们能想到的解决办法”，而不是“真正需要被满足的需求”。

### 4. discovery 不只听高层，也要听一线信号
除了决策者与目标用户，还应主动寻找：
- support / customer success
- 销售 / 实施 / 运营
- 每天处理真实问题的一线员工

这些人常常更早知道：
- 哪些问题反复出现
- 哪些方案在现实中根本行不通
- 哪些阻碍是真正阻碍 adoption 的

### 5. 用 personas 和 scenarios 保持“用户在场”
当用户群复杂时，可以使用：
- **personas**：代表一类真实需求的样例人物
- **scenarios**：该人物在某个情境中如何完成任务的短故事

注意：personas 不是凭空编故事，而是从研究与细分中提炼出来的；允许有少量帮助记忆的虚构细节，但不能脱离证据。

---

## 推荐框架

### JTBD

模板：

```text
当 [情境]，我想要 [动机/任务]，以便 [期望结果]
```

用途：
- 避免 feature-first
- 看清真实替代品
- 区分功能任务、情绪任务、社会任务

### Opportunity Solution Tree

结构：

```text
Outcome
→ Opportunities
→ Solutions
→ Experiments
```

用途：
- 强制把 solution 放在 opportunity 之后
- 强制每个 solution 都接实验

### First Principles

适用于：
- 团队被惯性思维卡住
- 大家都说“行业里都这么做”
- 需要从根上拆解问题

### Reverse Brainstorming

先问：
- 如果我要把这个体验做得更糟，我会怎么做？

再反转成解决方案。

这个方法对发现隐性反模式非常有效。

### Personas and Scenarios

适用于：
- 用户群不止一类
- 团队开始默认“用户都跟我一样”
- 需要把抽象研究转成可持续讨论对象

用法：
- 先基于研究提炼 1-3 个代表性 personas
- 再为每个 persona 写关键场景
- 在讨论方案时持续追问：
  - 这对哪个 persona 有用？
  - 会不会只对一种人有效，却伤害另一种人？
  - 这个流程对该 persona 来说是否自然？

---

## discovery 对话模板

### 模式 A：问题探索

1. 这个问题具体发生在谁身上？
2. 发生在什么情境？频率如何？
3. 他们现在如何 workaround？
4. 不解决会造成什么损失？
5. 根因更像：认知问题、动机问题、能力问题，还是流程问题？
6. 哪个用户段最痛？
7. 用户口中提出的“功能建议”，背后真正想解决的困难是什么？
8. 哪些一线团队已经在重复看到这个问题？

### 模式 B：方案发散

1. 先给 5-7 种不同思路
2. 至少包含一个“删东西”的方案
3. 至少包含一个“更小更快验证”的方案
4. 至少包含一个“反直觉”的方案
5. 最后只选 2-3 个值得继续的方向

### 模式 C：假设验证

列出：
- 用户假设
- 问题假设
- 方案假设
- 商业假设
- 可行性假设
- 采用假设

然后问：
- 哪一个假设一旦错了，整个方向就不成立？
- 最低成本如何验证？

---

## 产出模板

### 输出 1：问题陈述

```markdown
## Problem Statement
- 用户：
- 场景：
- 核心痛点：
- 当前替代方案：
- 不解决的代价：
- 为什么是现在：
```

### 输出 2：机会地图

```markdown
## Opportunities
| Opportunity | Evidence | User Impact | Notes |
|---|---|---|---|
```

### 输出 3：候选解法

```markdown
## Candidate Solutions
| Option | Type | Expected Upside | Main Risk | Cheapest Test |
|---|---|---|---|---|
```

### 输出 4：关键假设

```markdown
## Riskiest Assumptions
| Assumption | Why It Matters | Confidence | How to Test |
|---|---|---|---|
```

### 输出 5：推荐下一步

```markdown
## Recommendation
- Recommended direction:
- Why this one:
- What not to do now:
- Next step in 1 week:
```

---

## 质量标准

好的 discovery 结果应该：

- 没有过早进入实现细节
- 能清楚指出用户、任务、情境、痛点
- 能明确区分 problem 与 solution
- 能识别“用户提议的功能”与“真正需求”之间的差异
- 能吸收来自一线团队的现实信号，而不只听最响亮的声音
- 能指出最危险假设
- 能提出一个低成本 next step

---

## 反模式

### 1. Feature parity thinking
“竞品有，所以我们也要有。”

修正：
- 竞品功能服务了什么任务？
- 用户真的把它当决策因素吗？
- 有没有更符合我们产品哲学的做法？

### 2. One-idea brainstorm
名义上 brainstorm，实际上只想为既定方案找理由。

修正：
- 强制再出 3 个替代方向
- 至少提出一个相反方案

### 3. Endless exploration
一直发散，不愿收敛。

修正：
- 明确本轮输出物
- 明确本轮停止条件
- 只保留 2-3 个值得继续的方向

### 4. 把利益相关者的 feature request 直接当需求
“老板说要这个”“客户说想要这个”，就直接进入方案。

修正：
- 继续追问任务、阻碍、根因
- 区分 request / need / constraint
- 用 personas 与场景验证这个建议是否真的成立

### 5. 只访谈用户，不吸收一线员工经验
结果：方案看起来很对，但执行时发现大量现实阻碍。

修正：
- 纳入 support / sales / ops / implementation 输入
- 单独标记哪些是现场执行信号，哪些是二手判断

---

## 与其他文档的关系

- 当 discovery 已经明确了方向与边界 → 转到 `spec-and-scope.md`
- 当 discovery 需要更多用户证据或市场证据 → 转到 `research.md`
- 当 discovery 已经变成取舍问题 → 转到 `roadmap-and-prioritization.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [../SKILL.md](../SKILL.md) | 主路由器 |
| [research.md](research.md) | 需要补用户/市场证据时 |
| [spec-and-scope.md](spec-and-scope.md) | 方向明确后进入定义 |
| [roadmap-and-prioritization.md](roadmap-and-prioritization.md) | 当核心问题变成取舍与排序 |
