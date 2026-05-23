# passto-desk Runtime Model 下沉清单（最小版）

日期：2026-05-21
状态：draft
目的：把 `passto-desk-runtime-model.md` 中的上层模型，按最小必要原则分发到 `SKILL.md`、`references/*`、`scripts/*` 三个层级，避免高层模型重新碎成零散规则。

---

## 1. 下沉原则

下沉不是“把整份 runtime model 拆开复制一遍”，而是：

- **Runtime Model 留在 docs**：负责定义系统本体
- **SKILL.md 留最少的顶层约束**：负责定义 LLM 命中后的主执行面
- **references/* 承载操作策略**：负责说明不同运行路径和策略阀门
- **scripts/* 承载真正 runtime contract**：负责状态、转换、校验、持久化闭环

核心原则：

> 高层模型不应退化成 prompt 细节堆积；
> 运行时 contract 不应只停留在 prose；
> 每一层只保留它真正应该负责的内容。

---

## 2. 应保留在 docs 的内容（不要直接下沉）

以下内容属于系统本体定义，**应继续保留在 docs 层**，不应原样塞进 `SKILL.md`：

### 2.1 系统本体定义
- passto-desk 是双向运行时系统，而不是画图 skill
- object / relation core 是唯一共享中枢
- 文本 / scene / prompt 都不是主状态

### 2.2 上层公式
- `Context = Information + Method + Control`
- `Script = assemble(Information) + encode(Method) + enforce(Control)`
- `LLM Step = reason(ContextRuntime) -> Structured Output`
- reliability comes from loop, not one-shot output

### 2.3 三层架构
- Runtime Model
- Operational Policy
- Prompt / Skill Surface

### 2.4 五维模型的完整论述
- Why
- What
- Structure
- Flow
- Runtime Proof
- Execution Flow / Control Flow 的理论区分

这些内容适合作为：
- 架构指导
- 后续重构依据
- 方法论真相源

但不适合直接成为 skill 主体文本，否则会让 agent 读取成本过高、执行面过抽象。

---

## 3. 应下沉到 `SKILL.md` 的最小内容

`SKILL.md` 只应保留 agent 命中后必须马上知道的**顶层约束**。

### 3.1 系统本体的最小声明
建议补入的最短高层定义：
- passto-desk 不只是图生成流程，而是围绕 object / relation core 的双向转换工作台
- forward：information -> semantic -> excalidraw
- reverse：excalidraw -> semantic -> context/state

这里不需要展开完整理论，只需要让 agent 明白：
- 图不是唯一主状态
- scene 也不是唯一真相源
- object / relation core 才是中枢

### 3.2 Flow 层的最小升级
建议在 `Flow` 或其附近补最短定义：
- Execution Flow：当前轮实际工作顺序
- Control Flow：parse / validate / persist / inject 的闭环机制

不需要在 `SKILL.md` 写过多解释，但需要让 agent 知道：
- 不只是“做完一轮图就结束”
- 需要考虑结果如何进入状态更新与下一轮

### 3.3 双向路径的最小提醒
当前已经有 Runtime path A / B，但还偏操作路径。
建议后续补一个更抽象的短提示：
- 从信息到图，是 forward transform
- 从画板回读到结构状态，是 reverse transform
- 两条路径共享 semantic core

### 3.4 保留现有已成立内容
以下内容已经适合留在 `SKILL.md`，不必上提回 docs：
- Explain-first / Workbench mode split
- Decision Priority Stack
- mechanism-first realization for primary structure（短版）
- explain-first 自评的高层要求

这些已经属于顶层行为约束，应该继续留在 skill 主入口。

---

## 4. 应下沉到 `references/*` 的内容

`references/*` 适合承载“怎么运行”的策略层，而不是系统本体。

### 4.1 `references/readability-and-fast-path.md`
继续承载：
- Explain-first self-review protocol
- 双评分框架
- mechanism-first realization for primary structure
- fast path / fallbacks / readability guard

可进一步补入但不要过度：
- Explain-first mode 的默认 forward 路径提示
- 在 reverse transform 下，哪些可读性规则仍适用，哪些不适用

### 4.2 新增或演化一个 runtime/control 向 reference
建议后续考虑新增一份 reference，而不是把控制流硬塞进 readability 文档。
例如：
- `references/runtime-control-loop.md`
- 或 `references/forward-and-reverse-transform.md`

它适合承载：
- forward / reverse transform 的策略说明
- parse / validate / persist / inject 的闭环顺序
- 何时 stop / retry / rebuild / escalate
- human edit 与 agent edit 的控制差异

### 4.3 boundary / runtime-surface 继续保留原职责
- `boundary.md`：继续负责是否命中与相邻技能边界
- `runtime-surface.md`：继续负责当前真实工具面与 contract surface

不要把 runtime model 的大段理论直接灌进去。

---

## 5. 应下沉到 `scripts/*` 的内容

真正的 runtime 化，最终不能只停在文档层，必须进入 `scripts/*` 的 contract 与数据流设计。

这是后续最关键、但目前尚未落地的一层。

### 5.1 shared state contract
建议优先明确一个共享状态 contract，例如：
- semantic state
- relation state
- view state
- mapping state
- visual state
- warnings / ambiguities
- control state

这相当于把“object-relation core”从概念变成可传递的结构。

### 5.2 forward transform contract
需要定义输入输出：
- 输入：Information set + Method + current state
- 输出：semantic updates + view/mapping/visual result + warnings

至少应有：
- parseable shape
- validation rules
- persist target

### 5.3 reverse transform contract
需要定义输入输出：
- 输入：scene / elements / bindings + current state
- 输出：reconstructed semantic state + confidence / ambiguity + next-step update

关键是：
- scene 不直接等于 semantic truth
- 必须允许不确定与冲突被结构化表达出来

### 5.4 control loop contract
最值得单独抽象的是：
- parse
- validate
- persist
- inject
- decide next round

后续脚本层应能明确：
- 哪一步失败时停止
- 哪一步失败时 fallback
- 哪一步失败时请求人工确认

### 5.5 persistence targets
应明确哪些状态写到哪里：
- domain JSON
- scene JSON / .excalidraw
- summary / snapshot
- control metadata

否则“下一轮注入什么”会持续模糊。

---

## 6. 当前最值得优先下沉的最小项

如果只做最小必要动作，建议优先级如下：

### Priority 1：下沉到 `SKILL.md`
- 双向转换的最短声明
- object / relation core 是共享中枢
- Execution Flow / Control Flow 的最短提醒

### Priority 2：下沉到 `references/*`
- 新增 runtime control / transform reference 的骨架
- 把 forward / reverse transform 的操作策略写清

### Priority 3：下沉到 `scripts/*`
- 明确 shared state contract
- 明确 parse / validate / persist / inject loop 的基础 shape

也就是说：
- 先让 skill 知道“系统本体变了”
- 再让 reference 知道“控制策略怎么跑”
- 最后让 script 真正承接 runtime 化

---

## 7. 当前不建议立刻做的事

为了避免再次把层级搅乱，以下事情不建议立刻做：

### 7.1 不要把整份 runtime model 大段复制进 `SKILL.md`
原因：
- skill 会变得过重
- agent 读取成本过高
- 抽象层次太高，不利于执行

### 7.2 不要继续只加更多 prompt 规则来模拟 control loop
原因：
- 这会继续停留在行为守则层
- 无法真正替代 runtime contract

### 7.3 不要在 scripts 未定义 state contract 前就过早做大量流程自动化
原因：
- 没有统一 state shape，自动化会建立在模糊对象上
- 之后反而更难收敛

---

## 9. 当前目录结构与最小落点

当前仓库内，runtime model 已下沉到以下真实位置：

### `docs/`
负责系统本体、contract 与 shape：
- `passto-desk-runtime-model.md`
- `control-loop-contract.md`
- `runtime-minimal-json-shape.md`
- `shared-semantic-state-contract.md`
- `forward-transform-contract.md`
- `reverse-transform-contract.md`

### `SKILL.md`
负责给 agent 的最小顶层执行面：
- 声明 object / relation shared state 是中枢
- 声明 forward / reverse transform 双向路径
- 给出最小 runtime 验证入口

### `scripts/`
负责真实 runtime contract：
- `runtime-contracts.mjs`
- `runtime-state-skeleton.mjs`
- `runtime-merge-smoke.mjs`
- `runtime-commit-smoke.mjs`
- `excalidraw-to-domain-json.mjs`
- `domain-json-to-excalidraw.mjs`

当前标准验证入口：

```bash
npm run runtime:smoke
```

---

## 10. 一句话总结

> `passto-desk-runtime-model.md` 应作为系统本体真相源继续留在 docs；下沉时，`SKILL.md` 只接最短的双向转换与共享中枢约束，`scripts/*` 承接真正的 shared state / transform / parse-validate-persist-inject contract；当前 passto-desk 项目已经具备这条最小闭环。
