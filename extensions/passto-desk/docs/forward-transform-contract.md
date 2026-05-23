# forward transform contract（草案）

日期：2026-05-21
状态：draft
目的：定义 passto-desk 从信息输入 / 当前状态出发，结构化为 object / relation semantic state，再桥接到 Excalidraw 视图的运行时 contract，明确输入、阶段、输出、验证重点与控制决策，避免系统退化为“从文本直接拼图元”。

---

## 1. 核心目标

forward transform 的目标不是“根据文字画一张图”，而是：

> **从信息输入中提取语义对象与对象关系，形成 shared semantic state 的增量或新状态，再根据当前 mode / view / mapping / visual policy 把它投影成可读、可编辑的 Excalidraw 视图。**

它必须解决的问题不是“图怎么摆”，而是：
- 当前轮真正应该产出哪些对象和关系
- 哪些关系应该进当前视图，哪些先隐藏
- 当前是 explain-first 还是 workbench
- 图只是 semantic state 的视图投影，不能跳过结构层

---

## 2. forward transform 的基本立场

### 2.1 输入文本不是直接图指令

用户输入、会话上下文、文件内容，都不应直接被当成 Excalidraw 元素的生成指令。

forward transform 的第一原则是：

> **先进入 semantic state，再进入图视图。**

也就是说：
- 文本不直接变 rectangle / arrow
- 语义对象与关系才是中间主状态
- 视图只是当前轮目标下的一次投影

### 2.2 forward transform 的结果不应只有 scene

forward transform 的结果至少应包括：
- semantic delta
- view decisions
- mapping decisions
- visual decisions
- warnings / unresolved ambiguities
- scene proposal 或 scene update

scene 只是结果之一，而不是唯一结果。

---

## 3. 输入 contract

## 3.1 主要输入

```text
ForwardTransformInput = {
  information,
  currentState?,
  truthSources?,
  control,
  runtimeHints?
}
```

### `information`
可能包括：
- 用户当前消息
- 当前会话上下文
- 本地文件 / 文档信息
- 历史对话摘要
- 当前任务目标

### `currentState?`
如果已有 shared semantic state，应作为增量更新依据：
- 避免每次从零生成
- 支持在同一工作台持续迭代
- 支持 explain-first → workbench 的逐轮演化

### `truthSources?`
用于说明：
- 当前信息依赖哪些现实来源
- 哪些是文本描述
- 哪些是已有 domain / scene / 文件
- 哪些是人工确认过的内容

### `control`
至少应包含：
- `transformDirection=forward`
- 当前 round goal
- 当前 mode
- 当前 decision stack / validation hints

### `runtimeHints?`
可选提供：
- 角色样式 hints
- 已知 object / relation ids
- 已知 lane / group 策略
- 已知 readability / mechanism policy

---

## 4. forward transform 的阶段

建议至少拆成 6 步。

## 4.1 Information extraction

从输入中抽取可结构化的信息单元，例如：
- object mention candidates
- relation mention candidates
- branch / condition hints
- note / annotation candidates
- grouping / sequencing hints
- unresolved ambiguities

输出：

```text
InformationSignals = {
  objectMentions,
  relationMentions,
  branchHints,
  noteMentions,
  groupingHints,
  ambiguityHints
}
```

关键要求：
- 不直接进入画图
- 先形成信息候选层

## 4.2 Semantic structuring

把信息候选组织成语义对象与关系：
- object candidates / updates
- relation candidates / updates
- note / annotation candidates
- group / lane candidates
- primary narrative candidates

输出：

```text
SemanticStructuringResult = {
  semanticDelta,
  ambiguities,
  warnings
}
```

关键要求：
- object / relation 是主产物
- 允许存在 ambiguity，不要为了完整性强行伪造结构

## 4.3 View decision

在 semantic state 基础上决定当前轮“给人看什么”。

要回答：
- 当前 mode 是 explain-first 还是 workbench
- visibleObjectIds / visibleRelationIds 是什么
- primary path 是什么
- 哪些分支显示，哪些隐藏
- 是否需要标题 / 摘要 / 开始入口 / 说明区

输出：

```text
ViewDecisionResult = {
  viewDelta,
  readabilityIntent,
  viewWarnings?
}
```

关键要求：
- 不要把所有对象和关系默认全量抬进首轮视图
- 解释图与工作台图的目标不同，必须在 view 层显式决策

## 4.4 Mapping decision

在 semantic + view 基础上，决定它们如何映射到 Excalidraw 视图。

要回答：
- object → node
- relation → edge
- label ownership 怎么表达
- note / annotation 如何落点
- 哪些语义要显式 fallback，而不是强行伪装成稳定结构

输出：

```text
MappingDecisionResult = {
  mappingDelta,
  mechanismRequirements,
  mappingWarnings?
}
```

关键要求：
- 这里是 semantic ↔ visual 的桥接层
- 不应被 `visual` 替代
- 也是 mechanism-first 的核心落点

## 4.5 Visual realization

在前述结构都明确后，才进入视觉实现：
- layout policy
- style policy
- node geometry
- edge routing
- note / annotation placement
- binding / anchor strategy

输出：

```text
VisualRealizationResult = {
  visualDelta,
  sceneProposal,
  readabilityFindings?,
  mechanismFindings?
}
```

关键要求：
- explain-first 要优先可读
- 但主干仍需 mechanism-first
- workbench 更强调结构稳定与可回读

## 4.6 Hand-off to control loop

forward transform 本身不直接宣布结果成立。

它的产物应进入：
- parse
- validate
- persist / inject decision

也就是说：

