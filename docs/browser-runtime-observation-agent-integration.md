# Browser Runtime Observation Agent Integration

> status: active design record  
> last_updated: 2026-05-19

## 1. 问题定义

当前已经存在一个 `chrome-devtools-mcp` skill，但它的真实角色更像：

- DevTools MCP 工具说明
- 低层操作参考
- Lighthouse / console / network / trace / memory 的原始能力速查

它**不是**一个已经接入 Pi CLI agent 主调度体系的稳定能力，原因有三：

1. **它是 tool-centric，不是 route-centric**  
   它描述了原始 MCP 能做什么，但没有先回答“当前处于 build / debug / review / runtime proof 的哪条实施路径”。

2. **它不在当前 skill 调度骨架里**  
   它没有作为 `project-implementation` 的正式运行态验证子 Skill 被绑定，也没有作为 `incremental-implementation` 的切片级验证出口出现。

3. **它没有解决 Pi agent 的真实接入问题**  
   一个 skill 只能提供 workflow / prompt / reference；如果没有 extension 或其他 runtime tool provider，Pi agent 并不会因为存在 `SKILL.md` 就自动获得浏览器运行态观察能力。

---

## 2. 官方边界：Skill vs Extension

根据 Pi 官方文档：

### 2.1 Skill 的职责
`docs/skills.md` 说明：

- skill 是按需加载的能力包
- 主要承载：workflow、setup、reference、helper scripts
- skill 负责回答：**何时采用、先做什么、边界是什么、如何收口**

skill **不直接创造 runtime capability**。

### 2.2 Extension 的职责
`docs/extensions.md` 说明：

- extension 可 `registerTool()`
- 可订阅事件、注册命令、做状态持久化、接入 TUI
- extension 负责回答：**Pi agent 到底有没有这个能力、工具面长什么样、如何在 runtime 里被调用**

因此，如果目标是“让 Pi CLI agent 稳定拥有浏览器运行态观察能力”，那么：

- **实现层必须有 extension（或等价 tool provider）**
- **调度层必须有 skill**
- **低层原始 DevTools 说明不应继续充当主 skill 调度面**

---

## 3. 当前现有相邻技能盘点

### 3.1 `agent-browser`
职责：
- 轻量网页交互
- 登录、填表、点击、截图、抓文本
- 会话/状态复用

边界：
- 不负责 DOM / console / network / performance / memory 的深度调试
- 已明确把这类任务让给 `browser-runtime-observation`，必要时再下钻 `chrome-devtools-mcp`

### 3.2 `visual-feedback-ui-qa`
职责：
- 真实运行态 UI QA
- 用户能否感知反馈、状态、风险与下一步
- 输出 P0/P1/P2 findings

边界：
- 不负责纯技术下钻
- 当问题下钻为 DOM / console / network / perf / a11y 时，再补 DevTools 类 skill

### 3.3 `browser-testing-with-devtools`
职责：
- 保留旧入口名称的兼容壳
- 把历史路由平滑转交到 `browser-runtime-observation`
- 在必要时提示下钻 `chrome-devtools-mcp`

判断：
- 它不再承担独立浏览器验证方法面
- 当前角色是废弃兼容别名，而不是正式调度入口
- 新的公开主入口应统一为 `browser-runtime-observation`

### 3.4 `chrome-devtools-mcp`
职责：
- 原始 DevTools MCP tool guide
- 低层能力速查与专用 workflow 参考

判断：
- 适合作为内部 reference
- 不适合继续充当公开主 skill

---

## 4. 目标架构

建议把该能力整理为三层：

## 4.1 第 1 层：Extension（真实能力实现层）

已在本仓库实现 project-local Pi extension：

- `extensions/browser-runtime-observation/index.ts`

当前职责：
- 注册高层运行态观察工具
- 检测当前 runtime 中是否存在 Chrome DevTools 兼容低层工具
- 兼容真实 `chrome-devtools-mcp` 风格工具命名（含 `mcp__chrome-devtools-mcp__<tool>`）与部分裸工具名
- 通过异步 steering + `tool_result` 监听完成高层 request 编排
- 统一 artifact / verdict / evidence contract
- 提供命令 `/browser-observe-status`

### 推荐工具面
不要把大量原始 MCP tool 直接当作对 LLM 的公共 contract。更稳的做法是注册**高层任务型工具**，例如：

```ts
browser_runtime_observe({
  target,
  mode,        // ui-debug | console-network | lighthouse | a11y | perf | memory
  actions?,    // 最小浏览器动作序列
  artifactDir?,
  budgets?
})
```

或者分为少量高层工具：

- `browser_runtime_observe`
- `browser_runtime_audit`
- `browser_runtime_trace`
- `browser_runtime_collect`

关键要求：
- 输入按任务语义建模，而不是按底层 DevTools 原语暴露
- 输出统一为 artifact + verdict + evidence contract
- 失败时有明确 fallback / partial-result 语义

### 当前实现状态
当前 extension 已实现：
- `browser_runtime_capability_status`
- `browser_runtime_observe`
- blocked path（无兼容低层工具）
- ready path（有兼容低层工具时发 steering、监听 `tool_result`、在 `agent_end` finalize）
- artifact：`request.json` / `result.json` / `evidence.json` / `verdict.json`
- 真实 `chrome-devtools-mcp` 风格命名兼容：
  - `mcp__chrome-devtools-mcp__navigate_page`
  - `mcp__chrome-devtools-mcp__take_snapshot`
  - `mcp__chrome-devtools-mcp__list_console_messages`
  - `mcp__chrome-devtools-mcp__list_network_requests`
  - `mcp__chrome-devtools-mcp__lighthouse_audit`
  - 以及其它核心 DevTools 工具族
