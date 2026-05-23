# Skill Benchmark Brief — subagent-guide

> **last_verified: 2026-05**

## 0. Experiment meta
- experiment name: subagent-guide-trigger-rate
- date: 2026-05-15
- owner: pi agent
- target skill: subagent-guide
- target files:
  - /Users/handy/.claude/skills/subagent-guide/SKILL.md
  - /Users/handy/.claude/skills/subagent-guide/framework-card.md
  - /Users/handy/.claude/skills/subagent-guide/benchmark-brief.md
- related framework card: /Users/handy/.claude/skills/subagent-guide/framework-card.md
- benchmark type: routing + skill-use

## 1. Goal
- 本轮要验证什么:
  - `subagent-guide` 是否能在用户**未显式说“用 subagent”**时，仍然被正确触发并采用
  - agent 是否能在适合的任务中主动做“委派 / 并行 / mode 选择”判断
  - agent 是否能在不适合的任务中避免滥用 subagent
- 成功标准:
  - positive case 中，agent 能正确判断适合委派，并给出或执行合理拆分
  - negative case 中，agent 能正确判断不值得委派，并直接执行或说明串行原因
  - 不依赖用户显式提到 `subagent` 才命中
- 本轮不验证什么:
  - 不验证具体 runtime profile 的质量差异
  - 不验证深层嵌套 delegation performance
  - 不验证多轮复杂协作的人类偏好，仅验证路由与 adopt

## 2. Baseline contract
- baseline repo / worktree: AutoAgent baseline 或当前 skills benchmark worktree
- output dir: 独立实验输出目录，例如 /Users/handy/autoagent-outputs/subagent-guide-trigger-rate/
- 是否允许修改 harness: 否
- 是否允许修改 task / verifier: 是
- 固定不改的变量:
  - 模型
  - provider
  - 基础 harness
  - 评测主流程

## 3. Target skill contract
- 期望 should-trigger 的请求类型:
  - 多文件并行分析
  - 多方案并行比较
  - 实现 / review / 验证 分离
  - 独立第二意见
- 期望 should-not-trigger 的请求类型:
  - 小任务
  - 强串行任务
  - 纯 planning 拆分而非执行委派
- 最容易混淆的相邻 skill:
  - planning-and-task-breakdown
  - project-implementation
  - incremental-implementation
  - code-review-and-quality
- 命中后应采用的 workflow:
  - 先判断是否值得委派
  - 再判断是否可并行
  - 再选择 spawn / fork
  - 再写出自包含任务或明确说明不委派原因

## 4. Positive cases
### Case P1
- user request: 这 4 个配置文件分别帮我检查潜在风险，最后汇总成一份结论。
- 为什么应该触发 target skill: 明显存在多个独立分析对象，适合并行回收
- 期望 use signal:
  - 说明这 4 个文件可并行分析
  - 使用 `subagent` 并行 `tasks: [...]`，或至少给出明确并行委派计划
  - 父 agent 最后整合结果
- 允许的自然语言变体:
  - 分别看一下这 4 个文件再汇总
  - 把这几个配置各自检查一下最后统一报告
  - 这 4 份结果分头分析后给我一个总结

### Case P2
- user request: 我想一边让一个 agent 实现修复，一边让另一个 agent 做代码审查，最后你来整合。
- 为什么应该触发 target skill: 明确要求角色分离，适合实现 + review 并行
- 期望 use signal:
  - 正确拆成 coder / reviewer 或等价角色
  - 判断两个子任务相互独立到可并行
  - 给出 mode 选择依据
- 允许的自然语言变体:
  - 一个负责改代码，一个负责 review
  - 并行做实现和审查
  - 分两个 agent 一个写一个查

### Case P3
- user request: 帮我比较两个修复方案哪个更稳，最好分别从可维护性和风险角度独立评估。
- 为什么应该触发 target skill: 这是典型多方案并行探索 + 独立第二意见场景
- 期望 use signal:
  - 把方案 A / B 分开评估
  - 或使用独立 reviewer-style second opinion
  - 父 agent 汇总 tradeoff
- 允许的自然语言变体:
  - 两种方案分别评估一下
  - 分头看 A 和 B 哪个更靠谱
  - 给我两个独立视角再汇总

## 5. Negative cases
### Case N1
- user request: 帮我把 README 里这句话改顺一点。
- 为什么不该触发 target skill: 单步小任务，委派成本明显高于收益
- 正确去向: 当前 agent 直接修改
- 错误命中的风险点: “改一下”可能被误当成可拆分工作，但实际无需并行

