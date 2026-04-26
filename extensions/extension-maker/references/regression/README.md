# Extension Maker Regression

最小正式回归脚本，用于验证 `extension-maker` 的子进程闭环是否可运行：

- `coder` 首轮 codegen
- `reviewer` Round 1 fail
- `coder` repair round
- `reviewer` Round 2 pass

## 文件

- `run-minimal-subagent-regression.mjs`

## 运行方式

在仓库根目录执行：

```bash
cd /Users/handy/dev/pi
node ./extensions/extension-maker/references/regression/run-minimal-subagent-regression.mjs
```

可选环境变量：

```bash
cd /Users/handy/dev/pi
EXT_MAKER_REGRESSION_DIR=/tmp/my-ext-maker-regression \
node ./extensions/extension-maker/references/regression/run-minimal-subagent-regression.mjs
```

默认输出目录：

```text
/tmp/extension-maker-regression/todo-mini
```

## 主要产物

- `extension-generator-spec.json`
- `implementation-method.json`
- `index.ts`
- `codegen-run.json`
- `codegen-run-repair.json`
- `review-round1.json`
- `review-round2.json`
- `review.json`
- `regression-summary.json`

## 通过标准

`regression-summary.json` 中至少应满足：

- `verdictFailRound1 = true`
- `verdictPassRound2 = true`
- `reviewedBySubagentRound1 = true`
- `reviewedBySubagentRound2 = true`
- `subagentModeSpawnRound1 = true`

## 说明

该脚本会故意将首轮生成结果中的 `mark_done` 精准改名为 `mark_done_broken`，用于稳定触发一次 review fail，随后再通过 repair round 修复并验证二轮 review pass。
