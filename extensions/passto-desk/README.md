# passto-desk

一个轻量的 Pi extension：把 Excalidraw shared room 直接当作 human ↔ agent 共享工作台。

> 说明：本 README 是**实现与集成说明**；真正给 agent 按需加载的入口是同目录下的 `SKILL.md`。

核心原则：
- 不走重型本地 host / backend
- 不模拟鼠标画图
- 直接用 `excalidraw/clipboard` payload 写入 shared room
- 直接从 shared room runtime 读取 scene
- 本地保存文件统一放在扩展根目录 `files/`
- `elements / sceneJson -> domain json` 一律走固定脚本，不允许每个 agent 自己猜转换方式
- 图形关系必须是**属性绑定**，不能只靠视觉位置“看起来像连上了”

## 目录

- 扩展入口：`index.ts`
- 本地保存目录：`files/`
- Excalidraw → Domain JSON：`scripts/excalidraw-to-domain-json.mjs`
- Domain JSON → Excalidraw：`scripts/domain-json-to-excalidraw.mjs`
- Agent 技能入口：`SKILL.md`
- 运行时参考：`references/`
- v2 示例：`examples/domain-v2-minimal.json`
- v3 示例：`examples/domain-v3-minimal.json`
- v3 lane/group 示例：`examples/domain-v3-lanes-groups.json`
- v3 lane/group/note/legend 示例：`examples/domain-v3-lanes-groups-notes.json`

## 命令

本扩展只注册一个命令：`/passto-desk`

### 1) 创建并绑定新的共享 room

```bash
/passto-desk
```

### 2) 绑定现有共享 room

```bash
/passto-desk bind <excalidraw room url>
```

示例：

```bash
/passto-desk bind https://excalidraw.com/#room=abc,def
```

### 3) 解绑当前 room

```bash
/passto-desk unbind
```

### 4) 保存当前画布到本地文件

```bash
/passto-desk save
```

行为：
- 读取当前绑定 room 的 live scene
- 保存为 `.excalidraw` 文件到：`files/`
- 文件名格式：`YYYYMMDD-随机runId.excalidraw`

## Agent 工具

本扩展也注册了一个工具：`passto_desk`

主要 action：
- `get_binding`
- `create_room`
- `bind_room`
- `unbind_room`
- `read_scene`
- `export_scene_json`
- `export_domain_json`
- `append_elements`：向当前 room **追加**元素
- `import_scene_json`：用给定 scene **替换**当前 room 内容
- `import_domain_json`：先转 scene，再**替换**当前 room 内容
- `paste_clipboard_payload`：按 clipboard 语义直接**粘贴/追加**
- `save`

## 核心语义约束

这是当前最重要的 contract。

> 说明：当前默认结构模型已经升级为 `passto-desk-domain-json/v3`。`v2` 仍可兼容读取，但新的 agent workflow 应优先围绕 **semantic / view / mapping / visual** 这四层工作，而不是直接操作 Excalidraw elements。

### 1) 矩形中的文字不能是“摆在中间的 free text”

必须是：
- 一个 shape element（例如 `rectangle`）
- 一个独立的 `text` element
- `text.containerId = shape.id`
- shape 的 `boundElements` 里包含该 text

也就是说：
- **文字与图形的关系靠属性绑定，不靠视觉位置**

### 2) 元素连接不能只靠“线头刚好碰到边”

必须是：
- 一个 `arrow` element
- `arrow.startBinding.elementId = sourceNode.id`
- `arrow.endBinding.elementId = targetNode.id`

也就是说：
- **连接关系靠属性绑定，不靠视觉碰撞**
- 当前不要用“箭头旁边放一段字”的方式冒充边标签语义

### 3) node 的连接点统一抽象为四个 side

domain json 里统一用：
- `top`
- `right`
- `bottom`
- `left`

因此一条边的语义表达应为：

```json
{
  "from": { "elementId": "node-a", "side": "right" },
  "to": { "elementId": "node-b", "side": "left" }
}
```

## 样式默认值

如果用户没有特别指定，passto-desk 默认使用：

- 字体：normal
- 线条风格：朴素
- 描边宽度：细

这套默认值已经体现在 `domain-json-to-excalidraw.mjs` 的生成逻辑里。

## 固定转换方式

后续任何 agent 如果需要做下列事情：
- 读取当前画布的节点/边/绑定关系
- 校验有没有 free text / dangling arrow
- 从结构化 graph 生成 Excalidraw scene

都必须走下面两条固定脚本，不要临时自己发明转换逻辑。

## Agent decision guidance

