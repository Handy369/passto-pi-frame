---
name: planning-and-task-breakdown
description: >
  把已明确的 spec / scope 收敛成 implementation plan、task list、dependency order 与 checkpoint 的局部强化 Skill。
  用于当前定义已经足够清楚，但还需要把工作拆成可实施、可验证、可并行的任务切片。它是 project-definition 的子 Skill，
  不替代前期 spec 澄清，也不直接承担代码实现。
---

# Planning and Task Breakdown

## Top-level Boundary Pack

### current main output
- implementation plan
- ordered task list
- dependency graph
- verification checkpoints
- 并行化建议

### current main action
- 基于明确 spec / scope 进入只读规划态
- 识别依赖顺序与 checkpoint
- 把工作切成可实施、可验证、可 handoff 的任务单元
- 标记哪些任务可并行、哪些必须串行

### should-trigger
当当前主任务满足以下任一项时，优先进入本 Skill：
- spec / scope / acceptance criteria 已经足够清楚，但尚未拆成实施任务
- 需要 implementation plan、task list、dependency order 或 sprint slicing
- 需要把工作拆成可验证、可并行、可 handoff 的任务切片

### should-not-trigger
以下请求不应由本 Skill 接管：
- 需求仍模糊，尚未写清 spec / scope / acceptance criteria
- 当前主任务还是 discovery / research / ideation
- 当前主任务已经是直接写代码、修 bug、补测试
- 单文件、单动作、边界自明的小任务

### adjacent destination
- spec / scope / acceptance criteria 收敛 → `/Users/handy/.claude/skills/spec-driven-development/SKILL.md`
- 更前期的定义澄清 / discovery / research → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 代码实现 / 调试 / 测试 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 顶层定义路由 → `/Users/handy/.claude/skills/project-definition/SKILL.md`

### non-goals
- 不负责前期 spec 澄清
- 不直接写代码
- 不在 spec 不稳时硬拆任务
- 不把超大任务伪装成“已拆分”

### first action after hit
先确认 spec / scope / acceptance criteria 已经足够清楚；然后进入只读规划态，先画依赖顺序和切片边界，再写任务与 checkpoint。如果没有先做这一步，就不算真正 adopt 本 Skill。

### positive examples
- “spec 已经写好了，帮我把它拆成 implementation plan 和任务顺序。”
  - why should trigger: 当前已具备规划输入，主交付物是 plan / tasks
  - expected adopt signal: 先识别依赖和切片，再写任务与 checkpoint
- “这个范围已经明确，先给我一个可并行的任务拆解和每步验证点。”
  - why should trigger: 用户明确要 task breakdown 与 verification checkpoints
  - expected adopt signal: 输出 ordered task list、dependencies 和 verification

### negative examples
- “这个想法还很模糊，先帮我写 spec 和 success criteria。”
  - why should not trigger: 还没进入 planning 阶段
  - correct destination: `/Users/handy/.claude/skills/spec-driven-development/SKILL.md`
- “直接实现第一版并补测试。”
  - why should not trigger: 当前主任务已是 implementation
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “先做一些用户研究，看看这个方向值不值得做。”
  - why should not trigger: 仍在 discovery / research 阶段
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`

## Why

这个 Skill 用于压缩“已经知道要做什么，但还不知道怎么切成可实施任务”的不确定性。

如果没有它，agent 很容易：
- 直接跳进实现，缺少任务边界
- 把任务切得过大、不可验证
- 忽略依赖顺序与 checkpoint
- 在并行与串行关系上混乱

---

## What

### 主目标
把明确的 spec / scope 转化为：
- implementation plan
- ordered task list
- dependency graph
- verification checkpoints
- 并行化建议

### 不负责
- 不替代前期 spec 澄清
- 不在需求仍模糊时直接开始拆任务
- 不直接写代码

它通常作为：
- `/Users/handy/.claude/skills/project-definition/SKILL.md`
的后段局部强化器被调用。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | planning 主路径入口；负责确认是否已具备规划输入，以及任务拆解与 checkpoint 结构 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 planning path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在任务拆解结构与顺序约束，不在脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 的输出形状稳定，不需要模板目录 |

它在父 Skill 中强化的是：
- Flow：任务顺序、依赖、checkpoint、parallelization
- Surface：plan 文档、task list、checkpoint 作为可交付物

---

## Flow

1. 先确认已有 spec / scope / acceptance criteria
2. 进入只读规划态，不写代码
3. 识别依赖图与实施顺序
4. 做垂直切片，而不是纯水平分层
5. 写出每个任务的 acceptance / verification / files / dependencies
6. 安排 checkpoint 与并行机会
7. 形成可 handoff 的 implementation plan

### 不该何时使用
- 需求仍模糊
- 还没有足够清晰的 spec / scope
- 单文件、单动作、边界自明的小任务

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 输出形状稳定
- 典型产物是 plan 文档与 task list

在父 Skill `project-definition` 中，通常位于：
- implementation plan / handoff / sprint slicing 路径

---

## Runtime Proof

先验证：是否真的存在足够明确的 spec 输入。

再验证：
- 每个任务是否有 acceptance criteria
- 是否有 verification step
- 依赖顺序是否合理
- 是否设置了 checkpoint
- 是否避免了 XL 级任务

可接受 proof：
- human review
- real-task reuse
- downstream quality（implementation 是否更稳定）
