# Passto Desk Runtime Surface

## Purpose

这份 reference 说明：命中 `passto-desk` 后，真实运行面是什么、哪些文件是固定 contract、哪些路径是默认 workflow。

## Primary tool surface

优先使用扩展工具：`passto_desk`

常用 action：
- `create_room`
- `bind_room`
- `read_scene`
- `export_domain_json`
- `save`
- `import_scene_json`（replace）
- `import_domain_json`（replace）
- `append_elements`（append）
- `paste_clipboard_payload`（append）

## Preferred default path

默认不要直接手写 Excalidraw elements。

优先路径应为：
1. 需要读当前结构时，先 `export_domain_json`
2. 需要整体改写当前结构时，先把当前理解整理为 **`passto-desk-domain-json/v3`**
3. v3 至少应包含：`semantic / view / mapping / visual`
4. 调用 `import_domain_json` 替换当前共享图
5. 如果只是增量补几个元素，再考虑 `append_elements` / `paste_clipboard_payload`
6. 需要时再 `read_scene` / `save`

## Update strategy threshold

passto-desk 的运行策略不应被简化成“永远 append”或“永远全量 replace”。

更合理的默认判断是：
- **低复杂度增量**：允许局部 append / paste
- **中复杂度增量**：优先局部重建相关结构块
- **高复杂度变更**：优先基于 domain v3 整图重生成

这里的关键不是追求把所有局部冲突都自动兼容，而是判断：
**继续兼容旧局部布局的代价，是否已经高于局部重建甚至整图重建。**

### Recommended policy

#### 1. Human-first local edit
当明显是人类在共享白板上手工补充时：
- 允许局部追加
- 不强求自动冲突回退做到完美
- 系统可以尽量回读，但不应把自己升级成重型增量排版器

#### 2. Agent-first structural update
当明显是 agent 在更新结构时：
- 默认优先 `export_domain_json -> 修改 v3 -> import_domain_json`
- 共享白板是沟通表面，**domain v3 才是 agent 修改的主真相源**
- agent 不应长期依赖 element 级 patch 维持图一致性

#### 3. Threshold / valve
当新增元素导致以下任一信号明显上升时，应切换策略，而不是继续堆局部兼容：
- 新关系跨越主干、产生多处交叉
- 新 annotation / note 开始挤占主干阅读区
- lane / group / relation label 的局部避让链条明显变长
- 为保持局部稳定，需要引入越来越多例外规则
- 继续 append 的认知成本已经高于“局部重建一个结构块”

此时策略应升级为：
1. **局部重建**：只重建受影响的子图 / 子结构
2. **整图重建**：如果局部边界已不清晰，直接基于 v3 重生成全图

## Update mode decision table

| mode | 何时优先选择 | agent 应重点看什么 | 主要风险 | 推荐动作 |
|---|---|---|---|---|
| append | 只补少量说明、局部 note/annotation、少量不扩散的新元素 | 变化是否局限在单个局部；是否不破坏主干阅读带；是否无需连锁挪动多个对象 | 局部补丁逐渐堆积，后续可读性下降 | `append_elements` / `paste_clipboard_payload` |
| local rebuild | 影响集中在一个子流程、一个 group、一个 lane、少量相邻 relations，但继续 patch 已开始变脆 | 受影响结构块是否边界清晰；是否能单独重做而不必改全图 | 子图边界判断失误，局部修复反而制造整体不一致 | 先改 v3 中对应结构，再局部重建相关块；必要时仍走 `import_domain_json` |
| full rebuild | 结构表达已明显变化；新增关系跨多个结构块；主干阅读路径被破坏；局部兼容成本已高于重建成本 | `semantic / view / mapping / visual` 是否都受影响；当前图是否仍适合作为 patch 基底 | 成本略高，但通常比继续堆兼容更稳 | `export_domain_json -> 修改 v3 -> import_domain_json` |

### Agent-facing reminder

这张表是给 agent 的推荐判断框架，不是硬编码规则。

agent 在运行时应结合：
- 当前任务语义
- 当前共享图状态
- 用户这次是在“补一点”还是“重写结构”
- 局部兼容成本是否已经高于重建成本

然后自主决定使用 append、local rebuild 或 full rebuild。

### Dry-run strategy judgment

当用户明确要求：
- 先判断更新模式
- 暂时不要真的调用工具
- 或当前还没有绑定 room / 还没有读到真实结构

agent 也不应直接停在“请先给我 room URL / 请先绑定 room”。

更合适的做法是：
1. **先基于用户描述做暂定判断**：append / local rebuild / full rebuild 哪个更可能合适
2. 明确说明：这是基于当前描述的 provisional judgment，不是最终执行决定
3. 再把“读取真实结构以验证边界和布局影响”作为下一步，而不是当前回答的终点

