---
name: skills-maker
description: >
  用于创建、重构、合并、评估具体 Skill 的方法 Skill。先把目标对象写成完整的
  Why → What → Structure → Flow → Surface → Runtime Proof 六段链，再补齐边界包、
  结构决策、输出合同与 proof；完成后再判断它在 Flow / Surface 上更像局部强化型、
  组合编排型，还是多输入同构型。适用于用户提到创建 Skill、重构 Skill、合并 Skill、
  Skill 边界冲突、Skill router / references 结构、Skill benchmark 或验证闭环。
  不要用于实际 domain work（写业务代码、修 bug、做 PRD）或仅做极小局部文案修改。
---

# Skills Maker

> last_verified: 2026-05-16

## Purpose

这是一个 **用于构造与评估具体 Skill 的方法 Skill**。

唯一底层结构只有：

```text
Why → What → Structure → Flow → Surface → Runtime Proof
```

使用本 Skill 时，先把目标对象写成完整六段链 Skill；
然后再把它补成一个**可判别、可 adopt、可防漂移**的 Skill：
- 边界必须能区分相邻目标
- 结构必须说明文件为何存在 / 不存在
- proof 必须能验证 route 与 adopt，而不是只验证文案存在

---

## First-Pass Decision

### Q1. 当前目标是不是“做一个 Skill / 改一个 Skill / 评一个 Skill”？
若是以下任一项，优先使用本 Skill：
- 新建一个 Skill
- 重构一个 Skill
- 合并多个相邻 Skill
- 解决 Skill 边界冲突
- 设计 Skill 的 router / references / output contract / proof
- 为 Skill 设计 benchmark / human review / reuse 验证闭环

### Q2. 当前对象是不是一个“完整 Skill”，而不是零散文案？
如果不是，先用本 Skill 把它补成完整六段链对象。

### Q3. 当前主要问题是 Skill 方法，而不是实际业务交付吗？
- **是** → 使用本 Skill
- **否** → 转去对应 domain Skill / `project-definition` / `project-implementation`

---

## Top-level Boundary Pack

### current main output
- 一个可创建 / 可重构 / 可审计的完整 Skill 方法方案
- 至少包含六段骨架、边界包、结构决策、输出合同与 proof 方案

### current main action
- Skill 生成
- Skill 重构
- Skill 审计
- Skill 边界 / 结构 / adopt / proof 诊断

### should-trigger
当当前主目标是以下任一项时，优先进入本 Skill：
- 设计一个新 Skill
- 重构现有 Skill 的边界、结构、surface 或 proof
- 审计某个 Skill 的漂移点与修复顺序
- 解决多个 Skill 之间的边界冲突
- 设计 Skill 的 router / references / validation 结构
- 建立 Skill 的 benchmark / human review / reuse 验证闭环
- 基于 `skill-explore` / `passto-context` 的 runtime evidence 生成新 Skill 或迭代现有 Skill

### should-not-trigger
以下请求不应由本 Skill 接管：
- 直接写业务代码、修 bug、补测试、调试运行时问题
- 写 PRD、spec、roadmap、信息架构、交互方案等 domain 定义交付
- 做部署、CI/CD、代码审查、性能/安全修复
- 只改一两句文案，不涉及 Skill 方法、边界、结构或 proof

### adjacent destination
- domain 定义方案 → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- domain 实施 / 调试 / 测试 / 发布 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 聚合型 / 路由器 Skill 的方法论与边界整编 → `/Users/handy/.claude/skills/metaskills-creator/SKILL.md`

### non-goals
即使命中本 Skill，也不要顺手扩做：
- 直接产出业务代码或产品方案
- 只为了 benchmark 分数而过拟合 description
- 只给概念建议，不产出结构化 Skill 方法材料
- 把极小文案修补硬升级成一次完整 Skill 工程

### first action after hit
先判断当前任务模式是 `create` / `refactor` / `audit`，再只读取完成该模式所需的最少 references；
如果没有先完成这一步，就不算真正 adopt `skills-maker`。

### positive examples
- “帮我创建一个新 Skill，用来处理复杂后台 UI 的运行态 QA，并给出边界和 proof。”
  - why should trigger: 用户主输出物是一个完整 Skill 方案，而不是实际 QA 执行动作
  - expected adopt signal: 明确 task mode、六段骨架、边界包、结构决策、proof 方案
