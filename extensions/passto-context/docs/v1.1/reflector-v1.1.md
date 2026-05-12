# PasstoContext v1.1 Reflector 设计文档

> 状态：design-draft
> 目标：为 Reflector 建立与 Curator v1.1 同等级别的设计哲学、输入输出契约、迁移边界与防漂移约束。
> 参考：
> - `docs/v1.1/curator-v1.1.md`
> - `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`
> - 当前实现：`types.ts` / `grc-prompts.ts` / `grc-subagent.ts` / `grc-principles.ts` / `index.ts`
> - 能力资产沉淀参考：`/Users/handy/.claude/skills/metaskills-creator/SKILL.md`
>
> 说明：
> - 当前代码实现仍以 `V1_1_FINAL_ARCHITECTURE.md` 为主路径依据。
> - 本文档用于定义 Reflector 的目标形态与迁移策略，避免后续实现时出现角色漂移、字段漂移、职责漂移。
> - 本文档中的“现状契约（as-is）”与“目标契约（to-be）”必须明确区分，不允许混写。

---

## 1. 收敛结论

Reflector 不应再被定义为“高级技术顾问”或“对当前 round 的泛评论器”，而应收敛为：

**Reflector = post-round 上位审计器（Auditor） + 原则综合器（Generalizer） + 模式蒸馏器（Distiller）**

它在 `agent_end` 之后，从比当前执行更宽的视野审视：

1. 当前 `GoalStateDocument` 是否仍正确表达用户真正目标；
2. `Generator`（主进程）当前 round 的执行是否偏离目标链；
3. `Curator` 是否因错误判断而使 `GoalState` 逐轮漂移；
4. 哪些经验值得沉淀为跨目标适用的原则；
5. 哪些局部最佳实践已经成熟到应进一步沉淀为 `reference / script` 级别的可复用能力资产。
   - `skill` 已不再属于 Reflector 当前职责；若未来恢复，应走独立模块/流程设计。

因此 Reflector 的核心职责不是“总结刚刚发生了什么”，而是回答三个更高层的问题：

1. **本轮执行是否仍服务于正确的目标链？**
2. **如果发生偏移，偏在 `GoalState`、`Generator` 还是 `Curator`？**
3. **如果本轮出现可复用模式，应沉淀为原则，还是进一步沉淀为能力资产？**

---

## 2. 底层设计哲学

### 2.1 Reflector 不是摘要器，而是校准器

Curator 的工作是在 `before_agent_start` 用后验用户信号校准上一轮目标状态。

Reflector 的工作则是在 `agent_end` 对“本轮执行 + 当前目标状态 + 原则系统”做一次上位审计，防止系统因局部误判持续偏航。

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

Reflector 必须能区分这两类故障，不能仅输出笼统的“方向似乎不太对”。

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

Reflector 既不是“凭空创造原则”，也不是“机械复用旧原则”，而是：

- 在现有原则库框架下理解本轮事实；
- 再决定是 `reuse / merge / conflict / create`；
- 并且只有当新经验具备跨目标通用性时，才允许进入原则层。

---

### 2.4 原则不是终点，稳定模式应继续沉淀为能力资产

原则是抽象经验层。

但有些经验已经不只是“值得被记住”，而是“值得被稳定复用”。

当一条最佳实践已经具备：

- 明确触发条件；
- 稳定执行路径；
- 可复用步骤；
- 可脚本化或可文档化边界；

它就不应只停留在原则库里，而应进入更可执行的沉淀层：

- `reference`：可复用方法说明
- `script`：可复用自动化脚本
- `skill`：可被路由触发的复合能力

这使 Reflector 成为“能力产品化”的发现入口，而不仅是“经验文本生成器”。

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
- `skill` 沉淀不再由 Reflector 直接提出，需留给未来独立模块。

---

### 3.2 Curator 的边界

Curator：
- 在 `before_agent_start` 使用“当前轮用户第一条消息”这一后验信号；
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

本节是后续实现时的最高优先级约束。

### 4.1 不新增第二个目标真相源

Reflector 可以诊断：
- `goal_state_drift`
- `curator_misjudgment`

但 Reflector **不能**引入一套新的“当前目标状态对象”去替代 `GoalStateDocument`。

也就是说：
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

都不应进入原则层。

这些结论最多属于：
- advice
- 或候选 reference/script

而不是原则库。

---

### 4.4 不把能力候选等同于自动执行计划

