# Skill Benchmark Brief — project-definition routing light pass

> **last_verified: 2026-05-16**
> purpose: 以最小任务集验证 `project-definition/SKILL.md` 本轮新增路由是否能正确命中新补强的 references

## 0. Experiment meta
- experiment name: project-definition-routing-light-pass-1
- date: 2026-05-16
- owner: pi agent
- target skill: project-definition
- target files:
  - /Users/handy/.claude/skills/project-definition/SKILL.md
  - /Users/handy/.claude/skills/project-definition/references/user-experience-elements-five-layers.md
  - /Users/handy/.claude/skills/project-definition/references/discovery.md
  - /Users/handy/.claude/skills/project-definition/references/research.md
  - /Users/handy/.claude/skills/project-definition/references/spec-and-scope.md
  - /Users/handy/.claude/skills/project-definition/references/core-flow-design.md
  - /Users/handy/.claude/skills/project-definition/references/feature-map-and-prioritization.md
  - /Users/handy/.claude/skills/project-definition/references/ui-ux-product-design.md
  - /Users/handy/.claude/skills/project-definition/references/design-foundation.md
  - /Users/handy/.claude/skills/project-definition/validation/project-definition-routing-light-benchmark-brief.md
- related framework card: none
- benchmark type: routing + light adopt

## 1. Goal
- 本轮要验证什么:
  - `project-definition/SKILL.md` 新补强的主路由，是否能把用户请求稳定分发到以下目标 references：
    - `user-experience-elements-five-layers.md`
    - `research.md`
    - `core-flow-design.md`
    - `feature-map-and-prioritization.md`
    - `ui-ux-product-design.md`
  - agent 是否不仅停留在 `project-definition` 顶层，而是出现与目标 reference 对应的 adopt 信号
- 成功标准:
  - 9 个 case 中 route correctness ≥ 8/9
  - 5 个 positive case 中至少 4 个出现目标 reference 对应的 adopt 信号
  - 不出现把“明确写代码”或“纯视觉风格”误吸入定义侧主路由的 critical false positive
- 本轮不验证什么:
  - 不验证最终方案质量
  - 不验证浏览器/实现能力
  - 不验证所有 project-definition references，只验证本轮新增或显著补强的入口

## 2. Baseline contract
- baseline repo / worktree: AutoAgent baseline 或当前 skills benchmark worktree
- output dir: `/Users/handy/autoagent-outputs/project-definition-routing-light-benchmark-v1/`
- 是否允许修改 harness: 否
- 是否允许修改 task / verifier: 是
- 固定不改的变量:
  - 模型
  - provider
  - 基础 harness
  - 顶层 skill 拓扑（`project-definition` / `project-implementation`）

## 3. Target skill contract
- 期望 should-trigger 的请求类型:
  - 产品规划 / 做什么 / 为什么做 / 怎么取舍 / 五层法
  - 用户研究整合 / personas / 用户细分 / 一线反馈 / request vs need
  - 概念模型 / 交互结构 / 信息架构的结构层定义
  - 功能规划 / MVP / 依赖与优先级
  - 复杂后台 / 控制台 / editor / workspace 的交互设计、导航设计、信息设计
- 期望 should-not-trigger 的请求类型:
  - 明确要求直接写代码
  - 纯视觉风格 / 配色 / 字体 / 品牌表达
  - 纯运行态 UI QA
- 最容易混淆的相邻 skill / reference:
  - `project-implementation`
  - `design-foundation.md`
  - `spec-and-scope.md`
  - `architecture-and-data.md`
  - `visual-feedback-ui-qa`
- 命中后应采用的 workflow:
  - 先判断用户当前要的定义产物
  - 再进入对应 reference，而不是停留在空泛的 project-definition 总论
  - 输出中出现目标 reference 的典型结构或判断方式

## 4. Positive cases
### Case P1 — 五层法 / 产品规划总纲
- user request: 先别写 PRD，我想先从五层法看这个产品：为什么做、这版做什么、信息怎么组织、界面怎么承载。帮我把产品规划和取舍顺序梳理出来。
- 为什么应该触发 target skill: 用户显式在问跨层产品定义，而不是单点 spec 或单点 UI
- 期望 route: `user-experience-elements-five-layers.md`
- 期望 use signal:
  - 出现战略 / 范围 / 结构 / 框架 / 表现的跨层组织
  - 明确“先为什么做，再定义做什么，再谈界面承载”
- 允许的自然语言变体:
  - 从五层法看这个方案
  - 先梳理做什么和怎么取舍，不急着写页面
  - 这个产品规划应该按哪几层来收敛

### Case P2 — 研究 / personas / 一线反馈 / request vs need
- user request: 我这边有很多 support、销售和访谈反馈。请帮我整理研究结论，做用户细分，抽 1-2 个 personas，并区分用户口中要的功能和他们真正需求。
- 为什么应该触发 target skill: 这是 research synthesis，不是 discovery 发散，也不是 spec 写作
- 期望 route: `research.md`
- 期望 use signal:
  - 出现 segments / personas / evidence / frontline signals
  - 明确区分 request signal 与 underlying need
