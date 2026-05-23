# runtime minimal JSON shape（草案）

日期：2026-05-21
状态：draft
目的：在进入 `scripts/*` 之前，先把 passto-desk runtime contract 中已相对稳定的最小字段集收敛成统一 JSON-like shape，作为 shared state、transform、validate 与 next-round control 的最小桥梁。

---

## 1. 适用范围

本文件不追求完整 schema，也不试图覆盖所有可选字段。

它只定义当前最适合先进入脚本层的最小结构：
- `SharedSemanticState`
- `TransformOutput`
- `ValidationResult`
- `NextRoundDecision`

目标是先解决：
- 命名收敛
- 字段边界收敛
- delta / result / decision 层级收敛

---

## 2. 命名约束

在最小 JSON shape 中，统一采用以下原则：

### 2.1 transform 阶段只产出 `*Delta`
允许：
- `semanticDelta`
- `viewDelta`
- `mappingDelta`
- `visualDelta`

不建议在 transform 阶段继续混用：
- `reconstructedSemanticDelta`
- `stateDelta`
- `updatedState`

### 2.2 persist 之后才出现 `updatedState`
- transform / parse / validate 阶段不应提前产出“已提交状态”
- 只有 persist 完成后，才应出现 `updatedState`

### 2.3 异常 / 风险相关字段统一
固定字段集：
- `ambiguities`
- `warnings`
- `conflicts`
- `confidence`

### 2.4 action 语义区分
- `recommendedAction`：validate / transform 给出的动作建议
- `action`：next-round decision 的最终动作

---

## 3. SharedSemanticState

```json
{
  "semantic": {
    "objects": [],
    "relations": [],
    "ambiguities": [],
    "warnings": []
  },
  "view": {
    "mode": "explain-first",
    "visibleObjectIds": [],
    "visibleRelationIds": [],
    "primaryPath": []
  },
  "mapping": {
    "objectToNode": [],
    "relationToEdge": [],
    "labelOwnership": []
  },
  "visual": {
    "layoutPolicy": {},
    "mechanismHints": [],
    "readabilityHints": []
  },
  "control": {
    "transformDirection": "forward",
    "currentRoundGoal": "",
    "validationStatus": "",
    "nextRoundHint": ""
  },
  "persistence": {
    "truthSources": [],
    "persistedArtifacts": [],
    "injectionSummary": {}
  }
}
```

### 最小必填要求

#### `semantic`
- `objects`
- `relations`

#### `view`
- `mode`
- `visibleObjectIds`
- `visibleRelationIds`

#### `mapping`
- `objectToNode`
- `relationToEdge`

#### `control`
- `transformDirection`

### 当前建议但可留空
- `ambiguities`
- `warnings`
- `primaryPath`
- `labelOwnership`
- `layoutPolicy`
- `mechanismHints`
- `readabilityHints`
- `truthSources`

---

## 4. TransformOutput

forward 与 reverse transform 统一使用同一个最小外壳，只通过：
- `control.transformDirection`
- delta 内容差异

来区分来源。

```json
{
  "semanticDelta": {},
  "viewDelta": {},
  "mappingDelta": {},
  "visualDelta": {},
  "sceneProposal": {},
  "ambiguities": [],
  "warnings": [],
  "conflicts": [],
  "confidence": {},
  "recommendedAction": "persist"
}
```

### 说明

#### `semanticDelta`
用于承载：
- object additions / updates
- relation additions / updates
- note / annotation / group / lane 增量

#### `viewDelta`
用于承载：
- mode
- visibleObjectIds / visibleRelationIds
- primaryPath
- primaryNarrative

#### `mappingDelta`
用于承载：
- objectToNode proposals
- relationToEdge proposals
- labelOwnership proposals

#### `visualDelta`
用于承载：
- layoutPolicy updates
- mechanismHints
- readabilityHints

#### `sceneProposal`
用于承载：
- new scene
- scene patch
- local rebuild proposal

#### `ambiguities`
多解释并存、尚未定案的项。

#### `warnings`
不一定冲突，但当前轮存在风险、质量隐患或待修补项。

#### `conflicts`
与 `currentState` / `truthSources` / `mapping` 明显冲突的项。

#### `confidence`
可同时支持：
- overall confidence
- per-object confidence
- per-relation confidence

### 推荐 action 枚举

```json
[
  "persist",
  "retry",
  "local-rebuild",
  "full-rebuild",
  "human-review",
  "stop"
]
```

---

## 5. ValidationResult

```json
{
  "status": "pass",
  "findings": [],
  "confidence": {},
  "recommendedAction": "persist"
}
```

### `status` 枚举

```json
[
  "pass",
  "soft-fail",
  "hard-fail"
]
```

### `recommendedAction` 枚举

```json
[
  "persist",
  "retry",
  "local-rebuild",
  "full-rebuild",
  "human-review",
  "stop"
]
```

