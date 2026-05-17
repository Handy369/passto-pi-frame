# PasstoContext Skill Explore / Runtime Proof 插件设计

> 版本：v1.1  
> 状态：v1.1 收口完成；v1.2 最小闭环已落地，扩展项待继续  
> 更新：2026-05-17

---

## 1. 收敛结论

`skill-explore` 在 v1.1 中已不再按“独立 Skill Evidence Warehouse”推进。

当前真实收敛形态是：

> **PasstoContext 宿主内的一个 hosted plugin：在 `agent_end` 读取当前 session branch，轻量抽取 Skill 读取事实，持久化到 `~/.passtocontext/skill-explore/`，并把结果回流到 widget 的 `记:` 指标。**

它的定位是：

1. 为 `skills-maker` / Skill Intelligence 提供**最底层、真实、可回放**的 runtime-proof 原始证据
2. 用最小宿主侵入方式验证 **top-agent / subagent Skill 读取都能被观测到**
3. 暂不承担 `summaryEntry join`、跨 session aggregate、opportunity hypothesis、benchmark handoff 等更高层能力

为避免版本口径继续混淆，本文自此固定区分三件事：

- **v1.1 收口目标**：已完成
- **当前代码基线**：已在不回退 v1.1 的前提下，补入 v1.2 的最小 handoff / consumption-proof 闭环
- **后续未完成项**：除非特别标注，均指 v1.2 扩展项，不再作为“v1.1 未完成”表述

也就是说：

**v1.1 已完成的是：**
- **L0：Observed Usage Facts**
- **部分运行态 surface：widget 统计回显**
- **真实 runtime-proof 闭环：top-agent / subagent 双场景验证通过**

**当前代码基线进一步已落地的是：**
- `SkillUsageFact` / `SkillAggregateSummary` / aggregate 落盘
- `SkillReviewBundle` / `BundleReceipt` / ready-reviewed 索引
- ready bundle 主动扫描与选择策略：`target skill -> newer -> richer signals`
- `ready -> bundle -> receipt` 的真实 consumption proof
- `/ptc skills status|ready|reviewed|aggregate|export` 命令面
- `skill-review-model.json` / `review.html` 导出 surface

**仍未完成的是 v1.2 扩展项：**
- `summaryEntry + skill read` join
- cross-session task-shape aggregate
- opportunity hypotheses
- write-back review workflow / Outcome Proof 完整闭环

---

## 2. Why

### 2.1 先把“真实命中证据”做对，再谈高层判断

Skill Intelligence 最容易犯的错误，是在没有稳定 runtime 证据链之前，过早引入：

- should-hit / should-not-hit 判定
- effective / ineffective 归因
- aggregate / warehouse / benchmark handoff

但当前最先需要被证明的，不是“结论层”，而是：

1. top-agent 的 `read SKILL.md` 能否稳定抓到
2. subagent nested transcript 里的 `read SKILL.md` 能否不漏检
3. 这些事实能否在宿主真实 session 中稳定落盘
4. session 重开时，宿主能否从 branch 恢复出最小运行态统计

v1.1 的 `skill-explore` 就是为这个目标收敛的。

---

### 2.2 选择 plugin，而不是独立项目

当前真实架构中，`skill-explore` 已重定位为：

- **宿主**：`/Users/handy/dev/passto-ai/extensions/passto-context`
- **插件落点**：`plugin/skill-explore/index.ts`
- **产物目录**：`~/.passtocontext/skill-explore/`

这样做的原因：

1. **证据源天然在宿主 branch**  
   Skill 读取事实来自当前 session jsonl / branch，本就属于 PasstoContext 宿主运行态。

2. **主触发点天然是 `agent_end`**  
   证据应在一轮执行结束后统一抽取，而不是在中途或脱离宿主异步猜测。

3. **widget 回显需要宿主直接消费**  
   `记:` 指标是宿主 widget 的一部分，最自然的方式是插件产物回流宿主状态。

4. **可先证明最小 runtime-proof，再决定是否外扩**  
   在 top-agent / subagent 真实验证通过之前，不值得先做独立 warehouse 和复杂命令面。

---

## 3. What

### 3.1 当前主目标

在 PasstoContext 宿主中提供一条**轻量、真实、可回放**的 Skill 读取事实采集链，专门回答：

- 哪一轮读了 `SKILL.md`
- 是谁读的：`top-agent` 还是 `subagent`
- 这次读取属于哪个 `agentRound`
- 对应 session 的总 Skill 读取数是多少

---

### 3.2 当前主输出物

当前实现已形成四层 artifact，加一个运行态 UI 指标：

1. **L0：session-scoped runtime evidence**
   - `round-skill-usage-facts.json`
   - `skill-explore-summary.json`
   - `latest/latest-session.json`
2. **L1/L2：aggregate / review-input 层**
   - `joins/skill-usage-facts/*.jsonl`
   - `aggregates/.../summary.json`
   - `aggregates/.../task-shapes.json`
   - `aggregates/.../evidence-index.json`
3. **L3：handoff / consumption-proof 层**
   - `handoff/skills-maker/bundles/*.json`
   - `handoff/skills-maker/receipts/*.json`
   - `handoff/skills-maker/indexes/ready.json`
   - `handoff/skills-maker/indexes/reviewed.json`
4. **L4：review export surface**
   - `exports/<timestamp>[-<target-skill>]/skill-review-model.json`
   - `exports/<timestamp>[-<target-skill>]/review.html`

以及一个运行态 UI 指标：

5. widget `记:<principlesExtracted>+<skillReadCount>`

---

### 3.3 当前明确不做

以下能力当前**仍不是已完成实现面**：

- 不做 should-hit / should-not-hit verdict
- 不做 effective / harmful 归因
- 不把结果注入主 prompt
- 不接管 Curator / Reflector 职责
- 不自动改 Skill 文件
- 不提供写回型 review workflow（如 decision import / adopt / approve）
- 不自动生成 benchmark 裁决 / 完整 dashboard

---

## 4. 代码落点与宿主关系

### 4.1 插件落点

```text
/Users/handy/dev/passto-ai/extensions/passto-context/plugin/skill-explore/index.ts
```

### 4.2 宿主接入点

宿主 `index.ts` 当前有两处直接接入：

#### A. `session_start`

从当前 branch 重建最小运行态统计：

- 调用 `getSkillExploreRuntimeSnapshotFromBranch(branch, activeSessionFile)`
- 恢复 `skillReadCountCurrentSession`
- 让 widget 在 reload / resume 后继续显示当前 session 的 Skill 读取计数

#### B. `agent_end`

在每个 agent round 结束时：

- 读取当前 branch
- 调用 `runSkillExploreAgentEndBridge(...)`
- 重新持久化当前 session artifact
- 用最新汇总结果更新 `skillReadCountCurrentSession`

这意味着当前主触发链已经固定为：

```text
session_start -> restore snapshot
agent_end     -> extract + persist + refresh widget
```

而**不是**：

- `before_agent_start` 注入
- 独立后台 aggregate worker
- 独立命令触发 rebuild

---

## 5. Runtime Flow

### 5.1 总体流程

```text
session_start
  └─ 从 branch 读取历史消息
      └─ 恢复当前 session 的 skillReadCount

agent_start
  └─ 宿主写入 passto-round-boundary

agent_end
  └─ 读取当前 branch
      ├─ 抽取 top-agent read SKILL.md
      ├─ 递归解析 subagent toolResult.details.results[*].messages
      ├─ 生成按轮事实 roundFacts
      ├─ 生成 session summary
      ├─ 写入 ~/.passtocontext/skill-explore/
      └─ 更新 widget 中的 skillReadCount
```

