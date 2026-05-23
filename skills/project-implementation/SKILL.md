---
name: project-implementation
description: >
  负责所有“已经进入动手实施”的项目实施工作。先判断当前主动作到底是 build、debug、test、review、ship 中的哪一个，
  再按最小读取路径进入对应实施主路径，产出代码、修复、测试证明、review 结论或发布动作。
  适用于当前主输出物已经是实现结果而不是 PRD/spec/roadmap 等定义类产物；当 scope、acceptance criteria、
  API/data contract 仍不清楚时，应先回到 project-definition。
---

# Project Implementation

> last_verified: 2026-05-16
> status: skills-maker-router

## Why

`project-implementation` 是实施侧的顶层复合 Skill。

它存在的目的，不是把所有实现相关 skill 堆在一起，而是压缩“开始动手之后”的实施不确定性，尤其是：
- 当前主动作到底是 build、debug、test、review 还是 ship
- 第一步应该读什么、做什么、证明什么
- 何时该保持在实现主路径，何时该切到调试 / 测试 / review / 发布路径
- 何时缺最小定义，必须回退到 `project-definition`

如果没有这个 Skill，agent 很容易：
- 在 implement / debug / test / review 多条路径之间摇摆
- 一开始就加载过多材料
- 在没有最小定义时盲写代码
- 把“做了什么”误当成“已经证明对了”

---

## What

### 主目标
把已经足够明确的需求，转化为**实施结果与对应证据**。

### 主输出物
- code changes
- bug fixes
- tests / regression proof
- runtime validation results
- review findings / merge readiness
- CI / release / rollback actions

### 不负责
以下不是本 Skill 的主输出：
- PRD / spec / roadmap / scope
- discovery / research synthesis
- information architecture / user flow / architecture proposal 的主写作
- 在需求仍模糊时替用户补全产品定义

这些应交给：
- `/Users/handy/.claude/skills/project-definition/SKILL.md`

---

## Top-level Boundary Pack

### current main output
- 已进入实施阶段的代码、修复、测试证明、运行态验证、review 结论或发布动作
- 与当前实施主路径匹配的最小证据，而不是定义类方案文档

### current main action
- build / implement
- debug / fix / recover
- test / prove / regression
- review / assess / gate
- ship / release / rollback

### should-trigger
当当前主输出已经是以下任一项时，优先进入本 Skill：
- 写 / 改代码
- 修 bug 或恢复失败状态
- 建测试、回归证明或 test-first 行为变更
- 做 code review / merge readiness 判断
- 做 runtime validation / browser QA / release readiness / rollback 准备

### should-not-trigger
以下请求不应由本 Skill 接管：
- 写 PRD、spec、roadmap、scope、信息架构、用户流程、交互方案
- discovery、research synthesis、需求梳理、产品边界定义
- 在 success criteria / scope / API / data contract 仍不清楚时直接推进实现
- 只做 Skill 方法设计、Skill 边界修复、Skill 审计

### adjacent destination
- 定义不足、需要先明确范围 / 标准 / contract → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- Skill 方法论、结构、边界、自审修复 → `/Users/handy/.claude/skills/skills-maker/SKILL.md`
- 纯定义型产品/方案工作流 → `/Users/handy/.claude/skills/project-definition/SKILL.md`

### non-goals
即使命中本 Skill，也不要顺手扩做：
- 把实现任务偷换成完整产品定义
- 一开始同时展开 build / debug / test / review / ship 多条主路径
- 只因题材相近就加载无关专项实现器
- 把“已经做了实现动作”误当成“已经证明行为正确” 

### first action after hit
先判断当前主动作词，只选一条主路径，并且只先读取一个主路径子 Skill；如果没有发生这一步，就不算真正 adopt `project-implementation`。

### positive examples
- “直接把这个 API 的分页和错误处理补完，并给我最小验证结果。”
  - why should trigger: 当前主输出物是代码实现与验证，不是定义文档
  - expected adopt signal: 先判定 build 路径，再进入 `incremental-implementation`，必要时补 `api-and-interface-design`
