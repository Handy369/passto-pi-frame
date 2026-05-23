# PasstoContext Principles 模块设计

> 版本：v1.2 | 状态：current | 更新：2026-05-14

---

## 1. 原则的角色定义

Principles 被重新定义为：

> **跨多轮、多任务被重复识别出来的高复用经验方法论。**

它们**不是**：
- 当前目标真相源
- 当前项目设计文档
- 某轮迁移笔记
- 某次回归决策记录
- 某个局部 API/组件输入契约

Principles 的定位是**分层的历史启发面**，由两层组成：

| 层级 | 组成 | 优先级 | 维护方式 |
|---|---|---|---|
| 人工宪法原则层 | `manual + promoted` 原则 | 最高 | 直接手改 `principles-registry.json` |
| 普通历史经验层 | `reflector` 自动产生原则 | 次之 | Reflector 重复命中验证 |

人工宪法原则层优先于普通历史经验层。低频但关键的原则由人工入口兜底，不依赖自动命中统计。

---

## 2. 优化目标

### 2.1 把原则价值建立在"重复命中"上

原则是否有效，主要由以下事实决定：

> 在多个独立 round 中，Reflector 是否再次把当前观察到的行为归因到同一条原则。

对于方法论类原则，**重复命中**比"曾被创建出来"更能证明其有效性。

### 2.2 让 Reflector 基于全量原则库做判断

Reflector 必须看到全量可比较原则，而不是局部检索子集。这样它才能真正判断：
- 当前经验命中了哪条旧原则
- 是否只是对旧原则的扩写
- 是否真的出现了全新的原则

### 2.3 把"原则入库"和"原则生效"分离

Reflector 产生的新原则可以先入库，但默认只是候选。只有在后续多轮被重复命中之后，才允许注入给 Generator。

### 2.4 增加优雅退出机制

长期不再被命中的 Reflector 候选原则，必须自动退出，否则 registry 会不断膨胀，最终重新演化成垃圾池。

### 2.5 为低频但关键原则保留人工兜底入口

对极少数低频但高价值的原则，不依赖自动命中统计，而提供人工添加 / promote 入口。当前主路径为**直接手改** `principles-registry.json`。

---

## 3. 非目标

本方案明确不追求以下事项：

1. 不把 principles 升级为第二份 Constitution 或第二份 APPEND_SYSTEM
2. 不把 principles registry 继续演化为复杂的人审工作台主系统
3. 不要求 Reflector 直接重写整个 registry 原文件
4. 不要求一次性删除所有历史 review/export/import 代码；短期可兼容保留
5. 不要求用复杂 scoring 同时综合几十个弱信号；主张以 `hitCount` 为主信号

---

## 4. 三类分类（principle / stale / pseudo）

Registry 中的条目按状态分为三类：

| 类别 | 含义 | 典型特征 |
|---|---|---|
| **principle** | 有效的方法论原则 | 被多轮重复命中，`hitCount` 较高，内容表述为通用方法论 |
| **stale** | 已过期的旧原则 | 长时间未被命中，内容针对已过时的上下文或迁移阶段 |
| **pseudo** | 伪原则 | 内容更像迁移 note、一次性 observation、设计草稿残片、局部 workaround，不具备跨任务复用价值 |

该分类用于 review/export 辅助治理面的诊断与筛选，也是自动退出机制的判断基础。

---

## 5. 治理规则（A–E）

### A. 自动原则（reflector-originated）

- 来源：Reflector 从真实 round 经验中提取
- 默认不信任，需要靠重复命中逐渐证明价值
- 可自动退出（见第 8 节）

### B. 人工原则（manual-originated）

- 来源：用户或维护者手工添加 / promote
- 用于低频但关键的核心原则
- 不参与自动删除
- 当前维护方式：**直接手改** `principles-registry.json`

### C. 全量可见

- Reflector 输入必须包含完整原则库，而非检索 top-k 子集
- 确保命中判断不因输入裁剪而失真
- 必要时可做字段压缩以控制 token，但语义上必须让 Reflector"看见全部条目"

### D. 命中为主信号

- `hitCount` 是原则价值的核心判断指标
- 旧字段 `activeScore`、`hintCount`、`conflictGroupId`、复杂 lifecycle 降级为兼容字段，不再作为注入主裁决信号

