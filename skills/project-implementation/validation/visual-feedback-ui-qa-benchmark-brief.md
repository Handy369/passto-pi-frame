# Skill Benchmark Brief — visual-feedback-ui-qa

> **last_verified: 2026-05-15**

## 0. Experiment meta
- experiment name: visual-feedback-ui-qa-trigger-adoption
- date: 2026-05-15
- owner: pi agent
- target skill: project-implementation
- target files:
  - /Users/handy/.claude/skills/project-implementation/SKILL.md
  - /Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md
  - /Users/handy/.claude/skills/browser-runtime-observation/SKILL.md
  - /Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md
  - /Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md
- related framework card: none (subskill benchmark brief)
- benchmark type: routing + skill-use

## 1. Goal
- 本轮要验证什么:
  - 当用户请求对真实界面做 **可用性测试 / visual feedback QA / 运行态交互验收** 时，`project-implementation` 是否能正确路由到独立子 skill `visual-feedback-ui-qa`
  - 命中后，agent 是否采用“**真实运行态优先，而不是代码存在性优先**”的验证 workflow
  - agent 是否能把观察结果输出成带严重度、证据、修复建议的整改清单，而不是泛泛评论
- 成功标准:
  - positive case 中，agent 会打开真实页面或明确要求真实运行态证据，而不是只看代码/DOM/文档
  - positive case 中，agent 输出 P0/P1/P2 或等价严重度的 findings，且每项包含 surface、用户可见证据、影响、修复建议
  - negative case 中，agent 不会把纯定义任务、纯代码实现或纯浏览器技术调试误判为本子 skill
- 本轮不验证什么:
  - 不验证最终修复代码质量
  - 不验证更深的性能 profiling 或内存诊断
  - 不验证审美偏好是否一致

## 2. Baseline contract
- baseline repo / worktree: AutoAgent baseline 或当前 skills benchmark worktree
- output dir: 独立实验输出目录，例如 /Users/handy/autoagent-outputs/visual-feedback-ui-qa-trigger-adoption/
- 是否允许修改 harness: 否
- 是否允许修改 task / verifier: 是
- 固定不改的变量:
  - 模型
  - provider
  - 基础 harness
  - 现有 `project-implementation` 顶层路由

## 3. Target skill contract
- 期望 should-trigger 的请求类型:
  - 打开真实页面做 UI QA
  - 验证 visual feedback / 状态反馈 / 恢复 UX 是否用户感知得到
  - 检查 header / sidebar / status bar / agent panel 的可用性问题
  - 输出基于运行态观察的 P0/P1/P2 整改清单
- 期望 should-not-trigger 的请求类型:
  - 纯共享工作台方案定义
  - 纯前端实现或直接改代码
  - 纯技术型 DevTools 调试（网络、性能、内存）
  - 只问视觉风格方向、不要求运行态 QA
- 最容易混淆的相邻 skill:
  - `browser-runtime-observation`
  - `frontend-ui-engineering`
  - `project-definition/references/agent-human-workspace-baseline.md`
  - `project-definition/references/design-foundation.md`
  - `debugging-and-error-recovery`
- 命中后应采用的 workflow:
  - 先确认任务是“实施/验证侧 UI QA”，不是定义方案或写代码
  - 进入真实页面验证首屏、点击反馈、状态区、空状态、窄屏
  - 用“用户是否感知得到”作为主判据，而不是“代码里是否有该状态”
  - 产出结构化 findings、严重度与最小修复建议

## 4. Positive cases
### Case P1
- user request: 请不要只看代码，直接打开本地页面做一轮真实运行态 UI QA。重点检查 header、sidebar、status bar、agent panel 是否真的帮助决策，并按 P0/P1/P2 输出问题清单。
- 为什么应该触发 target skill: 用户明确要真实运行态 UI QA 与严重度清单，不是定义方案也不是实现代码
- 期望 use signal:
  - 打开页面或明确要求可访问运行态
  - 输出带严重度、surface、证据、修复建议的问题表
  - 检查首屏任务导向、点击反馈、状态去重、空状态引导
