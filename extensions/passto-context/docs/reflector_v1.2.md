# PasstoContext Reflector 模块设计

> 版本：v1.2 | 状态：current | 更新：2026-05-14

---

## 1. 收敛结论

Reflector 不应再被定义为"高级技术顾问"或"对当前 round 的泛评论器"，而应收敛为：

**Reflector = post-round 上位审计器（Auditor） + 原则综合器（Generalizer） + 模式蒸馏器（Distiller）**

它在 `agent_end` 之后，从比当前执行更宽的视野审视：

1. 当前 `GoalStateDocument` 是否仍正确表达用户真正目标；
2. `Generator`（主进程）当前 round 的执行是否偏离目标链；
3. `Curator` 是否因错误判断而使 `GoalState` 逐轮漂移；
4. 哪些经验值得沉淀为跨目标适用的原则；
5. 哪些局部最佳实践已经成熟到应进一步沉淀为 `reference / script` 级别的可复用能力资产。

因此 Reflector 的核心职责不是"总结刚刚发生了什么"，而是回答三个更高层的问题：

1. **本轮执行是否仍服务于正确的目标链？**
2. **如果发生偏移，偏在 `GoalState`、`Generator` 还是 `Curator`？**
3. **如果本轮出现可复用模式，应沉淀为原则，还是进一步沉淀为能力资产？**

---

## 2. 底层设计哲学

### 2.1 Reflector 不是摘要器，而是校准器

Curator 的工作是在 `before_agent_start` 用后验用户信号校准上一轮目标状态。

Reflector 的工作则是在 `agent_end` 对"本轮执行 + 当前目标状态 + 原则系统"做一次上位审计，防止系统因局部误判持续偏航。

Reflector 关注的不是：

- 这轮做了多少事；
- 文本写得是否流畅；
- 表面上是否给出建议。

Reflector 关注的是：

- 当前执行是否仍服务于用户真正目标；
- 当前目标锚点是否仍可信；
- 当前原则系统是否被新的事实支持、修正或冲突；
- 当前最佳实践是否已达到可复用、可产品化的程度。

---

### 2.2 Reflector 必须比 Generator 看得更高一层

Generator 负责完成当前任务。

Reflector 必须同时观察三层对象之间的关系：

1. `用户真实目标 / 长期约束`
2. `GoalStateDocument` 当前表达出的目标链
3. `Generator` 本轮实际执行路径

Reflector 的价值来自三者对比，而不是只看第 3 层。

如果缺少这一视角，系统会出现两类典型故障：

- `GoalState` 已偏，但 Generator 仍忠实执行错误目标；
- `GoalState` 正确，但 Generator 只做局部动作，丢失主目标。

Reflector 必须能区分这两类故障，不能仅输出笼统的"方向似乎不太对"。

---

### 2.3 Reflector 必须具备跨轮连续观察能力

单轮对话很难支持高质量原则沉淀。

Reflector 的原则与模式判断，不应仅来自某一轮的局部成功，而应来自：

- 当前 `GoalState` 的连续演化；
- 最近若干轮 `SummaryCache` 中反复出现的成功/失败模式；
- 最近若干次 Curator 判定是否稳定；
- 当前原则在新事实面前是否被再次证实、扩展或冲突。

因此，本设计采用如下原则演化口径：

**新原则 = 旧原则指导 + 新事实发现与验证**

Reflector 既不是"凭空创造原则"，也不是"机械复用旧原则"，而是：

- 在现有原则库框架下理解本轮事实；
- 再决定是 `reuse / merge / conflict / create`；
- 并且只有当新经验具备跨目标通用性时，才允许进入原则层。

---

### 2.4 原则不是终点，稳定模式应继续沉淀为能力资产

原则是抽象经验层。

但有些经验已经不只是"值得被记住"，而是"值得被稳定复用"。

当一条最佳实践已经具备：