### Case N2
- user request: 这个重构要一步一步来，因为每一步都依赖上一步最新代码状态，先不要拆开。
- 为什么不该触发 target skill: 用户已明确说明强串行依赖
- 正确去向: project-implementation / incremental-implementation 的串行切片执行
- 错误命中的风险点: 任务规模看起来较大，容易诱导 agent 机械地并行化

### Case N3
- user request: 先帮我把这个项目拆成 5 个实施阶段，不需要你真的去分配给别的 agent。
- 为什么不该触发 target skill: 这是 planning，不是执行委派
- 正确去向: planning-and-task-breakdown 或 project-definition
- 错误命中的风险点: “拆成 5 个阶段”与“拆成 5 个 subagent 任务”表面相似

## 6. Verifier design
- 主判据（black-box）:
  - positive case 是否做出正确的委派判断，并出现实际 subagent 调用或同等明确可执行的委派计划
  - negative case 是否明确拒绝不必要的委派，并给出串行/直接处理理由
- 次判据（辅助证据）:
  - 是否区分并行与串行
  - 是否区分 spawn 与 fork
  - 是否提到独立性、协调成本、上下文隔离、第二意见等判断依据
- 允许接受的文件名级证据:
  - `subagent-guide/SKILL.md`
  - `subagent-guide`
  - `framework-card.md`
  - `benchmark-brief.md`
- 允许接受的语义等价表达:
  - 并行 / 并发 / 分头处理 / 各自推进
  - 委派 / 分给子 agent / 分配出去 / 交给独立 agent
  - 第二意见 / 独立审查 / fresh-context review / 交叉验证
- 明确禁止依赖的窄字面量:
  - 不要求必须写出 `mode: "spawn"` 字面量，接受“自包含任务用默认模式”之类等价说法
  - 不要求必须出现 `tasks: [...]` 原样文本，只要明确是并行独立子任务即可
  - 不要求必须点名 `subagent-guide` 本身
- 明确禁止使用的 self-report 判据:
  - 不能只因为 agent 说“我用了 subagent skill”就算通过
  - 不能只因为 agent 说“这适合并行”但没有拆分依据就算通过

## 7. Run plan
- 运行前要读取的文件:
  - /Users/handy/.claude/skills/subagent-guide/SKILL.md
  - /Users/handy/.claude/skills/subagent-guide/framework-card.md
  - /Users/handy/.claude/skills/subagent-guide/benchmark-brief.md
- 任务放在哪个 task 目录:
  - 建议建立 `tasks/subagent-guide-trigger-rate/`，按 positive / negative 分 task
- 是否需要 positive / negative 成对任务: 是
- 需要产出的结果文件:
  - results.tsv
  - per-task result.json
  - trajectory.json
  - summary.md
- 失败后如何最小定位:
  - 先看 route 是否命中 `subagent-guide`
  - 再看是否真正 adopt 了“先判断是否值得委派”的 workflow
  - 再看 positive 是否因 matcher 过窄被误判

## 8. Result classification
- 什么算 just enough:
  - positive case 中能主动想到委派/并行并合理拆分
  - negative case 中能避免滥用 subagent
  - 命中后 workflow 与 skill 设计一致
- 什么算 too broad:
  - 小任务、纯 planning、强串行任务也被硬套 subagent
- 什么算 too weak:
  - 用户未明确说“用 subagent”时几乎不触发
  - 只在显式关键词下才想到委派
- 什么算 ambiguous:
  - 提到了可并行，但没有实际拆分或没有清楚说明为何不拆
  - route 看似对，但 adopt 证据不足

## 9. Iteration rule
- 如果 too broad，优先改哪里:
  - 收窄 frontmatter 的 should-trigger
  - 强化“不该触发”的负例边界
  - 增加“planning ≠ delegation”的排除语句
- 如果 too weak，优先改哪里:
  - 扩大 description 中的高信号自然表达
  - 强化“即使用户没点名也该主动评估”的正文表述
  - 增加多文件 / 多方案 / 第二意见等强场景示例
- 如果 ambiguous，先检查什么:
  - verifier 是否过度依赖字面量
  - 是否只 hit 了 skill 名称但没 adopt workflow
  - use signal 是否设计得不够可观察
- 是否需要最小重跑: 是，每次只改 description / boundary / workflow cues 中的一类变量再重跑
