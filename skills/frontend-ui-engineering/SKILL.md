---
name: frontend-ui-engineering
description: >
  用于页面、组件、布局、交互状态是当前主实现面的局部强化 Skill。当 build 路径下的主要工作是把既有定义或既有 contract
  落成真实用户界面时使用。它由 project-implementation 按需补入，用来先收敛界面骨架、状态与反馈，再写 UI 代码；
  不替代高层 UI/UX 定义，也不替代普通 build/debug/review 主路径。
---

# Frontend UI Engineering

## Why

这个 Skill 用于压缩“要做前端实现，但真正容易发散的是界面骨架、状态与反馈，而不是单个 JSX 片段”的不确定性。

如果没有它，agent 很容易：
- 直接写视觉表层，没先收敛状态与交互骨架
- 把 data、state、presentation 混在一起
- 只做 happy path，缺 loading / empty / error / disabled / success feedback
- 为了看起来好看而偏离现有设计系统与真实内容结构

---

## What

### 主目标
把当前 UI 实现收敛成**先界面骨架与状态、后细节代码**的路径。

### 主输出物
- 组件/页面骨架
- 关键状态与反馈面
- 与设计系统一致的 UI 代码
- 必要时的可用性/可访问性/运行态验证证据

### 不负责
- 不替代高层 UI/UX 方向定义
- 不在产品 flow / IA 仍模糊时强行做 UI 实现
- 不替代普通 build 主路径切片控制

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 build 路径专项实现器被补入。

---

## Structure

默认只需单一 `SKILL.md`。

它在父 Skill 中真正改变的是：
- 首动作：先定义页面/组件骨架、状态与反馈，而不是直接堆视觉细节
- 证据形状：从“页面写出来了”变成“界面状态完整、交互成立、反馈可验证”

---

## Flow

1. 先确认当前主实现面确实是页面/组件/UI 交互，而不是高层定义或 API 边界
2. 先收敛界面骨架：
   - 页面或组件承担什么角色
   - 数据容器与展示层如何分开
   - 关键区域如何组织
3. 先列出关键状态面：
   - loading
   - empty
   - error
   - success / confirmation
   - disabled / pending
4. 再落具体 UI 代码，优先服从现有设计系统、spacing、typography、semantic token
5. 如交互复杂或需真实运行态确认，补：
   - `visual-feedback-ui-qa`
   - 必要时 `browser-runtime-observation`
6. 达成当前界面的功能与状态闭环后停止，不把实现扩成高层设计讨论

### 关键约束
- 先骨架与状态，后视觉装饰
- 数据获取与展示尽量分离
- 不要只做 happy path
- 不要用“AI 默认审美”替代项目设计系统
- 可访问性与键盘可用性属于默认质量线，不是最后补丁

### 何时不该使用
- 当前主风险是接口/契约而不是 UI
- 还在定义信息架构、交互方向、视觉方向
- 只是普通非 UI 代码改动

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 输出稳定围绕界面骨架、状态与反馈
- 常作为 build 路径下的前端实现补强器

在父 Skill `project-implementation` 中，通常位于：
- build 路径下的 page / component / interaction 节点

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“直接堆 UI”变成“先收敛骨架与状态”。

再验证：
- loading / empty / error / success 等状态是否完整
- data 与 presentation 是否更清晰分离
- 样式与设计系统是否一致
- 交互反馈是否可验证
- 是否没有越界扩写成高层 UI/UX 定义

可接受 proof：
- human review
- runtime validation
- browser-based QA
- downstream quality（UI 返工是否更少，状态遗漏是否更少）