- mode-specific steering：
  - `dom`
  - `console-network`
  - `lighthouse`
  - `accessibility`
  - `performance`
  - `memory`
- mode-specific `recommendedToolCalls`
- mode-specific `normalizedEvidence`
- budget verdict / pass-fail gate（写入 `result.json.verdict` 与独立 `verdict.json`）

重要实现结论：
- **Pi extension 当前没有官方“在扩展内部同步直调其它工具/MCP 工具”的 API**
- 因此这里采用的是**异步编排器**，而不是同步执行器：
  1. 高层工具创建 request
  2. extension 发 steering message
  3. 后续 LLM 回合调用兼容低层工具
  4. extension 监听低层 `tool_result` 并规范化结果
  5. 在 `agent_end` 收口 finalize

### 当前验证状态
已接入工程化回归入口：
- 根项目：`npm run test:browser-runtime-observation`
- extension 本地：`npm --prefix ./extensions/browser-runtime-observation run test`

当前回归已覆盖：
- blocked path
- ready path + DOM
- ready path + console-network
- ready path + lighthouse
- ready path + accessibility
- ready path + performance
- ready path + memory
- budget pass verdict
- budget fail verdict

---

## 4.2 第 2 层：Skill（实施侧调度层）

建议新增正式 skill：

- `browser-runtime-observation`

职责：
- 何时进入浏览器运行态技术证据路径
- 如何与 `agent-browser` / `visual-feedback-ui-qa` 分层
- 当前是 UI QA、技术下钻、Lighthouse/a11y、还是 perf/memory
- 当前轮最小证据包和停止条件是什么

这个 skill 的定位应是：

- **实施侧 runtime technical validation skill**
- 面向 `project-implementation` 调度
- 面向 `incremental-implementation` 的切片级最小验证出口

---

## 4.3 第 3 层：Reference（内部低层说明层）

保留：

- `chrome-devtools-mcp`

但把它从公开调度面降级为：

- 内部 DevTools reference
- 原始 tool guide
- 专项故障排查资料

建议加上：

```yaml
disable-model-invocation: true
```

这样它仍可被人工 `/skill:chrome-devtools-mcp` 强制打开，但不再作为系统提示中的默认公共路由入口。

---

## 5. 路由整合方案

## 5.1 在 `project-implementation` 中的角色

### Build 路径
`project-implementation -> incremental-implementation`

当当前切片是：
- page / component / browser-facing interaction

则实现后：
- 若要验证“用户是否感知得到” → 先补 `visual-feedback-ui-qa`
- 若要验证“底层运行态到底发生了什么” → 补 `browser-runtime-observation`

### Debug 路径
`project-implementation -> debugging-and-error-recovery`

当 bug 只在浏览器真实运行态暴露，或疑似根因在：
- DOM
- console
- network
- Lighthouse / a11y
- perf / memory

则优先补：
- `browser-runtime-observation`

### Proof 路径
`project-implementation -> test-driven-development`

对 browser-facing 行为变更，如果代码级测试不足以构成行为证明，可补：
- `browser-runtime-observation`

作为 runtime proof 证据层。

### Review 路径
`project-implementation -> code-review-and-quality`

若 merge readiness 依赖真实页面运行态：
- 用户可见反馈层 → `visual-feedback-ui-qa`
- 技术运行态证据层 → `browser-runtime-observation`

---

## 5.2 在 `incremental-implementation` 中的角色

它不应成为顶层路由器，而应成为：

- **切片级最小验证出口**

当当前切片为浏览器相关切片时：
- 测试 / 构建不足以证明行为
- 需要真实页面运行态补证

则允许：
- `browser-runtime-observation` 作为当前切片的最小验证之一

这样不会破坏 `incremental-implementation` 的“切片节奏控制器”角色，只是补充一个明确验证出口。

---

## 6. 最终结构建议

### 保留
- `agent-browser`：轻量浏览器自动化
- `visual-feedback-ui-qa`：用户可见反馈 QA
- `browser-testing-with-devtools`：废弃兼容别名
- `chrome-devtools-mcp`：内部 reference

### 新增
- `browser-runtime-observation`：正式运行态技术验证 skill
- 对应 extension：真正工具实现层

### 修改
- `project-implementation`：把 `browser-runtime-observation` 写入运行态验证强化器与各主路径补入规则
- `incremental-implementation`：把它写成 browser-facing 切片的最小验证出口
- `project-implementation/validation/child-skill-bindings.md`：明确其角色与绑定顺序
- `chrome-devtools-mcp`：降级为非默认公开调度 skill

---

## 7. 最终建议

如果目标是“落地一个 Pi CLI agent 可稳定使用的浏览器运行态观察能力”，正确路径不是继续扩写 `chrome-devtools-mcp/SKILL.md`，而是：

1. **先把能力分层**：extension / skill / reference
2. **新增正式调度 skill**：`browser-runtime-observation`
3. **把它接进 `project-implementation` 与 `incremental-implementation`**
4. **把 `chrome-devtools-mcp` 降级为内部低层参考**
5. **继续增强低层兼容策略与 mode-specific finalize 规则**

当前这一步已经让 Pi agent 不再只是“看见一个 DevTools 使用手册”，而是已经拥有一条：
- 能被父 skill 调度
- 能登记高层 request
- 能收集低层运行态证据
- 能规范化落盘并收口

的浏览器运行态观察路径。