---

### 5.2 事实抽取规则

当前抽取器只关心非常小的一组稳定事实：

1. assistant message 中的 `toolCall`
2. `toolCall.name === "read"`
3. `arguments.path` 指向 `.../SKILL.md`
4. 若来自 nested subagent transcript，则 `source = "subagent"`
5. 若来自宿主当前 assistant transcript，则 `source = "top-agent"`

并且通过 `passto-round-boundary` 把读取事实映射回具体 `agentRound`。

---

## 6. 数据结构

以下结构与当前 `plugin/skill-explore/index.ts` 实现对齐。

### 6.1 SkillReadObservation

```ts
interface SkillReadObservation {
  sessionFile: string | null;
  agentRound: number | null;
  source: "top-agent" | "subagent";
  toolName: "read";
  skillPath: string;
  skillFileName: string;
  entryIndex: number;
  subagentName?: string;
  subagentTask?: string;
}
```

说明：
- `source` 是当前最关键的 proof 字段
- `subagentName / subagentTask` 只在 `source = subagent` 时出现
- 当前不做 `descriptionHash`、task-shape、effect proxy

---

### 6.2 SkillExploreRoundFact

```ts
interface SkillExploreRoundFact {
  sessionFile: string | null;
  agentRound: number;
  boundary: SkillExploreRoundBoundary | null;
  skillReads: SkillReadObservation[];
  hasSkillReads: boolean;
}
```

说明：
- 它是当前实现中的最小“按轮事实面”
- 重点是把 Skill 读取与 `agentRound` 对齐

---

### 6.3 SkillExploreSessionSummary

```ts
interface SkillExploreSessionSummary {
  sessionFile: string | null;
  sessionKey: string;
  updatedAt: string;
  totalSkillReads: number;
  roundsWithSkillReads: number[];
  countsByRound: Array<{
    agentRound: number;
    skillReadCount: number;
  }>;
}
```

说明：
- 当前 summary 只回答 session 级计数问题
- 还不是跨 session aggregate

---

### 6.4 SkillExploreRuntimeSnapshot

```ts
interface SkillExploreRuntimeSnapshot {
  skillReadCount: number;
}
```

说明：
- 它是 `session_start` 恢复 widget 状态时用的最小 runtime 视图
- 故意保持极轻

---

## 7. 存储设计

### 7.1 根目录

```text
~/.passtocontext/skill-explore/
```

### 7.2 当前真实目录结构

```text
~/.passtocontext/skill-explore/
├── latest/
│   └── latest-session.json
└── sessions/
    └── <sessionKey>/
        ├── round-skill-usage-facts.json
        └── skill-explore-summary.json
```

### 7.3 设计含义

- `sessions/<sessionKey>/...`：保存 v1.1 最小基线所需的 session 粒度事实
- `latest/latest-session.json`：提供最新一次持久化的定位入口
- 当前实现已在这一基线之上补入 `joins/`、`aggregates/` 与 `handoff/skills-maker/` 三层目录，用于 v1.2 最小闭环

这代表当前代码基线应被理解为：

> **v1.1 的 session-scoped runtime-proof 基线 + v1.2 的最小 handoff / consumption-proof 层**

而不是“只剩 session-scoped artifact”或“已经完成全部 Skill Intelligence 扩展”。

---

## 8. Widget 语义

### 8.1 当前格式

widget 当前真实格式为：

```text
Run:<turnRound> <contextUsage> | 记:<principlesExtracted>+<skillReadCount> | 思:<reflector> | 理:<curator>
```

例如：

```text
Run:11 7.5k | 记:28+4 | 思:✓ | 理:✓
```

### 8.2 `记:` 语义约束

`记:` 的左右两部分当前语义必须保持：

- 左侧：`principlesExtracted`
- 右侧：`skillReadCount`

即：

```text
记:<principlesExtracted>+<skillReadCount>
```

这里左侧语义已经被明确要求保持现状，不允许偷换成别的统计。

---

## 9. Runtime Proof（正式记录）

以下记录基于**真实本地 Pi CLI session + 实际落盘 artifact**，不是单元测试伪造数据。

---

### 9.1 RP-001：top-agent Skill 读取可被稳定观测

**验证目标**
- 证明宿主顶层 agent 自己读取 `SKILL.md` 时，`skill-explore` 能在 `agent_end` 后正确落盘

**真实 session**
- session file:  
  `/Users/handy/.pi/agent/sessions/--Users-handy--/2026-05-17T07-05-49-368Z_019e34c1-6237-7591-8045-18f45a0fba5b.jsonl`
- session key:  
  `--Users-handy---2026-05-17T07-05-49-368Z_019e34c1-6237-7591-8045-18f45a0fba5b-2o1ziw`

**输入指令**
- 用户要求主 agent 先使用 `read` 读取：  
  `/Users/handy/.claude/skills/project-implementation/SKILL.md`
- 然后只回复 `OK`

**原始 transcript 证据**
- session jsonl 第 6 行：assistant 发起 `read` toolCall
- session jsonl 第 7 行：toolResult 返回 `project-implementation/SKILL.md` 内容
- session jsonl 第 8 行：assistant 回复 `OK`

**artifact 证据**
- round facts 文件：  
  `/Users/handy/.passtocontext/skill-explore/sessions/--Users-handy---2026-05-17T07-05-49-368Z_019e34c1-6237-7591-8045-18f45a0fba5b-2o1ziw/round-skill-usage-facts.json`
- 事实结果：
  - `agentRound = 1`
  - `source = "top-agent"`
  - `skillPath = "/Users/handy/.claude/skills/project-implementation/SKILL.md"`
  - `hasSkillReads = true`

**结论**
- top-agent 读取事实已被正确抽取并持久化

---

### 9.2 RP-002：subagent nested Skill 读取可被稳定观测

**验证目标**
- 证明 Skill 读取发生在 nested subagent transcript 中时，`skill-explore` 不会漏检

**真实 session**
- session file:  
  `/Users/handy/.pi/agent/sessions/--Users-handy--/2026-05-17T07-09-54-393Z_019e34c5-1f58-7324-b417-d0c7c565c5aa.jsonl`
- session key:  
  `--Users-handy---2026-05-17T07-09-54-393Z_019e34c5-1f58-7324-b417-d0c7c565c5aa-djpfm3`

**输入指令**
- 用户要求父 agent：
  1. 不自己使用 `read`
  2. 立即调用 `subagent`
  3. 让子 agent 先读取：  
     `/Users/handy/.claude/skills/subagent-guide/SKILL.md`
  4. 子 agent 只回复 `SUBAGENT_OK`
  5. 父 agent 最后只回复 `PARENT_OK`

**原始 transcript 证据**
- session jsonl 第 6 行：父 agent 发起 `subagent` toolCall
- session jsonl 第 7 行：`toolResult.details.results[0].messages[0]` 中，子 agent 发起 `read /Users/handy/.claude/skills/subagent-guide/SKILL.md`
- session jsonl 第 7 行同一 nested transcript 中，子 agent 最终回复 `SUBAGENT_OK`
- session jsonl 第 8 行：父 agent 回复 `PARENT_OK`

**artifact 证据**
- round facts 文件：  
  `/Users/handy/.passtocontext/skill-explore/sessions/--Users-handy---2026-05-17T07-09-54-393Z_019e34c5-1f58-7324-b417-d0c7c565c5aa-djpfm3/round-skill-usage-facts.json`
