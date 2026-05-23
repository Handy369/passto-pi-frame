# 废弃：Draft Goal Recognition / Provisional Anchor 设计

> 状态：Deprecated
> 日期：2026-05-22
> 替代文档：`architecture-v2.0.md`

---

## 1. 废弃原因

本文档原本讨论：

```text
当前轮识别到新用户目标
  ↓
建立 provisional anchor / draftGoalOp
  ↓
围绕 provisional user goal / x-node-model 执行
  ↓
下一轮 Curator confirm / revise / discard
```

这个设计已经被废弃，因为它把当前用户输入放入了 `userGoals` 之外的弱化路径，导致 V2.0 主流程出现以下问题：

1. **draftGoalOp 变成 userGoal 之外的另一种目标对象**
   - 这会制造“正式 userGoal”和“临时 draft goal”两套目标层。

2. **当前轮仍然慢一拍**
   - 如果 draft/provisional 只在 agent_end 后解析或下一轮注入，当前轮 Generator 仍然主要靠普通上下文执行。

3. **draft 语义被误解为弱执行**
   - draft 不应表示不执行、低优先级、等待确认后才执行。

4. **Curator 被误解为目标真相源**
   - 正确真相源是用户输入与执行证据；Curator 只是异步后验解释/维护机制。

5. **xNodeModel 被误解为一次性完整拆解树**
   - 正确口径中 xNodeModel 是 agent 的实时状态机，会随着执行持续生长和修正。

---

## 2. 新设计结论

V2.0 新口径是：

```text
不存在 draft 弱化版用户目标。
只有统一的 userGoal 对象，以及 userGoal 的不同状态维度。
```

核心对象：

```text
UserGoalTreeDocument
  └─ UserGoalNode
       ├─ executionState
       ├─ reviewState
       ├─ relationState
       └─ xNodeModelId
            ↓
XNodeModelDocument
  └─ XNode[]
```

其中：

- `executionState` 表示目标执行生命周期。
- `reviewState` 表示解释/复核阶段，例如 `generator_projected / curator_reviewed / user_confirmed`。
- `relationState` 表示目标与后续目标版本之间的关系，例如 `active / superseded / migrated / split / merged / reopened`。
- xNodeModel 是对 userGoal 的拆解、细化解释和执行状态记录，是 agent 的运行时状态机。

---

## 3. 新运行机制

正确流程不是：

```text
before_agent_start 先等后台识别目标
  ↓
再让主 LLM 执行
```

也不是：

```text
Generator 输出 draftGoalOp
  ↓
agent_end 后解析
  ↓
下一轮再进入 userGoalTree / xNodeModel
```

而是：

```text
用户输入
  ↓
before_agent_start 只注入上一轮状态与协议
  ↓
主 Generator 第一动作：识别当前输入对 userGoalTree 的影响
  ↓
直接提交 UserGoalProjectionOps
  ↓
持久化更新 UserGoalTreeDocument
  ↓
为新 userGoal 创建 xNodeModel 骨架，或复用并 patch 既有 xNodeModel
  ↓
Generator 围绕 currentFocusXNode 执行
  ↓
执行过程中持续细化 xNodeModel 状态机
  ↓
agent_end 后 Curator 异步复核和维护
```

---

## 4. 替代 draftGoalOp 的对象

废弃：

```text
DraftGoalOp
Provisional Anchor
RuntimeProvisionalOverlay 作为主对象
```

替代为：

```text
UserGoalProjectionOp
XNodeModelOp
applyUserGoalProjection
```

`UserGoalProjectionOp` 直接作用于统一的 userGoalTree：

```ts
type UserGoalProjectionOp =
  | { action: "create_user_goal"; goal: { assertion: string; reviewState: "generator_projected" }; reason: string }
  | { action: "update_user_goal"; targetUserGoalId: string; patch: object; reason: string }
  | { action: "switch_focus"; targetUserGoalId: string; reason: string }
  | { action: "complete_user_goal"; targetUserGoalId: string; evidence: string; reason: string }
  | { action: "reopen_user_goal"; targetUserGoalId: string; reason: string }
  | { action: "migrate_user_goal"; fromUserGoalId: string; toGoalPatch: object; reason: string }
  | { action: "split_user_goal"; sourceUserGoalId: string; newGoals: Array<{ assertion: string }>; reason: string }
  | { action: "merge_user_goals"; sourceUserGoalIds: string[]; targetGoal: { assertion: string }; reason: string };
```

重点：

```text
操作对象永远是 userGoal。
reviewState=generator_projected 也必须是 effective userGoal。
```

---

## 5. xNodeModel 的新定位

旧文档把 provisional x-node subtree 当作围绕 provisional anchor 的派生树。

新设计改为：

```text
xNodeModel 是 userGoal 的 agent 工作对象和运行时状态机。
```

创建新 userGoal 时，Generator 不需要完整生成整个 agent 递归目标树，只需要：

```text
创建 xNodeModel skeleton
  - 绑定 userGoalId
  - 创建 root XNode
  - 设置 currentFocusXNodeId
  - 初始化 why / what / flow / structure / runtimeProof
  - 初始化 policyProjection
```

后续在 agent 实际执行过程中，Generator 根据事实持续更新：

- 补充五维状态
- 生成子 xNode
- 推进 phase
- 记录 proof
- 修正执行路径
- 回归父节点
- 标记 completion

---

## 6. Curator 的新定位

Curator 不再是“把 draft 转正”的机制。

Curator 是：

```text
异步后验解释器 + userGoalTree 长期一致性维护者 + xNodeModel 后验校准者
```

Curator 可以更新任何状态的 userGoal，而不是只处理 draft/provisional：

- revise
- rollback
- migrate
- split
- merge
- discard
- reopen
- complete
- mark_reviewed
- adjust_focus

原因是：

```text
任何 userGoal 都只是用户输入历史的当前投影。
新的用户输入可以改变任何状态的目标。
```

---

## 7. 迁移说明

仍存在于代码或历史文档里的以下名字，只能作为兼容/迁移对象理解：

- `draftGoalOp`
- `DraftDisposition`
- `runtimeDraftGoalState`
- `RuntimeProvisionalOverlay`
- `provisional anchor`

它们不再代表 V2.0 的目标态主设计。

新实现应优先围绕：

```text
UserGoalTreeDocument
UserGoalProjectionOp
XNodeModelDocument
XNodeModelOp
applyUserGoalProjection
CuratorReconciliationOp
```

---

## 8. 最终结论

> 本文档已废弃。V2.0 不再采用 draftGoalOp / provisional anchor 作为主链设计。当前用户输入必须由主 Generator 在每轮第一动作直接投影到统一的 userGoalTree，并同步创建或更新对应 xNodeModel 状态机。Curator 只做异步复核与长期维护。完整新口径见 `architecture-v2.0.md`。
