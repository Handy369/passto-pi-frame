# Skill Routing Blackbox Protocol

> status: draft-for-execution
> owner: current session
> goal: 验证各 skill 的 `name + description` 是否足以让 agent 在黑盒自然请求下正确读取目标 `SKILL.md`

## 1. Why

本协议用于解决一个明确问题：

- 不是验证 agent **能不能把事做对**
- 而是验证 skill 的 **name / description / trigger surface** 是否真的足以让 agent **命中并读取正确的 `SKILL.md`**

如果只看到行为像某个 skill，但没有读取目标 `SKILL.md`，则不能证明：
- skill 命名正确
- description 触发词正确
- 与相邻 skill 的边界清楚
- router surface 设计有效

因此，本协议以 **是否读取目标 `SKILL.md`** 作为核心命中证据。

---

## 2. Scope

本协议优先覆盖当前 `.claude/skills` 下的目标 skill 集。

当前可观测 skill（来自实际 frontmatter）：

- agent-browser
- agent-dev
- agent-docs
- api-and-interface-design
- autoagent
- browser-testing-with-devtools
- chrome-devtools-mcp
- ci-cd-and-automation
- code-review-and-quality
- code-simplification
- context-engineering
- debugging-and-error-recovery
- deprecation-and-migration
- doc-lookup
- documentation-and-adrs
- doubt-driven-development
- frontend-ui-engineering
- git-workflow-and-versioning
- idea-refine
- incremental-implementation
- performance-optimization
- planning-and-task-breakdown
- project-definition
- project-implementation
- security-and-hardening
- shipping-and-launch
- skills-maker
- source-driven-development
- spec-driven-development
- subagent-guide
- test-driven-development
- tmux
- using-agent-skills
- visual-feedback-ui-qa

---

## 3. Core Question

对每个 skill，都要回答两类问题：

1. **应该命中，但没命中吗？**
   - 说明该 skill 的 `name + description` 无法稳定触发 adopt
   - 或被相邻 skill 吸走

2. **不该命中，却命中了吗？**
   - 说明该 skill 边界过宽
   - 或 description 使用了过于泛化、强吸附的词

---

## 4. Hard Acceptance Standard

### 4.1 正例（should trigger）
一个正例 case 只有在满足以下条件时才算通过：

1. 用户提示词是自然请求，不出现 skill 名、路由名、"请读取某 skill" 等白盒提示
2. child / agent 在前 1~3 个有效 runtime 动作内，出现：
   - `read /.../<target-skill>/SKILL.md`
3. 后续首动作与该 skill 的 `first action after hit` / description 主工作流一致

如果只是行为像，但没有读目标 `SKILL.md`：

> 统一记为 **正例未通过**

### 4.2 反例（should not trigger）
一个反例 case 只有在满足以下条件时才算通过：

1. 用户提示词自然且不泄露答案
2. agent / child **没有读取该目标 skill 的 `SKILL.md`**
3. 若存在更合适的相邻 skill，被其读取，记为边界正确
4. 若未读取任何相关 skill，但直接做事，需要单独记为“未 adopt，待分析”

### 4.3 误判等级

#### A. Strong Hit
- 读取目标 `SKILL.md`
- 行为与目标 skill workflow 一致

#### B. Missed Positive
- 应该命中
- 但未读取目标 `SKILL.md`
- 无论行为是否像，都算未达标

#### C. False Positive
- 不该命中
- 却读取了目标 `SKILL.md`

#### D. Correct Rejection
- 不该命中
- 且未读取目标 `SKILL.md`

---

## 5. Test Input Design Method

## 5.1 先读，不先跑
每个 skill 开测前，先读取两类输入：

1. 目标 skill 的：
   - `name`
   - `description`
2. 相邻 skill 的：
   - `name`
   - `description`

目的不是做白盒提示，而是为了：
- 识别该 skill 想吸什么请求
- 识别它和谁最容易冲突
- 为正例 / 反例生成最小自然提示词

## 5.2 每个 skill 至少设计 3 类提示词

### 类型 A：正例命中词（should trigger）
要求：
- 尽量只保留 description 中承诺的核心触发语义
- 不携带多余上下文
- 不直接泄露 skill 名

作用：
- 测“应该命中却没命中”

