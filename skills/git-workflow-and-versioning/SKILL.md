---
name: git-workflow-and-versioning
description: >
  用于提交边界、分支策略、冲突处理、历史整理或并行工作隔离本身成为当前主问题的局部强化 Skill。
  当 build、review 或 ship 路径下，需要安全切分提交、组织多步改动、处理 rebase/merge conflict、使用 worktree 并行时使用。
  它由 project-implementation 按需补入，用来先收敛变更边界与保存点，再操作 git；不替代普通实现本身。
---

# Git Workflow and Versioning

## Top-level Boundary Pack

### current main output
- 提交切分方案
- 分支 / worktree 使用策略
- 冲突处理结果
- 干净可审查、可回退的历史

### current main action
- 划清变更边界
- 建立保存点策略
- 安排分支 / worktree / rebase / merge / conflict 处理顺序
- 让历史更可审查、更可回退、更可并行隔离

### should-trigger
当当前主任务满足以下任一项时，优先进入本 Skill：
- 提交边界本身成为当前问题
- 需要分支策略、worktree 并行隔离或历史整理
- 需要处理 rebase / merge conflict
- 当前 build、review 或 ship 路径下，版本控制安全收口成为主要阻力

### should-not-trigger
以下请求不应由本 Skill 接管：
- 当前只是普通功能实现推进，git 不是主问题
- 用户并不需要分支/提交/历史层面的决策
- 当前主任务是安全边界、性能定位或文档来源查证
- 当前问题仍是需求定义或实现本身，而不是版本控制边界

### adjacent destination
- build / implement 切片推进 → `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- review / quality gate → `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`
- ship / release / rollback → `/Users/handy/.claude/skills/shipping-and-launch/SKILL.md`
- 顶层实施路由 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 文档记录 / ADR / 决策沉淀 → `/Users/handy/.claude/skills/documentation-and-adrs/SKILL.md`

### non-goals
- 不替代普通功能实现
- 不把复杂 git 操作当成默认答案
- 不为“好看”而无边界重写历史
- 不把实现问题错误转化成纯 git 问题

### first action after hit
先划清当前变更边界与保存点；如果没有先明确“什么该同一提交、什么该拆开、哪里是回退点”，就不算真正 adopt 本 Skill。

### positive examples
- “这次改动太散了，先帮我拆成几个可审查提交，再考虑 rebase。”
  - why should trigger: 主问题是提交边界与历史可审查性
  - expected adopt signal: 先给出边界与保存点方案，而不是直接运行 git 命令
- “我想并行试两个实现方向，帮我用 worktree 安全隔离。”
  - why should trigger: 这是典型版本控制并行隔离需求
  - expected adopt signal: 先决定隔离策略，再执行 worktree/branch 操作

### negative examples
- “这个功能需求已经明确，先做第一版实现。”
  - why should not trigger: 当前主任务是实现，不是版本控制边界
  - correct destination: `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- “这个测试挂了，先帮我找根因。”
  - why should not trigger: 当前主任务是调试
  - correct destination: `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- “先帮我写一份 ADR，记录为什么选这个方案。”
  - why should not trigger: 当前主任务是决策记录，而不是 git workflow
  - correct destination: `/Users/handy/.claude/skills/documentation-and-adrs/SKILL.md`

## Why

这个 Skill 用于压缩“代码在改，但如何安全保存、切分、回退、并行与整理历史”的版本控制不确定性。

如果没有它，agent 很容易：
- 累积大块未提交改动
- 把多个逻辑变化混成一个提交
- 在冲突和重写历史时没有清晰保存点
- 并行工作时互相污染上下文与工作树

---

## What

### 主目标
把版本控制相关工作收敛成**明确变更边界、建立保存点、保持历史可审查可回退**的路径。

### 主输出物
- 提交切分方案
- 分支 / worktree 使用策略
- 冲突处理结果
- 干净可审查的历史

### 不负责
- 不替代普通功能实现
- 不在 git 不是主问题时泛化介入
- 不把复杂历史操作当成默认答案

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 build、review 或 ship 路径专项实现器被补入。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | git workflow 主入口；负责边界划分、保存点策略与历史 hygiene 判断 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 git path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在边界与历史策略，不在脚本层 |
| `templates/` | forbidden | runtime | 当前输出形状稳定，不需要模板目录 |

它在父 Skill 中真正改变的是：
- 首动作：先划清变更边界与保存点，而不是先执行 git 命令
- 证据形状：从“已经提交/已经 rebase”变成“历史更清晰、回退更安全、并行更隔离”

---

## Flow

1. 先确认当前主问题确实是提交边界、分支、冲突或历史整理
2. 先划清当前变更边界：什么应同一提交，什么应拆开
3. 先建立保存点策略：小步提交、可回退节点、必要时 worktree 隔离
4. 再执行具体 git 操作：commit、branch、rebase、merge、conflict resolution、history cleanup
5. 每次关键操作后确认工作区状态与历史是否仍可理解、可回退
6. 当边界清晰、历史可审查、冲突已收敛后停止，不把实现本身转化成纯 git 操作问题

### 关键约束
- 先边界，后 git 命令
- 一个提交尽量只表达一个逻辑变化
- 保存点优先于事后补救
- 并行工作优先用 worktree 等隔离手段，避免互相污染
- history hygiene 的目标是更可审查、更可回退，不是为了“好看”而重写

### 何时不该使用
- 当前只是普通实现推进
- 还没有形成需要单独处理的提交/分支/冲突问题
- 用户并不需要历史整理或版本控制决策

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 只在版本控制成为主问题时补入
- 输出稳定围绕 boundary / save points / history hygiene

在父 Skill `project-implementation` 中，通常位于：
- build 的多步切片阶段
- review 前的历史整理阶段
- ship 前的安全收口阶段

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“直接跑 git 命令”变成“先划清变更边界与保存点”。

再验证：
- 提交边界是否更清晰
- 保存点是否存在
- 冲突处理后历史是否仍可理解
- 并行工作是否被有效隔离
- 是否没有把实现问题错误转成复杂 git 操作

可接受 proof：
- human review
- git status / log / worktree state
- downstream quality（回退更容易、review 更容易、冲突返工更少）
