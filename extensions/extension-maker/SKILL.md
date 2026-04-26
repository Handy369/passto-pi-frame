---
name: extension-maker
description: 根据自然语言描述生成完整的 Pi Extension (TypeScript)。
---

# Extension Maker

这是一个用于生成 Pi Extension 的元工具（Meta-tool）。

## Workflow
1. **Intake & Analyze**: 使用黑盒协议分析目标，使用 ext_maker_choose_exposure 固定三选一 UI 明确选择暴露方式（仅命令 / 仅工具 / 两者并存），再用 ext_maker_question 补充需求。
   - 除暴露方式外，其他需求问题默认按“多选 + 支持多次自定义输入”处理，不应退化为单选。
2. **Spec Gen**: 生成 `extension-generator-spec.json`。
3. **Audit**: 校验 Spec 格式与逻辑。
4. **Code Gen**: 主 agent 先生成 `implementation-method.json`（实现契约），然后必须调用 `ext_maker_codegen_with_subagent`，通过 `passto-agent-runtime` 启动隔离 `coder` 子进程执行核心代码开发。当前实现中，`index.ts` 不应由主 agent 直接生成，而应由 coder subagent 在目标目录内按 Ralph-style 迭代方式完成。
   - Step 4 默认使用 `passto-agent-runtime/agents/coder.md`，即 `agent: "coder"`，作为隔离代码开发的默认 agent profile。
   - `coder` profile 的用途是：基于固定 spec + implementation-method 契约，在受限工具集 (`read` / `bash` / `edit` / `write`) 下完成核心代码实现，并记录验证证据。
   - 当前 Step 4 产物包括：`implementation-method.json`、由 coder subagent 生成的 `index.ts`，以及可选的 `codegen-run.json` / `.ralph/` 任务文件。
   - 若 Step 6 review 失败并回退到 Step 4，则必须使用 `review.json` 作为 repair context，再次调用 `ext_maker_codegen_with_subagent(..., reviewPath, repairMode=true)` 进行定向返工，而不是盲目重新生成代码。
5. **Docs Gen**: 生成 `SKILL.md` 和 `references/`。
6. **Review**: 先读取官方 docs，并以 `implementation-method.json` 为契约，调用 `ext_maker_review_with_subagent` 直接通过 `passto-agent-runtime` 启动独立 `pi` 子进程执行隔离审查，并自动生成结果 (`review.json`)。
   - Step 6 与 Step 4 共同构成闭环：`planner -> coder -> reviewer -> repair-coder -> reviewer -> ... -> pass`。
   - Step 6 默认使用 `passto-agent-runtime/agents/reviewer.md`，即 `agent: "reviewer"`，作为隔离审查的默认 agent profile。
   - `reviewer` profile 的用途是：为隔离审查提供稳定的 system prompt、默认 model / thinking、只读工具白名单，以及 strict JSON 倾向输出。
   - 当前实现不再依赖主 agent 额外调用 `subagent` tool，也不再使用 **request + steer + gate** 模式。
   - 交付前必须校验 `review.json` 的最小 schema、subagent provenance（`reviewedBySubagent=true`, `subagentMode=spawn`）以及 `verdict=pass`。
   - 若 `verdict != pass`，必须调用 `ext_maker_apply_review_feedback` 回退到正确修复步骤（通常 Step 4 或 Step 5），修复后重新执行 Step 6，直到 review 通过。
7. **Deliver**: 用户确认。

## Constraints
- 必须使用 `ext_maker_` 前缀的工具。
- 必须先明确暴露方式：`command-only` / `tool-only` / `both`。
- 生成的代码必须包含 **Command-First Isolation**。
- 生成的代码必须使用 **外部状态文件** (`.state.json`)。
- 严格遵循 `references/codegen-mapping.md` 进行代码映射。
- **设计前必须执行黑盒分析** (references/black-box-design-protocol.md)。

## Regression
- 仓库内最小正式回归脚本位于：`references/regression/run-minimal-subagent-regression.mjs`
- 说明文档位于：`references/regression/README.md`
- 该脚本用于验证最小闭环：`coder -> reviewer(fail) -> repair-coder -> reviewer(pass)`
- 默认输出目录：`/tmp/extension-maker-regression/todo-mini`
- 运行方式：
  ```bash
  cd /Users/handy/dev/pi
  node ./extensions/extension-maker/references/regression/run-minimal-subagent-regression.mjs
  ```