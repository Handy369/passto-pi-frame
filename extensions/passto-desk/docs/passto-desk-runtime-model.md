# passto-desk Runtime Model：以对象关系为核心状态的双向运行时系统

日期：2026-05-21
状态：draft
目的：把 passto-desk 从“图生成型 skill”提升为“以对象/对象关系为核心状态的双向运行时系统”，为后续重构 `SKILL.md`、`references/*`、`scripts/*` 提供上层模型。

---

## 1. 核心结论

passto-desk 不应再被理解为“指导 LLM 画 Excalidraw 图”的技能集合，而应被定义为一个：

> **以对象（objects）与对象关系（relations）为共享中枢状态，连接文本信息、结构化语义、Excalidraw 视图、上下文注入与持久化回路的双向运行时系统。**

它至少承担两条相反方向但共享同一中枢的转化链：

1. **Forward transform**
   - 信息提取
   - → 结构化对象 / 对象关系
   - → Excalidraw 图视图

2. **Reverse transform**
   - Excalidraw 画板提取信息
   - → 回译为结构化对象 / 对象关系
   - → 注入上下文 / 更新状态 / 持久化文件

当前 passto-desk skill 已经积累了大量“如何画得更可读”的行为守则，但这些仍主要停留在**提示词指导层**。后续重构应把系统重心上提到：

- runtime state
- object-relation core
- context assembly
- execution flow
- control flow
- validation / persist / inject loop

---

## 2. 系统本体：共享语义中枢而不是文本或图

### 2.1 当前错误重心

当前很容易把 passto-desk 的主对象误认为是以下之一：

- 用户输入文本
- prompt 模板
- Excalidraw scene
- 图的视觉效果

这些都不是系统真正的主状态。

### 2.2 正确主状态

passto-desk 的唯一共享中枢应是：

- objects
- relations
- semantic notes / annotations
- view intent
- mapping intent
- visual intent
- runtime control state

也就是说：

> 文本不是主状态；
> 图不是主状态；
> prompt 也不是主状态；
> **object-relation semantic state 才是主状态。**

### 2.3 这意味着什么

这意味着：
- 文本输入要先进入 object-relation core
- 图输出只是 object-relation core 的一种视图投影
- 画板读取也不能直接把 element 当真相，而应回译到 object-relation core
- 上下文注入、下一轮推理、持久化文件，都应围绕同一 semantic core 发生

---

## 3. 两条反向转换链

## 3.1 Forward transform：信息 → 结构 → 图

### 阶段 A：信息提取（Information Extraction）
输入可能包括：
- 用户当前消息
- 当前会话状态
- 本地文件 / 文档
- 已有 domain JSON
- 已有 Excalidraw scene
- 外部证据或运行时事实

目标不是直接生成图，而是收集本轮可用信息。

### 阶段 B：结构化为对象 / 对象关系（Semantic Structuring）
这是整个系统的核心阶段。

输出应包括：
- object candidates
- relation candidates
- relation labels / conditions / branches
- note / annotation intent
- group / lane / priority / direction hints
- unresolved ambiguities / warnings

这里的对象与关系应成为本轮的**主要产物**，而不是图的附属中间物。

### 阶段 C：桥接为 Excalidraw 图（View Realization）
只有在 semantic core 稳定后，才进入图视图层。

这一层处理：
- object → node
- relation → edge
- relation label → edge label / annotation fallback
- node style / role
- geometry / layout
- bindings / anchors
- readability optimization

图是结构化信息的投影，而不是语义本身。

---

## 3.2 Reverse transform：图 → 结构 → 上下文 / 状态

### 阶段 A：Excalidraw 画板提取（Scene Extraction）
输入包括：
- scene elements
- container / bound text
- edge bindings
- geometry clues
- group / frame / annotation 线索

目标不是直接把 scene 当语义真相，而是提取候选结构信息。

### 阶段 B：回译为对象 / 对象关系（Semantic Reconstruction）
从画板中恢复：
- object candidates
- relation candidates
- visual-only artifacts
- uncertain mapping
- conflict / ambiguity signals

