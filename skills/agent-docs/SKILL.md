---
name: agent-docs
description: >
  处理所有文档文件类型的技能集，包括 Word (.docx)、PDF (.pdf)、
  PowerPoint (.pptx)、Excel (.xlsx/.xlsm/.csv) 的创建、阅读、编辑和转换。

  使用此技能的场景：
  用户需要对文档文件进行任何操作，包括：创建新文档、读取/提取文本或表格、
  编辑现有文件、格式转换、合并/拆分、填写 PDF 表单、添加水印/批注/修订、
  制作演示文稿、处理电子表格公式和图表等。

  应优先触发的场景：
  1. 用户提及文档文件名或扩展名（.docx, .doc, .pdf, .pptx, .ppt, .xlsx, .xlsm, .csv, .tsv）
  2. 用户要求创建报告、备忘录、信函、合同、演示文稿、电子表格等文档交付物
  3. 用户提及 "Word doc"、"slides"、"deck"、"presentation"、"spreadsheet"
  4. 用户需要从文档中提取、转换或重新组织内容

  不要在以下场景触发：
  用户仅讨论纯代码编写、网页爬取、数据库操作、Google Docs/Sheets API 集成，
  或不涉及本地文档文件输入输出的任务。
---

# Agent Docs — 文档处理路由器

## Top-level Boundary Pack

### current main output
- 本地文档文件的创建、读取、编辑、转换、提取、填写、导出结果
- 与文档操作直接相关的文件产物、文本/表格提取结果、转换结果或验证结果

### current main action
- 读取文档内容
- 创建或编辑 docx / pdf / pptx / xlsx / csv / tsv
- 进行格式转换、合并、拆分、填写表单、提取文本/表格
- 使用对应脚本或工具完成文档级处理与验证

### should-trigger
当用户当前主目标是以下任一项时，优先进入本 Skill：
- 处理本地 Word、PDF、PPT、Excel、CSV、TSV 文件
- 创建报告、信函、合同、演示文稿、电子表格等文档交付物
- 从文档中提取文本、表格、结构化内容
- 做格式转换、表单填写、文档合并/拆分、OCR、导出

### should-not-trigger
以下请求不应由本 Skill 接管：
- 纯代码编写、修 bug、跑测试、调试应用逻辑
- 纯网页爬取、浏览器自动化、页面交互测试
- 纯产品定义、视觉设计方向、信息架构讨论
- 仅涉及 Google Docs/Sheets API 集成而不涉及本地文档文件输入输出

