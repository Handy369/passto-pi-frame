# shared semantic state contract（草案）

日期：2026-05-21
状态：draft
目的：为 passto-desk 的 forward transform、reverse transform、parse / validate / persist / inject control loop 提供统一共享状态形状（shared state shape）草案。

---

## 1. 核心目标

passto-desk 要从“图生成型 skill”升级为“以对象/对象关系为核心状态的双向运行时系统”，首先必须有一份统一的 shared semantic state contract。

没有这份 contract，就无法真正稳定支持：
- information -> semantic -> excalidraw 的 forward transform
- excalidraw -> semantic -> context/state 的 reverse transform
- parse / validate / persist / inject 的 control loop
- 下一轮 runtime context 的稳定注入

因此这份文档的目标不是定义最终 JSON Schema，而是先定义：
- 状态层级
- 每部分职责
- 必填 / 可选字段
- transform 与 control loop 依赖哪些字段

---

## 2. 总体结构

建议 shared semantic state 至少包含以下 6 个顶层部分：

```text
SharedSemanticState = {
  semantic,
  view,
  mapping,
  visual,
  control,
  persistence
}
```

其中：
- `semantic`：系统主语义状态
- `view`：当前轮面向人类/当前目标的视图范围与主干表达
- `mapping`：semantic ↔ visual 的桥接关系
- `visual`：布局、样式、实现约束
- `control`：当前轮运行控制状态
- `persistence`：持久化与注入相关元数据

---

## 3. `semantic`：主语义状态

这是整个系统的共享中枢，应被视为最核心部分。

### 3.1 结构建议

```text
semantic = {
  objects: ObjectState[],
  relations: RelationState[],
  notes?: NoteState[],
  annotations?: AnnotationState[],
  groups?: GroupState[],
  lanes?: LaneState[],
  ambiguities?: AmbiguityState[],
  warnings?: WarningState[]
}
```

### 3.2 必填字段

#### `objects`
每个 object 至少应包含：
- `id`
- `type`
- `title` / `label`
- `summary?`
- `sourceRefs?`
- `status?`
- `attributes?`

作用：
- 承载系统真正关心的语义对象
- 是 forward / reverse transform 的最小稳定单元

#### `relations`
每个 relation 至少应包含：
- `id`
- `fromObjectId`
- `toObjectId`
- `type`
- `label?`
- `condition?`
- `direction?`
- `sourceRefs?`
- `status?`

作用：
- 承载对象之间的显式关系
- 防止“靠位置表达关系”

### 3.3 可选字段

#### `notes`
用于：
- 补充说明
- 不适合放进主干节点的说明性文本

#### `annotations`
用于：
- 明确目标对象或目标关系的局部说明
- 比普通 note 更强调 target 归属

#### `groups` / `lanes`
用于：
- 表达结构分组
- 表达角色 / 阶段 / 区域区隔

#### `ambiguities`
用于：
- 记录 reverse transform 或抽取阶段的不确定性
- 显式保存“尚未决断”的语义

#### `warnings`
用于：
- 记录当前轮识别到的结构风险、映射风险或实现风险

### 3.4 为什么 `semantic` 必须是主状态

因为：
- 文本不是主状态
- scene 不是主状态
- prompt 不是主状态
- **semantic object / relation state 才是共享中枢**

---

## 4. `view`：当前轮视图状态

`view` 负责表达“这轮给人看什么、隐藏什么、主干是什么”。

### 4.1 结构建议

```text
view = {
  mode: "explain-first" | "workbench",
  currentGoal?: string,
  primaryNarrative?: string,
  visibleObjectIds: string[],
  visibleRelationIds: string[],
  primaryPath?: string[],
  branches?: BranchState[],
  notePlacements?: NotePlacementHint[],
  groupOrder?: string[],
  laneOrder?: string[],
  filters?: ViewFilterState
}
```

### 4.2 必填字段

#### `mode`
必须指明当前视图属于：
- `explain-first`
- `workbench`

