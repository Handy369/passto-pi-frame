---
name: project-definition
description: >
  负责所有“先定义清楚再实施”的项目定义与方案设计工作。先把目标写成完整的定义类交付物，
  再按最小读取路径路由到 discovery、research、spec、core flow、architecture、UI/UX、roadmap、
  implementation plan、AI workflow/HITL/benchmark design、metrics review 等方法材料。适用于
  用户当前主输出物是 PRD/spec/scope/user flow/information architecture/architecture proposal/
  data model proposal/roadmap/implementation plan/AI systems PM/metrics learning；不适用于当前
  主输出物已经是代码、测试、调试结果或发布动作。
---

# Project Definition

> last_verified: 2026-05-16
> status: skills-maker-router

## Why

`project-definition` 是定义侧的顶层复合 Skill。

它存在的目的，是压缩“开始实施之前”的定义不确定性，尤其是：
- 用户到底要解决什么问题还不清楚
- 为什么做、给谁做、成功标准是什么还不清楚
- scope / non-goals / acceptance criteria 还不清楚
- 核心流程、状态、异常、架构边界、数据边界还不清楚
- 不知道先产出什么定义物、先读什么材料、何时交给实施

如果没有这个 Skill，agent 很容易在 `PM / design / spec / planning / architecture` 多条路径之间发散，
或者在定义不足时直接跳去写代码。

---

## What

### 主目标
把模糊的项目想法、用户问题或需求请求，转化为**可交付的定义类产物**，并让后续实施少猜。

### 主输出物
- problem framing
- JTBD
- research synthesis / competitor analysis
- PRD / spec
- scope / non-goals / acceptance criteria
- user flow / information architecture / interaction structure
- architecture proposal / data model proposal
- wireframe / visual direction / design token spec
- roadmap / prioritization
- implementation plan / handoff package
- AI workflow / benchmark / HITL / trust / fallback / readiness review
- metrics review / learning memo / next-step decision

### 不负责
以下不是本 Skill 的主输出：
- 业务代码实现
- bug 修复
- 测试补齐
- 调试 / runtime validation
- code review / perf / security / CI / deploy

这些应交给：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### Top-level Boundary Pack

#### should-trigger
当当前主输出物是以下任一类定义产物时，优先留在本 Skill：
- problem framing / JTBD / discovery
- research synthesis / personas / competitor analysis
- PRD / spec / scope / acceptance criteria
- core flow / IA / interaction structure / architecture proposal
- roadmap / prioritization / implementation plan
- AI systems PM（workflow / HITL / benchmark / trust / fallback）
- metrics review / learning / next-step product decision

#### should-not-trigger
以下请求不应由本 Skill 接管：
- 明确要求直接写代码、修 bug、补测试、做调试、做发布
- 纯运行态 UI QA / P0-P2 问题审查
- 纯视觉风格 / 配色 / 字体 / 品牌表达
- 纯前端实现 / API implementation / CI/CD / deploy

#### adjacent destination
- 代码 / 调试 / 测试 / 发布 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 纯运行态 UI QA → `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`
- 纯视觉风格 / 品牌气质 → `references/design-foundation.md`
- 明确 spec 写作而不是跨层规划 → `references/spec-and-scope.md`
- 复杂界面交互结构 → `references/ui-ux-product-design.md`

#### non-goals
即使命中本 Skill，也不要顺手扩做：
- 代码实现
- 运行态 bug 定位
- 浏览器技术调试
- 只为 benchmark 分数而过拟合文案

#### first action after hit
先判断**当前主输出物**是什么，再只选择 **一个** 主 reference 或主子 Skill；
如果没有先完成这一步，就不算真正 adopt `project-definition`。

---

## Structure

这是一个在 **Flow / Surface** 上呈现为**组合编排型**的复合 Skill。
唯一骨架仍然只有：

```text
Why → What → Structure → Flow → Surface → Runtime Proof
```

### 文件面
- `SKILL.md`：父级 router，先判断当前定义类主输出物
- `references/*.md`：仅保留运行时需要的定义侧方法材料
- `validation/*.md`：benchmark brief / preflight / runtime proof / child binding 等**外部验证资产**；不属于默认 runtime 读取面

### 内部 reference 簇
1. **前期澄清 / 研究**
   - `references/discovery.md`
   - `references/research.md`
   - `references/user-experience-elements-five-layers.md`

2. **规格 / 流程 / 架构**
   - `references/spec-and-scope.md`
   - `references/core-flow-design.md`
   - `references/architecture-and-data.md`
   - `references/ai-systems-pm.md`

3. **优先级 / handoff / 交付**
   - `references/feature-map-and-prioritization.md`
   - `references/roadmap-and-prioritization.md`
   - `references/handoff-and-implementation-plan.md`
   - `references/delivery-and-alignment.md`
   - `references/metrics-and-learning.md`

