# control loop contract（草案）

日期：2026-05-21
状态：draft
目的：为 passto-desk 的运行时闭环提供统一 contract，明确 parse / validate / persist / inject / next-round decision 的职责、输入输出和状态更新规则，避免系统再次退化为单次生成思维。

---

## 1. 核心目标

passto-desk 的可靠性不应主要依赖：
- 单次 prompt 输出质量
- 更长的规则清单
- 更多禁忌或评分项

而应依赖一个明确的控制回路：

```text
state -> context assembly -> LLM reasoning -> structured result
-> parse -> validate -> persist -> inject -> next round
```

本 contract 的目标，是把这条回路从概念变成可执行的运行时约束。

---

## 2. 闭环定义

建议将 passto-desk 的 control loop 定义为以下 8 个阶段：

1. state ready
2. context assembly
3. LLM reasoning
4. structured result
5. parse
6. validate
7. persist
8. inject + decide next round

其中：
- 前 1~4 步更接近 execution flow
- 后 5~8 步更接近 control flow

这一区分很重要，因为：
- 画图 / 回译本身不等于系统完成
- 只有结果被 parse / validate / persist / inject 后，系统状态才真正推进

---

## 3. 各阶段 contract

## 3.1 state ready

### 输入
- `SharedSemanticState`
- 当前 truth sources
- 当前 transform direction
- 当前 round goal

### 要求
- 当前状态至少满足本轮 transform 的最小前提
- 必须知道当前是 `forward` 还是 `reverse`
- 必须知道当前模式是 `explain-first` 还是 `workbench`

### 输出
- `stateSnapshot`
- `preconditionsStatus`

### 失败信号
- 缺少最小 semantic state
- 缺少 transform direction
- truth source 不清楚

### 失败后动作
- stop
- 或请求补状态 / 补上下文

---

## 3.2 context assembly

### 输入
- `stateSnapshot`
- 用户输入
- 当前 scene / domain file / history
- 当前 method constraints
- 当前 control constraints

### 要求
- 上下文不是简单文本拼接
- 必须显式组装：
  - `Information`
  - `Method`
  - `Control`

### 输出

```text
ContextRuntime = {
  information,
  method,
  control
}
```

### 失败信号
- 组装后无法说明当前轮真正目标
- information 与 method 冲突
- control 缺失，导致无法判断结果如何进入下一轮

### 失败后动作
- stop
- 或重新组装 context

---

## 3.3 LLM reasoning

### 输入
- `ContextRuntime`

### 要求
- LLM 此时不是“自由回答”，而是执行受约束推理
- 当前推理必须指向结构化结果，而不是开放 prose

### 输出
- `rawStructuredResult`

### 允许产出
至少应支持：
- semantic updates
- relation updates
- view decisions
- mapping decisions
- visual decisions
- warnings / ambiguities
- next-step hints

### 失败信号
- 输出不可结构化解析
- 输出只有 prose，没有状态更新意义
- 输出与当前 mode / transform direction 冲突

### 失败后动作
- retry reasoning
- 或降级目标

---

## 3.4 structured result

这是 reasoning 阶段的直接产物，但此时还不能直接更新系统状态。

### 要求
- 结果必须可 parse
- 必须显式区分：
  - state update
  - scene/view proposal
  - warnings
  - unresolved ambiguities
  - next-step hints

### 输出
- `candidateResult`

### 注意
在这个阶段，结果仍是“候选结果”，不是系统真相。

---

## 3.5 parse

### 输入
- `candidateResult`
- 当前 `SharedSemanticState`

### 要求
- 把候选结果解析成稳定结构
- 明确哪些部分能进入 state
- 哪些部分是 warning / ambiguity / fallback note

### 输出

```text
ParsedResult = {
  stateDelta,
  sceneDelta?,
  validationInput,
  warnings,
  ambiguities,
  parseErrors?
}
```

### 必须检查
- 字段形状是否成立
- object / relation 引用是否可解析
- visible ids / mapping ids 是否指向有效对象
- label ownership / bindings 是否有基本一致性

### 失败信号
- 结构不可解析
- 引用断裂
- 输出对象和关系无法落回 shared state shape

### 失败后动作
- retry parse-compatible generation
- 或 stop 并记录 parse failure

---

## 3.6 validate

### 输入
- `ParsedResult`
- 当前 `SharedSemanticState`
- 当前 mode / transform direction / round goal

### 要求
validate 不是只检查格式，而是检查：
- 这轮结果是否真的推进了当前目标
- semantic / view / mapping / control 是否一致
- 是否可以安全进入 persist

### 输出

```text
ValidationResult = {
  status: "pass" | "soft-fail" | "hard-fail",
  findings: ValidationFinding[],
  confidence?: ConfidenceState,
  recommendedAction: "persist" | "retry" | "local-rebuild" | "full-rebuild" | "human-review" | "stop"
}
```

