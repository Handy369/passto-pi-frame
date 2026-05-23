# Skill Explore Handoff

## 目标

当 `skills-maker` 的当前任务与**真实 runtime 证据**有关时，先主动消费 `passto-context / skill-explore` 已有产物，
再进入 `Why → What → Structure → Flow → Surface → Runtime Proof` 六段链。

这份 reference 解决的不是“怎么改 Skill 文案”，而是：

1. 什么时候必须先读 `skill-explore` 产物
2. 应该优先读哪一层产物
3. 读完后如何把证据映射回 create / refactor / audit 三种任务模式
4. 没有证据时如何显式降级，而不是假装已有 runtime proof

---

## 核心原则

### 1. `skill-explore` 是证据面，不是裁决器
它提供：
- observed usage facts
- aggregate summary
- review bundle / handoff bundle

它不直接替代：
- 六段骨架
- 边界包
- 结构决策
- `skills-maker` 的最终方法判断

### 2. 先读收敛物，再回底层事实
若已有 bundle / aggregate，不要一上来翻 session 原始事实。
优先读取更靠近 handoff 的收敛产物，只有需要核实时再下钻。

### 3. 用过证据不等于问题已关闭
若看到 receipt / reviewed 索引，只能说明“之前有人消费过这个 bundle”。
不能直接推出：
- 已 adopt
- 已修好
- 当前无需继续处理

### 4. 没有证据时必须显式标注
当当前任务明显需要 runtime 证据，但 `skill-explore` 产物不存在、缺失或不足时，
最终输出中必须显式写出：
- 当前缺少哪类证据
- 本次判断基于什么替代依据继续
- 后续该补什么 proof

---

## 何时必须主动读取 `skill-explore`

当出现以下任一情形时，`skills-maker` 应主动读取 `skill-explore` 产物：

### A. 用户明确要求基于真实使用情况改 Skill
例如：
- “基于真实使用情况做一个新 Skill”
- “根据 skill-explore 的结果优化这个 Skill”
- “看看这个 Skill 是否该拆分 / 合并 / routerize”
- “根据运行证据判断是不是需要新 Skill”

### B. 当前任务的主问题就是 runtime 行为
例如：
- repeated mis-hit / over-trigger
- repeated no-read successful pattern
- repeated correction soon after read
- repeated subagent-only usage
- benchmark seed 需要来自自然样本

### C. 当前输入里已经有明确证据入口
例如：
- handoff bundle 路径
- aggregate 路径
- `~/.passtocontext/skill-explore/...` 文件路径
- 用户明确提到 `skill-explore` / `passto-context` runtime-proof

---

## 何时可以不读

若当前任务属于以下情形，可不强制读取 `skill-explore`：

1. 极小文案修补
2. 与 runtime 行为无关的纯方法骨架重写
3. 只做结构整理，不涉及 create / refactor / audit 判断
4. 用户明确要求先不要看历史 runtime 证据

此时可直接沿 `framework / boundary / output-contract / templates` 路径继续。

---

## 优先读取顺序

若存在 `skill-explore` 产物，建议按以下顺序读取：

### 0. ready 索引发现（仅当前置发现层）
当用户**没有直接提供 bundle 路径**时，先检查：

```text
~/.passtocontext/skill-explore/handoff/skills-maker/indexes/ready.json
```

使用规则：
- 它只是**发现入口**，不是主真相源
- ready 候选当前采用最小排序：`target skill > newer > richer signals`
- 若当前任务已显式指向某个 target skill，可先在 ready 列表中优先匹配该 skill（`skillKey / skillName / skillPath`）
- 在同一候选池内，先按 `createdAt` 取较新者；只有时间并列时，才用 `notableSignals total -> usageFactCount -> totalReads` 作为 richer signals tie-breaker
- 若未命中 target skill，再回退到全量 ready 候选，并按同一排序选出 1 条
- 拿到 `bundleFile` 后，立即回到 bundle 本体继续读取
- 若 `ready.json` 不存在、为空或读取失败，必须显式降级：标注当前缺少可用 runtime evidence，再按普通 `skills-maker` 流程继续

### 1. handoff bundle
优先读：

```text
~/.passtocontext/skill-explore/handoff/skills-maker/bundles/<bundleId>.json
```

它最接近 `skills-maker` 的消费面，通常已包含：
- target skill
- scope
- summary
- review focus
- open questions
- artifact refs

### 2. aggregate summary
若没有 bundle，再读：

```text
~/.passtocontext/skill-explore/aggregates/by-skill/<skillKey>/<versionKey>/summary.json
```

必要时补：
- `task-shapes.json`
- `evidence-index.json`

### 3. joined usage facts
若需要理解模式来源，再读：