4. **UI/UX / 视觉 / 设计系统**
   - `references/ui-ux-product-design.md`
   - `references/agent-human-workspace-baseline.md`（复杂 workspace / console / editor 深案例补充）
   - `references/design-foundation.md`
   - `references/design-tokens.md`
   - `references/visual-identity.md`
   - `references/iconography.md`
   - `references/banner-design.md`
   - `references/presentations.md`
   - `references/document-design.md`
   - `references/brand-assets.md`

### 直接绑定的子 Skill
- `idea-refine`：早期 Why / What 澄清器
- `spec-driven-development`：spec 与 acceptance criteria 结构化器
- `planning-and-task-breakdown`：implementation plan / task list 结构化器

这些子 Skill 不是并列顶层入口，而是本 Skill 在不同节点调用的**局部强化器**。

---

## Flow

### Step 1. 先确认当前主输出是不是定义类交付物
若当前回合要的是以下之一，优先留在本 Skill：
- PRD / spec
- problem framing / JTBD
- research synthesis
- scope / non-goals / acceptance criteria
- user flow / IA / interaction design
- architecture proposal / data model proposal
- roadmap / prioritization
- implementation plan
- AI workflow / benchmark / HITL / trust / fallback / readiness review
- metrics review / learning / next-step decision

如果当前主输出已经是代码、测试、调试结果或发布动作，直接切到 `project-implementation`。
如果当前主输出是纯运行态 UI QA，切到 `visual-feedback-ui-qa`。
如果当前主输出是纯视觉风格，切到 `design-foundation.md`。

### Step 2. 再按输出物选择一个主 reference / 主子 Skill
| 当前要的输出物 | 先读这个 | 命中后应出现的 adopt signal | 仅在需要时再补 |
|---|---|---|---|
| 想法澄清 / problem framing / JTBD / 机会判断 | `references/discovery.md` | problem statement / assumptions / direction / why-now | `idea-refine` / `references/user-experience-elements-five-layers.md` |
| 用户研究 / 反馈整理 / 竞品分析 / personas | `references/research.md` | segments / personas / evidence / request-vs-need | discovery |
| PRD / spec / scope / acceptance criteria | `references/spec-and-scope.md` | goals / non-goals / requirements / acceptance criteria | `spec-driven-development` / `references/core-flow-design.md` |
| 核心流程 / 端到端任务流 / 异常与状态 / 交互结构 | `references/core-flow-design.md` | objects / main flow / exception flow / recovery / state model | spec-and-scope |
| 架构方案 / 模块边界 / 数据模型方案 | `references/architecture-and-data.md` | module boundaries / interfaces / data model / tradeoffs | core-flow-design / spec-and-scope |
| AI workflow / benchmark / HITL / trust / fallback / readiness review | `references/ai-systems-pm.md` | workflow map / benchmark plan / HITL matrix / trust policy / fallback strategy | spec-and-scope / architecture-and-data |
| 功能拆解 / MVP / 依赖 / 优先级 | `references/feature-map-and-prioritization.md` | MVP / now-later / dependency / priority rationale | `references/roadmap-and-prioritization.md` |
| roadmap / 上线节奏 / 阶段取舍 | `references/roadmap-and-prioritization.md` | phased plan / sequencing / defer rationale / milestone logic | feature-map-and-prioritization |
| UI/UX / 信息架构 / 工作台 / 控制台 / 编辑器 / 交互层级 | `references/ui-ux-product-design.md` | object clarity / hierarchy / main truth zone / main action zone / feedback strategy | `references/agent-human-workspace-baseline.md` / design foundation / design tokens |
| 复杂 workspace / console / editor 的协作工作台深案例 | `references/agent-human-workspace-baseline.md` | review-first / current object / next action / recovery UX / status clarity | ui-ux-product-design |
| design token / 组件规范 / CSS 变量系统 | `references/design-tokens.md` | token taxonomy / variable rules / component consistency | design foundation |
| 品牌视觉 / Logo / 图标 | `references/visual-identity.md` | brand principles / logo constraints / identity direction | `references/iconography.md` |
| Deck / 文档模板 / 品牌资产 | `references/banner-design.md` | artifact family / template structure / brand usage rules | presentations / document-design / brand-assets |
| 实施计划 / handoff / sprint 切分 | `references/handoff-and-implementation-plan.md` | phased handoff / work packages / checkpoints / implementation plan | `planning-and-task-breakdown` / delivery-and-alignment |
| 上线后指标复盘 / 学习 / 下一步产品决策 | `references/metrics-and-learning.md` | scorecard / trend / concerns / actions / open questions | roadmap-and-prioritization / discovery / research |

### Step 3. 子 Skill 绑定规则
#### `idea-refine`
当需求还只是模糊想法、方向假设、problem framing，尚不足以直接产出 spec 时调用。

它强化的是：
- Why：为什么值得做
- What：到底要解决什么问题、最小 MVP 是什么

它的典型输出是：
- problem statement
- recommended direction
- key assumptions
- MVP scope
- not doing list

