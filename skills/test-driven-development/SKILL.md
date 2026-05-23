---
name: test-driven-development
description: >
  用于 proof-first 场景的局部强化 Skill。当当前主交付物是测试、回归防护或 test-first 行为证明时，
  先建立失败测试或明确验证基线，再做最小实现让其通过。它是 project-implementation 的 proof 主路径控制器，
  不替代普通 build 路径或 review gate。
---

# Test-Driven Development

## Top-level Boundary Pack

### current main output
- failing test 或明确验证基线
- minimal implementation change
- passing test evidence
- 必要时的 refactor 后仍通过证明

### current main action
- 先建立失败证明或验证基线
- 用测试暴露问题或锁定行为边界
- 做最小实现改动让测试通过
- 用测试链路证明行为成立并防复发

### should-trigger
当当前主交付物满足以下任一项时，优先进入本 Skill：
- 测试本身是主要产物
- 需要建立 regression guard
- 需要用 failing → passing 的链路证明行为变更
- 当前明确采用 test-first / proof-first 方式推进

### should-not-trigger
以下请求不应由本 Skill 接管：
- 当前主任务只是普通功能实现，测试不是主要交付物
- 当前主任务是 failure-first 调试与根因定位
- 当前主任务是 review / gate / merge readiness
- 当前更需要先明确 scope / success criteria / contract
- 纯配置、纯文档或无行为变化的小修改

### adjacent destination
- build / implement 切片推进 → `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- debug / recover / root cause → `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- review / quality gate → `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`
- 定义不足、需先澄清需求 → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 顶层实施路由 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### non-goals
- 不负责把大量实现工作伪装成测试任务
- 不负责在测试不是主交付物时强行介入
- 不负责替代 failure-first 调试
- 不负责在 proof 成立后继续无边界扩写

### first action after hit
先建立 failing test 或明确验证基线；如果没有先出现可执行证明入口，就不算真正 adopt 本 Skill。

### positive examples
- “这个 bug 修复我想先补一个失败测试，再最小改动把它修过。”
  - why should trigger: 用户明确要 proof-first / regression guard
  - expected adopt signal: 先写失败测试，再做最小实现改动
- “先帮我把这个行为差异写成可执行测试，确认失败后再修。”
  - why should trigger: 主交付物是测试证明链路
  - expected adopt signal: 先建立验证基线或 failing case，而不是先改代码

### negative examples
- “先帮我定位这个构建错误的根因。”
  - why should not trigger: 主任务是调试与根因定位
  - correct destination: `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- “这个功能已经很明确，直接先切第一刀实现。”
  - why should not trigger: 主任务是 build 切片推进
  - correct destination: `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- “帮我看这次改动是否可以 merge。”
  - why should not trigger: 主输出物是 review 结论
  - correct destination: `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`

## Why

这个 Skill 用于压缩“代码改了，但行为是否真的被证明了”的证明不确定性。

如果没有它，agent 很容易：
- 先改代码，后补解释
- 修 bug 却没有回归保护
- 把主观相信当成行为证明

---

## What

### 主目标
把行为变更、bug 修复或关键逻辑，收敛成**先有可执行证明、后有实现**的路径。

### 主输出物
- failing test 或明确验证基线
- minimal implementation change
- passing test evidence
- 必要时的 refactor 后仍通过的证明

### 不负责
- 不替代普通 build 路径的切片推进
- 不替代 review readiness
- 不在纯配置、纯文档、无行为变化的小修改上强行介入

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 proof 主路径控制器被调用。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | proof 主路径入口；负责 proof-first 首动作、失败证明顺序与通过判据 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 proof path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在证明顺序与可执行测试约束，不在脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 的输出形状稳定，不需要模板目录 |

它在父 Skill 中真正改变的是：
- 首动作：先建失败证明，而不是先写实现
- 输出合同：不是“代码提交了”，而是“行为被测试链路证明了”

---

## Flow

1. 先确认当前主交付物确实是 proof / regression / test-first
2. 先写失败测试，或先明确当前验证基线
3. 确认测试确实失败或基线确实暴露问题
4. 做最小实现改动让测试通过
5. 必要时重构，但保持测试持续通过
6. 若改动面开始扩大，可回 build 路径切片推进
7. 若问题源自 bug，可与 debug 路径联动

### 不该何时使用
- 用户只是明确要快速实现且测试不是主交付物
- 当前更需要先定义 scope / success criteria
- 纯无行为影响的改动

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 输出形状稳定
- 重点在于建立可执行证明链，而不是泛化所有测试工作

在父 Skill `project-implementation` 中，通常位于：
- test / prove / regression 主路径

---

## Runtime Proof

先验证：首动作是否从“先写代码”变成“先写失败证明”。

再验证：
- failing test 是否真实存在
- minimal code change 是否让其通过
- 回归 guard 是否有效
- 是否没有把大量实现工作伪装成测试任务

可接受 proof：
- human review
- real-task reuse
- downstream quality（bug 修复后是否更不易复发）
