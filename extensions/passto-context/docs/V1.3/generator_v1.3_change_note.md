# Generator v1.3 变更摘要 / ADR Note

> 日期：2026-05-18  
> 适用范围：`passto-context / Generator` 线  
> 状态：已落地

---

## 1. 一句话结论

本轮对 V1.3 Generator 的收敛结论是：

> **不引入 `GeneratorWorkSlice`，先把 Generator 的方法论 prompt 做实。**

核心不是重新定义 `SummaryCache`，而是让主模型围绕 `Why / What / Flow / Structure / Runtime Proof` 使用当前上下文窗口，并始终从上层目标与 runtime proof 两端约束当前动作。

---

## 2. 背景

此前 V1.3 文档一度把重点放在：

- `GeneratorWorkSlice`
- `GoalState / SummaryCache / Reflector Advice` 到新结构对象的投影
- 以及通过新对象统一 Generator 的工作面

但按当前源码现实，Generator 真实消费的仍然是：

- `before_agent_start` 注入的 system prompt 各层
- `context` 事件保留的 recent raw rounds
- 以及工具读到的真实代码、运行态与文件状态

因此当前主问题不是“缺少新对象”，而是：

> **缺少一套更明确的方法论，来消费已经存在的上下文。**

---

## 3. 决策

本轮决定：

1. **不做 `GeneratorWorkSlice`**
2. **不波及 Curator / Reflector 结构化输出**
3. **先强化 Generator Charter / Contract**
4. **把五维框架从形式映射改成方法论约束**

五维框架的当前口径是：

- `Why`：先判断当前目标服务于哪个更上层目标
- `What`：先收敛这一轮真正要产出的对象
- `Flow`：先用当前消息与最近执行现场选择下一步
- `Structure`：先回到真实实现层、代码、事件 wiring 与运行态
- `Runtime Proof`：先确认当前判断是否被源码、工具结果或运行时事实支撑

---

## 4. 本轮已落地改动

已修改：

- `references/generator-contract.md`
- `grc-generator-contract.ts`
- `tests/generator-charter-prompt.test.ts`
- `tests/before-agent-start-injection.test.ts`
- `tests/generator-contract-append-system.test.ts`

已同步文档：

- `docs/V1.3/generator_v1.3.md`

---

## 5. 本轮没有做什么

本轮没有把以下内容作为主实现面：

- `GeneratorWorkSlice` runtime schema
- `buildGeneratorWorkSlice()` projector
- Curator 新输出协议
- Reflector 新 contract
- 单独把 `SummaryCache` 文案改造成当前主线

这不是否定这些方向，而是当前判断：

> **先把 Generator 方法论做实，比先造新结构对象更高价值、也更贴近源码现实。**

---

## 6. 验证依据

本轮判断与改动基于：

- `before-agent-start-injection.ts`
- `index.ts` 中 `pi.on("context")`
- `grc-prompts.ts`
- `generator-contract.md`

相关精确回归已通过：

- `tests/generator-charter-prompt.test.ts`
- `tests/before-agent-start-injection.test.ts`
- `tests/generator-contract-append-system.test.ts`

---

## 7. 推荐后续口径

后续如果要描述 V1.3 Generator 当前阶段，推荐统一使用：

> **V1.3 当前先强化 Generator 方法论 prompt，而不是引入 `GeneratorWorkSlice`。**  
> 已落地重点是：上层目标视角、上下文窗口使用方式、以及 `Runtime Proof` 先于动作的约束。