### validate 最少检查项

#### semantic consistency
- object / relation 是否成形
- 是否出现明显冲突

#### view consistency
- 当前 visible objects / relations 是否与本轮目标匹配
- primary path 是否成立

#### mapping consistency
- objectToNode / relationToEdge 是否断裂
- label ownership 是否失真

#### mechanism consistency
- explain-first 下，主干是否仍满足 mechanism-first
- workbench 下，结构是否足够可回读

#### control consistency
- 当前轮结果是否足以支持下一轮
- nextRoundHint / validationStatus 是否可生成

### 失败等级

#### soft-fail
表示：
- 当前结果有问题，但仍可通过 retry / local rebuild 修复

#### hard-fail
表示：
- 当前结果不应进入 persist
- 需要 stop / full rebuild / human review

---

## 3.7 persist

### 输入
- `ParsedResult`
- `ValidationResult(status=pass or acceptable soft-fail)`
- 当前 `SharedSemanticState`

### 要求
persist 的目标不是“存一切”，而是明确：
- 哪些更新进入 shared state
- 哪些更新进入 domain JSON
- 哪些更新进入 scene / .excalidraw
- 哪些只保留为控制元数据

### 输出

```text
PersistResult = {
  updatedState,
  persistedArtifacts,
  persistenceWarnings?
}
```

### 最低持久化范围
至少应明确：
- semantic 是否已更新
- control 是否已更新
- persistence metadata 是否已更新

scene / visual 是否立即写回，可以按 mode 与推荐动作决定。

### 失败信号
- validate 未通过却仍尝试写回
- 写回目标不明确
- semantic state 与 scene 更新不一致

### 失败后动作
- stop persist
- 记录 persistence failure
- 进入 retry / rebuild / human review decision

---

## 3.8 inject + decide next round

### 输入
- `PersistResult`
- `ValidationResult`
- 当前 `control`
- 当前 `persistence`

### 要求
这一步负责：
- 生成下一轮应继承的状态摘要
- 决定系统是否继续推进
- 决定下一轮 transform / mode / strategy 是否切换

### 输出

```text
NextRoundDecision = {
  action: "stop" | "continue" | "retry" | "local-rebuild" | "full-rebuild" | "human-review",
  injectionPayload,
  nextRoundHint?,
  carryForwardStateKeys?: string[]
}
```

### 典型动作

#### `stop`
- 当前目标已完成
- 或当前轮不应继续自动推进

#### `continue`
- 当前状态已足以进入下一轮正常推进

#### `retry`
- 本轮结果接近可用，但需轻量重试

#### `local-rebuild`
- 局部结构或视图需要重建

#### `full-rebuild`
- 当前路径已失稳，不宜继续 patch

#### `human-review`
- 当前冲突、不确定性或风险超出自动推进阈值

### 关键要求
- 下一轮注入不应只保留“上一轮原始文本”
- 应显式注入 semantic / control / persistence 的关键状态

---

## 4. 各阶段与 shared semantic state 的读写关系

## 4.1 主要读取

### state ready / context assembly
重点读取：
- `semantic`
- `view`
- `control`
- `persistence.truthSources`

### parse / validate
重点读取：
- `semantic`
- `view`
- `mapping`
- `visual`
- `control`

### persist / inject
重点读取并更新：
- `semantic`
- `control`
- `persistence`
- 视情况更新 `view` / `mapping` / `visual`

---

## 5. mode 与 control loop 的关系

## 5.1 Explain-first
在 control loop 中更强调：
- semantic 最小稳定表达
- 主干可读性
- 主干 mechanism-first
- 首轮不追求全量结构显式化

因此：
- validate 更关注主干是否讲清、画稳
- persist 可以允许部分 mapping / visual 延后补足

## 5.2 Workbench
在 control loop 中更强调：
- semantic / view / mapping / visual 一致性
- 持久化可回读
- 后续迭代稳定性

因此：
- validate 更关注结构完整性与回读性
- persist 更应优先写回 domain + control metadata

---

## 6. control loop 的最小失败策略

建议至少定义以下失败分类：

### parse failure
- 输出不可解析
- 先 retry generation / parse-compatible output

### validation soft-fail
- 结果部分成立，但不稳
- 进入 retry / local rebuild

### validation hard-fail
- 结果不应 persist
- 进入 full rebuild / stop / human review

### persistence failure
- 写回失败或不一致
- 不应继续 inject next round

### injection failure
- 下一轮无法稳定继承状态
- 应 stop 并请求人工确认或回退

---

## 7. 最小 contract 总结

如果只保留最小控制闭环要求，至少应成立：

1. 当前轮必须明确 `transformDirection`
2. 当前轮必须组装 `ContextRuntime = Information + Method + Control`
3. LLM 输出必须是可 parse 的 structured result
4. parse 后必须形成 `stateDelta + warnings + ambiguities`
5. validate 必须返回 `status + recommendedAction`
6. persist 只在 validate 允许时发生
7. inject 必须注入更新后的 state，而不是只注入原文本
8. 每一轮都必须明确 next round action

