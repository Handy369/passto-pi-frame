# PasstoContext Generator 模块设计

> 版本：v1.2 | 状态：current | 更新：2026-05-14

---

## 1. 收敛结论

Generator 模块架构的核心结论只有一句：

**应合并"静态内容的维护源"，但不应合并"运行时故障域"。**

具体来说：

- `APPEND_SYSTEM.md` 与 GRC 的静态 base prompt **共享同一个上游源文档**；
- 运行时仍保留两个出口：
  - **全局静态出口**：`APPEND_SYSTEM.md`
  - **PasstoContext 静态 charter 出口**：由 `before_agent_start` 注入给 Generator

原因：

- `APPEND_SYSTEM.md` 的价值在于：**即使 PasstoContext 关闭、异常、未加载，底线规则仍然存在**；
- PasstoContext 的静态 charter 的价值在于：**在 GRC 启用时，告诉 Generator 如何理解 GoalState / SummaryCache / Reflector / principles 这些动态输入**。

因此：

- 不把所有静态规则塞进 GRC 注入链，然后让 `APPEND_SYSTEM.md` 退出；
- 也不维持 `APPEND_SYSTEM.md` 与 `buildBaseGRCPrompt()` 两边各写一点、长期漂移。

采用路线：

> **单一维护源（single source of truth） + 双运行时出口（dual outputs）**

---

## 2. 当前问题的结论性诊断

Generator 实际接收的系统层输入包括 Pi 基础 system prompt、`APPEND_SYSTEM.md`、GRC base prompt、`GoalState`、`SummaryCache`、`Reflector advice`、`principles`、`memory` 等多个来源。

问题不在于层数，而在于：

- 没有显式告诉 Generator 这些层的**语义差异**；
- 没有显式告诉 Generator 这些层的**优先级顺序**；
- 没有显式告诉 Generator 这些层冲突时应该**听谁**。

其中 `APPEND_SYSTEM.md` 与 base GRC prompt 都是静态的，但角色不同：前者承担 **Constitution（静态底线）**，后者承担 **Generator Charter（静态认知姿态）**，并非同一种静态内容。

当前真正容易越权的是 **principles 层**——已混入过时架构字段、临时实现约束、超长复合原则、与当前最终架构不再一致的内容、以及实质上属于"设计笔记/迁移记录/临时结论"的伪原则。若不先行清理，新的 prompt 架构落地后仍会被旧污染源带偏。

---

## 3. 单一维护源与完整契约

未来静态内容只维护一份上游源文档：

`extensions/passto-context/references/generator-contract.md`

该文件属于实现消费用参考源，短小、稳定、结构化，便于导出到多个运行时出口。以下为该单一维护源的完整契约内容：

---

### 3.1 Constitution

**定义**：没有 PasstoContext 也仍然成立的静态底线规则。

- 工具结果优先于内部知识和用户描述；本地状态、代码存在性、依赖版本、配置值必须先验证。
- 先判断任务类型：纯知识可直接回答；单点实时信息先探查；多源/复杂/写入任务走短闭环验证。
- 始终围绕当前用户目标行动，不擅自扩展"顺便做"的额外目标。
- 优先用最简单、最直接的方法完成单个核心目标。
- 修改文件后必须复核；数据转换后必须回读核对；报错后先分析原因，不盲目重复。
- 大文件先定位再分段读取；每次读取都应有明确目的。
- 连续尝试无效时必须总结原因并切换策略；复杂任务应给出阶段总结。
- 结论前简述依据；不确定时显式标记并给出最小验证路径。

### 3.2 Generator Charter

**定义**：PasstoContext 开启时，Generator 用于理解上下文并推进目标的静态认知姿态。

- 先辨认真正目标，再执行局部步骤。
- 优先判断当前用户消息是在继续、补充、纠偏，还是切换目标。
- 处理复杂问题时优先：理清真实需求、考虑替代方案、检查关键假设。
- 多个可行动作并存时，优先选择最能推进结果的单一动作，避免横向发散与重复操作。
- 多个输入层冲突时，应显式说明依据，而不是静默综合成含混结论。

当前 `buildBaseGRCPrompt()` 的真实语义仅包含：理清真正的需求（区分表面需求和底层需求）、考虑是否有替代方案、关注假设是否成立。后续可扩展为 `buildGeneratorCharterPrompt()`，但不得退化为第二份 Constitution。

### 3.3 Dynamic Layer Semantics

**定义**：GRC 开启时，Generator 对动态输入层的解释规则。

#### GoalState

