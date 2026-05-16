# PasstoContext Curator 模块设计

> 版本：v1.2 | 状态：current | 更新：2026-05-14

---

## 1. 收敛结论

Curator 模块收敛为四块核心结构：

1. `GoalStateDocument`
2. `SummaryEntry`
3. `SummaryCache`
4. Summary 仓库检索

并明确删除：

- `RequirementLedger`
- `ObjectiveSnapshot`

原因不是"代码可以更少"，而是**设计哲学必须单核化**：

- `GoalStateDocument` 负责"当前目标状态"
- `SummaryEntry / SummaryCache / Summary 仓库` 负责"历史事实索引与现场还原"

两者分工明确，不再维护第二套"当前目标真相源"。

---

## 2. 底层设计哲学

### 2.1 不是"保留什么"，而是"可以遗忘什么"

本设计的核心不是传统摘要系统的：

- 提炼所有重要信息
- 保存需求要素清单
- 维护约束/偏好/非目标/成功标准账本

而是：

> 用户下一条回复，是对上一轮目标断言的定性信号。
> 这个信号决定：上一轮哪些信息仍值得保留在工作记忆中，哪些可以退出上下文。

因此系统优先回答的问题是：

- 当前最值得关注的目标是什么？
- 当前焦点目标属于哪条更大的目标链？
- 这个目标是如何从其他目标逐步迁移、细化、分支出来的？
- 用户最新信号对上一轮目标是 `advance / correct / supplement / continue / clarify` 中的哪一种？
- 基于这个信号，哪些历史目标应继续活跃，哪些可以挂起、完成或剪枝？

---

### 2.2 已完成目标的过程不应常驻上下文

对于已经完成的目标，长期保留在主上下文中的应是：

- 目标是什么（起点）
- 客观完成了什么（终点）
- 如果以后需要回溯，去哪里找真实现场（索引）

而不是：

- 当时比较过哪些方案
- 当时有哪些临时约束
- 过程中的中间推理与试错

因为这些因素通常已经被**现存代码 / 文档 / 产物**高度压缩吸收。若未来真要回溯，应通过 `SummaryEntry` 和 session 指针回到现场，而不是让这些细节长期驻留在工作记忆里。

---

### 2.3 SummaryEntry 不属于同一设计哲学层

`GoalStateDocument` 的哲学是：

- 聚焦当前目标
- 用下一条用户反馈裁决上一轮哪些目标信息应保留
- 主动剪掉非必要过程

而 `SummaryEntry` 的职责不同，它不是"当前目标状态"，而是：

- 记录客观事实
- 为未来回溯提供线索
- 指向当时 session 文件与具体 entry 范围

所以：

## GoalStateDocument = 当前目标单核
## SummaryEntry = 历史事实索引

两者互补，不重复。

---

## 3. RequirementLedger 与 ObjectiveSnapshot 状态

- `RequirementLedger`：已从主路径退出，不再维护。
- `ObjectiveSnapshot`：已从主路径退出，不再维护；若需要"目标锚点注入"，应通过 `renderGoalAnchor(goalState)` 从 `GoalStateDocument` 渲染得到。

---

## 4. 三层记忆定位

### 4.1 GoalStateDocument：当前目标态

职责：
- 当前最值得关注的目标单核
- 表达目标层级、分支与迁移
- 记录当前焦点节点
- 表达哪些目标仍活跃，哪些已完成或挂起

它回答的是：

> 当前要做什么？
> 这个当前目标是从哪里演化来的？

---

### 4.2 SummaryEntry：历史事实与现场指针

职责：
- 记录某一 agent-round 客观发生了什么
- 记录完成事项、关键决策、文件变更、阻塞
- 保留 session file / entry range / searchQuery 等现场指针

它回答的是：

> 如果以后需要还原这段历史，去哪里找？

---

### 4.3 SummaryCache：近期 15 条演进窗口

职责：
- 保存最近 15 条 `SummaryEntry`
- 为模型提供近期目标演进轨迹
- 让模型理解"最近几轮发生了什么变化"，而不必重读全部历史

