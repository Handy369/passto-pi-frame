# Skill Benchmark Brief — agent-human-workspace-baseline

> **last_verified: 2026-05-15**

## 0. Experiment meta
- experiment name: agent-human-workspace-baseline-trigger-adoption
- date: 2026-05-15
- owner: pi agent
- target skill: project-definition
- target files:
  - /Users/handy/.claude/skills/project-definition/SKILL.md
  - /Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md
  - /Users/handy/.claude/skills/project-definition/references/design-foundation.md
  - /Users/handy/.claude/skills/project-definition/references/core-flow-design.md
  - /Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md
- related framework card: none (reference-level benchmark brief)
- benchmark type: routing + skill-use

## 1. Goal
- 本轮要验证什么:
  - 当用户请求设计或重构 **agent-human 共享工作台**，或更泛地请求 **复杂产品界面的 UE / 交互设计 / 信息架构** 时，`project-definition` 是否能正确路由到 `agent-human-workspace-baseline.md`
  - 命中后，agent 是否采用“**先看真实运行界面，再做工作台/任务型界面信息架构与状态反馈设计**”的 workflow
  - agent 是否能区分“任务型复杂界面交互基线设计”和普通视觉/UI 建议、普通前端实现、普通流程定义
- 成功标准:
  - positive case 中，agent 明确把任务当作共享工作台定义问题，而不是泛化成普通 UI 美化或直接写代码
  - positive case 中，agent 会要求或执行真实运行态审查，并输出围绕 header / sidebar / agent panel / status / review-first / recovery 的设计结果
  - negative case 中，agent 不会误用本 reference 去处理纯视觉风格、纯代码实现或纯技术流程定义
- 本轮不验证什么:
  - 不验证最终视觉稿质量
  - 不验证浏览器工具本身能力
  - 不验证前端代码落地质量

## 2. Baseline contract
- baseline repo / worktree: AutoAgent baseline 或当前 skills benchmark worktree
- output dir: 独立实验输出目录，例如 /Users/handy/autoagent-outputs/agent-human-workspace-baseline-trigger-adoption/
- 是否允许修改 harness: 否
- 是否允许修改 task / verifier: 是
- 固定不改的变量:
  - 模型
  - provider
  - 基础 harness
  - 现有 top-level router 拓扑（`project-definition` / `project-implementation`）

## 3. Target skill contract
- 期望 should-trigger 的请求类型:
  - 设计 human + agent 共用工作台
  - 设计/重构 side panel / status bar / patch review / recovery UX
  - 把工程演示界面收敛成任务导向的共享工作台
  - 定义 review-first 协作界面、状态反馈模型、工作台信息架构
  - 设计复杂产品界面的 UE / 交互设计 / 信息架构
  - 重构后台 / 控制台 / studio / editor 的区块职责、主操作、状态区、待处理区
  - 解决“信息很多但不知道先看哪块”的复杂界面层级问题
- 期望 should-not-trigger 的请求类型:
  - 纯视觉风格/配色/排版建议
  - 纯前端实现、改组件、写代码
  - 纯浏览器 QA / 可用性测试
  - 纯业务流程/状态机定义但不涉及共享工作台界面
- 最容易混淆的相邻 skill:
  - `project-definition/references/design-foundation.md`
  - `project-definition/references/core-flow-design.md`
  - `project-implementation`
  - `frontend-ui-engineering`
  - `visual-feedback-ui-qa`
- 命中后应采用的 workflow:
  - 先确认这是“共享工作台定义问题”，不是实现或纯视觉风格问题
  - 明确要求真实运行态证据，不只看文档
  - 围绕工作对象、下一步动作、review-first、状态反馈、恢复路径做设计
  - 输出工作台信息架构 / 状态模型 / 优先级整改项，而不是泛泛美化建议

## 4. Positive cases
### Case P1
- user request: 我们现在有一个 human 和 agent 共用的工作台，左边是结构栏，中间是画布，右边是 patch 和恢复信息。请不要只看 spec，先基于真实运行界面帮我定义这个 workspace 的交互基线。
- 为什么应该触发 target skill: 这是典型的 agent-human 共享工作台交互定义，而不是普通 UI 风格或代码实现
- 期望 use signal:
  - 明确提出或执行真实运行态审查
  - 输出 header / sidebar / canvas shell / agent panel / status bar 的信息架构建议
  - 强调 review-first、状态反馈、恢复路径、内部术语降级
