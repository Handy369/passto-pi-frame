# PasstoContext Generator 模块设计

> 版本：v1.3 | 状态：phase A/B/D landed | 更新：2026-05-18

---

## 1. 当前阶段收敛结论

V1.3 当前阶段不应把主实现面定义为 `GeneratorWorkSlice` 或新的运行时切片对象。

基于源码事实，当前更准确的结论是：

> **先强化 Generator 所使用的方法论 prompt，而不是先引入新的结构化工作对象。**

原因不是抽象偏好，而是当前运行时现实决定的：

1. Generator 当前已经能看到多层真实上下文，不缺“输入对象”；
2. 当前主问题在于：这些输入层的**消费方法论不够明确**；
3. 若现在强行引入 `GeneratorWorkSlice`，会把问题提前推进到：
   - 如何从 `GoalState / SummaryCache / Reflector Advice` 做稳定映射
   - 如何保证映射不失真
   - 是否需要反向强化 Curator / Reflector 的产出结构
4. 这些都不是当前最小高价值改动，而且会过早波及 Curator。

因此，V1.3 当前阶段应收敛为：

> **只强化 Generator Charter / Generator Contract，让主模型更准确地理解：当前实际上看到了什么上下文、应如何按 Why / What / Flow / Structure / Runtime Proof 使用这些上下文、以及当前目标为什么服务于更上层目标。**

---

## 2. 基于源码确认：Generator 每轮实际会看到什么

以下结论直接来自当前实现，而不是从设计文档反推。

### 2.1 system prompt 注入链

`before-agent-start-injection.ts` 中，`buildBeforeAgentStartPrompt()` 会按当前运行态拼接 system prompt。

主要注入顺序如下：

1. 原始 `event.systemPrompt`
   - 这已经包含 Pi 平台自身 system prompt，以及全局 `APPEND_SYSTEM.md`
2. `Generator Charter`
   - 条件：`config.grc.enabled && !orchestrationSuspended`
   - 来源：`buildGeneratorCharterPrompt()`
3. `GoalState` 注入
   - 条件：存在 `grcState.curator.lastGoalState`
4. `SummaryCache` 注入
   - 条件：`summaryCache.length > 0`
   - 且会排除最近若干轮，避免和 raw recent rounds 重复
5. `当前会话历史摘要检索指导`
   - 如果当前 session 已存在 summary warehouse，就注入 `ptc_search_summary` 的使用指导
6. `Reflector Advice`
   - 条件：`grcState.mode === "grc" && reflector.status === "done" && lastAdvice`
   - 注意：这一层不是跟着 `grcPromptEnabled` 一起关掉的，属于保守保留层
7. `principles`
8. `memory`

对应代码：
- `before-agent-start-injection.ts`
- `grc-prompts.ts`
- `runtime-summary-search.ts`

### 2.2 context 主路径中的“最近 3 轮完整对话”是真实存在的

`index.ts` 的 `pi.on("context")` 会重写传给主模型的 `event.messages`。

核心逻辑：

1. 优先从 branch 中取最近若干个 `agent-round` 的原始消息；
2. 如果模型暴露了 `contextWindow`，则走滑窗策略：
   - 至少保留 `keepRecentAgentRounds`
   - 再按 `maxContextPercent` 决定是否继续裁掉更老轮次
3. 如果没有 `contextWindow`，则直接取最近 `keepRecentAgentRounds` 轮
4. 然后用 `mergeRecentAgentRoundMessagesWithContext(...)` 把 branch 里的 recent raw rounds 与当前 `event.messages` 合并
5. 合并时会尽量保留当前 prompt-round 的最新 user tail，避免 branch snapshot 滞后导致当前用户输入丢失

默认配置来自 `config.ts`：

- `grc.keepRecentAgentRounds = 3`

所以“最近 3 轮完整对话会被带进 Generator 的上下文”这件事，不是设计设想，而是当前真实行为。

对应代码：
- `index.ts` 中 `pi.on("context")`
- `grc-context-manager.ts`
- `branch-runtime-cache.ts`
- `config.ts`

### 2.3 SummaryCache 在当前实现里的真实角色

`SummaryCache` 当前不是“最近 3 轮的执行主视图”，因为最近轮次已经由 raw recent rounds 在 `context` 里保留。

它在当前实现里的真实作用更接近：

> **补 recent raw rounds 之外的近期历史压缩索引。**

并且 `buildSummaryCacheInjection(...)` 会排除最新若干轮 summary 条目，减少与 recent raw rounds 的重复。

