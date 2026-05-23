# Document Design

> **last_verified: 2026-05-14**
> migrated from: `agent-design/references/document-design.md`

## 作用

当用户需要定义 **报告、白皮书、提案、SWOT、商业文档** 的视觉结构与模板时，进入本模块。

本模块负责文档的视觉定义层：
- 配色
- 排版
- 页面模板
- 表格 / 卡片 / 矩阵组件

格式转换本身应交给 `agent-docs` 或文档处理能力。

---

## 适用场景

- “帮我设计一份专业报告模板”
- “给我白皮书 / 提案 / SWOT 报告的视觉方案”
- “我需要商务文档的颜色、排版和页面结构”
- “把商业内容整理成可导出的 HTML 文档模板”

---

## 核心输出

1. **文档视觉方向**
2. **配色方案**
3. **字体与字号层级**
4. **页面模板建议**
5. **表格 / 卡片 / SWOT 等组件规范**
6. **打印与导出注意事项**

---

## 常见配色方向

- Business Blue：金融、咨询、科技
- Business Green：环保、健康、可持续
- Business Purple：创意、时尚、艺术
- Business Neutral：法律、学术、政府
- SWOT 专用四色：S / W / O / T 区分

---

## 推荐输出骨架

```markdown
## Document Direction
- Document type:
- Audience:
- Tone:
- Recommended palette:
- Recommended typography:

## Page Structure
- Cover page:
- TOC:
- Section page:
- Content page:
- Closing page:

## Component Rules
| Component | Rule | Notes |
|---|---|---|

## Export Notes
- Print:
- PDF:
- DOCX handoff:
```

---

## 常见组件

- 封面页
- 目录页
- SWOT 矩阵
- 数据对比表
- 定价卡片
- 章节页
- 页脚与页码

---

## 关键规则

### 排版
- 中文字体与英文字体都要可读且专业
- 标题、正文、辅助信息至少 4-5 级层级清晰
- 正文行高通常 1.6 左右更适合长文阅读

### 间距
- 使用系统性间距比例
- 章节与模块之间留足呼吸感

### 打印
- 考虑 A4 / print CSS / 分页控制
- 表格与标题避免跨页断裂
- 需要时考虑 CMYK 与 DPI

### 协作边界
- 本模块负责视觉模板
- 真正的 HTML→PDF / HTML→DOCX 转换交给文档处理链路

---

## 与其他文档的关系

- 品牌色与品牌字体来自 `brand-assets.md`
- 若是演示型内容而非报告型内容，更适合 `presentations.md`
- 若需真正导出文档格式，应补 `agent-docs`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [brand-assets.md](brand-assets.md) | 品牌资产输入 |
| [presentations.md](presentations.md) | 演示型内容 |
| [design-foundation.md](design-foundation.md) | 基础视觉规则 |