它回答的是：

> 最近几轮目标是怎么推进、纠正、迁移的？

---

### 4.4 Summary 仓库：长期回溯索引

职责：
- 承接从 `SummaryCache` 弹出的历史条目
- 不常驻上下文
- 由 LLM 在需要时通过工具按需检索
- 再根据 `SummaryEntry` 指针回到原始现场

它回答的是：

> 当前上下文中没有的旧历史，如果真需要，怎么找回来？

---

## 5. GoalStateDocument 的核心定位

`GoalStateDocument` 不是：

- PRD 压缩版
- 需求清单容器
- 过程复盘对象
- 全量上下文归档

它只负责：

1. 当前有哪些目标仍值得保留在工作记忆里
2. 这些目标之间的层级关系是什么
3. 当前焦点节点是哪一个
4. 某个目标是如何从过去目标演化而来的
5. 哪些目标已经完成 / 挂起 / 被剪枝
6. 最新用户信号对目标树产生了什么影响

---

## 6. 关键问题：目标不是平铺列表，而是递归层级树

当前目标往往不是单一线性任务，而是层级化的。例如：

```text
v1.1 主目标
└── 完成 GoalStateDocument 主设计
    ├── 判断 RequirementLedger 是否保留
    ├── 判断 ObjectiveSnapshot 是否保留
    └── 设计归一化树结构
```

这说明：

- 当前目标可能很多
- 不同目标有父子关系
- 当前聚焦点可能只是更大目标树中的一个分支
- 子目标完成后，焦点需要回到父目标或迁移到兄弟目标

因此 `GoalStateDocument` 不能只用简单 `active[]` 平铺数组表达。

---

## 7. 工程化方案：归一化目标树结构

### 7.1 为什么不用深层嵌套 children

概念上目标树是递归的，但工程上不建议直接存成深层 `children[]` 嵌套对象。

原因：

- diff 不稳定
- 局部更新困难
- merge / replay 成本高
- 恢复树视图时不灵活
- 一个节点迁移 parent 时需要重写大块结构

因此建议采用**归一化树结构（normalized tree）**。

---

### 7.2 推荐类型定义

```ts
interface GoalStateDocument {
  version: 1;
  agentRound: number;
  updatedAt: string;

  /** 顶层目标 id 列表 */
  rootGoalIds: string[];

  /** 当前最值得占用主上下文的目标 */
  currentFocusGoalId: string | null;

  /** 目标节点表（归一化） */
  goals: GoalNode[];

  /** 目标迁移/演化记录 */
  migrations: GoalMigration[];

  /** 最近一次用户信号 */
  lastSignal?: GoalSignal;

  /** 本轮剪枝数量（debug） */
  prunedCount: number;
}

interface GoalNode {
  id: string;
  parentId: string | null;

  /** 当前目标断言 */
  assertion: string;

  /** 节点类型：主目标/子目标/分支 */
  kind: "goal" | "subgoal" | "branch";

  /** 生命周期状态 */
  status: "active" | "suspended" | "completed";

  /** 用户明确说出 or Curator/LLM 基于上下文推断 */
  signal: "explicit" | "inferred";

  sinceRound: number;
  lastTouchedRound: number;
  lastConfirmedRound: number;
  completedAtRound?: number;

  /** 同层级展示与聚焦排序 */
  priority: number;
  order: number;
}

interface GoalMigration {
  id: string;
  fromGoalId: string | null;
  toGoalId: string;
  type: "create" | "refine" | "split" | "pivot" | "resume" | "complete";
  atRound: number;
  triggerSignal: GoalSignalType;
  reason: string;
}

type GoalSignalType =
  | "advance"
  | "correct"
  | "supplement"
  | "continue"
  | "clarify";

interface GoalSignal {
  type: GoalSignalType;
  confidence: number;
  evidence: string;
}
```

---

### 7.3 为什么这个结构够用

它已经能表达：

- 一个大目标下面挂多个子目标
- 当前聚焦在哪个节点
- 某个子目标从父目标中被细化出来
- 某个分支目标完成后回收焦点
- 某个旧目标被新目标纠正或转向

