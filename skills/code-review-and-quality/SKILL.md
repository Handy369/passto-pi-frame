---
name: code-review-and-quality
description: >
  用于 review-first 场景的局部强化 Skill。当当前主交付物是 findings、风险判断或 merge readiness 时，
  先审测试与验证故事，再审实现与质量维度，最后产出结构化结论。它是 project-implementation 的 review 主路径控制器，
  不替代 build、debug 或 test-first 路径。
---

# Code Review and Quality

## Top-level Boundary Pack

### current main output
- structured findings
- risk judgment
- merge readiness 结论
- 必要时的后续验证或修改建议

### current main action
- 先审测试与验证故事
- 再审实现与质量维度
- 识别 correctness / readability / architecture / security / performance 风险
- 输出结构化 findings 与 readiness

### should-trigger
当当前主交付物满足以下任一项时，优先进入本 Skill：
- code review 结论
- merge readiness 判断
- 结构化风险评估
- 审核已有改动是否可接受、是否该补验证或修改

### should-not-trigger
以下请求不应由本 Skill 接管：
- 当前主任务是新功能实现或普通重构
- 当前主任务是 failure-first 调试
- 当前主任务是 proof-first / test-first
- 当前更需要先明确需求定义、scope 或 acceptance criteria
- 用户只是要直接改代码而不是先出 review 结论

### adjacent destination
- build / implement 切片推进 → `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- debug / recover / root cause → `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- proof-first / test-first → `/Users/handy/.claude/skills/test-driven-development/SKILL.md`
- 定义不足、需先澄清需求 → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 顶层实施路由 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### non-goals
- 不负责把继续实现伪装成 review
- 不负责在没有验证故事时凭主观好恶给结论
- 不负责替代 build / debug / proof 主路径
- 不负责 review 后继续无边界扩写实现

### first action after hit
先看测试、验证结果与变化意图，确认作者到底想证明什么；如果没有先完成这一步，就不算真正 adopt 本 Skill。

### positive examples
- “帮我 review 这组改动能不能 merge，重点看风险和缺的验证。”
  - why should trigger: 主交付物明确是 review 结论与 readiness
  - expected adopt signal: 先看测试/验证故事，再输出 findings 和 readiness
- “这次修复我不想你直接改，先判断还有哪些 correctness 或 perf 风险。”
  - why should trigger: 用户先要结构化审查结论
  - expected adopt signal: 输出风险判断，并在需要时建议后续专项检查

### negative examples
- “这个功能需求已经明确，直接先做第一版实现。”
  - why should not trigger: 主任务是实现而不是 review
  - correct destination: `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- “这个测试挂了，先帮我找根因。”
  - why should not trigger: 主任务是 debug
  - correct destination: `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- “先帮我补个 failing test，再按它修。”
  - why should not trigger: 主任务是 proof-first
  - correct destination: `/Users/handy/.claude/skills/test-driven-development/SKILL.md`

## Why

这个 Skill 用于压缩“代码改完了，但是否真的可合并、可接受、风险可控”的审查不确定性。

如果没有它，agent 很容易：
- 把主观好恶当成 review
- 没看验证故事就直接点评实现
- 一边 review 一边继续大改，模糊 review 输出

---

## What

### 主目标
把 review-first 请求收敛成：
- structured findings
- risk judgment
- merge readiness
- 必要时的后续专项检查建议

### 主输出物
- findings（含优先级/严重性）
- readiness 判断
- 需要补的验证或修改建议

### 不负责
- 不替代普通实现
- 不替代 bug 调试
- 不把“顺手再改一堆”当 review 的默认动作

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 review 主路径控制器被调用。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | review 主路径入口；负责 review-first 首动作、findings 结构与 readiness 判定 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 review path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在审查顺序与结论结构，不在脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 的输出形状稳定，不需要模板目录 |

它在父 Skill 中真正改变的是：
- 首动作：先看测试与验证故事，再看实现
- 输出合同：不是泛泛点评，而是 findings / readiness / severity

---

## Flow

1. 先确认当前主交付物是 review 结论，而不是继续实现
2. 先审测试、验证结果、变化意图，确认作者想证明什么
3. 再审实现本身，按 correctness / readability / architecture / security / performance 组织判断
4. 发现专项问题时，再补专项叶子 skill：
   - security → `security-and-hardening`
   - performance → `performance-optimization`
   - simplification → `code-simplification`
5. 输出结构化 findings 与 readiness
6. 停在 review 结论，不默认横向继续大改实现

### 不该何时使用
- 当前主任务是 build、debug 或 test-first
- 用户只是要你直接写功能
- 需求仍未定义清楚

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 输出形状稳定
- 重点是可执行 review 结论，而不是“有点意见”

在父 Skill `project-implementation` 中，通常位于：
- review / assess / gate 主路径

---

## Runtime Proof

先验证：首动作是否真的先看测试与验证故事，而不是直接审风格。

再验证：
- findings 是否有明确证据来源
- severity 是否清楚
- readiness 是否明确
- 是否没有把继续实现伪装成 review

可接受 proof：
- human review
- real-task reuse
- downstream quality（review 后返工是否更聚焦）
