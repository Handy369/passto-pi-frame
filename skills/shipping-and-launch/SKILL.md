---
name: shipping-and-launch
description: >
  用于 release readiness、staged rollout、monitoring、rollback preparation 或实际上线动作成为当前主交付物的局部强化 Skill。
  当功能已经基本完成，问题转为“能否安全放量、如何监控、何时回滚”时使用。它由 project-implementation 按需补入，
  用来先收敛发布门槛与回退条件，再执行上线；不替代普通实现或产品范围定义。
---

# Shipping and Launch

## Why

这个 Skill 用于压缩“功能已经做完，但能不能安全上线、出了问题怎么回退”的发布不确定性。

如果没有它，agent 很容易：
- 把‘代码合并了’当成‘可以上线了’
- 只想上线步骤，不想监控与回滚条件
- 在没有 rollout threshold 的情况下盲放量
- 把发布问题和实现问题混在一起处理

---

## What

### 主目标
把上线相关工作收敛成**先 readiness、再 rollout、再监控、再回退预案**的路径。

### 主输出物
- release readiness 判断
- rollout plan
- monitoring / verification plan
- rollback trigger 与 rollback path
- 必要时的 launch 执行动作

### 不负责
- 不替代普通功能实现
- 不在功能仍明显未完成时强行进入发布模式
- 不替代高层产品发布策略讨论

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 ship 路径专项实现器被补入。

---

## Structure

默认只需单一 `SKILL.md`。

它在父 Skill 中真正改变的是：
- 首动作：先明确 readiness 与 rollback 条件，而不是直接部署
- 证据形状：从“已上线”变成“可放量、可监控、可回退”

---

## Flow

1. 先确认当前主交付物确实是上线/发布，而不是继续实现功能
2. 先明确 readiness：质量、验证、安全、性能、配置、迁移状态是否达到最小发布线
3. 先写 rollout plan：
   - 直接发布还是 feature flag
   - staged rollout 还是一次性放量
   - 每个阶段看哪些指标
4. 先明确 rollback trigger 与 rollback path：
   - 什么信号触发回退
   - 如何回退：关 flag、回滚版本、回退迁移等
5. 再执行发布动作，并做首轮 post-launch verification
6. 当 readiness、monitoring、rollback 都清楚且发布动作完成后停止，不回到无关实现扩写

### 关键约束
- 先 readiness 与 rollback，后 deploy
- 上线不是结束，而是进入观察窗口
- feature flag、分阶段放量、监控阈值优先于一次性盲发
- 发布问题要与实现问题分层处理

### 何时不该使用
- 功能仍未达最小完成线
- 当前主问题还是 bug 修复或需求不清
- 用户只是泛化要求“做个部署”但没有发布目标与风险面

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 只在 release / rollout / rollback 成为主交付物时补入
- 输出稳定围绕 readiness / monitoring / rollback

在父 Skill `project-implementation` 中，通常位于：
- ship 路径

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“直接部署”变成“先确认 readiness 与 rollback 条件”。

再验证：
- readiness 判断是否存在
- rollout 阶段与阈值是否清楚
- rollback trigger / path 是否清楚
- post-launch verification 是否存在
- 是否没有把“部署成功”误当“发布风险已收敛”

可接受 proof：
- human review
- deploy / rollout records
- monitoring snapshots
- downstream quality（发布返工、紧急回滚混乱是否更少）