- 允许的自然语言变体:
  - 帮我设计一个人机共用工作台
  - 把这个 shared workspace 收敛成更像产品的协作台
  - 定义这套 agent 协作工作台应该怎么组织信息

### Case P2
- user request: 当前页面功能挺全，但像开发 demo，不像工作台。请基于真实界面帮我做一个 redesign baseline，重点看 sidebar、status bar、agent panel 和待审阅 patch 的表达。
- 为什么应该触发 target skill: 用户要的是共享工作台 redesign baseline，不是写代码，也不是单纯审美建议
- 期望 use signal:
  - 不会直接进入实现
  - 会把问题收敛为“任务导向 vs 工程语境”“待处理项优先”“状态去重”“内容块语义化”等方向
  - 输出优先级清单
- 允许的自然语言变体:
  - 这个界面像工程台，不像产品工作台
  - 帮我把这个开发界面收敛成可协作工作台
  - 重点重新定义右栏和底栏的产品角色

### Case P3
- user request: 我想定义一个 review-first 的 agent workspace：agent 只提议修改，human 决定 apply/reject。请先把这类界面的状态模型、信息架构和恢复 UX 设计清楚。
- 为什么应该触发 target skill: 这是共享工作台 + review-first 协作模型的定义任务
- 期望 use signal:
  - 覆盖 pending review / stale patch / applied / rejected / remote update / recovery 等状态
  - 强调确认边界与下一步动作
  - 输出定义类产物，而不是代码方案
- 允许的自然语言变体:
  - 先把人审 agent patch 的工作台方案写清楚
  - 帮我定义 staged patch / stale / recover 的 UX
  - 设计一个以人工审阅为核心的 agent 协作台

### Case P4
- user request: 帮我做这个复杂后台的 UE / 交互设计。它现在信息很多，但用户不知道先看哪块。我不要配色建议，我要你重构信息架构、主操作、状态区和待处理区。
- 为什么应该触发 target skill: 用户要的是复杂任务型界面的交互设计与信息架构，不是纯视觉风格
- 期望 use signal:
  - 把问题识别为任务导向界面结构问题，而不是配色排版建议
  - 输出主真相区、主操作区、待处理区、异常区、折叠详情区等结构化结果
  - 明确区分 should-keep / should-merge / should-remove 信息
- 允许的自然语言变体:
  - 帮我重做这个控制台的交互层级
  - 这个 editor 像 demo，不像产品，请从 UE 角度重构
  - 我不要美化，我要复杂界面的信息架构方案

## 5. Negative cases
### Case N1
- user request: 帮我定这个产品的颜色、字体和整体视觉风格，暂时不看交互结构。
- 为什么不该触发 target skill: 这是通用设计方向，不是共享工作台基线
- 正确去向: `project-definition/references/design-foundation.md`
- 错误命中的风险点: 用户提到“产品界面”，但核心要的是视觉方向而不是工作台协作模型

### Case N2
- user request: 请直接改 React 代码，把 sidebar 和 status bar 重构一下。
- 为什么不该触发 target skill: 这是明确实现任务
- 正确去向: `project-implementation` / `frontend-ui-engineering`
- 错误命中的风险点: 提到了 sidebar/status bar，容易误判为定义任务

### Case N3
- user request: 打开本地页面帮我做一轮真实运行态 UI QA，按 P0/P1/P2 输出问题清单。
- 为什么不该触发 target skill: 这是实施/验证侧 UI QA，而不是定义共享工作台方案
- 正确去向: `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`
- 错误命中的风险点: 同样提到 shared workspace、status bar、agent panel，表面题材相近

### Case N4
- user request: 先帮我把这个后台同步流程的状态机、超时和补偿逻辑设计出来，界面以后再说。
- 为什么不该触发 target skill: 这是核心流程/状态机定义，不是工作台界面基线
- 正确去向: `project-definition/references/core-flow-design.md`
- 错误命中的风险点: 提到状态和恢复，容易和 workspace state model 混淆

## 6. Verifier design
- 主判据（black-box）:
  - positive case 是否把任务识别为“共享工作台定义问题”
  - 是否出现“真实运行态优先”的行为或明确要求
  - 输出是否围绕工作台信息架构、状态反馈、review-first、恢复 UX，而不是泛泛 UI 美化
- 次判据（辅助证据）:
  - 是否区分用户层术语与工程实现术语
  - 是否强调当前工作对象、下一步动作、确认边界
  - 是否指出 raw element 导航、状态重复、弱反馈、空状态无引导等工作台典型问题
