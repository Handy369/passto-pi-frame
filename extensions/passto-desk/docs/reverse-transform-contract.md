# reverse transform contract（草案）

日期：2026-05-21
状态：draft
目的：定义 passto-desk 从 Excalidraw scene / 共享白板状态回译到 shared semantic state 的运行时 contract，明确输入、信号、歧义处理、输出结构与控制决策，避免把 scene 误当成语义真相源。

---

## 1. 核心目标

reverse transform 的目标不是“读取图上有什么元素”，而是：

> **从 scene 中提取结构线索，重建 object / relation semantic state，并把结果安全地注入 shared state 与后续 control loop。**

它必须解决的问题不是“怎么把 elements 转成 JSON”，而是：
- scene 中哪些是可用信号
- 哪些只是视觉痕迹
- 哪些语义可高置信重建
- 哪些必须保留为 ambiguity / warning
- 哪些情况下不能自动写回 semantic truth

---

## 2. reverse transform 的基本立场

### 2.1 scene 不是语义真相本身

Excalidraw scene 可以提供强信号，但不应被直接等同于：
- semantic truth
- object graph truth
- relation truth

因为 scene 中可能存在：
- 漂浮文字
- 未绑定箭头
- 手工摆放的相邻元素
- 历史残留元素
- 视觉装饰
- 局部补丁修改

因此 reverse transform 的第一原则是：

> **scene 提供的是 reconstruction signal，不是直接 truth。**

### 2.2 reverse transform 的结果应允许不确定

reverse transform 不应强行把所有元素解释成确定结构。

它必须允许输出：
- `ambiguities`
- `warnings`
- `confidence`
- `recommendedAction`

这样系统才不会为了“自动化”而伪造确定性。

---

## 3. 输入 contract

## 3.1 主要输入

```text
ReverseTransformInput = {
  scene,
  currentState?,
  truthSources?,
  control,
  runtimeHints?
}
```

### `scene`
至少包括：
- elements
- element types
- container / bound text
- startBinding / endBinding
- groupIds / frameId
- geometry / position / size
- style / role clues

### `currentState?`
如果已有 shared semantic state，应作为对照输入：
- 便于做差异回译
- 便于冲突检测
- 避免每次都从零重建

### `truthSources?`
用于说明：
- 当前 scene 的来源和可信度
- 是否存在人工改动
- 是否存在 domain file 作为并行真相源

### `control`
至少应包含：
- `transformDirection=reverse`
- 当前 round goal
- mode
- validation / rebuild policy hints

### `runtimeHints?`
可选提供：
- 已知 object ids
- 已知 relation ids
- 已知 role style policy
- 已知 mapping hints

---

## 4. scene 中哪些是信号

reverse transform 应区分“强信号”“弱信号”“仅视觉噪声”。

## 4.1 强信号（默认高优先级）

### container + bound text
当一个 text 绑定到容器时：
- 强烈暗示这是一个 object node
- text 通常可作为 title / label 候选

### edge start/end bindings
当 arrow 绑定两个对象时：
- 强烈暗示存在显式 relation candidate
- 若边上有 label，通常可作为 relation label 候选

### explicit mapping metadata（若存在）
如果 scene / domain 中存在 objectId / relationId 映射：
- 应优先使用
- 不要被几何猜测覆盖

### annotation target binding（若存在）
可作为 note / annotation target 的高置信线索。

## 4.2 弱信号（需谨慎解释）

### proximity / spatial adjacency
- 两个元素离得近，不自动等于语义关联
- 只能作为辅助线索

### alignment / reading order
- 上下或左右排列可能暗示主干
- 但不应直接替代 relation existence

### style similarity
- 相同颜色 / 相同 shape 可能暗示同类角色
- 但不是 object identity 的充分条件

### groupIds / frame / visual enclosure
- 可能暗示结构分组
- 但需要和文本、绑定、已有 state 一起判断

## 4.3 视觉噪声 / 不可直接当语义的信号

以下内容默认不能直接升格为 semantic truth：
- 单纯的装饰线条
- 孤立背景块
- 无 target 的 free text
- 纯几何相邻但无任何绑定的图形
- 历史残留的孤立元素

---

## 5. reverse transform 的阶段

建议至少拆成 6 步。

## 5.1 Scene signal extraction

从 scene 抽取：
- node-like candidates
- edge-like candidates
- label-like candidates
- note / annotation candidates
- group / lane / frame clues
- noise candidates

输出：

```text
SceneSignals = {
  nodeCandidates,
  edgeCandidates,
  labelCandidates,
  noteCandidates,
  groupingSignals,
  noiseCandidates
}
```

## 5.2 Candidate classification

对候选进行初步分类：
- object candidate
- relation candidate
- note candidate
- annotation candidate
- decorative / unresolved candidate

要求：
- 不要一开始就强行入 semantic state
- 保留 candidate 层，便于后续 validate

## 5.3 Semantic reconstruction

将候选重建为：
- `object candidates`
- `relation candidates`
- `note / annotation candidates`
- `group / lane candidates`

在此阶段应尽量利用：
- currentState
- known mapping
- truthSources
- style / role hints

输出仍应是候选重建结果，而不是最终真相。

## 5.4 Conflict & ambiguity detection

必须显式检测：
- 漂浮文字无法稳定归属
- 未绑定箭头无法确认 relation
- 同一元素可被多种解释
- 与 currentState 明显冲突
- 视觉结构和已有 semantic mapping 对不上

输出：
- `ambiguities`
- `warnings`
- `conflicts`

## 5.5 Reconstruction result assembly

将重建结果汇总为结构化候选输出。

## 5.6 Hand-off to control loop