- 事实结果：
  - `agentRound = 1`
  - `source = "subagent"`
  - `skillPath = "/Users/handy/.claude/skills/subagent-guide/SKILL.md"`
  - `subagentTask` 被保留
  - `subagentName` 被保留
  - `hasSkillReads = true`

**结论**
- nested subagent transcript 的 Skill 读取已被正确递归解析并持久化

---

### 9.3 RP-003：`skills-maker` 可真实消费 bundle 并写回 receipt

**验证目标**
- 证明 `skill-explore` 产出的 L3 handoff bundle 可被 `skills-maker` 主动读取
- 证明 `skills-maker` 读取后会形成定义类输出，并写回 receipt

**真实输入来源**
- bundle 来源 session：
  `/Users/handy/.pi/agent/sessions/--Users-handy--/2026-05-17T07-05-49-368Z_019e34c1-6237-7591-8045-18f45a0fba5b.jsonl`
- 由该真实 session 构建出的 aggregate：
  `/Users/handy/.passtocontext/skill-explore/aggregates/by-skill/project-implementation/unversioned/summary.json`
- handoff bundle：
  `/Users/handy/.passtocontext/skill-explore/handoff/skills-maker/bundles/bundle_project-implementation_unversioned_49igst.json`

**消费步骤**
1. `skills-maker` 先读取：
   `/Users/handy/.claude/skills/skills-maker/SKILL.md`
2. 再读取 reference：
   `/Users/handy/.claude/skills/skills-maker/references/skill-explore-handoff.md`
3. 再按 reference 推荐顺序读取 handoff bundle：
   `/Users/handy/.passtocontext/skill-explore/handoff/skills-maker/bundles/bundle_project-implementation_unversioned_49igst.json`

**定义类输出证据**
- `skills-maker` 消费后产出的审计文档：
  `/Users/handy/dev/passto-ai/extensions/passto-context/docs/runtime-proof/skills-maker-p4-proof.md`
- 该文档显式记录：
  - 本次读取了 bundle
  - 读取路径
  - 证据如何影响判断
  - 当前缺口
  - 审慎结论：**先继续累积 runtime evidence，不立即重构 `project-implementation`**

**receipt 证据**
- receipt 文件：
  `/Users/handy/.passtocontext/skill-explore/handoff/skills-maker/receipts/bundle_project-implementation_unversioned_49igst/p4-proof-2026-05-17.json`
- receipt 结果：
  - `consumer = "skills-maker"`
  - `status = "reviewed"`
  - `outputDocPath = "/Users/handy/dev/passto-ai/extensions/passto-context/docs/runtime-proof/skills-maker-p4-proof.md"`

**结论**
- `skills-maker` 已能真实读取 bundle，而不是只停留在 reference 设计层
- bundle → 定义类输出 → receipt 的最小闭环已经成立
- 当前 bundle 仍然只覆盖单一样本，因此证明的是**消费链存在且可审计**，不是证明 `project-implementation` 已达到可重构阈值

---

### 9.4 当前 runtime-proof 结论

截至 2026-05-17，以下命题已被真实验证：

1. `agent_end` 桥接可稳定运行
2. `passto-round-boundary` 可用于 Skill 读取与 `agentRound` 对齐
3. top-agent 的 `read SKILL.md` 能被正确抽取
4. subagent nested transcript 中的 `read SKILL.md` 能被正确抽取
5. artifact 会稳定写入 `~/.passtocontext/skill-explore/`
6. widget 右侧 `skillReadCount` 可由 branch 恢复与 agent_end 持久化共同驱动
7. `skill-explore` 可从真实 aggregate 产出 handoff bundle
8. `skills-maker` 可真实消费 bundle、产出定义类输出并写回 receipt

---

## 10. 当前实现边界

### 10.1 已完成

- plugin 骨架
- 宿主 `agent_end` 接入
- 宿主 `session_start` 恢复接入
- top-agent 读取抽取
- subagent nested transcript 抽取
- session artifact 持久化
- widget `记:` 右侧计数接入
- 真实 runtime-proof 双场景验证
- `SkillUsageFact` / `SkillAggregateSummary` / aggregate 落盘
- `SkillReviewBundle` / `BundleReceipt` / ready-reviewed 索引
- 真实 P4：bundle → `skills-maker` 消费 → 输出文档 → receipt 闭环验证
- ready bundle 选择策略：`target skill -> newer -> richer signals`
- read-ready 脚本输出：`--format json | markdown`
- `/ptc skills status|ready|reviewed|aggregate|export` 命令面
- `skill-review-model.json` / `review.html` 导出 surface
- selection 口径已同步到脚本 / 测试 / proof 文档 / README

### 10.2 v1.2 仍未完成的扩展项（不阻断 v1.1 收口）

- `summaryEntry` join
- `SkillUsageFact` 语义层升级
- cross-session aggregate
- `descriptionHash` version bucket
- task-shape / cluster
- opportunity hypothesis
- benchmark handoff bundle
- write-back review workflow（如 decision import / adopt / approve）
- Outcome Proof 完整闭环

### 10.3 新增收敛：自动产 bundle（当前实现口径）

为缩短从 runtime evidence 到 handoff surface 的路径，当前实现已补上一条**最小自动产 bundle**链：

- `agent_end` 先落 session-scoped round facts / summary
- 若当前 branch 能构建出 `SkillUsageFact[]`，则继续自动构建 aggregate
- 对每个 aggregate 自动生成一份 `SkillReviewBundle`
- 新 bundle 落入 `handoff/skills-maker/bundles/*.json`
- 尚无 receipt 的 bundle 会出现在 `indexes/ready.json`
- 一旦 `skills-maker` 或 proof 脚本写回 receipt，该 bundle 会从 `ready.json` 转入 `reviewed.json`

这条自动化只负责：
- 把已存在的 runtime evidence 收敛成 handoff surface
- 保持 `ready/reviewed` 索引最新

这条自动化**仍然不负责**：
- 自动判定是否应立即重构某个 Skill
- 自动关闭旧 bundle 或做机会优先级排序

### 10.4 新增收敛：最小 ready 扫描消费面

在自动产 bundle 之后，当前又补上一条**最小主动扫描 ready bundle** 的消费面，用来证明 `skills-maker` 可以不依赖用户手喂 bundle 路径，而是先看派生索引再读取 bundle：

- 先读取 `handoff/skills-maker/indexes/ready.json`
- 若当前任务已明确指向某个 target skill，则优先匹配该 skill（`skillKey / skillName / skillPath`）
- 在候选池内先按 `createdAt` 选择较新者；只有时间并列时，才用 richer signals 断平（`notableSignals total -> usageFactCount -> totalReads`）
- 若未命中，则回退到全量 ready 候选，并按同一排序取最优 1 条
- 再读取该项对应的 bundle 文件
- 若 ready 为空，则显式返回“缺少 runtime evidence，按普通 skills-maker 流程继续”

这一层当前仍保持克制：
- 只做“是否存在可读 ready bundle”的 adopt 前置动作
- 不自动写 receipt
- 不自动生成 Skill 文档
- 不把 ready 索引当主真相源；真正的主读取对象仍是 bundle 本体

同时，`skills-maker` 自身的 runtime reference 现已补上这一 adopt 规则：
- `references/skill-explore-handoff.md` 已明确：用户未直给 bundle 路径时，可先查 `ready.json`，按 `target skill -> newer -> richer signals` 选择 1 条，再回读 bundle 本体
- `SKILL.md` 已把该动作写入 default minimal workflow
- 对应 proof 文档：`docs/runtime-proof/skills-maker-ready-adopt-proof.md`
- 进一步地，仓库现已补上真实端到端 proof：`docs/runtime-proof/skills-maker-ready-receipt-proof.md`，证明 ready 扫描不仅能读到 bundle，还能产出定义类输出并写回 reviewed receipt
- 当前 proof 样例已显式记录 selection 细节：`strategy / orderedBy / requestedTargetSkill / signalRichness.*`

