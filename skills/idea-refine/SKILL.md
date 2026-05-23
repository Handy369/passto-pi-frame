---
name: idea-refine
description: >
  把模糊想法收敛成可行动 problem framing、方向判断、关键假设与 MVP 范围的局部强化 Skill。
  用于用户还停留在 idea、方向、机会、概念阶段，需要先澄清“为什么做、给谁做、最小做什么”；
  它是 project-definition 的子 Skill，不替代完整 spec，也不直接进入实现。
---

# Idea Refine

## Why

这个 Skill 用于压缩“想法还很粗、还不足以直接写 spec”的早期不确定性。

如果没有它，agent 很容易：
- 把想法当需求直接推进
- 没有先澄清用户、价值与成功标准
- 在没有明确 MVP 的情况下过早扩张范围

---

## What

### 主目标
把 raw idea 收敛成可继续定义的中间产物。

### 主输出物
- problem statement
- recommended direction
- key assumptions
- MVP scope
- not doing list
- open questions

### 不负责
- 不替代完整 PRD / spec
- 不替代 research synthesis
- 不直接进入 implementation

它通常作为：
- `/Users/handy/.claude/skills/project-definition/SKILL.md`
的前段局部强化器被调用。

---

## Structure

默认只需单一 `SKILL.md`。

它在父 Skill 中强化的是：
- Why：为什么值得做
- What：到底要解决什么问题、给谁做、最小做什么

---

## Flow

1. 把原始想法重述为 problem framing / How-Might-We
2. 问少量高价值澄清问题：给谁做、成功是什么、限制是什么、为什么现在做
3. 做发散：生成若干可比方向
4. 做收敛：聚类、压力测试、暴露关键假设
5. 产出一页式定义中间件：problem / direction / assumptions / MVP / not doing
6. 当方向已足以进入 spec 时，交给 `spec-driven-development` 或父 Skill 主路径

### 不该何时使用
- 已经有清晰 spec，只差拆任务
- 已经进入实现阶段
- 用户只要一个非常明确、范围自明的微小定义动作

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 交互性强
- 输出形状稳定
- 常表现为定义前段的一页式收敛产物

在父 Skill `project-definition` 中，通常位于：
- idea / opportunity / problem framing / early JTBD 路径

---

## Runtime Proof

先验证：输出是否已经把想法变成了更清晰的问题定义，而不是只是聊了一圈。

再验证：
- 目标用户是否明确
- success criteria 是否初步明确
- assumptions 是否显式列出
- MVP / not doing 是否形成边界
- 是否没有越界写成完整 spec 或直接进入 implementation

可接受 proof：
- human review
- real-task reuse
- downstream quality（是否更容易进入 spec 阶段）
