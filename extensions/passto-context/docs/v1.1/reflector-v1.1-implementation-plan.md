# PasstoContext Reflector v1.1 实现计划

> 状态：implementation-plan-draft
> 作用：把 `reflector-v1.1.md` 收敛为可执行的工程计划，避免后续实现时在 prompt、types、parser、state、tests 多线同时漂移。
> 设计依据：
> - `docs/v1.1/reflector-v1.1.md`
> - `docs/v1.1/curator-v1.1.md`
> - `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`
> - 当前代码：`types.ts` / `grc-prompts.ts` / `grc-subagent.ts` / `grc-goal-context.ts` / `grc-goal-view.ts` / `grc-principles.ts` / `index.ts`
>
> 当前日期：2026-05-11

---

## 0. 计划目标

本计划只解决一件事：

**把当前“高级技术顾问型 Reflector”收敛为“上位审计器 + 原则综合器 + 模式蒸馏入口”，并以兼容迁移方式落地。**

这里的关键不是一次性做完全部理想能力，而是：

1. 先把 Reflector 的角色和输出契约收紧；
2. 再补输入 grounding；
3. 再引入更强的结构化产物；
4. 全程避免破坏现有 `advice + principleOps` 主链。

---

## 1. 当前代码基线（只写与 Reflector 直接相关部分）

基于当前代码：

### 1.1 已存在能力

- `index.ts`
  - 能在 `agent_end` 与 mid-run 场景调用 Reflector
  - 会把 `grcState.curator.lastGoalState` 转成 `buildReflectorGoalContext(...)`
  - 会消费 `result.advice`
  - 会消费 `result.principleOps`

- `grc-prompts.ts`
  - 已有 `buildReflectorSubagentPrompt(...)`
  - 当前输出格式仍是：
    - `方向评估`
    - `盲点`
    - `风险`
    - `建议`
    - JSON `principleOps`

- `grc-subagent.ts`
  - 已有 `executeReflector(...)`
  - 已有 `parseReflectorOutput(...)`
  - 已有 `extractPrincipleOps(...)`

- `types.ts`
  - 已有 `ReflectorInput`
  - 已有 `ReflectorResult`
  - 已有 `ReflectorGoalContext`
  - 已有 `PrincipleOp`

- `grc-goal-context.ts` / `grc-goal-view.ts`
  - 已能从当前轻量 `GoalStateDocument` 生成 Reflector 所见的焦点视图

### 1.2 当前缺口

- Reflector 角色仍是“高级技术顾问”
- 输出没有结构化 `diagnosis`
- 输入没有 `summaryCacheExcerpt / recentCuratorArtifacts / candidatePrinciples`
- 输出没有 `assetCandidates`
- 没有 Reflector artifact
- parser 仍强绑定旧 markdown 段落名

---

## 2. 实现原则

### 2.1 先兼容，后收敛

不允许第一步就直接替换：
- `ReflectorResult`
- `parseReflectorOutput(...)`
- `index.ts` 消费逻辑

正确路径是：
1. 保留现有主链
2. 增加新字段/新 JSON
3. 让 parser 兼容双格式
4. 最后再决定是否收紧旧字段

---

### 2.2 一批只改一层主语义

每一批改造最多只引入一个主要语义变化，例如：
- 批次 A：只改 prompt + parser 兼容
- 批次 B：只改输入 grounding
- 批次 C：只改新输出消费

不要把：
- prompt 重写
- types 全改
- parser 重构
- artifact 引入
- status 展示改版

放在同一批次，否则难以定位漂移来源。

---

### 2.3 先解决“判断正确”，再解决“表达丰富”

优先级顺序必须是：

1. 偏移归因正确
2. principleOps grounding 正确
3. asset candidate 结构稳定
4. 文案更漂亮

文案质量不能先于语义正确性。

---

## 3. 范围与非范围

### 3.1 本计划范围内

- Reflector prompt 重写
- Reflector parser 兼容升级
- Reflector 输入补齐 grounding
- Reflector 输出补齐 `diagnosis`
- `assetCandidates` 最小 schema 引入
- Reflector artifact 预留或落地
- 对应测试补齐

