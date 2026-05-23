# Workspace UI Skills Benchmark Run Request

> **last_verified: 2026-05-15**
> purpose: 为 `agent-human-workspace-baseline` 与 `visual-feedback-ui-qa` 两个相邻目标（前者为 definition reference，后者为 implementation 子 skill）准备统一的 benchmark 执行请求

## Goal

验证以下两类能力是否能被稳定触发并正确采用：

1. **定义侧**：当用户要设计/重构 agent-human 共享工作台时，是否能命中 `project-definition/references/agent-human-workspace-baseline.md`
2. **实施/验证侧**：当用户要做真实运行态 UI QA / visual feedback 验收时，是否能命中 `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`

本次请求只做：
- routing benchmark
- skill-use / adopt benchmark
- too broad / too weak / ambiguous 分类

本次请求不做：
- harness 改造
- 模型切换实验
- 页面实现修复
- 视觉稿生成

---

## Benchmark Order

按以下顺序执行，避免相邻 skill 干扰时难以定位：

### Round 1
先跑定义侧：
- `/Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md`

主要观察：
- 是否会被 `design-foundation.md` 吸走
- 是否会被 `project-implementation` 吸走
- 是否虽然 route 对了，但 adopt 退化成普通 UI 建议

### Round 2
再跑 QA / 实施侧：
- `/Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md`

主要观察：
- 是否会被 `browser-runtime-observation` 或其相邻 browser skill 误吸走
- 是否会退化成普通 DevTools 调试
- 是否虽然 route 对了，但输出缺少 severity / evidence / fix

---

## Required Inputs

运行前必须读取以下文件：

### Shared router files
- `/Users/handy/.claude/skills/project-definition/SKILL.md`
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### Definition-side target files
- `/Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md`
- `/Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md`
- `/Users/handy/.claude/skills/project-definition/references/design-foundation.md`
- `/Users/handy/.claude/skills/project-definition/references/core-flow-design.md`

### QA-side target files
- `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`
- `/Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md`
- `/Users/handy/.claude/skills/browser-runtime-observation/SKILL.md`
- `/Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md`

---

## Execution Contract

### Environment
- baseline repo / worktree: AutoAgent baseline 或当前 skills benchmark worktree
- output root: `/Users/handy/autoagent-outputs/workspace-ui-skills-benchmark/`
- harness: 不修改
- model/provider: 固定

### Task layout
建议建立：

```text
tasks/
  workspace-ui-skills/
    agent-human-workspace-baseline/
      positive/
      negative/
    visual-feedback-ui-qa/
      positive/
      negative/
```

### Required outputs
每轮至少产出：
- `results.tsv`
- `summary.md`
- `per-task result.json`
- `trajectory.json`

---

## Verifier Focus

### A. agent-human-workspace-baseline
通过的关键不是“提到了设计”，而是：
- 识别出这是 **共享工作台定义**，不是普通 UI 审美
- 明确采用 **真实运行界面优先**
- 输出围绕：
  - 当前工作对象
  - 下一步动作
  - review-first
  - 状态反馈
  - recovery UX
  - header / sidebar / status bar / agent panel

判失败的典型信号：
- 只给配色/排版/层级建议
- 直接进入代码实现
- 只讲流程状态机，不讲工作台界面
- 只说“可以优化交互”，没有工作台信息架构结果

### B. visual-feedback-ui-qa
通过的关键不是“打开了浏览器”，而是：
- 识别出这是 **运行态 UI QA / visual feedback 验证**
- 采用 **用户是否感知得到** 作为主判据
- 输出必须包含等价于：
  - severity
  - user-visible evidence
  - why it matters
  - recommended fix

判失败的典型信号：
- 只因代码里有状态就判通过
- 只给抽象评价
- 只有浏览器观察，没有结构化 findings
- 被吸到普通 DevTools 调试或普通设计建议

---

## Result Classification Rules

### just enough
- 两个 target 都能在正例中正确命中并 adopt workflow
- 负例中不滥用 target
- 输出具备可观察结构，不靠 self-report

### too broad
- `agent-human-workspace-baseline` 抢走普通视觉设计 / 纯实现 / 纯 QA / 纯流程定义
- `visual-feedback-ui-qa` 抢走纯设计定义 / 纯实现 / 纯性能调试

### too weak
- 只有显式说出 skill 名或极强关键词才触发
- 语义相同但表述略变就不命中

### ambiguous
- route 看起来对，但 adopt 不明显
- 提到真实界面或 QA，但没有产生目标结构化输出
- 相邻 skill 都像能解释，无法稳定区分

---

## Minimal Iteration Policy

每轮只改一类变量后重跑：

1. route 文案
2. positive/negative case
3. verifier 判据
4. workflow cues

禁止一次同时大改多个层面，否则难以归因。

---

## Recommended Run Sequence

### Pass 1: Baseline read-only benchmark
- 不改任何 skill 文案
- 先测当前版本命中率与 adopt 情况

### Pass 2: Narrow fix or weak-signal fix
如果失败：
- too broad → 优先收窄路由边界与负例
- too weak → 优先扩展自然语言触发表达
- ambiguous → 优先强化 adopt 判据，不先扩写 description

### Pass 3: Regression check
- 重跑所有 positive + negative
- 确认一侧优化不会破坏另一侧边界

---

## Direct File References

### Definition-side
- target reference: `/Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md`
- benchmark brief: `/Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md`

### QA-side
- target skill: `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md`
- benchmark brief: `/Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md`

---

## Expected Final Deliverable

执行完成后，应返回一份汇总结论，至少回答：

1. `agent-human-workspace-baseline` 当前是 too broad / too weak / ambiguous / just enough 中哪一种
2. `visual-feedback-ui-qa` 当前是 too broad / too weak / ambiguous / just enough 中哪一种
3. 每个 target 最主要的 1–2 个失败原因是什么
4. 下一轮最小该改哪一处文案或判据
5. 是否已经达到可继续长期复用的稳定度

---

## Related Assets

| 文件 | 作用 |
|---|---|
| `/Users/handy/.claude/skills/project-definition/references/agent-human-workspace-baseline.md` | 定义侧共享工作台基线 |
| `/Users/handy/.claude/skills/project-definition/validation/agent-human-workspace-baseline-benchmark-brief.md` | 定义侧 benchmark brief |
| `/Users/handy/.claude/skills/visual-feedback-ui-qa/SKILL.md` | 实施/QA 侧运行态 UI QA 子 skill |
| `/Users/handy/.claude/skills/project-implementation/validation/visual-feedback-ui-qa-benchmark-brief.md` | 实施/QA 侧 benchmark brief |