---

## 11. 下一步设计约束

如果后续继续往 Skill Intelligence 扩展，必须遵守以下顺序：

1. **先保留当前 session-scoped runtime-proof 层不变**
2. 在其上新增 `summaryEntry join`，而不是改写当前 L0 事实层
3. 再考虑 cross-session aggregate
4. 最后才考虑 hypothesis / benchmark handoff

也就是说，后续高层能力必须建立在当前已验证的 `skill-explore` artifact 之上，而不是重写已有采集链。

---

## 12. v1.2 下一阶段设计：从 PasstoContext 产物到 Skills Maker 消费闭环

v1.2 的目标，不是把 `skill-explore` 直接升级成一个会自动改 Skill 的治理器；
而是把当前已经成立的 runtime-proof 产物，进一步收敛成：

> **PasstoContext 宿主产物 → skill-explore 聚合产物 → `skills-maker` 主动消费并生成“新 Skill / 迭代优化现有 Skill”输入包的稳定闭环。**

换句话说，v1.2 要解决的是：

1. `passto-context` 当前已经有大量 post-round 产物，但 `skills-maker` 还没有稳定入口去消费这些运行证据
2. `skill-explore` 当前只有 session-scoped facts / summary，还没有形成供 `skills-maker` 直接采用的聚合物
3. 当用户提出“做一个新 Skill”或“优化现有 Skill”时，`skills-maker` 还不会主动检查是否已有 `skill-explore` 证据可用
4. 当 `skill-explore` 自己发现重复模式后，也还没有一条正式 handoff 路径把这些证据交给 `skills-maker`

因此，v1.2 的真正主问题不是“再多收集一点日志”，而是：

> **如何把 PasstoContext 的运行态产物，收敛成 `skills-maker` 真正可读取、可引用、可回执的 evidence handoff surface。**

---

### 12.1 v1.2 的闭环定义

v1.2 期望形成以下稳定链路：

```text
PasstoContext host artifacts
  └─ skill-explore joins / aggregates / handoff bundles
      └─ skills-maker reference routing
          └─ new skill creation / existing skill refactor / boundary repair
```

#### 12.1.1 runtime-proof 的三层定义

在这条闭环里，`runtime-proof` 不应再被理解成某个单独文件、某条 benchmark 记录，或某份 bundle 本身；它更准确地是：

> **一条从真实运行证据 → `skills-maker` 消费判断 → 后续 Skill 演化结果的可追溯证据链。**

为避免把不同层混成一个概念，v1.2 起建议固定使用以下三个术语：

##### A. Runtime Evidence（运行证据）

定义：
> `skill-explore` 从真实运行中抽取出来、可回放的事实性证据。

它回答：
- 真实运行里发生了什么
- 哪个 Skill 被读了
- 它出现在哪类 task shape 中
- 后续 signal 是 `advance` 还是 `correct`
- 它是 `top-agent` 还是 `subagent`

当前对应 artifact 包括：
- `round-skill-usage-facts.json`
- `skill-explore-summary.json`
- `joins/skill-usage-facts/*.jsonl`
- `aggregates/.../summary.json`
- `aggregates/.../task-shapes.json`
- `aggregates/.../evidence-index.json`
- `handoff/skills-maker/bundles/*.json`

约束：
- 这些 artifact 是 `skills-maker` 的**证据输入层**
- aggregate / bundle 仍然只是 joined / aggregated evidence，不是最终 verdict

##### B. Consumption Proof（消费证明）

定义：
> 证明 `skills-maker` 真的消费了 runtime evidence，并把它用于 `create / refactor / audit` 判断。

它回答：
- `skills-maker` 是否真的读取了 `skill-explore` 产物
- 读取了哪一层（如 `ready-index -> bundle -> aggregate`）
- 这些证据是否真的影响了判断，而不是只被提及
- 判断结果是否被回写到 receipt / reviewed 索引

当前对应 artifact 包括：
- `docs/runtime-proof/skills-maker-p4-proof.md`
- `docs/runtime-proof/skills-maker-ready-adopt-proof.md`
- `docs/runtime-proof/skills-maker-ready-receipt-proof.md`
- `handoff/skills-maker/receipts/*.json`
- `handoff/skills-maker/indexes/reviewed.json`

约束：
- proof 的重点是证明“**真的消费过**”，而不是只证明文件存在
- `ready.json` 只是发现入口，不是主真相源；真正参与判断的仍应是 bundle 本体，必要时再回读 aggregate
- 若 proof 涉及 ready bundle 选择，则应显式记录 selection 口径：`strategy / orderedBy / requestedTargetSkill / signalRichness.*`

##### C. Outcome Proof（结果证明）

定义：
> 证明基于这些 runtime evidence 做出的 Skill 迭代 / 生成，在后续真实任务中确实改善了运行结果。

它回答：
- Skill 改完后，后续自然任务里是否更容易正确命中
- `correctionSoon` / `ambiguousCases` 是否下降
- task shape 是否更收敛
- route / adopt 是否更稳定

这一层当前仍未完全打通，但它应成为后续 `skills-maker` 真实迭代闭环的最终 proof 面。

因此，v1.2 下更推荐把整条链路写成：

```text
runtime evidence -> skill decision -> skill evolution
```

而 ready bundle 的最小选择策略则单独定义为：

```text
target skill -> newer -> richer signals
```

对应的 proof 样例口径应至少包含：
- `strategy`
- `orderedBy`
- `requestedTargetSkill`
- `signalRichness.notableSignalTotal`
- `signalRichness.usageFactCount`
- `signalRichness.totalReads`

同时，最小 read-ready 消费脚本现支持：
- `--format json`：返回机器可消费结构
- `--format markdown`：直接输出可审阅摘要

其中 markdown 模式应复用同一套 selection 口径，而不是另起一套人类描述。

```text
```

其中：
- `target skill`：只决定是否先限缩候选池，不直接替代排序
- `newer`：当前主排序键，优先选择较新的 ready bundle
- `richer signals`：仅在时间并列时作为 tie-breaker，依次比较 `notableSignals total -> usageFactCount -> totalReads`

进一步展开就是：

```text
Runtime Evidence
  -> Consumption Proof
    -> Outcome Proof
```

这也意味着：
- `skill-explore` 负责产出 **runtime evidence**
- `skills-maker` 负责把 evidence 转成 Skill 判断与变更输入
- `runtime-proof` 则负责证明这条 evidence → decision → outcome 链真实成立

其中：

#### A. PasstoContext host artifacts
是宿主已经稳定产生的事实源，包括：
- session branch / jsonl transcript
- `passto-round-boundary`
- Curator `summaryEntry`
- Curator `signal`
- GoalState / SummaryCache / principles 等上下文状态

#### B. skill-explore outputs
是从宿主事实源中提取并组织出来、专供 Skill Intelligence 使用的中间产物。

#### C. skills-maker consumption
是 `skills-maker` 在 create / refactor / audit 模式下，主动决定是否读取这些产物，并把它们转化为：
- 新 Skill 候选
- description / boundary / example / router 级别的现有 Skill 优化输入
- benchmark seed / runtime-proof review 输入

---

### 12.2 v1.2 的设计原则

#### 1. `skill-explore` 仍然只产证据，不直接改 Skill
v1.2 扩展后，`skill-explore` 仍然只负责：
- join
- aggregate
- handoff bundle
- receipt / review index

