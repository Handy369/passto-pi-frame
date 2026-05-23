---
name: performance-optimization
description: >
  用于性能退化、性能瓶颈或明确性能目标是当前主风险面的局部强化 Skill。当 build 或 review 路径下，
  当前问题需要以测量为起点，定位 bottleneck、做针对性修复并复测时使用。它由 project-implementation 按需补入，
  用来先建 baseline，再动优化；不替代普通实现，也不接受“感觉可能更快”的盲优化。
---

# Performance Optimization

## Top-level Boundary Pack

### current main output
- baseline
- bottleneck 判断
- 针对性优化改动
- before/after 验证结果
- 必要时的回归 guard 或监控建议

### current main action
- 先测量性能表现
- 识别瓶颈位置
- 只改当前瓶颈相关部位
- 复测并比较前后指标
- 在必要时补监控或阈值 guard

### should-trigger
当当前主任务满足以下任一项时，优先进入本 Skill：
- 已有明确性能目标或性能回归证据
- 用户明确指出页面、接口、查询或构建很慢
- 当前需要先建立 baseline、定位 bottleneck、再做针对性优化
- 性能已经成为 build 或 review 路径下的主风险面

### should-not-trigger
以下请求不应由本 Skill 接管：
- 当前没有性能证据，只是泛泛要求“顺便优化一下”
- 当前主任务是普通功能实现或纯代码清理
- 当前主任务是安全边界、文档来源正确性或上下文装配
- 当前还在需求定义阶段

### adjacent destination
- build / implement 切片推进 → `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- review / quality gate → `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`
- security 主风险 → `/Users/handy/.claude/skills/security-and-hardening/SKILL.md`
- 顶层实施路由 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 定义不足、需先澄清目标或指标 → `/Users/handy/.claude/skills/project-definition/SKILL.md`

### non-goals
- 不负责在没有证据时预优化
- 不把“代码更优雅了”误当性能优化完成
- 不替代普通功能实现
- 不在性能目标达成后继续无限扩张成全面重构

### first action after hit
先建立 baseline；如果没有先拿到可比较的性能基线，就不算真正 adopt 本 Skill。

### positive examples
- “这个接口从 200ms 变成 1.2s 了，先帮我定位瓶颈，再做最小优化。”
  - why should trigger: 已有明确性能回归证据，需要先测量再定位
  - expected adopt signal: 先建 baseline 和 bottleneck 判断，而不是直接改代码
- “这个页面的 LCP 很差，给我 before/after 的可比较优化结果。”
  - why should trigger: 用户明确要性能指标与前后对比证明
  - expected adopt signal: 先测指标，再做定向修复并复测

### negative examples
- “这个功能已经明确，先直接做实现。”
  - why should not trigger: 主任务是普通实现，不是性能主风险
  - correct destination: `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- “这个 webhook 先帮我分析 trust boundary。”
  - why should not trigger: 主风险是安全边界，不是性能
  - correct destination: `/Users/handy/.claude/skills/security-and-hardening/SKILL.md`
- “先帮我 review 这次改动能不能 merge。”
  - why should not trigger: 主输出物是 review 结论，不是性能专项优化
  - correct destination: `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`

## Why

这个 Skill 用于压缩“系统可能慢，但到底慢在哪、值不值得改、改了是否真变快”这类性能不确定性。

如果没有它，agent 很容易：
- 凭直觉优化
- 在没 baseline 时改一堆代码
- 修了非瓶颈位置
- 改完没有复测，无法证明收益

---

## What

### 主目标
把性能相关工作收敛成**先测量、再定位、再修复、再复测**的路径。

### 主输出物
- baseline
- bottleneck 判断
- 针对性优化改动
- before/after 验证结果
- 必要时的回归 guard 或监控建议

### 不负责
- 不替代普通功能实现
- 不在没有性能证据时提前优化
- 不把“代码更优雅了”误当性能优化完成

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 build 或 review 路径专项实现器被补入。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | performance-sensitive 节点入口；负责 baseline、bottleneck 与 before/after 证据闭环 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 performance path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在性能证据顺序与优化约束，不在脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 的输出形状稳定，不需要模板目录 |

它在父 Skill 中真正改变的是：
- 首动作：先建立 baseline，而不是先改代码
- 证据形状：从“看起来更优”变成“瓶颈被定位、指标前后可比”

---

## Flow

1. 先确认当前确实有性能目标、性能回归或明确慢点
2. 先建立 baseline：
   - 前端：LCP / INP / CLS / trace / waterfall
   - 后端：response time / query time / CPU / memory / external latency
3. 先判断 bottleneck 在哪：
   - bundle / render / main thread
   - network / server / DB / cache / external dependency
4. 再做针对性修复，只改当前瓶颈相关部位
5. 复测 before / after，确认收益而不是主观感觉
6. 必要时补 guard：监控、回归测试、阈值记录
7. 达成当前性能目标或定位结论后停止，不把它扩成泛化代码清理

### 关键约束
- 先 measure，后 optimize
- 不优化未证实的瓶颈
- 性能证据必须是可比较的 before / after
- 优化不应悄悄牺牲 correctness、security、maintainability

### 何时不该使用
- 当前没有性能证据
- 用户只是泛化要求“顺便优化一下”
- 还在需求定义阶段

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 只在性能成为主风险时补入
- 输出稳定围绕 baseline / bottleneck / before-after proof

在父 Skill `project-implementation` 中，通常位于：
- build 或 review 路径下的 performance-sensitive 节点

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“先改代码”变成“先建 baseline”。

再验证：
- baseline 是否存在
- bottleneck 是否被明确定位
- 改动是否针对瓶颈而非泛化清理
- before / after 是否可比较
- 是否没有把主观体感当成完成证明

可接受 proof：
- human review
- profiler / trace / metrics comparison
- downstream quality（性能返工是否更少，误优化是否更少）
