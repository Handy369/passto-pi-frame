# PasstoContext v1.1 Generator / Prompt 架构规范

> 状态：proposed
> 目标：统一 `APPEND_SYSTEM.md` 与 PasstoContext 静态 GRC prompt 的维护源，并澄清 Generator 的职责、输入分层与冲突仲裁协议。
> 依据：
> - 当前全局附加提示词：`/Users/handy/.pi/agent/APPEND_SYSTEM.md`
> - 当前运行时代码：`extensions/passto-context/index.ts` / `grc-prompts.ts` / `grc-principles.ts`
> - 当前主路径口径：`docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`
> 更新时间：2026-05-12
>
> 说明：
> - 本文档是 **Generator / Prompt 结构重构 spec**，不是当前已落地实现说明。
> - 当前运行时代码仍以 `V1_1_FINAL_ARCHITECTURE.md` 与实际实现为准。
> - 本文重点解决两个问题：
>   1. 静态提示词分散在 `APPEND_SYSTEM.md` 与 GRC base prompt 两处，存在维护漂移风险；
>   2. Generator 当前缺少明确的“输入分层与仲裁协议”，导致 `APPEND_SYSTEM / GoalState / SummaryCache / Reflector / principles` 的语义边界不够清晰。

---

## 1. 收敛结论

本次重构的核心结论只有一句：

**应合并“静态内容的维护源”，但不应合并“运行时故障域”。**

具体来说：

- `APPEND_SYSTEM.md` 与 GRC 的静态 base prompt **可以共享同一个上游源文档**；
- 但运行时仍应保留两个出口：
  - **全局静态出口**：`APPEND_SYSTEM.md`
  - **PasstoContext 静态 charter 出口**：由 `before_agent_start` 注入给 Generator

原因：

- `APPEND_SYSTEM.md` 的价值在于：**即使 PasstoContext 关闭、异常、未加载，底线规则仍然存在**；
- PasstoContext 的静态 charter 的价值在于：**在 GRC 启用时，告诉 Generator 如何理解 GoalState / SummaryCache / Reflector / principles 这些动态输入**。

因此，本方案不推荐：

- 把所有静态规则都塞进 GRC 注入链，然后让 `APPEND_SYSTEM.md` 退出；
- 或继续维持 `APPEND_SYSTEM.md` 与 `buildBaseGRCPrompt()` 两边各写一点、长期漂移。

本方案推荐：

> **单一维护源（single source of truth） + 双运行时出口（dual outputs）**

---

## 2. 当前问题诊断

### 2.1 不是“静态 prompt 太多”，而是“静态层次未分工”

当前 Generator 实际接收的系统层输入包括：

1. Pi 基础 system prompt
2. `APPEND_SYSTEM.md`
3. GRC base prompt（`buildBaseGRCPrompt()`）
4. `GoalState` 注入
5. `SummaryCache` 注入
6. `Reflector advice` 注入
7. `principles` 注入
8. `memory` 注入

问题不在于层数，而在于：

- 没有显式告诉 Generator 这些层的**语义差异**；
- 没有显式告诉 Generator 这些层的**优先级顺序**；
- 没有显式告诉 Generator 这些层冲突时应该**听谁**。

### 2.2 `APPEND_SYSTEM.md` 与 base GRC prompt 都是静态的，但角色不同

当前 `APPEND_SYSTEM.md` 主要承担：

- 验证优先
- 工具优先于猜测
- SmartRead / 修改后复核 / 异常处理
- 围绕目标行动
- 输出规范与不确定性标记

这些内容本质上是：

> **Constitution（静态底线）**

当前 `buildBaseGRCPrompt()` 只承担：

- 理清真正需求
- 考虑替代方案
- 关注假设是否成立

这些内容本质上是：

> **Generator Charter（静态认知姿态）**

两者都静态，但并不是同一种静态内容。

### 2.3 当前真正容易越权的是 principles 层

当前 `principles` 注入头部为“经验原则（来自历史会话）”，但在实际 registry 中，已经可能混入：

- 过时架构字段（如历史上的 `RequirementLedger`、`standingInstructions`）
- 某一阶段的临时实现约束
- 多轮追加后的超长复合原则
- 与当前最终架构不再一致的内容
- 实质上属于“设计笔记 / 迁移记录 / 临时结论”的伪原则

这会导致 principles 从“历史启发”膨胀成“第二份动态 system prompt”，并与 `APPEND_SYSTEM.md` / Generator Charter 争权。

基于对当前 registry 的本地审计，还可确认这不是理论风险，而是已存在的存量问题：

