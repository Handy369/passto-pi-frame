# V1.1 Principles Review / Export Spec

> 状态：Draft v0.1  
> 阶段归属：Generator Prompt Architecture Phase 4（治理 principles 注入面）  
> 相关上游：`references/generator-contract.md`、`docs/v1.1/V1_1_GENERATOR_PROMPT_ARCHITECTURE.md`、`grc-principles.ts`

---

## 1. 背景与目标

在当前 v1.1 架构中，`principles` 的角色已经被重新收敛为：

> **跨多轮、多任务复现过的高复用经验启发**

它们不再是：
- 第二份动态 system prompt
- 当前项目的主架构文档
- 迁移纪要、设计残片、review note 的长期容器

然而，当前 registry 治理仍存在一个现实问题：

- `principles-registry.json` 已经是运行时真相源；
- `grc-principles.ts` 已有 `lifecycle`、`review diagnostics`、`pseudo/stale/oversized candidate` 检测；
- 但人工复核仍主要依赖 TUI 内自然语言交流或脚本审计结果；
- 这会让“人工裁决”再次经过 LLM 理解，存在漂移风险。

因此，本 spec 定义一个新的 **HITL review/export surface**：

```text
principles-registry.json
  -> review-model.json
  -> static review.html
  -> review-decision.json
  -> importer
  -> principles-registry.json
```

目标：
1. 提供一个 **TUI 之外** 的结构化审查界面；
2. 避免用户自然语言裁决再被 LLM 解释执行；
3. 保持审查动作可导出、可回放、可审计；
4. 不在 MVP 引入必须常驻的 localhost 服务；
5. 明确“HTML 只是投影层，不是主数据层”。

---

## 2. 设计结论

### 2.1 JSON-first

MVP 采用：

- **registry JSON**：运行时主真相源
- **review-model JSON**：审查快照
- **review-decision JSON**：人工裁决文件
- **static HTML**：浏览器交互投影

结论：
- **JSON 是真相源**
- **HTML 是投影层**
- **Importer 是唯一写入口**

### 2.2 Why not YAML-first

尽管项目中历史上存在 YAML 存储，但 review/export 场景下不建议以 YAML 作为主交互格式。

原因：
- 浏览器侧 JSON 处理更直接；
- schema 校验更稳定；
- round-trip 更安全；
- 避免 YAML 在多行文本、缩进、metadata 混合时产生解析差异；
- decision 文件需要被 importer 确定性解析，不应承担 YAML 歧义风险。

因此：
- **内部 review/export 主协议使用 JSON**；
- 如未来需要 YAML，只作为只读导出或兼容出口，而不作为主交互回写格式。

### 2.3 HTML is projection, not source of truth

浏览器中的 `review.html`：
- 不直接编辑 registry；
- 不承担数据存储职责；
- 只消费 `review-model.json`；
- 只导出 `review-decision.json`。

这保证：
- review UI 可替换；
- importer 逻辑保持唯一；
- 审查与写回链路可审计。

---

## 3. MVP 范围

### 3.1 In scope

MVP 必须包含：

1. 从当前 `principles-registry.json` 生成 `review-model.json`
2. 生成单文件、可 `file://` 打开的 `review.html`
3. HTML 支持：
   - 搜索
   - lifecycle / reason 过滤
   - 单条 action 选择
   - reviewer note 输入
   - 批量 action
4. 从 HTML 导出 `review-decision.json`
5. `/ptc principles review import <file>` 导入决策文件
6. importer 做 schema 校验与 snapshot hash 校验
7. importer 将 action 映射为 lifecycle 更新并写回 registry
8. import 结束后输出结构化 summary

### 3.2 Out of scope

MVP 不包含：

- localhost submit server
- 浏览器直接提交到扩展 runtime
- 自动打开浏览器
- content 重写 / split / merge 编辑器
- 多人协作审查
- reviewer 身份签名
- 直接编辑 `content` / `tags` / `activeScore`

---

## 4. 命令契约

> 注：当前 `index.ts` 中 `/ptc` 仅公开 `status / on / off / config`。本 spec 定义未来扩展的最小命令面，不表示当前代码已实现。

### 4.1 Export

```text
/ptc principles review export
/ptc principles review export <output-dir>
```

