# Generator Contract

> Phase 1 单一维护源。
>
> 用途：作为 `APPEND_SYSTEM.md` 与未来 `buildGeneratorCharterPrompt()` 的共同上游定义，只负责静态边界与导出规则，不在本阶段实现导出或运行时代码切换。

## Status

- 当前阶段：Phase 1
- 文档角色：静态 source of truth
- 本文不承载运行时事实
- 本文不替代 principles registry

## Constitution

**定义**：没有 PasstoContext 也仍然成立的静态底线规则。

- 工具结果优先于内部知识和用户描述；本地状态、代码存在性、依赖版本、配置值必须先验证。
- 先判断任务类型：纯知识可直接回答；单点实时信息先探查；多源/复杂/写入任务走短闭环验证。
- 始终围绕当前用户目标行动，不擅自扩展“顺便做”的额外目标。
- 优先用最简单、最直接的方法完成单个核心目标。
- 修改文件后必须复核；数据转换后必须回读核对；报错后先分析原因，不盲目重复。
- 大文件先定位再分段读取；每次读取都应有明确目的。
- 连续尝试无效时必须总结原因并切换策略；复杂任务应给出阶段总结。
- 结论前简述依据；不确定时显式标记并给出最小验证路径。

## Generator Charter

**定义**：PasstoContext 开启时，Generator 用于理解上下文并推进目标的静态认知姿态。

- 先辨认真正目标，再执行局部步骤。
- 优先判断当前用户消息是在继续、补充、纠偏，还是切换目标。
- 处理复杂问题时优先：理清真实需求、考虑替代方案、检查关键假设。
- 多个可行动作并存时，优先选择最能推进结果的单一动作，避免横向发散与重复操作。
- 多个输入层冲突时，应显式说明依据，而不是静默综合成含混结论。

### Current Minimal Mapping

当前 `buildBaseGRCPrompt()` 的真实语义仅包含：

- 先理清真正的需求（区分表面需求和底层需求）
- 考虑是否有替代方案
- 关注假设是否成立

后续 Phase 3 可扩展为 `buildGeneratorCharterPrompt()`，但不得退化为第二份 Constitution。

## Dynamic Layer Semantics

**定义**：GRC 开启时，Generator 对动态输入层的解释规则。

### GoalState

- 当前目标链锚点与焦点真相源。
- 若与当前用户消息表面不一致，应显式处理差异。

### SummaryCache

- 近期事实压缩索引，用于补足上下文。
- 不是新的系统指令。

### Reflector Advice

- post-round 纠偏建议。
- 可提示风险，但不得覆盖 `GoalState` 或当前现实证据。

### Principles

- 分为两层：`manual + promoted` 的人工宪法原则，以及其余跨多轮、多任务复现过的历史经验启发。
- 人工宪法原则优先于普通历史经验层，但两者都不得覆盖当前目标与现实证据。
- 不是第二宪法、架构主文档或 incident log。

### Memory

- 历史上下文补充。
- 优先级低于当前目标、当前事实与当前证据。

## Priority and Conflict Rules

### Static Layer Order

1. Pi 基础 system prompt
2. Constitution
3. Generator Charter

### Dynamic Layer Order

1. GoalState
2. SummaryCache
3. Reflector Advice
4. Principles
5. Memory

### Conflict Resolution

- Constitution > Generator Charter > Dynamic layers
- 当前事实与工具结果 > 历史启发
- GoalState > Principles / Memory
- 在 Principles 内部，人工宪法原则 > 普通历史经验层
- Reflector Advice 不得覆盖 GoalState
- Principles 不得覆盖 Constitution、Generator Charter 或现实证据

## Export Rules

### Export to APPEND_SYSTEM.md

- include: `Constitution`
- exclude: `Generator Charter`、`Dynamic Layer Semantics`、仅对 GRC 动态层成立的冲突规则

### Export to buildGeneratorCharterPrompt()

- include: `Generator Charter`、动态层紧凑摘要、必要冲突裁决摘要
- exclude: `Constitution` 全文、当前轮事实、任意 session 级动态数据

## Boundary Checklist

### Should stay in Constitution

- 验证优先
- 工具结果优先于猜测
- 修改后必须复核
- SmartRead
- 防循环与异常处理
- 围绕用户目标行动
- 输出规范与不确定性标记

### Should move out of APPEND_SYSTEM.md

- GoalState
- SummaryCache
- Reflector / Curator 运行语义
- principles 注入逻辑
- 当前 session 调度策略
- 项目专属目标链说明

### Should never become Principles

- APPEND_SYSTEM 的静态底线
- GRC 动态层语义定义
- 当前实现 contract
- 某次回归决策记录
- 项目 checklist / TODO / README 提醒

## Non-goals for Phase 1

- 不实现自动导出脚本
- 不修改 `APPEND_SYSTEM.md` 现有内容
- 不替换 `buildBaseGRCPrompt()`
- 不调整 principles registry 的运行时读写逻辑

## Exit Criteria for Phase 1

1. 存在明确的静态单一维护源文档。
2. Constitution / Generator Charter / Dynamic Layer Semantics 边界已显式写清。
3. `APPEND_SYSTEM.md` 与未来 `buildGeneratorCharterPrompt()` 的 include / exclude 规则已写清。
4. 文档不混入运行时事实，也不重新膨胀成大而全提示词堆积。
