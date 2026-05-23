# Presentations

> **last_verified: 2026-05-14**
> migrated from: `agent-design/references/presentations.md`

## 作用

当用户需要定义 **演示文稿 / Pitch Deck / 数据型幻灯片** 的结构与视觉系统时，进入本模块。

本模块优先回答：
- 这套 deck 应该怎么讲故事？
- 每页该用什么布局？
- 图表与品牌如何保持一致？

---

## 适用场景

- “帮我做 investor deck / sales deck / status update”
- “给我一套演示文稿结构和视觉方向”
- “数据很多，怎么做成一套清晰的 slides？”
- “需要演示文稿模板、布局、图表规则”

---

## 核心输出

1. **Deck 结构建议**
2. **每页布局策略**
3. **文案结构公式**
4. **图表使用规则**
5. **品牌一致性规则**
6. **HTML slide 模板建议**

---

## 常见 Deck 类型

- Investor Pitch
- Product Launch
- Sales Deck
- Company Overview
- Training
- Status Update

---

## 推荐输出骨架

```markdown
## Deck Strategy
- Goal:
- Audience:
- Recommended deck type:
- Slide count:
- Narrative arc:

## Slide Plan
| Slide | Purpose | Layout | Visual notes |
|---|---|---|---|

## Copy System
- PAS / AIDA / FAB / other:

## Chart Guidance
| Data Type | Recommended Chart | Notes |
|---|---|---|

## Brand Rules
- Token usage:
- Typography:
- Chart colors:
```

---

## 关键规则

### 结构
- 不同受众对应不同 deck 节奏
- 需要用情绪曲线控制“问题 → 转机 → 证据 → 行动”

### 布局
- 常见布局：hero / split / grid / chart / quote / timeline
- 内容尽量保持中央主区，避免信息挤边

### 图表
- 数据图表优先使用明确图例和无障碍颜色
- 图表类型要匹配数据类型：趋势、比较、占比、流程
- 图表颜色应来自品牌或 Token

### 品牌一致性
- 统一字体层级
- 统一主色 / 辅色 / 强调色
- 不在 slide 中硬编码零散样式

---

## 与其他文档的关系

- 颜色与字体来自 `design-tokens.md`
- 品牌方向来自 `brand-assets.md` 或 `visual-identity.md`
- 如为正式文档式材料，可参考 `document-design.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [design-tokens.md](design-tokens.md) | 幻灯片 Token |
| [brand-assets.md](brand-assets.md) | 品牌一致性 |
| [document-design.md](document-design.md) | 报告型内容视觉 |