### E. 人工宪法优先

- `manual + promoted=true` 的原则进入人工宪法原则层，享有最高优先级
- 代表维护者明确认为值得长期注入的核心工作法
- 数量应严格控制，避免膨胀成第二套宪法

---

## 6. Reflector 输出语义：hit / expand / create

Reflector 的输出收敛为三类，贴近"原则验证"的真实过程：

### 6.1 `hit`

表示当前 round 再次验证了某条已有原则。

```json
{ "type": "hit", "targetId": "principle_xxx" }
```

效果：`hitCount + 1`，记录新的 hit timestamp，不改内容。

### 6.2 `expand`

表示当前 round 命中了旧原则，但观察到更好的表达或更完整的表述。

```json
{
  "type": "expand",
  "targetId": "principle_xxx",
  "content": "扩写后的原则内容",
  "tags": ["verification", "workflow"]
}
```

效果：`hitCount + 1`，按 deterministic merge 规则更新内容，更新时间戳。

### 6.3 `create`

表示当前 round 观察到一条现有原则库无法覆盖的新原则。

```json
{
  "type": "create",
  "content": "新原则内容",
  "tags": ["debugging"]
}
```

效果：创建新 reflector-originated principle，初始 `hitCount = 1`。

### 6.4 旧语义降级

以下旧概念在 v1.1 中不再作为 Reflector 主输出：
- `reuse` → 折叠为 `hit`
- `merge` → 折叠为 `expand`
- `conflict` → 降级为实现层可选辅助能力

---

## 7. 数据结构

### 7.1 PrincipleRecord