passto-desk 不需要把“追加 / 局部重建 / 整图重建”的阈值硬编码成单一自动规则。

更现实的做法是：
- 给 LLM 足够的结构信息、复杂度信号和默认引导
- 由 **agent 自行判断** 当前更适合 append、local rebuild 还是 full rebuild

原因很简单：
- 本来就是 agent 在画图
- agent 比固定规则更容易结合当前任务语义、当前图状态、用户意图一起判断
- 我们真正需要的是**清晰的决策面**，而不是过度僵硬的自动决策器

### agent 应参考的信息

当 agent 决定更新模式时，至少应结合这些信息：
- 当前 `semantic.objects / relations / notes` 的变化范围
- 当前 `view.lanes / groups / members / visibleRelations` 是否被改动
- 新增元素是否只影响单个局部，还是会扩散到多个结构块
- relation / annotation / label 的新增是否进入主干阅读带
- 当前目标更像“补一点说明”，还是“改变结构表达”
- 用户更像在做 human-style 局部补充，还是要求 agent 做结构更新

### 推荐框架，而非硬编码阈值

推荐默认值仍然是：
- 低复杂度补充：append / paste
- 中复杂度变化：local rebuild
- 高复杂度变化：full rebuild via domain v3

但这是一种**推荐决策框架**，不是必须死守的硬阈值。

如果 agent 基于上下文判断：
- 虽然元素不多，但已经破坏主干可读性
- 或虽然改动范围不大，但继续 patch 的解释成本很高

那么 agent 应允许自己直接切到局部重建或整图重建。

### runtime contract 含义

因此 runtime contract 更应强调：
- 提供足够信息给 agent
- 给出推荐判断框架
- 允许 agent 自主切换策略

而不是：
- 试图把所有情况提前写死成 deterministic 更新规则

### A. Excalidraw -> Domain JSON v3

```bash
node ./extensions/passto-desk/scripts/excalidraw-to-domain-json.mjs <input> [output]
```

或：

```bash
cd extensions/passto-desk
npm run to-domain-json -- <input> [output]
```

支持输入：
- `.excalidraw` / scene JSON（`{ elements, appState }`）
- 直接的 `elements[]` JSON

如果不传 output，默认输出：

```text
<basename>.domain.json
```

### B. Domain JSON v2 / v3 -> Excalidraw

```bash
node ./extensions/passto-desk/scripts/domain-json-to-excalidraw.mjs <input> [output]
```

或：

```bash
cd extensions/passto-desk
npm run from-domain-json -- <input> [output]
```

如果不传 output，默认输出：

```text
<basename>.excalidraw
```

## passto-desk-domain-json/v3 contract

`v3` 的重点不再只是几何与绑定，而是：
- agent 语义对象层
- 结构编排视图层
- 视觉映射层
- Excalidraw 输出层

顶层推荐结构：

```json
{
  "version": "passto-desk-domain-json/v3",
  "semantic": {
    "objects": [],
    "relations": []
  },
  "view": {
    "direction": "LR",
    "lanes": [],
    "groups": [],
    "members": [],
    "visibleRelations": []
  },
  "mapping": {
    "objectToNode": [],
    "relationToEdge": []
  },
  "visual": {
    "palette": {},
    "typography": {},
    "layoutPolicy": {}
  },
  "scene": {},
  "warnings": []
}
```

### semantic

- `objects[]`：对象清单
- `relations[]`：对象关系清单
- `notes[]`：辅助沟通对象（note / annotation / legend，可选）

### view

- `direction`：主布局方向
- `lanes[]`：泳道
- `groups[]`：分组 / cluster
- `members[]`：对象如何进入当前视图
- `visibleRelations[]`：哪些关系显式展示

### mapping

- `objectToNode[]`：对象如何映射成节点
- `relationToEdge[]`：关系如何映射成边
- 可选包含 lane / group container mapping
- 可配合 note / legend 节点一起降低协作沟通漂移

### visual

- `palette`
- `typography`
- `layoutPolicy`

### v2 compatibility

