# PasstoContext v1.1 Principles Phase 0 清洗清单

> 状态：proposed
> 目标：在 Generator / Prompt 架构重构前，先清理 principles registry 中“实质不是原则”的历史存量，避免旧污染源继续进入 injectable principles 池。
> 审计对象：`/Users/handy/.passtocontext/memory/principles/principles-registry.json`
> 审计时间：2026-05-12
> 关联文档：
> - `docs/v1.1/V1_1_GENERATOR_PROMPT_ARCHITECTURE.md`
> - `docs/v1.1/V1_1_FINAL_ARCHITECTURE.md`
>
> 说明：
> - 本清单基于一次本地启发式审计与人工分类，目的是给出 **Phase 0 可执行候选集**；
> - 本清单不等于对全部 100 条 registry 逐条终判；
> - 本清单优先处理“高风险、会污染注入面”的条目，而不是一次性重写全部历史原则。

---

## 1. 审计摘要

基于本地脚本审计，当前 principles registry 的已确认风险如下：

- 总条目数：`100`
- 至少 `4` 条存在明显超长 / 多轮拼接现象
- 至少 `4` 条保留 `新增：` 式追加痕迹
- 至少 `2` 条高置信混入了已退出主路径的旧架构术语
- 另有若干条目虽不一定“错误”，但更接近：
  - 设计笔记
  - 迁移纪要
  - 组件输入契约
  - 项目流程提醒
  - 局部实现 workaround

这些内容不适合作为长期 injectable principles 直接注入给 Generator。

---

## 2. Phase 0 分类标准

本轮清洗统一使用三分类：

### A. principle

保留条件：
- 跨多轮、跨任务可复用
- 不依赖已退出主路径结构
- 不依赖某个临时迁移阶段
- 不需要特定历史上下文也能成立
- 长度可控，可被 Generator 直接理解为经验启发

### B. stale principle

判定条件：
- 曾经有效
- 但依赖旧架构、旧字段或已退出主路径
- 继续注入会制造错误偏导

处理动作：
- 停止注入
- 标记归档候选
- 必要时拆分出仍然有效的子原则，再单独重写

### C. pseudo-principle

判定条件：
- 实质是设计笔记、迁移记录、文档同步提醒、局部流程 note、组件契约或具体实现残片
- 即使内容部分正确，也不适合作为长期原则注入

处理动作：
- 立即移出 injectable pool
- 迁移到设计文档 / ADR / checklist / test contract，或直接删除

---

## 3. 高置信 Phase 0 候选清单

以下条目属于 **优先在 Phase 0 处理** 的高置信候选。

### 3.1 立即移出 injectable pool

| ID | 当前判断 | 主要问题 | Phase 0 动作 | 后续去向建议 |
|---|---|---|---|---|
| `2026-05-07T12-29-principle-ie4s` | `pseudo + stale` 复合条目 | 超长；多次 `新增：` 串接；包含 `RequirementLedger`、`standingInstructions`；混入文档同步提醒、测试接线要求、旧架构残片 | **立即停止注入**；保留原文到 archive 备查 | 拆为 2-3 条独立资产：可复用部分重写为新 principle；旧架构部分归档或删除 |
| `2026-05-10T04-08-principle-kjei` | `pseudo-principle` 复合条目 | 超长；混合 Curator 时序、文档同步、GoalState 序列化策略；读起来更像设计草稿拼接 | **立即停止注入**；原文归档 | Curator 时序 / GoalState 序列化写回设计文档或测试；不保留为单条 principle |
| `2026-05-07T14-04-principle-n58l` | `stale + pseudo` 复合条目 | 超长；包含已退出主路径的 ledger 恢复逻辑；混合状态恢复细则与旧账本裁决规则 | **立即停止注入**；原文归档 | 如仍有价值，只提炼“权威数据优先于派生快照”“恢复时归一化状态”两条短原则 |
| `2026-05-11T16-57-principle-55we` | `pseudo-principle` | 项目流程 note，强绑定 `TODO.md` / `package.json` / builder-smoke-tsc 关卡；不具通用性 | **立即停止注入** | 移入项目 checklist / implementation plan |
| `2026-05-12T01-07-principle-ymtt` | `pseudo-principle`（可泛化重写） | 强绑定具体命令 `getUserEmail/countMatchingEmails/scanUnanalyzed` 与 `TODO.md/README`；更像某次回归决策记录 | **立即停止注入** | 若需要，重写为一般化原则：“优先用无副作用探针验证风险，再参考静态文档” |
| `2026-05-10T14-47-principle-ak1g` | `pseudo-principle` | 本质是 Reflector 输入契约，不是通用经验原则 | **立即停止注入** | 写入 Reflector 设计文档 / contract test |