`assetCandidates` 只表达：
- 值得沉淀什么；
- 为什么值得；
- 更适合沉淀成哪类资产。

它不是：
- 自动创建 skill 的命令；
- 自动写脚本的任务单；
- 自动修改仓库结构的行动许可。

否则 Reflector 会从“审计器”漂移成“执行编排器”。

---

### 4.5 不让 GoalContext 脱离 GoalState 生成逻辑

主模型与 Reflector 所看到的目标视图，必须来自同一套视图构造逻辑。

即：
- `buildGoalStateInjection(...)`
- `buildReflectorGoalContext(...)`

必须继续共享统一的 goal view 生成路径。

任何让两者分叉渲染的实现，都会重新引入“主模型看到的焦点”和“Reflector 看到的焦点”不一致的问题。

---

## 5. 现状契约（as-is，以当前 types.ts 为准）

本节只描述当前实现，不表达未来理想结构。

### 5.1 当前 Reflector 相关类型

基于 `types.ts`，当前核心类型为：

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

### 5.2 当前 GoalState 边界

基于 `types.ts`，当前 `GoalStateDocument` 仍是轻量平面结构：

- `active[]`
- `completed[]`
- `migrations[]`
- `prunedCount`

它**不是** Curator 早期文档中那种归一化树的完整实现。

因此在当前代码基线下：
- `focusPath` 不能被假设为真实祖先链；
- Reflector 不应依赖“完整树路径推理”；
- 任何文档若直接按归一化树来写实现要求，都会造成实现漂移。

---

### 5.3 当前 GoalContext 的真实语义边界

基于 `types.ts`：

```ts
interface ReflectorGoalContext {
  currentFocusGoalId: string | null;
  focusPath: Array<{ id: string; assertion: string; status: "active" | "suspended" | "completed" }>;
  siblingActiveGoals: Array<{ id: string; assertion: string }>;
  recentMigrations: Array<{ fromGoalId: string | null; toGoalId: string; reason: string }>;
}
```

注意：当前字段名叫 `siblingActiveGoals`，但由于 `buildGoalViewModel(...)` 的实现依赖 `goalState.active[]`，且 `active[]` 中允许 `status: "suspended"`，所以该字段在现状里更接近：

- “除焦点外的并行跟踪目标”

而不一定严格等于：

- “全部都是 status=active 的兄弟目标”

这是一处**已知语义张力**。在 v1.1 迭代中，文档与实现都不应假装它已经被彻底解决。

---

### 5.4 当前 PrincipleOp 边界

基于 `types.ts`，当前仅支持：

- `create`
- `reuse`
- `merge`
- `conflict`

并且当前输出处理链只消费 `principleOps`，不消费任何 `patternOps` 或 `assetCandidates`。

因此：
- 在迁移完成前，不应让 prompt 先依赖不存在的消费链；
- 新能力应先以兼容字段或附加 JSON 方式引入，再决定是否升级类型。

---

## 6. 目标契约（to-be，Reflector 的收敛方向）

目标契约描述的是 Reflector 的演进目标，不代表当前代码已具备。

### 6.1 目标角色定义

Reflector 应收敛为三层职责合一的系统：

1. **Auditor**：目标对齐与偏移归因审计
2. **Generalizer**：原则综合与原则演化
3. **Distiller**：模式蒸馏与能力资产候选发现

---

### 6.2 目标偏移根因分类

推荐的偏移根因分类：

```ts
type DriftSource =
  | "none"
  | "goal_state_drift"
  | "generator_execution_drift"
  | "curator_misjudgment"
  | "mixed";
```

语义说明：

- `none`
  - 当前执行与目标链一致，无明显偏移。
- `goal_state_drift`
  - 当前 `GoalStateDocument` 对用户真实目标的表达已经偏离。
- `generator_execution_drift`
  - `GoalState` 基本正确，但 Generator 本轮执行偏离了当前焦点目标。
- `curator_misjudgment`
  - Curator 对上一轮的目标状态更新存在错误，导致当前注入基线被带偏。
- `mixed`
  - 同时存在目标状态问题与执行问题，无法单独归因给单一层。

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

注意：`ReflectorInputVNext` 是**目标结构**，不是当前 `types.ts` 中已存在的结构。

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

同样注意：这属于**目标契约**，不能假装当前运行时已经支持。

---

## 7. 不变量（Normative Invariants）

后续所有实现都必须遵守以下不变量。