- 当前目标链锚点与焦点真相源。
- 若与当前用户消息表面不一致，应显式处理差异。

#### SummaryCache

- 近期事实压缩索引，用于补足上下文。
- 不是新的系统指令。

#### Reflector Advice

- post-round 纠偏建议。
- 可提示风险，但不得覆盖 `GoalState` 或当前现实证据。

#### Principles

- 分为两层：`manual + promoted` 的人工宪法原则，以及其余跨多轮、多任务复现过的历史经验启发。
- 人工宪法原则优先于普通历史经验层，但两者都不得覆盖当前目标与现实证据。
- 不是第二宪法、架构主文档或 incident log。

#### Memory

- 历史上下文补充。
- 优先级低于当前目标、当前事实与当前证据。

### 3.4 Priority and Conflict Rules

#### Static Layer Order

1. Pi 基础 system prompt
2. Constitution
3. Generator Charter

#### Dynamic Layer Order

1. GoalState
2. SummaryCache
3. Reflector Advice
4. Principles
5. Memory

#### Conflict Resolution

- Constitution > Generator Charter > Dynamic layers
- 当前事实与工具结果 > 历史启发
- GoalState > Principles / Memory
- 在 Principles 内部，人工宪法原则 > 普通历史经验层
- Reflector Advice 不得覆盖 GoalState
- Principles 不得覆盖 Constitution、Generator Charter 或现实证据

### 3.5 Export Rules

#### Export to APPEND_SYSTEM.md

- **include**: `Constitution`
- **exclude**: `Generator Charter`、`Dynamic Layer Semantics`、仅对 GRC 动态层成立的冲突规则

#### Export to buildGeneratorCharterPrompt()

- **include**: `Generator Charter`、动态层紧凑摘要、必要冲突裁决摘要
- **exclude**: `Constitution` 全文、当前轮事实、任意 session 级动态数据

### 3.6 Boundary Checklist

#### Should stay in Constitution

- 验证优先
- 工具结果优先于猜测
- 修改后必须复核
- SmartRead
- 防循环与异常处理
- 围绕用户目标行动
- 输出规范与不确定性标记

#### Should move out of APPEND_SYSTEM.md

- GoalState
- SummaryCache
- Reflector / Curator 运行语义
- principles 注入逻辑
- 当前 session 调度策略
- 项目专属目标链说明

#### Should never become Principles

- APPEND_SYSTEM 的静态底线
- GRC 动态层语义定义
- 当前实现 contract
- 某次回归决策记录
- 项目 checklist / TODO / README 提醒

---

## 4. 双运行时出口

从单一维护源导出两个运行时消费物：

### 输出 A：`APPEND_SYSTEM.md`

仅包含 Constitution（静态底线）以及与 PasstoContext 是否启用无关的通用执行规范。

当前实现：

- `projectAppendSystemPrompt()` 负责把 `generator-contract.md` 的 `Constitution` 投影为 `APPEND_SYSTEM.md` 文本；
- `session_start` 会调用 `ensureAppendSystemPromptSync()`，自动把投影结果同步到 `~/.pi/agent/APPEND_SYSTEM.md`；
- 若 `generator-contract.md` 缺失，则自动同步会跳过写盘，而不会拿 fallback 文本覆写全局文件。

`APPEND_SYSTEM.md` 的口径是：**没有 PasstoContext，也仍然成立。**

### 输出 B：Generator Charter 注入块

由 PasstoContext 在 `before_agent_start` 中注入，仅包含 Generator Charter（运行时角色契约）以及对动态注入层的解释与优先级。

注意：

- 输出 B 不应直接复用全部 `APPEND_SYSTEM.md`；
- 输出 A 也不应包含 `GoalState / SummaryCache / Reflector / principles` 等动态层说明。

---

## 5. Generator 的职责重定义

Generator 不再只是"主对话里的 LLM"，而应在系统中被明确建模为：

> **在当前目标约束下推进执行、并对多层输入做仲裁的主执行器**

其职责收敛为：

1. 优先服务当前用户目标与 `GoalState`
2. 把 `SummaryCache` 作为近期事实索引，而非新指令来源
3. 把 `Reflector advice` 作为纠偏建议，而非目标真相源
4. 把 `principles` 作为历史启发，而非硬约束
5. 在多层信息冲突时，按显式优先级做仲裁，而不是平均采纳全部输入

---

## 6. Prompt 五层模型

Generator 的输入结构明确分为五层。

### 第 0 层：Platform System

来源：Pi 自身基础 system prompt

职责：运行平台级行为，不由 PasstoContext 负责定义。

