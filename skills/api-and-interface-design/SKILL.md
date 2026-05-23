---
name: api-and-interface-design
description: >
  用于接口、契约、类型边界是当前主实现面的局部强化 Skill。当 build 路径下的实现主要风险在 API endpoint、
  request/response shape、module contract、component props 或 typed boundary 时使用。它由 project-implementation
  按需补入，用来先收敛 contract，再写实现；不替代定义阶段，也不替代普通 build/debug/review 主路径。
---

# API and Interface Design

## Why

这个 Skill 用于压缩“代码要改，但真正高风险的是接口边界而不是实现细节”的不确定性。

如果没有它，agent 很容易：
- 先写实现，后补 contract
- 在 request / response / error semantics 上前后不一致
- 把内部实现细节泄漏成外部依赖
- 前后端或模块边界在实现中不断漂移

---

## What

### 主目标
把当前实现收敛成**先明确 contract，再落代码**的路径。

### 主输出物
- contract 草图或明确接口形状
- input / output / error semantics
- validation boundary
- 与 contract 对齐的实现改动
- 必要时的 contract proof（测试、类型约束、调用方对齐）

### 不负责
- 不替代产品级 architecture proposal
- 不在 scope / use case 未清楚时先做接口设计
- 不替代普通 build 主路径的切片控制

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 build 路径专项实现器被补入。

---

## Structure

默认只需单一 `SKILL.md`。

它在父 Skill 中真正改变的是：
- 首动作：先明确 contract，而不是直接铺开实现
- 证据形状：从“代码已写”变成“contract 已定、边界已稳、实现已对齐”

---

## Flow

1. 先确认当前主风险确实在接口/边界：API endpoint、typed contract、module boundary、props shape
2. 先写清当前 contract 的最小集合：
   - input
   - output
   - error semantics
   - ownership / trust boundary
3. 先决定哪些地方必须验证：
   - 用户输入
   - 第三方返回
   - 环境配置
4. 再做实现改动，要求实现服从 contract，而不是边写边改 contract
5. 必要时补证明：
   - 类型约束
   - contract test
   - consumer 调用对齐
6. 当 contract 已稳定、实现已对齐时停止，不继续把它扩成高层系统设计讨论

### 关键约束
- 先 contract，后 implementation
- 错误语义要一致，不能一处 throw、一处 null、一处 `{ error }`
- 外部输入只在边界验证，不把验证噪音扩散到所有内部函数
- 尽量加法式演进，避免随意破坏既有消费者

### 何时不该使用
- 当前主任务其实是前端 UI 呈现
- 还在定义产品范围或系统方案
- 只是普通代码实现，接口边界不是主要风险

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 只在“边界是主要风险”时补入
- 输出稳定围绕 contract / boundary / proof

在父 Skill `project-implementation` 中，通常位于：
- build 路径下的 API / contract / typed boundary 节点

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“直接实现”变成“先收敛 contract”。

再验证：
- input / output / error semantics 是否明确
- validation boundary 是否明确
- 实现是否服从 contract，而不是边写边漂移
- 是否产出了 contract 对齐证据（类型、测试、调用方一致性）
- 是否没有越界扩写成高层产品/系统定义

可接受 proof：
- human review
- real-task reuse
- downstream quality（前后端/模块边界返工是否更少）