### 含义
- `pass`：可进入 persist
- `soft-fail`：当前结果有问题，但可通过 retry / local rebuild 修复
- `hard-fail`：当前结果不应 persist

---

## 6. NextRoundDecision

```json
{
  "action": "continue",
  "injectionPayload": {},
  "nextRoundHint": "",
  "carryForwardStateKeys": []
}
```

### `action` 枚举

```json
[
  "continue",
  "retry",
  "local-rebuild",
  "full-rebuild",
  "human-review",
  "stop"
]
```

### 含义

#### `continue`
当前状态已足以进入下一轮正常推进。

#### `retry`
本轮接近可用，但需轻量重试。

#### `local-rebuild`
局部结构或局部 scene 需重建。

#### `full-rebuild`
当前路径失稳，不宜继续 patch。

#### `human-review`
当前冲突、不确定性或风险超出自动推进阈值。

#### `stop`
当前目标已完成，或当前轮不应继续自动推进。

---

## 7. 四类结构之间的关系

### 7.1 SharedSemanticState
回答：
- 当前系统状态是什么

### 7.2 TransformOutput
回答：
- 当前轮 transform 候选产出了什么增量

### 7.3 ValidationResult
回答：
- 当前候选结果是否可以进入 persist，以及建议做什么

### 7.4 NextRoundDecision
回答：
- 下一轮是否继续、如何继续，以及要注入什么

也就是说：

```text
SharedSemanticState
  -> TransformOutput
  -> ValidationResult
  -> NextRoundDecision
```

---

## 8. 当前最适合开始脚本化的字段集

如果只选最小字段进入 `scripts/*`，建议优先：

### shared state
- `semantic.objects`
- `semantic.relations`
- `view.mode`
- `view.visibleObjectIds`
- `view.visibleRelationIds`
- `mapping.objectToNode`
- `mapping.relationToEdge`
- `control.transformDirection`

### transform output
- `semanticDelta`
- `viewDelta`
- `mappingDelta`
- `ambiguities`
- `warnings`
- `recommendedAction`

### validation
- `status`
- `findings`
- `recommendedAction`

### next round
- `action`
- `injectionPayload`

这组字段已经足够作为第一版 runtime 数据流桥梁。

---

## 8. 当前 scripts 已落地字段与 helper

截至当前，`scripts/runtime-contracts.mjs` 已经把这四类最小结构落成可创建 / 可校验 / 可桥接 / 可闭环提交的 helper。

### 已落地 skeleton / validate
- `createEmptySharedSemanticState`
- `createEmptyTransformOutput`
- `createEmptyValidationResult`
- `createEmptyNextRoundDecision`
- `validateSharedSemanticState`
- `validateTransformOutput`
- `validateValidationResult`
- `validateNextRoundDecision`
- `createSkeletonByKind`
- `validateByKind`

### 已落地 bridge / merge / control-loop helper
- `buildSharedStateSnapshot`
- `mergeSharedStateSnapshot`
- `buildValidationResult`
- `buildNextRoundDecision`
- `commitTransformResult`

### 当前最小闭环关系

```text
TransformOutput
  -> buildSharedStateSnapshot
  -> SharedSemanticState snapshot
  -> mergeSharedStateSnapshot
  -> merged SharedSemanticState
  -> buildValidationResult
  -> ValidationResult
  -> buildNextRoundDecision
  -> NextRoundDecision
```

### 当前真实脚本接入状态
- reverse: `scripts/excalidraw-to-domain-json.mjs`
  - 已产出 `runtime.transformOutput`
  - 已产出 `runtime.sharedStateSnapshot`
- forward: `scripts/domain-json-to-excalidraw.mjs`
  - 已产出 `customData.runtime.transformOutput`
  - 已产出 `customData.runtime.sharedStateSnapshot`

注意：截至当前，这两个真实 transform 脚本还没有统一直接调用 `commitTransformResult(...)`，而是先完成了 runtime metadata 对齐与最小 snapshot 接入。这是当前 docs 与 scripts 的真实一致状态。

---

## 9. 当前不建议过早脚本化的字段

以下字段当前仍适合作为可选或二阶段字段，不建议在第一版就做太重的强约束：
- `visual.layoutPolicy` 的完整细 schema
- `mechanismHints` / `readabilityHints` 的细粒度 taxonomy
- `per-element confidence` 的全量标准化
- `group / lane` 的完整 runtime shape
- `note / annotation` 的全量 target schema

这些后续可在 scripts 第二阶段再补。

---

## 10. 一句话总结

> 在 passto-desk 从 docs 走向 scripts 的第一阶段，最重要的不是一次性定完所有 schema，而是先把 `SharedSemanticState`、`TransformOutput`、`ValidationResult`、`NextRoundDecision` 四个最小 JSON-like 结构收敛稳定，并让 `runtime-contracts.mjs` 提供 bridge / merge / commit 的最小闭环骨架；当前这一步已经完成。
