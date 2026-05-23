---
name: autoagent
description: >
  AutoAgent 官方实验工作流技能。用于在本地 AutoAgent 或官方基线副本上做 Harbor benchmark、
  task 设计/修改、results.tsv / result.json / trajectory 分析、prompt A/B test、routing/skill benchmark、
  消融实验与失败归因。默认先读 README.md、program.md、`.agent/baseline.md`；先从母基线开 git worktree，
  再在 worktree 内实验，并把输出写入独立目录如 /Users/handy/autoagent-outputs/<experiment-name>/。
  默认实验编辑面是 program.md、tasks/、运行参数与环境变量；不要把 agent.py / provider 接入层当作每轮默认改动对象，
  只有用户明确要求改 harness、或实验目标本身就是 harness 改良时才改。优先触发：用户提及 autoagent、harbor、benchmark、
  results.tsv、result.json、trajectory.json、program.md，或要求做任务评测、routing benchmark、A/B test、消融实验、
  provider/model/sandbox 兼容实验。不要用于纯概念讨论、普通代码开发、或仅询问 Pi CLI 基础概念。
---

# AutoAgent Skill

## 目标

AutoAgent 在当前母版基线下的核心是：

- **agent 先设计实验，再写/改 `program.md`**
- **agent 或其委派的 subagent 按 `program.md` 执行实验循环**
- **主 agent 负责回收结果，并基于 benchmark 分数与 verifier 结果决定 keep / discard / iterate**

对本 skill 来说，最重要的不是“直接去改很多基础设施”，而是：

1. 先识别当前是在做：
   - **基础设施初始化**
   - **正式实验**
2. 再选择正确的默认编辑面。

---

## 0. 最高优先级原则

### 0.1 官方工作流优先

当仓库是 AutoAgent 或其官方派生时，先读：

1. `README.md`
2. `program.md`
3. `agent.py`
4. `tasks/` 中代表性任务与 verifier

并以 `README.md + program.md + .agent/baseline.md（若存在）` 作为**实验工作流真源**。

### 0.2 默认不要把基础设施当作每轮实验变量

对于 AutoAgent 项目，默认实验应：

- 先设计实验并写/改 `program.md`
- 视实验类型改 `tasks/`
- 改运行参数
- 分析 `results.tsv` / `result.json` / `trajectory.json`

如果 `.agent/baseline.md` 已固定 provider / model，则**不要再向用户追问 `.env`、OpenAI API、或让 worktree 自行猜 provider/model**。

`program.md` 承载当前 worktree 的实验计划：实验目的、允许修改面、运行方式、结果回收、结论与清理规则都应写在这里。

**不要**默认把这些作为每轮实验的主编辑面：

- `agent.py`
- provider 接入逻辑
- registry 基础设施
- Harbor 固定适配边界
- 用户真实 `~/.pi/agent/models.json`

### 0.3 `agent.py` 何时才该改

只有以下情况才把 `agent.py` 当主要编辑面：

1. 用户明确说：要改 harness / prompt / tools / orchestration
2. `program.md` 的 directive 明确要求优化 harness
3. 当前实验目标本身就是“agent.py 改良实验”
4. 官方基线无法接入当前 provider / model，且用户已同意做**一次性最小兼容补丁**

---

## 1. 两阶段工作模式

## Phase A：基础设施初始化 / 兼容性补齐

这是**一次性 bootstrap**，不是正式实验循环的一部分。

适用场景：
- 官方 AutoAgent 原版不支持当前 provider / model
- 需要建立官方基线副本
- 需要让官方 baseline 能跑 `PASSTOAI-TW + HubTo-TW/...`

### Phase A 默认做法

1. 建立官方基线副本
   - 例如 `/Users/handy/autoagent-official`
2. 把这个官方基线副本当作**母基线**，默认保持干净
3. 当前推荐母基线定义是：
   - **官方原版 + 固定的一次性最小 PASSTOAI-TW / OpenAI-compatible provider 兼容补丁**
4. 正式实验前先从母基线创建 git worktree
   - 例如 `/Users/handy/autoagent-worktrees/<experiment-name>`
5. 为该实验建立独立输出目录
   - 例如 `/Users/handy/autoagent-outputs/<experiment-name>/`