- 明确触发条件；
- 稳定执行路径；
- 可复用步骤；
- 可脚本化或可文档化边界；

它就不应只停留在原则库里，而应进入更可执行的沉淀层：

- `reference`：可复用方法说明
- `script`：可复用自动化脚本

这使 Reflector 成为"能力产品化"的发现入口，而不仅是"经验文本生成器"。

---

## 3. 与 Curator / Generator 的边界

### 3.1 Generator 的边界

Generator：
- 负责完成当前轮目标；
- 负责响应用户输入；
- 负责执行代码、文件、工具操作。

Generator 不负责：
- 全局审计自己是否已持续偏航；
- 纠正错误的 GoalState 基线；
- 维护原则体系；
- 判断最佳实践是否应升级为 `reference / script`。

---

### 3.2 Curator 的边界

Curator：
- 在 `before_agent_start` 使用"当前轮用户第一条消息"这一后验信号；
- 判断上一轮目标状态如何更新；
- 产出 `GoalStateDocument + SummaryEntry + signal`。

Curator 不负责：
- 审计当前轮执行质量；
- 判断 `GoalState` 是否正在被连续错误更新；
- 综合旧原则与新事实生成通用原则；
- 识别能力产品化机会。

---

### 3.3 Reflector 的边界

Reflector：
- 在 `agent_end` 审计本轮执行与当前目标链的对齐情况；
- 判断偏移根因；
- 综合原则；
- 蒸馏可复用模式；
- 输出给下一轮 Generator 的顾问级纠偏意见。

Reflector 不负责：
- 直接修改 `GoalStateDocument`；
- 直接改写 `SummaryEntry`；
- 直接产出最终 `Skill / Script / Reference` 文件；
- 直接替代 Curator 做目标裁决。

Reflector 的职责是：**发现问题、给出证据、提出校准与沉淀建议**，而不是直接接管执行或状态维护。

---

## 4. 防漂移总原则

### 4.1 不新增第二个目标真相源

Reflector 可以诊断 `goal_state_drift` 和 `curator_misjudgment`，但 Reflector **不能**引入一套新的"当前目标状态对象"去替代 `GoalStateDocument`。

- `diagnosis` 是审计结论；
- `advice` 是纠偏建议；
- 它们不是新的目标真相源。

任何实现若让 Reflector 产物长期替代 `GoalStateDocument`，都属于架构漂移。

---

### 4.2 不让 Reflector 越权写状态裁决

Reflector 可以说：
- 哪个 GoalState 断言可能偏了；
- 哪个 Curator 决策可能错了；
- 下一轮应如何纠偏。

但 Reflector **不能**直接决定：
- 哪个 active goal 立即关闭；
- 哪个 migration 立即成立；
- 哪个 summaryEntry 被重写。

这些仍属于 Curator 的职责边界。

---

### 4.3 不把局部技巧误沉淀为通用原则

凡是仅适用于：
- 单个文件；
- 单个函数；
- 单次偶然情境；
- 单个 narrow task 的技巧；

都不应进入原则层。这些结论最多属于 `advice` 或候选 `reference/script`，而不是原则库。

---

### 4.4 不把能力候选等同于自动执行计划

`assetCandidates` 只表达：
- 值得沉淀什么；
- 为什么值得；
- 更适合沉淀成哪类资产。

它不是自动创建 skill 的命令、自动写脚本的任务单或自动修改仓库结构的行动许可。否则 Reflector 会从"审计器"漂移成"执行编排器"。

---

### 4.5 不让 GoalContext 脱离 GoalState 生成逻辑

主模型与 Reflector 所看到的目标视图，必须来自同一套视图构造逻辑。

即：`buildGoalStateInjection(...)` 与 `buildReflectorGoalContext(...)` 必须继续共享统一的 goal view 生成路径。任何让两者分叉渲染的实现，都会重新引入"主模型看到的焦点"和"Reflector 看到的焦点"不一致的问题。