### 3.2 不应原样保留，需拆分或重写

| ID | 当前判断 | 主要问题 | Phase 0 动作 | 建议重写方向 |
|---|---|---|---|---|
| `2026-05-07T15-38-principle-wxix` | `principle candidate`（复合） | 把“外部副作用修改后必须验证”与“artifact 恢复链归一化”硬拼在一起 | 暂停原样注入或列入优先重写队列 | 拆成两条：① 外部可见后果必须验证；② 恢复链先做归一化 |
| `2026-05-07T15-38-principle-lg26` | `principle candidate`（复合） | “文档应反映真实实现”与“主文档收缩为入口式引用”是两种不同原则 | 列入重写队列 | 拆成：① 代码与文档冲突时先校正文档；② 重复文档需单源维护 |
| `2026-05-07T14-10-principle-kzge` | `principle candidate`（过长） | 混合 loop 触发时机、Reflector/Curator 并行、mid-run steer 保留策略 | 列入重写队列 | 缩成 1-2 条简短架构启发，不保留实现细枝末节 |
| `2026-05-07T14-10-principle-auem` | `principle candidate`（偏长） | 内容整体合理，但过于面向当前系统实现；应压缩到更稳定表达 | 列入重写队列 | 保留“三权分立 + 持久化产物传递状态”主干，删去冗余解释 |

### 3.3 暂时保留，但纳入二次复核池

这些条目当前不属于最优先清洗对象，但建议在 Phase 0 末尾做一次人工复核，确认它们是否真的适合进入全局 injectable principles 池。

| ID | 当前判断 | 复核原因 | 当前建议 |
|---|---|---|---|
| `2026-05-07T12-24-principle-wmpz` | `principle` | 引用 `auth.json`，语义较具体，但仍具通用性 | 暂保留 |
| `2026-05-07T12-25-principle-2oc1` | `principle` | 与上条语义接近，可能存在合并空间 | 暂保留，后续考虑去重 |
| `2026-05-07T14-03-principle-qrj3` | `principle` | 偏框架开发方法论，基本合理 | 暂保留 |
| `2026-05-11T14-40-principle-zdcq` | `principle` | 偏“实现审计”场景，但仍属稳定工作法 | 暂保留 |
| `2026-05-07T16-15-principle-9pur` | `principle candidate` | 偏系统实现细节，需确认是否适合作为全局注入经验 | 暂保留，后续复核 |
| `2026-05-07T11-01-principle-9xh1` | `niche principle` | 过于局部，强绑定邮件/编码解析场景 | 暂保留，后续评估是否降到领域级记忆而非全局原则 |
| `2026-05-11T18-56-principle-0bma` | `principle` | 与当前目标切换判断高度相关，暂未发现伪原则特征 | 暂保留 |

---

## 4. 条目级处理建议

### 4.1 `ie4s` 的建议处理

原条目混入了四类不同内容：

1. `Planner / Executor / Auditor` 三权分立 —— 可能可保留为稳定原则
2. `RequirementLedger / standingInstructions` —— 已退出主路径，应视为 stale
3. 文档同步时用 `rg` 验证术语 —— 可视为文档校验 heuristic，但不应和架构原则混写
4. 新测试必须接入回归链 —— 可保留为质量原则