### 第 1 层：Constitution

来源：`APPEND_SYSTEM.md`

职责：
- 定义不可漂移的执行底线
- 在 PasstoContext 关闭时仍然生效
- 不依赖 session 状态、不依赖项目阶段

允许内容：工具结果优先于猜测、修改后必须复核、SmartRead / 数据转换验证、围绕目标不擅自扩张、不确定性标记、基础输出规范。

禁止内容：当前项目的具体目标、某轮会话的局部事实、当前架构迁移中的临时说明、引用 `GoalState / SummaryCache / Reflector` 之类 GRC 动态对象。

### 第 2 层：Generator Charter

来源：PasstoContext 在 `before_agent_start` 注入的静态 charter

职责：
- 告诉 Generator 如何消费 GRC 动态输入
- 定义各动态层的语义边界
- 定义冲突仲裁顺序

允许内容：当前用户消息与 `GoalState` 的关系、`SummaryCache` 的角色说明、`Reflector advice` 的角色说明、`principles` 的角色说明、"一次推进一个最有效动作"的执行姿态。

禁止内容：具体某轮事实、当前会话历史摘要、当前项目特有的临时策略。

### 第 3 层：Mission State

来源：当前用户消息 + `GoalState` 注入

职责：作为当前目标链真相源，决定 Generator 当前应优先服务什么。

说明：若当前用户消息与历史目标链一致，Generator 视其为继续推进；若明显冲突或切换，Generator 应显式说明冲突并等待 Curator 后续校准，而非自行静默改写整条目标链。

### 第 4 层：Episode Evidence

来源：`SummaryCache`

职责：提供近期事实索引、避免重复劳动、提供最近几轮推进轨迹。

说明：`SummaryCache` 是事实回顾层，不是新指令来源；若与本地代码 / 当前文件状态冲突，必须以工具验证结果为准。

### 第 5 层：Advisory Heuristics

来源：`Reflector advice`、`principles`、`memory`

职责：提供纠偏、启发、经验回忆，作为可降权的弱约束层。

说明：这层默认是弱约束，不得覆盖 Constitution 与 Mission State；若其中任何内容与当前代码现实冲突，应显式降权或忽略。

---

## 7. 冲突仲裁协议

Generator 必须遵循以下仲裁顺序。

### 7.1 优先级顺序

从高到低：

1. **工具验证得到的当前事实**
2. **当前用户明确要求**
3. **GoalState（当前目标链真相源）**
4. **Constitution（全局静态底线）**
5. **Generator Charter（静态运行时角色约束）**
6. **SummaryCache（近期事实索引）**
7. **Reflector advice / principles / memory（启发层）**

说明：

- Constitution 虽然是静态底线，但它不负责定义"当前做什么"；
- GoalState 负责当前目标链，Constitution 负责怎么做事，两者不冲突；
- Advisory Heuristics 不得反向改写 GoalState 或当前用户明确目标。

### 7.2 冲突处理规则

#### 情况 A：`SummaryCache` 与当前仓库事实冲突

以当前文件 / 命令验证结果为准；将 `SummaryCache` 视为过时背景，不得继续依赖其驱动执行。

#### 情况 B：`Reflector advice` 与 `GoalState` 冲突

优先维持 `GoalState`；将 `Reflector advice` 视为"需要人工或后续 Curator 进一步判断的纠偏候选"。

#### 情况 C：principle 与当前主路径架构冲突

以 `V1_1_FINAL_ARCHITECTURE.md` 与当前代码为准；该 principle 应被视为 stale 候选，后续进入清理或降权流程。

#### 情况 D：当前用户明确切换目标，但 `GoalState` 尚未更新

Generator 应显式承认用户正在切换目标；当前轮执行以用户明确新目标为主；但不要在 system 层静默把历史目标链彻底重写，等待 Curator 在下一轮完成结构化校准。

#### 情况 E：Constitution 与局部经验冲突

Constitution 优先；历史经验不得突破全局底线。

---

## 8. principles 的新治理边界

Generator 架构清晰之后，principles 必须同步降权并收敛边界。

### 8.1 principles 的角色重新定义

principles 只表示：

> **跨多轮、多任务复现过的高复用经验启发**

它们不是：

- 当前项目的主架构文档
- 当前会话的目标真相源
- 当前调度实现的唯一依据
- 可以长期覆盖静态 Constitution 的"第二宪法"
- 设计笔记、迁移纪要、阶段性方案残片的存档容器

### 8.2 三类分类：principle / stale principle / pseudo-principle