- 当前 registry 共有 `100` 条记录；
- 至少 `4` 条存在明显超长/多轮拼接现象；
- 至少 `4` 条保留了 `新增：` 式逐轮追加痕迹；
- 至少 `2` 条高置信内容已经更接近“历史架构残片”，而不是可直接注入的稳定原则。

因此，Generator 架构重构不能只讨论 `APPEND_SYSTEM.md` 与 base GRC prompt，还必须把 **principles registry 清洗** 作为前置步骤，而不是后置优化。

---

## 3. 目标状态（to-be）

### 3.1 单一维护源

未来静态内容应只维护一份上游源文档，建议路径：

`extensions/passto-context/references/generator-contract.md`

说明：

- 该文件属于 **实现消费用参考源**，而不是 v1.1 历史设计文档；
- 文档应短小、稳定、结构化，便于后续导出到多个运行时出口；
- `docs/v1.1/` 保留本规范作为设计说明，`references/` 承担未来可执行的上游源角色。

### 3.2 双运行时出口

从上述单一维护源导出两个运行时消费物：

#### 输出 A：`APPEND_SYSTEM.md`

仅包含：

- Constitution（静态底线）
- 与 PasstoContext 是否启用无关的通用执行规范

当前实现状态：

- `projectAppendSystemPrompt()` 负责把 `generator-contract.md` 的 `Constitution` 投影为 `APPEND_SYSTEM.md` 文本
- `session_start` 会调用 `ensureAppendSystemPromptSync()`，自动把投影结果同步到 `~/.pi/agent/APPEND_SYSTEM.md`
- 若 `generator-contract.md` 缺失，则自动同步会跳过写盘，而不会拿 fallback 文本覆写全局文件

#### 输出 B：Generator Charter 注入块

由 PasstoContext 在 `before_agent_start` 中注入，仅包含：

- Generator Charter（运行时角色契约）
- 对动态注入层的解释与优先级

注意：

- 输出 B 不应直接复用全部 `APPEND_SYSTEM.md`；
- 输出 A 也不应包含 `GoalState / SummaryCache / Reflector / principles` 等动态层说明。

### 3.3 Generator 的职责重定义

Generator 不再只是“主对话里的 LLM”，而应在系统中被明确建模为：

> **在当前目标约束下推进执行、并对多层输入做仲裁的主执行器**

其职责应收敛为：

1. 优先服务当前用户目标与 `GoalState`
2. 把 `SummaryCache` 作为近期事实索引，而非新指令来源
3. 把 `Reflector advice` 作为纠偏建议，而非目标真相源
4. 把 `principles` 作为历史启发，而非硬约束
5. 在多层信息冲突时，按显式优先级做仲裁，而不是平均采纳全部输入

---

## 4. 新的 Prompt 五层模型

未来 Generator 的输入结构应明确分为五层。

### 第 0 层：Platform System

来源：Pi 自身基础 system prompt

职责：
- 运行平台级行为
- 不由 PasstoContext 负责定义

### 第 1 层：Constitution

来源：`APPEND_SYSTEM.md`

职责：
- 定义不可漂移的执行底线
- 在 PasstoContext 关闭时仍然生效
- 不依赖 session 状态
- 不依赖项目阶段

允许内容：
- 工具结果优先于猜测
- 修改后必须复核
- SmartRead / 数据转换验证
- 围绕目标，不擅自扩张
- 不确定性标记
- 基础输出规范

禁止内容：
- 当前项目的具体目标
- 某轮会话的局部事实
- 当前架构迁移中的临时说明
- 引用 `GoalState / SummaryCache / Reflector` 之类 GRC 动态对象

### 第 2 层：Generator Charter

来源：PasstoContext 在 `before_agent_start` 注入的静态 charter

职责：
- 告诉 Generator 如何消费 GRC 动态输入
- 定义各动态层的语义边界
- 定义冲突仲裁顺序

允许内容：
- 当前用户消息与 `GoalState` 的关系
- `SummaryCache` 的角色说明
- `Reflector advice` 的角色说明
- `principles` 的角色说明
- “一次推进一个最有效动作”的执行姿态

禁止内容：
- 具体某轮事实
- 当前会话历史摘要
- 当前项目特有的临时策略

### 第 3 层：Mission State

来源：
- 当前用户消息
- `GoalState` 注入

职责：
- 作为当前目标链真相源
- 决定 Generator 当前应优先服务什么

说明：
- 若当前用户消息与历史目标链一致，则 Generator 应视其为继续推进；
- 若当前用户消息与历史目标链明显冲突或切换，则 Generator 应显式说明冲突，并等待 Curator 后续校准，而不是自行静默改写整条目标链。