- “审一下这个 Skill 为什么总误吸相邻请求，并给我最小修复顺序。”
  - why should trigger: 用户要的是 Skill 审计与漂移修补，不是 domain work
  - expected adopt signal: 漂移点、缺失边界/结构决策、修复顺序、回归验证方法
- “把这两个边界相邻的 Skill 合并成一个 router Skill，顺便设计 references 结构。”
  - why should trigger: 用户目标是 Skill 重构与路由结构设计
  - expected adopt signal: 模式判定、结构决策表、子路径/route 方案、proof 计划
- “基于 skill-explore 的聚合产物，判断是不是应该新建一个 Skill，或者继续优化现有 Skill。”
  - why should trigger: 用户明确要求基于真实 runtime evidence 做 Skill create / refactor 判断
  - expected adopt signal: 先判断是否需要读取 `references/skill-explore-handoff.md`，再引用 bundle / aggregate 证据进入六段链

### negative examples
- “直接改 React 代码把这个 sidebar 做出来。”
  - why should not trigger: 主输出物是业务代码实现
  - correct destination: `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- “帮我写这个新功能的 PRD 和实施 roadmap。”
  - why should not trigger: 主输出物是产品定义交付，不是 Skill 方法
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`
- “把这句 description 改顺一点就行，不用动结构。”
  - why should not trigger: 只是极小文案修改，不需要完整 Skill 方法流程
  - correct destination: 直接局部修改，不必进入 `skills-maker`

---

## Default Minimal Workflow

1. 先定义当前模式：`create` / `refactor` / `audit`
2. 若当前任务与真实 runtime 证据有关，先读取 `references/skill-explore-handoff.md`，判断是否需要主动消费 `skill-explore` 产物；若用户未直接提供 bundle 路径，则先查 `~/.passtocontext/skill-explore/handoff/skills-maker/indexes/ready.json`：当前最小选择策略为 `target skill > newer > richer signals`。若当前任务已明确指向某个 target skill，则先优先匹配该 skill（`skillKey / skillName / skillPath`）；在候选池内先按较新者取 1 条，只有时间并列时才用 richer signals 断平；若未命中则回退到全量 ready 候选中的最优 1 条，随后回读对应 bundle 本体
3. 再写目标 Skill 的 `Why / What / Structure / Flow / Surface / Runtime Proof`
4. 再补**边界包**：
   - `should-trigger`
   - `should-not-trigger`
   - `non-goals`
   - `adjacent destination`
   - `first action after hit`
   - positive / negative examples
5. 再补**结构决策表**：
   - `SKILL.md` 是否必需
   - `references/` 是否必需，里面放什么，为什么放
   - `templates/` / `scripts/` / `checklists/` 是否必需
   - 哪些是 runtime 读取面，哪些只是外部验证资产
   - 哪些文件应明确不存在，避免无意义骨架膨胀
6. 再定义输出合同：命中后 agent 必须产出什么、什么算 adopt、什么不算完成
7. 再选择 proof：benchmark / human review / real-task reuse / downstream quality
8. 最后才判断它在 Flow / Surface 上更像：
   - **局部强化型**
   - **组合编排型**
   - **多输入同构型**
9. 若是 `refactor` / `audit`，必须额外写出：
   - 当前漂移点
   - 最小修复顺序
   - 修后如何验证不回退

---

## Source Map

按需要最少读取：

- 六段骨架与形状诊断：`references/framework.md`
- 触发边界与排除边界：`references/boundary.md`
- 输出合同：`references/output-contract.md`
- 模板与卡片：`references/templates.md`
- 当任务与真实 runtime 证据、`skill-explore` 聚合产物、基于自然样本的新 Skill / Skill 优化判断有关时：`references/skill-explore-handoff.md`

`validation/runtime-proof.md` 作为外部验证资产保留，但不属于 skill 运行时读取面，也不由当前 `SKILL.md` 负责维护。

---

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 顶层方法入口；负责模式判定、最小读取路径与总输出合同 |
| `references/` | required | runtime | 承载 framework / boundary / output-contract / templates / skill-explore-handoff 等运行时方法材料 |
| `validation/` | required | external | 承载 runtime proof 等外部验证资产，避免混入 runtime surface |
| `references/runtime-proof.md` | forbidden | runtime | runtime proof 不应继续留在 runtime references 面，避免语义/物理混面 |
| `templates/` 目录 | forbidden | runtime | 模板已集中在 `references/templates.md`，单独目录会制造重复 surface |
| `scripts/` | forbidden | runtime | 当前方法 Skill 不需要脚本层；加入会制造结构膨胀 |
| `checklists/` | forbidden | runtime | checklist 尚未形成独立 runtime 读取价值，不应先生成空骨架 |

