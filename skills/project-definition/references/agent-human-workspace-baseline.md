# Agent-Human Workspace Baseline

> **last_verified: 2026-05-15**
> source basis: real runtime audit of `http://127.0.0.1:5173/` (`excalidraw-bridge` shared workspace), plus project design/progress docs only as secondary context

## 作用

这是统一 UI/UX 工作流里的 **复杂任务型界面深案例模块**。

默认应先由 `ui-ux-product-design.md` 作为 UI/UX 主入口，建立：
- 对象清晰
- 注意力聚焦
- 去歧义
- 信息优先级
- 功能布局

如果当前问题明显属于：
- workspace / console / studio / editor shell
- human + agent 协作界面
- review-first / staged patch / recovery UX
- 多栏复杂工作台

再补读本模块，作为复杂界面专项案例与方法库。

它解决的不是纯视觉风格，而是：
- 用户是否能围绕同一个工作对象完成任务
- 用户是否知道当前状态、下一步动作、风险与恢复路径
- 界面是否在帮助决策，而不是暴露内部实现
- 多个区块之间是否职责清楚、主次清楚、真相源清楚

---

## 适用场景

- “帮我设计一个 human / agent 共享工作台”
- “这个 side panel / status bar / patch review UI 该怎么定义”
- “先把工作台的交互基线设计清楚，再实施”
- “我需要 review-first / staged patch / recovery UX 的产品方案”
- “我要把现有工程界面收敛成更可用的协作工作台”
- “帮我做这个产品的 UE / 交互设计，不只是视觉风格”
- “这个后台 / 控制台 / studio / editor 的信息架构怎么组织”
- “这个界面信息很多，但用户不知道先看哪块，帮我重做交互层级”
- “请从任务导向角度重构这个复杂界面，明确主操作、状态区和待处理区”
- “这不是换皮美化，我要的是复杂产品界面的交互方案”

---

## 边界：什么时候应该进这个模块，什么时候不该进

### 应该进这个模块
当用户主要要的是以下任一项时：
- 复杂界面的 **信息架构**
- 任务导向的 **交互层级 / 操作优先级**
- 工作台 / 控制台 / 编辑器 / 协作台的 **区块职责划分**
- 状态反馈、待处理项、恢复路径、确认边界的设计
- 把“功能很多但像 demo”的界面收敛成可决策产品界面

### 不该进这个模块
以下情况优先走相邻模块：
- 纯视觉风格 / 配色 / 字体 / 品牌气质 → `design-foundation.md`
- 纯 design token / 组件规范 → `design-tokens.md`
- 纯业务流程 / 状态机 / 补偿逻辑，但还不涉及界面结构 → `core-flow-design.md`
- 明确要求直接改代码 / 做实现 → `project-implementation`
- 明确要求做真实运行态 QA / P0-P2 审查 → `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`

---

## 硬前提：先看真实运行界面，不准只靠文档推断

处理共享工作台设计时，**不能只读 spec / README 就下 UI 结论**。

至少先验证其中两项，最好三项全做：
1. 打开真实运行页面
2. 读取真实可见文案、按钮、状态区、空状态
3. 做最小交互验证：点击、聚焦、保存、切换、错误/恢复路径

如果做不到真实运行态审查，必须显式标记：
- 现在给的是“假设性设计建议”
- 不是“基于真实界面的设计审查结论”

---

## 共享工作台的核心目标

好的 agent-human workspace 不是把系统状态堆出来，而是持续回答 4 个问题：

1. **我现在在看什么工作对象？**
2. **系统当前状态安全吗？**
3. **我下一步最该做什么？**
4. **Agent 的提议与 Human 的确认边界在哪里？**

如果界面主要在回答“系统内部是怎么实现的”，而不是这 4 个问题，通常就说明工作台还没有产品化收敛。

---

## 设计原则（按优先级）

### 1. 下一步动作比实现细节更重要
优先暴露：
- 当前工作台
- 当前待处理项
- 保存/冲突/恢复状态
- 可执行动作

降级暴露：
- runtime / host / storage backend
- raw revision id
- hash / protocol 细节
- 内部数据结构名

### 2. review-first，而不是 silent overwrite
当 Agent 改动会影响 Human 当前工作对象时，默认应：
- 先提议
- 再 inspect
- 再 apply / reject

除非风险极低且用户明确接受，不要默认静默覆盖。

### 3. 状态必须帮助决策，而不是只是存在
状态可见不等于状态有用。