并且：

- 恢复时只需按 `parentId` 重建树视图
- 更新时只需局部修改节点与 migration
- 不会因为树形嵌套而导致大范围重写

---

## 8. Curator 如何驱动 GoalStateDocument

### 8.1 执行时机与运行模型

`Curator` 在每次 `before_agent_start` 执行一次。

`Curator` 的实现实体是一个异步 LLM subagent。

本地运行时负责：

- 序列化 `previousRoundConversation`
- 提取 `currentUserMessage`
- 读取 `currentGoalState`
- 构造 `buildCuratorSubagentPrompt(...)`
- 通过 `executeTextCompletion(...)` 异步调用 Curator 模型
- 对返回结果执行 `parse / validate / persist / restore`

本地运行时不承担目标裁决与摘要生成语义。

`Curator` 同次执行输出：

- `SummaryEntry`
- `GoalStateDocument`
- `signal`

---

### 8.2 信号模型

外部信号集合固定为：

- `advance`
- `correct`
- `supplement`
- `continue`
- `clarify`

内部动作映射为：

| signal | Goal 树动作 |
|--------|-------------|
| advance | `complete` / `refine` / 焦点前移 |
| correct | `pivot` / 替换旧节点 / 焦点切换 |
| supplement | `split` / 新增子节点 / 新增同层节点 |
| continue | 保持 `active` / 深入当前分支 |
| clarify | 保持结构不变 / 等待更多信息 |

---

## 9. GoalState 分析框架与信号约束

### 9.1 角色约束

- 用户是目标定义与目标裁决的权威源
- Curator 是目标树维护者与压缩器
- GoalStateDocument 只记录目标断言、层级、迁移、生命周期与焦点

---

### 9.2 I-P-O-E 使用方式

I-P-O-E 仅作为 Curator 的分析框架使用：

- `Input`
- `Process`
- `Output`
- `Environment`

I-P-O-E 不进入 `GoalStateDocument` 持久化结构。

---

### 9.3 外部信号契约

外部信号固定为：

- `advance`
- `correct`
- `supplement`
- `continue`
- `clarify`

---

### 9.4 内部动作映射

- `advance` -> `complete` / `refine`
- `correct` -> `pivot` / `replace`
- `supplement` -> `split` / `append`
- `continue` -> `keep-active` / `deepen`
- `clarify` -> `hold`

---

### 9.5 推断写入规则

- 推断信息可以参与 Curator 分析
- 推断信息默认不写入 `GoalStateDocument`
- 需要写入时，节点必须标记 `signal: "inferred"`
- 用户后续显式修正时，优先执行覆盖、替换或迁移

---

## 10. SummaryEntry -> SummaryCache -> Summary 仓库的完整作用链

### 10.1 SummaryEntry

`Curator` 在每次 `before_agent_start` 执行时，针对上一轮 agent-round 同时产出：

- `SummaryEntry`
- `GoalStateDocument`

`SummaryEntry` 记录上一轮的客观事实与现场指针。

推荐结构：

```ts
interface SummaryEntry {
  agentRound: number;
  timestamp: string;

  sessionFile: string;
  sessionEntryRange: {
    startAgentEntryIndex: number;
    endAgentEntryIndex: number;
  };

  summary: {
    goal: string;
    completed: string[];
    keyDecisions: string[];
    filesChanged: Array<{
      path: string;
      action: "read" | "edit" | "write" | "bash";
    }>;
    status: string;
    blockers: string[];
  };

  sessionPointers: {
    file: string;
    searchQuery?: string;
  };
}
```

---

### 10.2 SummaryCache

`SummaryCache` 是一个纯脚本滑动窗口，默认保留最近 15 条：

- 新条目 `push`
- 超限则 `shift`
- 被挤出的最旧条目进入 Summary 仓库

它是近期演进层，不是长期记忆层。

---

### 10.3 Summary 仓库

被 `SummaryCache` 弹出的 `SummaryEntry` 不应丢弃，而是进入 Summary 仓库。