所以当前阶段如果把 `SummaryCache` 强行映射成：
- 当前 flow
- 当前 runtime proof
- 当前执行面主对象

就会偏形式化，不符合现状。

### 2.4 Reflector Advice 在当前实现里的真实角色

`Reflector Advice` 当前是：

> **可注入给下一轮 Generator 的纠偏建议层**

不是：
- 当前目标真相源
- 当前任务 contract
- 新的 GoalState

这与 `generator-contract.md` 中的语义也是一致的：

- `GoalState` 是目标锚点
- `Reflector Advice` 只是纠偏建议

---

## 3. 当前问题到底在哪里

基于源码，当前问题不是“Generator 没有上下文”，而是：

> **Generator 已经看到了很多上下文层，但还没有被清楚教会：这些层各自该怎么消费。**

更具体地说，当前 Generator 容易出现的风险是：

1. 把 `SummaryCache` 当作当前动作的主依据，而忽略 recent raw rounds 已经更近、更真；
2. 把 `Reflector Advice` 当作新任务来源，而不是纠偏层；
3. 看到 `GoalState + recent raw rounds + SummaryCache + principles + memory` 后，缺少明确的消费顺序；
4. 在信息已经足够时继续横向发散，在信息不足时又没有明确停线动作；
5. 当前 Charter 讲了姿态，但还没有充分讲清楚“你此刻真正拥有的上下文构成”。

所以当前最有价值的工作不是生成新对象，而是：

> **把 Generator 的方法论 prompt 从“抽象姿态说明”推进到“贴近当前上下文现实的消费规则”。**

---

## 4. 为什么当前不适合先做 GeneratorWorkSlice

### 4.1 因为当前 Generator 消费的是 prompt，不是结构化运行时对象

当前实现中，Generator 的增强入口就是：

- `APPEND_SYSTEM.md`
- `buildGeneratorCharterPrompt()`
- `GoalState / SummaryCache / Reflector Advice / principles / memory` 的文本注入
- `context` 事件注入的 recent raw rounds

也就是说，当前 Generator 的真实消费面仍然是：

> **prompt + messages**

而不是一个独立的强 schema runtime object。

### 4.2 因为 `Why / What / Flow / Structure / Runtime Proof` 目前更像提示框架，而不是可稳定投影的字段

这些维度可以作为方法论提示，但当前并没有稳定的一一映射来源：

- `GoalState` 主要表达目标锚点
- `SummaryCache` 主要表达旧近因压缩历史
- recent raw rounds 主要表达最近真实执行现场
- `Reflector Advice` 主要表达纠偏候选

如果现在硬要把它们投成统一字段，很容易出现：
- 语义拼接过度
- 伪结构化
- 需要 Curator / Reflector 反向为它适配输出

这不符合“当前只强化 Generator”的边界。

### 4.3 因为当前最小高价值改动并不需要新对象

只要把 Generator 的方法论 prompt 明确到以下程度，就已经能拿到很大收益：

- 你现在会同时看到 `GoalState + recent raw rounds + older SummaryCache + advice + principles + memory`
- 优先顺序是什么
- recent raw rounds 与 SummaryCache 冲突时怎么判
- 下一步动作怎么选
- 什么情况下应停下来先验证或先提问

这类改动不需要动 Curator，不需要新增持久化结构，也不需要新的 projector。

---

## 5. V1.3 当前阶段真正强化的对象

当前阶段真正的产物已经收敛为：

> **一个更贴近当前运行时事实的 Generator 方法论 prompt。**

本轮已落地的主承载面是：

1. `references/generator-contract.md`
2. `grc-generator-contract.ts` 中的 `projectGeneratorCharterPrompt(...)`
3. 对应回归测试：
   - `tests/generator-charter-prompt.test.ts`
   - `tests/before-agent-start-injection.test.ts`
   - `tests/generator-contract-append-system.test.ts`

没有落地的内容包括：

- 新的 Generator runtime object
- 新的 Curator 输出协议
- 新的 Reflector 结构化 contract
- 新的 `GeneratorWorkSlice`

---

## 6. 本轮实际落地的方法论框架

当前已经明确：这里不做“字段映射”，而是做“思考与执行的方法论约束”。

### 6.1 上层目标视角

Charter 现在要求主模型：

- 先把当前目标放回更上层目标链中理解
- 判断当前动作为什么存在、服务哪个更高层结果
- 若无法解释当前动作与上层目标的关系，先回退重判目标

这解决的是“只盯局部 task，不理解它为什么值得做”的问题。

### 6.2 当前上下文窗口的使用方式

Charter 现在明确要求主模型：