reverse transform 本身不负责直接宣布真相成立。

它的结果应进入：
- parse
- validate
- persist / inject decision

也就是说：

> reverse transform 的产物默认是“候选重建结果”，而不是自动真相。 

---

## 6. 关键歧义类型与处理策略

## 6.1 漂浮文字

情况：
- text 不绑定任何 container
- 也不明显属于某条 edge

处理：
- 不自动认定为 object title
- 可先作为 `unattachedLabelCandidate` 或 `noteCandidate`
- 若与 nearby object / edge 高度相关，可降低置信度后提出候选归属

### 推荐动作
- low confidence attach
- 或 human review

## 6.2 未绑定箭头

情况：
- arrow 没有 startBinding / endBinding
- 仅靠几何接近某些节点

处理：
- 不自动认定为高置信 relation
- 可根据几何、方向、邻近对象提出 `relationCandidate`
- 默认置信度应低于显式绑定边

### 推荐动作
- ambiguous relation candidate
- 如果是主干关键边，优先 human review 或 local rebuild

## 6.3 位置暗示关系

情况：
- 两个节点上下/左右排列，但没有边

处理：
- 可作为 `orderingHint` 或 `primaryPathHint`
- 不应直接伪造 relation truth

## 6.4 边标签归属不明

情况：
- 文本靠近某条边，但没有显式 ownership

处理：
- 标记为 `labelOwnershipAmbiguity`
- 若仅靠位置判断，应降低置信度

## 6.5 与 currentState 冲突

情况：
- scene 表达出的结构与已有 semantic state 不同

处理：
- 不自动覆盖 currentState
- 先记录 `conflict`
- 由 validate / human review / rebuild decision 决定后续动作

---

## 7. 输出 contract

建议输出结构如下：

```text
ReverseTransformOutput = {
  reconstructedSemanticDelta,
  reconstructedViewDelta?,
  reconstructedMappingDelta?,
  ambiguities,
  warnings,
  conflicts?,
  confidence,
  recommendedAction
}
```

### 7.1 `reconstructedSemanticDelta`
至少应包含：
- object candidates / updates
- relation candidates / updates
- note / annotation candidates
- group / lane candidates

### 7.2 `reconstructedViewDelta?`
可包含：
- 新识别出的 primary path hint
- 当前 visible set 调整建议
- explain-first / workbench 下的视图差异提示

### 7.3 `reconstructedMappingDelta?`
可包含：
- object ↔ node 对应建议
- relation ↔ edge 对应建议
- label ownership 建议
- target binding 建议

### 7.4 `ambiguities`
必须显式结构化表达，例如：
- elementId
- ambiguityType
- candidateInterpretations
- confidence
- suggestedResolution

### 7.5 `confidence`
建议至少支持：
- per-object confidence
- per-relation confidence
- overall confidence

### 7.6 `recommendedAction`
至少允许：
- `persist`
- `retry`
- `local-rebuild`
- `full-rebuild`
- `human-review`
- `stop`

---

## 8. 何时可以自动写回，何时不能

## 8.1 可自动进入 persist 的条件

至少满足：
- 高置信 object / relation 重建为主
- 关键主干没有严重 ambiguity
- 与 currentState 没有不可解释冲突
- mapping 可基本闭合

## 8.2 不应直接写回的条件

出现以下任一情况时，不应直接把 reverse 结果当真相写回：
- 主干 relation 大量依赖几何猜测
- 标签归属普遍不明
- 多个关键节点没有稳定 title / object identity
- 与 currentState 存在明显结构冲突
- 无法判断 scene 中哪些是新编辑、哪些是历史残留

这时应输出：
- `human-review`
- 或 `local-rebuild`
- 或 `retry with stronger hints`

---

## 9. 与 shared semantic state contract 的关系

reverse transform 最依赖以下部分：
- `semantic`
- `mapping`
- `control.transformDirection=reverse`
- `semantic.ambiguities`
- `semantic.warnings`
- `persistence.truthSources`

这意味着 shared state contract 中：
- `mapping` 不是可有可无
- `ambiguities` 不是装饰字段
- `truthSources` 不是附属元数据

它们都是 reverse contract 成立的必要部分。

---

## 10. 最小失败策略

### reverse extraction failure
- scene 中无法提取稳定 signal
- 输出 `stop` 或 `human-review`

### reconstruction soft-fail
- 可提取部分结构，但主干不稳
- 输出 `retry` 或 `local-rebuild`

### reconstruction hard-fail
- scene 与 currentState 严重冲突
- 输出 `full-rebuild` 或 `human-review`

### mapping failure
- 无法把关键对象/关系映射回 node/edge
- 不应直接 persist

---

## 11. 最小 contract 总结

如果只保留 reverse transform 的最小要求，至少应成立：

1. 输入不只是 scene，还应包含 currentState / truthSources / control
2. scene 信号必须区分强信号、弱信号、噪声
3. reverse 的中间产物应先停留在 candidate 层
4. ambiguities / warnings / conflicts 必须显式输出
5. reverse 结果默认是“候选重建结果”，不是自动真相
6. 是否写回 semantic truth，必须交给 control loop 的 validate / persist decision

---

## 12. 下一步建议

在 reverse contract 之后，可继续补：
- `forward-transform-contract.md`
- shared state 中 mapping / ambiguity 的更细 schema
- scripts 层 reverse transform 的 I/O shape

---

## 13. 一句话总结

> reverse transform 的本质，不是“把 Excalidraw elements 读出来”，而是把 scene 当成 reconstruction signal source，在保留不确定性、冲突和置信度的前提下，回译出候选 semantic state，再交给 control loop 决定是否能进入系统真相。