### 第 4 层：Episode Evidence

来源：`SummaryCache`

职责：
- 提供近期事实索引
- 避免重复劳动
- 提供最近几轮推进轨迹

说明：
- `SummaryCache` 是事实回顾层，不是新指令来源；
- 若与本地代码 / 当前文件状态冲突，必须以工具验证结果为准。

### 第 5 层：Advisory Heuristics

来源：
- `Reflector advice`
- `principles`
- `memory`

职责：
- 提供纠偏、启发、经验回忆
- 作为可降权的弱约束层

说明：
- 这层默认是弱约束，不得覆盖 Constitution 与 Mission State；
- 若其中任何内容与当前代码现实冲突，应显式降权或忽略。

---

## 5. Generator 冲突仲裁协议

Generator 必须遵循以下仲裁顺序：

### 5.1 优先级顺序

从高到低：

1. **工具验证得到的当前事实**
2. **当前用户明确要求**
3. **GoalState（当前目标链真相源）**
4. **Constitution（全局静态底线）**
5. **Generator Charter（静态运行时角色约束）**
6. **SummaryCache（近期事实索引）**
7. **Reflector advice / principles / memory（启发层）**

说明：

- Constitution 虽然是静态底线，但它不负责定义“当前做什么”；
- GoalState 负责当前目标链，Constitution 负责怎么做事，两者不冲突；
- Advisory Heuristics 不得反向改写 GoalState 或当前用户明确目标。

### 5.2 冲突处理规则

#### 情况 A：`SummaryCache` 与当前仓库事实冲突

处理：
- 以当前文件 / 命令验证结果为准；
- 将 `SummaryCache` 视为过时背景，不得继续依赖其驱动执行。

#### 情况 B：`Reflector advice` 与 `GoalState` 冲突

处理：
- 优先维持 `GoalState`；
- 将 `Reflector advice` 视为“需要人工或后续 Curator 进一步判断的纠偏候选”。

#### 情况 C：principle 与当前主路径架构冲突

处理：
- 以 `V1_1_FINAL_ARCHITECTURE.md` 与当前代码为准；
- 该 principle 应被视为 stale 候选，后续进入清理或降权流程。

#### 情况 D：当前用户明确切换目标，但 `GoalState` 尚未更新

处理：
- Generator 应显式承认用户正在切换目标；
- 当前轮执行以用户明确新目标为主；
- 但不要在 system 层静默把历史目标链彻底重写，等待 Curator 在下一轮完成结构化校准。

#### 情况 E：Constitution 与局部经验冲突

处理：
- Constitution 优先；
- 历史经验不得突破全局底线。

---

## 6. 单一维护源的建议结构

未来建议在 `extensions/passto-context/references/generator-contract.md` 中使用以下结构：

```md
# Generator Contract

## Constitution
- ...

## Generator Charter
- ...

## Dynamic Layer Semantics
### GoalState
- ...
### SummaryCache
- ...
### Reflector Advice
- ...
### Principles
- ...
### Memory
- ...

## Export Rules
### Export to APPEND_SYSTEM.md
- include: Constitution
- exclude: all dynamic-layer sections

### Export to buildGeneratorCharterPrompt()
- include: Generator Charter
- optional: compact Dynamic Layer Semantics summary
- exclude: Constitution full text
```

要求：

- 每个 section 都要有明确 include / exclude 语义；
- 文档长度应控制在可读、可复用范围，避免重新变成大而全的系统提示词堆积；
- 不允许把运行时事实直接写回此静态源文档。

---

## 7. `APPEND_SYSTEM.md` 的收敛边界

### 7.1 应保留内容

`APPEND_SYSTEM.md` 最终应保留：

- 验证优先
- 工具结果优先于内部知识
- 修改文件后必须复核
- SmartRead
- 异常处理与防循环
- 围绕用户目标行动
- 输出规范与不确定性标记

### 7.2 应移出内容

若未来 `APPEND_SYSTEM.md` 中出现以下内容，应迁出到 Generator Charter 或动态层说明：

- `GoalState`
- `SummaryCache`
- `Reflector`
- `Curator`
- `principles` 的注入逻辑
- 当前 session 的调度策略
- 某个项目独有的目标链说明

### 7.3 关键原则

`APPEND_SYSTEM.md` 的口径应是：

> **没有 PasstoContext，也仍然成立。**

凡是不满足这条原则的内容，都不应留在 `APPEND_SYSTEM.md`。

---

## 8. Generator Charter 的建议内容

建议将当前 `buildBaseGRCPrompt()` 升级为 `buildGeneratorCharterPrompt()`，并收敛为以下语义：