关键原则：

> Excalidraw element 不应直接成为 agent 侧唯一真相源；
> 它应被解释、解析并回译为 semantic state。

### 阶段 C：进入上下文与持久化（Context Injection & Persistence）
回译得到的 semantic state 应继续进入：
- runtime context assembly
- current state update
- domain JSON persist
- next-round injection
- downstream reasoning inputs

这一步意味着：
- 画板不是终点
- 读取白板的真正价值在于更新系统内部状态

---

## 4. Context 不是文本，而是运行时对象

### 定义

```text
Context = Information + Method + Control
```

### 在 passto-desk 中的含义

#### Information
- 用户输入
- 当前 semantic state
- 当前 scene state
- 历史 domain
- 持久化文件
- 外部证据 / 现实状态

#### Method
- 当前 transform direction（forward / reverse）
- 当前 mode（Explain-first / Workbench）
- 当前轮目标对象
- 当前布局 / realization policy
- 当前评审标准

#### Control
- parse
- validate
- persist
- inject
- fallback
- retry / rebuild / stop / escalate

### 含义总结

这意味着 passto-desk 的上下文不应被视为一段“喂给 LLM 的文本”，而应视为：

> **由信息、方法和控制共同组装出的运行时对象。**

---

## 5. Script 不是“写 prompt”，而是“构造运行时”

### 定义

```text
Script = assemble(Information) + encode(Method) + enforce(Control)
```

### 在 passto-desk 中的具体含义

#### assemble(Information)
- 收集用户输入
- 收集当前 domain state
- 收集当前 scene state
- 收集相关历史状态与文件
- 识别本轮需要的 truth source

#### encode(Method)
- 编码当前是 forward 还是 reverse transform
- 编码当前是 Explain-first 还是 Workbench
- 编码当前轮的主要产物
- 编码当前评分 / 校验协议

#### enforce(Control)
- 输出必须结构化
- 必须 parse
- 必须 validate
- 必须 persist
- 必须决定是否进入下一轮
- 必须能在失败时切换 fallback / rebuild

### 这与当前 skill 的区别

当前 skill 更像是在告诉 LLM：
- 该做什么
- 不该做什么
- 哪些图更好

而这里要的是：

> 在 LLM 推理前，先把它放进一个受控运行时中。

---

## 6. LLM 不是回答，而是在执行受约束推理

### 定义

```text
LLM Step = reason(ContextRuntime) -> Structured Output
```

### Structured Output 不应只是“一张图”

它更应该包含：
- object updates
- relation updates
- view decisions
- mapping decisions
- validation notes
- warnings / unresolved ambiguities
- next-step hints

图视图只是其中一种产物，而不是唯一产物。

### 这意味着

passto-desk 的成功标准不能再只是：
- “这张图看起来好不好”

而应变成：
- semantic state 是否更清楚
- current transform 是否成功
- 输出是否可 parse / validate / persist
- 是否能安全进入下一轮

---

## 7. 可靠性来自回路，而不是单次输出质量

### 定义

```text
Loop:
  state -> context assembly -> LLM reasoning -> structured result
  -> parse/validate -> state update -> next round
```

### 当前问题

当前 passto-desk 的很多规则，本质仍在尝试：
- 通过更好的 prompt 获得更好的单次结果
- 通过更多禁忌减少错误
- 通过更多评分项提高首轮质量

这些都有帮助，但都不能替代控制回路。

### 正确方向

系统可靠性应更多依赖：
- stateful iteration
- parseability
- validation gate
- persistence
- inject next round
- fallback / retry / rebuild control

也就是说：

> 不是追求“一次生成完美图”，
> 而是追求“每一轮都把系统状态往更可靠方向推进”。

---

## 8. 五维模型：passto-desk 的运行时分析骨架

建议将以下五维作为 passto-desk runtime 的上层分析框架：

### Why
- 为什么要做这一轮
- 这轮动作服务于哪个更高层目标

### What
- 当前轮真正要产出什么对象
- 是 semantic state update、view projection、scene patch，还是 context injection

