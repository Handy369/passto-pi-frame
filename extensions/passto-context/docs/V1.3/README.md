# PasstoContext V1.3 版本迭代说明

> 版本：v1.3 | 状态：Generator 方法论强化已落地 | 更新：2026-05-18

---

## 1. 版本目标

V1.3 的目标指向不是单点补丁，而是一次**完整版本迭代**。

但当前阶段的收敛结论已经更新为：

> **先只强化 Generator，不同时展开 Curator / Reflector / Compaction 的并行改造。**

并且当前已落地的路线不是 `GeneratorWorkSlice`，而是：

> **先把 Generator 的方法论 prompt 做实。**

原因：

1. 当前 GRC 的主要短板不在事件接线，而在 **Generator 方法论骨架太弱**；
2. `before_agent_start` + `context` 已经提供了较完整的上下文输入面；
3. 当前主问题不是“缺一个新对象”，而是“缺一套更明确的上下文消费方法论”；
4. 如果过早引入 `GeneratorWorkSlice`，会提前波及 Curator / Reflector 的结构化适配。

因此，V1.3 当前阶段的主定义是：

- **主目标**：强化 Generator
- **主实现面**：stronger Generator Charter / Contract
- **暂不展开**：Curator schema 重构、Reflector contract 升级、Compaction 主路径改造

---

## 2. 本阶段范围

### In Scope

- 强化 Generator 的五维工作框架：
  - Why
  - What
  - Flow
  - Structure
  - Runtime Proof
- 强化 Generator 对当前上下文窗口的使用方式
- 强化“当前目标服务于更上层目标”的判断要求
- 强化 `Runtime Proof` 先于动作的约束
- 保持增强面仍然是 prompt / messages，而不是新 runtime object

### Out of Scope

- 定义 `GeneratorWorkSlice`
- 定义 `GoalState / SummaryCache / Reflector Advice -> GeneratorWorkSlice` 投影规则
- 重写 Curator 输出协议
- 扩大 Reflector 的角色边界
- 引入新的 rich truth source
- 重写 memory 系统
- 改造 Pi 原生 session 语义
- 在本阶段引入新的 apply / verify kernel

---

## 3. 当前文档索引

- `generator_v1.3.md`
  - V1.3 当前阶段的主文档
  - 负责描述 Generator 当前阶段的源码现实、方法论框架与实现状态
- `generator_v1.3_change_note.md`
  - 本轮变更摘要 / ADR 风格记录
  - 负责说明为什么从 `GeneratorWorkSlice` 路线收敛到“先强化 Generator 方法论 prompt”

---

## 4. 当前收敛口径

V1.3 当前不是“全面升级 GRC”，而是：

> **先把 Generator 从“会综合上下文的主 LLM”提升为“围绕 Why / What / Flow / Structure / Runtime Proof 稳定推进的执行生成器”。**

当 Generator 方法论稳定后，再决定是否继续扩到：
- Curator 输出收敛
- Reflector 纠偏闭环增强
- Compaction 与 Summary warehouse 的进一步协同