### adjacent destination
- 代码实现 / 调试 / 测试主流程 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 纯网页交互 / 自动化浏览器操作 → `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- 纯视觉设计 / 模板方向 → 相邻设计 skill 或定义主流程
- 若主要任务是查 API / 库文档，而不是操作文档文件 → `/Users/handy/.claude/skills/doc-lookup/SKILL.md`

### non-goals
即使命中本 Skill，也不要顺手扩做：
- 把文档处理任务扩成完整产品定义或代码实施任务
- 因为用户提到“报告/表格/演示文稿”，就接管与本地文档文件无关的工作
- 跳过格式特定规则，直接用通用猜法处理复杂文件
- 忽略脚本/验证步骤，直接假设输出文件可用

### first action after hit
先判定目标格式与操作类型；再只读取对应 `references/*.md`，如该路径依赖共享或格式专用脚本，再进入相应 `scripts/` 子路径执行或验证。

### positive examples
- “把这个 PDF 表单填好并导出新的 PDF。”
  - why should trigger: 主目标是本地 PDF 文件填写与导出
  - expected adopt signal: 先进入 PDF 路径，必要时走 `pdf-forms.md` 和 `scripts/pdf/*`
- “根据这个 xlsx 数据做一个 pptx 演示文稿。”
  - why should trigger: 这是典型文档文件输入输出与跨格式交付
  - expected adopt signal: 先判定 xlsx + pptx 双路径，再按需读取相关 references 与脚本
- “把这个 docx 转成 PDF，再提取正文文本给我。”
  - why should trigger: 这是本地文档转换与提取任务
  - expected adopt signal: 先判定 docx / pdf 转换路径，再执行提取或转换命令

### negative examples
- “帮我写一个上传 PDF 的后端接口。”
  - why should not trigger: 主输出物是代码实现，不是文档处理
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “打开这个网站把表单填了并截图。”
  - why should not trigger: 这是网页交互，不是本地文档处理
  - correct destination: `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- “帮我设计一套演示文稿的视觉风格方向。”
  - why should not trigger: 这是设计方向定义，不是文档文件操作
  - correct destination: 相邻设计 skill 或定义主流程

## Overview

提供对 Word、PDF、PowerPoint、Excel 四大文档格式的创建、阅读、编辑、转换能力。SKILL.md 包含路由表和通用规则，复杂场景按需阅读对应格式的 `references/*.md`。

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 顶层文档路由入口；负责判定格式、操作类型与首个子路径 |
| `references/` | required | runtime | 承载按格式划分的详细处理规则，是命中后首个读取面 |
| `references/*.md` | required | runtime | 按 docx / pdf / pptx / xlsx 细化操作规则、工具与限制 |
| `scripts/` | required | runtime | 承载 Office/PDF/PPTX/XLSX 的实际辅助脚本与验证脚本，真实改变 owner 行为 |
| `scripts/office/` | required | runtime | 提供共享 unpack / pack / validate / soffice 转换能力，跨 docx/pptx/xlsx 共用 |
| `scripts/docx/` | optional | runtime | 仅在 docx 注释、接受修订等高级操作时需要 |
| `scripts/pdf/` | optional | runtime | 仅在 PDF 表单 / 边界框 / 图像验证等高级路径时需要 |
| `scripts/pptx/` | optional | runtime | 仅在 PPTX 缩略图、清理、加 slide 等编辑路径时需要 |
| `scripts/xlsx/` | optional | runtime | 仅在公式重算等 Excel 专用路径时需要 |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `templates/` | forbidden | runtime | 当前主结构不依赖模板目录；文档处理规则已由 references + scripts 承载 |

---

## Quick Reference

| 任务 | 格式 | 推荐工具 | 详细文档 |
|------|------|----------|----------|
| 读取/提取文本 | .docx | pandoc / unpack | [docx.md](references/docx.md) |
| HTML → DOCX | .docx | html4docx | [docx.md](references/docx.md) |
| 创建新文档 | .docx | docx-js (Node) | [docx.md](references/docx.md) |
| 编辑现有文档 | .docx | unpack → Edit XML → pack | [docx.md](references/docx.md) |
| 读取/提取文本 | .pdf | pdfplumber / pdftotext | [pdf.md](references/pdf.md) |
| **HTML → PDF** | .pdf | **Headless Chrome** | [pdf.md](references/pdf.md) |
| 合并/拆分/加密 | .pdf | pypdf / qpdf | [pdf.md](references/pdf.md) |
| 填写表单 | .pdf | pypdf / pdf-lib | [pdf-forms.md](references/pdf-forms.md) |
| 创建 PDF | .pdf | reportlab | [pdf.md](references/pdf.md) |
| OCR 扫描件 | .pdf | pytesseract + pdf2image | [pdf.md](references/pdf.md) |
| 高级 PDF 操作 | .pdf | pypdfium2 / pdf-lib / pdfjs | [pdf-advanced.md](references/pdf-advanced.md) |
| 读取内容 | .pptx | markitdown | [pptx.md](references/pptx.md) |
| 编辑/基于模板 | .pptx | unpack → Edit XML → pack | [pptx-editing.md](references/pptx-editing.md) |
| 从零创建 | .pptx | PptxGenJS (Node) | [pptx-create.md](references/pptx-create.md) |
| 读取/分析数据 | .xlsx | pandas | [xlsx.md](references/xlsx.md) |
| 创建/编辑/公式 | .xlsx | openpyxl | [xlsx.md](references/xlsx.md) |

### 轻量方案（推荐）

**HTML → PDF**: 使用 Headless Chrome（零依赖，完美保留 CSS）
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
  --headless --disable-gpu --no-pdf-header-footer \\
  --print-to-pdf=output.pdf --print-to-pdf-paper-format=A4 \\
  input.html
```

**HTML → DOCX**: 使用 html4docx（pip ~5MB）
```bash
pip install html4docx
# 然后用 Python 调用
```

---

## 路由决策树

### Step 1: 识别文件格式

| 用户提及 | 格式 |
|---------|------|
| .docx, .doc, Word, 报告, 备忘录, 信函, 合同 | Word |
| .pdf, PDF | PDF |
| .pptx, .ppt, slides, deck, 演示文稿, presentation | PowerPoint |
| .xlsx, .xlsm, .csv, .tsv, spreadsheet, 电子表格 | Excel |
| 无文件（纯创建）| 根据用户描述的目标格式选择 |

### Step 2: 识别操作类型 → 加载子文档

| 操作 | Word | PDF | PowerPoint | Excel |
|------|------|-----|------------|-------|
| **读取/提取** | docx.md | pdf.md | pptx.md | xlsx.md |
| **创建新文件** | docx.md | pdf.md | pptx.md + pptx-create.md | xlsx.md |
| **编辑现有文件** | docx.md | pdf.md | pptx-editing.md | xlsx.md |
| **表单填写** | — | pdf-forms.md | — | — |
| **格式转换** | 见下文 | 见下文 | 见下文 | 见下文 |

### Step 3: 跨格式操作

若涉及多格式（如 "从 xlsx 数据做 pptx 图表"），按需加载多个子文档。

---

## 跨格式转换

所有转换通过 LibreOffice (soffice) 完成：

```bash
# Office 格式互转
python scripts/office/soffice.py --headless --convert-to pdf document.docx
python scripts/office/soffice.py --headless --convert-to pdf presentation.pptx
python scripts/office/soffice.py --headless --convert-to pdf spreadsheet.xlsx
python scripts/office/soffice.py --headless --convert-to docx document.doc
python scripts/office/soffice.py --headless --convert-to pptx presentation.ppt
python scripts/office/soffice.py --headless --convert-to xlsx spreadsheet.xls

# PDF → 图片
pdftoppm -jpeg -r 150 document.pdf output_prefix

# Word → Markdown
pandoc document.docx -o output.md

# 任意 Office → 图片预览（两步）
python scripts/office/soffice.py --headless --convert-to pdf input.pptx
pdftoppm -jpeg -r 150 input.pdf slide
```

---

## 共享工具

### Office XML 操作（docx / pptx / xlsx 共用）

```bash
# 解包 Office 文件为 XML
python scripts/office/unpack.py <file> <unpacked_dir>/

# 重新打包为 Office 文件
python scripts/office/pack.py <unpacked_dir>/ <output_file> --original <original_file>

# 验证 Office XML
python scripts/office/validate.py <file>

# LibreOffice 格式转换
python scripts/office/soffice.py --headless --convert-to <format> <file>
```

---

## 通用规则

### ✅ DO

- **编辑 Office XML 用 Edit tool** — 不写 Python 脚本，Edit tool 精确可靠
- **创建新文档后验证** — docx 用 validate.py，xlsx 用 recalc.py，pptx 做视觉 QA
- **临时文件用 `/tmp/`** — 不要在用户 workspace 创建中间文件
- **先 read 子文档再操作** — Quick Reference 只是索引，细节在子文档中
- **Excel 用公式不用硬编码** — `=SUM(A1:A10)` 而非 Python 计算后填入数值
- **Smart quotes 用 XML entity** — `&#x201C;` `&#x201D;` `&#x2018;` `&#x2019;`

### ❌ DON'T

- **不要手打 Unicode 项目符号** — docx 用 `LevelFormat.BULLET`，pptx 用 `bullet: true`
- **不要用 `\n` 换行** — docx 用多个 Paragraph，pptx 用 `breakLine: true`
- **不要假设工具已安装** — 先检查，缺失时给出安装命令
- **不要返回原始 XML** — 解析后以易读格式呈现给用户
- **不要在 openpyxl 中用 `data_only=True` 后保存** — 会丢失所有公式

---

## Common Pitfalls

| 问题 | 格式 | 原因 | 解决 |
|------|------|------|------|
| 表格在 Google Docs 中错乱 | .docx | 用了 WidthType.PERCENTAGE | 改用 WidthType.DXA |
| PDF 中出现黑块 | .pdf | 用了 Unicode 上下标字符 | 用 ReportLab 的 `<sub>` `<super>` 标签 |
| PPT 颜色失效/文件损坏 | .pptx | hex 颜色带 # 号 | 去掉 # 号：`"FF0000"` |
| Excel 公式显示为文本 | .xlsx | 未运行 recalc | `python scripts/xlsx/recalc.py output.xlsx` |
| 转换 PDF 时崩溃 | 全部 | LibreOffice 未安装 | `brew install --cask libreoffice` |

---

## 详细文档索引

根据需求，阅读对应的详细文档：

- [Word 文档](references/docx.md) — 创建(docx-js)、编辑(XML)、批注、修订、XML Reference
- [PDF 处理](references/pdf.md) — 读取、合并、拆分、创建、加密、OCR
- [PDF 表单](references/pdf-forms.md) — Fillable / Non-fillable 表单填写流程
- [PDF 高级](references/pdf-advanced.md) — pypdfium2、pdf-lib、pdfjs-dist、批量处理
- [演示文稿总览](references/pptx.md) — 阅读、设计指南、QA 流程、图片转换
- [演示文稿编辑](references/pptx-editing.md) — 模板工作流、脚本、XML 编辑
- [演示文稿创建](references/pptx-create.md) — PptxGenJS API、图表、图标
- [电子表格](references/xlsx.md) — pandas/openpyxl、公式、格式化、金融模型规范

---

## Dependencies

### 共享
- **LibreOffice** (`soffice`) — 格式转换（`scripts/office/soffice.py` 自动配置沙盒环境）
- **Poppler** (`pdftoppm`, `pdftotext`, `pdfimages`) — PDF 渲染和提取

### Word (.docx)
- `pandoc` — 文本提取
- `npm install -g docx` — 新建文档（docx-js）

### PDF (.pdf)
- `pypdf`, `pdfplumber`, `reportlab` — Python PDF 库
- `qpdf` — CLI 操作
- `pytesseract`, `pdf2image` — OCR（可选）
- `pypdfium2` — 高级渲染（可选）

### PowerPoint (.pptx)
- `pip install "markitdown[pptx]"` — 文本提取
- `pip install Pillow` — 缩略图
- `npm install -g pptxgenjs react-icons react react-dom sharp` — 新建演示文稿

### Excel (.xlsx)
- `pandas`, `openpyxl` — 读写和分析

## 与 agent-design 协作

### 职责边界

| 能力 | agent-design | agent-docs |
|------|:------------:|:----------:|
| 配色方案设计 | ✅ | ❌ |
| 布局/排版设计 | ✅ | ❌ |
| HTML文档模板 | ✅ | ❌ |
| 格式转换 | ❌ | ✅ |
| PDF 生成 | ❌ | ✅ |
| DOCX 生成 | ❌ | ✅ |
| PPTX 生成 | ❌ | ✅ |
| 字体配置 | ❌ | ✅ (仅格式层面) |

### 能力分层架构

```
┌─────────────────────────────────────────────────────────┐
│                     能力分层架构                         │
├─────────────────────────────────────────────────────────┤
│  内容层 (agent-write - 待创建)                          │
│  ├─ 报告内容生成                                        │
│  └─ 文案撰写                                            │
├─────────────────────────────────────────────────────────┤
│  视觉层 (agent-design)                                  │
│  ├─ 配色方案设计 ← 负责                                 │
│  ├─ 布局排版设计 ← 负责                                 │
│  └─ HTML模板生成 ← 输出                                 │
├─────────────────────────────────────────────────────────┤
│  格式层 (agent-docs)                                    │
│  ├─ HTML → PDF ← 负责                                   │
│  ├─ HTML → DOCX ← 负责                                  │
│  └─ 字体嵌入处理 ← 负责                                 │
└─────────────────────────────────────────────────────────┘
```

### 标准工作流

```
用户："生成一份SWOT分析报告，输出PDF和Word"
          │
          ▼
┌──────────────────────────────────────┐
│ 1. agent-design (视觉层)              │
│    - 选择配色方案                     │
│    - 生成HTML文档模板                 │
│    - 输出: document.html             │
└──────────────────────────────────────┘
          │
          ▼
┌──────────────────────────────────────┐
│ 2. agent-docs (格式层)               │
│    - HTML → PDF                      │
│    - HTML → DOCX                     │
│    - 字体嵌入处理                     │
│    - 输出: report.pdf, report.docx   │
└──────────────────────────────────────┘
```

### 调用规则

| 场景 | 调用方 | 动作 |
|------|--------|------|
| 需要设计视觉方案 | `agent-docs` | 调用 `agent-design` |
| 需要格式转换 | `agent-design` | 调用 `agent-docs` |
| 用户要求"设计+输出" | 由 `agent-design` 主导 | 先设计，再转格式 |
| 用户要求"读取+优化" | 由 `agent-docs` 主导 | 先读取，再设计 |

### agent-design 调用 agent-docs 示例

```bash
# agent-design 完成任务后，调用 agent-docs 进行格式转换

# 1. 保存HTML文档
cp /tmp/report.html ~/output/

# 2. 使用 LibreOffice 进行转换
python scripts/office/soffice.py --headless --convert-to pdf ~/output/report.html --outdir ~/output/
python scripts/office/soffice.py --headless --convert-to docx ~/output/report.html --outdir ~/output/

# 3. 返回最终文件路径
```
