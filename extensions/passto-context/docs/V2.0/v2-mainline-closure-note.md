# V2.0 Mainline Closure Note

> 状态：Closed  
> 日期：2026-05-21

## 目标

这份说明不是再定义一套新的 V2.0，而是回答一个更现实的问题：

> **在 E1–E7 之后，PasstoContext V2.0 主线现在到底处于什么状态？**

结论是：

> **V2.0 主线已经完成第一轮 runtime 闭合。**

也就是说，系统已经不再停留在“文档设计存在、代码尚未承接”的阶段，而是已经把核心正式对象、运行时主消费链与关键闭环落到了代码、状态、restore/replay、注入与状态观测面中。

---

## 已闭合的主线

### 1. 双层对象层已落地

当前主链已正式承接：
- `UserGoalTreeDocument`
- `XNodeModelDocument`

并且围绕它们形成了：
- 当前用户目标焦点
- 每用户目标一个 x-node-model
- object-sidecar restore / replay / status surface

这意味着 V2.0 不再只是“GoalTree 上附加一些字段”的兼容设想。

### 2. soft policy projection 已落地

当前 `nextStepType` 已明确收口为：
- `XNodePolicyProjection` 的可见策略字段
- `before-agent-start` prompt 注入消费的一部分
- 状态 surface / replay 的稳定观测对象

这意味着系统没有走向硬调度器，而是维持了：

> **x-node-model → policy projection → LLM 主导判断下一步**

这条 V2.0 的核心哲学。

### 3. provisional overlay 已落地

当前轮 provisional anchor、下一轮 Curator 裁决、以及 subtree 级修正，已通过：
- `RuntimeProvisionalOverlay`
- `draftGoalOp`
- `draftDispositions`
- restore / replay / status / policy surface

形成正式闭环。

这意味着“当前轮识别 → 下一轮裁决 → 必要时重写 subtree”已经不再只是推演设计。

### 4. 双层 completion closure 已落地

当前已显式区分：
- local complete
- x-node-model complete
- user goal complete
- user goal tree complete

并把它们正式接入：
- state / sidecar
- restore / replay
- `before-agent-start`
- `/ptc status`

这意味着系统已经能从局部完成正确上升到用户目标树推进，而不是只停留在单节点完成语义。

### 5. proof-first runtime closure 已落地

当前 proof 已正式形成主链对象：
- `RuntimeProofRecord`
- `RuntimeProofSignal`
- `GRCState.curator.latestRuntimeProof/latestProofSignals`
- `XNodeModelDocument.latestRuntimeProof/latestProofSignals`

并已进入：
- Curator top-level 产出
- artifact / state / restore / replay
- `before-agent-start` / `/ptc status` / diagnostics
- provisional subtree disposition 后的一致性 reconcile

这意味着 proof 已正式从“文案附属物”升级为：

> **运行时主链对象。**

### 6. object-first 主消费链已收口

截至 E6 / E7 闭合，当前主消费链已经收口到：
- `UserGoalTreeDocument`
- `XNodeModelDocument`
- `XNodePolicyProjection`
- `RuntimeProvisionalOverlay`
- `RuntimeProofRecord / RuntimeProofSignal`

与此同时：
- `GoalTreeDocument`
- `certaintyAssessment`
- `runtimeDraftGoalState`

仍然保留，但已明确退为：
- compatibility bridge
- fallback-only projection
- replay-friendly bridge

---

## 当前不应再误判的事情

在这之后，不应再把当前 repo 误判为：
- “V2 还没实现”
- “对象真相源还没切换”
- “proof 还只是附属语义”
- “双层 completion 还只是计划”

这些判断在 E1–E7 闭合后都已经过时。

更准确的判断应是：

> **V2.0 主线已闭合，但系统仍处于有意识保留 compatibility bridge 的收口阶段。**

---

## 当前真正剩下的问题

主线闭合后，剩余问题已经不再是“要不要把主线对象做出来”，而转向：

### 1. compatibility 治理
- 如何防止 `GoalTreeDocument` / `certaintyAssessment` / `runtimeDraftGoalState` 重新膨胀回主对象
- 哪些 bridge 必须保留
- 哪些 bridge 可以继续 shrink

### 2. 回归与稳定性加固
- tmux / host timing / session jsonl 等真实环境抖动
- replay / reload / restore 的长期一致性
- fresh real session proof 的持续稳定

### 3. 主线文档真相源维护
- 顶层 V2 文档是否与代码事实同步
- 局部设计稿是否仍残留旧 gap 叙事
- 后续变更是否继续按五维口径组织

### 4. 后续演进边界
- 如果要进入新阶段，应围绕清晰主题推进：
  - compatibility shrink / retirement
  - benchmark / runtime reliability
  - status / diagnostics / surface quality
  - proof / replay / observability hardening
- 不应重新发明一套“V2 主线对象”

---

## 推荐下一步

V2.0 主线闭合之后，推荐下一步不是直接新开实现大阶段，而是进入 post-V2 hardening backlog 管理。

### 当前不需要立即执行的事项

以下事项**不阻塞 V2.0 主线完成**，也不建议在没有新证据时立刻大规模改代码：

1. **compatibility bridge 删除 / retirement**
   - `GoalTreeDocument`、`certaintyAssessment`、`runtimeDraftGoalState` 仍承担真实 adapter / fallback / replay-friendly bridge 职责。
   - 当前动作应是锁死边界、禁止新增主语义，而不是暴力删除。

2. **验证分层继续扩写**
   - smoke / strict 双层验证已经建立。
   - 当前动作应是维护分层口径，而不是继续无限增加测试入口。

### Post-V2 hardening backlog

| 优先级 | backlog | 当前动作 |
|---|---|---|
| P1 | compatibility bridge 治理 | 保留现有 bridge，冻结新增职责；新增目标、策略、proof、provisional 相关实现一律 object-first |
| P1 | 验证分层维护 | 保留 `test:grc` / `test:curator-replay` / `test:curator-replay:strict` / `test:regression:strict` 分工 |
| P2 | strict harness 维护性 | 后续按需抽出共享 Python 校验器，当前不阻塞 |
| P2 | 文档真相源维护 | 当代码事实改变 bridge 边界、release gate 或 proof surface 时同步更新 |

### 当前 release / pre-merge gate

```bash
npm --prefix extensions/passto-context run test:regression:strict
```

这条 gate 当前代表：

- `test:grc` 主链回归通过
- strict companion 对 round-2 object-rich curator artifact、policy/proof/status surface 与 replay 对齐契约通过

只有当上述 gate 失败，或后续变更触及 replay / restore / status / proof surface，才需要把 hardening backlog 提升为当前执行项。

---

## 一句话

> **V2.0 主线已经闭合；现在的重点不再是“把主线补出来”，而是守住 object-first 主链、治理兼容桥、稳固 runtime proof，并在此基础上决定后续演进。**
