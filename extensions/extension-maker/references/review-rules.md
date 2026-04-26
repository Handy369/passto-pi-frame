# Dynamic Review Protocol

在执行 Step 6 (生成审计) 时，**禁止使用预先写死的穷举错误清单** 直接审查代码。

必须遵循以下动态审查流程：

## 1. 先动态读取官方约束
在 Review 前，先调用：
- `ext_maker_read_docs(topic="extensions")`
- `ext_maker_read_docs(topic="tui")`

目标不是复述文档，而是从当前官方文档中提炼出：
- 本次生成目标实际涉及了哪些 Pi Extension 能力
- 这些能力对应的当前官方调用方式、边界和返回值约束
- 本次实现应该采用的"实现方法"

## 2. 基于实现方法生成本次 Review 标准
Review 标准必须根据以下四类输入动态生成：
- `extension-generator-spec.json`
- `implementation-method.json`
- 生成出的 `index.ts` / `SKILL.md` / `references/`
- 当前官方 `extensions.md` / `tui.md`

Review 关注点应来自"本次实现方法"，而不是预设死规则。
例如：
- 如果本次实现使用了 `ctx.ui.select()`，则必须从当前 docs 推导它的签名、返回值处理、选项结构，再审查实现是否一致
- 如果本次实现使用了 `ctx.ui.input()`，则必须从当前 docs 推导它的参数方式，再审查是否错误假设了默认值或额外参数
- 如果本次实现使用了 `ctx.ui.confirm()`，则必须从当前 docs 推导其返回值类型，再审查条件逻辑是否正确消费该返回值
- 如果本次实现使用了 `ctx.ui.editor()`，则必须从当前 docs 推导其参数语义，再审查是否错误使用了预填内容或其他扩展参数
- 如果本次实现用了状态机，则审查状态读写路径、推进逻辑、恢复逻辑是否与 spec 一致
- 如果本次实现用了 command-first isolation，则审查命令入口、工具命名、上下文隔离是否闭环

## 3. 需求类别感知审查 (Category-Aware Review)

**在开始具体 API 审查之前，必须先执行类别一致性检查：**

1. 从 spec 中读取 `requirementCategory` 和 `mandatoryBehaviors`
2. 从 `implementation-method.json` 中读取对应的编排/循环/知识模型设计
3. 审查 `index.ts` 是否实现了这些结构

### 降级实现检测 (Downgraded Implementation Detection)

以下情况 **必须** 判定为 `verdict: "fail"` 并记录为 `criticalIssue`：

| 检测项 | 触发条件 | criticalIssue 标题 |
|--------|----------|-------------------|
| `CATEGORY_MISMATCH` | spec 的 `requirementCategory` 要求的结构元素在代码中完全不存在 | `Spec 要求 {category} 类别，但实现缺少核心结构` |
| `MISSING_ORCHESTRATOR` | `recursive-research-engine` 或 `multi-agent-orchestrator` 类别，但代码中没有主循环/编排函数 | `缺少主编排循环：{category} 需求必须有循环/编排逻辑` |
| `MISSING_TERMINATION` | spec 定义了 `terminationCriteria`，但代码中没有相应的终止/充分性判断逻辑 | `缺少终止逻辑：需求要求 {terminationCriteria} 但未实现` |
| `MISSING_KNOWLEDGE_MODEL` | `recursive-research-engine` 类别，但代码中没有知识积累结构（知识池、缺口追踪等） | `缺少知识模型：递归研究引擎必须有跨轮次知识积累` |
| `SINGLE_STEP_DOWNGRADE` | spec 描述多轮/多步系统，但实现是单次函数调用（无循环、无状态机） | `降级实现：Spec 要求多轮系统但实现为单步调用` |
| `BEHAVIOR_MISSING` | spec 的 `mandatoryBehaviors` 中任一条未在代码中实现 | `缺失行为：{behavior} 在 mandatoryBehaviors 中但未实现` |
| `WRONG_COMPLEXITY` | spec 的 `complexityTier` 为 `system` 但实现复杂度明显低于此级别 | `复杂度不匹配：Spec 要求 {tier} 但实现过于简单` |