### Structure
- 对象边界是什么
- 依赖哪些真相源
- 当前语义中枢状态是什么

### Flow
Flow 应进一步拆为两个子面：

#### Execution Flow
- 当前轮实际工作顺序是什么
- 先提取、再结构化、再桥接，还是先读 scene 再回译

#### Control Flow
- parse / validate / persist / inject 的闭环机制是什么
- 失败时如何 fallback 或重试
- 如何决定进入下一轮还是停止

### Runtime Proof
- 当前判断被哪些现实证据支撑
- 是文本推断、domain state、scene state、文件状态，还是运行时结果

---

## 9. 当前 skill 与上层 runtime model 的层级差异

当前 `SKILL.md` / `references/*` 的主要内容仍属于：
- 行为守则
- 执行策略
- 视觉可读性约束
- 提示词协议

这些是必要的，但层级上属于：

> **Operational Policy / Prompt Surface**

而不是：

> **Runtime Model**

因此后续不应继续只靠堆积：
- 更多 checklist
- 更多禁忌
- 更多评分项

来解决根问题。

真正需要的是先定义上层系统模型，再决定哪些内容下沉回：
- runtime state
- transformation contracts
- control loop
- persistence rules
- skill surface

---

## 10. 推荐的三层架构

## 层 1：Runtime Model
定义系统本体：
- shared semantic core
- forward / reverse transform
- execution flow / control flow
- validation loop
- persistence / injection model

回答的问题是：
> passto-desk 到底是什么系统？

## 层 2：Operational Policy
定义运行策略：
- Explain-first vs Workbench
- append vs rebuild
- mechanism-first realization
- self-review
- fallback policy

回答的问题是：
> 这个系统在这轮怎么运行？

## 层 3：Prompt / Skill Surface
定义给 LLM 的实际执行面：
- 命中条件
- 最小读取路径
- 输出格式
- 自评模板
- benchmark seeds

回答的问题是：
> LLM 这一轮具体怎么执行？

### 当前主要问题

当前 passto-desk 的这三层还混在一起，因此会出现：
- 规则很多
- 但系统心智模型不清
- 缺少真正 runtime 化
- 缺少统一闭环
- 正向与反向转换尚未在同一语义中枢上统一

---

## 11. 当前 scripts 实现映射

截至当前，`docs` 中提出的 runtime model 已经在 `scripts/runtime-contracts.mjs` 形成一版最小实现映射。

### 已落地的核心 helper
- `createEmptySharedSemanticState`
- `createEmptyTransformOutput`
- `createEmptyValidationResult`
- `createEmptyNextRoundDecision`
- `buildSharedStateSnapshot`
- `mergeSharedStateSnapshot`
- `buildValidationResult`
- `buildNextRoundDecision`
- `commitTransformResult`

### 已接入真实双向 transform 的最小 runtime metadata
- `scripts/excalidraw-to-domain-json.mjs`
  - 产出 reverse `transformOutput`
  - 产出 `sharedStateSnapshot`
  - 写入 domain JSON `runtime.*`
- `scripts/domain-json-to-excalidraw.mjs`
  - 产出 forward `transformOutput`
  - 产出 `sharedStateSnapshot`
  - 写入 scene `customData.runtime.*`

### 这说明什么
这说明本文件所说的：
- object / relation 共享中枢
- forward / reverse 共用同一 semantic core
- parse / validate / persist / inject loop

已经不再只是建模层描述，而是开始在脚本层拥有最小可执行骨架。

当然，当前仍属于：
- minimal runtime core
- helper-based assembly
- 非完整 orchestrator

但它已经足以支持后续把真实 transform 脚本进一步统一接到 `commitTransformResult(...)` 上。

---

## 12. 一句话总结

> passto-desk 的下一阶段，不应只是继续优化“LLM 怎么画图”，而应重构为一个以对象与对象关系为共享中枢、同时支持正向生成与反向回译、并依赖 parse / validate / persist / inject 回路保障可靠性的双向运行时系统；而这一系统现在已经在 `scripts/runtime-contracts.mjs` 中出现了第一版最小实现。
