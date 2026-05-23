# Output Contract Rules

## 核心原则

Skill 的输出合同必须约束：

1. 命中后最终产出什么
2. 什么算 adopt
3. 什么不算完成
4. 生成 / 重构 / 审计时最低必须交付哪些结构化材料

没有输出合同，Skill 很容易退化成空泛建议机。

---

## 为什么当前 Skill 容易漂移

如果输出合同只要求：
- 一句话定义
- 六段骨架
- 边界说明
- 最小文件结构

但没有要求：
- 边界包是否可判别
- 结构决策是否有理由
- adopt 判据是否明确
- 审计时是否给出最小修复顺序

那么 agent 很容易“看起来完成”，其实没有产出能真正约束后续行为的材料。

---

## 通用强输出合同

任何由 `skills-maker` 生成、重构或审计的 Skill，至少应产出：

1. 一句话定义
2. 六段骨架
3. 边界包
4. 结构决策表
5. adopt / complete 判据
6. proof 方案

---

## 按任务模式区分的必交付物

### A. create
至少交付：
- 一句话定义
- 六段骨架
- 边界包
- 结构决策表
- 输出合同卡
- runtime proof 方案

### B. refactor
至少交付：
- 当前版本存在什么漂移
- 修后的六段骨架
- 修后的边界包
- 修后的结构决策表
- 为什么这样改更稳
- 回归验证方法

### C. audit
至少交付：
- 当前 Skill 的主要漂移点
- 缺失项（边界 / 结构 / proof / adopt）
- 风险等级或优先级
- 最小修复顺序
- 修后如何验证不回退

---

## adopt 判据必须写清什么

### 什么算 adopt
至少要能观察到：
- route 到了正确目标
- 命中后发生了该 Skill 特有的 first action
- 输出开始呈现该 Skill 预期的结构或证据

### 什么不算 adopt
以下都不算：
- 只在口头上说“我会用这个 Skill”
- 只复述 description
- 题材相关，但首动作没有变化
- 输出仍然是通用建议，没有进入目标 workflow

---

## 结构决策也属于输出合同的一部分

输出合同不能只写“会有 `SKILL.md / references / scripts`”。
必须写清：
- 哪些文件是 `required`
- 哪些文件是 `optional`
- 哪些文件是 `forbidden`
- 每个文件承载什么
- 它是 runtime surface 还是外部验证资产

否则“最小结构方案”会退化成松散目录建议。

---

## Shape-aware 合同重点

### 局部强化型
重点约束：
- 单点方法是否清晰
- 输出是否足够窄
- 是否能稳定完成 bounded work
- 是否没有误吸相邻任务

### 组合编排型
重点约束：
- 总入口是否清晰
- 子路径是否明确
- 最小读取路径是否清晰
- handoff 是否稳定
- route 对了之后是否真的进入对应子路径

### 多输入同构型
重点约束：
- 多输入是否进入同一 workflow
- 输出形状是否一致
- 不同输入之间是否需要特殊分支
- 是否存在未覆盖的输入类型

---

## 不合格输出的典型表现

以下情况都不算完成：

- 只改了 description，没有六段骨架
- 只有边界，没有输出形状
- 只有 benchmark 想法，没有 Skill 本体
- 只讲理念，没有结构决策表
- 说了很多“应该更清晰”，但没有明确产物
- 写了 should-trigger / should-not-trigger，但没有正负例与正确去向
- 列了文件名，但没有说明为什么需要它们
- route 看似正确，但没有 adopt 判据

---

## Strong Output Contract Card

```md
# Output Contract Card

- target skill:
- task mode: create / refactor / audit
- one-line definition:
- final deliverable:
- what counts as adopt:
- what does not count as complete:
- minimum required artifacts:
- structure decision summary:
- proof plan:
- regression check after change:
```