它**不直接输出 Skill 文件修改**。
真正的 Skill 生成、重构、合并、边界修复仍然由：
- `skills-maker`
- 或人工 review
完成。

#### 2. “已使用 / 未使用”不是主目录真相源
v1.2 不建议把 handoff 目录直接分成：
- `used/`
- `unused/`

原因是：
- 一个 bundle 可能被多次消费
- “消费过”不等于“问题已关闭”
- proof artifact 应尽量保持不可变

因此，v1.2 采用：
- **bundle 不移动**
- **receipt 记录消费结果**
- **ready / reviewed 只是派生索引**

#### 3. `skills-maker` 要主动查证，而不是被动等待用户喂 bundle
当用户要求：
- 新建 Skill
- 优化现有 Skill
- 处理 Skill 边界冲突
- 基于真实运行证据改 Skill

此时 `skills-maker` 不应只依赖用户自然语言描述；它应新增一条 reference routing：

> **先判断是否存在对应的 `skill-explore` 聚合产物；若存在，应主动读取后再进入六段链生成 / 重构。**

#### 4. 用户提出与 runtime 发现是两条入口，但应汇入同一消费面
新 Skill / Skill 优化请求可能来自两类源头：

- **用户提出**：用户明确说“需要新 Skill”或“这个 Skill 需要优化”
- **runtime 发现**：`skill-explore` 在多轮自然样本中发现重复模式、边界冲突或 no-read successful pattern

v1.2 中，这两类源头最终都应汇入：
- 同一套 `skills-maker` reference routing
- 同一套 review bundle / receipt 结构

---

### 12.3 v1.2 产物分层

v1.2 建议把 `skill-explore` 的输出分成三层，而不是直接生成一个“大总表”。

#### L0：已实现的 session-scoped runtime-proof 层
保留当前已有产物：

```text
~/.passtocontext/skill-explore/
├── latest/
│   └── latest-session.json
└── sessions/
    └── <sessionKey>/
        ├── round-skill-usage-facts.json
        └── skill-explore-summary.json
```

这一层不改语义，继续作为最底层可回放事实源。

---

#### L1：joined usage facts 层
在 v1.1 的 `round-skill-usage-facts.json` 之上，新增：

```text
~/.passtocontext/skill-explore/joins/
└── skill-usage-facts/
    ├── 2026-05-17.jsonl
    └── 2026-05-18.jsonl
```

这一层的职责是把：
- Skill 读取事实
- `summaryEntry`
- Curator `signal`
- 基础 task-shape 标记

join 成一个更适合聚合与 handoff 的中间对象。

v1.2 中，这一层应正式收敛为 **`SkillUsageFact` contract**。

#### `SkillUsageFact`（正式 contract）

```ts
interface SkillUsageFact {
  factId: string;
  observedAt: string;

  session: {
    sessionFile: string | null;
    sessionKey: string;
    agentRound: number;
  };

  skill: {
    skillPath: string;
    skillName: string;
    skillFileName: string;
    skillKey?: string;
    versionKey?: string;
    descriptionHash?: string;
  };

  read: {
    source: "top-agent" | "subagent";
    toolName: "read";
    entryIndex: number;
    subagentName?: string;
    subagentTask?: string;
  };

  context: {
    summaryEntryId?: string;
    signalType?: "advance" | "correct" | "supplement" | "continue" | "clarify";
    taskShapeKey?: string;
    taskShapeLabel?: string;
    userIntentLabel?: string;
  };

  outcomeProxy?: {
    nextSignalType?: "advance" | "correct" | "supplement" | "continue" | "clarify";
    hadCorrectionSoon?: boolean;
    advancedSoon?: boolean;
  };

  artifactRefs: {
    roundFactsFile: string;
    sessionSummaryFile: string;
  };
}
```

#### 字段语义约束

- `factId`：全局唯一；同一 usage fact 不因后续 aggregate 重跑而变化
- `session.agentRound`：必须与 `passto-round-boundary` 对齐
- `skill.skillPath`：真实读取路径；不可被“标准化名称”覆盖
- `skill.skillName`：供聚合 / review 使用的稳定显示名
- `read.source`：当前 proof 的关键字段，至少区分 `top-agent` / `subagent`
- `context.signalType`：来自 Curator 的轻语义标签，不等于最终效果 verdict
- `outcomeProxy`：只能表达“近端后续信号”，不能上升为 should-hit / should-not-hit 结论

#### 最小必填字段

至少必须有：
- `factId`
- `observedAt`
- `session.sessionKey`
- `session.agentRound`
- `skill.skillPath`
- `skill.skillName`
- `read.source`
- `read.toolName`
- `artifactRefs.roundFactsFile`

#### 消费者行为约束

- `skills-maker` 读取 `SkillUsageFact` 时，应把它当作 **joined evidence**，而不是最终判断
- 若缺少 `summaryEntryId / signalType / taskShapeKey`，允许继续消费，但必须知道它仍是降级样本
- `SkillUsageFact` 的目标是支撑 aggregate / bundle，不应直接被当作最终 handoff 面

这层仍属于 **evidence join**，不是评判层。

---

#### L2：aggregate 层
在 `SkillUsageFact` 之上，再新增按 `skill / version` 聚合的目录：

```text
~/.passtocontext/skill-explore/aggregates/
└── by-skill/
    └── <skillKey>/
        └── <versionKey>/
            ├── summary.json
            ├── task-shapes.json
            └── evidence-index.json
```

这一层的职责是回答：
- 这个 Skill / version 最近被读了多少次
- 常见 task shape 是什么
- top-agent / subagent 占比如何
- 读完后常见 `signalType` 分布是什么
- 哪些样本最适合导出给 `skills-maker`

v1.2 中，这一层应正式收敛为 **`SkillAggregateSummary` contract**。

#### `SkillAggregateSummary`（正式 contract）

```ts
interface SkillAggregateSummary {
  aggregateId: string;
  generatedAt: string;

  skill: {
    skillKey: string;
    skillName: string;
    skillPath: string;
    versionKey?: string;
    descriptionHash?: string;
  };

  window: {
    from: string;
    to: string;
    sessionCount: number;
    usageFactCount: number;
    roundCount: number;
  };

  counts: {
    totalReads: number;
    topAgentReads: number;
    subagentReads: number;
    uniqueTaskShapes: number;
  };

  signalsAfterRead: {
    advance: number;
    correct: number;
    supplement: number;
    continue: number;
    clarify: number;
    unknown: number;
  };

  taskShapeBreakdown: Array<{
    taskShapeKey: string;
    label: string;
    count: number;
    sourceBreakdown: {
      topAgent: number;
      subagent: number;
    };
    nextSignalBreakdown: {
      advance: number;
      correct: number;
      supplement: number;
      continue: number;
      clarify: number;
      unknown: number;
    };
    sampleFactIds: string[];
  }>;

  evidencePools: {
    representativeFactIds: string[];
    correctionSoonFactIds: string[];
    subagentFactIds: string[];
    ambiguousFactIds: string[];
  };

  artifactRefs: {
    usageFactFiles: string[];
  };
}
```

#### 字段语义约束

- `aggregateId`：一次聚合结果的唯一标识；允许重跑，但不能与别的 skill/version 混淆
- `skill.versionKey / descriptionHash`：用于区分不同 Skill 版本观察桶；缺失时只能做路径级聚合
- `window`：必须明确统计时间窗，避免把不同观察周期的数字混成一个“永久总数”
- `signalsAfterRead`：仅表达读取后的近端信号分布，不等于质量 verdict
- `evidencePools`：应提供可追溯 fact id 池，方便 `skills-maker` 继续下钻

