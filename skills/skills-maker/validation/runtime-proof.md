# Runtime Proof Rules

## 核心原则

benchmark 是一种 Runtime Proof，不是目的，也不是唯一真理。

正确顺序是：

1. 先验证目标对象是不是完整六段链 Skill
2. 再验证边界与 adopt 是否合理
3. 再验证 Flow / Surface 形状是否合理
4. 再验证最终输出是否更稳定、更有价值

---

## 可接受 proof 类型

### 1. benchmark
适用于：
- 看 route / adopt / negative case
- 看 description / router / boundary 是否有效

### 2. human review
适用于：
- 看六段是否完整
- 看边界是否清楚
- 看输出合同是否明确
- 看是否仍在说空话

### 3. real-task reuse
适用于：
- 看同类 Skill 创建 / 重构任务是否可复用
- 看是否减少反复修改
- 看是否减少边界冲突

### 4. downstream quality
适用于：
- 看产出的 Skill 是否更容易命中
- 看是否更容易 adopt
- 看是否更容易维护

---

## proof 设计约束

### 不要依赖窄字面量
合理答案可能存在多种自然表达。

### 不要把 self-report 当主判据
“agent 说自己用了某 Skill”不等于真的 adopt。

### 优先 black-box 证据
优先看：
- 输出物
- trajectory
- 工件
- 路由结果

---

## 按形状区分的 proof 重点

### 局部强化型
- 是否命中正确局部任务
- 是否没有误吸相邻任务
- 是否稳定完成局部不确定性压缩

### 组合编排型
- 顶层路由是否稳定
- 子路径选择是否合理
- handoff 是否清晰
- 是否提升复杂目标整体交付质量

### 多输入同构型
- 多输入下 workflow 是否一致
- 输出形状是否一致
- 是否存在某些输入被漏支持或特殊化过度

---

## 最小 proof 卡

```md
# Runtime Proof Card

- target skill:
- first thing to verify:
- proof types:
- black-box signals:
- allowed semantic variants:
- forbidden narrow literals:
- shape-specific risk:
```
