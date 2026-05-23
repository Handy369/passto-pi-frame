# PDF 处理指南

> **Related**: 表单填写见 [pdf-forms.md](pdf-forms.md) | 高级操作见 [pdf-advanced.md](pdf-advanced.md) | 从 Office 转 PDF 见 [SKILL.md 跨格式转换](../SKILL.md#跨格式转换)


# PDF Processing Guide

## Overview

This guide covers essential PDF processing operations using Python libraries and command-line tools. For advanced features, JavaScript libraries, and detailed examples, see pdf-advanced.md. If you need to fill out a PDF form, read pdf-forms.md and follow its instructions.

## Quick Start

```python
from pypdf import PdfReader, PdfWriter

# Read a PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# Extract text
text = ""
for page in reader.pages:
    text += page.extract_text()
```

## Python Libraries

### pypdf - Basic Operations

#### Merge PDFs
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```

#### Split PDF
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```

#### Extract Metadata
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```

#### Rotate Pages
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # Rotate 90 degrees clockwise
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```

### pdfplumber - Text and Table Extraction

#### Extract Text with Layout
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```

#### Extract Tables
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```

#### Advanced Table Extraction
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # Check if table is not empty
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# Combine all tables
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```

### reportlab - Create PDFs

#### Basic PDF Creation
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# Add text
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# Add a line
c.line(100, height - 140, 400, height - 140)

# Save
c.save()
```

#### Create PDF with Multiple Pages
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# Add content
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# Page 2
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# Build PDF
doc.build(story)
```

#### Subscripts and Superscripts

**IMPORTANT**: Never use Unicode subscript/superscript characters (₀₁₂₃₄₅₆₇₈₉, ⁰¹²³⁴⁵⁶⁷⁸⁹) in ReportLab PDFs. The built-in fonts do not include these glyphs, causing them to render as solid black boxes.

Instead, use ReportLab's XML markup tags in Paragraph objects:
```python
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()

# Subscripts: use <sub> tag
chemical = Paragraph("H<sub>2</sub>O", styles['Normal'])

# Superscripts: use <super> tag
squared = Paragraph("x<super>2</super> + y<super>2</super>", styles['Normal'])
```

For canvas-drawn text (not Paragraph objects), manually adjust font the size and position rather than using Unicode subscripts/superscripts.

### 中文字体配置 (CRITICAL for Chinese text)

reportlab 默认不支持中文，需要注册 TTF/OTF 字体。**这是格式层面的配置，与视觉设计无关。**

#### 字体注册
```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

def find_and_register_chinese_font():
    """自动查找并注册系统中文字体"""
    # 字体路径映射表（按优先级排序）
    font_candidates = [
        # macOS
        ('PingFang SC', '/System/Library/Fonts/Supplemental/PingFang.ttc'),
        ('PingFang', '/System/Library/Fonts/Supplemental/PingFang.ttc'),
        ('Heiti SC', '/System/Library/Fonts/Supplemental/STHeiti Light.ttc'),
        # Linux
        ('Noto Sans CJK SC', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'),
        ('Noto Sans SC', '/usr/share/fonts/opentype/noto/NotoSansSC-Regular.otf'),
        # Windows
        ('Microsoft YaHei', 'C:/Windows/Fonts/msyh.ttc'),
        ('SimHei', 'C:/Windows/Fonts/simhei.ttf'),
    ]
    
    for font_name, font_path in font_candidates:
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont(font_name, font_path))
                print(f"✓ 已注册字体: {font_name}")
                return font_name
            except Exception as e:
                print(f"⚠ 注册 {font_name} 失败: {e}")
                continue
    
    print("✗ 未找到可用的中文字体")
    return None

# 使用示例
CHINESE_FONT = find_and_register_chinese_font()
print(f"使用字体: {CHINESE_FONT}")
```

#### 完整 PDF 创建示例（含中文）
```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# 1. 注册中文字体
def setup_chinese_font():
    font_paths = [
        '/System/Library/Fonts/Supplemental/PingFang.ttc',
        '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
        'C:/Windows/Fonts/msyh.ttc',
    ]
    for path in font_paths:
        if os.path.exists(path):
            pdfmetrics.registerFont(TTFont('ChineseFont', path))
            return 'ChineseFont'
    return 'Helvetica'  # 回退

CHINESE_FONT = setup_chinese_font()

# 2. 创建文档
doc = SimpleDocTemplate("report.pdf", pagesize=A4)

# 3. 定义样式（使用中文字体）
styles = {
    'title': ParagraphStyle(
        'Title',
        fontName=CHINESE_FONT,
        fontSize=24,
        leading=30,
    ),
    'body': ParagraphStyle(
        'Body',
        fontName=CHINESE_FONT,
        fontSize=12,
        leading=18,
    ),
}

# 4. 添加内容
story = [
    Paragraph("SWOT 分析报告", styles['title']),
    Spacer(1, 20),
    Paragraph("这是一个包含中文的PDF文档。", styles['body']),
]

# 5. 生成
doc.build(story)
```

#### HTML 转 PDF（推荐方案）

**推荐使用 Headless Chrome** — 利用系统已安装的 Chrome 浏览器，无需额外依赖，完美保留 CSS 样式。

```bash
# 基本用法
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
  --headless \\
  --disable-gpu \\
  --no-pdf-header-footer \\
  --print-to-pdf=output.pdf \\
  input.html

# 指定 A4 纸张
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\
  --headless \\
  --disable-gpu \\
  --no-pdf-header-footer \\
  --print-to-pdf=output.pdf \\
  --print-to-pdf-paper-format=A4 \\
  input.html

# 自定义纸张尺寸（毫米）
--print-to-pdf-paper-width=210 \\
--print-to-pdf-paper-height=297
```

**Headless Chrome 优势**：
- ✅ 零额外依赖（使用系统 Chrome）
- ✅ CSS 支持完美（包括 CSS 变量、渐变、Flexbox）
- ✅ 中文字体自动处理
- ✅ 与浏览器显示效果完全一致

**旧方案（LibreOffice）**：
```bash
# 仅当 Headless Chrome 不可用时使用
soffice --headless --convert-to pdf --outdir output/ input.html
```

**字体配置说明**: Headless Chrome 无需额外配置，使用 CSS 中的系统字体：
```css
font-family: 
    'PingFang SC',           /* macOS */
    'Microsoft YaHei',        /* Windows */
    'Noto Sans SC',           /* Linux */
    sans-serif;
```

#### 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 中文字符显示为方块 | 字体未注册 | 使用 `pdfmetrics.registerFont()` 注册 |
| 字体注册失败 | 路径错误 | 使用绝对路径，检查 `os.path.exists()` |
| 转换后中文丢失 | HTML 字体问题 | 确保 CSS 使用系统字体，转换时嵌入字体 |

## Command-Line Tools

### pdftotext (poppler-utils)
```bash
# Extract text
pdftotext input.pdf output.txt

# Extract text preserving layout
pdftotext -layout input.pdf output.txt

# Extract specific pages
pdftotext -f 1 -l 5 input.pdf output.txt  # Pages 1-5
```

### qpdf
```bash
# Merge PDFs
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf

# Split pages
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf
qpdf input.pdf --pages . 6-10 -- pages6-10.pdf

# Rotate pages
qpdf input.pdf output.pdf --rotate=+90:1  # Rotate page 1 by 90 degrees

# Remove password
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf
```

### pdftk (if available)
```bash
# Merge
pdftk file1.pdf file2.pdf cat output merged.pdf

# Split
pdftk input.pdf burst

# Rotate
pdftk input.pdf rotate 1east output rotated.pdf
```

## Common Tasks

### Extract Text from Scanned PDFs
```python
# Requires: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# Convert PDF to images
images = convert_from_path('scanned.pdf')

# OCR each page
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```

### Add Watermark
```python
from pypdf import PdfReader, PdfWriter

# Create watermark (or load existing)
watermark = PdfReader("watermark.pdf").pages[0]

# Apply to all pages
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```

### Extract Images
```bash
# Using pdfimages (poppler-utils)
pdfimages -j input.pdf output_prefix

# This extracts all images as output_prefix-000.jpg, output_prefix-001.jpg, etc.
```

### Password Protection
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# Add password
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```

## Quick Reference

| Task | Best Tool | Command/Code |
|------|-----------|--------------|
| Merge PDFs | pypdf | `writer.add_page(page)` |
| Split PDFs | pypdf | One page per file |
| Extract text | pdfplumber | `page.extract_text()` |
| Extract tables | pdfplumber | `page.extract_tables()` |
| Create PDFs | reportlab | Canvas or Platypus |
| Command line merge | qpdf | `qpdf --empty --pages ...` |
| OCR scanned PDFs | pytesseract | Convert to image first |
| Fill PDF forms | pdf-lib or pypdf (see pdf-forms.md) | See pdf-forms.md |

## Next Steps

- For advanced pypdfium2 usage, see pdf-advanced.md
- For JavaScript libraries (pdf-lib), see pdf-advanced.md
- If you need to fill out a PDF form, follow the instructions in pdf-forms.md
- For troubleshooting guides, see pdf-advanced.md
