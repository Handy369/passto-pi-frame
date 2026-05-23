---
name: incremental-implementation
description: >
  用于把已明确的实施任务按小而完整的切片落地的局部强化 Skill。当前主动作是 build / implement，
  且改动跨多文件、风险较高或需要可回退节奏时使用。它是 project-implementation 的 build 主路径控制器，
  不替代 debug、test-first 或 review 路径。
---

# Incremental Implementation

## Top-level Boundary Pack

### current main output
- 当前实施切片定义
- 当前切片的最小代码改动
- 当前切片的最小验证结果
- 必要时给出下一切片入口

### current main action
- 把已明确的实施任务切成小而完整的当前切片
- 限制改动面
- 为当前切片建立最小验证
- 在切片成立后及时停线或交接下一切片

### should-trigger
当当前主动作明确是 build / implement，且满足以下任一条件时，优先进入本 Skill：
- 改动跨多文件
- 风险较高，需要可回退节奏
- 需要把大任务切成小而完整、可验证的实施切片
- 已经知道要做什么，但还没有安全落地节奏

### should-not-trigger
以下请求不应由本 Skill 接管：
- 需求仍模糊、scope / success criteria / contract 不清
- 当前主任务其实是 debug / recover
- 当前主任务其实是 test-first / regression proof
- 当前主任务其实是 review / gate
- 单文件、单动作、边界自明的小改动

### adjacent destination
- 定义不足、需先写清 spec / scope / acceptance → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 调试 / recover → `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- proof-first / test-first → `/Users/handy/.claude/skills/test-driven-development/SKILL.md`
- review / quality gate → `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`
- 顶层实施路由 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### non-goals
- 不负责补做需求定义
- 不负责 failure-first 调试
- 不负责把大项目一次性整体实现完
- 不负责在切片成立后继续无边界扩写

### first action after hit
先确认最小定义已足够，再明确“当前切片”的唯一逻辑单元、涉及文件与最小验证；如果没有先完成这一步，就不算真正 adopt 本 Skill。

### positive examples
- “这个功能要同时改 API、前端和测试，先帮我拆出第一刀最小可落地切片。”
  - why should trigger: 已进入实施，但改动面较大，需要安全切片节奏
  - expected adopt signal: 先定义当前切片，而不是直接多线大改
- “需求已经明确，帮我按小步可回退方式把这次重构先推进第一步。”
  - why should trigger: 当前主问题是实施节奏与可回退性
  - expected adopt signal: 输出当前切片、最小改动面和验证方式

### negative examples
- “这个测试为什么挂了，先帮我定位根因。”
  - why should not trigger: 主任务是调试，不是实施切片节奏
  - correct destination: `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- “先把这个需求写成 spec 和 acceptance criteria。”
  - why should not trigger: 仍在定义阶段
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`
- “帮我直接 review 这组改动是否能 merge。”
  - why should not trigger: 主输出物是 review 结论
  - correct destination: `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`

## Why

这个 Skill 用于压缩“已经知道要做什么，但不知道怎么安全落地”的实施节奏不确定性。

如果没有它，agent 很容易：
- 一次改太多，无法知道哪一步出错
- 在没有清晰切片的情况下同时改 API、UI、测试、配置
- 把“持续推进”误当成“可验证推进”

---

## What

### 主目标
把已明确的实施任务，收敛成**小而完整、可验证、可回退**的切片落地。

### 主输出物
- 当前切片定义
- 当前切片代码改动
- 当前切片最小验证结果
- 下一切片入口（如需要）

### 不负责
- 不替代定义阶段
- 不在 failure-first 场景下主导调试
- 不替代 test-first 证明或 review gate

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 build 主路径控制器被调用。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 局部强化入口；负责判断是否该进入切片节奏，以及当前切片的首动作与停止条件 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 surface 而不增加稳定性 |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在节奏与边界，不在脚本层 |
| `templates/` | forbidden | runtime | 当前切片定义足够窄，不需要模板目录 |

它在父 Skill 中真正改变的是：
- 首动作：先定义当前切片，而不是先大改
- 停止条件：当前切片 + 最小验证成立就停，而不是无限扩张

---

## Flow

1. 先确认需求已有最小定义：scope、success criteria、关键 contract 足够清楚
2. 先定义**当前切片**，只做一个逻辑单元
3. 只改当前切片需要的文件
4. 完成后立刻做该切片的最小验证：测试 / 构建 / 手动检查
5. 若当前切片是 browser-facing page / component / interaction，且代码级验证不足以证明行为，可补 `browser-runtime-observation` 作为切片级最小运行态验证
6. 若验证成立，停止并决定是否进入下一切片
7. 若切片暴露失败，再切 debug 或 proof 路径，而不是继续堆改动

### 何时应该补专项实现器
- API / contract 主导 → `api-and-interface-design`
- UI / component 主导 → `frontend-ui-engineering`
- browser-facing 切片需要真实浏览器技术证据 → `browser-runtime-observation`
- 框架正确性要求高 → `source-driven-development`

### 不该何时使用
- 需求仍模糊
- 当前主任务其实是修 bug / 建失败证明 / 做 review
- 单文件、单动作、范围自明的小改动

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 输出形状稳定
- 重点不是“多做一点”，而是“切出当前最小可交付切片”

在父 Skill `project-implementation` 中，通常位于：
- build / implement 主路径

---

## Runtime Proof

先验证：首动作是否从“直接改很多”变成“先定义当前切片”。

再验证：
- 当前切片是否只有一个逻辑单元
- 读取面和改动面是否更小
- 是否做了切片级最小验证
- 是否在验证成立后及时停止，而不是继续扩写

可接受 proof：
- human review
- real-task reuse
- downstream quality（是否更少返工、更容易定位问题）