好的状态设计应让用户知道：
- 是否已保存
- 是否有未保存改动
- 是否有远端更新
- 是否有待审阅 patch
- 是否需要恢复/确认

### 4. 结构视图必须面向内容块，不面向底层元素
左侧结构栏应优先展示：
- 内容块名称
- 区域/分组
- 来源（human / agent / imported）
- 最近变更

避免优先展示：
- `rectangle`
- `text`
- element id
- 内部命名

### 5. 每一次“定位 / 聚焦 / 切换”都要有显式反馈
只在内部滚动画布、不提供壳层反馈，用户会怀疑是否生效。

至少提供一种：
- 当前项高亮
- 画布临时高亮
- toast / status 提示
- 右栏同步显示当前聚焦对象

### 6. 空状态必须引导下一步
空状态不能只解释“现在为空”，还要说明：
- 这块区域将来会显示什么
- 用户或 Agent 怎样触发它
- 现在可以做什么替代动作

### 7. 工作台语境优先于工程语境
默认用户可见层优先使用：
- 工作台
- 当前场景
- 待审阅变更
- 已保存 / 未保存
- 远端更新
- 恢复建议

将这些降级到调试层：
- embedded host
- scaffold
- scene hash
- storage backend
- revision ids
- protocol 名称

---

## 常见失败模式（来自真实工作台审查）

### F1. 工程文案占据首屏
表现：首屏在讲 host、scaffold、runtime，而不是当前工作对象与下一步。

改法：
- 标题改成工作台语境
- 工程 badge 降级到角落或调试视图

### F2. 动作区主次不清
表现：按钮都可点，但用户不知道应该先点哪个。

改法：
- 分主操作 / 次操作
- `保存` 与 `另存为` 明确区分
- 示例/调试动作不要抢主路径

### F3. 同类状态到处重复
表现：文件名、元素数、hash、baseline、保存时间在头部/侧栏/底栏反复出现。

改法：
- 只保留一个主摘要区
- 其余改为折叠详情或调试信息

### F4. 结构栏暴露 raw element
表现：`rectangle · xxx`、`text`、底层元素名直接进入导航。

改法：
- 转为内容块视图
- 用标题 + 类型标签 + 来源

### F5. 点击后反馈弱
表现：点了 recent item，但没有选中态、提示或焦点反馈。

改法：
- 加高亮、toast、当前聚焦条、画布临时标记

### F6. 右栏像说明书，不像协作台
表现：大段机制说明、长文本恢复指南常驻，真正待处理项不突出。

改法：
- 右栏先显示待处理事项
- 机制说明降级为折叠帮助

### F7. 空状态不引导
表现：只说 `No frames`、`Empty`，不告诉用户下一步。

改法：
- 补“这块是什么 / 未来显示什么 / 你现在能做什么”

### F8. 内部术语泄漏过多
表现：hash、revision、baseline、API backend 等占据主界面。

改法：
- 用户层只留必要结果性术语
- 机制细节移入调试层

---

## 共享工作台推荐信息架构

### Header
回答：
- 当前工作台是什么
- 当前总体状态如何
- 有没有待审阅变更

应包含：
- workspace name
- saved/dirty/error
- pending review count（如有）

避免：
- 大段工程实现说明

### Toolbar
回答：
- 现在最重要的动作是什么

建议分组：
- 主操作：打开 / 保存 / 导入
- 次操作：另存为 / 示例 / 调试

### Left Sidebar
回答：
- 当前工作台由哪些内容块组成
- 点哪个能快速定位

建议模块：
- Sections / Frames / Groups
- Recent meaningful items
- Importable scenes

### Canvas Shell
回答：
- 当前正在看哪个对象
- 聚焦是否成功

建议增强：
- 当前聚焦条
- focus success feedback

### Right Agent Panel
回答：
- 现在有哪些待处理项
- Agent 提议了什么
- 当前是否需要用户确认

优先级应是：
1. 待处理项
2. 当前聚焦对象
3. 简要状态摘要
4. 恢复提示
5. 协作机制说明（最弱）

### Status Bar
回答：
- 我现在是否可以安全继续操作

默认只保留：
- 保存状态
- 最后保存时间
- 同步/远端状态
- 恢复状态

技术细节改入折叠详情。

---

## 首屏收敛方法：合并、删减、去重、重建优先级