#### 最小必填字段

至少必须有：
- `aggregateId`
- `generatedAt`
- `skill.skillKey`
- `skill.skillName`
- `window.from`
- `window.to`
- `counts.totalReads`
- `counts.topAgentReads`
- `counts.subagentReads`
- `artifactRefs.usageFactFiles`

#### 消费者行为约束

- `skills-maker` 读取 aggregate 时，可以把它当作 **review input**，但不能把统计数字直接当成最终结构决策
- 若需要决定 split / merge / create-new-skill，必须至少结合：
  - `taskShapeBreakdown`
  - `evidencePools`
  - 必要时回溯 sample facts
- aggregate 的目标是**压缩 review 成本**，不是替代方法判断

这一层仍然**不直接输出 should-hit / should-not-hit verdict**；
它只是把 `skills-maker` 真正会用到的证据压缩成稳定聚合视图。

---

#### L3：handoff / receipt 层
真正给 `skills-maker` 消费的，不应是整个 aggregate 目录，而应是一个更窄、更带问题意识的 review bundle：

```text
~/.passtocontext/skill-explore/handoff/
└── skills-maker/
    ├── bundles/
    │   └── <bundleId>.json
    ├── receipts/
    │   └── <bundleId>/
    │       └── <consumerRunId>.json
    └── indexes/
        ├── ready.json
        └── reviewed.json
```

这里：
- `bundles/` 是给 `skills-maker` 读取的主产物
- `receipts/` 记录谁在什么时候消费了 bundle，以及消费后状态是什么
- `indexes/ready.json` / `indexes/reviewed.json` 只是派生索引，不是主真相源

v1.2 中，这一层应正式收敛为两个 contract：
- **`SkillReviewBundle`**
- **`BundleReceipt`**

#### `SkillReviewBundle`（正式 contract）

```ts
interface SkillReviewBundle {
  bundleId: string;
  createdAt: string;

  targetSkill: {
    skillKey: string;
    skillName: string;
    skillPath: string;
    versionKey?: string;
    descriptionHash?: string;
  };

  scope: {
    from: string;
    to: string;
    usageFactCount: number;
    sessionCount: number;
  };

  summary: {
    totalReads: number;
    topAgentReads: number;
    subagentReads: number;
    dominantTaskShapes: string[];
    notableSignals: {
      advance: number;
      correct: number;
      supplement: number;
      continue: number;
      clarify: number;
    };
  };

  reviewFocus: {
    representativeHits: string[];
    correctionSoonCases: string[];
    subagentCases: string[];
    ambiguousCases: string[];
    nearbyNoReadPeerShapes?: string[];
  };

  openQuestions: string[];

  artifactRefs: {
    aggregateSummaryFile: string;
    taskShapesFile?: string;
    evidenceIndexFile?: string;
  };
}
```

#### `BundleReceipt`（正式 contract）

```ts
interface BundleReceipt {
  bundleId: string;
  consumer: "skills-maker";
  consumerRunId: string;
  consumedAt: string;

  result: {
    status: "reviewed" | "adopted" | "dismissed" | "superseded";
    notes?: string;
    outputDocPath?: string;
  };
}
```

#### 字段语义约束

- `bundleId`：一个面向消费的 handoff 单元 id；它不是 aggregateId，也不是 factId
- `targetSkill`：既可指向现有 Skill，也可在“新 Skill 候选”场景下指向 provisional key
- `reviewFocus`：必须是“值得进一步判断的代表样本池”，不能退化成全文 transcript 填充
- `openQuestions`：是交给 `skills-maker` 的方法问题，不是答案区
- `BundleReceipt.result.status`：只表达本次消费结论，不会反向改写 bundle 本体

#### 最小必填字段

`SkillReviewBundle` 至少必须有：
- `bundleId`
- `createdAt`
- `targetSkill.skillKey`
- `targetSkill.skillName`
- `scope.from`
- `scope.to`
- `summary.totalReads`
- `reviewFocus.representativeHits`
- `openQuestions`
- `artifactRefs.aggregateSummaryFile`

`BundleReceipt` 至少必须有：
- `bundleId`
- `consumer`
- `consumerRunId`
- `consumedAt`
- `result.status`

#### 消费者行为约束

- `skills-maker` 优先读取 `SkillReviewBundle`，而不是直接扫描 aggregate 目录
- `BundleReceipt` 只记录“谁消费了 bundle、产出了什么状态”，不移动 bundle 本体
- 若存在多个 receipt，说明同一 bundle 可被多次消费；后续判断应比较 `consumedAt` 与 `status`，而不是简单地把 bundle 当成“已处理完毕”

这两个 contract 共同构成：
- handoff surface
- consumption trace
- review audit trail

---

### 12.4 `skills-maker` 需要新增的 reference routing

v1.2 中，`skills-maker` 需要显式增加一条新的 reference routing，用来决定：

> **什么时候读取 `skill-explore` 聚合产物，读取哪一层，以及读完后如何把它纳入六段链。**

当前 `skills-maker` 已有：
- framework
- boundary
- output-contract
- templates

v1.2 需要补入一个新 reference 面，例如：
- `references/skill-explore-handoff.md`

它至少要定义以下规则：

#### 规则 A：何时必须主动读取 `skill-explore`
出现以下任一场景时，`skills-maker` 应主动读取 `skill-explore` handoff / aggregate：

1. 用户明确要求：
   - “基于真实使用情况做新 Skill”
   - “根据 skill-explore 结果优化这个 Skill”
   - “看看是不是该拆 Skill / 合 Skill / 加新 Skill”
2. 当前任务是：
   - Skill create
   - Skill refactor
   - Skill audit
   且问题描述明显与真实 runtime 行为相关
3. 当前输入中已经显式提供：
   - bundle 路径
   - aggregate 路径
   - `skill-explore` 相关线索

#### 规则 B：何时可以不读
若当前只是：
- 极小文案修补
- 纯方法骨架重写
- 与 runtime 行为无关的结构整理

则不必强制读取 `skill-explore`。

#### 规则 C：优先读取顺序
若存在 `skill-explore` 产物，`skills-maker` 的优先读取顺序应为：

1. `handoff/skills-maker/bundles/<bundleId>.json`
2. 若无 bundle，则读 `aggregates/by-skill/<skillKey>/<versionKey>/summary.json`
3. 必要时再回溯 `joins/skill-usage-facts/*.jsonl`
4. 只有需要底层核实，才回溯 `sessions/<sessionKey>/round-skill-usage-facts.json`

这条顺序保证：
- 先读收敛物
- 再读聚合物
- 最后才回底层事实

#### 规则 D：读完之后怎么进入六段链
`skills-maker` 读完 `skill-explore` 产物后，不是直接输出修改结论；
而是要把这些证据映射回自己的标准流程：

- Why：为什么需要新 Skill / 为什么现有 Skill 需要迭代
- What：这次要解决的边界、误吸、漏吸或 workflow 问题是什么
- Structure：是否要新增 router / reference / examples / validation
- Flow：命中后第一步是否需要改变
- Surface：description / examples / references / child binding 如何调整
- Runtime Proof：后续应拿哪些 bundle / benchmark seed 做回归验证

也就是说，`skill-explore` 的产物是 `skills-maker` 的**输入证据面**，不是替代 `skills-maker` 的方法骨架。

---

### 12.5 两类上游来源如何进入同一闭环

#### 场景 A：用户主动提出新 Skill / 现有 Skill 优化
用户可能直接说：
- “我需要一个新 Skill”
- “这个 Skill 总误吸，帮我优化”
- “基于真实使用情况看看是否该拆分”

