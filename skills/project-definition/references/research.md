# Research and Market

> **last_verified: 2026-05-14**
> migrated from: `agent-product-manager/references/research-and-market.md`

## 作用

将研究输入、反馈噪音、市场变化、竞品动作，整理为可以支持产品判断的证据系统。

本模块融合了：
- `synthesize-research.md`
- `competitive-brief.md`

因为对 PM 来说，两者本质上都是在回答同一类问题：

> “我们凭什么相信这个判断？”

---

## 适用场景

- 一堆访谈记录、support ticket、survey、销售反馈，需要提炼洞察
- 想知道某个竞品 / 某类方案 / 某个 feature area 值不值得跟
- 需要给 roadmap、spec、优先级提供证据基础
- 需要区分“用户真需求”和“个别大声反馈”

---

## 核心输出

1. **研究综述**：我们研究了什么、得到了什么
2. **关键发现**：频率、影响、证据、信心等级
3. **用户分层**：不同用户段差异
4. **市场与竞品判断**：哪些是趋势，哪些是噪音
5. **产品建议**：要做什么、不做什么、继续验证什么

---

## 输入类型

可接受任何研究输入：

- 用户访谈笔记
- survey 结果
- support tickets
- 销售 / 成交 / 流失反馈
- 可用性测试
- 社区帖子
- analytics 摘要
- 竞品页面、定价页、更新日志、评论站反馈
- 一线员工经验（support / CS / sales / onboarding / implementation / ops）

注意：这些一线信号不应被当成“次级噪音”。很多时候，他们比高层更早接触到真实阻碍与重复性问题。

---

## 处理原则

### 1. 先观察，再解释

先提取：
- 用户说了什么
- 用户做了什么
- 证据来自哪里
- 这个现象出现了多少次

再解释：
- 这意味着什么
- 为什么会发生
- 是否能支持某个产品判断

### 2. 频率 × 影响，而非“声音大小”

优先级矩阵：
- 高频 + 高影响 → 顶级优先项
- 低频 + 高影响 → 关键细分人群问题
- 高频 + 低影响 → 体验优化项
- 低频 + 低影响 → 记录即可

### 3. 行为证据 > 主观意见

优先级通常是：
1. 实际行为 / analytics / 留存 / 转化
2. 真实工作流与 workaround
3. 明确且重复出现的用户表达
4. 单次意见或主观偏好

### 4. 用户说想要的功能，不等于真正需求
研究中常见的输入是：
- “我想要一个按钮”
- “你们应该支持 X”
- “最好像竞品那样做”

这些表达有价值，但它们首先是**候选解法信号**，不是需求结论。
研究整合时要继续抽象：
- 他们遇到的困难是什么？
- 他们为什么会想到这个解法？
- 这个解法在他们的场景里是否真的成立？
- 有没有别的方法更好地满足同一个需求？

### 5. personas 必须来源于研究，而不是凭空想象
personas 可以帮助团队持续记住用户，但它们必须：
- 来自用户细分和真实研究
- 代表一类需求模式，而不是代表某一个具体客户
- 允许少量帮助记忆的虚构细节，但不能偏离证据

### 6. 研究输出应能反复支撑战略判断
好的研究输出不只是“给这次会议看”，还应能沉淀为：
- 战略文档输入
- scope 取舍依据
- 后续评审时反复引用的试金石

因此，研究结论应简洁、可追溯、可复用，而不是堆满原始材料。

---

## 研究整合模板

```markdown
## Research Overview
- Research question:
- Sources:
- Sample size:
- Timeframe:

## Key Findings
| Finding | Evidence | Frequency | Impact | Confidence |
|---|---|---|---|---|

## Segments
| Segment | Characteristics | Needs | Risks |
|---|---|---|---|

## Personas (optional when useful)
| Persona | Represents | Core need | Main blocker | Notes |
|---|---|---|---|---|

## Interpreting Requests vs Needs
| Request signal | Underlying need hypothesis | Evidence | Confidence |
|---|---|---|---|

## Opportunities
| Opportunity | Why it matters | Evidence strength | Suggested action |
|---|---|---|---|

## Open Questions
- 
```