#### `spec-driven-development`
当已经进入“要写清楚规格”，但 spec、边界、success criteria 还不完整时调用。

它强化的是：
- What：主目标与主输出物
- Structure：spec 文档结构
- Flow：从 spec 到 plan / tasks / implementation 的前置顺序

#### `planning-and-task-breakdown`
当 spec / scope 已足够明确，目标变成“如何切成实施任务与 handoff 包”时调用。

它强化的是：
- Flow：任务依赖、顺序、checkpoint、parallelization
- Surface：implementation plan / task list 这类可交付载体

### Step 4. 只读最少必要材料
- 只写 PRD/spec，不加载视觉材料
- 只做 roadmap，不加载完整架构材料
- 只做核心流程，不加载完整品牌/文档资产材料
- 只在当前主输出物需要时，才补第二份 source

### Step 5. 定义足够清晰后，handoff 给 `project-implementation`
当以下条件基本满足时，停止继续扩展定义：
- 目标明确
- 范围明确
- 非目标明确
- success criteria 足够明确
- 关键流程 / 状态 / 异常已明确（如相关）
- 架构或数据边界已明确（如相关）
- 可以切成 implementation plan（如需要）

这时应交给：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`

---

## Surface

`project-definition` 的 runtime Surface 是：
- 一个总入口 router
- 一组按定义类输出物组织的 runtime references
- 少量按需补读的深案例模块

`validation/*.md` 下的 child binding、runtime proof、benchmark brief、preflight checklist 等文件属于**外部验证资产**，不属于默认 runtime 读取面。

### 读取顺序
1. 先读本 `SKILL.md`
2. 先判断当前主输出物
3. 再只选择 **一个** 主 reference 或主子 Skill
4. 仅在当前输出物真的需要时，补第二层材料
5. 若已经达到实施前清晰度，停止继续扩展，准备 handoff

### Source Map
- Discovery / research：`references/discovery.md` / `references/research.md` / `references/user-experience-elements-five-layers.md`
- Spec / scope：`references/spec-and-scope.md`
- Flow / architecture：`references/core-flow-design.md` / `references/architecture-and-data.md` / `references/ai-systems-pm.md`
- Priority / roadmap / handoff：`references/feature-map-and-prioritization.md` / `references/roadmap-and-prioritization.md` / `references/handoff-and-implementation-plan.md` / `references/metrics-and-learning.md`
- UI/UX / visual：`references/ui-ux-product-design.md` / `references/agent-human-workspace-baseline.md` / `references/design-foundation.md` / `references/design-tokens.md`

### Surface 原则
- 按输出物组织，而不是按术语堆叠组织
- 先主路径，后补充路径
- 深案例只在对应主路径已命中后再补读
- 让 agent 一眼知道先读什么，而不是把所有方法一次性摊开

---

## Runtime Proof

### 先验证什么
先验证：当前产出的是否真的是**定义类交付物**，而不是已经滑向实施动作。

### 再验证什么
1. **route correctness**
   - 模糊定义请求是否先进入 `project-definition`
   - 实施请求是否没有被误吸
   - 纯视觉风格是否没有误吸进 UI/UX 结构路由
   - 纯运行态 UI QA 是否没有误吸进定义侧

2. **adopt correctness**
   - 是否先选了一个主 reference / 主子 Skill
   - 是否真的按最小读取路径推进，而不是一次加载一大堆材料
   - 是否出现与目标 reference 对应的 adopt signal，而不是停留在顶层总论

3. **child-skill use correctness**
   - `idea-refine` 是否只用于前期澄清
   - `spec-driven-development` 是否只用于 spec 结构化
   - `planning-and-task-breakdown` 是否建立在足够明确的 spec / scope 之上

4. **handoff correctness**
   - 当定义已经足够时，是否能稳定切到 `project-implementation`
   - 是否没有继续在定义侧无止境发散

### proof 类型
- human review：检查输出是否少猜、少漏、少发散
- real-task reuse：看不同定义任务是否都能稳定命中正确主路径
- benchmark：仅在需要验证路由/误吸/最小读取路径时使用
- downstream quality：看实施侧是否因为定义清晰而更稳定

### 不允许依赖
- 不要把“agent 自称用了某个 skill”当主判据
- 不要把 benchmark 当唯一真理
- 不要依赖单一窄字面量来证明 adopt
- 不要把外部验证资产被引用，误当作 runtime adopt 已发生

---

## Success Condition

当本 Skill 被正确使用时：
- 用户要做什么已明确
- 为什么做已明确
- scope / non-goals / success criteria 已明确
- 研究、流程、架构、优先级材料按需补齐
- AI workflow / HITL / benchmark / metrics 等特殊定义路径在需要时能被正式接住
- 只读了最少必要源文件
- 输出出现所选主路径对应的 adopt signal，而不是停留在泛化定义建议
- 实施前 handoff 已清楚