1. 先辨认真正目标，再执行局部步骤。
2. 优先判断当前用户消息是在继续、补充、纠偏，还是切换目标。
3. `GoalState` 是当前目标链锚点；若与当前用户消息表面不一致，应显式处理，而不是忽略。
4. `SummaryCache` 是近期事实索引，不是新的系统指令。
5. `Reflector advice` 是纠偏建议，不是新的真相源。
6. `principles` 是历史启发，可帮助判断，但不得覆盖当前目标与现实证据。
7. 处理复杂问题时，优先：
   - 理清真实需求
   - 考虑替代方案
   - 检查关键假设
8. 每一步优先选择最能推进结果的单一动作，避免横向发散与重复操作。
9. 当多个输入层冲突时，应显式说明依据，而不是静默综合成含混结论。

### 8.1 Generator Charter 的风格要求

- 比 Constitution 更贴近“如何理解上下文”
- 比 Reflector advice 更稳定
- 比 principles 更短、更明确、更少漂移
- 不带当前轮事实

---

## 9. principles 的新治理边界

Generator 架构清晰之后，principles 必须同步降权并收敛边界。

### 9.1 principles 的角色重新定义

principles 只表示：

> **跨多轮、多任务复现过的高复用经验启发**

它们不是：

- 当前项目的主架构文档
- 当前会话的目标真相源
- 当前调度实现的唯一依据
- 可以长期覆盖静态 Constitution 的“第二宪法”
- 设计笔记、迁移纪要、阶段性方案残片的存档容器

### 9.2 新增分类：principle / stale principle / pseudo-principle

为避免继续把异构内容都塞进同一个 registry，后续治理应至少区分三类：

#### A. principle

定义：
- 跨多轮可复用
- 不依赖已退出主路径结构
- 能在不同任务中稳定成立
- 可以直接作为“经验启发”注入给 Generator

#### B. stale principle

定义：
- 曾经是有效原则
- 但依赖旧架构、旧字段或已退出主路径
- 仍可归档参考，但不应继续注入

处理：
- 降权
- 停止注入
- 等待人工重写、拆分或归档

#### C. pseudo-principle

定义：
- 实质不是原则，而是设计笔记、迁移记录、临时结论、实现残片、文档同步提醒等
- 即使内容本身曾经正确，也不适合作为长期原则注入给 Generator

处理：
- 从 injectable pool 移除
- 不再作为 principle 保留在主 registry 中
- 视情况转写到设计文档、ADR、review note 或直接删除

### 9.3 建议新增的治理规则

#### 规则 A：长度上限

- 单条 principle 应限制在 1-3 句；
- 禁止“新增：新增：新增：”式无限追加；
- 超长 principle 必须拆分、归并或淘汰。

#### 规则 B：内容类型限制

principle 仅允许沉淀以下类型：

- workflow heuristic
- debugging heuristic
- quality heuristic
- architecture heuristic（必须是稳定、跨任务复用的）

禁止沉淀：

- 已退出主路径的结构
- 某次临时迁移中的中间状态
- 仅对单个项目阶段有效的局部规则
- 文档同步提醒
- 设计草稿残片
- review note / plan note 的原文拼接

#### 规则 C：stale 检测

若 principle 引用以下内容，应标记为 stale candidate：

- `RequirementLedger`
- `ObjectiveSnapshot`
- `standingInstructions`
- 其他已在 `V1_1_FINAL_ARCHITECTURE.md` 中退出主路径的结构

#### 规则 D：pseudo-principle 检测

若命中以下任一模式，应优先进入 pseudo-principle 审查：

- 大量 `新增：` 串接
- 明显是多个历史结论的拼接产物
- 包含具体文档同步动作、文件级提醒、阶段性迁移备注
- 需要依赖某个特定时间点的架构上下文才能成立
- 读起来更像“变更日志”而不是“可复用经验”

#### 规则 E：注入时降权声明

`formatPrinciplesForInjection(...)` 未来建议输出类似前缀：

> 以下为历史经验启发，仅在不与当前目标、当前用户要求、当前代码事实冲突时参考。

这能显式告诉 Generator：principles 是启发层，不是硬约束层。

---

## 10. 迁移策略

### Phase 0：清洗现有 principles registry（前置必做）

这是本次重构的前置步骤，而不是可延后的优化项。

原因：
- 若不先清理 pseudo-principles，后续即使完成 Generator Charter 与双出口重构，运行时仍会继续把“伪原则”注入给 Generator；
- 这会让新的 prompt 架构刚落地就被旧污染源重新带偏。