行为：
- 从当前 registry 生成 review bundle
- 输出文件：
  - `review-model.json`
  - `review.html`
- TUI 中返回输出目录与打开提示

默认输出目录建议：

```text
~/.passtocontext/memory/principles/reviews/<timestamp>/
```

例如：

```text
~/.passtocontext/memory/principles/reviews/2026-05-12T11-20-30Z/
```

### 4.2 Import

```text
/ptc principles review import <decision-file>
```

行为：
- 读取 `review-decision.json`
- 校验其针对的 registry snapshot 是否仍匹配当前 registry
- 应用 lifecycle 更新
- 写回 `principles-registry.json`
- 输出 import summary

### 4.3 Usage

未来 `/ptc` usage 建议更新为：

```text
/ptc [status|on|off|config|principles review export|principles review import <file>]
```

---

## 5. Review Bundle 文件模型

### 5.1 `review-model.json`

该文件是 **只读审查快照**。

#### 顶层结构

```json
{
  "version": 1,
  "kind": "principles-review-model",
  "generatedAt": "2026-05-12T11:20:30.000Z",
  "reviewSessionId": "2026-05-12T11-20-30Z",
  "registryPath": "/Users/handy/.passtocontext/memory/principles/principles-registry.json",
  "registrySnapshotHash": "sha256:abc123",
  "summary": {
    "total": 37,
    "injectable": 21,
    "active": 29,
    "stale": 3,
    "archived": 4,
    "disabled": 1,
    "review": {
      "staleCandidates": 4,
      "pseudoCandidates": 3,
      "oversizedCandidates": 2
    }
  },
  "filters": {
    "supportedLifecycle": ["active", "stale", "archived", "disabled"],
    "supportedActions": ["keep-active", "mark-stale", "archive", "disable"]
  },
  "items": []
}
```

#### item 结构

```json
{
  "id": "2026-05-11T16-57-principle-55we",
  "created": "2026-05-11T16:57:00.000Z",
  "updated": "2026-05-12T02:10:00.000Z",
  "content": "新增：同步文档。新增：更新 README 并记录迁移备注。",
  "tags": ["legacy"],
  "metadata": {
    "lifecycle": "active",
    "activeScore": 2,
    "hintCount": 2,
    "lastHintedAt": "2026-05-12T02:02:00.000Z",
    "conflictGroupId": null
  },
  "review": {
    "reasons": ["pseudo-candidate"],
    "signals": ["multiple-新增", "mentions-README", "migration-note"],
    "recommendedAction": "mark-stale"
  }
}
```

#### 设计要求

- `review-model.json` 必须足够让 HTML 独立运行；
- HTML 不再额外读取 registry；
- `review.reasons` 是给人看的诊断标签；
- `review.recommendedAction` 只是默认建议，不自动生效。

### 5.2 `review.html`

该文件为 **单文件静态 HTML**。

要求：
- 可直接 `file://` 打开；
- 内联 CSS / JS；
- 不依赖外部 CDN；
- 默认读取同目录下的 `review-model.json`；
- 若浏览器安全策略导致 `file://` 下 fetch 受限，可考虑在导出时把 model 直接内嵌进 HTML；
- MVP 应优先选择 **内嵌 model JSON** 的单文件模式，保证离线可用性。

> 结论：虽然 bundle 目录中仍保留 `review-model.json` 作为审计快照，但 `review.html` 应优先将该快照内嵌，避免 `file://` 跨文件读取的不确定性。

### 5.3 `review-decision.json`

该文件为 **人工裁决文件**，由 HTML 导出。

#### 顶层结构

```json
{
  "version": 1,
  "kind": "principles-review-decision",
  "generatedAt": "2026-05-12T11:35:12.000Z",
  "reviewSessionId": "2026-05-12T11-20-30Z",
  "registrySnapshotHash": "sha256:abc123",
  "reviewer": "handy",
  "decisions": []
}
```

#### decision 结构

```json
{
  "id": "2026-05-11T16-57-principle-55we",
  "action": "mark-stale",
  "note": "命中 pseudo candidate，内容更像迁移 note，不应继续注入"
}
```

#### `action` 枚举

- `keep-active`
- `mark-stale`
- `archive`
- `disable`

MVP 规则：
- 未被用户显式选择 action 的 item 不进入 `decisions[]`
- `note` 可为空

