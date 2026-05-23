---
name: ci-cd-and-automation
description: >
  用于 workflow、quality gate、pipeline 或自动反馈回路本身成为当前主交付物的局部强化 Skill。
  当 ship 路径或 build/review 路径下，需要新增或修改 lint、typecheck、test、build、deploy、preview、rollback automation 时使用。
  它由 project-implementation 按需补入，用来先明确 gate 与反馈回路，再改自动化；不替代普通功能实现。
---

# CI/CD and Automation

## Why

这个 Skill 用于压缩“改动能否被自动验证、自动阻断、自动反馈”的不确定性。

如果没有它，agent 很容易：
- 只写 workflow 文件，却没想清 gate 顺序
- 把自动化变成一堆孤立脚本，没有反馈回路
- 在不该放行的地方放行，或在无关处过度阻断
- 让 CI 只是跑命令，而不是为实现提供稳定反馈

---

## What

### 主目标
把自动化相关工作收敛成**明确 gate、明确触发、明确反馈、明确失败处理**的路径。

### 主输出物
- quality gate 定义
- workflow / pipeline 改动
- 失败反馈回路
- 必要时的 deploy / preview / rollback automation

### 不负责
- 不替代普通代码实现
- 不在 CI/CD 不是主交付物时泛化介入
- 不把所有工程问题都变成 workflow 问题

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 ship 路径或 build/review 路径专项实现器被补入。

---

## Structure

默认只需单一 `SKILL.md`。

它在父 Skill 中真正改变的是：
- 首动作：先定义 gate 与反馈回路，而不是直接堆 workflow steps
- 证据形状：从“CI 文件改了”变成“变更被自动验证、失败能反馈、放行条件清楚”

---

## Flow

1. 先确认当前主交付物确实是 automation / workflow / pipeline
2. 先明确自动化目标：
   - 防止什么问题进入下一阶段
   - 在哪个事件触发
   - 谁消费失败反馈
3. 先定义最小 gate 顺序，例如：lint → typecheck → test → build → deploy
4. 再落 workflow / pipeline 改动，保持步骤职责单一、失败可定位
5. 明确失败反馈回路：日志、artifact、agent/human 下一步动作
6. 若涉及发布，再与 `shipping-and-launch` 对齐 rollout / rollback
7. 当 gate、触发与反馈回路清楚后停止，不把所有非自动化问题都吸进来

### 关键约束
- 先 gate，后 YAML
- 自动化的目标是阻断风险并缩短反馈时间，不是增加仪式
- 每个 gate 都应回答“拦什么、何时拦、失败后谁处理”
- 尽量让失败输出可直接回灌到实现/调试路径

### 何时不该使用
- 当前主任务不是 automation
- 只是普通代码实现附带顺手跑 CI
- 还在高层产品定义阶段

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 只在自动化成为主交付物时补入
- 输出稳定围绕 gate / trigger / feedback loop

在父 Skill `project-implementation` 中，通常位于：
- ship 路径
- build/review 的自动化收口节点

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“直接写 workflow”变成“先定义 gate 与反馈回路”。

再验证：
- gate 顺序是否清楚
- 触发条件是否清楚
- 失败输出是否可消费
- 自动化是否真正收敛了反馈时间或放行风险
- 是否没有把普通实现问题错误转成 CI/CD 问题

可接受 proof：
- human review
- workflow dry-run / CI run result
- downstream quality（失败定位是否更快，误放行是否更少）
