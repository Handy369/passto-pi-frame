# PasstoContext v1.1 收敛版架构草案

> ⚠️ 归档提示：当前实现请**优先参考** `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`。
> 本文档保留为历史草案与收敛思路记录，不再单独作为当前代码实现依据。
>
> 状态：草案
> 目的：在**不立即修改现有主设计与代码**的前提下，给出一个更符合当前设计哲学的 v1.1 收敛方向。
>
> 收敛原则：
> - 删除：`RequirementLedger`、`ObjectiveSnapshot`
> - 保留：`GoalStateDocument`、`SummaryEntry`、`SummaryCache`、Summary 仓库检索
> - 核心重点：把 `GoalStateDocument` 设计成可表达**目标层级 / 目标分支 / 目标迁移**的工程化结构

---

## 1. 设计哲学（收敛前提）

当前 v1.1 更底层、更稳定的设计哲学不是：

- 罗列需求要素
- 维护 requirement taxonomy
- 长期保存约束/偏好/非目标/成功标准
- 维护一条持续累加的 branch 摘要主线

而是：

# 用户下一条回复，是对上一轮目标断言的定性信号。
# 这个信号决定：上一轮哪些信息仍值得保留在当前工作记忆里，哪些信息可以被遗忘。

因此，系统不应优先问：

- 要保留哪些摘要字段？
- 要不要维护一条长期 branch summary？
- 要不要保留一套 requirement ledger？

而应优先问：

- 当前最值得关注的目标是什么？
- 当前目标是由哪些目标逐步迁移、收敛而来的？
- 最新用户信号对上一轮目标是 `advance / correct / supplement / continue / clarify` 中的哪一种？
- 基于这个信号，哪些旧目标可以退出当前上下文？

这意味着：

## 单核应当是 `GoalStateDocument`

而不是：

- `RequirementLedger`
- `ObjectiveSnapshot`
- 再叠加一层额外长期摘要结构

---

## 2. 收敛后的最小保留结构

v1.1 收敛版只保留四块：

### 2.1 GoalStateDocument

职责：
- 当前目标单核真相源
- 目标层级 / 分支 / 迁移 / 完成状态
- 用户下一条反馈驱动的目标定性

它回答的是：

> 当前最值得关注的目标是什么？
> 这个目标是如何从过去的目标逐步演化而来的？

---

### 2.2 SummaryEntry

职责：
- 结构化事实摘要
- 记录某一轮发生了什么、客观完成了什么
- 保留能回到“真实现场”的索引指针

它回答的是：

> 如果以后需要追溯，当时到底发生了什么？去哪里找？

> 注意：这里**先不改变当前 SummaryEntry 设计**。它存在的主要价值就是：
> - 还原现场
> - 记录客观事实
> - 提供 session file / entry range / searchQuery 等指针

---

### 2.3 SummaryCache

职责：
- 最近 15 条 `SummaryEntry` 的滑动窗口
- 保留近期目标演进过程
- 避免每次都重读全部原始历史

它回答的是：

> 最近几轮目标是怎么推进、怎么迁移、怎么卡住的？

---

### 2.4 Summary 仓库检索

职责：
- 承接被弹出 `SummaryCache` 的历史 `SummaryEntry`
- 不常驻主上下文
- 由 LLM 在需要时通过工具按需检索
- 再根据 `SummaryEntry` 中的指针回到真实现场

它回答的是：

> 当前上下文里没有的旧历史，如果真需要，怎么精准找回来？

---

## 3. 明确删除的结构

### 3.1 RequirementLedger

删除原因：
- 它把系统重新拉回“需求工程账本”的方向
- 与当前“只关注目标断言与遗忘”的哲学不一致
- 与 `GoalStateDocument` 的目标状态表达高度重叠
- 形成第二个“当前真相源”风险

### 3.2 ObjectiveSnapshot