### 3.2 本计划范围外

以下不在本计划首轮实现范围：

1. 重构 `GoalStateDocument` 为完整 normalized tree
2. 让 Reflector 直接修改 GoalState
3. 自动生成并写入 Skill / Script / Reference 文件
4. 重新设计 `/ptc status` 全量展示面
5. 改动 Curator 主语义
6. 大规模改造原则库内部算法

---

## 4. 分批实施总览

建议分 5 批，每批都可以独立提交与验证。

| 批次 | 主题 | 目标 | 主要文件 |
|---|---|---|---|
| Batch 1 | Prompt/Parser 兼容升级 | 让 Reflector 能输出结构化诊断，但不破坏旧链路 | `grc-prompts.ts` `grc-subagent.ts` `types.ts` `tests/*` |
| Batch 2 | 输入 grounding 补齐 | 给 Reflector 注入 summary / curator artifacts / candidate principles | `types.ts` `index.ts` `grc-prompts.ts` `grc-principles.ts` `tests/*` |
| Batch 3 | `diagnosis` 正式消费 | 让运行时保存并使用结构化诊断结论 | `types.ts` `index.ts` `grc-subagent.ts` `tests/*` |
| Batch 4 | `assetCandidates` 引入 | 加入模式蒸馏候选，但仅作为候选 | `types.ts` `grc-subagent.ts` `index.ts` `tests/*` |
| Batch 5 | Reflector artifact / replay | 加入长期审计痕迹与恢复链 | `types.ts` `index.ts` `tests/*` |

---

## 5. Batch 1：Prompt / Parser 兼容升级

### 5.1 目标

在**不破坏现有 `advice + principleOps` 主链**的前提下，让 Reflector 开始输出：
- `diagnosis`
- 更贴近新角色的正文结构

但运行时仍允许旧格式输出继续工作。

### 5.2 需要修改的文件

#### `grc-prompts.ts`
把 Reflector prompt 从：
- 高级技术顾问

收紧为：
- 上位审计器 + 原则综合器 + 模式蒸馏入口

并把正文结构逐步改为：
- `目标对齐判断`
- `偏移归因`
- `顾问意见`
- `原则判断`
- `能力沉淀候选`
- 末尾 JSON

但注意：
- 兼容期仍可要求正文可读
- JSON 里最少先要求 `diagnosis + principleOps`
- `assetCandidates` 可先允许为空数组

#### `grc-subagent.ts`
升级 `parseReflectorOutput(...)`：
- 优先解析 JSON 代码块
- 兼容旧 markdown 段落提取
- 若新 JSON 不存在，回退旧逻辑
- 若 JSON 非法，不影响旧 advice 消费

#### `types.ts`
新增兼容字段，而非一步替换旧结构。建议：

```ts
interface ReflectorDiagnosis {
  aligned: boolean;
  driftSource: "none" | "goal_state_drift" | "generator_execution_drift" | "curator_misjudgment" | "mixed";
  confidence: number;
  evidence: string[];
  explanation?: string;
}
```

并在 `ReflectorResult` 中先追加可选字段：

```ts
diagnosis?: ReflectorDiagnosis | null;
```

### 5.3 本批不做什么

- 不接入 `summaryCacheExcerpt`
- 不接入 `candidatePrinciples`
- 不接入 `assetCandidates` 消费
- 不改 `index.ts` 的主消费语义

### 5.4 验收标准

- 旧 Reflector 输出仍能被解析
- 新 Reflector 输出的 JSON 若合法，可拿到 `diagnosis`
- `principleOps` 行为不回退
- mid-run 与 post-round 路径都不崩

### 5.5 推荐测试

- `parseReflectorOutput`：旧格式解析测试
- `parseReflectorOutput`：新 JSON 优先解析测试
- `parseReflectorOutput`：JSON 非法时回退旧格式测试
- `diagnosis` 缺字段时降级测试

---

## 6. Batch 2：输入 grounding 补齐

### 6.1 目标

让 Reflector 的判断不再只依赖：
- `conversation`
- `currentGoalState`
- `goalContext`