仓库是：

- 长期事实索引
- 非常驻主上下文
- 供 LLM 通过工具主动搜索
- 搜到后再根据 `sessionPointers` 精准回到真实现场

## 是 Summary 仓库，不是"自动注入型记忆库"

它的职责是"线索"和"回溯入口"，不是持续向 prompt 塞越来越多历史内容。

---

## 11. Curator 输入输出契约

### 11.1 输入

```ts
interface CuratorInput {
  /** 上一轮 agent-round 的完整对话 */
  previousRoundConversation: string;

  /** 当前轮用户第一条消息 */
  currentUserMessage: string;

  /** 上一次更新后的目标树 */
  currentGoalState: GoalStateDocument | null;
}
```

---

### 11.2 输出

```ts
interface CuratorResult {
  summaryEntry: SummaryEntry;
  goalState: GoalStateDocument;
  signal: GoalSignal;
}
```

---

### 11.3 Curator 核心任务

1. 分析用户最新消息对上一轮目标断言的定性信号
2. 产出 `SummaryEntry`
3. 基于旧 `GoalStateDocument` 增量更新目标树
4. 输出 `signal`

---

## 12. GoalState 更新规则

### 12.1 新增目标

当用户提出新的明确目标，或当前焦点目标被进一步拆解时：

- 创建新 `GoalNode`
- 若属于某父目标的细化，则设置 `parentId`
- 记录一条 `create / refine / split` migration

---

### 12.2 完成目标

当用户明确认可、进入下一目标、或客观产物已完成且语义上可视为结束：

- 当前节点 `status -> completed`
- 写入 `completedAtRound`
- 焦点返回父节点或迁移到下一兄弟目标

---

### 12.3 修正目标

当用户说"不对、改成、不是这个方向"：

- 旧节点保留必要骨架
- 创建或更新更准确的新节点
- 记录 `pivot` migration
- 焦点切换到新节点

---

### 12.4 补充目标

当用户在已有目标上补充条件或新要求：

- 当前节点通常保持 active
- 增加子节点或兄弟节点
- 记录 `split` 或 `refine`

---

### 12.5 挂起目标

当某个节点短期不再是当前关注点，但仍未完成：

- `status -> suspended`
- 不删除节点
- 允许未来 `resume`

挂起不是失败，而是让上下文把注意力让给更重要的焦点。

---

### 12.6 剪枝原则

当某分支已经明确终止、被纠正替换、或对当前上下文不再有价值：

- 从当前高亮与主注入内容中移除其细节
- 只保留必要节点骨架与 migration 记录
- 需要完整现场时依赖 SummaryEntry / Summary 仓库回溯

---

## 13. Context 注入策略

每次 LLM 调用前，context 层应主要注入四部分：

1. `GoalStateDocument` 的紧凑表示
2. `SummaryCache` 的 15 条近期窗口
3. 最近 3 轮原始对话（从 `event.messages` 切片）
4. Summary 仓库检索工具指引

---

### 13.1 注入重点不是整棵树，而是"焦点路径"

虽然持久化层保存的是完整归一化树，但实际注入给 LLM 时，不必序列化整棵树的全部细节。

推荐注入：

- `currentFocusGoalId` 对应节点
- 该节点到根节点的祖先链
- 同层活跃兄弟目标（少量）
- 最近的 migration 摘要

这样能减少 token，同时保持"我现在在哪条目标链上"的清晰感。

这份"焦点路径视图"不仅用于主 Agent 的 context 注入，也应复用于 Reflector 的输入构造。

原因：

- Reflector 的 `方向评估` 必须相对当前目标基线判断
- Reflector 的 `盲点 / 风险 / 建议` 需要知道当前轮正在服务哪条目标链
- Reflector 的 `principleOps` 应来自围绕目标完成执行后的经验，而不是脱离目标的对话评论

因此，推荐从 `GoalStateDocument` 渲染一个轻量 `ReflectorGoalContext`，而不是把整棵树完整塞给 Reflector。

---