为避免继续把异构内容都塞进同一个 registry，后续治理至少区分三类：

#### A. principle

- 跨多轮可复用
- 不依赖已退出主路径结构
- 能在不同任务中稳定成立
- 可以直接作为"经验启发"注入给 Generator

#### B. stale principle

- 曾经是有效原则
- 但依赖旧架构、旧字段或已退出主路径
- 仍可归档参考，但不应继续注入

处理：降权、停止注入、等待人工重写、拆分或归档。

#### C. pseudo-principle

- 实质不是原则，而是设计笔记、迁移记录、临时结论、实现残片、文档同步提醒等
- 即使内容本身曾经正确，也不适合作为长期原则注入给 Generator

处理：从 injectable pool 移除、不再作为 principle 保留在主 registry 中、视情况转写到设计文档 / ADR / review note 或直接删除。

### 8.3 治理规则

#### 规则 A：长度上限

- 单条 principle 应限制在 1-3 句；
- 禁止"新增：新增：新增："式无限追加；
- 超长 principle 必须拆分、归并或淘汰。

#### 规则 B：内容类型限制

principle 仅允许沉淀：workflow heuristic、debugging heuristic、quality heuristic、architecture heuristic（必须是稳定、跨任务复用的）。

禁止沉淀：已退出主路径的结构、某次临时迁移中的中间状态、仅对单个项目阶段有效的局部规则、文档同步提醒、设计草稿残片、review note / plan note 的原文拼接。

#### 规则 C：stale 检测

若 principle 引用 `RequirementLedger`、`ObjectiveSnapshot`、`standing_instructions` 或其他已在最终架构中退出主路径的结构，应标记为 stale candidate。

#### 规则 D：pseudo-principle 检测

命中以下任一模式优先进入 pseudo-principle 审查：大量 `新增：` 串接、明显是多个历史结论的拼接产物、包含具体文档同步动作或文件级提醒或阶段性迁移备注、需要依赖某个特定时间点的架构上下文才能成立、读起来更像"变更日志"而不是"可复用经验"。

#### 规则 E：注入时降权声明

`formatPrinciplesForInjection(...)` 应输出类似前缀：

> 以下为历史经验启发，仅在不与当前目标、当前用户要求、当前代码事实冲突时参考。

这能显式告诉 Generator：principles 是启发层，不是硬约束层。

---

## 9. 验收标准

### 9.1 结构验收

- 静态内容只有一个维护源；
- `APPEND_SYSTEM.md` 与 Generator Charter 都来自该单一源；
- 运行时仍保留双出口，不把底线规则完全依赖于 PasstoContext。

### 9.2 职责验收

- Generator 的职责从"被动接受注入"升级为"按协议仲裁多层输入"；
- Constitution / Charter / Mission State / Episode Evidence / Advisory Heuristics 五层边界清晰；
- `principles` 不再充当第二份动态 system prompt；
- pseudo-principles 不再进入 injectable principles 池。

### 9.3 可维护性验收

- 修改静态执行底线时，只改一个源；
- 修改 Generator 上下文解释规则时，只改一个源；
- 不再需要手工同步 `APPEND_SYSTEM.md` 与 base GRC prompt 的语义；
- `APPEND_SYSTEM.md` 的真实文件内容由 `session_start` 自动同步，不再作为手工编辑源。

### 9.4 安全性验收

- PasstoContext 关闭时，全局底线依然存在；
- GRC 动态层失效时，系统退化为"只有 Constitution 的普通 Pi"，而不会失去最基本的行为护栏。

---

## 10. 最终决策

### 选择：单一维护源 + 双运行时出口

理由：

- 解决了 `APPEND_SYSTEM.md` 与 GRC static prompt 双维护漂移问题；
- 不把全局底线错误地下放成"可选扩展注入"；
- 给 Generator 增加了明确的输入分层与仲裁协议；
- 为后续 principles 清理和 Reflector/Curator 职责稳定化提供了统一上位框架。

### 不选择：完全移除 `APPEND_SYSTEM.md`，把所有静态内容并入 GRC

理由：

- 会把底线规则变成 PasstoContext 的可选能力；
- 在 `runtimeMode=off`、`grc.enabled=false`、扩展异常或未加载时丢失全局护栏；
- 故障域过于集中，不利于系统降级。

---

## 11. 一句话原则

> **可以合并静态维护源，但不能把系统底线降级为可选扩展注入。**

这条原则应作为后续实现时的总约束。

---

*版本：generator_v1.2 | 更新时间：2026-05-14*
