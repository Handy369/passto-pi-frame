---
name: passto-desk
description: 用于把纯文本讨论升级为共享工作台协作，并通过“语义对象层 → 结构编排层 → 视觉映射层 → Excalidraw 视图层”的固定 workflow，把逻辑、流程、关系、阶段、依赖、架构骨架转成既适合 agent 持续修改、又适合人类阅读的共享工作台。适用于需要共同外化对象、对象关系、主干流程、分支条件、阶段结构与视图映射的场景；不适用于纯代码实现、纯文档写作、一次性文字答复、浏览器运行态调试，或不需要共享可视化中间物的简单问答。
---

# Passto Desk

> 目标：让 agent 不再从“文字理解”直接跳到“Excalidraw 图元摆放”，而是稳定经过 **语义建模 → 结构编排 → 视觉映射 → 图形生成** 四段 workflow，产出既对 agent 友好、又对人类可读的共享工作台。

## Why

passto-desk 之前的主要问题，不只是“有没有命中工作台 skill”，而是缺少一个完整的中间结构：
- agent 需要的是对象与关系
- 人类需要的是可读的结构图
- Excalidraw 只是一种视图承载，不该直接变成唯一中间模型

如果没有分层，agent 最容易出现：
1. **语义跳跃**：从文本直接跳到元素摆放
2. **关系退化**：关系信息只能塞进节点文字，或靠位置暗示
3. **结构缺失**：没有主干 / 分组 / 视图范围 / 主次层级
4. **视觉随机**：像 mermaid 平铺一样排布，连线和阅读路径不稳定
5. **映射缺失**：agent 对象视图与人类 Excalidraw 视图之间没有显式 mapping

因此本 Skill 的职责，是把共享工作台协作固定为 4 个层次：
1. **Semantic Modeling**：抽出对象与关系
2. **Structural Composition**：把对象与关系组织成结构视图
3. **Visual Mapping**：把结构视图映射为可表达的节点 / 边 / 标签
4. **Readability Optimization**：优化布局、字号、颜色、主次层级

## What

当前主输出物不是“一张图”，而是：
- 一个可持续协作的共享工作台
- 一份对 agent 友好的结构文件：`passto-desk-domain-json/v3`
- 一套 agent 语义对象视图 ↔ Excalidraw 视觉图的 mapping
- 一张可读的共享结构图

命中本 Skill 后，agent 应优先判断：
1. 当前问题是否真的需要共享工作台
2. 应该 create / bind / read 哪条路径
3. 当前信息应先进入 **semantic**，还是基于现有图回读 **mapping / visual**
4. 当前是先出最小骨架图，还是先整理完整结构视图
5. 当前是否需要 edge label、decision node、lane、group、视觉层级

### non-goals

即使命中本 Skill，也不要顺手扩做：
- 代替 `project-definition` 做完整产品定义
- 代替 `project-implementation` 做实现、调试、测试
- 把所有信息首轮塞成一张完整大图
- 为了“可视化”而牺牲结构语义
- 把 Excalidraw element JSON 误当成 agent 侧的唯一结构模型

## Top-level Boundary Pack

- current main output: 共享工作台协作中间物 + 面向 agent 的结构文件 + 面向人的可读图
- current main action: 把纯对话升级为共享工作台协作，并围绕同一份结构视图持续迭代
- adjacent skills / workflows:
  - `project-definition`
  - `project-implementation`
  - `browser-runtime-observation`
  - `visual-feedback-ui-qa`

### should-trigger

当用户的真实需求包含以下任一项时，应优先考虑命中本 Skill：
- 一起整理结构 / 流程 / 架构 / 关系 / 分组 / 依赖 / 时序 / 状态
- 边聊边改，先搭一个骨架
- 把当前讨论外化到共享工作台，再继续推进
- 读取当前共享白板 / 共享工作台，再继续修改
- 把对象和连接关系整理成双方都能看的共享结构图
- 不想只靠文字描述，希望围绕同一份可视化中间物协作
- 用户显式提到 `passto-desk` / 共享白板 / 工作台 / “先画个图”

### update mode decision

命中后还应额外判断：
- 当前是 **agent 结构更新**，还是 **human 局部补充**
- 当前复杂度是否仍适合 append
- 是否已经到达“局部兼容成本 > 局部重建 / 整图重建成本”的阈值

默认建议：
- agent 更新结构：优先 `export_domain_json -> 修改 v3 -> import_domain_json`
- human 局部补充：允许 append / paste，但不承诺重型自动回退
- 复杂度越过阈值：切换到局部重建或整图重建

### should-not-trigger

- 用户只要一次性文字回答
- 任务是纯代码实现 / 修 bug / 跑测试
- 任务是纯文档产出，不需要共享中间物
- 用户只是询问概念，不需要共同整理结构
- 任务很小，直接文本列点比开工作台更快
- 虽然提到图，但真实目标是浏览器运行态调试、性能或 UI QA

### first action after hit

命中后第一步不是立刻画图，而是先判断：
- 是否真的需要共享工作台
- 如果需要，应该 create / bind / read 哪条路径
- 当前是先抽对象和关系，还是先回读现有 domainJson
- 当前是否应优先走 `export_domain_json` / `import_domain_json`