**Phase 0 动作**：
- 原条目整体移出 injectable pool
- 不做原文修补
- 后续仅在人工确认后，重写出 2-3 条简短新 principle

### 4.2 `kjei` 的建议处理

原条目混入：
- Curator 延迟一轮 / before_agent_start 时序
- 文档同步提醒
- GoalState 焦点序列化策略

这三部分都更像：
- 设计契约
- 实现约束
- 架构文档内容

而不是 Generator 可消费的历史经验原则。

**Phase 0 动作**：
- 整条停注入
- 设计内容迁回 `reflector-v1.1.md` / `V1_1_FINAL_ARCHITECTURE.md` / 相关 contract test

### 4.3 `n58l` 的建议处理

原条目虽然前半段含有可复用成分：
- 权威数据优先于派生快照
- 恢复链先做状态归一化

但后半段混入了已退出主路径的 ledger 恢复与裁决逻辑。

**Phase 0 动作**：
- 原条目停注入
- 若后续需要，只提炼出两条不依赖旧 ledger 的短原则

### 4.4 `55we` / `ymtt` / `ak1g` 的建议处理

这三条分别代表三类典型 pseudo-principle：

- `55we`：项目执行 checklist
- `ymtt`：具体回归决策记录
- `ak1g`：组件输入契约

共同特点：
- 并非错误内容
- 但不适合进入全局历史原则注入面

**Phase 0 动作**：
- 全部停注入
- 迁回更合适的资产类型（plan / checklist / design contract）

---

## 5. Phase 0 执行顺序

建议按以下顺序执行：

### Step 1：冻结现有注入面

- 在开始清洗前，先导出一份当前 registry 快照
- 记录当前 injectable principles 数量
- 保证回滚可行

### Step 2：先处理“高置信立即移出”集合

本轮应优先移出：
- `ie4s`
- `kjei`
- `n58l`
- `55we`
- `ymtt`
- `ak1g`

原则：
- **先停注入，再讨论是否重写**
- 不要边注入边修补

### Step 3：处理“拆分 / 重写”集合

依次处理：
- `wxix`
- `lg26`
- `kzge`
- `auem`

原则：
- 原文不做无限追加修补
- 直接重写为简短、可注入的新条目
- 重写后原条目标记 archived 或 replaced

### Step 4：做二次复核与去重

重点检查：
- `wmpz` 与 `2oc1` 是否重复
- `9xh1` 是否应从全局原则降到更局部的记忆层
- `9pur` 是否更适合设计文档而非原则注入

### Step 5：复测注入面

至少确认：
- injectable principles 不再包含旧主路径术语
- 不再包含 `新增：` 串接条目
- 不再包含 checklist / contract / migration note 型内容
- 注入总量与平均长度明显下降

---

## 6. Phase 0 退出标准

Phase 0 完成至少应满足：

1. 高置信 pseudo-principles 已全部移出 injectable pool
2. 高置信 stale principles 已停止注入
3. 不再有明显的 `新增：新增：` 拼接型条目继续注入
4. 不再有引用 `RequirementLedger`、`standingInstructions` 等已退出主路径结构的注入条目
5. Generator 接收到的 principles 均能被解释为“历史经验启发”，而不是设计草稿或流程 note

---

## 7. Phase 0 之后的衔接动作

完成本清洗后，才进入后续重构：

- Phase 1：定义 `generator-contract.md` 单一维护源
- Phase 2：收敛 `APPEND_SYSTEM.md`
- Phase 3：实现 `buildGeneratorCharterPrompt()`
- Phase 4：建立 injectable / archived / stale 的长期治理机制

---

## 8. 一句话结论

> **Phase 0 的核心不是“优化 wording”，而是先把不该继续注入的内容从 principles 注入面清出去。**

在此之前，任何 Generator / Prompt 架构改造都会被旧伪原则反向污染。
