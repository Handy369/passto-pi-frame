# Project Definition Runtime Proof

## 核心原则

`project-definition` 的 proof 目标，不是证明“文档写得多”，而是证明：

1. 定义类请求能被正确接住
2. 只读最少必要材料也能稳定产出定义类交付物
3. 子 Skill 调用发生在正确节点
4. 定义足够后能稳定 handoff 给 implementation

---

## 先验证什么

先验证输出是否仍然属于：
- problem framing
- JTBD
- research synthesis
- spec / scope
- flow / IA / architecture proposal
- roadmap / implementation plan

如果已经滑到写代码、跑测试、修 bug，就说明越界了。

---

## 核心 proof 维度

### 1. Route correctness
- 定义类请求是否命中本 Skill
- 实施类请求是否没有误吸进来

### 2. Minimal-read correctness
- 是否先选一个主 reference / 主子 Skill
- 是否避免了一次性加载所有设计 / PM / spec / planning 材料

### 3. Child-skill correctness
- `idea-refine` 是否只用于前期澄清
- `spec-driven-development` 是否只用于 spec 结构化
- `planning-and-task-breakdown` 是否建立在足够明确的 spec 之上

### 4. Handoff correctness
- 当定义已经足够清晰时，是否能停止继续扩展
- 是否能稳定转交 `project-implementation`

---

## 可接受 proof 类型

### human review
检查：
- 输出是否减少猜测
- 边界是否清晰
- 产物是否能直接支持实施

### real-task reuse
检查：
- 不同定义类任务是否都能稳定走到正确主路径
- 是否减少在 definition / implementation 之间来回摇摆

### benchmark
适用于：
- 路由冲突
- 最小读取路径
- 子 Skill 误用 / 过用

### downstream quality
检查：
- 下游 implementation 是否因为定义清晰而更稳定
- 实施侧是否更少反复返工

---

## 不允许依赖
- 不依赖 agent 自述“我用了 project-definition”
- 不依赖单一字面量证明 adopt
- 不把 benchmark 分数当唯一真理