### 7.1 Reflector 不能直接写 GoalState

Reflector 的结论只能影响：
- 下一轮 Generator 如何被引导；
- 原则库如何被建议更新；
- 人或后续执行器是否应沉淀资产。

Reflector 不能直接改写 GoalState。

---

### 7.2 GoalState 仍是单核真相源

无论 Reflector 多么强，都不能演化出：
- 第二个长期目标账本；
- 第二个 objective snapshot；
- 第二套“真正目标状态”。

任何需要长期驱动 Generator 的目标状态，都必须最终回到 Curator 维护的 `GoalStateDocument`。

---

### 7.3 原则必须跨目标，而非跨文件就算数

“跨文件”不等于“通用原则”。

高质量原则至少应具备：
- 可跨多个相近目标复用；
- 能指导未来决策；
- 有明确适用边界。

---

### 7.4 能力资产候选不得自动落地

Reflector 最多输出：
- 候选
- 理由
- 证据
- 推荐沉淀形态

不得在同一阶段直接自动写 Skill / Script 文件。

---

### 7.5 主模型与 Reflector 的目标视图必须同源

任何新增的 goalContext 字段，都必须来自与主模型注入同源的视图构造逻辑，而不是 Reflector 自己再私下推导一套不同的目标视图。

---

## 8. 非目标（Non-goals）

为了避免文档过度膨胀，本设计明确以下事情**不是** Reflector v1.1 的目标。

1. **不是要把 Reflector 变成第二个 Curator**
2. **不是要让 Reflector 直接管理长期状态**
3. **不是要自动生成完整 Skill/Script 并落盘**
4. **不是要引入新的 requirement ledger / objective snapshot**
5. **不是要在 v1.1 一步完成完整 normalized goal tree 重构**
6. **不是要让 Reflector 替代主 Agent 自我反思能力**

---

## 9. 输入契约细化

### 9.1 当前最小输入

当前实现最小输入仍是：
- `currentRoundConversation`
- `currentGoalState`
- `goalContext`

这保证 Reflector 至少能做：
- 当前 round 的方向判断
- 相对当前 GoalState 的最基础偏移分析

---

### 9.2 后续应补齐的 grounding 输入

为了实现真正的上位审计与原则综合，应逐步补齐：

#### a. `summaryCacheExcerpt`
用于判断：
- 偏移是否连续发生；
- 某实践是否跨多轮复现；
- 当前问题是否只是单轮噪声。

#### b. `recentCuratorArtifacts`
用于判断：
- Curator 是否连续误收窄目标；
- standing instruction 是否被过早移除；
- `signal` 的判定是否多轮失真。

#### c. `candidatePrinciples`
用于判断：
- 应复用哪条原则；
- 应合并到哪条原则；
- 哪些原则与新事实冲突；
- 是否真的需要新增原则。

---

### 9.3 输入裁剪原则

Reflector 需要宽视野，但不能无限扩张输入。

推荐裁剪规则：

1. `currentRoundConversation` 保留完整当前 round；
2. `summaryCacheExcerpt` 只保留最近 3-6 条；
3. `recentCuratorArtifacts` 只保留最近 2-4 条；
4. `candidatePrinciples` 只注入最相关的 3-8 条；
5. `goalContext` 仍需比完整 GoalState 更轻。

目标不是“让 Reflector 知道所有历史”，而是“让它有足够证据做上位判断”。

---

## 10. 分析顺序（防实现漂移版）

Reflector 不能无结构地“看完再评论”，而应遵循固定顺序。

### Step 1：对齐检查
先判断：
- 当前 round 的主要执行是否仍服务于当前 GoalState 的焦点目标；
- 当前焦点目标是否合理表达了用户真正目标。

### Step 2：偏移归因
若存在偏移，再判断：
- 偏移来自 GoalState 本身；
- 偏移来自 Generator 执行；
- 偏移来自 Curator 误判；
- 或者是混合因素。

### Step 3：原则对照
在偏移判断之后，检查：
- 当前已有原则是否已覆盖此情形；
- 若覆盖，是否应 `reuse`；
- 若部分覆盖，是否应 `merge`；
- 若新事实否定旧原则，是否应 `conflict`；
- 若形成新的跨目标经验，是否应 `create`。

### Step 4：模式蒸馏
最后判断：
- 当前最佳实践是单次技巧，还是稳定模式；
- 若是稳定模式，应沉淀为 `reference / script` 中哪一种。
- `skill` 方向当前不在 Reflector 决策面内，后续若需要，应单独设计模块与触发条件。