> forward transform 的产物默认是“候选状态更新 + 候选视图提案”，不是自动真相。 

---

## 5. 输出 contract

建议输出结构如下：

```text
ForwardTransformOutput = {
  semanticDelta,
  viewDelta,
  mappingDelta,
  visualDelta,
  sceneProposal?,
  ambiguities,
  warnings,
  confidence,
  recommendedAction
}
```

### 5.1 `semanticDelta`
至少应包含：
- object additions / updates
- relation additions / updates
- note / annotation additions / updates
- group / lane additions / updates

### 5.2 `viewDelta`
至少应包含：
- mode
- visibleObjectIds
- visibleRelationIds
- primaryPath?
- primaryNarrative?

### 5.3 `mappingDelta`
至少应包含：
- objectToNode proposals
- relationToEdge proposals
- label ownership proposals
- target binding proposals

### 5.4 `visualDelta`
至少应包含：
- layout policy updates
- style policy updates
- mechanism hints
- readability hints

### 5.5 `sceneProposal?`
可选包含：
- 新 scene
- scene patch
- 局部重排方案

### 5.6 `recommendedAction`
至少允许：
- `persist`
- `retry`
- `local-rebuild`
- `full-rebuild`
- `human-review`
- `stop`

---

## 6. Explain-first 与 Workbench 在 forward 中的差异

## 6.1 Explain-first
forward transform 中更强调：
- 先形成可读主干
- visible set 收缩
- primary path 显式
- 标题 / 摘要 / 开始入口明确
- 主干 mechanism-first，次要信息延后

因此：
- view 决策比全量 semantic 展示更重要
- visual realization 更强调阅读入口与主次层级

## 6.2 Workbench
forward transform 中更强调：
- semantic / mapping / visual 一致性
- domain state 可持续维护
- scene 与 semantic core 可回读、可重建
- 结构显式性高于首轮讲解感

因此：
- mapping 决策与 control 可持续性更重要
- scene proposal 更应服务后续增量修改

---

## 7. mechanism-first 在 forward 中的要求

forward transform 必须显式支持以下机制约束：

### 7.1 主干节点
- 优先容器主体 + 绑定文本
- 不默认依赖独立 text + 手工摆位

### 7.2 主干关系
- 优先绑定起止对象
- 不默认用自由箭头替代

### 7.3 关键分支标签
- 应有 relation ownership
- 不应退化为纯游离文字

### 7.4 锚点策略
- 应有稳定的上下左右锚点偏好
- 不应让主干关系完全依赖随机接边

---

## 8. 何时可以自动写回，何时不能

## 8.1 可自动进入 persist 的条件

至少满足：
- semanticDelta 成形
- 当前 view 决策符合 round goal
- mapping 可建立
- visual realization 未破坏 mechanism-first 主干要求
- 无严重 unresolved ambiguity

## 8.2 不应直接写回的条件

出现以下任一情况时，不应直接把 forward 结果当真相写回：
- semanticDelta 大量依赖模糊推断
- 当前 mode 未决，导致 view 目标不清
- mapping 无法闭合
- 主干实现退化为纯视觉拼贴
- sceneProposal 虽“好看”但无法回读或后续稳定修改

这时应输出：
- `retry`
- `local-rebuild`
- `human-review`
- 或 `stop`

---

## 9. 与 shared semantic state contract 的关系

forward transform 最依赖以下部分：
- `semantic`
- `view`
- `mapping`
- `visual`
- `control.transformDirection=forward`
- `persistence.truthSources`

这意味着 shared state contract 中：
- `view` 不是附属层，而是首轮表达策略的显式状态
- `mapping` 不是渲染细节，而是桥接真相
- `visual` 不能跳过 `semantic` / `view` 直接主导 scene

---

## 10. 最小失败策略

### information extraction failure
- 无法抽出稳定 object / relation mention
- 输出 `stop` 或请求补充信息

### semantic structuring soft-fail
- 可抽出部分结构，但主干不稳
- 输出 `retry` 或 `human-review`

### view failure
- 无法判断 visible set / primary path
- 输出 `retry` 或 `local-rebuild`

### mapping failure
- 语义可理解，但无法稳定映射到 node / edge
- 输出 `local-rebuild` 或 `human-review`

### visual realization soft-fail
- 结构正确，但 sceneProposal 可读性差或机制不稳
- 输出 `retry` 或 `local-rebuild`

### forward hard-fail
- 当前轮输出无法形成可 validate 的候选结果
- 输出 `stop` 或 `full-rebuild`

---

## 11. 最小 contract 总结

如果只保留 forward transform 的最小要求，至少应成立：

1. 输入不只是文本，还应包含 currentState / truthSources / control
2. forward 必须先经过 information extraction 与 semantic structuring
3. view 决策必须显式决定当前 visible set 与 primary path
4. mapping 决策必须显式决定 object → node、relation → edge、label ownership
5. visual realization 必须服从 semantic / view / mapping，而不是反过来主导结构
6. forward 结果默认是候选状态更新，不是自动真相
7. 是否写回 shared state，必须交给 control loop 的 validate / persist decision

---

## 12. 下一步建议

在 forward contract 之后，可继续补：
- scripts 层 shared state JSON shape
- scripts 层 forward / reverse transform I/O shape
- scripts 层 control metadata / validation schema

---

## 13. 一句话总结

> forward transform 的本质，不是“从文本生成一张图”，而是先把信息提取并结构化为 object / relation semantic state，再显式决定 view / mapping / visual 如何投影到 Excalidraw；scene 只是候选结果之一，是否成为系统真相，必须交给 control loop 决定。