`v2` 仍可继续导入并转成 Excalidraw，但新的 agent 协作与图结构编辑，应优先围绕 `v3`。
      "elementId": "node-a",
      "focus": 0,
      "gap": 1,
      "fixedPoint": null
    }
  },
  "to": {
    "elementId": "node-b",
    "side": "left",
    "point": { "x": 420, "y": 170 },
    "binding": {
      "elementId": "node-b",
      "focus": 0,
      "gap": 1,
      "fixedPoint": null
    }
  }
}
```

### freeTexts

所有没有 `containerId` 的 text 会出现在：

```json
"freeTexts": []
```

这意味着它们不是 bound text。

### warnings

脚本会显式输出结构化告警，例如：
- `FREE_TEXT`
- `MISSING_TEXT_CONTAINER`
- `UNBOUND_ARROW_START`
- `UNBOUND_ARROW_END`
- `MISSING_ARROW_START_NODE`
- `MISSING_ARROW_END_NODE`
- `VISUAL_ONLY_CONNECTION`

## 推荐使用流程

### 场景 1：从当前共享白板提取 graph 语义

1. `/passto-desk save`
2. 得到 `.excalidraw` 文件路径
3. 运行：

```bash
node ./extensions/passto-desk/scripts/excalidraw-to-domain-json.mjs <saved-file>
```

### 导入 / 追加语义区别

这是运行时最容易误用的地方：

- `append_elements`：append
- `paste_clipboard_payload`：append
- `import_scene_json`：replace
- `import_domain_json`：replace

也就是说：
- 如果目标是“在现有图上继续加东西”，用 `append_elements` / `paste_clipboard_payload`
- 如果目标是“把当前共享工作台整体替换成一份新图”，用 `import_scene_json` / `import_domain_json`

### 场景 2：从结构化 graph 生成可导入的 Excalidraw 文件

1. 优先按 `passto-desk-domain-json/v3` 写好 JSON（`v2` 仅作兼容输入）
2. 首轮优先保持为**可读最小骨架**，不要把所有说明塞进节点
3. 运行：

```bash
node ./extensions/passto-desk/scripts/domain-json-to-excalidraw.mjs <domain-json-file>
```

3. 生成 `.excalidraw`
4. 再通过 `import_scene_json` / `/passto-desk save` / 其他流程使用

### 场景 3：直接从当前共享 room 导出 domain json v3

如果 agent 需要把当前共享工作台读成结构化 graph，就直接调用：

```json
{
  "action": "export_domain_json"
}
```

返回里会包含：
- `domainJson`：完整的 `passto-desk-domain-json/v3` 字符串
- `domainObject`：已解析对象
- `nodeCount` / `edgeCount` / `freeTextCount` / `warningCount`
- `tempScenePath` / `tempDomainPath`

这条路径会由扩展内部自动执行：

1. `read_scene`
2. 当前 room scene 写到临时 `.excalidraw`
3. `excalidraw-to-domain-json.mjs`
4. 返回 domain json v3

### 场景 4：直接让 passto_desk 导入 domain json v3

如果 agent 已经拿到了 `passto-desk-domain-json/v3` 字符串，就不要自己再手搓 sceneJson，直接调用：

```json
{
  "action": "import_domain_json",
  "domainJson": "{...passto-desk-domain-json/v3...}",
  "verifyPersistence": false
}
```

这会由扩展内部自动执行：

1. `domain-json v3 -> .excalidraw`
2. `.excalidraw -> sceneJson`
3. `sceneJson -> replace current room`

因此后续 agent 的默认闭环应该是：
- `export_domain_json` 读出当前结构
- 按需修改 `passto-desk-domain-json/v3`
- 再调用 `import_domain_json` 完整替换当前共享图
- 不要自己临时拼 Excalidraw element JSON

### 场景 5：给 agent 的固定要求

如果后续 agent 需要“画流程图 / 关系图 / 节点图”，必须遵守：

1. 先产出 `passto-desk-domain-json/v3`
2. 首轮默认先做 3–7 个主节点的最小骨架
3. 节点标签必须是 bound text
4. 边必须是 bound arrow
5. side 只能用 `top/right/bottom/left`
6. 不允许 free text 冒充节点标签
7. 不允许用线条端点碰瓷来冒充连接
8. relation label 应优先结构化进入 `semantic / mapping / visual`，不要用靠近箭头的文字冒充边语义
9. 节点标签优先短写，长说明留在对话或下一轮细化
10. 更新模式由 agent 结合结构变化范围、可读性与复杂度信号，自行判断 append / local rebuild / full rebuild

## 示例

示例输入：

- `examples/domain-v2-minimal.json`

已验证可跑通：

```bash
cd extensions/passto-desk
npm run from-domain-json -- ./examples/domain-v2-minimal.json ./examples/domain-v2-minimal.excalidraw
npm run to-domain-json -- ./examples/domain-v2-minimal.excalidraw ./examples/domain-v2-roundtrip.domain.json
```

## 保存路径

所有显式保存的 `.excalidraw` 文件都落在：

```text
extensions/passto-desk/files/
```

## 依赖

需要系统可用：
- `agent-browser`

如果未安装，可先安装并确认命令可执行。