当用户指出“顶部认知有基础问题”“section 太散”“不知道哪块最重要”时，不要继续只做视觉微调，应先做一次信息架构收敛。

先强制回答 4 个问题：
1. **是否可以合并 section 提高信息密度，而不损失决策能力？**
2. **每条信息是否都是必须且必要的，具备不可替代价值？**
3. **是否有同一类状态被重复表达，造成冗余？**
4. **在当前平铺结构下，使用者如何判断重要程度？**

### 1. 不可替代价值测试
如果删掉一条信息后：
- 不影响用户判断当前工作对象
- 不影响用户判断是否安全继续
- 不影响用户知道下一步动作
- 不影响用户完成审阅/恢复/确认

那它通常就**不具备不可替代价值**，应删除、合并或降级。

典型应删除或弱化的对象：
- 重复摘要句
- 与主状态 pills 重复的 status echo
- Preview / 实验阶段 badge
- `scene hash`、revision id、storage backend 等调试性信息
- 常驻但不驱动当前决策的说明性文案

### 2. 单一真相源规则
以下信息类型，默认每类只应有**一个主真相区**：
- 保存状态
- 远端状态 / remote update
- 待审阅变更数
- 当前工作台身份
- 恢复 / 冲突提示

允许在别处出现的，只能是：
- 行动入口
- 异常提醒
- 折叠详情

不允许多个同权区域反复复述同一事实，否则用户无法判断“哪块才是主状态”。

### 3. 合并 section 的默认方向
如果顶部同时存在“当前状态 / 文件 / 快速操作”等并列卡片，默认优先收敛为一个 **主工作条（workspace toolbar）**：
- 左：当前对象是谁（workspace 名、文件名）
- 中：关键状态（保存、待审阅、远端，仅保留核心）
- 右：主操作与次操作

目标不是做更多卡片，而是把“3 张解释卡”收敛成“1 条可执行工作条”。

### 4. 首屏四层模型
共享工作台首屏默认应收敛成 4 层：

#### 第一层：唯一主工作条
只保留：
- 当前对象是谁
- 当前是否安全 / 是否有事待处理
- 下一步动作

#### 第二层：唯一任务优先区
通常是右栏首块，只保留：
- 待处理事项
- 待审阅项
- 当前需要确认的事

如果没有待处理项，就显示轻量空状态，不要再用常驻状态卡稀释它。

#### 第三层：异常才出现的告警区
只在以下情况出现：
- 保存失败
- 远端更新
- 本地未保存冲突
- baseline 切换风险
- 恢复风险

异常不应与正常说明同权常驻平铺。

#### 第四层：折叠详情区
把低频和技术性信息收进这里：
- 最后保存时间
- baseline 来源
- remote revision
- scene hash
- 存储方式
- 最近编辑时间

### 5. 重要程度排序规则
默认重要程度应是：
1. **异常 / 风险**
2. **待处理任务 / 待审阅项**
3. **当前工作对象身份**
4. **补充状态摘要**
5. **说明性文案 / 协作机制解释**
6. **调试 / 技术元信息**

如果“正常信息”和“异常信息”视觉同权，或“说明信息”和“行动信息”并列争抢首屏，说明层级系统失败。

### 6. 常见收敛动作
当发现顶部/右栏/底栏都在表达状态时，优先做这些动作：
- 合并多个顶部 section 为单一工作条
- 删除重复摘要句和重复 status echo
- 将右栏状态卡改成“仅异常/仅待处理时出现”
- 将协作说明改成折叠帮助、首次引导或 onboarding
- 将技术细节移出首屏，进入 details

---

## 定义共享工作台时必须覆盖的状态

至少定义清楚这些状态及其用户可见反馈：
- ready
- dirty
- saving
- saved
- error
- remote updated
- conflict risk
- pending review
- stale patch
- applied / rejected
- imported baseline active

对每个状态至少写清：
- 触发条件
- 用户看见什么
- 用户下一步能做什么
- 是否需要确认

---

## 推荐输出骨架

```markdown
## 1. Workspace Objective
- Human role:
- Agent role:
- Shared object:
- Key risk to reduce:

## 2. Runtime Audit Findings
- Surface audited:
- What the user sees first:
- Top interaction issues:
- Evidence from real runtime:

## 3. Information Architecture
- Header
- Toolbar
- Left sidebar
- Canvas shell
- Right agent panel
- Status bar

## 4. State and Feedback Model
| State | Trigger | User-visible signal | Next action | Confirmation needed |
|---|---|---|---|---|

## 5. Review-first Collaboration Model
- Agent proposes:
- Human inspects:
- Human applies/rejects:
- Stale handling:

## 6. Empty States and Recovery
- Frames empty:
- Queue empty:
- Save error:
- Remote update:

## 7. Copy and Terminology Rules
- User-facing words:
- Debug-only words:
- Avoid:

## 8. Prioritized Redesign List
- P1
- P2
- P3
```