如果用户显式点名 `passto-desk`：
- 先读取 `SKILL.md`
- 再读取 `references/runtime-surface.md`
- 再读取 `references/readability-and-fast-path.md`
- 然后进入 4-phase workflow，而不是直接拼 Excalidraw elements

### current runtime loop note

当前项目中的最小 runtime 闭环已经落到脚本层，核心 helper 位于：
- `scripts/runtime-contracts.mjs`

其中 forward / reverse transform 的最小提交点统一为：
- `commitTransformResult(...)`

当前最小 contract 结构包括：
- `SharedSemanticState`
- `TransformOutput`
- `ValidationResult`
- `NextRoundDecision`

标准验证入口：

```bash
npm run runtime:smoke
```

它会顺序验证：
- merge
- commit
- reverse transform
- forward transform

## Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent | owner behavior it changes |
|---|---|---|---|---|
| `SKILL.md` | required | runtime | 顶层入口；定义 4-phase workflow 与边界 | 不允许从文本直接跳 elements |
| `references/boundary.md` | required | runtime | 补边界判别与相邻去向 | 降低误吸与漏吸 |
| `references/workbench-conversation-patterns.md` | required | runtime | 补自然语言协作模式 | 让 agent 用共享工作台语言和用户沟通 |
| `references/runtime-surface.md` | required | runtime | 补真实工具面与 v3 contract | 命中后进入正确导出/导入路径 |
| `references/readability-and-fast-path.md` | required | runtime | 补最小骨架、视觉 fallback、可读性 guard | 降低首轮乱图与过度堆叠 |
| `validation/trigger-benchmark-seeds.md` | required | external | 命中/不命中 seed 与 adopt review | 便于 benchmark / human review |
| `scripts/` | required | runtime | 承载 v3 ↔ Excalidraw 固定转换 | 不允许 agent 临时发明格式 |
| `templates/` | forbidden | runtime | 当前没有独立模板价值 | 避免空骨架 |
| `checklists/` | forbidden | runtime | 当前检查点已收敛在 references / validation | 避免重复结构 |

## Source Map

按最小读取路径采用：
- 判断该不该命中时：`references/boundary.md`
- 判断如何自然把用户带进共享工作台时：`references/workbench-conversation-patterns.md`
- 判断命中后该用哪些 action / contract 时：`references/runtime-surface.md`
- 判断如何先做可读骨架、如何处理 edge label / readability 时：`references/readability-and-fast-path.md`
- benchmark / 回归验证时：`validation/trigger-benchmark-seeds.md`

## Flow

## Agent steering note

命中 `passto-desk` 后，agent 不应直接默认一种更新模式，而应先做一次简短判断：
- 这次更像 **human-style 局部补充**，还是 **agent-style 结构更新**？
- 这次变化是否仍适合 append？
- 局部兼容的复杂度，是否已经高于局部重建或整图重建？

推荐的内部思路是：
1. 先读当前 `semantic / view / mapping / visual`
2. 判断变化影响范围
3. 判断是否会破坏主干阅读路径
4. 在 append / local rebuild / full rebuild 之间做选择
5. 再执行对应导入路径

这里的重点不是“永远少改”，而是：
**选择当前总成本最低、语义最稳、对人类最可读的更新方式。**

### Phase 1：Semantic Modeling
先把当前理解整理成对象与关系，而不是先画图：
- 抽出 object
- 抽出 relation
- 判断 relation 是否有 label / condition / branch 语义
- 判断 object 是否有 type（action / state / decision / note 等）

### Phase 2：Structural Composition
再把对象与关系组织成结构视图：
- 哪些 object 进入当前视图
- 哪些 relation 在当前视图显式可见
- 主干是什么
- 是否需要 lane / group / priority / direction
- 首轮是否只产出最小骨架

### Phase 3：Visual Mapping
再把结构视图映射成可表达的视觉对象：
- object → node
- relation → edge
- relation label → edge label 或 fallback
- 当前无法优雅表达的语义，要显式 fallback，而不是靠位置暗示

### Phase 4：Readability Optimization
最后再做视觉与布局优化：
- 节点数量控制
- 字体 / 字号 / 颜色层级
- 主干关系清晰
- 决策节点、状态节点、动作节点样式区分
- 减少首轮过度堆叠

### Runtime path A：从对话进入共享工作台
1. create_room 或请求 bind
2. 先整理 `semantic`
3. 再整理 `view / mapping / visual`
4. 产出 `passto-desk-domain-json/v3`
5. 调用 `import_domain_json`
6. 回读并继续迭代

### Runtime path B：继续已有共享工作台
1. bind / 确认 room
2. 优先 `export_domain_json`
3. 回读 `semantic / view / mapping / visual`
4. 先判断当前属于 agent 结构更新，还是 human 局部补充
5. 如果是低复杂度局部补充，可 append / paste
6. 如果结构影响已扩散，优先局部重建或 `import_domain_json`
7. 修改后再导入并继续回读

### Runtime strategy valve

passto-desk 的默认策略不是“永远 append”，也不是“小改动就整图 replace”。