- 允许的自然语言变体:
  - 帮我做一轮共享工作台可用性测试
  - 看看这个界面的交互反馈到底够不够
  - 用真实页面验证状态栏和侧栏是否真的可用

### Case P2
- user request: 这个工作台说自己支持 save、restore、patch review 和 stale handling。请在真实界面里验证这些状态是不是用户感知得到，而不是只因代码支持就判通过。
- 为什么应该触发 target skill: 这是 visual feedback / 状态感知验证的典型请求
- 期望 use signal:
  - 明确“功能存在 ≠ 用户感知得到”
  - 检查 saved / pending review / stale / focus success 等状态
  - 输出 pass/fail 或 finding 级结果
- 允许的自然语言变体:
  - 帮我验一下这些状态提示到底有没有被用户看见
  - 检查 patch review 和恢复 UX 是否清楚
  - 别只看代码，验证交互反馈是否成立

### Case P3
- user request: 打开真实页面看一下 Recent items 点击之后用户是否真的知道已经聚焦成功，再顺带检查窄屏下主操作有没有被埋掉。
- 为什么应该触发 target skill: 这是典型的运行态交互反馈 + 响应式可用性验收
- 期望 use signal:
  - 做最小交互验证
  - 检查聚焦反馈与窄屏信息优先级
  - 输出明确的 pass/fail 或 finding
- 允许的自然语言变体:
  - 帮我验证点击反馈是不是黑箱
  - 看看移动端下主操作是否还可见
  - 做一轮 focus/feedback QA

## 5. Negative cases
### Case N1
- user request: 我想先定义这个 agent-human workspace 的信息架构和状态模型，暂时不做浏览器验证。
- 为什么不该触发 target skill: 这是定义任务，不是实施/验证侧 QA
- 正确去向: `project-definition/references/agent-human-workspace-baseline.md`
- 错误命中的风险点: 同样提到 workspace、状态模型、交互反馈，题材相近

### Case N2
- user request: 请直接改代码，把 status bar 信息收敛一下，再给 sidebar 增加选中态。
- 为什么不该触发 target skill: 这是明确实现任务
- 正确去向: `project-implementation` / `frontend-ui-engineering`
- 错误命中的风险点: 提到 status bar / sidebar / 选中态，容易让 QA reference 抢走实现任务

### Case N3
- user request: 用 DevTools 看一下这个页面的网络 waterfall 和 LCP，有没有性能瓶颈。
- 为什么不该触发 target skill: 这是性能/网络调试，不是 visual feedback QA
- 正确去向: `browser-runtime-observation` / `performance-optimization`
- 错误命中的风险点: 都要求打开真实页面，表面形式相似

### Case N4
- user request: 帮我给这个管理后台定一套更现代的视觉风格和版式方向，不需要你测运行态。
- 为什么不该触发 target skill: 这是设计方向定义，不是 UI QA
- 正确去向: `project-definition/references/design-foundation.md`
- 错误命中的风险点: 同样涉及界面，但不是验证工作流

## 6. Verifier design
- 主判据（black-box）:
  - positive case 是否采用真实运行态验证，而不是只停留在代码/文档推测
  - 输出是否包含 severity + user-visible evidence + why it matters + recommended fix
  - 是否以“用户是否感知得到”为判据，而不是代码存在性
- 次判据（辅助证据）:
  - 是否检查首屏语境、点击反馈、状态去重、空状态引导、响应式稳定性
  - 是否出现 pass/fail、partial、finding table 等可观察 QA 结构
  - 是否把 shared workspace 的状态反馈问题说成具体 surface 问题
- 允许接受的文件名级证据:
  - `visual-feedback-ui-qa`
  - `project-implementation`
  - `browser-runtime-observation`（可作为工具性补充，不可替代目标子 skill）