```text
~/.passtocontext/skill-explore/joins/skill-usage-facts/*.jsonl
```

### 4. session-scoped round facts
只有底层核实时才回读：

```text
~/.passtocontext/skill-explore/sessions/<sessionKey>/round-skill-usage-facts.json
```

---

## 读完后要提取什么

不论任务模式是 `create` / `refactor` / `audit`，读完 `skill-explore` 后至少要抽取：

1. **目标对象**
   - 哪个 Skill / 哪类新 Skill 候选
2. **证据范围**
   - 时间窗、session 数、样本数、version 范围
3. **重复模式**
   - representative hits
   - correction-soon cases
   - ambiguous boundary cases
   - subagent-only cases
   - nearby no-read peer shapes
4. **当前 open questions**
   - 需要 tighten 还是 broaden
   - 需要 split / merge / routerize 还是 create-new-skill
5. **是否已有历史消费记录**
   - 是否存在 reviewed / receipt
   - 若存在，之前结论是什么，当前是否已 superseded

---

## 如何映射回三种任务模式

### A. create
更关注：
- repeated no-read successful pattern
- 用户提出新 Skill 需求
- 现有 Skill 都不合适的稳定任务形状

映射回六段链时，要重点回答：
- 为什么现有 Skill 集合没有覆盖这类任务
- 新 Skill 的边界应该收在哪里
- 它与相邻 Skill 的分流点是什么
- 后续该拿哪些 runtime 样本做 proof

### B. refactor
更关注：
- repeated correction soon after read
- repeated ambiguous boundary
- repeated over-trigger / under-trigger
- subagent usage 暗示入口层级不对

映射回六段链时，要重点回答：
- 问题出在 description、examples、first action、router 还是 child binding
- 应该调边界、补例子、改 flow，还是拆分结构
- 修后如何用现有 bundle / aggregate + benchmark 做回归

### C. audit
更关注：
- 当前 Skill 的漂移点是否已被 runtime 证据支持
- 证据是否足以支持 create / refactor 判断
- 当前 proof 是否只停留在文案层，尚未接上 organic runtime proof

映射回六段链时，要重点回答：
- 哪些判断已经有 runtime support
- 哪些判断仍然只是推测
- 最小修复顺序是什么
- 下一轮最该补哪类 evidence

---

## 读完之后如何进入六段链

`skill-explore` 产物不会替代六段链，而是要被映射进去：

### Why
- 为什么需要新 Skill / 为什么现有 Skill 需要迭代
- 如果不改，agent 会继续在哪类真实任务中漂移

### What
- 本次真正要解决的边界 / 漏吸 / 误吸 / workflow 问题是什么
- 主输出物是新 Skill、重构方案还是审计结论

### Structure
- 是否需要新增 `references/skill-explore-handoff.md` 类的 runtime evidence 接口
- 是否需要新增 router / child binding / examples / validation 资产

### Flow
- 命中后第一步是否需要改变
- 是否要增加“先检查 runtime evidence”的 adopt 前置动作

### Surface
- description、examples、references、source map、bundle 消费顺序如何体现

### Runtime Proof
- 哪些 `skill-explore` bundle / aggregate 是本次修后的 natural proof
- 还需要哪些 benchmark / black-box review 做补强

---

## 输出要求（使用本 reference 时）

当本 reference 被采用时，最终输出至少应补充以下内容：

1. **本次是否读取了 `skill-explore` 产物**
2. **读取了哪一层**
   - ready-index（latest / target-skill / latest-fallback）→ bundle / bundle / aggregate / joins / sessions
3. **读取路径或证据来源**
4. **这些证据如何影响 create / refactor / audit 判断**
5. **若没有读到可用证据，显式写出缺口与降级理由**

没有这些补充，说明只是“提到了 runtime 证据”，还不算真正 adopt 了本 reference。

---

## 不要做什么

- 不要把 aggregate 数字直接当成最终 verdict
- 不要看到 reviewed receipt 就停止重新判断
- 不要为了“看起来有证据”而跳过六段链
- 不要一上来读取最底层 round facts，忽略 bundle / aggregate
- 不要把 `skill-explore` 结果持续注入普通 domain 任务 prompt

---

## 最小 adopt 信号

若 `skills-maker` 真正 adopt 了本 reference，应至少出现以下信号：

1. 明确判断当前任务是否需要 runtime evidence
2. 按推荐顺序读取 `skill-explore` 产物；若无显式 bundle 路径，则会先查 `ready.json` 再读 bundle 本体
3. 在输出中引用这些证据，而不是只复述用户的话
4. 把证据映射回 `create / refactor / audit` 的六段链判断
5. 若证据不足，显式标注缺口与后续 proof 建议