此时闭环应为：

```text
用户请求
  └─ skills-maker 命中
      └─ 主动检查是否存在对应 skill-explore bundle / aggregate
          ├─ 若存在：读取后再生成 / 重构 Skill 方案
          └─ 若不存在：按普通 skills-maker 流程继续，但应显式标注“当前缺少 runtime evidence”
```

#### 场景 B：`skill-explore` 自己发现需要新 Skill / 优化现有 Skill
当 `skill-explore` 在多轮样本中发现：
- repeated no-read successful pattern
- repeated ambiguous boundary
- repeated correction soon after read
- repeated subagent-only usage pattern

此时它不应直接改 Skill；而应：

```text
skill-explore aggregate
  └─ 生成 handoff bundle
      └─ 交给 skills-maker / 人工 review
          └─ 再决定 create / split / merge / tighten / add-examples / routerize
```

这使得“用户提出”和“runtime 发现”两类入口，最终都汇到同一条 `skills-maker` 消费面。

---

### 12.6 v1.2 实现计划

当前仓库现实基线是：

- `skill-explore` 的主实现集中在 `plugin/skill-explore/index.ts`
- 已实现并已验证的能力是：
  - transcript 中 top-agent / subagent 的 `read .../SKILL.md` 抽取
  - `agent_end` 持久化 `round-skill-usage-facts.json` 与 `skill-explore-summary.json`
  - `session_start` 驱动的当前 session skill read count 恢复
- 已有回归入口是：
  - `tests/skill-explore-plugin.test.ts`
  - `npm run test:status`

因此 v1.2 的实现不应一开始就大拆架构，而应遵守：

1. **先保住 v1.1 的 L0 runtime-proof 不回退**
2. **先在现有单文件实现上补纯函数与新落盘层**
3. **等 L1/L2/L3 都成立后，再决定是否做更大代码拆分**

---

#### 12.6.1 实施总原则

##### 原则 A：先加层，不重写底层
- `round-skill-usage-facts.json`
- `skill-explore-summary.json`
- `latest/latest-session.json`

这三类 v1.1 产物继续保留，不改语义，不迁移路径。

##### 原则 B：先做纯函数，再接宿主桥
每一层都先实现：
- branch → object 的纯构建函数
- object → artifact 的纯持久化函数

最后才把它们接入 `agent_end` 主桥。

##### 原则 C：先补测试，再扩写 proof
每实现一层，都应先补：
- builder 级单测
- 持久化级单测

L3 完成后，再去补“真实闭环 proof”。

##### 原则 D：`skills-maker` 消费面先以文件消费为主
v1.2 的第一版不要求新增复杂命令面或自动注入。
先实现：
- `skill-explore` 产出 bundle
- `skills-maker` 按 reference 主动读取 bundle

---

#### 12.6.2 分期顺序

按依赖关系，推荐顺序为：

```text
P0. 保底重构与测试补强
  ↓
P1. L1 SkillUsageFact join
  ↓
P2. L2 SkillAggregateSummary
  ↓
P3. L3 SkillReviewBundle / BundleReceipt
  ↓
P4. skills-maker 消费闭环 proof
```

这个顺序的原因是：
- L2 依赖 L1
- L3 依赖 L2
- `skills-maker` 的真实消费 proof 必须建立在 L3 bundle 之上

---

#### 12.6.3 P0：保底重构与测试补强

##### 目标
在不改变 v1.1 行为的前提下，为 L1/L2/L3 铺出最小实现面。

##### 代码范围
优先仍落在：
- `plugin/skill-explore/index.ts`

必要时再新增很薄的 helper 文件，但第一步不强制拆成多模块。

##### 任务
1. 保留现有公开函数行为：
   - `buildSkillExploreRoundFactsFromBranch`
   - `summarizeSkillExploreRoundFacts`
   - `getSkillExploreRuntimeSnapshotFromBranch`
   - `persistSkillExploreArtifacts`
   - `runSkillExploreAgentEndBridge`
2. 从 branch 中补出可复用的 curator artifact 读取辅助函数
3. 明确后续新 builder 的输入输出边界，避免直接在 `persistSkillExploreArtifacts()` 内堆逻辑
4. 补充对当前 v1.1 基线的回归测试

##### 验收
- `tests/skill-explore-plugin.test.ts` 继续通过
- `npm run test:status` 继续通过
- `round-skill-usage-facts.json` 与 `skill-explore-summary.json` 内容不变

---

#### 12.6.4 P1：实现 L1 `SkillUsageFact` join

##### 目标
从当前 branch 中把：
- skill read 事实
- `grc-curator-artifact.summaryEntry`
- `grc-curator-artifact.signal`

join 成正式的 `SkillUsageFact` 序列。

##### 关键现实依据
当前仓库中已有：
- `passto-round-boundary`
- `grc-curator-artifact`
- `SummaryEntry`
- `GoalStateSignal`

因此 L1 不需要新增宿主事实源，只需要新增 join 逻辑。

##### 建议新增函数
- `extractCuratorArtifactsFromBranch(branch)`
- `buildSkillUsageFactsFromBranch(branch, sessionFile)`
- `persistSkillUsageFactsArtifacts({ branch, sessionFile, rootDir })`

##### 建议落盘
```text
~/.passtocontext/skill-explore/joins/
└── skill-usage-facts/
    ├── <date>.jsonl
    └── latest.jsonl
```

可选地增加 session 级镜像文件，例如：

```text
~/.passtocontext/skill-explore/sessions/<sessionKey>/
└── skill-usage-facts.json
```

##### 实现规则
1. join 主键以 `agentRound` 为第一锚点
2. `summaryEntry` / `signal` 若缺失，允许产出降级 `SkillUsageFact`
3. `taskShapeKey` 第一版允许为空，不阻塞 L1 上线
4. `versionKey / descriptionHash` 第一版允许为空，不阻塞 L1 上线

##### 测试
新增至少三类测试：
1. top-agent read + curator artifact join
2. subagent read + curator artifact join
3. 缺少 curator artifact 时的降级样本仍可产出

##### 验收
- 能稳定生成 `SkillUsageFact[]`
- 不破坏现有 v1.1 artifact
- L1 产物可追溯回 `roundFactsFile` 与 `sessionSummaryFile`

---

#### 12.6.5 P2：实现 L2 `SkillAggregateSummary`

##### 目标
以 `SkillUsageFact` 为输入，生成按 `skill / version` 的稳定聚合产物。

##### 建议新增函数
- `groupSkillUsageFactsBySkillVersion(facts)`
- `buildSkillAggregateSummary(facts, options)`
- `persistSkillAggregateArtifacts({ usageFacts, rootDir })`

##### 建议落盘
```text
~/.passtocontext/skill-explore/aggregates/
└── by-skill/
    └── <skillKey>/
        └── <versionKey>/
            ├── summary.json
            ├── task-shapes.json
            └── evidence-index.json
```

##### 第一版收敛范围
P2 第一版只强制实现：
- `summary.json`
- `evidence-index.json`

`task-shapes.json` 可先做轻量版，避免被 task-shape taxonomy 反向卡住。

##### 实现规则
1. `skillKey` 第一版可由 `skillPath` 规范化得到
2. `versionKey` 若缺失，先使用：
   - `descriptionHash`
   - 若仍无，则用 `unversioned`
3. `signalsAfterRead` 只统计近端 signal，不上升为质量 verdict
4. `evidencePools` 必须能追溯到 fact id

##### 测试
新增至少三类测试：
1. 多个 session / 多个 round 的同一 skill 聚合
2. top-agent / subagent 计数分开统计
3. `correctionSoonFactIds` / `subagentFactIds` 等 evidence pool 输出正确