### 审查顺序（必须遵守）
1. **第一步：类别一致性检查** — 检查 spec 的需求类别与实现结构是否匹配
2. **第二步：降级实现检测** — 检查是否将系统需求降级为简单工具
3. **第三步：行为覆盖检查** — 检查 `mandatoryBehaviors` 是否全部实现
4. **第四步：API 签名审查** — 检查 API 调用是否与 docs 一致
5. **第五步：状态/隔离/边界审查** — 检查状态机、工具命名、命令边界

**注意**: 如果第一、二、三步中有任何 fail，**不必继续进行第四、五步**，直接判定 `verdict: "fail"`。API 签名正确不能弥补行为缺失。

## 4. 必须使用隔离子进程执行审查
Review 阶段必须通过 `ext_maker_review_with_subagent` 直接启动共享 runtime 驱动的独立 `pi` 子进程执行审查，默认：
- `agent: "reviewer"`
- `sessionMode: "spawn"`
- 给子进程完整输入：spec、implementation-method.json、目标文件路径、官方 docs 要点、审查目标

其中 `agent: "reviewer"` 对应：
- `passto-agent-runtime/agents/reviewer.md`
- 用途：为隔离审查提供稳定的 system prompt、默认 model / thinking、只读工具白名单，以及 strict JSON 倾向输出

### 当前实现要求（重要）
- 当前实现不再依赖主 agent 额外调用 `subagent` tool，也不再使用 request + steer + gate 诱导执行。
- `ext_maker_review_with_subagent` 必须在 tool 内部完成：
  1. 组装 review prompt
  2. 调用共享 runtime 启动独立 `pi` 子进程
  3. 捕获 JSON 输出
  4. 自动写入 `review.json`
- 交付前必须同时校验：
  - `reviewExecuted`
  - `review.json` 存在且可解析
  - `review.json` 具有最小 schema
  - `reviewedBySubagent === true`
  - `subagentMode === "spawn"`
  - `verdict === "pass"`
- 若 `verdict !== "pass"`，不得停留在模糊的"请手动修复"状态；必须调用 `ext_maker_apply_review_feedback`，根据 `review.json` 将流程回退到 Step 4（代码）或 Step 5（文档），修复后重新执行 Step 6。

目的：
- 让 Review 与主生成上下文隔离
- 避免主代理一边生成一边自我背书
- 让审查标准在独立上下文中重新推导

## 5. review.json 必须是"推导结果"而不是"静态打勾表"
`review.json` 至少应包含：
- `derivedImplementationModel`: 本次从官方 docs + spec 推导出的实现方法摘要，且应明确包含所用 UI API（select/input/confirm/editor）的签名理解与返回值理解
- `implementationContractCheck`: 对 `implementation-method.json` 与官方 docs/spec 的一致性判断
- `categoryConsistencyCheck`: 对 spec 需求类别与实现结构一致性的判断（新增）
  - `expectedCategory`: spec 中的 requirementCategory
  - `hasOrchestratorLoop`: 代码是否有主循环/编排函数
  - `hasTerminationLogic`: 代码是否有终止/充分性判断
  - `hasKnowledgeModel`: 代码是否有知识积累结构
  - `behaviorCoverage`: mandatoryBehaviors 的实现覆盖率
  - `downgradeDetected`: 是否检测到降级实现
  - `consistent`: 总体是否一致
- `reviewedBySubagent`: 必须为 `true`，用于声明该 review 来自隔离 subagent 审查
- `subagentMode`: 必须明确记录本次审查使用的模式，推荐且默认应为 `spawn`
- `checks`: 本次基于实现方法动态生成的检查项
- `findings`: 每项检查的发现
- `criticalIssues`: 阻断交付的问题
- `suggestedFixes`: 修复建议
- `verdict`: pass / fail

## 6. 交付门槛
如果 review 发现：
- 实现方法与官方 docs 冲突
- 实现与 spec 不一致
- 关键状态机/交互/命令边界未闭环
- **需求类别要求的结构元素缺失（如：递归引擎缺少主循环）**
- **检测到降级实现（系统需求被实现为薄包装工具）**
- **mandatoryBehaviors 中有未实现的行为**

则必须阻止进入交付步骤。