这是很多策略判断的起点。

#### `visibleObjectIds` / `visibleRelationIds`
必须显式说明当前轮：
- 哪些对象进入视图
- 哪些关系进入视图

避免“首轮到底展示什么”全靠几何猜测。

### 4.3 可选字段

#### `primaryNarrative`
用于概括当前图主要在讲什么。

#### `primaryPath`
用于显式声明主干路径，而不是完全依赖布局推断。

#### `branches`
用于表达关键分支，而不必把所有 relation 都提升为同等地位。

#### `filters`
用于说明本轮隐藏规则，例如：
- 隐藏次要关系
- 只显示关键阶段
- 只展示某个 lane

---

## 5. `mapping`：semantic ↔ visual 桥接状态

`mapping` 是把 semantic state 投影到 Excalidraw 时最关键的一层。

### 5.1 结构建议

```text
mapping = {
  objectToNode: ObjectNodeMap[],
  relationToEdge: RelationEdgeMap[],
  noteToElement?: NoteElementMap[],
  annotationToElement?: AnnotationElementMap[],
  labelOwnership?: LabelOwnershipState[],
  targetBindings?: TargetBindingState[]
}
```

### 5.2 必填字段

#### `objectToNode`
至少需要：
- `objectId`
- `nodeId`
- `nodeRole`
- `containerBinding?`

#### `relationToEdge`
至少需要：
- `relationId`
- `edgeId`
- `fromNodeId`
- `toNodeId`
- `labelElementId?`
- `bindingState?`

### 5.3 关键意义

这层决定：
- 图上的节点属于哪个语义对象
- 图上的边属于哪个语义关系
- label 是否明确归属某条 relation
- 注释是否绑定到目标对象 / 边

没有 `mapping`，就会退化成：
- 只剩视觉图元
- 无法稳定 reverse transform
- 也无法验证 mechanism-first 实现是否成立

---

## 6. `visual`：视觉与实现状态

`visual` 负责 layout、style 与 mechanism realization policy。

### 6.1 结构建议

```text
visual = {
  layoutPolicy?: LayoutPolicyState,
  stylePolicy?: StylePolicyState,
  readabilityHints?: ReadabilityHintState[],
  mechanismHints?: MechanismHintState[],
  fallbackPolicy?: FallbackPolicyState
}
```

### 6.2 典型内容

#### `layoutPolicy`
例如：
- direction
- spacing
- lane gap
- primary axis
- annotation placement preference

#### `stylePolicy`
例如：
- decision / action / state / note 的角色样式
- 标题 / 摘要 / 说明区样式

#### `readabilityHints`
例如：
- 强化主干
- 控制首屏节点数
- 降低次要分支权重

#### `mechanismHints`
例如：
- 主干节点必须容器绑定文本
- 主干边必须绑定起止对象
- 关键分支 label 必须有 relation 归属
- 锚点优先上/下/左/右稳定策略

### 6.3 为什么 `visual` 不能替代 `mapping`

因为：
- `visual` 负责“怎么画”
- `mapping` 负责“画出来的东西属于谁”

两者职责不同，不能混用。

---

## 7. `control`：运行控制状态

`control` 负责承载当前轮的运行态控制信息。

### 7.1 结构建议

```text
control = {
  transformDirection: "forward" | "reverse",
  currentRoundGoal?: string,
  executionStep?: string,
  stepStatus?: "pending" | "running" | "done" | "failed",
  decisionStack?: DecisionState[],
  validationStatus?: ValidationState,
  retryPolicy?: RetryPolicyState,
  rebuildFlags?: RebuildFlagState,
  nextRoundHint?: string,
  stopReason?: string
}
```

### 7.2 必填字段

#### `transformDirection`
必须明确当前轮是在做：
- `forward`
- `reverse`

否则 execution flow 会含糊。

### 7.3 典型用途