而开始具备：
- 最近摘要观察
- 最近 Curator 误判趋势观察
- 原则库 grounding

### 6.2 需要修改的文件

#### `types.ts`
扩展 Reflector 输入，建议采用兼容方式：

```ts
interface ReflectorInput {
  currentRoundConversation: string;
  currentGoalState: GoalStateDocument | null;
  goalContext?: ReflectorGoalContext | null;
  summaryCacheExcerpt?: SummaryEntry[];
  recentCuratorArtifacts?: CuratorArtifactEntry[];
  candidatePrinciples?: PrincipleItem[];
}
```

不要新建完全平行的运行时对象，先在现有输入上追加可选字段即可。

#### `grc-prompts.ts`
让 prompt 显式读取：
- 最近 3-6 条 `summaryCacheExcerpt`
- 最近 2-4 条 `recentCuratorArtifacts`
- 最相关的 3-8 条 `candidatePrinciples`

但 prompt 必须强调：
- 这些是辅助 grounding
- `currentGoalState / goalContext` 仍是当前目标锚点

#### `grc-principles.ts`
如有必要，补一个更明确的候选原则获取函数，供 Reflector 使用，例如：
- `search(...)`
- 或新增一个偏 Reflector 场景的候选接口

#### `index.ts`
组装 Reflector 输入：
- 从 `grcState.curator.summaryCache` 取 excerpt
- 从 replay/内存中取最近 curator artifacts
- 从 principles manager 中取 candidate principles

### 6.3 本批不做什么

- 不正式消费 `diagnosis`
- 不写 Reflector artifact
- 不接入 `assetCandidates`

### 6.4 验收标准

- Reflector prompt 确实收到 grounding 信息
- grounding 不会导致 prompt 体积失控
- 没有 candidate principles 时 Reflector 仍可运行
- 旧行为可继续工作

### 6.5 推荐测试

- Reflector 输入组装测试
- summaryCache excerpt 裁剪测试
- recent curator artifacts 裁剪测试
- candidate principles 缺失/为空测试

---

## 7. Batch 3：`diagnosis` 正式消费

### 7.1 目标

让 Reflector 的结构化诊断不再只是 parser 层可见，而进入运行时可观测链路。

### 7.2 需要修改的文件

#### `types.ts`
考虑给 `GRCState.reflector` 追加轻量字段，例如：

```ts
lastDiagnosis?: ReflectorDiagnosis | null;
```

注意：
- 只保留最近一次
- 不把长历史塞进状态

#### `index.ts`
在 Reflector 完成时：
- 保存 `lastDiagnosis`
- 日志输出时增加 `driftSource`、`aligned` 等轻量诊断信息
- 暂不改变主注入策略，只增加观测能力

#### `grc-subagent.ts`
确保 parser 对 `diagnosis` 的最小校验稳定：
- `driftSource` 必须合法
- `confidence` 限制在合理范围
- `evidence` 必须是字符串数组

### 7.3 本批不做什么

- 不让 `diagnosis` 直接改 GoalState
- 不把 `diagnosis` 直接注入主模型替代 advice
- 不新增复杂 UI

### 7.4 验收标准

- Reflector 运行后，状态中可见最近诊断
- 无诊断时系统行为与当前一致
- 非法 diagnosis 不污染状态

### 7.5 推荐测试

- `diagnosis` 合法写入测试
- `diagnosis` 非法丢弃测试
- 状态恢复兼容测试

---

## 8. Batch 4：`assetCandidates` 最小引入

### 8.1 目标

让 Reflector 能输出模式蒸馏候选，但这些候选：
- 仅用于记录与后续人工/Executor 使用
- 不触发自动落地

### 8.2 需要修改的文件

#### `types.ts`
新增：