任何实现若跳过 Step 2 直接输出原则，或跳过 Step 3 直接产出资产候选，都容易产生语义漂移。

---

## 11. 输出契约细化

### 11.1 兼容期输出策略

为了避免一次性破坏现有解析链，Reflector 的演进应分两层：

#### 兼容层（先做）
- 保留 `advice: string`
- 保留 `principleOps`
- 在正文末尾增加结构化 JSON 代码块
- 解析器优先读 JSON，失败时回退旧段落解析

#### 收敛层（后做）
- 正式升级 `ReflectorResult` 类型
- 引入 `diagnosis`
- 引入 `assetCandidates`
- 降级旧的 `direction / blindSpots / risks / suggestions` 解析依赖

这条兼容策略是本设计的关键防漂移措施：**先加法，后替换，不做大爆炸切换**。

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

相比当前“方向评估 / 盲点 / 风险 / 建议”的格式，这种结构更贴近 Reflector 的真实职责。

---

### 11.3 结构化结论的最小要求

#### `diagnosis`
必须至少包含：
- `aligned`
- `driftSource`
- `confidence`
- `evidence`

#### `principleOps`
必须继续遵守当前 `PrincipleOp` 联合类型约束。

#### `assetCandidates`
即便未来引入，也应遵循：
- 最多 3 条；
- 每条必须有 `type / title / rationale / evidence`；
- 不包含任何“立即执行”的语义。

---

### 11.4 拒绝与降级策略

当 Reflector 输出不满足契约时，运行时应遵循：

1. JSON 不合法 → 回退文本 advice 解析
2. JSON 合法但字段缺失 → 仅消费合法部分
3. `principleOps` 非法 → 丢弃非法 op，不影响 advice
4. `assetCandidates` 非法 → 全量忽略，不影响 principleOps
5. 文本与结构化 diagnosis 明显冲突 → 标记低置信度，优先保守不写入扩展状态

原则：**宁可降级，不要假装高置信消费错误结构。**

---

## 12. 偏移归因规则

这是最容易在实现中被写歪的一节，因此单独列出。

### 12.1 何时判定 `goal_state_drift`

仅当有证据表明：
- 当前 GoalState 已不再表达用户真正目标；
- 且 Generator 的偏移主要是被错误目标锚点牵引；
- 或 GoalState 明显遗漏了仍应持续有效的 standing instruction。

不应因为 Generator 执行得不好，就草率判定 `goal_state_drift`。

---

### 12.2 何时判定 `generator_execution_drift`

仅当有证据表明：
- GoalState 基本合理；
- 当前焦点目标也合理；
- 但 Generator 在本轮把精力消耗在与主目标链弱相关的局部动作上。

不应因为 GoalState 有轻微表达不完美，就把所有偏移都归给 Generator。

---

### 12.3 何时判定 `curator_misjudgment`

仅当有证据表明：
- 问题主要起源于 Curator 的上一轮或最近几轮更新；
- 且这种误判通过 GoalState 注入实际影响了 Generator；
- 且不能更准确地归为单纯的 Generator 执行失误。

这是一种比 `goal_state_drift` 更强的归因，不应滥用。

---

### 12.4 何时判定 `mixed`

当以下情况成立时可使用：
- GoalState 本身已有偏移；
- Generator 又在偏移目标上继续局部优化；
- 或证据不足以清晰分拆责任来源。

`mixed` 是保守分类，不是偷懒分类。

---

## 13. 原则演化规则

### 13.1 何时允许新增原则

仅当以下条件大体成立时，才允许 `create`：

1. 结论不依赖单一文件/单一函数/单一偶然步骤；
2. 结论能跨越当前具体目标，对未来相近任务有指导意义；
3. 结论包含触发条件与适用边界；
4. 当前候选原则库中不存在语义等价原则。

若不满足这些条件，应优先：
- `reuse`
- `merge`
- 或仅输出 advice 而不入原则库。

---

### 13.2 何时应 `merge / conflict`

#### `merge`
适用于：
- 旧原则方向正确；
- 新事实让该原则边界更清晰；
- 只是需要补充表达，而不是推翻旧原则。

#### `conflict`
适用于：
- 新事实持续表明旧原则不成立；
- 或旧原则在当前上下文下会系统性误导。