---

## 5. § 当前契约

### 5.1 Reflector 相关类型

```ts
interface ReflectorInput {
  currentRoundConversation: string;
  currentGoalState: GoalStateDocument | null;
  goalContext?: ReflectorGoalContext | null;
}

interface ReflectorResult {
  advice: string;
  principleOps: PrincipleOp[];
  hasSubstantiveContent: boolean;
  sections: {
    direction: string;
    blindSpots: string[];
    risks: string[];
    suggestions: string[];
  };
}
```

这意味着当前 Reflector：
- 还没有结构化 `diagnosis`；
- 还没有 `assetCandidates`；
- 还没有 `summaryCacheExcerpt / recentCuratorArtifacts / candidatePrinciples` 作为正式输入字段。

---

### 5.2 GoalState 边界

当前 `GoalStateDocument` 仍是轻量平面结构：`active[]`、`completed[]`、`migrations[]`、`prunedCount`。

因此在当前代码基线下：
- `focusPath` 不能被假设为真实祖先链；
- Reflector 不应依赖"完整树路径推理"。

---

### 5.3 GoalContext 的真实语义边界

```ts
interface ReflectorGoalContext {
  currentFocusGoalId: string | null;
  focusPath: Array<{ id: string; assertion: string; status: "active" | "suspended" | "completed" }>;
  siblingActiveGoals: Array<{ id: string; assertion: string }>;
  recentMigrations: Array<{ fromGoalId: string | null; toGoalId: string; reason: string }>;
}
```

注意：当前字段名叫 `siblingActiveGoals`，但由于 `goalState.active[]` 中允许 `status: "suspended"`，所以该字段在现状里更接近"除焦点外的并行跟踪目标"，而不一定严格等于"全部都是 status=active 的兄弟目标"。这是一处**已知语义张力**。

---

### 5.4 PrincipleOp 边界

当前仅支持：`create`、`reuse`、`merge`、`conflict`。当前输出处理链只消费 `principleOps`，不消费任何 `patternOps` 或 `assetCandidates`。

---

## 6. § 目标契约（演进方向）

### 6.1 目标角色定义

Reflector 应收敛为三层职责合一的系统：

1. **Auditor**：目标对齐与偏移归因审计
2. **Generalizer**：原则综合与原则演化
3. **Distiller**：模式蒸馏与能力资产候选发现

---

### 6.2 目标偏移根因分类

```ts
type DriftSource =
  | "none"
  | "goal_state_drift"
  | "generator_execution_drift"
  | "curator_misjudgment"
  | "mixed";
```

语义说明：

- `none`：当前执行与目标链一致，无明显偏移。
- `goal_state_drift`：当前 `GoalStateDocument` 对用户真实目标的表达已经偏离。
- `generator_execution_drift`：`GoalState` 基本正确，但 Generator 本轮执行偏离了当前焦点目标。
- `curator_misjudgment`：Curator 对上一轮的目标状态更新存在错误，导致当前注入基线被带偏。
- `mixed`：同时存在目标状态问题与执行问题，无法单独归因给单一层。

---

### 6.3 目标输入结构

```ts
interface ReflectorInputVNext {
  currentRoundConversation: string;
  currentGoalState: GoalStateDocument | null;
  goalContext: ReflectorGoalContext | null;
  summaryCacheExcerpt: SummaryEntry[];
  recentCuratorArtifacts: CuratorArtifactEntry[];
  candidatePrinciples: PrincipleItem[];
}
```

---

### 6.4 目标输出结构

```ts
interface ReflectorResultVNext {
  diagnosis: ReflectorDiagnosis;
  advice: string;
  principleOps: PrincipleOp[];
  assetCandidates: ReflectorAssetCandidate[];
}

interface ReflectorDiagnosis {
  aligned: boolean;
  driftSource: DriftSource;
  confidence: number;
  evidence: string[];
  explanation: string;
}

interface ReflectorAssetCandidate {
  type: "reference" | "script";
  title: string;
  rationale: string;
  evidence: string[];
  targetPath?: string;
  scope?: "shared" | "domain";
  notes?: string;
}
```