---

## Operating Rules

### 1. 先骨架，后形状
不要先把目标称为“原子 Skill / 复合 Skill”。
先把它写成完整六段链对象，再观察它在 Flow / Surface 上的形状。

### 2. 形状不是额外结构
- 局部强化型
- 组合编排型
- 多输入同构型

都只是 Skill 在 **Flow / Surface** 上的表现型，不是与六段骨架并列的第二套结构。

### 3. benchmark 只是 proof 之一
不要把 benchmark 当目的本身。
优先证明：目标 Skill 是否完整、边界是否清楚、输出是否更稳定。

### 4. 只保留必要信息
不要写长篇背景介绍。
只保留构造 / 重构 / 评估 Skill 所必需的信息。

### 5. 边界必须写成“可判别”，不是口号
`should-trigger / should-not-trigger / non-goals` 不能只列词。
至少要能回答：
- 与哪几个相邻 Skill 最容易混淆
- 为什么该进这里、不该进那里
- 命中后第一步要做什么
- 什么请求即使题材相近也必须转走

### 6. 结构方案必须写成“决策”，不是目录愿望单
不要只写 `SKILL.md / references / scripts`。
必须说明：
- 为什么需要该文件
- 它承载 runtime 读取，还是外部验证
- 如果不需要某类文件，为什么不需要
- 哪些文件存在会制造漂移，应明确禁止生成

### 7. 生成与分析都必须产出防漂移证据
如果当前任务是生成 Skill，输出里必须有：
- 边界包
- 结构决策表
- adopt 判据

如果当前任务是分析 Skill，输出里必须有：
- 漂移点
- 缺失的边界或结构决策
- 最小修补方案

### 8. 遇到 runtime-evidence 型任务时，先判断是否需要主动消费 `skill-explore`
当用户要求基于真实使用情况创建 / 重构 / 审计 Skill，或当前问题明显来自自然运行样本时：
- 先读取 `references/skill-explore-handoff.md`
- 先决定是否存在可读的 bundle / aggregate / joins
- 若存在，先读收敛物再进入六段链
- 若不存在，最终输出中必须显式标记当前缺少 runtime evidence

---

## Output Contract

一次合格输出，至少包含：

1. 目标 Skill 的一句话定义
2. 目标 Skill 的六段骨架
3. **边界包**
   - `should-trigger`
   - `should-not-trigger`
   - `non-goals`
   - `adjacent destination`
   - `first action after hit`
   - positive / negative examples
4. **结构决策表**
   - `SKILL.md` / `references/` / `templates/` / `scripts/` / `checklists/`
   - 每项的状态：`required` / `optional` / `forbidden`
   - 每项的理由与 runtime / external 身份
5. 若采用了 runtime evidence：补充本次读取了哪类 `skill-explore` 产物（如 `ready-index → bundle` / `bundle` / `aggregate`）、这些证据如何影响 create / refactor / audit 判断
6. 输出合同
7. proof 方案
8. 如有必要，补充其 Flow / Surface 形状诊断
9. 如涉及迁移，给出合并 / 迁移方案
10. 若是分析/审计，补充漂移诊断与最小修复顺序

---

## Non-Goals

本 Skill 不负责：
- 实际业务代码实现
- PRD / spec / roadmap 交付
- 单纯为了提高 benchmark 分数而过拟合文案
- 只改一两句措辞且不涉及 Skill 方法、边界、结构、proof 的极小修补
- 只生成“看起来完整”的骨架，而不处理边界判别与 adopt 漂移

---

## Success Condition

当本 Skill 被正确使用时，结果应满足：
- 目标对象已经是完整六段链 Skill
- 边界清楚，且能与相邻 Skill 稳定区分
- 结构清楚，且文件存在性有理由
- 输出合同清楚
- proof 方式清楚
- Flow / Surface 形状判断合理
- `create / refactor / audit` 三种模式都能稳定产出对应必交付物
- runtime 与 external 资产边界清楚，不再只停留在口头声明
- 后续生成或重构的 Skill 更稳定、更可 adopt、更可维护
- agent 不容易在生成 / 分析具体 Skill 时漂移成空泛建议
