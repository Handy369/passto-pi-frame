# browser-runtime-observation

Pi extension：把“浏览器运行态观察”落成一个**高层异步编排器**。

当前版本提供：

- `browser_runtime_capability_status`
  - 检查当前 Pi runtime 是否检测到 Chrome DevTools 兼容低层工具
- `browser_runtime_observe`
  - 创建高层 observation request
  - 检测 runtime readiness
  - 通过 `pi.sendMessage(..., { deliverAs: "steer" })` 向后续 LLM 回合注入执行指令
  - 监听 Chrome DevTools 兼容低层工具的 `tool_result`
  - 规范化落盘 request / result / evidence artifact
  - 在 artifact 中输出 mode-specific `recommendedToolCalls`、`normalizedEvidence`、`verdict`
- `/browser-observe-status`
  - 人工查看当前 runtime readiness 与 active request

## 运行机制

Pi extension 当前没有官方“在扩展内部直接同步调用其它工具/MCP 工具”的 API。

因此本 extension 采用**官方 API 可支持的异步编排方式**：

1. 高层工具 `browser_runtime_observe` 创建 request
2. extension 检查当前 runtime 是否存在 Chrome DevTools 兼容低层工具
3. 若存在，则发出 steering message，引导后续 LLM 回合调用低层工具
4. extension 通过 `tool_result` 监听低层结果并归档为 evidence
5. 在 `agent_end` 收口并 finalize `result.json` 与 `verdict.json`

## 真实 `chrome-devtools-mcp` 兼容策略

当前兼容层不再只依赖 `chrome-devtools` 字符串模糊匹配，而是同时支持：

1. MCP server 前缀 / server hint
   - `mcp__chrome-devtools-mcp`
   - `chrome-devtools-mcp`
   - `chrome-devtools`

2. 真实风格的 MCP 工具名
   - `mcp__chrome-devtools-mcp__navigate_page`
   - `mcp__chrome-devtools-mcp__take_snapshot`
   - `mcp__chrome-devtools-mcp__list_console_messages`
   - `mcp__chrome-devtools-mcp__list_network_requests`
   - `mcp__chrome-devtools-mcp__lighthouse_audit`
   - `mcp__chrome-devtools-mcp__evaluate_script`
   - `mcp__chrome-devtools-mcp__performance_start_trace`
   - `mcp__chrome-devtools-mcp__take_memory_snapshot`
   - 以及其它核心 DevTools 工具族

3. 裸工具名兼容
   - `navigate_page`
   - `take_snapshot`
   - `list_console_messages`
   - `list_network_requests`
   - `lighthouse_audit`
   - `evaluate_script`
   - `performance_start_trace`
   - `take_memory_snapshot`
   - 等

## Mode-specific 参数模板与 evidence extractor

### `recommendedToolCalls`
每个 request 在 `request.json` 与 `result.json` 中都会附带 mode-specific 参数模板。

当前覆盖：
- `dom`
- `console-network`
- `lighthouse`
- `accessibility`
- `performance`
- `memory`

### `normalizedEvidence`
每个 result 会输出 mode-specific evidence extractor 的归一化结果，用于后续 review / automation。

当前已支持：
- `dom`
  - `title`
  - `url`
  - `headingCount`
  - `hasMain`
  - `snapshotCaptured`
- `console-network`
  - `consoleErrors`
  - `consoleWarnings`
  - `consoleIssues`
  - `successfulRequests`
  - `failedRequests`
- `lighthouse`
  - `accessibility`
  - `seo`
  - `bestPractices`
- `accessibility`
  - `accessibility`
  - `landmarkCount`
  - `lang`
  - `snapshotCaptured`
  - `evaluateScriptUsed`
- `performance`
  - `traceCaptured`
  - `lcpMs`
  - `cls`
  - `inpMs`
  - `totalBlockingTimeMs`
  - `failedRequests`
- `memory`
  - `snapshotCaptured`
  - `heapNodes`
  - `retainedSizeMb`

## Budget verdict / pass-fail gate

当前已实现统一 budget verdict：

- `result.json.verdict`
- 独立 `verdict.json`

状态枚举：
- `PENDING`
- `PASS`
- `FAIL`
- `NOT_EVALUATED`

当前支持的 budget 字段：
- `maxConsoleErrors`
- `maxConsoleWarnings`
- `maxConsoleIssues`
- `maxFailedRequests`
- `minAccessibilityScore`
- `minSeoScore`
- `minBestPracticesScore`
- `maxLcpMs`
- `maxCls`
- `maxInpMs`
- `maxTotalBlockingTimeMs`
- `maxRetainedSizeMb`
- `lighthousePerformanceMin`
  - 当前会以 `SKIP` 输出，因为 `chrome-devtools-mcp` 的 `lighthouse_audit` 本身不返回 performance 分数；建议改用 `maxLcpMs / maxCls / maxInpMs`

## 当前已完成

- 高层工具 contract
- runtime capability detection
- request / result / evidence / verdict artifact 落盘
- 异步 orchestration adapter
- 真实 `chrome-devtools-mcp` 风格工具名兼容
- mode-specific steering
- mode-specific `recommendedToolCalls`
- mode-specific `normalizedEvidence` extractor
- budget verdict / pass-fail gate
- mock-compatible smoke / regression test

## 当前边界

这个版本已经不是“静态脚手架”，但它也**不是**“在 extension 内部直调 DevTools MCP 原语”的同步执行器。

它当前依赖：
- 当前 Pi runtime 中存在某个 **Chrome DevTools 兼容低层工具**
- 后续 LLM 回合遵循 steering 去实际调用该低层工具
- 最终效果仍受当前模型是否按建议顺序调用低层工具影响

## 验证与回归

### 直接运行 smoke

```bash
./extensions/browser-runtime-observation/scripts/smoke.sh
```

### 根项目回归入口

```bash
npm run test:browser-runtime-observation
```

### extension 本地回归入口

```bash
npm --prefix ./extensions/browser-runtime-observation run test
```

当前 smoke / regression 已覆盖：
- blocked 路径：无低层工具时正确报阻塞
- ready path + `dom`
- ready path + `console-network`
- ready path + `lighthouse`
- ready path + `accessibility`
- ready path + `performance`
- ready path + `memory`
- budget pass verdict
- budget fail verdict

## 当前相关文件

- `extensions/browser-runtime-observation/index.ts`
- `extensions/browser-runtime-observation/mode-evidence.ts`
- `extensions/browser-runtime-observation/budget-verdict.ts`
- `extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts`
- `extensions/browser-runtime-observation/scripts/smoke.sh`

## 下一步

若继续增强，优先顺序建议是：

1. 在真实非 mock `chrome-devtools-mcp` 环境下做 smoke proof
2. 把 `verdict` 接到 CI gate / exit code 语义
3. 增加 mode-specific fail-summary 模板
4. 把低层兼容工具发现从命名兼容升级为更稳定的 metadata / contract