---

## 设计输出质量标准

好的共享工作台定义，应满足：
- 首屏在讲任务与状态，不是在讲实现
- 用户知道当前工作对象与下一步
- Agent 改动的确认边界清楚
- 同类状态不重复堆叠
- 聚焦、切换、恢复都有明确反馈
- 空状态与错误状态能引导行动
- 内部术语不会主导用户界面
- 首屏存在明确的**主真相区**，不会让多个 section 同权复述同一状态
- 说明性信息不会与行动信息平铺竞争注意力
- 低频技术细节会被折叠或降级，而不是占据首屏

---

## 最小输入示例

### 示例 1：定义共享工作台基线

```text
我们现在有一个 human + agent 共用的工作台，左边是结构栏，中间是画布，右边是 patch/recovery/status。
请不要只看文档，先基于真实运行界面判断这个工作台的信息架构和交互是否合理，
然后给我一份 redesign baseline，重点看：header、sidebar、status bar、agent panel、review-first 协作。
```

### 示例 2：把工程界面收敛成工作台

```text
当前页面功能很多，但像开发 demo，不像产品化工作台。
请基于真实界面，定义一套 agent-human workspace 的交互基线：
什么信息该放首屏，什么技术细节该降级，哪些状态必须清楚可见。
```

---

## 理想输出示例（骨架）

```markdown
## Workspace Objective
- Human role: 编辑和确认共享工作对象
- Agent role: 提议变更，等待人工审阅
- Shared object: 当前 workspace / scene
- Key risk to reduce: 用户不知道当前状态、下一步和确认边界

## Runtime Audit Findings
- 首屏主要在讲工程实现，而不是当前工作对象与下一步
- Toolbar 主次不清，保存/示例/导入并列
- Sidebar 暴露 raw element，缺少内容块语义
- 右栏机制说明过重，待处理事项不突出

## Information Architecture
### Header
- 显示 workspace 名、保存状态、待审阅变更数
- 弱化 embedded/runtime/scaffold 类工程说明

### Left Sidebar
- recent items 改成内容块列表
- 点击后必须有选中态和聚焦反馈

### Right Agent Panel
- 先显示 pending review / stale / recovery
- 机制说明折叠到 help

## State and Feedback Model
| State | Trigger | User-visible signal | Next action | Confirmation needed |
|---|---|---|---|---|
| dirty | Human 编辑后未保存 | 底栏显示未保存 | 保存 | 否 |
| pending review | Agent 提议 patch | 右栏显示待审阅项 | Inspect / Apply / Reject | 是 |
| stale patch | baseline 已变化 | 待审阅项禁用并提示 stale | regenerate | 是 |

## Prioritized Redesign List
- P1: 头部改为工作台语境
- P1: recent items 去 raw element 化
- P1: 点击聚焦反馈可见化
- P2: 状态信息去重
- P2: 空状态增加引导
```

---

## 真实案例：顶部不是视觉细修，而是信息架构重构

### 用户原始判断信号
当用户反馈类似下面这类问题时，不要再把任务理解成“顶部视觉细修”：
- 是否可以合并 section 提高信息密度
- 是否所有信息都必须且有不可替代价值
- 是否存在重复出现的信息，造成冗余
- 目前平铺的信息结构下，使用者如何判断重要程度

这通常意味着问题已经升级为：
> **同一类状态被放在多个 section 重复表达，且这些 section 视觉权重接近，导致用户不知道哪一块才是真相源、哪一块最重要、哪一块只是补充说明。**

### 典型诊断方式
先把首屏区块按职责列出来，再判断它们是互补还是交叉：
1. 顶部左侧当前状态
2. 顶部左侧工作台文件
3. 顶部右侧快速操作
4. 右栏当前工作台状态
5. 右栏恢复与冲突提示
6. 底部 StatusBar
7. 右栏协作说明

如果这些区块里大量信息是交叉的，而不是互补的，就应输出“需要合并、删减、去重、重建优先级”的结论，而不是继续调 spacing / 字号 / 配色。

