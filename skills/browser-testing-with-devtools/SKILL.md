---
name: browser-testing-with-devtools
description: Deprecated compatibility shim. 当旧路由、历史提示词或人工显式提到本 skill 名称时，不再把它当作独立主 skill；应转到 browser-runtime-observation 作为唯一公开入口，必要时再下钻 chrome-devtools-mcp。
---

# Browser Testing with DevTools (Deprecated Alias)

## Status

该 Skill 已不再作为独立公开入口维护。

统一后的规则是：
- **真实浏览器运行态技术证据** → `/Users/handy/.claude/skills/browser-runtime-observation/SKILL.md`
- **DevTools MCP 低层原语 / 专项 reference** → `/Users/handy/.claude/skills/chrome-devtools-mcp/SKILL.md`
- **轻量网页交互 / 点击 / 填表 / 截图 / 抓文本** → `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- **用户可见反馈 / 可用性 / 交互感知 QA** → `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`

## Top-level Boundary Pack

### current main output
- 对旧命中名称的兼容性解释
- 到统一主入口的明确跳转
- 必要时到低层 DevTools reference 的下钻提示

### current main action
- 停止把本 Skill 当成独立主路由面
- 把调用方转交给 `browser-runtime-observation`
- 若请求明确是低层原语、tool guide 或专项排障资料，再转到 `chrome-devtools-mcp`

### should-trigger
当以下任一情况成立时，本 Skill 仅作为兼容壳命中：
- 历史 prompt、旧文档或旧习惯显式提到 `browser-testing-with-devtools`
- 需要向调用方解释该名称已经被归一化
- 需要把旧入口平滑迁移到统一入口

### should-not-trigger
以下请求不应继续停留在本 Skill：
- 任何新的真实浏览器运行态验证、调试、proof、review 任务
- 任何需要 DOM / console / network / performance / accessibility / memory 证据的正常任务
- 任何轻量浏览器自动化任务
- 任何用户可见反馈 QA 任务

### adjacent destination
- 统一公开入口 → `/Users/handy/.claude/skills/browser-runtime-observation/SKILL.md`
- 底层 DevTools reference → `/Users/handy/.claude/skills/chrome-devtools-mcp/SKILL.md`
- 轻量浏览器自动化 → `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- 用户可见反馈 QA → `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`

### non-goals
- 不再承担真实浏览器测试主流程
- 不再与 `browser-runtime-observation` 并列竞争路由
- 不再作为新的 best-practice 入口被引用

### first action after hit
1. 明确告知：本 Skill 已废弃为兼容别名。
2. 若任务需要真实浏览器技术证据，立即转到 `browser-runtime-observation`。
3. 若任务明确要求查看 DevTools MCP 原语、tool guide、专项 snippets 或低层排障步骤，再转到 `chrome-devtools-mcp`。
4. 不在本 Skill 内继续展开完整测试或诊断流程。

## Migration Note

历史上，本 Skill 与 `browser-runtime-observation` 在以下方面高度重叠：
- DOM / console / network 检查
- performance / accessibility 诊断
- 真实浏览器中的修复验证
- build / debug / review 的 runtime proof

为避免重复路由、重复定义和测试主线混用，现在统一收口到：
- **主入口：`browser-runtime-observation`**
- **低层参考：`chrome-devtools-mcp`**

## Runtime Proof

该兼容壳的完成标准不是“自己执行了多少浏览器动作”，而是：
- 是否阻止了旧入口继续扩张为第二个主 skill
- 是否把任务清晰导向统一后的主入口
- 是否仅在需要低层资料时才下钻到 `chrome-devtools-mcp`