Reflector 不应轻易 `conflict`。只有当新证据足以说明旧原则会带来稳定误导时，才应输出冲突意见。

---

### 13.3 原则内容要求

一条高质量原则应尽量包含：
- 触发条件
- 适用范围
- 推荐动作
- 边界/例外

应避免：
- 空洞常识
- 只解释过去、不指导未来
- 与当前目标链完全无关
- 仅适用于一个具体文件的局部技巧

---

## 14. 模式蒸馏与能力资产候选规则

### 14.1 何时沉淀为 `reference`

适用于：
- 已经有稳定方法论；
- 暂时不需要自动化；
- 主要价值在于解释“怎么做、为什么这样做”。

---

### 14.2 何时沉淀为 `script`

适用于：
- 执行步骤已明显稳定；
- 具备明确输入输出；
- 重复人工操作成本高；
- 可被 CLI/脚本可靠复现。

并应进一步区分：
- `shared`：多个场景共用，适合 `scripts/shared/`
- `domain`：某子领域专用，适合 `scripts/{domain}/`

---

### 14.3 何时沉淀为 `skill`

适用于：
- 不只是单个脚本，而是一整条可路由的工作流；
- 涉及多步骤判断、文档说明、可能还有多个脚本；
- 未来有明确触发场景。

此时应优先参考 `metaskills-creator`：
- 采用 `SKILL.md` 路由器；
- 用 `references/*.md` 承载实质方法；
- 用 `scripts/shared/` 或 `scripts/{domain}/` 放可执行载体；
- 如果多个子领域存在共享逻辑，应考虑聚合 Skill 而非零散追加。

---

### 14.4 Skill 候选已移出 Reflector 当前职责

当前实现与当前职责边界下：

1. Reflector 不再输出 `skill` 候选；
2. `skill` 是否值得沉淀，需要未来单独模块结合更长时间窗信号判断；
3. 例如可基于大 turn 阈值、重复错误模式、跨轮复发证据等独立触发；
4. 在该独立模块成形前，Reflector 仅保留 `reference / script` 候选能力。

---

## 15. Reflector Artifact 设计建议

当前代码尚无 Reflector artifact 持久层，但为了后续可审计性，建议预留如下结构：

```ts
interface ReflectorArtifactEntry {
  customType: "grc-reflector-artifact";
  agentRound: number;
  recordedAt: string;
  diagnosis: ReflectorDiagnosis | null;
  advice: string | null;
  principleOps: PrincipleOp[];
  assetCandidates?: ReflectorAssetCandidate[];
}
```

设计原则：
- 详细历史留在 artifact；
- `GRCState.reflector` 只保留轻量最近状态；
- 不把长期审计历史塞进状态对象本体。

---

## 16. 当前实现与目标之间的差距

### 16.1 角色定位过弱
当前 prompt 将 Reflector 定义为“高级技术顾问”，无法承载上位审计、原则综合与模式蒸馏三层职责。

### 16.2 输入不完整
当前 Reflector 未正式接收：
- `summaryCacheExcerpt`
- `recentCuratorArtifacts`
- `candidatePrinciples`

### 16.3 输出契约过轻
当前输出仍以自由文本为主，仅附带 `principleOps`，缺少：
- `diagnosis`
- `driftSource`
- `assetCandidates`

### 16.4 原则库尚未真正成为 Reflector 输入
当前原则主要注入给 Generator，而不是注入给 Reflector 自身，这会削弱 `reuse / merge / conflict` 的真实性。

### 16.5 缺少 Reflector artifact 持久层
Curator 已有 `grc-curator-artifact`。Reflector 若要支持长期回顾与失败分析，也应有自己的结构化 artifact。

### 16.6 缺少独立的能力蒸馏链路
当前系统虽已有 `assetCandidates`，但其现行职责仅覆盖 `reference / script`。`skill` 候选已明确移出 Reflector，需要未来单独模块承接。

### 16.7 当前语义字段存在张力
`goalContext.siblingActiveGoals` 在现状里并不总是严格“active”，文档与实现必须正视这点，不能在未修复前把它当作严格语义字段使用。

---

## 17. 实施路径（按防漂移优先级排序）

### Phase 1：收紧角色与兼容输出
- 重写 Reflector prompt 的角色定义
- 从“方向评估/盲点/风险/建议”收敛到“对齐判断/偏移归因/顾问意见/原则判断/能力候选”
- 先保留 `advice + principleOps`，再追加 JSON 结构化结论