---

## 7. 不变量

### 7.1 Reflector 不能直接写 GoalState

Reflector 的结论只能影响：下一轮 Generator 如何被引导、原则库如何被建议更新、人或后续执行器是否应沉淀资产。Reflector 不能直接改写 GoalState。

---

### 7.2 GoalState 仍是单核真相源

无论 Reflector 多么强，都不能演化出第二个长期目标账本、第二个 objective snapshot 或第二套"真正目标状态"。任何需要长期驱动 Generator 的目标状态，都必须最终回到 Curator 维护的 `GoalStateDocument`。

---

### 7.3 原则必须跨目标，而非跨文件就算数

"跨文件"不等于"通用原则"。高质量原则至少应具备：可跨多个相近目标复用、能指导未来决策、有明确适用边界。

---

### 7.4 能力资产候选不得自动落地

Reflector 最多输出候选、理由、证据、推荐沉淀形态。不得在同一阶段直接自动写 Skill / Script 文件。

---

### 7.5 主模型与 Reflector 的目标视图必须同源

任何新增的 goalContext 字段，都必须来自与主模型注入同源的视图构造逻辑，而不是 Reflector 自己再私下推导一套不同的目标视图。

---

### 7.6 原则库治理必须由 PrinciplesCurator 承担

原则库的持续清理不依赖基于时间窗的自动删除机制，而是完全交由 PrinciplesCurator 进行语义级治理。

---

### 7.7 非法结构必须可降级而非硬崩溃

当 Reflector 输出不满足契约时，运行时遵循：JSON 不合法 → 回退文本 advice 解析；JSON 合法但字段缺失 → 仅消费合法部分；principleOps 非法 → 丢弃非法 op；assetCandidates 非法 → 全量忽略。**宁可降级，不要假装高置信消费错误结构。**

---

## 8. 非目标

1. **不是要把 Reflector 变成第二个 Curator**
2. **不是要让 Reflector 直接管理长期状态**
3. **不是要自动生成完整 Skill/Script 并落盘**
4. **不是要引入新的 requirement ledger / objective snapshot**
5. **不是要在 v1.2 一步完成完整 normalized goal tree 重构**
6. **不是要让 Reflector 替代主 Agent 自我反思能力**
7. **不是要基于时间窗自动删除原则**（原则治理由 PrinciplesCurator 语义判断）
8. **不是要在 Reflector 中输出 skill 候选**（已移出 Reflector，需未来独立模块承接）

---

## 9. 输入契约细化

### 9.1 当前最小输入

当前实现最小输入仍是：`currentRoundConversation`、`currentGoalState`、`goalContext`。这保证 Reflector 至少能做当前 round 的方向判断和相对当前 GoalState 的最基础偏移分析。

---

### 9.2 后续应补齐的 grounding 输入

#### a. `summaryCacheExcerpt`
用于判断：偏移是否连续发生；某实践是否跨多轮复现；当前问题是否只是单轮噪声。

#### b. `recentCuratorArtifacts`
用于判断：Curator 是否连续误收窄目标；standing instruction 是否被过早移除；signal 的判定是否多轮失真。

#### c. `candidatePrinciples`
用于判断：应复用哪条原则；应合并到哪条原则；哪些原则与新事实冲突；是否真的需要新增原则。

---

### 9.3 输入裁剪原则

1. `currentRoundConversation` 保留完整当前 round；
2. `summaryCacheExcerpt` 只保留最近 3-6 条；
3. `recentCuratorArtifacts` 只保留最近 2-4 条；
4. `candidatePrinciples` 只注入最相关的 3-8 条；
5. `goalContext` 仍需比完整 GoalState 更轻。