- 允许接受的文件名级证据:
  - `agent-human-workspace-baseline.md`
  - `project-definition`
  - `design-foundation.md`（仅作为补充，不可替代主命中）
- 允许接受的语义等价表达:
  - shared workspace / 协作工作台 / 人机共用工作台 / agent-human workspace
  - 工作台 / 控制台 / studio / cockpit / editor shell / 复杂后台
  - UE / 交互设计 / 信息架构 / 任务导向界面 / 主操作 / 待处理区 / 主真相区
  - review-first / staged patch / 待审阅变更 / apply-reject gate
  - 恢复 UX / 状态反馈 / 信息架构 / 当前工作对象 / 下一步动作
- 明确禁止依赖的窄字面量:
  - 不要求必须点名 `agent-human-workspace-baseline`
  - 不要求必须原样写出 `review-first`
  - 不要求必须按固定标题输出，但必须出现等价结构
- 明确禁止使用的 self-report 判据:
  - 不能只因为 agent 说“我会用 project-definition”就算通过
  - 不能只因为 agent 说“先看真实界面”但后续没有任何运行态证据或设计结构就算通过

## 7. Run plan
- 运行前要读取的文件:
  - /Users/handy/.claude/skills/project-definition/SKILL.md
  - /Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md
  - /Users/handy/.claude/skills/project-definition/references/design-foundation.md
  - /Users/handy/.claude/skills/project-definition/references/core-flow-design.md
  - /Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md
- 任务放在哪个 task 目录:
  - 建议建立 `tasks/agent-human-workspace-baseline-trigger-adoption/`，按 positive / negative 分 task
- 是否需要 positive / negative 成对任务: 是
- 需要产出的结果文件:
  - results.tsv
  - per-task result.json
  - trajectory.json
  - summary.md
- 失败后如何最小定位:
  - 先看 route 是否停在 `project-definition` 但没进入目标 reference
  - 再看是否退化成普通 design-foundation 风格建议
  - 再看是否跳去了 implementation / QA
  - 最后看是否只讲原则、没有 adopt 真实运行态优先 workflow

## 8. Result classification
- 什么算 just enough:
  - positive case 中能识别共享工作台定义任务，并采用真实运行态优先 + 工作台信息架构输出
  - negative case 中能避免把纯视觉、纯实现、纯 QA、纯流程定义误判为本 reference
- 什么算 too broad:
  - 普通 UI 设计、前端实现、浏览器 QA、流程状态机也被硬套本 reference
- 什么算 too weak:
  - 只有用户明确说“agent-human workspace”时才触发
  - 用户说 shared workspace / patch review / recovery UX 时仍只给通用设计建议
  - 用户说 UE / 交互设计 / 信息架构 / 控制台 / editor / 复杂后台 时，仍被 `design-foundation.md` 吸走
- 什么算 ambiguous:
  - route 看似正确，但输出退化成普通设计建议
  - 提到真实界面，但没有基于运行态证据展开
  - 同时混合定义和实现，边界不清

## 9. Iteration rule
- 如果 too broad，优先改哪里:
  - 收窄 `project-definition/SKILL.md` 中该路由行的触发词
  - 强化“不是普通视觉风格 / 不是纯实现 / 不是纯 QA”的负边界
  - 在 reference 中增加 should-not-trigger 对照
- 如果 too weak，优先改哪里:
  - 扩大 description 中对 shared workspace / patch review / recovery UX / status bar / agent panel 的自然表达覆盖
  - 增加更多不显式说“workspace”但语义上属于工作台的正例
- 如果 ambiguous，先检查什么:
  - verifier 是否只判定 route，没有判 adopt
  - 正例是否过于依赖 `agent-human` 字面量
  - `design-foundation.md` 是否吸走了本应属于目标 reference 的请求
- 是否需要最小重跑: 是，每次只改一类变量（route 文案 / 正负例 / workflow cues）再重跑

---

## Related

| 文件 | 作用 |
|---|---|
| `/Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md` | 目标定义侧 reference |
| `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md` | 相邻的实施/QA 侧子 skill |
| `/Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md` | 相邻 benchmark brief，用于交叉检查边界 |
| `/Users/handy/.claude/skills/project-definition/validation/workspace-ui-skills-benchmark-run-request.md` | 统一 benchmark 执行请求 |