### 类型 B：邻接反例词（adjacent false-positive guard）
要求：
- 题材靠近，但本质属于相邻 skill
- 用来测目标 skill 是否误吸

作用：
- 测“不该命中却命中”

### 类型 C：模糊混合词（boundary stress）
要求：
- 同时含有目标 skill 与相邻 skill 的部分信号
- 用于观察 router 是否稳定

作用：
- 测 description 边界是否足够抗混淆

---

## 6. Prompt Writing Rules

所有测试提示词必须遵守：

1. 不出现 skill 名
2. 不出现“你应该使用某个 skill”
3. 不出现“请读某个 SKILL.md”
4. 不出现我们内部的判定术语（如 strong hit / false positive）
5. 保持像正常用户会说的话
6. 尽量短，但足以表达任务本质
7. 若需要 repo / fixture，则 repo 内容可具体，但提示词仍保持自然

---

## 7. Runtime Evidence to Capture

每次测试至少记录：

- case id
- target skill
- case type（positive / adjacent negative / boundary stress）
- prompt
- cwd / fixture
- 前 1~3 个有效 tool call
- 是否读取目标 `SKILL.md`
- 是否读取相邻 skill `SKILL.md`
- 首动作类型
- 最终判定
- 备注（吸走它的 skill 是谁 / 为什么可疑）

---

## 8. Analysis Logic After Failure

如果正例未通过，不进入下一类 skill；必须先分析原因。

### 8.1 正例未通过时，优先分析
1. `name` 是否过泛 / 过弱 / 不像用户语言
2. `description` 是否：
   - 触发词太抽象
   - 竞品词太强
   - 工作流信号不足
   - 适用场景太长但不聚焦
3. 是否被某个相邻 skill 吸走
4. 相邻 skill 的 description 是否过宽
5. 是否需要补更自然的用户措辞，而不是内部术语

### 8.2 反例误命中时，优先分析
1. 目标 skill 是否写了过泛触发词
2. should-not-trigger 是否太弱
3. adjacent destination 是否不清楚
4. 相邻 skill 的正向 surface 是否太弱，导致目标 skill 代偿吸附

---

## 9. Execution Order Rule

只允许按以下顺序推进：

1. 读取目标 skill 与相邻 skill 的 `name + description`
2. 设计该 skill 的正例 / 邻接反例 / 混合边界提示词
3. 先跑正例
4. 若正例未 strong hit：
   - 停止横向扩展
   - 只分析当前 skill 的 name / description / boundary wording
5. 仅当正例 strong hit 后，才跑反例
6. 仅当：
   - 正例 strong hit
   - 反例 correct rejection
   这组才算闭环完成
7. 未闭环不得推进下一类 skill

---

## 10. Deliverables Per Skill

每个 skill 的验证交付物至少包含：

1. 目标 skill 摘要
   - name
   - description 摘要
2. 相邻 skill 列表
3. 3 类测试提示词
   - positive
   - adjacent negative
   - boundary stress
4. 每个 case 的 runtime 证据
5. 判定表
6. 若失败：最小修订建议

---

## 11. Minimal Result Table Schema

| case_id | target_skill | case_type | prompt | cwd | first_3_tool_calls | target_skill_read | adjacent_skill_read | verdict | notes |
|---|---|---|---|---|---|---|---|---|---|

其中：
- `target_skill_read`: yes / no
- `adjacent_skill_read`: none / <skill-name>
- `verdict`: strong-hit / missed-positive / false-positive / correct-rejection

---

## 12. Immediate Application To Current Focus

当前正在处理的焦点 skill：
- `debugging-and-error-recovery`

因此下一步不是继续横向跑别的 skill，
而是先做：

1. 读取 `debugging-and-error-recovery` 与其相邻 skill 的 `name + description`
2. 为它生成：
   - 正例提示词
   - 邻接反例提示词
   - 混合边界提示词
3. 用统一表格记录结果
4. 若正例未 strong hit，直接回到文案与边界修订

---

## 13. Non-Goals

本协议不做以下事情：

- 不把“行为像某个 skill”当成通过
- 不在正例未达标时横向铺开更多 skill
- 不把做成任务结果当成 adopt 证据
- 不用白盒提示词作弊触发 skill
- 不跳过相邻 skill 分析，直接拍脑袋改 description