---

## 8. 当前实现状态（scripts 对齐）

截至当前 `scripts/*` 最小 runtime 实现，control loop 已有一条可执行骨架，主要 helper 位于：

- `scripts/runtime-contracts.mjs`

当前已落地的最小闭环函数：

### `buildSharedStateSnapshot(options)`
把 `TransformOutput` 桥接为最小 `SharedSemanticState` snapshot。

### `mergeSharedStateSnapshot(baseState, nextSnapshot)`
把上一轮 state 与本轮 snapshot 合并，形成跨轮演化基础。

### `buildValidationResult(options)`
基于 `transformOutput` / `mergedState` 生成最小 `ValidationResult`。

### `buildNextRoundDecision(options)`
基于 `validationResult` / `transformOutput` / `mergedState` 生成最小 `NextRoundDecision`。

### `commitTransformResult(options)`
这是当前最接近控制回路提交点的统一 helper，内部顺序为：

```text
validateTransformOutput
  -> buildSharedStateSnapshot
  -> validateSharedSemanticState(nextSnapshot)
  -> mergeSharedStateSnapshot
  -> validateSharedSemanticState(mergedState)
  -> buildValidationResult
  -> validateValidationResult
  -> buildNextRoundDecision
  -> validateNextRoundDecision
```

其成功返回最小结构：

```json
{
  "ok": true,
  "stage": "committed",
  "nextSnapshot": {},
  "mergedState": {},
  "validationResult": {},
  "nextRoundDecision": {},
  "validations": {
    "transformOutput": { "ok": true, "errors": [] },
    "nextSnapshot": { "ok": true, "errors": [] },
    "mergedState": { "ok": true, "errors": [] },
    "validationResult": { "ok": true, "errors": [] },
    "nextRoundDecision": { "ok": true, "errors": [] }
  }
}
```

失败时会在不同阶段提前返回：
- `transform-output`
- `shared-state-snapshot`
- `merged-state`
- `validation-result`
- `next-round-decision`

这意味着本文件第 3.5 ~ 3.8 节描述的 parse / validate / persist / inject + decide-next-round，已经开始在脚本层形成第一版可执行闭环，虽然当前仍是最小实现，而非完整 orchestrator。

---

## 9. 最小 runtime 验证入口

当前最小 runtime 闭环的标准验证入口已接入 `package.json`：

```bash
npm run runtime:smoke
```

它会顺序执行：

1. `npm run runtime:smoke:merge`
2. `npm run runtime:smoke:commit`
3. `npm run runtime:smoke:reverse`
4. `npm run runtime:smoke:forward`

### 各命令含义

#### `runtime:smoke:merge`
验证：
- `mergeSharedStateSnapshot(...)`
- merge 后的 shared state 仍通过最小 contract 校验

#### `runtime:smoke:commit`
验证：
- `commitTransformResult(...)`
- `nextSnapshot`
- `mergedState`
- `validationResult`
- `nextRoundDecision`

#### `runtime:smoke:reverse`
验证真实 reverse transform 脚本：
- `scripts/excalidraw-to-domain-json.mjs`
- 是否成功走通 `commitTransformResult(...)`
- 是否成功写出 domain JSON runtime metadata

输出文件：
- `/tmp/passto-runtime-reverse.domain.json`

#### `runtime:smoke:forward`
验证真实 forward transform 脚本：
- `scripts/domain-json-to-excalidraw.mjs`
- 是否成功走通 `commitTransformResult(...)`
- 是否成功写出 scene `customData.runtime` metadata

输出文件：
- `/tmp/passto-runtime-forward.excalidraw`

### 何时运行
建议在以下情况至少运行一次：
- 修改 `scripts/runtime-contracts.mjs`
- 修改 forward / reverse transform 脚本
- 修改 runtime minimal JSON shape
- 调整 validation / next-round decision 规则

这样可以确保最小 runtime 闭环没有被后续改动破坏。

---

## 10. 下一步建议

这份 control loop contract 之后，可继续拆分为：

1. `forward-transform-contract.md`
2. `reverse-transform-contract.md`
3. scripts 层的 control metadata shape
4. scripts 层的 parse / validate / persist / inject I/O contract
5. 让真实 forward / reverse transform 脚本统一改走 `commitTransformResult(...)`

---

## 11. 一句话总结

> passto-desk 的 runtime 闭环，不是“生成后再看看”，而是让每一轮都经过：结构化推理产出 → parse → validate → persist → inject → next-round decision；当前 `scripts/runtime-contracts.mjs` 已经提供了这条闭环的最小可执行骨架，而 `npm run runtime:smoke` 则是它的标准验证入口。