```ts
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

并在 `ReflectorResult` 中先追加可选字段：

```ts
assetCandidates?: ReflectorAssetCandidate[];
```

#### `grc-prompts.ts`
在 JSON 输出中允许：
- `assetCandidates: []`

并明确要求：
- 最多 3 条
- 每条必须有 `type/title/rationale/evidence`
- 不得包含自动执行语义

#### `grc-subagent.ts`
新增 `assetCandidates` 解析与校验：
- 非法则整体忽略
- 不影响 advice / principleOps

#### `index.ts`
本批仅建议：
- 打日志
- 或保留在后续 artifact 中
- 不要求立即注入主模型

### 8.3 本批不做什么

- 不创建 script/reference 文件
- 不新增 skill 候选职责或 skill 生成链路
- 不对 `/ptc status` 做复杂展示
- 不做自动任务派发

### 8.4 验收标准

- Reflector 可安全输出 0-3 个 candidates
- candidates 非法不影响主链
- candidates 不会触发自动执行

### 8.5 推荐测试

- 空 candidates 测试
- 合法 candidates 解析测试
- 非法 candidates 丢弃测试
- reference/script 两类 schema 测试

---

## 9. Batch 5：Reflector artifact 与 replay

### 9.1 目标

为 Reflector 增加长期审计痕迹，但不污染轻状态。

### 9.2 需要修改的文件

#### `types.ts`
新增：

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

#### `index.ts`
- Reflector 完成后 append artifact
- `session_start` 时 replay 最近 Reflector artifact
- 恢复时只回填轻量最近状态，不回填全历史数组

#### 测试
- replay 不污染当前状态
- 多轮 artifact 恢复后 latest diagnosis 正确
- 历史条目不膨胀到 `GRCState`

### 9.3 本批不做什么

- 不做完整 Reflector 历史 UI 浏览器
- 不做 artifact 间复杂聚合分析

### 9.4 验收标准

- Reflector artifact 可 append/replay
- shutdown / restart 后最近诊断可恢复
- 状态体积不显著膨胀

### 9.5 当前落地结果（2026-05-11）

Batch 5 已完成，当前实现口径为：

- Reflector 完成后会 append `grc-reflector-artifact`
- `session_start` / `/reload` 可 replay 最新 Reflector 轻状态
- replay 只恢复 latest 轻状态，不回填历史数组到 `GRCState`
- 恢复字段包括：
  - `lastAdvice`
  - `lastDiagnosis`
  - `processedUpToAgentRound`
  - `lastReflectedAgentRound`
- replay 时 `processedUpToAgentRound` 与 `lastReflectedAgentRound` 都对齐到最新 artifact 的 `agentRound`，避免出现“已恢复最新 diagnosis，但 processed round 仍停留旧值”的语义不一致

### 9.6 已验证项

已通过两类验证：

1. 单元 / 集成回归
   - `tests/index-restore-replay.test.ts` 已覆盖 Reflector artifact replay
   - 断言 latest artifact 恢复后：
     - `lastDiagnosis` 正确
     - `processedUpToAgentRound` 正确
     - `lastReflectedAgentRound` 正确
     - `assetCandidates` 不膨胀进轻状态

2. 真实 TUI / tmux 验证
   - 真实会话中已产出非空 `diagnosis`
   - `/ptc status` 可显示 `Latest Reflector Diagnosis`
   - `/reload` 后 diagnosis 仍可见
   - replay 前后 `Last reflected round` 保持一致
   - 已新增 `npm run test:reflector-replay` 自动化脚本覆盖该链路
   - 已新增 `npm run test:tmux` 聚合 `test:tui + test:midrun + test:reflector-replay`
   - 已新增 `npm run test:regression` 作为主回归入口，串联 `test:grc + test:tmux`

### 9.7 完整回归复验（2026-05-12）

已在 `extensions/passto-context` 目录实际执行：

- `npm run test:grc`
- `npm run test:tmux`
- `npm run test:regression`

结果：

1. Node 主回归通过
   - `test:curator`
   - `test:restore`
   - `test:reflector`
   - `test:context-manager`
   - `test:compaction`
   - `test:status`
   - `test:round-state`

2. 真实 Pi / tmux 集成回归通过
   - `test:tui`：`/ptc status`、`/ptc on`、`/ptc off`、`/reload`、`/new`、`/resume` 入口验证通过
   - `test:midrun`：`grc-mid-run-debug` 与 `grc-mid-run-reflection-steer` 已在真实 session jsonl 中出现
   - `test:reflector-replay`：`grc-reflector-artifact` 落盘，`/reload` 后 replay 恢复通过，`processedUpToAgentRound` 与 `lastReflectedAgentRound` 与最新 artifact round 对齐

3. 本次复验结论
   - 未发现新的 Batch 5 阻塞问题
   - 当前 Batch 5 代码、回归脚本、文档口径保持一致

---

## 10. 文件级实施建议

### `types.ts`

**先做：**
- 新增 `ReflectorDiagnosis`
- 新增 `ReflectorAssetCandidate`
- 在 `ReflectorResult` 上追加可选字段
- 在 `ReflectorInput` 上追加可选 grounding 字段

**后做：**
- 再决定是否正式替换旧 `sections` 结构

**不要做：**
- 一步删掉旧字段
- 一步把 vNext 类型变成唯一类型

---

### `grc-prompts.ts`

**先做：**
- 改角色定义
- 改输出结构
- 明确 JSON schema
- 明确“优先相对 GoalState/goalContext 判断”

**后做：**
- 再增加更复杂的 assetCandidates 指导语

**不要做：**
- 一步删除旧段落可读性
- 一步把 prompt 写成超长宪法

---

### `grc-subagent.ts`

**先做：**
- 兼容 parser
- 结构化 JSON 优先解析
- 新字段校验与降级

**后做：**
- 提取独立 `grc-reflector-parser.ts`

**不要做：**
- 直接把旧解析删掉
- 让非法 JSON 导致 Reflector 全失败

---

### `index.ts`

**先做：**
- 组装 grounding 输入
- 保存最近 diagnosis
- 保持旧 advice/principleOps 主链不变

**后做：**
- artifact append/replay
- 更丰富的日志与状态展示

**不要做：**
- 让 diagnosis 直接改写 GoalState
- 让 assetCandidates 直接驱动自动执行

---

### `grc-principles.ts`

**先做：**
- 给 Reflector 提供候选原则 grounding

**后做：**
- 视需要再增加更专门的 ranking/selection 逻辑

**不要做：**
- 为了 Reflector 先大改整个原则库衰减/合并算法

---

## 11. 推荐提交策略

建议按批次拆 commit，而不是一口气提交：

1. `refactor(reflector): add compatible diagnosis schema and parser path`
2. `feat(reflector): inject summary/artifact/principle grounding`
3. `feat(reflector): persist latest diagnosis in runtime state`
4. `feat(reflector): support asset candidates as non-executable hints`
5. `feat(reflector): append and replay reflector artifacts`
6. `test(reflector): cover compatibility, grounding, diagnosis and artifacts`
7. `docs(reflector): add v1.1 implementation plan and migration gates`

---

## 12. 实现闸门（每批都要过）

每一批代码开始前都要问这 6 个问题：

1. 这批是否引入了第二个目标真相源？
2. 这批是否破坏了 `advice + principleOps` 兼容链？
3. 这批是否让 Reflector 越权修改 GoalState？
4. 这批是否新增了没有消费链的伪字段？
5. 这批是否补上了相应测试？
6. 这批是否把长历史错误地塞进 `GRCState`？

只要有任一答案为“是”，就不应直接进入实现。

---

## 13. 最小成功标准

若要判断 Reflector v1.1 首轮是否算“落地成功”，最小标准应是：

1. Reflector 不再只是“泛顾问”，而能稳定输出偏移归因
2. `principleOps` 不再完全脱离原则 grounding
3. 新结构不会破坏现有 advice/principleOps 主链
4. 模式蒸馏至少能形成安全的 `assetCandidates` 候选
5. Reflector 结果可被 restore/replay 观察，而不污染轻状态

满足这 5 条，才算真正从“想法”进入“工程可依赖状态”。

---

## 14. 一句话收口

Reflector v1.1 的实现策略不是“大改一轮”，而是：

**先把角色与结构校准，再逐步补齐 grounding、诊断、候选资产与 artifact，并始终保留兼容主链。**

这是避免后续代码实现时产生系统性漂移的最稳路径。

---

*文档版本: reflector-v1.1-implementation-plan-draft*
*最后更新: 2026-05-11*
