---
name: chrome-devtools-mcp
description: Chrome DevTools MCP 内部 reference。用于查看底层 DevTools MCP tool guide、专项排障步骤、Lighthouse / performance / memory / accessibility 的低层操作说明。默认不作为公开主调度 skill，也不应与 browser-runtime-observation 并列竞争入口；仅在需要内部 reference 或人工强制查看原始工具资料时使用。
allowed-tools: ["mcp__chrome-devtools-mcp"]
disable-model-invocation: true
---

# Chrome DevTools MCP

## Top-level Boundary Pack

### current main output
- 底层 DevTools MCP 原语说明
- 专项诊断路径的参考资料与低层操作提示
- 供上层 skill 下钻时使用的 snippets、tool guide 与排障线索

### current main action
- 提供 DevTools MCP 低层 reference
- 承载 DOM / console / network / performance / memory 等专项资料
- 作为上层运行态观察 skill 的下钻读物
- 在必要时提供低层工具调用与分析线索

### should-trigger
当以下任一情况成立时，才进入本 Skill：
- 需要查看原始 DevTools MCP tool guide 或低层参考
- 上层调度 skill（如 `browser-runtime-observation`）已经命中，但需要进一步下钻到底层原语或专项排障步骤
- 人工明确要求查看 / 使用 `chrome-devtools-mcp` 这个 reference skill

注意：本 Skill 不是公开主入口；除非用户或上层 skill 明确要求，否则不要直接停留在这里完成整条浏览器验证主流程。

### should-not-trigger
以下请求不应由本 Skill 接管：
- 只做高层产品定义、信息架构、交互方案讨论
- 只改代码、不需要真实浏览器运行时证据
- 只需简单打开网页/点击/截图，且不需要 DevTools 深度诊断
- 纯技术文档查询、API 用法说明、框架配置说明