##### 验收
- 能从 `SkillUsageFact[]` 稳定构建 `SkillAggregateSummary`
- 聚合结果可回溯到原始 fact ids
- 仍未引入 should-hit / should-not-hit 裁决语义

---

#### 12.6.6 P3：实现 L3 `SkillReviewBundle` / `BundleReceipt`

##### 目标
从 aggregate 层生成真正供 `skills-maker` 消费的 handoff bundle，并允许消费后写回 receipt。

##### 建议新增函数
- `buildSkillReviewBundle(summary, options)`
- `persistSkillReviewBundle(bundle, rootDir)`
- `persistBundleReceipt(receipt, rootDir)`
- `listBundleReceipts(bundleId, rootDir)`

##### 建议落盘
```text
~/.passtocontext/skill-explore/handoff/
└── skills-maker/
    ├── bundles/
    │   └── <bundleId>.json
    ├── receipts/
    │   └── <bundleId>/
    │       └── <consumerRunId>.json
    └── indexes/
        ├── ready.json
        └── reviewed.json
```

##### 第一版收敛范围
P3 第一版只要求：
- 能从一个 aggregate 产出一个 bundle
- 能写入 receipt
- 能生成 `ready.json` / `reviewed.json` 这类派生索引

不要求：
- 自动判定“该不该产 bundle”
- 自动触发 `skills-maker`
- 自动关闭旧 bundle

##### 实现规则
1. bundle 是不可移动主产物
2. receipt 是消费记录，不回写 bundle 本体
3. 同一 bundle 允许多个 receipt
4. `openQuestions` 必须保留为问题，不得在 bundle 生成阶段直接写死结论

##### 测试
新增至少三类测试：
1. aggregate → bundle 产出正确
2. bundle → receipt 写入正确
3. 多 receipt 并存时，索引仍可稳定生成

##### 验收
- `skills-maker` 可以有稳定文件路径可读
- 同一 bundle 多次消费不会破坏主产物
- `reviewed / adopted / dismissed / superseded` 只体现在 receipt 中

---

#### 12.6.7 P4：`skills-maker` 消费闭环 proof

##### 目标
完成至少一条真实闭环：
- `skill-explore` 产出 bundle
- `skills-maker` 主动读取 bundle
- 形成“新 Skill / 现有 Skill 优化”的定义类输出
- 写回 receipt

##### 依赖
在当前状态下，`skills-maker` 侧 reference routing 已完成：
- `~/.claude/skills/skills-maker/references/skill-explore-handoff.md`
- `~/.claude/skills/skills-maker/SKILL.md`

所以 P4 的主工作不是再改 routing，而是证明这条消费链真实成立。

##### 推荐 proof 场景
优先选择两类场景之一：

1. **用户提出型**
   - 用户明确说：基于真实运行证据判断是否要新建 Skill / 优化 Skill
   - `skills-maker` 主动去读 bundle
2. **runtime 发现型**
   - `skill-explore` 基于 aggregate 生成人工可审的 bundle
   - 再由 `skills-maker` 消费并输出方法结论

##### 验收
- 存在真实 bundle 文件
- 存在 `skills-maker` 消费记录或输出文档路径
- 存在 receipt 文件
- 文档中能写出一条端到端 runtime-proof 记录

---

#### 12.6.8 文件与测试改动建议

##### 最小代码改动面
第一版优先只改：
- `plugin/skill-explore/index.ts`
- `tests/skill-explore-plugin.test.ts`

必要时再新增：
- `tests/skill-explore-aggregate.test.ts`
- `tests/skill-explore-handoff.test.ts`

##### 脚本接入建议
当前仓库已有：
- `npm run test:status`

v1.2 建议保持以下原则：
- 新增的 `skill-explore` 测试继续挂在 `test:status` 下，保证进入现有回归链
- 不另起一个孤立的、默认不跑的测试面

---

#### 12.6.9 建议 checkpoint

##### Checkpoint 1：L1 成立
证明：
- 能从 branch 稳定 join 出 `SkillUsageFact`
- top-agent / subagent / curator signal 都能正确落位

##### Checkpoint 2：L2 成立
证明：
- 能从 `SkillUsageFact` 稳定构建 aggregate
- 证据池可追溯

##### Checkpoint 3：L3 成立
证明：
- 能生成 `SkillReviewBundle`
- 能写回 `BundleReceipt`

##### Checkpoint 4：闭环 proof 成立
证明：
- `skills-maker` 主动读取 bundle
- 输出定义类 Skill 方案
- 留下可审计 receipt

---

#### 12.6.10 v1.2 的直接主输出

如果 v1.2 按上述实现计划推进，其直接主输出应是：

1. `SkillUsageFact` join 层
2. aggregate 层目录与结构化 summary
3. `skills-maker` handoff bundle / receipt 机制
4. `skills-maker` 新 reference routing 设计
5. 至少一条真实闭环 proof：
   - 用户提出或 runtime 发现
   - `skill-explore` 产出 bundle
   - `skills-maker` 主动读取 bundle
   - 生成“新 Skill / 现有 Skill 优化”的定义类输出

---

### 12.7 v1.2 当前不做

为防止再次过早膨胀，v1.2 明确不做：

- 不让 `skill-explore` 自动改 Skill 文件
- 不把 `used / unused` 作为主目录状态机
- 不直接输出 should-hit / should-not-hit verdict
- 不做完整 dashboard / review UI
- 不做 embeddings / 向量检索
- 不把 `skill-explore` 结果持续注入普通任务 prompt

---

### 12.8 v1.2 的成功条件

若 v1.2 正确完成，应能稳定回答以下问题：

1. 从 `passto-context` 当前产物，是否能稳定构建 `skill-explore` 的 joined / aggregated / handoff 三层输出？
2. 当用户提出“做新 Skill / 优化现有 Skill”时，`skills-maker` 是否会主动检查并读取 `skill-explore` 产物？
3. 当 `skill-explore` 自己发现机会时，是否能产出供 `skills-maker` 消费的 bundle，而不是停留在日志层？
4. `skills-maker` 消费后，是否留下 receipt / output path，从而形成可审计闭环？

如果这四个问题都能回答“是”，说明 v1.2 已经把 `skill-explore` 从“runtime-proof 插件”推进成“可被 `skills-maker` 消费的运行证据中枢”。
---

## 13. 最终结论

截至 2026-05-17，本文档的版本状态应明确理解为：

- **v1.1：收口完成**
- **v1.2：最小闭环已落地，但扩展项仍在继续**

v1.1 的 `skill-explore` 已经从早期“Skill Intelligence warehouse 设想”收敛为一个更小但更扎实的实现：

> **它是 PasstoContext 宿主内、由 `agent_end` 驱动的 Skill runtime-proof 插件。当前职责不是做高层裁决，而是稳定记录 top-agent / subagent 的真实 Skill 读取事实，并把最小统计回流到 widget 与持久化 artifact。**

这一收敛是正确的，因为它先完成了最关键的一步：

> **把真实证据链做实。**

而 v1.2 的方向也已经明确：

> **不是让 `skill-explore` 直接变成 Skill 修改器，而是把 PasstoContext 宿主产物收敛成 `skills-maker` 会主动消费的聚合产物与 handoff surface。**

在这条路径下，`skill-explore` 负责证据，`skills-maker` 负责方法生成与重构，二者共同形成：

> **runtime evidence → skill decision → skill evolution**

的稳定闭环。

---

*版本：skill_intelligence_v1.1 | 更新时间：2026-05-17*