---

## 6. HTML 信息架构

### 6.1 Header

显示：
- review session id
- generatedAt
- registry path
- snapshot hash

### 6.2 Summary

显示：
- total
- injectable
- active / stale / archived / disabled
- staleCandidates
- pseudoCandidates
- oversizedCandidates

### 6.3 Filters

支持：
- 按 lifecycle 过滤
- 按 review reason 过滤
- 按 tag 过滤
- 按 content 关键词搜索
- 只看“有 recommendedAction 的条目”

### 6.4 List Item

每条 principle 至少显示：
- `id`
- `content`
- `tags`
- 当前 `lifecycle`
- `activeScore`
- `hintCount`
- `review.reasons`
- `review.signals`
- `review.recommendedAction`

### 6.5 Row-level Controls

每条 principle 支持：
- 单选 action：
  - keep active
  - mark stale
  - archive
  - disable
- reviewer note 文本框

### 6.6 Batch Controls

至少支持：
- 对当前筛选结果全部 `mark-stale`
- 对当前筛选结果全部 `archive`
- 清空当前筛选结果决策

### 6.7 Export Controls

至少支持：
- `导出 decision JSON`
- `复制 snapshot hash`
- `显示已选决策数`

---

## 7. Import 规则

### 7.1 Schema 校验

importer 必须校验：

1. `kind === "principles-review-decision"`
2. `version === 1`
3. `registrySnapshotHash` 存在
4. `decisions` 为数组
5. 每个 decision 的 `id` 为非空字符串
6. 每个 decision 的 `action` 在允许枚举中

### 7.2 Snapshot Hash 校验

若 decision 中的 `registrySnapshotHash` 与当前 registry 不一致：

- 默认拒绝导入
- 返回 `snapshot mismatch`

原因：
- 防止用户针对旧快照做出的审查误覆盖新 registry
- 防止导入期间发生 silent drift

MVP 不提供 `--force`

### 7.3 ID 存在性校验

若 decision 中的 `id` 不存在于当前 registry：

- 默认拒绝整个导入
- 输出缺失 id 列表

这样比“部分成功、部分失败”更容易维持审计一致性。

### 7.4 Action -> Lifecycle 映射

| action | lifecycle |
|---|---|
| `keep-active` | `active` |
| `mark-stale` | `stale` |
| `archive` | `archived` |
| `disable` | `disabled` |

### 7.5 写回范围

MVP importer 仅允许更新：
- `metadata.lifecycle`
- `updated`

MVP 不允许通过 decision 文件修改：
- `content`
- `tags`
- `activeScore`
- `hintCount`
- `conflictGroupId`

---

## 8. Snapshot Hash 规则

### 8.1 目标

`registrySnapshotHash` 用于表达：

> “这份审查裁决是基于哪一版 registry 做出的？”

### 8.2 MVP 计算方式

MVP 推荐：

> 对 `principles-registry.json` 的**原始文件文本**做 `sha256`

原因：
- 实现最简单；
- 避免 stringify 规则差异；
- 最接近“用户实际审查的文件版本”。

输出格式建议：

```text
sha256:<hex>
```

### 8.3 复用建议

后续实现时，建议把 hash 逻辑抽为共享函数，例如：

```ts
computeFileHash(filePath: string): string
```

供 exporter 与 importer 共享，避免不一致。

---

## 9. Recommended Action 生成规则

`review-model.json` 中的 `review.recommendedAction` 由 exporter 基于当前 diagnostics 与启发式规则生成。

建议默认映射：

| 命中情况 | recommendedAction |
|---|---|
| stale candidate | `mark-stale` |
| pseudo candidate | `mark-stale` |
| oversized candidate | `mark-stale` |
| 当前 lifecycle=archived | `archive` |
| 当前 lifecycle=disabled | `disable` |
| 其他 active/stable 项 | `keep-active` |

说明：
- `recommendedAction` 是 review UI 的默认建议，不自动生效；
- 最终生效动作以用户导出的 decision 为准。

---

## 10. 安全边界

### 10.1 HTML 不直接修改 registry

浏览器页面不能：
- 直接写 registry 文件
- 直接修改运行时内存态
- 绕过 importer 校验

### 10.2 Importer 是唯一写入口

