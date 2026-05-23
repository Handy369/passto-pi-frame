---
name: visual-feedback-ui-qa
description: >
  用于真实运行态 UI QA / visual feedback 验收的实施侧验证 Skill。当当前主交付物是检查界面是否真正可用、
  状态反馈是否用户可感知、并输出结构化 findings 时使用。适用于打开真实页面做可用性测试、验证交互反馈、
  检查状态提示、输出 P0/P1/P2 问题清单；不适用于纯代码实现、纯高层设计定义或纯 DevTools 性能/网络调试。
---

# Visual Feedback UI QA

## Why

这个 Skill 用于压缩“界面代码看起来支持，但用户是否真的感知得到”这一层不确定性。

如果没有它，agent 很容易：
- 只看代码、DOM 或设计文档就判定通过
- 把功能存在误当成反馈成立
- 只描述技术状态，不描述用户是否知道发生了什么
- 输出泛泛评论，而不是可执行的 findings

---

## What

### 主目标
把真实运行态界面的观察，转成**用户可见证据驱动**的 QA 结论与整改清单。

### 主输出物
- runtime UI QA findings
- visual feedback / interaction clarity 评估
- P0 / P1 / P2（或等价严重度）问题清单
- 每项问题的 surface、用户可见证据、影响、最小修复建议

### 不负责
- 不替代纯前端代码实现
- 不替代高层 UI/UX 方向定义
- 不替代纯性能 profiling、network waterfall、memory leak 调试

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- `/Users/handy/.claude/skills/frontend-ui-engineering/SKILL.md`
的运行态验证子 Skill 被补入。

---

## Structure

默认只需单一 `SKILL.md`。

它真正改变的是：
- 首动作：从“读代码/看 DOM”变成“先看真实运行态并做最小交互”
- 判据：从“功能存在”变成“用户是否感知得到”
- 输出：从泛泛评价变成结构化 findings

---

## Flow

1. 先确认当前主交付物确实是运行态 UI QA，而不是直接改代码或做高层设计
2. 必须优先看真实运行页面；没有真实运行态证据，不得直接判通过
3. 做最小交互验证，至少覆盖：
   - 首屏可理解性
   - 主操作主次是否清楚
   - 点击 / 聚焦 / 切换后是否有明确反馈
   - loading / empty / error / success / pending 是否用户可感知
   - 高风险动作是否有确认与恢复边界
4. 记录用户可见证据，而不是只记录内部实现细节
5. 输出 findings 时，至少包含：
   - 严重度
   - surface
   - 用户可见证据
   - 影响
   - 最小修复建议
6. 如问题已经下钻为 DOM / console / network / accessibility / performance 技术诊断，再补 `browser-runtime-observation`
7. 达成当前验证结论后停止，不把 QA 扩成直接实现或高层产品定义

### 关键约束
- 不能只因代码存在就判定反馈成立
- 不能只靠静态截图替代最小交互验证
- 主判据始终是“用户是否知道发生了什么、风险是什么、下一步是什么”
- 输出必须可执行，不能只写审美意见

### 何时不该使用
- 当前主交付物是直接改 UI 代码
- 当前主交付物是信息架构、交互方向、视觉方向定义
- 当前主交付物是性能、内存、网络等底层技术调试

---

## Surface

这是一个局部强化型验证 Skill：
- 入口窄：只处理真实运行态 UI QA / visual feedback 验收
- 首动作稳定：先看真实页面与最小交互
- 输出稳定：结构化 findings，而不是代码补丁或方案文档

常见上游入口：
- `project-implementation` 下的 build / review 路径
- `frontend-ui-engineering` 下的运行态验证节点

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“看代码推断”变成“先看真实运行态”。

再验证：
- findings 是否基于用户可见证据
- 是否明确区分功能存在与反馈成立
- 是否输出了结构化严重度与最小修复建议
- 是否没有越界扩成直接实现、纯 DevTools 调试或高层定义讨论

可接受 proof：
- human review
- real runtime QA reuse
- downstream quality（是否更少出现“代码支持但用户无感”的返工）