- 记录当前轮目标
- 记录当前执行到哪一步
- 记录 validate 后是否需要 retry / rebuild
- 记录下一轮应注入什么信息

### 7.4 为什么 `control` 很重要

因为 passto-desk 后续要依赖：
- parse
- validate
- persist
- inject
- decide next round

如果没有 `control`，这些都只能散落在 prose 里。

---

## 8. `persistence`：持久化与注入元数据

这一层回答：哪些状态写到哪里、下一轮注入什么。

### 8.1 结构建议

```text
persistence = {
  truthSources?: TruthSourceState[],
  lastUpdatedBy?: string,
  lastUpdatedAt?: string,
  persistedArtifacts?: PersistedArtifactState[],
  injectionSummary?: InjectionSummaryState,
  confidence?: ConfidenceState,
  auditTrail?: AuditRecordState[]
}
```

### 8.2 典型用途

#### `truthSources`
记录：
- 当前 semantic state 依据了哪些现实来源
- 文本、scene、domain file、人工编辑、外部证据各自占什么角色

#### `persistedArtifacts`
记录：
- 写回了哪些 domain / scene / metadata 文件
- 哪些只是临时控制结果

#### `injectionSummary`
记录：
- 下一轮应注入哪些关键信息
- 哪些状态应成为后续 context runtime 的组成部分

#### `confidence`
记录：
- 当前状态哪些高置信
- 哪些仍待确认

---

## 9. forward / reverse transform 分别依赖哪些部分

## 9.1 Forward transform 最依赖
- `semantic`
- `view`
- `mapping`
- `visual`
- `control.transformDirection=forward`

### Forward 最低要求
- semantic state 成形
- 当前视图范围明确
- mapping 可建立
- visual policy 不与 semantic 冲突

## 9.2 Reverse transform 最依赖
- `mapping`
- `semantic`
- `control.transformDirection=reverse`
- `persistence.truthSources`
- `ambiguities` / `warnings`

### Reverse 最低要求
- 能从 scene 信号回推出 object / relation candidates
- 能保留不确定性，而不是强行伪造结构确定性
- 能把重建结果写回 semantic state

---

## 10. parse / validate / persist / inject 对 contract 的要求

### parse
要求：
- 各层字段能被结构化读取
- 不依赖纯 prose 才能解释状态

### validate
要求：
- semantic 是否完整到可进入当前 transform
- mapping 是否存在断裂
- control 是否能说明当前轮状态
- persistence 是否足够支持下一轮注入

### persist
要求：
- 至少能判断哪些部分应写回 domain
- 哪些部分应写回 scene
- 哪些部分只作为控制元数据暂存

### inject
要求：
- 下一轮 context 不只继承文本
- 应继承 semantic / control / persistence 中的关键信息

---

## 11. 必填 / 可选最小总结

## 必填最小项

```text
semantic.objects
semantic.relations
view.mode
view.visibleObjectIds
view.visibleRelationIds
mapping.objectToNode
mapping.relationToEdge
control.transformDirection
```

这些字段构成最小共享 contract。

## 强烈建议但可选的项

```text
semantic.ambiguities
semantic.warnings
view.primaryPath
mapping.labelOwnership
visual.mechanismHints
control.validationStatus
control.nextRoundHint
persistence.truthSources
persistence.injectionSummary
```

这些字段将决定系统能否真正进入闭环运行态，而不是停留在“能画出图”。

---

## 12. 下一步建议

这份文档目前只定义 shared state shape 草案，下一步可继续拆成：

1. `forward-transform-contract.md`
2. `reverse-transform-contract.md`
3. `control-loop-contract.md`
4. 再决定哪些最终下沉为 scripts / schema / runtime metadata

---

## 13. 一句话总结

> passto-desk 的 runtime 化第一地基，不是更多 prompt 规则，而是一份统一的 shared semantic state contract：让 semantic / view / mapping / visual / control / persistence 六个部分共同承载 forward transform、reverse transform 与 parse-validate-persist-inject 闭环。