- “这个测试挂了，先帮我稳定复现、修掉并补回归防护。”
  - why should trigger: 当前主动作是 debug / recover
  - expected adopt signal: 先进入 `debugging-and-error-recovery`，先停线保留证据与复现，再考虑补测试
- “帮我审一下这组改动能不能 merge，重点看测试故事和风险。”
  - why should trigger: 当前主交付物是 review 结论
  - expected adopt signal: 先进入 `code-review-and-quality`，输出 findings / readiness，而不是直接继续大改实现

### negative examples
- “先帮我把这个新功能的 scope、非目标和成功标准写清楚。”
  - why should not trigger: 主输出物仍是定义类产物
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`
- “帮我设计一个新 Skill，负责前端 debug 和 QA 的统一路由。”
  - why should not trigger: 这是 Skill 方法设计，不是业务实施
  - correct destination: `/Users/handy/.claude/skills/skills-maker/SKILL.md`
- “这个接口可能要改，也可能不用，先帮我想清楚方案。”
  - why should not trigger: 实施前的 contract / scope 仍不清楚
  - correct destination: `/Users/handy/.claude/skills/project-definition/SKILL.md`

---

## Structure

这是一个在 **Flow / Surface** 上呈现为**组合编排型**的复合 Skill。
唯一骨架仍然只有：

```text
Why → What → Structure → Flow → Surface → Runtime Proof
```

### 文件面
- `SKILL.md`：父级 router，先确定当前主动作词

本 Skill 的默认 runtime 读取面只包含当前 `SKILL.md` 与被路由到的子 Skill。
`validation/*.md` 下的 runtime proof、child bindings、benchmark brief 等文件属于外部验证与审计资产，不属于默认 runtime 读取面，也不由当前 `SKILL.md` 负责维护。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | 顶层实施 router；负责主动作词判定、首路径选择与停止扩展条件 |
| `validation/` | required | external | 承载 runtime proof、child bindings、benchmark brief 等外部验证资产，避免混入 runtime surface |
| `references/` | forbidden | runtime | 本 Skill 当前不需要本地 runtime reference 面；保留会让 agent误以为还需继续读本地参考材料 |
| `validation/runtime-proof.md` | required | external | 保存首路径、artifact、fallback 的外部验证规则 |
| `validation/child-skill-bindings.md` | required | external | 保存父子 Skill 绑定说明，作为审计/验证材料而非默认 runtime 读取面 |
| `validation/visual-feedback-ui-qa-benchmark-brief.md` | optional | external | 仅在 visual-feedback-ui-qa 路由/采用验证时读取，不应进入默认 runtime surface |

### 直接绑定的主路径子 Skill
这五个子 Skill 直接决定实施路径的首动作与停止条件：
- `incremental-implementation`：默认 build 路径的节奏控制器
- `debugging-and-error-recovery`：failure-first 路径的恢复控制器
- `test-driven-development`：proof-first 路径的证明控制器
- `code-review-and-quality`：review gate 路径的质量控制器
- `shipping-and-launch`：ship / release / rollback 路径的发布控制器

### 受父 Skill 调度的专项实现器
这些不是并列顶层入口，而是父 Skill 在特定节点调用的专项强化器：

- build / boundary 实现器：
  - `api-and-interface-design`
  - `frontend-ui-engineering`
- cross-path 风险强化器：
  - `security-and-hardening`
  - `performance-optimization`
  - `code-simplification`
- process / evidence 强化器：
  - `git-workflow-and-versioning`
  - `context-engineering`
  - `source-driven-development`
- runtime validation 强化器：
  - `visual-feedback-ui-qa`
  - `browser-runtime-observation`
- ship / release 强化器：
  - `ci-cd-and-automation`
  - `documentation-and-adrs`

---

## Flow

### Step 1. 先确认当前主输出是不是实施结果
若当前回合要的是以下之一，优先留在本 Skill：
- 写 / 改代码
- 修 bug
- 补测试 / 建 regression proof
- 跑验证 / runtime check
- 做 code review
- 做 CI / release / rollback

如果当前主输出仍然是“先想清楚做什么、范围是什么、成功标准是什么”，先回到 `project-definition`。

### Step 2. 先判定**主动作词**，只选一条主路径
不要先看名词堆，先看当前主动作到底是什么：

| 主动作 | 先进入的主路径 | 第一优先读取 |
|---|---|---|
| build / implement | build 路径 | `incremental-implementation` |
| debug / fix / recover | debug 路径 | `debugging-and-error-recovery` |
| test / prove / regression | proof 路径 | `test-driven-development` |
| review / assess / gate | review 路径 | `code-review-and-quality` |
| ship / release / rollback | ship 路径 | `shipping-and-launch`，若主交付物转为 workflow / pipeline 再补 `ci-cd-and-automation` |

### Step 3. 每条主路径只先读一个主子 Skill
#### A. build 路径
适用于：功能实现、重构落地、明确要改代码。

1. 先读 `incremental-implementation`
2. 再判断是 API / interface 主导，还是 frontend UI 主导：
   - API / contract → `api-and-interface-design`
   - UI / page / component → `frontend-ui-engineering`
3. 如需框架官方模式，补 `source-driven-development`
4. 如任务跨多文件或上下文很散，补 `context-engineering`
5. 如当前主风险是 trust boundary / auth / external integration / PII，补 `security-and-hardening`
6. 如当前已有性能目标或性能回归证据，补 `performance-optimization`
7. 如实现已成立但复杂度成为主问题，补 `code-simplification`
8. 如提交边界、保存点、worktree 隔离或历史整理成为推进阻力，补 `git-workflow-and-versioning`
9. 如需真实运行态 UI QA / visual feedback 验收，补 `visual-feedback-ui-qa`
10. 如需真实浏览器中的 DOM / console / network / Lighthouse / perf / memory 技术证据，补 `browser-runtime-observation`
11. 如需更底层的原始 DevTools tool guide 或专项参考，再补相邻验证 / reference skill
12. 当需要证明行为或收尾 gate 时，再切入 test / review 路径

#### B. debug 路径
适用于：测试挂了、构建坏了、运行时行为异常、出现报错。

1. 先读 `debugging-and-error-recovery`
2. 先停线、保留证据、稳定复现
3. 若根因或证据缺口位于真实浏览器运行态，补 `browser-runtime-observation`
4. 只有当 bug 已被复现或需要回归防护时，才补 `test-driven-development`
5. 修复完成后，回到最小验证；必要时再过 review gate

#### C. proof 路径
适用于：当前主交付物是测试、回归防护、test-first 行为变更证明。

1. 先读 `test-driven-development`
2. 先写失败测试或明确验证基线
3. 再做最小代码修改让其通过
4. 如代码级证明不足以覆盖 browser-facing 行为，可补 `browser-runtime-observation` 作为 runtime proof
5. 若实现面扩大，再回 build 路径做切片；若是 bug，则可与 debug 路径联动

#### D. review 路径
适用于：当前主交付物是质量判断、merge readiness、结构化 review 结论。

1. 先读 `code-review-and-quality`
2. 先看测试与验证故事，再看实现
3. 必要时按问题类型补 `security-and-hardening` / `performance-optimization` / `code-simplification`
4. 如评审目标已转为真实界面可用性、状态反馈、交互可感知性验证，补 `visual-feedback-ui-qa`
5. 如评审目标需要真实浏览器中的技术运行态证据，补 `browser-runtime-observation`
6. 如评审目标已转为提交边界、历史可审查性、冲突处理或并行隔离，补 `git-workflow-and-versioning`
7. 产出 findings 与 readiness，而不是顺手继续大改实现

#### E. ship 路径
适用于：CI、发布、回滚、上线准备。

1. 先读 `shipping-and-launch`
2. 先确认当前主交付物到底是发布收口，还是 workflow / pipeline 本身：
   - 发布 readiness / rollout / rollback → 保持在 `shipping-and-launch`
   - workflow / gate / pipeline 本身 → 补 `ci-cd-and-automation`
3. 如发布前需要整理提交边界、release branch / worktree、回滚提交路径，补 `git-workflow-and-versioning`
4. 如需记录变更与决策，再补 `documentation-and-adrs`

### Step 4. 缺最小定义时立即回退
当出现以下缺口时，不要继续实施：
- success criteria 不清
- scope / non-goals 不清
- API / data contract 不清
- 用户实际要的是“先帮我想清楚”

这时应回到：
- `/Users/handy/.claude/skills/project-definition/SKILL.md`

### Step 5. 停止扩展条件
当当前主路径的主输出已经成立时，停止横向发散：
- build 路径：本次切片代码与最小验证已成立
- debug 路径：根因已定位、修复已落地、回归防护已建立
- proof 路径：失败测试 → 通过测试链路成立
- review 路径：findings / readiness 已清楚
- ship 路径：发布动作 / 回滚方案 / gate 状态已清楚

---

## Surface

`project-implementation` 的 Surface 不是“实施技能索引页”，而是：
- 一个按主动作词收敛首路径的 router
- 一组会改变执行路径的主路径子 Skill
- 一组按需补入的专项实现器

### 读取顺序
1. 先读本 `SKILL.md`
2. 先判断主动作词
3. 只读一个主路径子 Skill
4. 只有当前路径真的需要时，才补专项实现器或第二条路径
5. 达成当前主输出后停止扩展

### Source Map
- build 主路径：`incremental-implementation`
- debug 主路径：`debugging-and-error-recovery`
- proof 主路径：`test-driven-development`
- review 主路径：`code-review-and-quality`
- ship 主路径：`shipping-and-launch`
- UI 运行态验证：`visual-feedback-ui-qa`

### Surface 原则
- 先首动作，再读材料
- 先主路径，再专项实现器
- 先产出与主路径匹配的证据，再考虑扩展

---

## Runtime Proof

### 先验证什么
先验证：命中本 Skill 后，agent 的**首动作**是否更稳定，而不是只是声称“我在实施”。

### 再验证什么
1. **route correctness**
   - 实施请求是否命中 `project-implementation`
   - 定义请求是否没有被误吸进来

2. **first-action correctness**
   - build 请求是否先进入 `incremental-implementation`
   - debug 请求是否先停线、保留证据、复现
   - test-first 请求是否先建立失败测试
   - review 请求是否先读测试与验证故事
   - ship 请求是否先确认 readiness / rollback 条件，而不是直接部署

3. **minimal-read correctness**
   - 是否只先读了一个主路径子 Skill
   - 是否避免了一开始同时加载 build/debug/test/review 多条路径

4. **artifact correctness**
   - build 路径是否产出切片代码 + 最小验证
   - debug 路径是否产出 repro / root cause / regression guard
   - proof 路径是否产出 failing test → passing test 证据
   - review 路径是否产出 findings / readiness
   - ship 路径是否产出 readiness / rollout / monitoring / rollback 证据

5. **fallback correctness**
   - 当定义不足时，是否真的回退到 `project-definition`

### proof 类型
- human review：检查首动作、证据、停止条件是否与主路径一致
- real-task reuse：看不同实施请求是否稳定命中不同主路径
- benchmark：仅用于验证误吸、首路径选择、最小读取路径
- downstream quality：看实际实现是否更少返工、少摇摆、少盲改

### 不允许依赖
- 不要把“agent 说自己用了 implementation skill”当证明
- 不要把 benchmark 分数当唯一真理
- 不要用名词命中替代行为命中

---

## Success Condition

当本 Skill 被正确使用时：
- 当前主动作词被快速判定
- 首路径选择稳定
- 首读取与首证据都更少、更准
- 缺定义时会回退，不会盲写
- 每条主路径都能产出与自己匹配的结果与证据