### 13.2 ReflectorGoalContext 推荐结构

```ts
interface ReflectorGoalContext {
  currentFocusGoalId: string | null;
  focusPath: Array<{
    id: string;
    assertion: string;
    status: "active" | "suspended" | "completed";
  }>;
  siblingActiveGoals: Array<{
    id: string;
    assertion: string;
  }>;
  recentMigrations: Array<{
    fromGoalId: string | null;
    toGoalId: string;
    reason: string;
  }>;
}
```

Reflector 的最小输入建议为：

```ts
interface ReflectorInput {
  currentRoundConversation: string;
  currentGoalState: GoalStateDocument | null;
  goalContext?: ReflectorGoalContext | null;
}
```

---

### 13.3 示例序列化

```text
[目标状态追踪]
当前焦点: g-12 设计 GoalStateDocument 的归一化树结构
目标路径:
- g-1 v1.1 核心设计收敛
- g-7 完成 GoalStateDocument 主设计
- g-12 设计 GoalStateDocument 的归一化树结构

同层活跃目标:
- g-10 判断 RequirementLedger 是否保留
- g-11 判断 ObjectiveSnapshot 是否保留

最近迁移:
- round 18: g-7 -> g-12 (refine) 因用户要求工程化树结构
```

---

## 14. 数据流时序

```text
用户发送新消息
  ↓
before_agent_start
  ↓
Curator Async LLM Subagent
  ├─ 读取 previousRoundConversation
  ├─ 读取 currentUserMessage
  ├─ 读取 currentGoalState
  ├─ buildCuratorSubagentPrompt(...)
  ├─ executeTextCompletion(...)
  ├─ 解析 signal
  ├─ 生成 SummaryEntry
  └─ 更新 GoalStateDocument

SummaryEntry
  ├─ push -> SummaryCache（最近15条）
  └─ evict -> Summary 仓库

context 注入
  ├─ 注入 GoalState 焦点路径
  ├─ 注入 SummaryCache
  ├─ 保留最近 3 轮原始对话
  └─ 注入 Summary 检索工具引导

agent_start
  ↓
主 Agent 开始执行

agent_end
  ↓
Reflector Async LLM Subagent
  ├─ 读取 currentRoundConversation
  ├─ 读取 currentGoalState
  ├─ 读取 goalContext（可选，推荐）
  ├─ 输出 advice
  └─ 输出 principleOps

需要追溯旧历史时
  └─ LLM 通过 Summary 仓库检索 -> 根据 SummaryEntry 指针还原现场
```

---

## 15. 风险与约束

### 风险 1：GoalStateDocument 重新膨胀为"大而全对象"

缓解：
- 明确禁止把它变成 PRD / requirement 容器
- 只保留目标断言、层级、迁移、状态、焦点等必要字段

### 风险 2：LLM 将推测写入事实层

缓解：
- 推测内容只作为分析过程优先存在
- 若确需落盘，必须标 `signal: "inferred"`
- 用户后续纠正时优先级更高，立即覆盖或迁移

### 风险 3：目标树过大导致注入膨胀

缓解：
- 持久层保存完整树
- 注入层只序列化焦点路径 + 少量同层活跃节点 + 最近迁移

### 风险 4：SummaryCache + 原始对话切片超 token

缓解：
- `SummaryCache` 固定 15 条
- 原始对话按 agent-round 和 token 上限双重截断

---

## 16. 一句话结论

Curator 模块的正确收敛方向是：

# `GoalStateDocument` 单核 + `SummaryEntry` 历史事实索引 + `SummaryCache` 近期窗口 + Summary 仓库按需检索

并且：

- 删除 `RequirementLedger`
- 删除 `ObjectiveSnapshot`
- 采用**归一化目标树**作为 `GoalStateDocument` 的工程化结构
- 将 I-P-O-E 保留为分析镜头，而非持久化骨架
- 用当前轮用户第一条消息裁决上一轮目标断言，从而决定哪些信息可以遗忘

---

*版本：curator_v1.2 | 更新时间：2026-05-14*