### 该案例里可直接复用的重构结论

#### 1. 顶部三块合并为一个主工作条
如果顶部被拆成：
- 当前状态卡
- 文件卡
- 操作卡

更合理的收敛方式通常是：
- 左：工作台身份（文件名 / workspace / revision）
- 中：关键状态（保存 / 待审阅 / 远端）
- 右：主操作与次操作

也就是从“3 张卡”变成“1 条主工作条”。

#### 2. 右栏状态卡与底栏 StatusBar 不应重复承担同类职责
当两者都在讲：
- 保存状态
- 最后保存
- 基线
- 待审阅变更
- 远端状态 / 修订

默认重构方向应是：
- **底部状态栏 = 唯一持久状态源**
- **右栏状态卡 = 只保留异常 / 需要行动的状态**

正常时，右栏不需要常驻“当前工作台状态”大卡。

#### 3. 协作说明不应长期占据首屏
像“Human 在画布上直接编辑当前工作台...”这类解释性文案：
- 不是决策信息
- 不驱动当前动作
- 不应长期与任务区并列

更合理的去处通常是：
- 折叠帮助区
- 首次引导
- onboarding
- 空状态时的 contextual hint

#### 4. 没有不可替代价值的信息应删除或降级
该案例里典型可删/可弱化对象：
- Preview badge
- 顶部长句 header summary
- 顶部操作区重复 status echo
- 右栏“当前工作台状态”中与别处重复的信息
- `sceneHash` 这类调试性细节

### 该案例里可直接复用的信息冗余图

#### 保存状态
可能同时出现在：
- 顶部 pills
- 顶部操作区 status
- 底部 StatusBar
- 右栏恢复提示

#### 远端状态 / 修订
可能同时出现在：
- 顶部 pills
- 顶部操作区 status
- 底部 summary
- 底部 details
- 右栏 remote update / recovery 提示

#### 待审阅变更
可能同时出现在：
- 顶部 pills
- 主按钮
- 右栏待处理事项计数
- 右栏当前工作台状态
- 底部 details

#### 文件身份
可能同时出现在：
- 顶部工作台文件
- 右栏当前工作台状态
- document.title

#### 恢复 / 冲突提示
可能同时出现在：
- 底部恢复建议
- 右栏恢复与冲突提示
- remote update banner
- 顶部远端状态 pill

当一个信息类型在 3 个以上触点同权出现时，优先判定为**需要单一真相源重构**。

### 该案例里可直接复用的重要程度排序
默认应收敛为：
1. 异常 / 风险
2. 待处理任务 / 待审阅项
3. 当前对象身份
4. 补充状态摘要
5. 协作说明
6. 调试 / 技术元信息

如果“已保存”“恢复与冲突提示”“协作说明”“快速操作”在首屏视觉上接近同权，说明层级系统失败。

### 该案例理想输出应该长什么样
好的 redesign baseline 不应只写“优化层级和留白”，而应明确给出：
- 哪些 section 应合并
- 哪些信息没有不可替代价值
- 哪些信息存在重复表达
- 哪一块是唯一主真相区
- 哪一块是唯一任务优先区
- 哪些说明/技术细节应折叠或降级

## 常见失败对照

### 失败型输出 A：只讲美观，不讲协作闭环

```text
建议优化视觉层级、统一配色、增加留白、优化排版。
```

为什么不够：
- 没回答当前工作对象是谁
- 没回答 Agent/Human 的确认边界
- 没回答 review-first / stale / recovery 如何呈现

### 失败型输出 B：只看文档就下结论

```text
从设计文档看，这个工作台结构完整，状态区域也比较齐全。
```

为什么不够：
- 没有真实运行态证据
- 无法判断状态是否真的可感知
- 无法判断点击/聚焦/恢复是否有反馈

### 失败型输出 C：把工程实现直接当产品信息架构

```text
建议保留 scene hash、revision、storage backend 在首屏，方便用户理解系统原理。
```

为什么不够：
- 把调试信息误当用户首屏信息
- 增加认知负担，削弱任务导向

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [design-foundation.md](design-foundation.md) | 通用 UI/UX 基础规则 |
| [core-flow-design.md](core-flow-design.md) | 把协作闭环定义成状态与异常流程 |
| [handoff-and-implementation-plan.md](handoff-and-implementation-plan.md) | 把整改项拆成实施计划 |