### adjacent destination
- 轻量网站交互、表单填写、简单截图测试 → `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- 浏览器运行态技术证据主路径 → `/Users/handy/.claude/skills/browser-runtime-observation/SKILL.md`
- 用户可见反馈 / 真实界面 QA → `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`
- 已明确进入代码实现 / 修 bug / 补测试 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 官方文档/API 用法查询 → `/Users/handy/.claude/skills/doc-lookup/SKILL.md`

### non-goals
即使命中本 Skill，也不要顺手扩做：
- 把 DevTools 运行时验证任务扩成完整代码实现任务
- 因为用户提到网页，就默认进入重型 DevTools 路径
- 没有先拿到运行时证据就输出确定性性能/可访问性结论
- 把轻量自动化操作与深度 DevTools 诊断混成一条默认路径
- 与 `browser-runtime-observation` 并列竞争公开路由入口

### first action after hit
先判断当前是否真的是“需要低层 reference”，而不是仍应留在 `browser-runtime-observation` 这个上层入口。

若确需下钻，再按专题查看对应低层资料：
- snapshot / DOM
- console / network
- Lighthouse / accessibility
- performance / memory

不要把本 Skill 重新扩张成独立主调度面。

### positive examples
- “帮我检查这个页面的 console error 和 network waterfall，看看为什么首屏卡住。”
  - why should trigger: 需要真实浏览器的 console 与 network 证据
  - expected adopt signal: 先建立页面上下文，再抓 console / network 数据而不是直接猜原因
- “跑一轮 Lighthouse 和 accessibility audit，把失败项列出来。”
  - why should trigger: 这是典型 DevTools/Lighthouse/a11y 审计任务
  - expected adopt signal: 先运行 audit，再基于 report/snapshot 输出问题
- “这个页面怀疑有内存泄漏，帮我做 snapshot 并分析。”
  - why should trigger: 这是明确的 memory diagnosis 请求
  - expected adopt signal: 先按 memory workflow 采样，再用 memlab 或 fallback 脚本分析

### negative examples
- “打开这个网站点一下登录按钮，帮我截个图。”
  - why should not trigger: 这是轻量浏览器自动化，不一定需要 DevTools 深度诊断
  - correct destination: `/Users/handy/.claude/skills/agent-browser/SKILL.md`
- “直接把这个 React 页面改成三栏布局。”
  - why should not trigger: 主输出物是代码实现，不是运行时调试
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “告诉我 Lighthouse 的 performance score 是怎么计算的。”
  - why should not trigger: 这是知识说明，不一定需要真实浏览器操作
  - correct destination: 直接回答或按需用 `doc-lookup`

`chrome-devtools-mcp` lets your coding agent control and inspect a live Chrome browser via the Model Context Protocol. It provides access to Chrome DevTools for reliable automation, in-depth debugging, and performance analysis.

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 内部 reference 入口；负责判断是否真的需要下钻低层资料，而不是承担公开主路由 |
| `references/` | required | runtime | 承载 tool reference、snippets、troubleshooting、memory/perf 深入材料 |
| `references/*.md` | required | runtime | 各类诊断路径的最小读物；决定具体分析动作与工具选择 |
| `references/compare_snapshots.js` | required | runtime | memory snapshot 的 fallback 分析脚本，在 `memlab` 不适用时提供最小可执行退路 |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 本 Skill 不需要额外脚本目录；唯一保留的 JS 文件已作为明确 runtime fallback 资产存在于 references 中 |

## Quick Start

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest"]
    }
  }
}
```

For basic tasks only (navigation + screenshots), use `--slim` mode:
```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@latest", "--slim", "--headless"]
    }
  }
}
```

## Core Concepts

**Browser lifecycle**: Browser starts automatically on first tool call using a persistent Chrome profile. Configure via CLI args: `npx chrome-devtools-mcp@latest --help`.

**Page selection**: Tools operate on the currently selected page. Use `list_pages` to see available pages, then `select_page` to switch context.

**Element interaction**: Use `take_snapshot` to get page structure with element `uid`s. Each element has a unique `uid` for interaction. If an element isn't found, take a fresh snapshot - the element may have been removed or the page changed.

**Snapshot example**:
```
uid=1_0 RootWebArea "Example Domain" url="https://example.com/"
  uid=1_1 heading "Example Domain" level="1"
```

## Workflow Patterns

### Before interacting with a page

1. Navigate: `navigate_page` or `new_page`
2. Wait: `wait_for` to ensure content is loaded if you know what you look for
3. Snapshot: `take_snapshot` to understand page structure
4. Interact: Use element `uid`s from snapshot for `click`, `fill`, etc.

### Efficient data retrieval

- Use `filePath` parameter for large outputs (screenshots, snapshots, traces)
- Use pagination (`pageIdx`, `pageSize`) and filtering (`types`) to minimize data
- Set `includeSnapshot: false` on input actions unless you need updated page state

### Tool selection

- **Automation/interaction**: `take_snapshot` (text-based, faster, better for automation)
- **Visual inspection**: `take_screenshot` (when user needs to see visual state)
- **Additional details**: `evaluate_script` for data not in accessibility tree

### Parallel execution

You can send multiple tool calls in parallel, but maintain correct order: navigate → wait → snapshot → interact.

---

## Essential Tools

### Navigation
```javascript
// Navigate to URL
navigate_page({ url: "https://example.com" })

// Reload with options
navigate_page({ type: "reload", ignoreCache: true })

// Create new page
new_page({ url: "https://example.com" })

// List all pages
list_pages()

// Select active page
select_page({ pageIndex: 1 })
```

### Snapshot & Interaction
```javascript
// Get accessibility tree with element UIDs
take_snapshot()

// Click element
click({ uid: "1_5" })

// Fill input
fill({ uid: "1_3", text: "hello@example.com" })

// Type text
type_text({ text: "hello" })

// Press key
press_key({ key: "Enter" })

// Hover
hover({ uid: "1_7" })
```

### Screenshot
```javascript
// Viewport screenshot
take_screenshot()

// Full page screenshot
take_screenshot({ fullPage: true })

// Element screenshot
take_screenshot({ uid: "1_5", filePath: "element.png" })
```

### Network
```javascript
// List network requests
list_network_requests({ resourceTypes: ["Image", "Fetch"] })

// Get request details
get_network_request({ requestId: "1234" })
```

### Performance
```javascript
// Start trace (with page reload)
performance_start_trace({ reload: true, autoStop: true })

// Analyze insights
performance_analyze_insight({ insightSetId: "abc", insightName: "LCPBreakdown" })

// Stop and save trace
performance_stop_trace({ filePath: "./trace.json" })
```

### Memory
```javascript
// Take heap snapshot
take_memory_snapshot({ filePath: "./snap.heapsnapshot" })
```

### Console & Debugging
```javascript
// List console messages
list_console_messages({ types: ["error", "warn"] })

// Evaluate JavaScript
evaluate_script({ expression: "document.title" })

// Run Lighthouse audit
lighthouse_audit({ mode: "navigation", outputDirPath: "/tmp/lh-report" })
```

---

## Specialized Workflows

### Accessibility Debugging

See [references/a11y-snippets.md](references/a11y-snippets.md) for evaluation snippets.

1. **Automated Audit (Lighthouse)**
   - Run: `lighthouse_audit({ mode: "navigation", outputDirPath: "/tmp/lh-report" })`
   - Check `scores` (0-1 scale). Score < 1 indicates violations
   - Parse failures: `node -e "const r=require('./report.json'); Object.values(r.audits).filter(a=>a.score!==null && a.score<1).forEach(a=>console.log(JSON.stringify({id:a.id, title:a.title, items:a.details?.items})))"`

2. **Browser Issues**: `list_console_messages({ types: ["issue"], includePreservedMessages: true })`

3. **Semantics**: Use `take_snapshot` to check heading levels and content order

4. **Forms & Labels**: Ensure interactive elements have accessible names

5. **Focus & Keyboard**: Use `press_key({ key: "Tab" })` and verify focus in snapshot

6. **Tap Targets**: Use evaluate_script with "Measure Tap Target Size" snippet

7. **Color Contrast**: Check `list_console_messages` for "Low Contrast" issues

### LCP Optimization

See [references/lcp-snippets.md](references/lcp-snippets.md) for evaluation snippets.

LCP Subparts (sequential, no gaps):
| Subpart | Ideal % | What it measures |
|---------|---------|------------------|
| TTFB | ~40% | Navigation start → first byte received |
| Resource load delay | <10% | TTFB → browser starts loading LCP resource |
| Resource load duration | ~40% | Time to download LCP resource |
| Element render delay | <10% | LCP resource downloaded → element rendered |

**Debugging Workflow**:
1. `navigate_page` to target URL
2. `performance_start_trace({ reload: true, autoStop: true })`
3. `performance_analyze_insight` with insight names: `LCPBreakdown`, `DocumentLatency`, `RenderBlocking`, `LCPDiscovery`
4. Use "Identify LCP Element" snippet from references
5. Check `list_network_requests` filtered by LCP resource type

**Optimization Priorities**:
1. Eliminate resource load delay (<10%) - use `<img>` with `src`, not `data-src` or `loading="lazy"`
2. Eliminate element render delay (<10%) - inline critical CSS, defer non-critical
3. Reduce resource load duration (~40%) - use WebP/AVIF, CDN, cache headers
4. Reduce TTFB (~40%) - minimize redirects, CDN cache, bfcache

### Memory Leak Diagnosis

See [references/memlab.md](references/memlab.md) and [references/common-leaks.md](references/common-leaks.md).

**Core Principles**:
- **Prefer `memlab`**: Do NOT read raw `.heapsnapshot` files directly
- **Isolate**: Determine if leak is browser (client) or Node.js (server)
- **Common culprits**: Detached DOM nodes, unhandled closures, global variables, event listeners not removed, unbounded caches

**Workflow**:
1. Use tools to manipulate page into desired state
2. Repeat interactions 10 times to amplify leak
3. Take snapshots at baseline, target, and final states using `take_memory_snapshot`
4. Use `memlab` to analyze: see [references/memlab.md](references/memlab.md)
5. Fallback: `node compare_snapshots.js <baseline.heapsnapshot> <target.heapsnapshot>`

---

## CLI Tool (Alternative)

The `chrome-devtools` CLI can also be used directly:

```bash
chrome-devtools take_snapshot              # Take a text snapshot
chrome-devtools click "uid"                # Click element
chrome-devtools fill "uid" "text"          # Fill input
chrome-devtools navigate_page --url "url"  # Navigate
chrome-devtools take_screenshot            # Screenshot
chrome-devtools performance_start_trace true false  # Start trace
chrome-devtools lighthouse_audit --mode "navigation"  # Lighthouse
```

See [references/installation.md](references/installation.md) for CLI setup.

---

## Troubleshooting

When tools fail (especially `list_pages`, `new_page`, `navigate_page`):

1. **Check configuration**: Look for `.mcp.json`, `gemini-extension.json`, or MCP config files
2. **Common errors**:
   - `Could not find DevToolsActivePort` → Chrome not running with remote debugging enabled. Open `chrome://inspect/#remote-debugging` and enable debugging
   - Missing tools (only 9 available) → MCP client in read-only mode (exit "Plan Mode" or adjust tool safety settings)
   - `Target closed` or protocol errors → Check sandboxing issues
3. **Run diagnostic**: `npx chrome-devtools-mcp@latest --help`
4. **Verbose logs**: `DEBUG=* npx chrome-devtools-mcp@latest --logFile=/tmp/cdm-test.log`
5. **Check GitHub issues**: `gh issue list --repo ChromeDevTools/chrome-devtools-mcp --search "<error>"`

See [references/troubleshooting.md](references/troubleshooting.md) for detailed fixes.

---

## Deep-Dive References

| Reference | Purpose |
|-----------|---------|
| [references/tool-reference.md](references/tool-reference.md) | Complete tool reference with all options |
| [references/slim-tool-reference.md](references/slim-tool-reference.md) | Slim mode tool reference |
| [references/troubleshooting.md](references/troubleshooting.md) | Detailed troubleshooting guide |
| [references/a11y-snippets.md](references/a11y-snippets.md) | Accessibility evaluation snippets |
| [references/lcp-snippets.md](references/lcp-snippets.md) | LCP debugging snippets |
| [references/lcp-breakdown.md](references/lcp-breakdown.md) | LCP subparts deep dive |
| [references/optimization-strategies.md](references/optimization-strategies.md) | Optimization strategies |
| [references/elements-and-size.md](references/elements-and-size.md) | Element measurement |
| [references/memlab.md](references/memlab.md) | Memory leak analysis with memlab |
| [references/common-leaks.md](references/common-leaks.md) | Common memory leak patterns |
| [references/installation.md](references/installation.md) | CLI installation guide |