所有人工审查动作都必须经过 importer。

### 10.3 Decision 是离散动作，不是自由编辑协议

MVP decision 只支持有限 action 枚举，不支持任意 patch。

这样可避免：
- HTML 变成“通用数据库编辑器”
- 结构化审查面被重新扩张成自由文本编辑器

---

## 11. 审计与可观测性

### 11.1 Export 输出

执行 export 后，TUI 至少应返回：

```text
Principles review bundle exported:
- dir: ~/.passtocontext/memory/principles/reviews/2026-05-12T11-20-30Z
- files: review-model.json, review.html
- snapshot: sha256:abc123
```

### 11.2 Import 输出

执行 import 后，TUI 至少应返回：

```text
Principles review imported:
- total decisions: 7
- updated: 7
- active: 2
- stale: 3
- archived: 1
- disabled: 1
- registry: ~/.passtocontext/memory/principles/principles-registry.json
```

### 11.3 错误输出

典型错误：

```text
Import failed: snapshot mismatch
```

```text
Import failed: unknown principle ids
- 2026-05-11T16-57-principle-xxxx
```

---

## 12. 代码落点建议

建议新增：

### 12.1 Runtime 逻辑

- `grc-principles-review.ts`
  - build review model
  - validate decision file
  - apply review decisions
  - compute hash

- `grc-principles-review-html.ts`
  - 生成单文件 HTML
  - 内嵌 model + UI JS + CSS

### 12.2 `/ptc` 命令接入

在 `index.ts` 中扩展：
- `principles review export`
- `principles review import <file>`

### 12.3 测试

建议新增：
- `tests/grc-principles-review.test.ts`

至少覆盖：
1. review model 结构正确
2. recommendedAction 映射正确
3. snapshot hash mismatch 会拒绝导入
4. action -> lifecycle 映射正确
5. HTML 包含核心交互控件

---

## 13. 实现切片建议

### Slice 1：Review Model Export

目标：先把 registry 变成稳定的 review-model JSON

包含：
- registry 读取
- summary 计算
- review item 映射
- snapshot hash
- 测试

### Slice 2：Static HTML Projection

目标：把 review-model 投影为可交互 HTML

包含：
- 单文件 HTML
- summary / filters / rows / action radio / export button
- decision JSON 下载

### Slice 3：Decision Importer

目标：实现结构化回写

包含：
- schema 校验
- snapshot mismatch 拒绝
- lifecycle 更新
- import summary

### Slice 4：Command Wiring

目标：接入 `/ptc` 命令面

包含：
- export/import 子路由
- usage 更新
- UI notify 文案

### Slice 5：README 最小使用说明

仅补：
- 命令示例
- review bundle 目录说明
- decision import 示例

---

## 14. 后续增强方向（非 MVP）

可在后续阶段增加：

1. localhost submit 模式
2. 自动打开浏览器
3. 冲突组视图（按 `conflictGroupId`）
4. split / merge / rewrite workflow
5. reviewer identity / signature
6. 团队共享 export/import
7. decision import dry-run 模式

---

## 15. 验收标准

### 15.1 结构验收

- review/export 使用 JSON-first 协议
- HTML 明确只是投影层
- importer 为唯一写入口

### 15.2 行为验收

- 用户可在 TUI 外完成原则审查
- 用户裁决不再依赖自然语言解释
- decision 文件可被 importer 确定性应用

### 15.3 安全验收

- snapshot mismatch 默认拒绝导入
- HTML 无法绕过 importer 直接写 registry
- decision 只支持有限动作枚举

### 15.4 架构一致性验收

- `principles` 继续保持“历史经验启发层”定位
- review/export 不把 principles 再膨胀成第二套动态 prompt 系统
- 该能力服务于 Phase 4 的 injectable / non-injectable 边界治理，而不是替代 generator-contract

---

## 16. 最终结论

对于当前 PasstoContext v1.1：

> **最合适的 review/export MVP 是：`registry JSON -> review-model JSON -> static HTML -> decision JSON -> importer`。**

它同时满足：
- 去自然语言漂移
- TUI 外交互
- HITL 审查
- 可审计、可回放
- 不引入不必要的运行时复杂度

并且与当前 `generator-contract.md` 中对 `principles` 的降权边界完全一致。