目标不是"让 Reflector 知道所有历史"，而是"让它有足够证据做上位判断"。

---

## 10. 分析顺序

Reflector 不能无结构地"看完再评论"，而应遵循固定顺序。

### Step 1：对齐检查

判断当前 round 的主要执行是否仍服务于当前 GoalState 的焦点目标，以及当前焦点目标是否合理表达了用户真正目标。

### Step 2：偏移归因

若存在偏移，判断偏移来自 GoalState 本身、Generator 执行、Curator 误判，还是混合因素。

### Step 3：原则对照

在偏移判断之后，检查：当前已有原则是否已覆盖此情形；若覆盖，是否应 `reuse`；若部分覆盖，是否应 `merge`；若新事实否定旧原则，是否应 `conflict`；若形成新的跨目标经验，是否应 `create`。

### Step 4：模式蒸馏

最后判断：当前最佳实践是单次技巧还是稳定模式；若是稳定模式，应沉淀为 `reference / script` 中哪一种。

任何实现若跳过 Step 2 直接输出原则，或跳过 Step 3 直接产出资产候选，都容易产生语义漂移。

---

## 11. 输出契约细化

### 11.1 兼容期输出策略

#### 兼容层（先做）
- 保留 `advice: string` 与 `principleOps`；
- 在正文末尾增加结构化 JSON 代码块；
- 解析器优先读 JSON，失败时回退旧段落解析。

#### 收敛层（后做）
- 正式升级 `ReflectorResult` 类型；
- 引入 `diagnosis` 与 `assetCandidates`；
- 降级旧的 `direction / blindSpots / risks / suggestions` 解析依赖。

---

### 11.2 推荐文本结构

兼容当前 prompt/解析习惯时，正文建议升级为以下段落：

```text
## 目标对齐判断
...

## 偏移归因
...

## 顾问意见
...

## 原则判断
...

## 能力沉淀候选
...

```json
{
  "diagnosis": { ... },
  "principleOps": [ ... ],
  "assetCandidates": [ ... ]
}
```
```

---

### 11.3 结构化结论的最小要求

#### `diagnosis`
必须至少包含：`aligned`、`driftSource`、`confidence`、`evidence`。

#### `principleOps`
必须继续遵守当前 `PrincipleOp` 联合类型约束。

#### `assetCandidates`
即便未来引入，也应遵循：最多 3 条；每条必须有 `type / title / rationale / evidence`；不包含任何"立即执行"的语义。

---

### 11.4 拒绝与降级策略

1. JSON 不合法 → 回退文本 advice 解析
2. JSON 合法但字段缺失 → 仅消费合法部分
3. `principleOps` 非法 → 丢弃非法 op，不影响 advice
4. `assetCandidates` 非法 → 全量忽略，不影响 principleOps
5. 文本与结构化 diagnosis 明显冲突 → 标记低置信度，优先保守不写入扩展状态

---

## 12. 偏移归因规则

### 12.1 何时判定 `goal_state_drift`

仅当有证据表明：当前 GoalState 已不再表达用户真正目标，且 Generator 的偏移主要是被错误目标锚点牵引，或 GoalState 明显遗漏了仍应持续有效的 standing instruction。不应因为 Generator 执行得不好，就草率判定 `goal_state_drift`。

---

### 12.2 何时判定 `generator_execution_drift`

仅当有证据表明：GoalState 基本合理；当前焦点目标也合理；但 Generator 在本轮把精力消耗在与主目标链弱相关的局部动作上。不应因为 GoalState 有轻微表达不完美，就把所有偏移都归给 Generator。

---

### 12.3 何时判定 `curator_misjudgment`

仅当有证据表明：问题主要起源于 Curator 的上一轮或最近几轮更新；且这种误判通过 GoalState 注入实际影响了 Generator；且不能更准确地归为单纯的 Generator 执行失误。这是一种比 `goal_state_drift` 更强的归因，不应滥用。

