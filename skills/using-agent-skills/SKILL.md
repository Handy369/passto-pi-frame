---
name: using-agent-skills
description: >
  弱兜底路由 skill。仅当无法判断当前任务应进入 `project-definition` 还是 `project-implementation` 时使用。

  应优先触发的场景：
  1. 用户请求高度模糊，既像方案定义又像代码实施，当前无法稳定判定主输出物
  2. 需要先做一次“定义类 vs 实施类”的二分流判断

  不要在以下场景触发：
  - 用户明确要 PRD、spec、roadmap、scope、flow、wireframe、architecture proposal、implementation plan（应直接用 `project-definition`）
  - 用户明确要写代码、修 bug、加测试、做调试、做 review、配 CI/CD、发布上线（应直接用 `project-implementation`）
---

# Using Agent Skills

> **last_verified: 2026-05-16**
> **status: weak-fallback-router**

## Top-level Boundary Pack

### current main output
- 一次最小且明确的二分流判断：当前应去 `project-definition` 还是 `project-implementation`
- 对模糊请求的首个稳定去向，而不是最终业务产物

### current main action
- 判断当前请求更像定义类还是实施类
- 在模糊场景下做一次最小路由澄清
- 把用户从弱兜底入口尽快送到正确主 skill

### should-trigger
当当前请求满足以下任一条件时，优先进入本 Skill：
- 用户请求高度模糊，既像方案定义又像代码实施
- 当前无法稳定判断主输出物是定义类产物还是实施类结果
- 需要先做一次“先定义 vs 先实施”的最小二分流

### should-not-trigger
以下请求不应由本 Skill 接管：
- 用户明确要 PRD、spec、roadmap、scope、flow、wireframe、architecture proposal、implementation plan
- 用户明确要写代码、修 bug、加测试、做调试、做 review、配 CI/CD、发布上线
- 用户请求已经明显命中其他更具体的工具型 skill

### adjacent destination
- 定义类产物 → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 实施类结果 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 如果请求已明显命中更具体 skill，则直接去对应具体 skill，不要停留在本 skill

### non-goals
- 不负责产出完整 PRD / spec / code / tests / release
- 不负责把模糊问题自己展开成完整方案或实现
- 不做多层路由，只做一次最小二分流

### first action after hit
先问或先判断：**当前回合最先要交付的到底是定义类产物，还是实施类结果**；一旦可以稳定判断，就立即移交到对应主 skill。

### positive examples
- “我想做个新功能，可能要先想方案，也可能直接开始写，帮我看看现在该先做什么。”
  - why should trigger: 当前请求确实处于定义与实施之间的模糊地带
  - expected adopt signal: 先做定义/实施二分流，而不是直接展开长方案或写代码
- “这个需求我描述得不太清楚，你先判断该先写 spec 还是直接实现。”
  - why should trigger: 用户明确要求先做最小路由判断
  - expected adopt signal: 输出明确去向并转给 `project-definition` 或 `project-implementation`

### negative examples
- “帮我写这个功能的 PRD 和 implementation plan。”
  - why should not trigger: 主输出物已明确是定义类产物
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`
- “直接实现这个页面并补上测试。”
  - why should not trigger: 主输出物已明确是实施类结果
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “打开网站点一下并截图给我。”
  - why should not trigger: 已经明显命中更具体工具型 skill
  - correct destination: 对应具体 skill，如 `/Users/handy/.claude/skills/agent-browser/SKILL.md`

## Purpose

这个 skill 不再是“总入口”。

它现在只做一件事：

> **当且仅当当前任务太模糊，无法稳定判断应进入 `project-definition` 还是 `project-implementation` 时，做一次最小二分流。**

默认情况下：
- 先定义清楚 → `project-definition`
- 先动手实施 → `project-implementation`

不要把本 skill 当作默认起点。

---

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 弱兜底路由入口；负责做一次最小二分流并立即退出 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增只会放大弱兜底 skill 的 surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 不执行复杂工作流，不需要脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 只做路由判断，不需要模板产物 |

## Minimal Routing Questions

### Q1: 当前回合最需要的最终输出物是什么？
- **文档 / 方案 / 范围 / 流程 / 结构 / 计划** → `project-definition`
- **代码 / 测试 / 调试 / 验证 / review / release** → `project-implementation`

### Q2: 现在是不是已经适合直接写代码？
- **是** → `project-implementation`
- **否，还缺 scope / success criteria / flow / contract** → `project-definition`

### Q3: 混合请求怎么处理？
如果用户同时说了“做方案”和“写代码”，优先看**本回合先要交付什么**：
- 先交付方案 → `project-definition`
- 先交付代码 → `project-implementation`

---

## Fast Examples

### 直接去 `project-definition`
- “帮我写这个功能的 PRD”
- “先梳理 scope 和 non-goals”
- “帮我设计用户流程和异常状态”
- “给我一个架构方案和数据模型方案”
- “把这个模糊想法变成 spec 和实施计划”

### 直接去 `project-implementation`
- “帮我实现这个页面/组件/API”
- “修这个 bug”
- “补测试并验证”
- “review 这段代码的性能问题”
- “配 CI 并准备上线”

---

## Rule

如果已经可以稳定进入上述两个主 skill 之一，**不要停留在本 skill**。
