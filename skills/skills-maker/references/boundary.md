# Boundary Rules

## 目标

边界设计的目标不是“尽量多命中”，而是：

1. 该触发时能触发
2. 不该触发时不误吸
3. 命中后 agent 知道下一步怎么做
4. 与相邻 Skill 相遇时，能解释为什么该走这里、不该走那里

---

## 为什么当前 Skill 容易漂移

边界一旦只写成几条名词或触发词，agent 就容易：
- 看到题材相近就误命中
- route 对了，但 adopt 不稳定
- 命中后继续输出空泛建议，而不是进入目标 workflow

所以边界不能只写 `should-trigger`，必须写成一个**边界包**。

---

## 边界包最低要求

每个 Skill 至少写清以下 8 项：

1. `current main output`
2. `current main action`
3. `should-trigger`
4. `should-not-trigger`
5. `adjacent destination`
6. `non-goals`
7. `first action after hit`
8. positive / negative examples

没有第 5–8 项，边界通常仍然过薄。

---

## 边界写法顺序

推荐顺序：

1. 先写 `should-not-trigger`
2. 再写 `adjacent destination`
3. 再写 `should-trigger`
4. 最后写命中后的首个动作与正负例

先写排除边界，更容易防止过宽。

---

## 边界判断优先级

### 1. 先看当前主输出物
优先问：当前回合最终要交付什么？

### 2. 再看当前主要动作
例如：
- 定义
- 实施
- 调试
- 审查
- 文档处理
- 运行时验证
- Skill 生成 / Skill 分析 / Skill 审计

### 3. 再看采用后的首动作
同题材请求，若命中后首动作不同，往往已经不是同一个 Skill。

### 4. 最后才看名词和触发词
不要只靠“用户提到了某个术语”就命中。

---

## 必须写出的相邻对照

每个 Skill 至少要明确：

- 最容易混淆的 2–4 个相邻 Skill / workflow
- 为什么不该由自己吸收它们
- 如果误命中，会漂移成什么错误产物

常见缺陷是：
- 只写“我做什么”
- 不写“别人也会像我，但我不该接什么”

---

## 正负例要求

### 正例
至少给出：
- 2–3 个自然语言正例
- 每个正例说明“为什么该触发”
- 每个正例说明“命中后应出现什么 adopt 信号”

### 负例
至少给出：
- 2–3 个自然语言负例
- 每个负例说明“为什么不该触发”
- 每个负例写出**正确去向**

没有正确去向，`should-not-trigger` 仍然太弱。

---

## non-goals 与 should-not-trigger 的区别

### `should-not-trigger`
回答：什么请求根本不该进来？

### `non-goals`
回答：即使命中了，也不应该顺手扩做什么？

典型例子：
- `should-not-trigger`：纯实现请求不该进定义 Skill
- `non-goals`：命中定义 Skill 后，不顺手扩成完整 PRD / 代码实现 / benchmark 改造

---

## first action 的作用

`first action after hit` 用于防止 route 对了但 adopt 漂移。

它至少要回答：
- 命中后先读什么 / 先判断什么 / 先产出什么
- 如果这个首动作没有发生，就说明 Skill 还没有真正 adopt

---

## 常见边界错误

### 错误 1：只有 should-trigger，没有 should-not-trigger
会导致 Skill 过宽。

### 错误 2：只写领域词，不写动作词
会导致 hit 后不会 adopt。

### 错误 3：不写正确去向
会导致 handoff 漂移和相邻冲突长期存在。

### 错误 4：没有正负例
会导致边界只能靠作者主观理解，无法复用。

### 错误 5：不写 first action
会导致路由看似正确，但行动退化成空泛建议。

---

## Boundary Pack Template

```md
# Boundary Pack

- target skill:
- current main output:
- current main action:
- adjacent skills / workflows:

## should-not-trigger
- request type:
- why not:
- correct destination:

## should-trigger
- request type:
- why yes:
- expected adopt signal:

## non-goals
- even if hit, do not expand into:

## first action after hit
- first read / first decision / first deliverable:

## positive examples
- example:
  - why should trigger:
  - expected adopt signal:

## negative examples
- example:
  - why should not trigger:
  - correct destination:
```

---

## 形状提示

形状不是结构，但会影响边界书写重心：

- **局部强化型**：重点防止过宽，正负例要窄
- **组合编排型**：重点防止子路径冲突，必须写清 route 与 handoff
- **多输入同构型**：重点防止输入覆盖不全，必须证明多输入仍会进入同一 workflow