### Phase 2：补齐输入 grounding
- 注入 `summaryCacheExcerpt`
- 注入 `recentCuratorArtifacts`
- 注入 `candidatePrinciples`

### Phase 3：原则层升级
- 让 `principleOps` 显式相对现有原则库工作
- 为 `reuse / merge / conflict` 提供真实 target grounding

### Phase 4：加入模式蒸馏输出
- 增加 `assetCandidates`
- 仅作为候选，不自动落地
- 为后续 Builder / Executor / 人工审阅提供输入

### Phase 5：补齐 artifact 与恢复链
- 增加 `grc-reflector-artifact`
- 增加 restore / replay / audit 观察口径
- 保持 `GRCState` 轻量，不把完整历史塞入状态本体

---

## 18. 规范级别（MUST / SHOULD / MAY）

本节用于把前文要求转换成实现时可执行的优先级语义。

### 18.1 MUST（必须满足）

以下事项属于硬约束，任一项被破坏都视为实现漂移：

1. **Reflector 不能成为第二个目标真相源**
   - 不能新增一套长期替代 `GoalStateDocument` 的状态对象。

2. **Reflector 不能直接改写 GoalState / SummaryEntry**
   - 它只能输出 diagnosis / advice / principleOps / assetCandidates 一类审计与建议性产物。

3. **主模型与 Reflector 的目标视图必须同源**
   - `buildGoalStateInjection(...)` 与 `buildReflectorGoalContext(...)` 必须继续共享同一套 goal view 逻辑。

4. **迁移必须保持兼容路径**
   - 在新结构完全落地前，必须保留现有 `advice + principleOps` 消费链。

5. **非法结构必须可降级而非硬崩溃**
   - JSON 不合法、字段缺失、`principleOps` 非法时，运行时必须保守降级。

6. **原则新增必须满足跨目标通用性**
   - 局部技巧不得直接进入原则库。

7. **assetCandidates 不能自动落地**
   - 不得在同一阶段自动生成 Skill / Script / Reference 文件。

8. **Reflector artifact 若引入，不得膨胀 GRCState**
   - 长历史放 artifact，轻状态放 `GRCState.reflector`。

---

### 18.2 SHOULD（强烈建议）

以下事项不是硬阻塞，但如果跳过，会显著增加后续漂移与返工概率：

1. **优先引入结构化 `diagnosis`**
   - 先把偏移归因做成可解析结论，再优化文案质量。

2. **优先给 Reflector 注入 candidate principles**
   - 这样 `reuse / merge / conflict` 才有真实 grounding。

3. **优先补齐 recent curator artifacts / summary cache excerpt**
   - 这样 Reflector 才能具备跨轮判断能力。

4. **优先拆出独立 Reflector parser**
   - 避免 `grc-subagent.ts` 持续堆叠解析复杂度。

5. **优先增加 drift 归因测试与兼容解析测试**
   - 这两类测试最能防止后期 prompt 微调把系统带偏。

6. **在 assetCandidates 真正接入前，先定义统一 schema**
   - 避免未来每轮都换字段名。

---

### 18.3 MAY（可选增强）

以下事项可在主链稳定后再做：

1. 为 Reflector artifact 增加更细粒度统计字段
2. 为 skill candidate 增加推荐目录路径模板
3. 为 script candidate 增加 `shared/domain` 更细粒度分类
4. 为原则演化增加更复杂的分级置信度模型
5. 为 assetCandidates 增加后续人工审阅状态机

这些增强有价值，但不应阻塞 v1.1 主线收敛。

---

## 19. 实现前检查清单（Pre-implementation Gate）

在开始任何 Reflector 代码改造前，必须逐项自查：

### 19.1 架构层检查

- [ ] 本次改动是否仍然把 `GoalStateDocument` 视为唯一目标真相源？
- [ ] 本次改动是否让 Reflector 只做审计/建议，而非直接做状态裁决？
- [ ] 本次改动是否保持主模型与 Reflector 的目标视图同源？
- [ ] 本次改动是否避免引入新的 ledger / snapshot / 隐式目标账本？

### 19.2 类型层检查

- [ ] 是否明确区分了当前 `types.ts` 现状类型与 vNext 目标类型？
- [ ] 新增字段是否有清晰的消费链，而不是只存在于 prompt 文本里？
- [ ] 若新增 `assetCandidates` 或 `diagnosis`，是否定义了合法最小 schema？
- [ ] 是否避免在未接入运行时前就把目标类型误当现状类型使用？

