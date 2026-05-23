# Design Tokens

> **last_verified: 2026-05-14**
> migrated from: `agent-design/references/design-tokens.md`

## 作用

当用户要建立 **设计系统 / Token / 组件规格 / CSS 变量约定** 时，进入本模块。

目标是把视觉方向收敛成可复用、可主题化、可协作的设计契约，而不是只给一堆颜色值。

---

## 适用场景

- “帮我做一套 design token”
- “定义组件状态和变量系统”
- “我要一套 CSS variables / Tailwind token 方案”
- “帮我把品牌风格沉淀为设计系统”

---

## 核心输出

1. **Token 分层结构**
2. **语义化颜色系统**
3. **字体 / 间距 / 阴影 Token**
4. **组件状态规格**
5. **暗色模式策略**
6. **Tailwind / CSS 变量映射建议**

---

## 推荐结构

固定优先使用三层：

```text
Primitive → Semantic → Component
```

### 解释
- **Primitive**：原始值，如色阶、字号、间距
- **Semantic**：用途别名，如 primary / surface / error
- **Component**：组件专用变量，如 button-bg / input-border

---

## 推荐输出骨架

```markdown
## Token Architecture
- Primitive:
- Semantic:
- Component:

## Color Tokens
| Token | Meaning | Source |
|---|---|---|

## Typography Tokens
| Token | Value | Usage |
|---|---|---|

## Spacing Tokens
| Token | Value | Usage |
|---|---|---|

## Component Specs
| Component | Default | Hover | Active | Disabled | Focus |
|---|---|---|---|---|---|

## Theme Strategy
- Light:
- Dark:
- Accessibility notes:
```

---

## 关键原则

### 1. 不在组件中硬编码原始值
应该写：
- `var(--color-text-primary)`

不应该写：
- `#1F2937`

### 2. 优先语义命名
应该写：
- `--color-success`
- `--surface-muted`

不应该写：
- `--green-500-for-card-border`

### 3. 组件状态必须完整
至少定义：
- default
- hover
- active
- disabled
- focus
- error（如适用）

### 4. 主题切换要提前考虑
- 暗色模式不能简单反色
- 保持语义不变，只换底层映射

---

## 常见范围

- 颜色：brand / semantic / surface / text / feedback
- 字体：family / size / line-height / tracking
- 间距：4pt / 8pt scale
- 阴影：层级阴影与品牌阴影
- 圆角：small / medium / large / pill
- 组件：button、input、card、badge、toast

---

## 与其他文档的关系

- 设计方向来自 `design-foundation.md`
- 品牌色与品牌字体来自 `brand-assets.md` 或 `visual-identity.md`
- 若要进入实际样式落地，可再交给实现侧技能

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [design-foundation.md](design-foundation.md) | 上游设计原则 |
| [brand-assets.md](brand-assets.md) | 品牌资产同步到 Token |
| [visual-identity.md](visual-identity.md) | 品牌主视觉来源 |
| [presentations.md](presentations.md) | 演示文稿的 Token 扩展 |