删除原因：
- 它本质上只是“当前目标锚点视图”
- 这一职责可直接从 `GoalStateDocument` 渲染得到
- 作为独立状态对象会与 `GoalStateDocument` 重复

> 如果仍需要“system prompt 目标锚点注入”，应把它实现为：
>
> `renderGoalAnchor(goalState)`
>
> 而不是保留一个独立持久化的 `ObjectiveSnapshot` 模块。

---

## 4. GoalStateDocument 为什么是单核

基于当前设计哲学：

- 目标才是最值得保留的上下文
- 用户下一句回复是对上一轮目标断言的定性
- 已完成目标的过程，大部分都可以遗忘
- 需要回溯时，不靠常驻上下文，而靠 `SummaryEntry` 仓库检索

所以：

## GoalStateDocument 应承担：

1. 当前有哪些目标仍值得保留在工作记忆里
2. 这些目标之间是什么层级关系
3. 某个目标是如何从其他目标迁移演变而来的
4. 哪些目标已经完成，可退出当前关注层
5. 用户最新一条反馈，对这些目标产生了什么定性影响

---

## 5. 关键问题：如何设计一个“递归的 GoalStateDocument”

你指出的关键点非常重要：

- 当前目标可能不止一个
- 目标之间有层级关系
- 同一大目标下会出现子目标 / 分支目标
- 当前对话正在聚焦的目标，可能只是更大目标树里的一个分支

例如：

```text
v1.1 主目标
└── 完成 GoalStateDocument 主设计
    ├── 澄清 RequirementLedger 是否保留
    ├── 澄清 ObjectiveSnapshot 是否保留
    └── 收敛 Delayed Curator 的时序语义
```

所以 `GoalStateDocument` 不能只是一个平铺 `active[]` 列表。

---

## 6. 工程化建议：不要用“嵌套递归对象”，而用“归一化树结构”

虽然概念上它是递归树，但工程实现不建议直接保存成深层 children 嵌套。

原因：
- diff 不稳定
- merge 困难
- restore / replay 不方便
- 局部更新代价高

### 推荐结构：树的归一化表示

```ts
interface GoalStateDocument {
  version: 1;
  agentRound: number;
  updatedAt: string;

  rootGoalIds: string[];
  currentFocusGoalId: string | null;

  goals: GoalNode[];
  migrations: GoalMigration[];
  prunedCount: number;
}

interface GoalNode {
  id: string;
  parentId: string | null;

  assertion: string;
  kind: "goal" | "subgoal" | "branch";
  status: "active" | "suspended" | "completed";

  sinceRound: number;
  lastConfirmedRound: number;
  completedAtRound?: number;

  signal: "explicit" | "inferred";

  priority: number;
  order: number;

  childrenCount?: number;
}

interface GoalMigration {
  fromGoalId: string;
  toGoalId: string;
  atRound: number;
  reason: string;
}
```

---

## 7. 为什么这种结构比嵌套 children 更好

### 7.1 更容易做局部更新
Curator 可以只更新：
- 某个 goal 的状态
- 某个 goal 的 parentId
- 新增一个 branch goal
- 新增一条 migration

而不用整棵树重写。

---

### 7.2 更适合持久化/恢复/replay
恢复时只要：
- 读出最新 `GoalStateDocument`
- 根据 `id / parentId` 恢复树视图

这和当前 `grc-curator-artifact` replay 的方式兼容性更好。

---

### 7.3 更适合“当前聚焦目标”这个概念
`currentFocusGoalId` 很关键。

因为上下文真正应该高亮的，不一定是全部 active goals，
而是：

# 当前最值得关注的那个目标节点

这点如果没有单独字段，LLM 很容易在多个 active goal 中失焦。

---

## 8. 这个 GoalStateDocument 如何支持“目标层级与迁移”

### 8.1 层级
通过：
- `parentId`
- `kind`
- `rootGoalIds`

表达：
- 顶层目标
- 子目标
- 某个分支目标

### 8.2 迁移
通过：
- `GoalMigration[]`

