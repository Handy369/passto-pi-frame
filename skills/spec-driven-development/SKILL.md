---
name: spec-driven-development
description: >
  在进入实现前先写清 spec 的局部强化 Skill。用于当需求、边界、成功标准、假设或验收条件仍不完整，
  需要把模糊请求收敛成结构化 spec、scope 与 acceptance criteria。它是 project-definition 的子 Skill，
  不直接承担代码实现，也不替代完整的 discovery / research。
---

# Spec-Driven Development

## Top-level Boundary Pack

### current main output
- 结构化 spec 文档
- scope / non-goals
- success criteria
- open questions
- assumptions list
- 必要时作为后续 planning / implementation 的前置输入

### current main action
- 判断当前是否已经进入“需要把规格写清”的阶段
- 显式列 assumptions 与边界
- 把模糊需求改写成结构化 spec
- 把验收条件写成可验证 success criteria

### should-trigger
当当前主任务满足以下任一项时，优先进入本 Skill：
- 需求、边界、成功标准、假设或验收条件仍不完整
- 需要在进入实现前把请求收敛成结构化 spec / scope / acceptance criteria
- 当前已经不是纯 idea 发散，而是要把规格写清、让后续少猜

### should-not-trigger
以下请求不应由本 Skill 接管：
- 当前仍是 discovery / research / ideation 阶段，问题本身都还没定义清楚
- 当前主任务已经是 implementation task breakdown
- 当前主任务是直接写代码、修 bug、补测试或做 release
- 单个小修、小 typo、无需 spec 的自明任务

### adjacent destination
- 更前期的定义澄清 / discovery / research → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- implementation plan / tasks / dependency order → `/Users/handy/.claude/skills/planning-and-task-breakdown/SKILL.md`
- 代码实现 / 调试 / 测试 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 顶层定义路由 → `/Users/handy/.claude/skills/project-definition/SKILL.md`

### non-goals
- 不负责完整 discovery / research
- 不直接写业务代码
- 不替代 implementation task breakdown
- 不在 spec 尚未站稳时顺手展开实现

### first action after hit
先确认当前确实已经进入“要写清规格”的阶段；然后先列 assumptions 与边界，再写 spec 骨架与 success criteria。如果没有先做这一步，就不算真正 adopt 本 Skill。

### positive examples
- “这个功能方向基本明确了，但 scope、success criteria 和 open questions 还散着，先帮我写成 spec。”
  - why should trigger: 用户已经从发散想法进入规格收敛阶段
  - expected adopt signal: 先列 assumptions / scope，再产出结构化 spec
- “我不想现在直接实现，先把 acceptance criteria 和 non-goals 写清。”
  - why should trigger: 主交付物明确是 spec / acceptance 产物
  - expected adopt signal: 输出结构化 spec，而不是直接写代码或拆任务

### negative examples
- “先帮我做用户研究，看这个问题值不值得做。”
  - why should not trigger: 还在 discovery / research 阶段
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`
- “这个 spec 已经有了，帮我拆成实现任务和 checkpoint。”
  - why should not trigger: 主任务已经进入 planning / task breakdown
  - correct destination: `/Users/handy/.claude/skills/planning-and-task-breakdown/SKILL.md`
- “直接实现这个 API 并补测试。”
  - why should not trigger: 主任务已是 implementation
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`

## Why

这个 Skill 用于压缩“已经知道要写规格，但规格本身还不完整”的不确定性。

如果没有它，agent 很容易：
- 在需求模糊时直接进入实现
- 用散乱 prose 替代结构化 spec
- 漏掉成功标准、边界、假设与验收条件

---

## What

### 主目标
把模糊或半成型的需求，收敛成**结构化 spec / scope / acceptance criteria**。

### 主输出物
- spec 文档
- scope / non-goals
- success criteria
- open questions
- assumptions list
- 必要时的 plan / tasks 前置输入

### 不负责
- 不替代 discovery / research
- 不直接写业务代码
- 不替代 implementation task breakdown

它通常作为：
- `/Users/handy/.claude/skills/project-definition/SKILL.md`
的局部强化器被调用。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | spec 主路径入口；负责判断是否该进入规格收敛阶段，以及 spec 的首个骨架与 success criteria 写法 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 spec path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在规格结构与边界收敛，不在脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 的输出形状稳定，不需要模板目录 |

它在父 Skill 中强化的是：
- What：要构建什么、为什么、如何验收
- Structure：spec 的标准文档骨架
- Flow：spec → plan → tasks → implement 的前置顺序

---

## Flow

1. 先确认当前已经进入“要写清规格”的阶段，而不是纯 idea 澄清阶段
2. 先列 assumptions，不要静默脑补
3. 用结构化骨架写出 spec：objective / commands / structure / code style / testing / boundaries / success criteria / open questions
4. 把模糊要求改写成可验证 success criteria
5. spec 足够清楚后，再交给 planning / implementation

### 不该何时使用
- 只是单个小修、小 typo、无需 spec 的自明任务
- 纯研究 / 纯 ideation 阶段

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 输出合同窄
- 重点是把 spec 写清，而不是覆盖整个定义流程

在父 Skill `project-definition` 中，通常位于：
- PRD / spec / scope / acceptance criteria 路径

---

## Runtime Proof

先验证：输出是否真的是结构化 spec，而不是泛泛建议。

再验证：
- assumptions 是否被显式写出
- success criteria 是否可验证
- scope / non-goals 是否明确
- 是否没有越界进入实现

可接受 proof：
- human review
- real-task reuse
- downstream quality（是否让 implementation 少猜）