```ts
interface PrincipleRecordV11 {
  id: string;
  content: string;
  tags: string[];
  origin: "reflector" | "manual";
  hitCount: number;
  hitTimestamps: string[];
  promoted?: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 7.2 字段语义

| 字段 | 含义 |
|---|---|
| `origin` | `reflector` = 自动原则，`manual` = 人工兜底原则 |
| `hitCount` | 该原则被 Reflector 在独立 round 中再次识别到的次数；`create` 时初始化为 `1`，`hit`/`expand` 时 `+1` |
| `hitTimestamps` | 用于窗口清理脚本判断近 30 天命中情况 |
| `promoted` | 主要用于手动兜底原则；`manual + promoted=true` 表示允许直接注入 |

### 7.3 降级字段

以下字段不再作为主机制核心，迁移期间可保留做兼容：
- `activeScore`
- `hintCount`（保留时应与 `hitCount` 统一）
- `conflictGroupId`
- 复杂 lifecycle 作为注入主裁决信号

---

## 8. Reflector 全量视野设计

### 8.1 当前问题

当前 `buildReflectorInput()` 通过 `principles.search(query, limit)`（默认 limit=5）仅给 Reflector 提供一个检索子集，导致：
- 本应 reuse / expand 的原则被误判为 create
- `hintCount` / `hitCount` 统计失真
- 注入面逐渐积累低复用新原则

### 8.2 新设计

Reflector 输入新增完整原则视图：

```json
{
  "allPrinciples": [
    {
      "id": "principle_xxx",
      "content": "...",
      "tags": ["..."],
      "origin": "reflector",
      "hitCount": 7,
      "promoted": false,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

原则：**不能因为输入裁剪导致命中判断失真。** 若后续 registry 增长过大，可再讨论"全量短视图 + 局部详细视图"，但 v1.1 的第一原则是 Reflector 必须看见全部条目。

---

## 9. 命中门槛与入库/生效分离

### 9.1 Reflector 自动原则注入规则

> **只有 `hitCount > 5` 的原则，才允许注入给 Generator。**

- `hitCount <= 5`：仍留在 registry 中作为候选，不注入
- `hitCount > 5`：进入 injectable pool

这意味着"被提取一次"不等于"可跨任务复用的方法论"。一次性 observation、设计草稿残片、局部 workaround 不会过早进入 Generator 的系统层启发。

### 9.2 人工原则注入规则

- `origin = manual && promoted = true`：可直接注入
- 或允许单独配置一个更宽松门槛

### 9.3 最终注入面

最终注入面只应包含：
1. 被多次验证过的 reflector 方法论（`hitCount > 5`）
2. 少量人工明确 promote 的核心原则（`manual + promoted=true`）

Generator 看到的 principles 更像稳定经验启发，而非刚被模型提取一次的观察句。

---

## 10. 自动退出机制

### 10.1 退出规则

> **删除近 30 天内命中次数 <= 1 的 reflector 产生原则。**

### 10.2 规则细化

- 仅检查 `origin = reflector`
- 若 `promoted = true`，则跳过自动删除
- 统计最近 30 天窗口中的 `hitTimestamps`
- 若窗口内命中数 `<= 1`，则删除

### 10.3 设计理由

1. 给新原则一个自然观察窗口，而不是即时淘汰
2. 让原则存活权由"重复命中"决定，而不是"是否被创建过"
3. 不误伤人工兜底原则

### 10.4 与旧机制的差异

当前代码中的删除逻辑混合了 `recent30`、`recent60`、`activeScore`、`decay`。v1.1 改为：

> **Reflector 原则是否存活，只看时间窗口内是否被重复命中。**

这样更可解释，也更容易向用户说明。

---

## 11. 人工兜底原则维护

### 11.1 当前主路径

**直接手改** `principles-registry.json`，写入人工宪法原则条目：

```json
{
  "origin": "manual",
  "promoted": true,
  "hitCount": 0
}
```

### 11.2 语义

- manual principle 不依赖自动命中统计证明自己
- `manual + promoted` 表示进入人工宪法原则层
- 它代表维护者明确认为值得长期注入的核心工作法
- 数量应严格控制

### 11.3 不走 HTML review 链

人工宪法原则（`manual + promoted`）的维护直接通过编辑 `principles-registry.json` 完成，**不走 review/export/import HTML 审查链**。HTML review 链服务于普通历史经验层的治理。

### 11.4 可选扩展（非当前前提）

后续如确有必要，可再增加：
- `/ptc principles add <content>`
- `/ptc principles promote <id>`
- `/ptc principles demote <id>`
- `/ptc principles list --manual`

---

## 12. 运行时新流程

### 12.1 Reflector 阶段

1. 序列化当前 round conversation
2. 读取全量 principles registry
3. 把全量原则 + 当前上下文 + goal grounding 交给 Reflector
4. Reflector 输出 `hit` / `expand` / `create`

### 12.2 PrinciplesManager 阶段

对 Reflector 输出做确定性 apply：
- `hit` → `hitCount + 1`
- `expand` → `hitCount + 1` + 内容更新
- `create` → 新建原则，初始 `hitCount = 1`

### 12.3 before_agent_start 注入阶段

1. 读取 registry
2. 选出 `origin = reflector && hitCount > 5` 和 `origin = manual && promoted = true`
3. 注入给 Generator

### 12.4 清理阶段

周期性脚本执行：删除近 30 天窗口内 `hitCount(window) <= 1` 的 reflector 原则。

---

## 13. Review / Export / Import 辅助治理面

### 13.1 定位

review/export/import 是**辅助治理面**，不是 principles 主价值链。

- 主价值链：Reflector 重复命中验证 → 自动注入门槛 → 自动退出 → 少量人工兜底
- 辅助治理面：HTML 审查 → 批量 lifecycle 裁决 → 回写 registry

### 13.2 JSON-first 设计

| 层级 | 角色 |
|---|---|
| `principles-registry.json` | 运行时主真相源 |
| `review-model.json` | 只读审查快照 |
| `review.html` | 浏览器交互投影（单文件静态 HTML） |
| `review-decision.json` | 人工裁决文件 |
| Importer | 唯一写入口 |

**JSON 是真相源，HTML 是投影层，Importer 是唯一写入口。**

MVP 采用 JSON-first 而非 YAML-first，因为浏览器侧 JSON 处理更直接、schema 校验更稳定、round-trip 更安全。

### 13.3 Review Pipeline

```
principles-registry.json
  → review-model.json      (exporter 生成只读审查快照)
  → review.html            (单文件静态 HTML，可 file:// 打开)
  → review-decision.json   (用户在 HTML 中选择 action 并导出)
  → importer               (校验 snapshot hash + schema，写回 registry)
  → principles-registry.json
```

### 13.4 何时使用这条链

| 场景 | 是否使用 review 链 |
|---|---|
| 新增人工宪法原则 | 否，直接手改 registry |
| 批量审查既有原则的 lifecycle 状态 | 是 |
| 对 stale / pseudo / oversized 候选做人工裁决 | 是 |
| 日常注入 / 命中 / 退出 | 否，自动完成 |
| 观察现有原则全貌 | 是 |

### 13.5 安全边界

- HTML 不直接修改 registry，所有审查动作必须经过 importer
- Decision 只支持有限 action 枚举：`keep-active` / `mark-stale` / `archive` / `disable`
- Snapshot hash mismatch 默认拒绝导入，防止旧快照误覆盖新 registry

### 13.6 命令契约

```text
/ptc principles review export              # 导出 review bundle
/ptc principles review export <output-dir>  # 指定输出目录
/ptc principles review import <file>        # 导入 decision 文件
```

---

## 14. 对现有代码的建议改动

### 14.1 `grc-reflector-input.ts`

增加 `allPrinciples` 全量原则挂载，取代 `candidatePrinciples` 检索子集。

### 14.2 `types.ts`

将 `PrincipleOp` 改为 `PrincipleUpdate`，类型为 `hit | expand | create`，新增 `origin` / `promoted` 字段定义。

### 14.3 `grc-prompts.ts`

Reflector prompt 改为要求输出 `principleUpdates`，明确三选一，要求优先对照全量原则库。

### 14.4 `grc-subagent.ts`

`extractPrincipleOps()` / `parsePrincipleOp()` 改为 `extractPrincipleUpdates()` / `parsePrincipleUpdate()`。

### 14.5 `grc-principles.ts`

- **写入层**：apply `hit / expand / create`，统一维护 `hitCount / hitTimestamps / origin / promoted`
- **注入层**：reflector 原则 `hitCount > 5`，manual 原则 `promoted = true`
- **清理层**：删除近 30 天窗口内命中 `<= 1` 的 reflector 原则
- **兼容层**：迁移期间保留对旧 registry 的读兼容

### 14.6 `index.ts`

- Reflector 输入改为全量 principles
- `before_agent_start` 注入逻辑改为硬阈值过滤
- 移除 `markUsed()`：原则命中计数与活跃度只能由 Reflector 的 `hit/expand/create` 驱动，不能由“被注入过”驱动

### 14.7 新增 review 模块

- `grc-principles-review.ts`：build review model、validate decision、apply decisions、compute hash
- `grc-principles-review-html.ts`：生成单文件静态 HTML

---

## 15. 迁移方案

| 阶段 | 内容 |
|---|---|
| Phase 0 | 冻结并备份当前 registry，记录现有 total / injectable 数量 |
| Phase 1 | 新增 v1.1 字段兼容读取（`hintCount → hitCount`，推断 `origin`） |
| Phase 2 | Reflector 输入切换为全量原则库 |
| Phase 3 | Reflector 输出切换为 `hit / expand / create` |
| Phase 4 | 注入门槛切换为 `hitCount > 5` |
| Phase 5 | 启用 30 天低命中退出脚本 |
| Phase 6 | 评估是否新增 `/ptc principles add` 等人工入口（非前提） |

---

## 16. 最终结论

PasstoContext v1.2 的 principles 机制，从"复杂治理对象"收敛为：

> **一个以重复命中验证为核心的经验原则库。**

其最简洁、最可解释的闭环是：

1. Reflector 看见全量原则库与当前 round 真实上下文
2. Reflector 只做三类判断：`hit / expand / create`
3. 原则是否有价值，主要由 `hitCount` 决定
4. `hitCount > 5` 的 reflector 原则才注入给 Generator
5. 近 30 天命中 `<= 1` 的 reflector 原则自动退出
6. 低频但关键的原则通过 `manual + promoted` 人工宪法原则兜底，当前维护方式为直接手改 registry
7. Review/export/import 作为辅助治理面保留，服务于批量 lifecycle 裁决，不是主价值链

这套模型比此前机制更简洁、可解释、易测试，更符合"原则是方法论而非一次性总结"的本质。

---

*版本：principles_v1.2 | 更新时间：2026-05-14*