---

### 12.4 何时判定 `mixed`

当以下情况成立时可使用：GoalState 本身已有偏移，Generator 又在偏移目标上继续局部优化，或证据不足以清晰分拆责任来源。`mixed` 是保守分类，不是偷懒分类。

---

## 13. 原则演化规则

### 13.1 何时允许新增原则

仅当以下条件大体成立时，才允许 `create`：

1. 结论不依赖单一文件/单一函数/单一偶然步骤；
2. 结论能跨越当前具体目标，对未来相近任务有指导意义；
3. 结论包含触发条件与适用边界；
4. 当前候选原则库中不存在语义等价原则。

若不满足这些条件，应优先 `reuse`、`merge` 或仅输出 advice 而不入原则库。

---

### 13.2 何时应 `merge / conflict`

#### `merge`
适用于：旧原则方向正确；新事实让该原则边界更清晰；只是需要补充表达，而不是推翻旧原则。

#### `conflict`
适用于：新事实持续表明旧原则不成立；或旧原则在当前上下文下会系统性误导。Reflector 不应轻易 `conflict`，只有当新证据足以说明旧原则会带来稳定误导时，才应输出冲突意见。

---

### 13.3 原则内容要求

一条高质量原则应尽量包含：触发条件、适用范围、推荐动作、边界/例外。

应避免：空洞常识、只解释过去不指导未来、与当前目标链完全无关、仅适用于一个具体文件的局部技巧。

---

## 14. 模式蒸馏与能力资产候选规则

### 14.1 何时沉淀为 `reference`

适用于：已经有稳定方法论；暂时不需要自动化；主要价值在于解释"怎么做、为什么这样做"。

---

### 14.2 何时沉淀为 `script`

适用于：执行步骤已明显稳定；具备明确输入输出；重复人工操作成本高；可被 CLI/脚本可靠复现。

并应进一步区分：
- `shared`：多个场景共用，适合 `scripts/shared/`
- `domain`：某子领域专用，适合 `scripts/{domain}/`

---

### 14.3 Skill 候选已移出 Reflector 当前职责

当前实现与当前职责边界下：

1. Reflector 不再输出 `skill` 候选；
2. `skill` 是否值得沉淀，需要未来单独模块结合更长时间窗信号判断（如大 turn 阈值、重复错误模式、跨轮复发证据等独立触发）；
3. 在该独立模块成形前，Reflector 仅保留 `reference / script` 候选能力。

---

## 15. 规范级别

### 15.1 MUST（必须满足）

1. Reflector 不能成为第二个目标真相源
2. Reflector 不能直接改写 GoalState / SummaryEntry
3. 主模型与 Reflector 的目标视图必须同源
4. 迁移必须保持兼容路径
5. 非法结构必须可降级而非硬崩溃
6. 原则新增必须满足跨目标通用性
7. assetCandidates 不能自动落地
8. Reflector artifact 若引入，不得膨胀 GRCState
9. 原则库治理必须由 PrinciplesCurator 承担，不得引入基于时间窗的自动删除机制

### 15.2 SHOULD（强烈建议）

1. 优先引入结构化 `diagnosis`
2. 优先给 Reflector 注入 candidate principles（Top 50 SlimPrincipleItem）
3. 优先补齐 recent curator artifacts / summary cache excerpt
4. 优先增加 drift 归因测试与兼容解析测试
5. 在 assetCandidates 真正接入前，先定义统一 schema

### 15.3 MAY（可选增强）

1. 为 Reflector artifact 增加更细粒度统计字段
2. 为 script candidate 增加 `shared/domain` 更细粒度分类
3. 为原则演化增加更复杂的分级置信度模型
4. PrinciplesCurator 触发阈值做成配置项
5. PrinciplesCurator 保留历史治理记录（当前每次覆盖）

---

*版本：reflector_v1.2 | 更新时间：2026-05-14*