6. 仅补齐最小 provider/model 兼容层
7. 保持 prompt / tools / orchestration 尽量接近官方原版
8. 明确把这一步标记为：
   - bootstrap
   - compatibility patch
   - 非正式实验变量

### Phase A 不要做的事

- 不顺手把历史漂移版 prompt 带回官方副本
- 不顺手加入很多额外 tools
- 不把 provider 兼容补丁扩展成整套自定义 harness
- 不直接污染真实 `~/.pi/agent/models.json`

---

## Phase B：正式实验循环

一旦官方基线已经能跑当前 provider / model，之后默认进入正式实验：

### 默认编辑面

优先顺序：
1. `program.md`
2. `tasks/`
3. 运行命令 / 环境变量
4. 结果分析文件（只读）
5. `agent.py`（仅在实验目标明确要求时）

### 默认动作

- 读取当前 `program.md` 与 `.agent/baseline.md`
- 如果实验计划不完整或已过期，先设计实验并更新 `program.md`
- 读取 benchmark task 与 verifier
- 建立 baseline / control
- 视需要用 `subagent` 执行自包含实验任务
- 分析失败模式
- 更新 `program.md`、task 设计或运行参数
- 复跑并记录到 `results.tsv`
- 如果 task 采用 `task.toml.disabled` 分阶段启用，必须同时确认 Harbor 所需的 verifier/test 配置（如 `[test] command = "./tests/test.sh"`）没有缺失
- 为分批试跑的 benchmark 保留一个明确的 run manifest / trial 清单，避免后续 agent 启用错误任务集

### 关键边界

如果用户说的是：
- “做 benchmark”
- “跑实验”
- “做 A/B test”
- “做 skill-routing benchmark”
- “分析分数/失败原因”

默认理解为：

> **先在 `program.md` / tasks / 运行参数层推进，不要先改实验基础设施。**

---

## 2. 与官方 README 对齐的操作原则

当前母版基线下的核心意思是：

> 先由 agent 设计实验并写入 `program.md`，再由 agent 本身或其委派的 subagent 按该计划执行与回收。

因此，当你在 AutoAgent 项目里协助用户做实验时：

### 应优先做

- 设计实验并写清 `program.md` 的实验目标、约束、停止条件、变量控制
- 设计或修改 `tasks/.../task.toml`
- 编写 `instruction.md`
- 编写 `tests/test.sh` / verifier
- 规划 baseline / target / ablation / control
- 分析 `jobs/<job>/result.json`、`trajectory.json`、`exception.txt`

### 不应默认做

- 看到“实验”就先改 `agent.py`
- 看到“provider/model”就把真实 Pi 配置当默认编辑面
- 在没有明确要求时重写 Harbor 基础设施

---

## 3. 目录与边界

### 3.1 关键文件与目录

- `README.md`
  - 官方工作流说明
- `program.md`
  - 当前 experiment 的实验计划、执行合同与结果回收说明，由 agent 设计并维护
- `agent.py`
  - harness 实现面；仅在 harness 改良实验或一次性兼容补丁时优先修改
- `tasks/`
  - Harbor benchmark 任务
- `results.tsv`
  - 实验记录；优先写在实验 worktree 或输出目录上下文中，不要污染母基线
- `jobs/`
  - Harbor 输出；优先写到独立实验输出目录
- `.agent/`
  - 本项目额外上下文
- `git worktree`
  - 默认实验隔离机制；母基线 repo 不应承载具体实验脏状态
- `/Users/handy/autoagent-outputs/<experiment-name>/`
  - 推荐实验产出目录；保存 jobs、run.log、patch、总结等

### 3.2 真实生产配置边界

- 默认不要改真实 `~/.pi/agent/models.json`
- provider / registry 实验优先 sandbox
- 如需验证真实消费方，优先用副本、临时目录、临时 `HOME`

---

## 4. 母版基线中的 provider / model 规则

当仓库内存在 `.agent/baseline.md` 时：

- provider / model 以该文件为准
- worktree 默认继承母版基线约定
- 不要在每个实验 worktree 中重新猜测 provider/model
- 不要把 `.env`、OpenAI API、或其他 provider 初始化问题当成每轮实验的起点

当前已固定的 AutoAgent 母版基线应简明记录：
- provider 是什么
- 默认 model 是什么
- 允许的对照 model 是什么
- 哪些内容在所有实验里默认不可改
- 哪些内容是否可改由 `program.md` 为当前实验显式声明

