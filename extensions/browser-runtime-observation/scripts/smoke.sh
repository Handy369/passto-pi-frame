#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

OUT_DIR="$ROOT/.artifacts/browser-runtime-observation"
DOM_DIR="$OUT_DIR/cases/dom"
CN_DIR="$OUT_DIR/cases/console-network"
LH_DIR="$OUT_DIR/cases/lighthouse"
AX_DIR="$OUT_DIR/cases/accessibility"
PERF_DIR="$OUT_DIR/cases/performance"
MEM_DIR="$OUT_DIR/cases/memory"
BUDGET_PASS_DIR="$OUT_DIR/cases/budget-pass"
BUDGET_FAIL_DIR="$OUT_DIR/cases/budget-fail"
rm -rf "$OUT_DIR"

echo '== smoke 1: blocked path without low-level tool =='
BLOCKED_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -p '请调用 browser_runtime_capability_status 工具，并只返回 status 字段。')"
echo "$BLOCKED_OUTPUT"
[[ "$BLOCKED_OUTPUT" == *"blocked_missing_devtools_tool"* ]]

echo '== smoke 2: ready path with real-style chrome-devtools-mcp mock (dom) =='
READY_DOM_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com, mode=dom, artifactDir=.artifacts/browser-runtime-observation/cases/dom。若有后续步骤请继续执行直到观察完成，并优先使用真实风格的 chrome-devtools-mcp 工具名给出结论。')"
echo "$READY_DOM_OUTPUT"
[[ "$READY_DOM_OUTPUT" == *"Example Domain"* || "$READY_DOM_OUTPUT" == *"browser-runtime-observation"* ]]

if [[ ! -d "$DOM_DIR" ]]; then
  echo 'No artifact directory created after dom run' >&2
  exit 1
fi

echo "dom artifact dir: $DOM_DIR"
cat "$DOM_DIR/result.json"

grep -q '"executionAdapterWired": true' "$DOM_DIR/result.json"
grep -q '"status": "completed"' "$DOM_DIR/result.json"
grep -q 'mcp__chrome-devtools-mcp__take_snapshot' "$DOM_DIR/evidence.json"
grep -q 'Example Domain' "$DOM_DIR/evidence.json"

echo '== smoke 3: ready path with real-style chrome-devtools-mcp mock (console-network) =='
READY_CN_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com/api, mode=console-network, artifactDir=.artifacts/browser-runtime-observation/cases/console-network。若有后续步骤请继续执行直到观察完成，并优先使用 console 与 network 相关真实风格 chrome-devtools-mcp 工具。')"
echo "$READY_CN_OUTPUT"
[[ "$READY_CN_OUTPUT" == *"console"* || "$READY_CN_OUTPUT" == *"network"* || "$READY_CN_OUTPUT" == *"browser-runtime-observation"* ]]

if [[ ! -d "$CN_DIR" ]]; then
  echo 'No artifact directory created after console-network run' >&2
  exit 1
fi

cat "$CN_DIR/result.json"
grep -q '"status": "completed"' "$CN_DIR/result.json"
grep -q 'mcp__chrome-devtools-mcp__list_network_requests' "$CN_DIR/evidence.json"
grep -q 'successful document request' "$CN_DIR/evidence.json"

echo '== smoke 4: ready path with real-style chrome-devtools-mcp mock (lighthouse) =='
READY_LH_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com, mode=lighthouse, artifactDir=.artifacts/browser-runtime-observation/cases/lighthouse。若有后续步骤请继续执行直到观察完成，并优先使用 lighthouse_audit 工具。')"
echo "$READY_LH_OUTPUT"
[[ "$READY_LH_OUTPUT" == *"Lighthouse"* || "$READY_LH_OUTPUT" == *"accessibility"* || "$READY_LH_OUTPUT" == *"browser-runtime-observation"* ]]

if [[ ! -d "$LH_DIR" ]]; then
  echo 'No artifact directory created after lighthouse run' >&2
  exit 1
fi

grep -q 'mcp__chrome-devtools-mcp__lighthouse_audit' "$LH_DIR/evidence.json"
grep -q '"normalizedEvidence"' "$LH_DIR/result.json"
grep -q '"accessibility": 1' "$LH_DIR/result.json"

echo '== smoke 5: ready path with real-style chrome-devtools-mcp mock (accessibility) =='
READY_AX_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com, mode=accessibility, artifactDir=.artifacts/browser-runtime-observation/cases/accessibility。若有后续步骤请继续执行直到观察完成，并优先使用 take_snapshot、lighthouse_audit、evaluate_script。')"
echo "$READY_AX_OUTPUT"
[[ "$READY_AX_OUTPUT" == *"accessibility"* || "$READY_AX_OUTPUT" == *"browser-runtime-observation"* || "$READY_AX_OUTPUT" == *"lang"* ]]

