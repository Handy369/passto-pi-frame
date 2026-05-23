# Design Foundation

> **last_verified: 2026-05-14**
> migrated from: `agent-design/references/foundation.md`

## 作用

这是统一 UI/UX 工作流中的 **视觉增强与通用审查补充模块**。

默认应先经过 `ui-ux-product-design.md`，先把：
- 对象
- 信息结构
- 内容层级
- 功能布局
- 状态与反馈

定义清楚；然后再进入本模块补：
- 风格
- 配色
- 字体
- 视觉层级
- 无障碍与交互规则
- Web 界面审查标准

如果用户要的是纯视觉方向，本模块也可直接使用；但如果问题核心是复杂产品界面的信息架构与交互层级，不应由本模块主导。

---

## 适用场景

- “这个产品适合什么视觉风格？”
- “帮我定配色、字体、页面气质”
- “信息结构先不动，帮我补视觉层级和表现规则”
- “review my UI / 审查我的界面 / 检查无障碍”
- “给我一份页面视觉设计准则或审查清单”

---

## 核心输出

1. **视觉方向建议**
2. **风格 / 配色 / 字体建议**
3. **布局与响应式规则**
4. **交互 / 表单 / 导航规则**
5. **无障碍与性能检查点**
6. **Web 审查发现列表**

---

## 优先级顺序

设计判断优先按以下顺序做：
1. **无障碍**：对比度、键盘导航、标签、reduced-motion
2. **触控与交互**：点击面积、间距、加载反馈、错误反馈
3. **性能**：图片、懒加载、CLS、长列表虚拟化
4. **风格一致性**：风格是否匹配产品类型，是否全局一致
5. **布局与响应式**：移动优先、断点、行长、间距系统
6. **排版与色彩**：基础字号、层级、语义化颜色
7. **动画**：时长、意义、可关闭性

---

## 推荐输出骨架

```markdown
## Design Direction
- Product type:
- Target feeling:
- Recommended styles:
- Avoid:

## Color and Typography
- Primary palette:
- Accent palette:
- Heading font:
- Body font:

## Layout Rules
- Breakpoints:
- Spacing scale:
- Navigation pattern:

## Accessibility Checklist
- Contrast:
- Focus states:
- Keyboard nav:
- Form labels:
- Reduced motion:

## Review Findings
- file / surface:
- issue:
- why it matters:
- recommended fix:
```

---

## 审查重点

### 无障碍
- 普通文本对比度 ≥ 4.5:1
- 图标按钮需有标签
- 可交互元素需有可见 focus 状态
- 表单不能只靠 placeholder
- 支持 prefers-reduced-motion

### 交互
- 触控目标至少 44×44px
- 异步操作必须有加载反馈
- 错误提示要贴近问题区域
- 破坏性操作要有确认

### 布局
- mobile-first
- 使用系统性断点
- 避免水平滚动
- 使用统一间距比例

### 风格
- 风格要匹配品类与品牌气质
- 不要混用冲突风格
- 使用一致的图标与色彩语言

---

## 与其他文档的关系

- 如果问题核心不是风格，而是 **复杂产品界面的信息架构 / 交互层级 / 工作台组织方式**，应优先转到 `agent-human-workspace-baseline.md`
- 需要落成 Token / 组件变量 → `design-tokens.md`
- 需要定义品牌形象 → `visual-identity.md`
- 需要做演示文稿视觉系统 → `presentations.md`
- 需要做 Banner / 营销图方向 → `banner-design.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [design-tokens.md](design-tokens.md) | 把设计方向沉淀为 Token |
| [visual-identity.md](visual-identity.md) | 品牌视觉方向 |
| [banner-design.md](banner-design.md) | 营销视觉输出 |
| [document-design.md](document-design.md) | 文档视觉规范 |