- 先利用当前上下文窗口里的最近执行现场理解进度
- 再结合 `GoalState / SummaryCache / Reflector Advice / principles / memory` 补足背景
- 不要把所有动态层平均混合后再给出含混结论

这里强调的是“怎么用上下文”，而不是“把每层解释成一个新字段”。

### 6.3 五维工作框架

当前已落地的五维定义是：

- `Why`：先判断当前目标服务于哪个更上层目标
- `What`：先收敛这一轮真正要产出的对象与完成定义
- `Flow`：先用当前消息与最近执行现场选择下一步；不足时再补读 `GoalState / SummaryCache / warehouse / memory`
- `Structure`：先识别真实 truth source、实现层级、代码与运行态
- `Runtime Proof`：先确认当前判断是否已被源码、工具结果、运行时状态或其他现实证据支撑

重点不是五个字段，而是五个判断门。

### 6.4 Runtime Proof 约束

本轮最重要的纠偏之一是把 `Runtime Proof` 从“形式化尾项”拉回到真实约束层。

也就是说：

- 讨论机制时优先回到真实代码、事件 wiring、运行态与文件状态
- 如果还没被源码或工具结果支撑，就先补验证
- 不能只在 prompt 形式上体现框架，却不从实现层验证它是否成立

---

## 7. SummaryCache 在本轮的收敛定位

本轮没有把主工作放在“重新定义 SummaryCache 是什么”上。

更准确的口径是：

- `SummaryCache` 是当前上下文中的近期历史补充层
- 它用于补足最近执行现场之外的近因背景
- 它不单独决定当前轮动作

当前真正重要的不是反复强调 `SummaryCache` 本体，而是让主模型知道：

> **先用 Why / What / Flow / Structure / Runtime Proof 框架处理当前上下文窗口中的真实内容；当最近执行现场不足以支撑判断时，再把 SummaryCache 当作补充层使用。**

因此，V1.3 当前阶段的主成果不是“解释 SummaryCache”，而是“教会 Generator 如何使用上下文”。

---

## 8. 当前阶段不做什么

V1.3 当前阶段仍然不做：

1. 不新增 `GeneratorWorkSlice` runtime schema
2. 不新增 `buildGeneratorWorkSlice()` projector
3. 不要求 Curator 产出新的面向 Generator 的结构对象
4. 不要求 Reflector 改写输出格式来适配 Generator schema
5. 不把 `Why / What / Flow / Structure / Runtime Proof` 强行落成映射字段
6. 不为了强调 SummaryCache 而扩散到 Curator 或其他动态层改造

这些都可以在后期、当 Curator / Reflector 的结构化产出更成熟后，再逐层推进。

---

## 9. 当前阶段的实现与验证状态

### 已完成

#### Phase A：改 Generator Contract

修改：
- `references/generator-contract.md`

结果：
- Charter 已从偏“形式结构”收敛到“方法论框架”
- 已强化上层目标视角、上下文窗口使用方式与 runtime proof 约束

#### Phase B：改 Charter 投影

修改：
- `grc-generator-contract.ts`

结果：
- `projectGeneratorCharterPrompt(...)` 已输出与 contract 对齐的新方法论文案
- fallback prompt 也同步了同一口径

#### Phase D：补测试

修改：
- `tests/generator-charter-prompt.test.ts`
- `tests/before-agent-start-injection.test.ts`
- `tests/generator-contract-append-system.test.ts`

结果：
- 已验证 Generator Charter 新文案生成正常
- 已验证新 Charter 真实进入 `before_agent_start` 注入链
- 已验证 `APPEND_SYSTEM` 仍然只导出 Constitution，不混入 Generator Charter

### 暂未作为本轮主改动

#### Phase C：SummaryCache 注入文案

本轮未把它作为主实现面。

原因：
- 当前主矛盾不是 `SummaryCache` 的解释不足
- 而是 Generator 缺少一套更强的方法论来消费当前上下文窗口
- 在这个前提下，优先把 Charter 做实，比单改 SummaryCache 标题更高价值

后续若仍观察到模型频繁误用 SummaryCache，再单点收敛 `buildSummaryCacheInjection(...)` 也更合适。

---

## 10. 一句话结论

V1.3 当前阶段不应先做 `GeneratorWorkSlice`，也不应把注意力过早转成“定义 SummaryCache 是什么”。

更符合源码现实、也已经落地的路线是：

> **先把 Generator 的方法论 prompt 做实：让主模型围绕 Why / What / Flow / Structure / Runtime Proof 来使用当前上下文窗口，并始终从上层目标和 runtime proof 两端约束当前动作。**
