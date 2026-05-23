# Skill Framework Card — subagent-guide

> **last_verified: 2026-05**

## 0. Meta
- owner: pi agent
- date: 2026-05-15
- related project / repo: /Users/handy/.claude/skills/subagent-guide
- target skill path: /Users/handy/.claude/skills/subagent-guide/SKILL.md
- related adjacent skills:
  - project-implementation
  - code-review-and-quality
  - debugging-and-error-recovery
  - planning-and-task-breakdown
  - incremental-implementation

## 1. Skill identity
- skill name: subagent-guide
- 一句话定位: 判断当前任务是否适合委派或并行，并指导如何安全地使用 subagent 完成拆分、隔离与结果回收。
- 主工作流: 先判断是否值得委派 → 再选 spawn / fork → 再定义自包含子任务 → 再回收与整合结果。
- 主输出物: delegation plan / subagent task definitions / parallel execution pattern / mode selection guidance
- 命中后第一步应做什么: 先判断当前任务是否存在 2 个以上独立 workstream，或是否需要独立第二意见 / 上下文隔离。

## 2. Primary boundary
- should-trigger 的核心任务类型:
  - 可拆成多个独立子任务的复杂工作
  - 适合并行推进的多文件 / 多方案 / 多结果分析
  - 需要隔离实现 / review / 验证 的任务
  - 需要独立第二意见或上下文隔离的任务
- should-trigger 的典型用户表达 1: 把这几个部分并行处理一下，再汇总结论。
- should-trigger 的典型用户表达 2: 一个 agent 写实现，另一个 agent 做 review。
- should-trigger 的典型用户表达 3: 这几个日志/文件分别看一下，最后统一汇报。

## 3. Adjacent exclusions
- should-not-trigger 的相邻任务类型 1: 单步小任务、读一个文件马上回答
- 应转交给哪个 skill / workflow: 当前 agent 直接处理，不需要调用任何委派工作流
- 为什么容易混淆: 用户可能会说“看一下”“检查一下”，但任务实际上太小，拆分收益为负

- should-not-trigger 的相邻任务类型 2: 强串行实现任务，每一步都依赖上一步刚编辑的状态
- 应转交给哪个 skill / workflow: project-implementation / incremental-implementation，按串行切片推进
- 为什么容易混淆: 任务看起来很大，但内部高度耦合，不适合并行

- should-not-trigger 的相邻任务类型 3: 用户只是要方案拆解、排期、实施计划，并不要求委派执行
- 应转交给哪个 skill / workflow: planning-and-task-breakdown 或 project-definition
- 为什么容易混淆: “拆分任务”既可能指产品/实施规划，也可能指 subagent 委派，需要区分是否真要把工作交给子 agent 执行

## 4. Language surface
- 高信号动作词:
  - 并行
  - 并发
  - 分别检查
  - 分配给子 agent
  - 拆成几个任务
  - 委派
  - 隔离 review
  - 第二意见
  - 各自分析再汇总
- 高信号名词 / 文件类型 / 工具名:
  - subagent
  - 子 agent
  - spawn
  - fork
  - reviewer
  - coder
  - tasks 数组
  - workstream
- 2-4 个语义等价表达:
  - 并行处理 / 并发处理 / 分头处理 / 各自推进
  - 分配给 subagent / 分给子 agent / 委派出去 / 拆给不同 agent
  - 独立第二意见 / fresh-context review / 隔离审查 / 交叉验证
- 明确不要使用的过宽表述:
  - 任何复杂任务都应该用 subagent
  - 只要任务大就一定并行
  - 默认先委派再说
- 容易导致误吸的模糊说法:
  - 看一下这个问题
  - 帮我分析一下
  - 拆分一下任务（但其实只是做 planning）

## 5. Use signal
- agent 命中后应采用的 workflow:
  - 明确说明是否值得委派
  - 给出拆分依据（独立性 / 隔离性 / 协调成本）
  - 选择 spawn 或 fork
  - 必要时实际调用 subagent（单个或并行 `tasks: [...]`）
- 命中后应引用的文档 / 文件:
  - /Users/handy/.claude/skills/subagent-guide/SKILL.md
  - 如果要 benchmark，则引用 benchmark-brief.md
- 哪些输出词 / 动作能证明真的 adopt 了这个 skill:
  - 显式判断“这项工作可并行 / 不值得委派”
  - 明确区分 spawn / fork
  - 给出自包含子任务定义
  - 实际产生 subagent 工具调用，尤其是 parallel `tasks: [...]`
- 哪些表现说明只是 hit 了名字但没有 use:
  - 只说“可以用 subagent”，但没有拆分依据
  - 没判断是否并行值得
  - 没给 mode 选择原因
  - 没产生委派动作，也没给出不委派的明确理由

## 6. Structure draft
- SKILL.md 是否需要 Decision Tree: 是，需要先判断是否值得委派
- 是否需要 references/: 暂不强制
- 是否需要 scripts/: 否
- 是否需要 shared resources: 否
- 是否需要 Quick Reference: 可选
- 是否需要 Fallback chain: 是，至少要有“不值得委派则当前 agent 直接完成”的降级路径

## 7. Evidence plan
- positive case 1: 用户要求“把这 4 个文件分别审一下，然后汇总风险”
- positive case 2: 用户要求“一个 agent 写实现，另一个 agent 做 review”
- negative case 1: 用户要求“帮我改这一行文案”
- negative case 2: 用户要求“这个任务每一步都依赖上一步刚编辑的结果，先别拆开”
- positive case 的 use signal:
  - 说明适合并行/委派
  - 明确拆成多个子任务
  - 合理选择 spawn 或 fork
  - 有实际 subagent 工具调用或等价明确委派计划
- negative case 的正确去向:
  - 当前 agent 直接做
  - 或走 project-implementation / incremental-implementation 的串行工作流
- verifier 主判据:
  - 黑盒行为是否做出正确的“委派 / 不委派”决策
  - 如果应委派，是否正确拆分并选择 mode
  - 如果不应委派，是否明确拒绝不必要并行
- verifier 次判据:
  - 是否提到 subagent-guide / spawn / fork / parallel tasks
  - 是否给出协调成本与任务独立性判断
- 不允许依赖的窄字面量:
  - 不要求必须出现“subagent-guide”这个名字
  - 不要求必须写固定短语如“independent workstreams”
  - 不要求必须使用完整路径或固定 agent 名称

## 8. Release decision
- 什么时候允许生成第一版 Skill: 当前版本已可发布，只要 frontmatter、正反边界、并行场景和 mode 选择全部明确
- 什么时候必须先补边界分析: 当“任务拆分”与“规划拆分”容易混淆时，必须先区分是执行委派还是纯 planning
- 什么时候必须交给 AutoAgent 做 benchmark: 当目标是提升默认触发率，尤其是希望 agent 在用户未显式点名时也主动想到 subagent 时
