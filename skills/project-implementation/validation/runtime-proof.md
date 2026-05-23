# Project Implementation Runtime Proof

## 核心原则

`project-implementation` 的 proof 目标，不是证明“看起来在实施”，而是证明：

1. 实施请求命中了正确主路径
2. 命中后首动作真的被收敛了
3. 产出的证据与主路径匹配
4. 缺定义时能够及时回退

---

## 先验证什么

先验证命中后 agent 的**第一步**是否变化：
- build 请求先切片
- debug 请求先复现
- test 请求先建失败证明
- review 请求先看测试与验证故事
- ship 请求先确认 readiness / rollback 条件

如果第一步没变，说明父 Skill 还没真正生效。

---

## 核心 proof 维度

### 1. Route correctness
- 实施类请求是否命中本 Skill
- 定义类请求是否没有误吸进来

### 2. First-action correctness
- 是否按主动作词进入正确主路径
- 是否没有一开始同时展开多条路径

### 3. Minimal-read correctness
- 是否只先读一个主路径子 Skill
- 是否按需再补专项实现器

### 4. Artifact correctness
- build：是否产出切片代码与最小验证
- debug：是否产出 repro / root cause / regression guard
- proof：是否产出 failing → passing 的测试证据
- review：是否产出 findings / readiness
- ship：是否产出 readiness / rollout / monitoring / rollback 证据

### 5. Fallback correctness
- 当 success criteria / scope / contract 不清时，是否回退 `project-definition`

---

## 可接受 proof 类型

### human review
检查：
- 首动作是否正确
- 证据是否与主路径匹配
- 是否没有无意义横向发散

### real-task reuse
检查：
- build/debug/test/review/ship 五类任务是否稳定走不同首路径

### benchmark
适用于：
- 路由误吸
- 首路径选择错误
- 最小读取路径失效

### downstream quality
检查：
- 是否更少返工
- 是否更少“先乱改再回头补证明”

---

## 不允许依赖
- 不依赖 agent 自述“我在 build / debug / test / review”
- 不依赖名词命中证明 adoption
- 不把 benchmark 分数当唯一真理