if [[ ! -d "$AX_DIR" ]]; then
  echo 'No artifact directory created after accessibility run' >&2
  exit 1
fi

grep -q 'mcp__chrome-devtools-mcp__evaluate_script' "$AX_DIR/evidence.json"
grep -q '"mode": "accessibility"' "$AX_DIR/result.json"
grep -q '"landmarkCount"' "$AX_DIR/result.json"
grep -q '"lang": "en"' "$AX_DIR/result.json"

echo '== smoke 6: ready path with real-style chrome-devtools-mcp mock (performance) =='
READY_PERF_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com, mode=performance, artifactDir=.artifacts/browser-runtime-observation/cases/performance。若有后续步骤请继续执行直到观察完成，并优先使用 performance_start_trace，然后补最小 network 证据。')"
echo "$READY_PERF_OUTPUT"
[[ "$READY_PERF_OUTPUT" == *"performance"* || "$READY_PERF_OUTPUT" == *"LCP"* || "$READY_PERF_OUTPUT" == *"browser-runtime-observation"* ]]

if [[ ! -d "$PERF_DIR" ]]; then
  echo 'No artifact directory created after performance run' >&2
  exit 1
fi

grep -q 'mcp__chrome-devtools-mcp__performance_start_trace' "$PERF_DIR/evidence.json"
grep -q '"lcpMs": 1234' "$PERF_DIR/result.json"
grep -q '"traceCaptured": true' "$PERF_DIR/result.json"

echo '== smoke 7: ready path with real-style chrome-devtools-mcp mock (memory) =='
READY_MEM_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com, mode=memory, artifactDir=.artifacts/browser-runtime-observation/cases/memory。若有后续步骤请继续执行直到观察完成，并优先使用 take_memory_snapshot。')"
echo "$READY_MEM_OUTPUT"
[[ "$READY_MEM_OUTPUT" == *"memory"* || "$READY_MEM_OUTPUT" == *"heap"* || "$READY_MEM_OUTPUT" == *"browser-runtime-observation"* ]]

if [[ ! -d "$MEM_DIR" ]]; then
  echo 'No artifact directory created after memory run' >&2
  exit 1
fi

grep -q 'mcp__chrome-devtools-mcp__take_memory_snapshot' "$MEM_DIR/evidence.json"
grep -q '"heapNodes": 4096' "$MEM_DIR/result.json"
grep -q '"retainedSizeMb": 12.5' "$MEM_DIR/result.json"

echo '== smoke 8: budget pass verdict =='
READY_BUDGET_PASS_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com/api, mode=console-network, artifactDir=.artifacts/browser-runtime-observation/cases/budget-pass, budgets={maxConsoleErrors:0,maxFailedRequests:0}。若有后续步骤请继续执行直到观察完成，并确保输出最终结论。')"
echo "$READY_BUDGET_PASS_OUTPUT"
if [[ ! -d "$BUDGET_PASS_DIR" ]]; then
  echo 'No artifact directory created after budget-pass run' >&2
  exit 1
fi

grep -q '"status": "PASS"' "$BUDGET_PASS_DIR/verdict.json"
grep -q '"name": "console-errors"' "$BUDGET_PASS_DIR/verdict.json"
grep -q '"name": "failed-requests"' "$BUDGET_PASS_DIR/verdict.json"

echo '== smoke 9: budget fail verdict =='
READY_BUDGET_FAIL_OUTPUT="$(pi -e ./extensions/browser-runtime-observation -e ./extensions/browser-runtime-observation/tests/mock-chrome-devtools.ts -p '请调用 browser_runtime_observe 工具，参数为 target=https://example.com, mode=performance, artifactDir=.artifacts/browser-runtime-observation/cases/budget-fail, budgets={maxLcpMs:1000,maxFailedRequests:0}。若有后续步骤请继续执行直到观察完成，并确保输出最终结论。')"
echo "$READY_BUDGET_FAIL_OUTPUT"
if [[ ! -d "$BUDGET_FAIL_DIR" ]]; then
  echo 'No artifact directory created after budget-fail run' >&2
  exit 1
fi

grep -q '"status": "FAIL"' "$BUDGET_FAIL_DIR/verdict.json"
grep -q '"name": "lcp-ms"' "$BUDGET_FAIL_DIR/verdict.json"
grep -q '"status": "FAIL"' "$BUDGET_FAIL_DIR/result.json"

echo 'smoke passed'
