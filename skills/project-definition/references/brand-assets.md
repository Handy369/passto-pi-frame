# Brand Assets

> **last_verified: 2026-05-14**
> migrated from: `agent-design/references/brand-assets.md`

## 作用

当用户需要管理 **品牌资产、颜色提取、命名规范、素材目录、一致性检查** 时，进入本模块。

它处理的是品牌资产治理，而不是单次视觉创作。

---

## 适用场景

- “从 Logo 提取品牌色”
- “帮我规划品牌素材目录和命名规则”
- “检查这套品牌资产是否一致”
- “怎么把品牌指南同步到设计系统？”

---

## 核心输出

1. **品牌上下文摘要**
2. **颜色提取与用途建议**
3. **资产命名规则**
4. **目录结构建议**
5. **一致性检查清单**
6. **同步到 Token 的建议**

---

## 推荐输出骨架

```markdown
## Brand Context
- Brand name:
- Primary color:
- Secondary color:
- Accent:
- Fonts:
- Tagline / voice:

## Asset Inventory Rules
- Naming:
- Formats:
- Size conventions:
- Folder structure:

## Consistency Checklist
- Logo usage:
- Color usage:
- Typography:
- Digital assets:
- Print assets:

## Sync Plan
- Brand guidelines → tokens
- Tokens → UI surfaces
```

---

## 关键规则

### 命名
- 使用 kebab-case
- 名称应描述用途与变体
- 避免临时、重复、导出默认名

### 结构
建议至少区分：
- logo/
- icons/
- banners/
- images/
- templates/

### 校验
- 文件格式是否适合用途
- 数字与打印色彩模式是否正确
- 尺寸是否符合平台要求
- 透明背景与 DPI 是否正确

### 品牌同步
- 品牌指南是源头
- Token 是设计系统映射层
- UI / slides / docs / banners 复用同一品牌上下文

---

## 与其他文档的关系

- 品牌视觉定义来自 `visual-identity.md`
- 品牌色与字体可沉淀到 `design-tokens.md`
- 文档、Banner、Deck 都应复用本模块输出的资产规范

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [visual-identity.md](visual-identity.md) | 品牌定义来源 |
| [design-tokens.md](design-tokens.md) | 品牌同步到 Token |
| [banner-design.md](banner-design.md) | 营销素材资产 |
| [document-design.md](document-design.md) | 正式文档品牌应用 |