- 允许接受的语义等价表达:
  - 真实运行态 / 浏览器里验证 / 实际页面检查 / live UI QA
  - 用户可感知 / 看得见 / 能不能知道 / 不是黑箱
  - findings / severity / pass-fail / evidence / recommended fix
- 明确禁止依赖的窄字面量:
  - 不要求必须写出 `P0/P1/P2`，接受 High/Medium/Low 或等价严重度
  - 不要求必须点名 `visual-feedback-ui-qa`
  - 不要求必须原样写 `user-visible evidence`，接受同义表述
- 明确禁止使用的 self-report 判据:
  - 不能只因为 agent 说“我做了 QA”就算通过
  - 不能只因为 agent 说“代码里有这个功能所以应该没问题”就算通过

## 7. Run plan
- 运行前要读取的文件:
  - /Users/handy/.claude/skills/project-implementation/SKILL.md
  - /Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md
  - /Users/handy/.claude/skills/browser-runtime-observation/SKILL.md
  - /Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md
  - /Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md
- 任务放在哪个 task 目录:
  - 建议建立 `tasks/visual-feedback-ui-qa-trigger-adoption/`，按 positive / negative 分 task
- 是否需要 positive / negative 成对任务: 是
- 需要产出的结果文件:
  - results.tsv
  - per-task result.json
  - trajectory.json
  - summary.md
- 失败后如何最小定位:
  - 先看 route 是否停在 `project-implementation` 但没进入目标子 skill
  - 再看是否退化成普通浏览器调试或普通设计建议
  - 再看是否只谈代码存在性、没有运行态证据
  - 最后看 findings 是否缺严重度与修复建议

## 8. Result classification
- 什么算 just enough:
  - positive case 中能采用真实运行态 QA workflow，并产出结构化 findings
  - negative case 中能避免把定义、实现、性能调试误判为本子 skill
- 什么算 too broad:
  - 纯设计定义、纯实现改代码、纯性能 DevTools 调试都被硬套成 visual feedback QA
- 什么算 too weak:
  - 只有用户显式说“UI QA”时才触发
  - 用户说“别只看代码，验证用户能否感知状态”时仍只给泛泛评论或去做定义任务
- 什么算 ambiguous:
  - route 看似对，但只做了浏览器打开，没有形成 QA findings
  - 使用了 DevTools/浏览器，但输出退化成设计建议或实现建议
  - 提到 severity，但无证据与修复建议

## 9. Iteration rule
- 如果 too broad，优先改哪里:
  - 收窄 `project-implementation/SKILL.md` 中该路由行的任务表述
  - 强化“不是纯定义、不是纯实现、不是纯性能调试”的边界
  - 增加 negative cases 覆盖 DevTools/实现/定义相邻场景
- 如果 too weak，优先改哪里:
  - 扩大 description 中对“真实运行态 UI QA / 用户感知 / 状态反馈 / 可用性测试 / 交互验收”的自然表达覆盖
  - 增加不显式说 QA 但语义明确属于验证的正例
- 如果 ambiguous，先检查什么:
  - verifier 是否只看是否打开了页面，没有判定 findings 质量
  - `browser-runtime-observation` 是否被误用来吸走本应属于目标子 skill 的请求
  - 正例是否写得过于依赖 `P0/P1/P2` 字面量
- 是否需要最小重跑: 是，每次只改一类变量（route 文案 / 正负例 / adopt 判据）再重跑

---

## Related

| 文件 | 作用 |
|---|---|
| `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md` | 目标实施/QA 侧子 skill |
| `/Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md` | 相邻的定义侧 reference |
| `/Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline-benchmark-brief.md` | 相邻 benchmark brief，用于交叉检查边界 |
| `/Users/handy/.claude/skills/project-definition/references/workspace-ui-skills-benchmark-run-request.md` | 统一 benchmark 执行请求 |