- 允许的自然语言变体:
  - 帮我做用户研究综述
  - 一线反馈太散了，帮我抽人物角色和核心需求
  - 别直接记 feature request，先拆真实需求

### Case P3 — 结构层 / 概念模型 / 交互结构
- user request: 这个 B2B 控制台现在最大的问题不是视觉，而是概念模型混乱。请先定义对象关系、交互结构和异常恢复顺序，先别聊技术架构。
- 为什么应该触发 target skill: 用户要的是结构层，不是后端架构，也不是视觉设计
- 期望 route: `core-flow-design.md`
- 期望 use signal:
  - 出现概念模型、对象关系、主流程/异常流程、恢复顺序
  - 明确区分交互结构与技术架构
- 允许的自然语言变体:
  - 帮我先把结构层理清
  - 先定义这个控制台的交互结构
  - 这不是配色问题，是对象和流程组织问题

### Case P4 — 功能规划 / MVP / 依赖与优先级
- user request: 现在想法很多，你先帮我做这版 MVP 的功能规划，明确哪些先做、哪些不做、依赖顺序和优先级怎么排。
- 为什么应该触发 target skill: 用户要的是功能规划与取舍，而不是宽泛 discovery 或完整 spec
- 期望 route: `feature-map-and-prioritization.md`
- 期望 use signal:
  - 出现 MVP / should build now / later / dependency / priority
  - 明确范围切分与排序依据
- 允许的自然语言变体:
  - 帮我排功能优先级
  - 这版先做哪些功能
  - 做个 MVP 拆解和依赖排序

### Case P5 — UI/UX / 导航设计 / 信息设计
- user request: 我不要配色建议。请你从 UE / 交互设计角度，重构这个复杂后台的导航设计、信息设计和内容层级，让用户知道先看哪块、先做什么。
- 为什么应该触发 target skill: 这是框架层与信息承载问题，不是纯视觉风格
- 期望 route: `ui-ux-product-design.md`
- 期望 use signal:
  - 出现主真相区、主操作区、待处理区、导航层级、内容优先级等结构化输出
  - 明确不是在做配色/风格建议
- 允许的自然语言变体:
  - 重构这个控制台的导航和信息层级
  - 我不要美化，我要交互和信息架构方案
  - 帮我做复杂界面的 UE 方案

## 5. Negative / contrast cases
### Case N1 — 纯视觉风格
- user request: 先帮我定颜色、字体和整体视觉气质，暂时不看交互结构。
- 为什么不该触发目标正例路由: 这是视觉基础方向，不该被 UI/UX 结构路由或五层总纲吸走
- 正确去向: `design-foundation.md`
- 错误命中的风险点: 用户也在谈“界面”，但目标是纯视觉

### Case N2 — 明确代码实现
- user request: 不用写方案了，直接改 React 代码把 sidebar 和导航重构出来。
- 为什么不该触发 target skill: 主输出物是代码实现
- 正确去向: `project-implementation`
- 错误命中的风险点: 提到了 sidebar / 导航，容易误吸进定义侧 UI/UX 路由

### Case N3 — 纯 PRD / spec 写作
- user request: 需求已经确认过了，你直接帮我把 PRD 和 acceptance criteria 写出来。
- 为什么不该触发五层法或 research 路由: 用户要的是明确 spec 产物，不是再做跨层规划或研究整理
- 正确去向: `spec-and-scope.md`
- 错误命中的风险点: 仍属于 project-definition，但 reference 不应过宽泛化

### Case N4 — 纯运行态 UI QA
- user request: 打开页面做一轮真实运行态 UI QA，按 P0/P1/P2 列问题，不用给我产品定义方案。
- 为什么不该触发 target skill: 这是实施/验证侧 QA，不是定义侧路由
- 正确去向: `visual-feedback-ui-qa` / `project-implementation`
- 错误命中的风险点: 题材仍是 UI，容易被 UI/UX 定义入口误吸

## 6. Verifier design
- 主判据（black-box）:
  - 是否把 case 分到正确 reference 或正确相邻顶层 skill
  - positive case 是否出现对应 reference 的 adopt 信号，而不是空泛停留在 project-definition 总论
- 次判据（辅助证据）:
  - P1 是否出现跨层组织
  - P2 是否出现 personas / segments / frontline / request-vs-need
  - P3 是否出现概念模型 / 结构 / 异常恢复，而非技术架构
  - P4 是否出现 MVP / priority / dependency / not-now
  - P5 是否出现导航 / 信息设计 / 主真相区 / 待处理区
- 允许接受的文件名级证据:
  - `user-experience-elements-five-layers.md`
  - `research.md`
  - `core-flow-design.md`
  - `feature-map-and-prioritization.md`
  - `ui-ux-product-design.md`
  - `spec-and-scope.md`
  - `design-foundation.md`
  - `project-implementation`