### 19.3 Prompt / Parser 层检查

- [ ] Prompt 是否明确要求偏移归因，而不是泛泛建议？
- [ ] Prompt 是否区分 advice、principleOps、assetCandidates 三类产物？
- [ ] Parser 是否支持“新 JSON 优先、旧文本降级”的兼容策略？
- [ ] 输出非法时是否有保守降级，而不是静默误消费？

### 19.4 Principles 层检查

- [ ] Reflector 是否已拿到 candidate principles，而不是盲目输出 `reuse/merge/conflict`？
- [ ] 是否明确限制局部技巧不能直接进入原则库？
- [ ] 是否保证 `PrincipleOp` 仍兼容当前联合类型？

### 19.5 Asset Candidates 层检查

- [ ] assetCandidates 是否仅表达候选，不包含自动执行语义？
- [ ] skill candidate 是否说明路由维度与 `router + references/ + scripts/` 关系？
- [ ] script candidate 是否说明 `shared` 或 `domain` 范围？
- [ ] 是否避免把一次性实现建议误报成长期能力资产？

### 19.6 状态 / Artifact 层检查

- [ ] 新增 artifact 是否只承载长历史，不污染 `GRCState` 主状态？
- [ ] restore / replay 逻辑是否与 curator artifact 的治理方式一致？
- [ ] `/ptc status` 是否只暴露必要观测，而不把调试字段永久公开化？

### 19.7 测试层检查

- [ ] 是否新增或更新 drift 归因测试？
- [ ] 是否新增或更新兼容解析测试？
- [ ] 是否新增或更新 principles grounding 测试？
- [ ] 若接入 assetCandidates，是否新增对应 schema / 行为测试？

只有当以上检查大体通过时，才建议进入具体实现。

---

## 20. 建议的测试覆盖

Reflector 后续应至少覆盖以下测试面：

1. **对齐判断测试**
   - GoalState 正确、Generator 正确 → `aligned=true`
   - GoalState 正确、Generator 偏移 → `generator_execution_drift`
   - GoalState 偏移 → `goal_state_drift`
   - Curator 连续误判 → `curator_misjudgment`

2. **兼容解析测试**
   - 旧 markdown 输出仍可解析
   - 新 JSON 输出优先解析
   - JSON 缺字段时正确降级

3. **原则 grounding 测试**
   - 有旧原则时优先 `reuse/merge`
   - 无匹配时才 `create`
   - 与旧原则冲突时输出 `conflict`

4. **模式蒸馏测试**
   - 单次局部技巧不应产出 asset candidate
   - 稳定方法论可产出 `reference`
   - 稳定自动化流程可产出 `script`
   - 稳定复合工作流可产出 `skill`

5. **artifact 测试**
   - reflector artifact 持久化
   - restore/replay 不污染当前状态
   - 长历史仅存在于 artifact，不膨胀 GRCState

---

## 21. 与现有代码文件的映射建议

为减少实现时的理解分叉，建议按文件职责推进：

- `types.ts`
  - 增加 vNext 目标类型或兼容类型
- `grc-prompts.ts`
  - 重写 Reflector prompt，加入结构化 JSON 约束
- `grc-subagent.ts`
  - 先做兼容解析，再逐步提取 `grc-reflector-parser.ts`
- `index.ts`
  - 补齐 Reflector 输入组装与 artifact 持久化
- `grc-principles.ts`
  - 提供 candidate principles grounding 支持
- `tests/*`
  - 补齐 drift / compatibility / principles / assets / artifact 覆盖

原则：**一阶段只改一层主语义，避免 prompt/types/parser/state 同时大爆炸变更。**

---

## 22. 一句话结论

Reflector v1.1 的正确方向不是“继续优化顾问意见 prompt”，而是：

**把 Reflector 从泛顾问升级为面向 GoalState / Curator / Generator 的上位审计系统，并让它同时承担原则综合与能力蒸馏入口。**

只有这样，PasstoContext 才能避免：

- `GoalState` 被误判后持续污染上下文；
- Generator 在错误目标上越做越深；
- 局部最佳实践只能停留在一次性文本建议中，无法升级为稳定复用能力；
- 实现过程中把 Reflector 误做成第二个 Curator 或新的目标真相源。

---

*文档版本: reflector-v1.1-draft-refined*
*最后更新: 2026-05-11*
