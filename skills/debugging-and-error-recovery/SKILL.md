---
name: debugging-and-error-recovery
description: >
  用于 failure-first 场景的局部强化 Skill。当测试失败、构建损坏、运行时异常或日志报错已经出现时，
  先停线、保留证据、稳定复现、定位根因、修复并补回归防护。它是 project-implementation 的 debug 主路径控制器，
  不替代普通新功能实现。
---

# Debugging and Error Recovery

## Top-level Boundary Pack

### current main output
- 可复现的失败描述
- 根因定位结论
- 针对根因的修复改动
- 回归防护或其他防复发证据

### current main action
- 停线并保留失败证据
- 稳定复现问题
- 缩小失败面与局部化根因
- 修复根因并建立 guard
- 做最小恢复验证

### should-trigger
当当前主任务已经出现以下任一 failure-first 信号时，优先进入本 Skill：
- 测试失败
- 构建损坏
- 运行时异常
- 明确报错或日志错误
- 用户要求定位根因、恢复行为或建立防复发措施

### should-not-trigger
以下请求不应由本 Skill 接管：
- 当前主任务是新功能实现或普通重构
- 当前主任务是先写失败证明 / test-first 行为变更
- 当前主任务是 review / gate / merge readiness
- 当前问题的根因其实是需求定义不清，而非运行时 failure

### adjacent destination
- 新功能实现 / build 切片 → `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- proof-first / test-first → `/Users/handy/.claude/skills/test-driven-development/SKILL.md`
- review / quality gate → `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`
- 定义不足、需先澄清需求 → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 顶层实施路由 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### non-goals
- 不负责在没有 failure 信号时提前介入
- 不负责把“试着改改看”包装成调试方法
- 不负责把 debug 路径扩成完整新功能实现
- 不负责修完后继续无边界扩写

### first action after hit
先停线，保留错误输出、日志、复现步骤、失败测试等证据；如果没有先复现和保留证据，就不算真正 adopt 本 Skill。

### positive examples
- “这个测试突然开始挂了，先帮我稳定复现并找到根因，再补回归防护。”
  - why should trigger: 这是典型 failure-first 调试请求
  - expected adopt signal: 先保留证据和复现，而不是直接改代码
- “构建坏了，日志里有 webpack error，帮我定位到底是哪一步坏了。”
  - why should trigger: 已有明确失败信号，需要局部化和根因定位
  - expected adopt signal: 先收集日志与最小失败案例，再进入修复

### negative examples
- “这个功能需求已经清楚，先帮我切第一刀实现。”
  - why should not trigger: 主任务是 build 切片，而不是 debug
  - correct destination: `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- “先帮我写个 failing test，再按测试把功能做出来。”
  - why should not trigger: 主任务是 test-first/proof-first
  - correct destination: `/Users/handy/.claude/skills/test-driven-development/SKILL.md`
- “帮我 review 这次修复是否可以 merge。”
  - why should not trigger: 主输出物是 review 结论
  - correct destination: `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`

## Why

这个 Skill 用于压缩“问题已经发生，但根因还不清楚”的调试不确定性。

如果没有它，agent 很容易：
- 在没有稳定复现前就乱改代码
- 修 symptom 而不是修 root cause
- 修完没有 guard，导致问题再次出现

---

## What

### 主目标
把 failure-first 请求收敛成：
- repro
- localization
- root cause
- fix
- regression guard

### 主输出物
- 可复现的失败描述
- 根因定位
- 修复改动
- 回归测试或其他防复发证据

### 不负责
- 不替代新功能 build 路径
- 不在没有失败信号时泛化介入
- 不把“试改几下”当调试方法

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 debug 主路径控制器被调用。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 调试主路径入口；负责 failure-first 首动作、根因定位顺序与恢复验证要求 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 debug path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在调试顺序与证据约束，不在脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 的输出形状稳定，不需要模板目录 |

它在父 Skill 中真正改变的是：
- 首动作：先停线、保留证据、稳定复现
- 输出合同：不是“似乎修好了”，而是“根因 + 修复 + guard”

---

## Flow

1. 停止继续加功能或继续扩改
2. 保留证据：错误输出、日志、复现步骤、失败测试
3. 稳定复现问题；若无法复现，先缩小条件差异
4. 局部化：判断是 UI、API、DB、build、external service 还是 test 自身问题
5. 缩小失败面，找最小失败案例
6. 修根因，不修表象
7. 必要时补 `test-driven-development`，建立 regression guard
8. 做最小端到端验证，确认恢复成立

### 不该何时使用
- 当前主任务是新功能实现
- 没有失败信号，只是“顺手优化一下”
- 需求定义不清导致的误差，此时应先回 definition

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 以 failure 为起点
- 输出形状稳定：repro → root cause → fix → guard

在父 Skill `project-implementation` 中，通常位于：
- debug / fix / recover 主路径

---

## Runtime Proof

先验证：首动作是否真的先复现与保留证据，而不是直接改代码。

再验证：
- repro 是否存在
- root cause 是否被明确命名
- fix 是否针对根因
- 是否建立了 regression guard
- 修复后是否做了最小验证

可接受 proof：
- human review
- real-task reuse
- downstream quality（同类问题是否更少再次出现）