- 允许接受的语义等价表达:
  - 五层法 / 战略层 / 范围层 / 结构层 / 框架层 / 表现层
  - personas / 人物角色 / 用户细分 / 一线反馈 / frontline signals
  - request vs need / 功能请求 vs 真实需求
  - 概念模型 / 交互结构 / 对象关系 / 主流程与异常流程
  - MVP / 优先级 / 依赖顺序 / 先做后做
  - 导航设计 / 信息设计 / 内容层级 / 主真相区 / 待处理区
- 明确禁止依赖的窄字面量:
  - 不要求必须原样说出某个 reference 文件名
  - 不要求必须出现固定标题
- 明确禁止使用的 self-report 判据:
  - 不能只因为 agent 说“我会使用 project-definition”就算通过
  - 不能只因为 agent 说“这是 research”但没有对应 adopt 结构就算通过

## 7. Run plan
- 运行前要读取的文件:
  - /Users/handy/.claude/skills/project-definition/SKILL.md
  - /Users/handy/.claude/skills/project-definition/references/user-experience-elements-five-layers.md
  - /Users/handy/.claude/skills/project-definition/references/research.md
  - /Users/handy/.claude/skills/project-definition/references/core-flow-design.md
  - /Users/handy/.claude/skills/project-definition/references/feature-map-and-prioritization.md
  - /Users/handy/.claude/skills/project-definition/references/ui-ux-product-design.md
  - /Users/handy/.claude/skills/project-definition/references/spec-and-scope.md
  - /Users/handy/.claude/skills/project-definition/references/design-foundation.md
  - /Users/handy/.claude/skills/project-definition/validation/project-definition-routing-light-benchmark-brief.md
- 任务放在哪个 task 目录:
  - 建议建立 `tasks/project-definition-routing-light/`，按 `positive/` 与 `negative/` 分组
- 是否需要 positive / negative 成对任务: 是
- 推荐最小任务数:
  - 5 个 positive
  - 4 个 contrast / negative
- 需要产出的结果文件:
  - `results.tsv`
  - `summary.md`
  - `per-task result.json`
  - `trajectory.json`
- 失败后如何最小定位:
  - 先看是否停在 `project-definition` 顶层，没有进入目标 reference
  - 再看是否被相邻 reference 吸走（特别是 `spec-and-scope.md`、`design-foundation.md`）
  - 最后看是否 route 对了，但 adopt 信号太弱

## 8. Result classification
- 什么算 just enough:
  - 大多数 case 正确分流
  - 正例中能看到与目标 reference 对应的 adopt 结构
  - 负例中不把实现、纯视觉、纯 QA 吸进来
- 什么算 too broad:
  - 五层法或 UI/UX 路由把 PRD、纯视觉、纯实现也大量吸走
  - research 路由把普通 discovery 发散或 spec 写作吞掉
- 什么算 too weak:
  - 用户明说产品规划 / personas / 概念模型 / 导航设计，仍只给 generic 定义建议
  - agent 停留在顶层 `project-definition`，没有真正进入目标 reference
- 什么算 ambiguous:
  - route 看起来对，但 adopt 只有一句话标签，没有对应结构
  - 既像 spec 又像五层规划，边界没有说清

## 9. Iteration rule
- 如果 too broad，优先改哪里:
  - 收窄 `project-definition/SKILL.md` 中对应路由行
  - 增强相邻 negative wording，特别是纯视觉 / 纯实现 / 纯 PRD 的排除
- 如果 too weak，优先改哪里:
  - 扩充路由中的自然表达覆盖，尤其是“产品规划、人物角色、导航设计、概念模型、一线反馈”等用户真实说法
  - 在目标 reference 增加更清晰的 adopt cues
- 如果 ambiguous，先检查什么:
  - verifier 是否只判 route，没有判 adopt
  - `spec-and-scope.md` 与五层法总纲是否边界过近
  - `design-foundation.md` 是否吸走本应属于 `ui-ux-product-design.md` 的请求
- 是否需要最小重跑: 是，每次只改一类变量（route wording / case wording / verifier matcher）再重跑

---

## Related

| 文件 | 作用 |
|---|---|
| `/Users/handy/.claude/skills/project-definition/SKILL.md` | 本轮被验证的主路由 |
| `/Users/handy/.claude/skills/project-definition/references/user-experience-elements-five-layers.md` | 新增的跨层产品规划总纲 |
| `/Users/handy/.claude/skills/project-definition/references/research.md` | personas / frontline / request-vs-need 主入口 |
| `/Users/handy/.claude/skills/project-definition/references/core-flow-design.md` | 概念模型 / 交互结构 / 异常恢复 |
| `/Users/handy/.claude/skills/project-definition/references/feature-map-and-prioritization.md` | MVP / 功能规划 / 优先级 |
| `/Users/handy/.claude/skills/project-definition/references/ui-ux-product-design.md` | 导航设计 / 信息设计 / 复杂界面 UE |
| `/Users/handy/.claude/skills/project-definition/references/spec-and-scope.md` | 对照 reference：纯 PRD / spec |
| `/Users/handy/.claude/skills/project-definition/references/design-foundation.md` | 对照 reference：纯视觉方向 |
