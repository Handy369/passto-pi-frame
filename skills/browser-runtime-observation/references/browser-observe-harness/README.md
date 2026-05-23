# Browser Observe Harness

最小可运行 harness，放在 `browser-runtime-observation` skill 的 `references/` 下，作为真实非 mock 浏览器运行态证据采集器。

## Purpose

- 为 `browser_runtime_observe` 提供真实 `chrome-devtools-mcp` 兼容工具链恢复参考
- 提供本地 real smoke / contract check 的最小执行面
- 明确这不是公开 skill 入口，而是 `browser-runtime-observation` 的 reference/harness 资产

## Layout

```text
references/browser-observe-harness/
  package.json
  README.md
  scripts/
    real-smoke.mjs
    contract-check.mjs
  scenarios/
    public-homepage.json
    wikipedia-homepage.json
```

## Usage

From this directory:

```bash
npm run smoke:real
npm run smoke:real:all
npm run test:contract
```

Or directly:

```bash
node ./scripts/real-smoke.mjs --scenario ./scenarios/public-homepage.json
```

## Runtime assumptions

- `npx` 可用
- `chrome-devtools-mcp@latest` 可拉起
- 本机存在 Chrome，可按需通过 scenario.chrome.executablePath 指定
- 当前 harness 已实现最小真实执行链：启动 MCP server、列出 tools、调用 navigate/snapshot/console/network/lighthouse，并落地 `tools.json` / `calls/` / `summary.json` / `verdict.json`
- 仍然属于 `browser-runtime-observation` 的 reference/harness 资产，不替代 Pi extension 的公开调度层