更合理的策略阀门是：
- **低复杂度变更**：局部追加 / 轻量布局修正
- **中复杂度变更**：局部结构块重建
- **高复杂度变更**：基于 domain v3 整图重生成

关键判断不是“能不能继续 patch”，而是：
**继续 patch 的复杂度，是否已经高于重建的复杂度。**

因此：
- agent 主路径应偏向结构驱动重生成
- human 主路径允许局部自由补充
- 当复杂度阈值被越过时，应主动切换策略，而不是继续堆兼容规则

## Surface

### 对用户的可见表述
更自然的说法应该是：
- “这个更适合放到共享工作台上一起整理，我先给你搭个骨架。”
- “我先把对象和关系外化出来，再给你一个可读版本。”
- “我先做主干流程，再把分支和细节逐轮补进去。”

### 对 agent 的默认执行面
优先使用 `passto_desk`：
- `create_room`
- `bind_room`
- `read_scene`
- `export_domain_json`
- `save`
- `import_scene_json`
- `import_domain_json`
- `append_elements`
- `paste_clipboard_payload`

默认路径应为：
1. 读当前结构时先 `export_domain_json`
2. 修改 `passto-desk-domain-json/v3`
3. 通过 `import_domain_json` 整图替换
4. 只有明确是增量时才 append

### Domain contract
默认结构模型为：`passto-desk-domain-json/v3`

至少包含：
- `semantic.objects`
- `semantic.relations`
- `view`
- `mapping`
- `visual`
- `scene`
- `warnings`

如果当前图需要降低 agent-human 漂移，可额外使用：
- `semantic.notes`
- `view.lanes`
- `view.groups`
- `mapping.groupToContainer`
- `mapping.laneToContainer`

agent 不应把 Excalidraw element 直接当成唯一结构模型；Excalidraw scene 只是最终视图承载。

## Output Contract

### what counts as adopt
至少应观察到以下信号：
- agent 先判断是否需要共享工作台
- agent 不要求用户先说 Excalidraw
- agent 命中后不是直接手摆 elements，而是先进入 semantic / view / mapping / visual workflow
- agent 优先走 `export_domain_json -> 修改结构文件 -> import_domain_json`
- agent 首轮优先画最小骨架
- agent 不再把边语义主要靠位置暗示

### what does not count as complete
以下都不算真正完成：
- 只说“可以画图”但没有进入共享工作台 workflow
- 只从文本直接手写 Excalidraw elements
- route 对了，但没有进入 semantic / structure / mapping / visual 四段流程
- 关系主要靠位置猜，而不是结构化关系
- 没有回读检查 warnings / freeTexts / mapping 稳定性

## Runtime Proof

本 Skill 被正确 adopt 的证据应表现为：
- agent 在需要共享工作台协作的任务里主动考虑 passto-desk
- 用户显式提到 `passto-desk` 时，agent 会进入 fast path
- agent 在导入整图时优先走 `passto-desk-domain-json/v3 -> import_domain_json`
- agent 先做 semantic / view / mapping，再落 Excalidraw 图
- agent 可以表达 edge label，而不是只能把关系塞进节点
- 生成的图满足 bound text / bound arrow / 四向 side / 默认视觉层级
- lane / group 需求能进入结构层表达，而不是只靠位置围出一个区域
- note / annotation / legend 能显式作为辅助沟通层进入结构，而不是漂成 free text
- 生成的图在首轮具备可读骨架

## Flow / Surface Shape

这个 Skill 更接近：
- **组合编排型**：总入口在 `SKILL.md`，命中后按 boundary / conversation / runtime / readability 分流
- 同时具备明显的**多层映射型**特征：运行时核心不再只是“导图”，而是“语义对象层 ↔ 结构视图层 ↔ 视觉映射层 ↔ Excalidraw 图层”的稳定转换

## Operating Rules

1. 先判断是否需要共享工作台，再决定是否命中本 Skill。
2. 一旦命中，不允许从文本直接跳到 Excalidraw element。必须先过 semantic / structure / mapping / visual。
3. 修改现有图时优先 `export_domain_json -> 修改 -> import_domain_json`。
4. append / paste 只适合低复杂度增量补充，不应默认承担复杂结构更新。
5. 当局部兼容成本高于重建成本时，应切换到局部重建或整图重生成。
6. 首轮默认先做最小骨架，不要一口气塞满所有细节。
7. edge label 优先作为结构化 relation label 表达；不应靠靠近箭头的 free text 冒充。
8. lane / group / cluster 也属于结构层，不应只靠大框位置表达“这一块是一组”。
9. 节点标签默认短写，长说明不要首轮塞进节点。
10. 视觉优化服务于可读性，不得破坏对象与关系的结构表达。
11. 导入后必须回读，至少确认 warnings / freeTexts / 主干可读性没有明显退化。
12. 共享工作台服务的是协作与持续修改，不是炫技画图。
13. README 是实现说明；运行时入口是本 `SKILL.md` 与 references。
14. update mode 不应写死；应给 agent 足够结构信息与推荐框架，由 agent 自行判断 append / local rebuild / full rebuild。