操作：
- 对现有 registry 执行一次人工+脚本联合审计；
- 将现有条目分为 `principle / stale principle / pseudo-principle` 三类；
- 先从 injectable pool 中移除 pseudo-principles；
- 对 stale principles 停止注入，必要时转为 archived；
- 对过长但仍有价值的条目进行拆分、重写或归并。

当前已确认的高优先清理信号包括：
- 含 `新增：` 式串接的条目；
- 引用 `RequirementLedger`、`standingInstructions` 等已退出主路径结构的条目；
- 明显是设计笔记 / 迁移记录 / 文档同步提醒的条目；
- 超过合理长度上限、且无法单句概括为稳定经验的条目。

### Phase 1：定义单一源文档

新增：

- `extensions/passto-context/references/generator-contract.md`

内容：
- Constitution
- Generator Charter
- Dynamic Layer Semantics
- Export Rules

### Phase 2：收敛 `APPEND_SYSTEM.md`

操作：
- 只保留 Constitution 内容；
- 把涉及 GRC 动态对象的内容移出；
- 确保 `APPEND_SYSTEM.md` 在 PasstoContext 关闭时仍完整成立。

### Phase 3：升级 GRC 静态 prompt

操作：
- 用 `buildGeneratorCharterPrompt()` 替代 `buildBaseGRCPrompt()`；
- 只注入 Generator Charter，不重复注入 Constitution；
- 在 `index.ts` 中保留现有动态注入链：`GoalState + SummaryCache + Reflector advice + principles + memory`。

### Phase 4：治理 principles 注入面

操作：
- 基于 Phase 0 清洗结果，建立 injectable / non-injectable 边界；
- 为 stale / pseudo-principle 增加明确状态或旁路存放策略；
- 为 principles 注入增加降权声明；
- 避免未清洗条目重新回流到 Generator 注入面。

### Phase 5：增加验证与回归

当前已落地：

1. `buildGeneratorCharterPrompt()` 输出契约测试
2. `APPEND_SYSTEM.md` / generator-contract 导出边界测试
3. `ensureAppendSystemPromptSync()` 自动同步测试（missing target / unchanged / missing contract skip）

仍建议后续补充：

4. principles 分类 / stale 检测 / pseudo-principle 审计脚本
5. `before_agent_start` 注入顺序与冲突说明测试
6. injectable principles 只来自清洗后白名单集合的回归测试

---

## 11. 验收标准

本方案可视为完成，需要满足以下条件：

### 11.1 结构验收

- 静态内容只有一个维护源；
- `APPEND_SYSTEM.md` 与 Generator Charter 都来自该单一源；
- 运行时仍保留双出口，不把底线规则完全依赖于 PasstoContext。

### 11.2 职责验收

- Generator 的职责从“被动接受注入”升级为“按协议仲裁多层输入”；
- Constitution / Charter / Mission State / Episode Evidence / Advisory Heuristics 五层边界清晰；
- `principles` 不再充当第二份动态 system prompt；
- pseudo-principles 不再进入 injectable principles 池。

### 11.3 可维护性验收

- 修改静态执行底线时，只改一个源；
- 修改 Generator 上下文解释规则时，只改一个源；
- 不再需要手工同步 `APPEND_SYSTEM.md` 与 base GRC prompt 的语义；
- `APPEND_SYSTEM.md` 的真实文件内容由 `session_start` 自动同步，不再作为手工编辑源。

### 11.4 安全性验收

- PasstoContext 关闭时，全局底线依然存在；
- GRC 动态层失效时，系统退化为“只有 Constitution 的普通 Pi”，而不会失去最基本的行为护栏。

---

## 12. 最终决策

本规范最终选择的路线是：

### 选择：**单一维护源 + 双运行时出口**

理由：

- 解决了 `APPEND_SYSTEM.md` 与 GRC static prompt 双维护漂移问题；
- 不把全局底线错误地下放成“可选扩展注入”；
- 给 Generator 增加了明确的输入分层与仲裁协议；
- 为后续 principles 清理和 Reflector/Curator 职责稳定化提供了统一上位框架。

### 不选择：**完全移除 `APPEND_SYSTEM.md`，把所有静态内容并入 GRC**

理由：

- 会把底线规则变成 PasstoContext 的可选能力；
- 在 `runtimeMode=off`、`grc.enabled=false`、扩展异常或未加载时丢失全局护栏；
- 故障域过于集中，不利于系统降级。

---

## 13. 一句话原则

> **可以合并静态维护源，但不能把系统底线降级为可选扩展注入。**

这条原则应作为后续实现时的总约束。