表达：
- 某个目标被细化为子目标
- 某个子目标演化成新的分支
- 某个原目标被替换成更准确的新目标

### 8.3 当前聚焦
通过：
- `currentFocusGoalId`

表达：
- 当前最该占用主上下文的是哪一个目标

这非常契合你“只关注目标”的原则。

---

## 9. 与用户下一条反馈的关系

这是收敛版设计的核心。

### Delayed Curator 在 `agent_end(N)` 处理 `round N-1`
输入：
- `round N-1` 的完整对话
- `round N` 的用户反馈信号（至少第一条用户消息）
- previous `GoalStateDocument`

输出：
- 更新后的 `GoalStateDocument`
- 一条 `SummaryEntry`
- 定性 `signal`

也就是说：

# 用户下一条消息，不是去更新一个 requirements ledger
# 而是去裁决 Goal 树里哪些节点继续活跃、哪些完成、哪些迁移

这和你的原始哲学是完全一致的。

---

## 10. SummaryEntry 在这个体系里的位置

你特别强调：

- 先不要改变 `SummaryEntry` 的存在价值
- 它是为了还原现场
- 记录客观事实

我同意，而且这很关键。

在收敛版架构里：

### GoalStateDocument
是当前工作记忆的**单核状态**

### SummaryEntry
是已被压缩/移出的历史片段的**可回溯索引**

所以：
- GoalStateDocument 不负责还原现场
- SummaryEntry 负责把现场线索保留下来

这两者不重复。

---

## 11. SummaryCache 的角色

`SummaryCache` 的角色也不应改变：

- 近 15 条 `SummaryEntry`
- 保留近期目标演进过程
- 当前很多目标仍在连续推进、还没完成
- 所以近期窗口非常重要

也就是说：

## GoalStateDocument = 当前目标态
## SummaryCache = 近期演进轨迹
## Summary 仓库 = 长期回溯索引

这是一个非常干净的三层分工。

---

## 12. 收敛版最终数据流

```text
用户输入 / 下一条用户反馈
  ↓
Delayed Curator
  ↓
  ├─ GoalStateDocument   (当前目标单核)
  ├─ SummaryEntry        (结构化事实 + 现场指针)
  └─ signal              (advance/correct/supplement/continue/clarify)

SummaryEntry
  ├─ push -> SummaryCache (最近15条)
  └─ evict -> Summary 仓库

before_agent_start
  ├─ render Goal anchor from GoalStateDocument
  ├─ inject GoalStateDocument
  ├─ inject SummaryCache
  └─ inject memory tool guidance

需要追溯旧历史时
  └─ LLM 通过 Summary 仓库检索 -> 根据 SummaryEntry 指针还原现场
```

---

## 13. 与当前实现相比，建议删除什么

### 删除
- `RequirementLedger`
- `RequirementLedgerEntry`
- `buildObjectiveSnapshotFromLedger()`
- `lastRequirementLedger`
- `lastObjectiveSnapshot`
- `grc-requirement-ledger` 持久化链

### 保留并加强
- `GoalStateDocument`
- `SummaryEntry`
- `SummaryCache`
- `grc-curator-artifact`
- `passto-round-boundary`
- Summary 仓库检索工具链

### 替代
- `ObjectiveSnapshot` → 由 `GoalStateDocument` 直接渲染目标锚点注入文本

---

## 14. 一句话结论

如果忠实于当前真正的底层设计哲学：

> 用户下一条回复决定上一轮哪些目标断言继续保留、哪些可以遗忘；已完成目标的过程大多不应常驻上下文，而应通过 `SummaryEntry` 仓库按需回溯。

那么最合理的 v1.1 收敛版架构是：

# `GoalStateDocument` 单核 + `SummaryEntry` 历史索引 + `SummaryCache` 近期窗口 + Summary 仓库检索

并明确删除：

# `RequirementLedger` 与 `ObjectiveSnapshot`