默认倾向应为：
- 少量附注、少量局部说明 → 先倾向 append
- 单个子流程 / 单个 group / 单个 lane 的结构重整 → 先倾向 local rebuild
- 主干、lane、group、主关系一起重排，或用户明确说图已被多轮补丁搞乱 → **默认把 full rebuild 作为更强候选；除非有明确证据表明受影响边界很小且旧结构仍高度可信，否则不要先保守降级到 local rebuild**

也就是说：
**缺少真实 room 不应阻止先做策略判断；它只会阻止立即执行。**

## Fixed file contracts

- `scripts/excalidraw-to-domain-json.mjs`
- `scripts/domain-json-to-excalidraw.mjs`
- `scripts/runtime-contracts.mjs`

需要 scene / domain-json 转换时，必须走这些固定脚本，不要临时发明格式。
其中 `scripts/runtime-contracts.mjs` 负责当前最小 runtime contract helper，包括：
- `buildSharedStateSnapshot(...)`
- `mergeSharedStateSnapshot(...)`
- `buildValidationResult(...)`
- `buildNextRoundDecision(...)`
- `commitTransformResult(...)`

## Standard runtime regression entry

当前最小 runtime 闭环的标准验证入口是：

```bash
npm run runtime:smoke
```

它会顺序执行：
1. `npm run runtime:smoke:merge`
2. `npm run runtime:smoke:commit`
3. `npm run runtime:smoke:reverse`
4. `npm run runtime:smoke:forward`

用途：
- 验证 shared state merge helper
- 验证 `commitTransformResult(...)` 提交闭环
- 验证 reverse transform 是否成功写出 runtime metadata
- 验证 forward transform 是否成功写出 runtime metadata

输出文件：
- `/tmp/passto-runtime-reverse.domain.json`
- `/tmp/passto-runtime-forward.excalidraw`

## Domain model layers

当前推荐结构模型为：`passto-desk-domain-json/v3`

### 1. semantic
给 agent 用的对象关系层：
- `objects[]`
- `relations[]`
- `notes[]`（可选：note / annotation / legend 等辅助沟通对象）
- `annotation.target`（可选：声明 annotation 附着到 object / relation）

### 2. view
给结构编排层使用：
- direction
- lanes
- members
- visibleRelations

### 3. mapping
给视图映射层使用：
- objectToNode
- relationToEdge

### 4. visual
给可读性与主题层使用：
- palette
- typography
- layoutPolicy

## Semantic drawing rules

图不是像素摆放，必须优先保证语义绑定：
- 节点标签必须是 **bound text**
- 连线必须是 **bound arrow**
- relation label 优先作为结构化 relation label 表达
- side 必须收敛到 `top/right/bottom/left`
- 不允许用 free text 冒充节点标签
- 不允许用视觉贴边冒充绑定成立
- 不允许把“靠近箭头的文字”作为默认关系表达策略
- note / annotation / legend 如果存在，优先作为结构化对象表达，而不是漂在画布上的无主文本
- annotation 应优先表达“附着性说明”，视觉上应与普通 note 区分
- 如果 annotation 明确服务于某个节点或关系，应尽量保留 target 绑定
- annotation 已有明确 target 时，默认布局应贴近 target，而不是停留在统一说明带

## v3 capability note

v3 相比旧 v2，新增了：
- semantic object / relation 层
- structure view 层
- mapping 层
- visual policy 层
- edge label 的结构化表达能力
- lane / group 的结构表达与基础容器渲染
- 更稳定的 elbowed relation 输出
- note / annotation / legend 的基础结构表达
- annotation target 驱动的近目标布局
- relation routing 对 annotation / group / lane 标题区的基础避让

仍需注意：
- 当前 layout 仍是轻量策略，不是全自动高级排版器
- 当图特别复杂时，仍应优先拆图，而不是首轮塞满

## Style defaults

如果用户没有额外指定，默认样式为：
- 字体：normal
- 节点字号：20
- 边标签字号：16
- 线条风格：朴素
- 描边宽度：细
- action / decision / state 采用基础分色

## Readback path

当用户要从现有共享工作台继续推进时：
1. 优先 `export_domain_json`
2. 如需保留原始 scene，再 `save`
3. 基于返回的 `semantic / view / mapping / visual / warnings` 继续讨论 / 修改 / 导入
4. 修改后如果要整图更新，优先走 `import_domain_json`
5. 只有明确是增量追加时，才走 `append_elements` / `paste_clipboard_payload`

回读时额外检查：
- `warningCount` 是否可接受
- `freeTextCount` 是否符合预期
- 关系是否已经进入结构化 relation label，而不是位置猜测
- 节点文字是否明显过长
- 主干是否仍清楚
- lane / group 是否被结构化回读，而不是退化为普通大矩形
- note / legend 是否被吸收到结构层，而不是继续漂浮为 free text
- annotation 是否保持为辅助附着说明，而不是挤占主干节点
- annotation target 是否能稳定 roundtrip，而不是回读后丢失附着对象