---

## 竞品与市场分析模板

```markdown
## Competitive Snapshot
| Dimension | Us | Competitor A | Competitor B |
|---|---|---|---|

## Positioning
- Target user:
- Category claim:
- Key differentiator:
- Proof points:

## Strengths / Weaknesses
| Competitor | Strengths | Weaknesses | Threat Level |
|---|---|---|---|

## Strategic Implications
- What we should differentiate on:
- What we may need parity on:
- What to monitor:
```

---

## 推荐分析维度

### 用户研究维度
- 用户目标 / JTBD
- 当前工作流
- pain point
- workaround
- 触发条件
- 成功标准
- 阻碍 adoption 的因素
- 用户细分差异
- 一线团队反复观察到的阻碍
- 用户请求的显性解法，与其背后隐含需求的区别

### 竞品维度
- 定位
- 目标市场
- 功能深度
- 包装与定价
- recent momentum
- 评论与口碑
- 组织信号（招聘、发布、合作）

### 市场维度
- 趋势是否已经影响目标用户
- 变化是短期 hype 还是长期迁移
- 我们应 lead / fast-follow / monitor / ignore

---

## 常用判断框架

### Triangulation
同一结论最好由多源支撑：
- 访谈 + 数据
- survey + support
- 客户反馈 + 市场变化

### Positioning Analysis
对每个竞品，尝试提炼：

```text
For [target customer], [product] is a [category] that [benefit].
Unlike [alternative], it [differentiator].
```

### Win/Loss Lens
如果有销售或流失信息，优先问：
- 为什么赢
- 为什么输
- 哪些是产品原因
- 哪些是价格、品牌、时机、关系原因

---

## PM 产出要求

一个好的 research & market 产出，不应只是“材料总结”，而应直接回答：

- 哪些发现足以支撑 roadmap 调整？
- 哪些只是值得监控？
- 哪些信号提示我们不该做某个功能？
- 哪些机会适合进入下一步 spec？
- 哪些 personas / 用户段之间的需求已经明显冲突？
- 哪些“用户要求的功能”其实不该被直接翻译成需求？

也就是必须有 **so what**。

---

## 反模式

### 1. 把研究变成摘要机器
只复述，不提炼。

修正：
- 每个 finding 都要写出 why it matters

### 2. 把竞品分析写成 feature checklist
只比较有无，不比较强弱与用户价值。

修正：
- 比较 capability depth、目标用户、定位、用户评价

### 3. 把个别反馈当作趋势

修正：
- 明确样本量、覆盖面、信心等级

### 4. 只写 insights，不给建议

修正：
- 至少给出：build / test / monitor / ignore 四类建议之一

### 5. personas 做得很生动，但没有研究依据

修正：
- 先做细分，再做 persona
- 明确 persona 代表的是哪一类需求模式
- 避免把单个客户故事误写成通用用户

### 6. 把一线反馈当作低价值二手信息

修正：
- 单独整理 frontline signals
- 与访谈、数据、可用性测试做交叉验证
- 把“经常被客服/销售反复提到的问题”标成高关注候选

---

## 与其他文档的关系

- 当研究已足以支持方案定义 → `spec-and-scope.md`
- 当研究主要服务优先级选择 → `roadmap-and-prioritization.md`
- 当需要先回到问题空间重新发散 → `discovery.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [../SKILL.md](../SKILL.md) | 主路由器 |
| [discovery.md](discovery.md) | 补充问题与机会 framing |
| [spec-and-scope.md](spec-and-scope.md) | 证据充分后进入 spec |
| [roadmap-and-prioritization.md](roadmap-and-prioritization.md) | 证据转化为优先级取舍 |