本 skill 只需知道这些约定存在并应被继承；
**具体实验该改什么、不该改什么，以当前 worktree 的 `program.md` 为准。**

---

## 5. benchmark / routing / A/B 实验的默认做法

当用户要做：
- benchmark
- 评测
- routing experiment
- skill benchmark
- 消融实验
- 黑盒行为评测
- 失败归因

优先按以下顺序：

1. 明确评测目标
2. 读取 `README.md` + `program.md`
3. 确认当前实验层级：
   - bootstrap 兼容
   - 正式实验
4. 设计或修改 `tasks/`
5. 运行 baseline
6. 分析 `results.tsv` / `result.json` / `trajectory.json`
7. 更新 `program.md` 或任务集
8. 复跑

### 特别注意

如果任务是“skill-routing benchmark”，默认首先想到：
- 用 AutoAgent 的 task/verifier 框架承载实验
- 而不是自己另起一套散装 benchmark 流程

---

## 6. 任务创建规范

### 6.1 目录结构

```text
tasks/my-task/
├── task.toml
├── instruction.md
├── solution/solve.sh
├── tests/test.sh
└── environment/Dockerfile
```

### 6.2 必须遵守

- `task.toml.name` 必须是 `org/name`
- `tests/test.sh` 必须写入 `/logs/verifier/reward.txt`
- `solution/solve.sh` 与 `tests/test.sh` 必须可执行
- 分数范围 `0.0 ~ 1.0`
- `environment/Dockerfile` 必须基于 `autoagent-base`

### 6.3 verifier 原则

成功不能依赖 agent 自述，必须由 verifier 判定：
- 文件是否存在
- 内容是否准确
- 格式是否可解析
- 真实消费方是否能加载
- 关键字段是否完整

---

## 7. 结果分析与记录

优先看：

1. `jobs/<job>/result.json`
2. `jobs/<job>/<task>__/agent/trajectory.json`
3. `jobs/<job>/<task>__/exception.txt`
4. `jobs/<job>/<task>__/trial.log`
5. `results.tsv`

### Keep / Discard

- `passed` 增加：Keep
- `passed` 不变但系统更简单：Keep
- 其他情况：通常 Discard

---

## 8. 明确禁止事项

- 不要把“实验设计”自动等同于“继续改 agent.py 基础设施”
- 不要在每轮实验里反复改 provider 接入层
- 不要无确认地修改真实 `~/.pi/agent/models.json`
- 不要把历史漂移版 harness 误当官方基线
- 不要绕过 `program.md` 直接发散出一套与官方工作流脱节的方法
- 不要把 AutoAgent skill 当作普通开发 skill 使用；它首先是**实验工作流指导器**
- 不要在母基线 repo 根目录直接累积 `jobs/`、`run.log`、临时 task 草稿等实验残留
- 不要在未建立 worktree 的情况下，把实验性改动直接落到 baseline 工作树
- 不要在实验机制已经调整后仍沿用旧的 skill 文案；**机制变更后必须同步更新本 skill**

---

## 9. baseline.md 与 program.md 的职责分工

- 仓库内 `.agent/baseline.md`
  - 负责**固定基础设施合同**：provider、models、所有实验默认继承的硬约束、母版基线与 worktree 的关系
- 仓库内 `program.md`
  - 负责**当前 worktree 的实验计划与执行合同**：实验目的、允许修改面、任务集、运行方式、参数、结果回收、结论与清理规则

### 9.1 subagent brief 模板复用规则

当 `program.md` 已包含 `Delegated Execution Contract` 与 `Subagent execution brief template` 时：

- 委派实验执行时，优先直接复用该模板构造 brief
- 不要绕开 `program.md` 另写一套模糊口头说明
- brief 至少要写清：objective、allowed / forbidden edit surface、exact run commands、output directory、required recovery artifacts、completion condition
- 如果当前 `program.md` 还没有这两段，先补齐 `program.md`，再委派 `subagent`

## 10. 本 skill 的一句话心法

> **先读取 README.md、program.md 与 `.agent/baseline.md`；母版基线负责固定不变项，agent 先设计实验并写入 program.md，再执行、回收结果、输出结论；每次实验先开 git worktree，再把输出写入独立 experiment output 目录。**
