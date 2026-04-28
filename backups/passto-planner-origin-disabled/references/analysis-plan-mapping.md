# Analysis → Plan Mapping

本文件定义 `analysis.md` 与 `plan.md` 之间的映射关系。

目标：
- 避免 `analysis.md` 和 `plan.md` 各写各的
- 确保分析阶段抽取出的信息，在最终方案中都有明确落点
- 确保“推断 / 用户确认 / 保守假设”三类信息不会混淆

---

# 一、总原则

## 1. `analysis.md` 是原始结构化分析
它负责：
- 抽取事实
- 抽取输入
- 抽取运行时节点
- 抽取输出与最终产物
- 推断潜在约束
- 标记不可简化节点

## 2. `plan.md` 是面向执行的整合方案
它负责：
- 把分析结果组织成可实施的产品化方案
- 明确设计决策
- 明确目标环境与约束如何影响方案
- 明确哪些是假设，哪些是确认事实

## 3. `plan.md` 不能脱离 `analysis.md` 凭空生成
任何关键章节都必须能回溯到 `analysis.md` 的某个部分。

---

# 二、章节映射表

| analysis.md | plan.md | 映射规则 |
|-------------|---------|----------|
| `# Target Overview` | `# Target Summary` | 总结目标、来源、类型，不直接复制原文，而是整理成面向执行者的摘要 |
| `# Product Framing` | `# Product Framing` | 保留 target nature、product mode、mode source，不得丢失或改写成隐含前提 |
| `# User Inputs` | `# User Inputs` | 保留输入项完整性，按执行方案重组 |
| `# Env / Config / Dependencies` | `# Env / Config / Dependencies` | 直接继承，并补充在方案中如何承载 |
| `# Runtime Nodes` + `# Intermediate Inputs and Outputs` | `# Runtime Nodes and Intermediate States` | 合并成运行链路视图，强调节点、状态、中间态与依赖 |
| `# Final Artifacts` | `# Final Artifacts` | 保留完整产物清单，并补充在方案中如何生成与持久化 |
| `# Environment and Constraints Hypothesis` | `# Environment and Constraints Summary` + `# Hypothesis vs Confirmed Constraints` | 先总结环境与约束，再区分推断/确认/假设 |
| `# User-confirmed Constraints` | `# Hypothesis vs Confirmed Constraints` | 用户确认内容必须进入 `User-confirmed Constraints` 子节 |
| `# Non-negotiable Contracts` | `# Architecture Plan` / `# Workflow Plan` / `# Review Framework Findings` | 不可简化项必须转化为设计约束与 review 检查项 |

---

# 三、关键映射规则

## 1. 推断约束如何映射
`analysis.md` 中：
- `# Environment and Constraints Hypothesis`

应拆到 `plan.md`：

### `# Environment and Constraints Summary`
用于写：
- 当前识别出的目标环境
- 环境为何重要
- 这些约束如何影响方案边界

### `# Hypothesis vs Confirmed Constraints > Hypothesized Constraints`
用于写：
- 仍然只是推断、尚未被用户确认的约束

---

## 2. 用户确认约束如何映射
`analysis.md` 中：
- `# User-confirmed Constraints`

应进入 `plan.md`：

### `# Hypothesis vs Confirmed Constraints > User-confirmed Constraints`
要求：
- 不要与推断项混写
- 不要改写成模糊表述
- 明确哪些是用户已确认条件

---

## 3. 保守假设如何形成
保守假设不一定直接来自 `analysis.md` 的某一行，而是来自：
- 用户未确认的关键约束
- 目标材料不完整
- 为了保证方案成立而需要采取的保守处理

这些内容应进入 `plan.md`：

### `# Hypothesis vs Confirmed Constraints > Conservative Assumptions`
要求：
- 说明为什么要保守处理
- 说明如果假设不成立，会影响什么

---

## 4. 输入与产物必须闭环映射
`analysis.md` 中：
- `# User Inputs`
- `# Final Artifacts`

必须在 `plan.md` 中继续可见。

### 禁止
- 在分析阶段列出输入，但 plan 里丢失
- 在分析阶段列出产物，但 plan 里不再体现

### 必须
- plan 里的输入章节能覆盖 analysis 里的全部输入
- plan 里的产物章节能覆盖 analysis 里的全部最终产物

---

## 5. 不可简化项必须转成设计约束
`analysis.md` 中：
- `# Non-negotiable Contracts`

不能只停留在分析文档里。

必须继续进入 `plan.md` 中至少一个或多个章节：
- `# Architecture Plan`
- `# Workflow Plan`
- `# Review Framework Findings`

否则会出现：
- 分析时知道不能简化
- 方案里却忘了保留

---

# 四、最小核对清单

在写 `plan.md` 前，必须逐项核对：

- [ ] `analysis.md` 的 target nature / product mode / mode source，是否进入 `plan.md`
- [ ] `analysis.md` 的用户输入项，是否全部进入 `plan.md`
- [ ] `analysis.md` 的最终产物，是否全部进入 `plan.md`
- [ ] `analysis.md` 的环境/约束推断，是否进入 `plan.md` 的约束章节
- [ ] `analysis.md` 的用户确认约束，是否单独进入 `User-confirmed Constraints`
- [ ] `analysis.md` 中尚未确认但必须保守处理的内容，是否进入 `Conservative Assumptions`
- [ ] `analysis.md` 的不可简化项，是否进入 `plan.md` 的设计约束或 review 章节

---

# 五、执行要求

生成 `plan.md` 时，必须把 `analysis.md` 视为：

> 上游结构化真相来源

而不是可选参考。

如果 `plan.md` 的某个关键部分无法回溯到 `analysis.md`，应视为存在遗漏，必须补齐后再完成。