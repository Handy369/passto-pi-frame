# Iconography

> **last_verified: 2026-05-14**
> migrated from: `agent-design/references/iconography.md`

## 作用

当用户需要定义 **图标风格、图标集规范、尺寸与使用规则** 时，进入本模块。

重点不是单个 SVG 的即时生成，而是先把图标系统定义清楚。

---

## 适用场景

- “帮我定一套 icon 风格”
- “我要做一整套导航 / 业务图标系统”
- “图标应该用 outlined 还是 filled？”
- “帮我写图标使用规范和命名方案”

---

## 核心输出

1. **图标风格选择**
2. **图标类别规划**
3. **尺寸与描边规则**
4. **颜色与状态规则**
5. **可访问性规则**
6. **批量生成与审核建议**

---

## 常见风格

- Outlined：轻量、现代、Web 常用
- Filled：清晰、适合移动端和导航
- Duotone：营销页、层次更强
- Rounded：友好、生活方式产品
- Sharp：科技、金融、企业

---

## 推荐输出骨架

```markdown
## Icon System Direction
- Recommended style:
- Stroke / fill rule:
- Corner language:
- Visual tone:

## Icon Set Scope
- Navigation:
- Actions:
- Content / files:
- Domain-specific icons:

## Usage Rules
| Area | Rule |
|---|---|
| Size | |
| Color | |
| Hover / active | |
| Disabled | |
| Accessibility | |

## Production Workflow
- batch generation:
- review criteria:
- export sizes:
```

---

## 关键规则

### 风格一致性
- 不要在同一产品内混用 outline / fill / duotone
- 描边粗细、圆角、视觉重心必须统一

### 尺寸系统
建议至少定义：
- 16px
- 20px
- 24px
- 32px
- 48px

### 颜色系统
- 默认使用语义化颜色 Token
- hover / active / disabled 需有状态规则
- 不要直接在资产层硬编码过多品牌色变体

### 可访问性
- 图标按钮必须有 aria-label
- 单靠图标表达关键含义时应辅以文字

---

## 与其他文档的关系

- 品牌主视觉来源 → `visual-identity.md`
- 品牌颜色与命名 → `brand-assets.md`
- 图标颜色映射 → `design-tokens.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [visual-identity.md](visual-identity.md) | 品牌图形语言 |
| [brand-assets.md](brand-assets.md) | 图标资产组织 |
| [design-tokens.md](design-tokens.md) | 图标颜色与状态 |
