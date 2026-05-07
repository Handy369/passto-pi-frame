# PasstoContext GRC 实施 TODO

> 设计文档: DESIGN-GRC.md
> 总预估: 6 个阶段，从基础到完整逐步推进
> 每个阶段可独立验证

---

## 已验证里程碑（截至 2026-05-07）

- [x] 真实 Pi CLI 环境可通过 `~/.pi/agent/settings.json` 挂载当前资源仓并正常加载扩展
- [x] GRC 在第 6 个用户轮次自动触发
- [x] steer 反思真实追加到主对话
- [x] Reflector / Curator 通过后台 `complete()` 真实运行
- [x] Curator 摘要真实驱动 `context` 修剪（日志已验证）
- [x] principles 真实写入 `~/.passtocontext/memory/principles/`
- [x] principle tags 改为由 LLM 直接生成
- [x] `passto-context-state.turnCount` 修正为“用户轮次”语义
- [x] Reflector 在无实质建议时记录 `Reflector finished (no substantive advice)`
- [x] `/pta` / `/PTA` 命令已实现并注册
- [x] `session_before_compact` 已接入 curator-first compaction
- [x] `manualMode = auto | forced-on | forced-off` 已接入 GRC 状态机
- [x] 隔离加载测试已确认编译后的 jiti 产物包含 `/pta` 与 curator-aware compaction 分支

---

## 阶段 1: 基础框架 — 类型、配置、状态机

**目标**: 搭建 GRC 的类型系统和状态管理，不影响现有功能。

- [x] **1.1** `types.ts` — 新增 GRC 相关类型定义
  - 新增 `GRCConfig` 接口
  - 新增 `GRCState` 接口（mode, turnCount, reflector/curator 状态）
  - 新增 `SubagentStatus` 类型 ("idle"|"running"|"done"|"failed")
  - 新增 `ReflectorResult` / `CuratorResult` 接口
  - 在 `PasstoContextConfig` 中新增 `grc: GRCConfig` 字段

- [x] **1.2** `config.ts` — 新增 GRC 默认配置
  - 新增 `DEFAULT_GRC` 常量（见 DESIGN-GRC.md §10）
  - 在 `getFullDefaults()` 中加入 grc 字段
  - 在 `loadConfig()` / `validateConfig()` 中处理 grc

- [x] **1.3** `grc-state.ts` — **新建**，GRC 状态机
  - `createInitialGRCState()`: 初始状态
  - `shouldTriggerGRC(state, config)`: 触发条件判断
  - `transitionToGRC(state, currentTurn)`: 模式切换
  - `updateReflectorStatus(state, status, advice?)`: 更新 Reflector
  - `updateCuratorStatus(state, status, summary?)`: 更新 Curator
  - `shouldTriggerNextCycle(state, config)`: 下一轮 GRC 判断
  - `incrementTurn(state)`: turn 计数
  - `serializeGRCState(state)` / `restoreGRCState(data)`: 持久化

**验证**: 类型导入无报错，状态机的 trigger/transition 逻辑正确。

---

## 阶段 2: Prompt 引擎 + Subagent 执行核心

**目标**: 实现 GRC 三个角色的底层能力。这是整个框架的核心。

> 核心认知: Generator = 主 LLM，它的增强通过三层实现（见 DESIGN-GRC.md §1.4）：
> - 系统层: systemPrompt 注入（基础GRC + Reflector意见 + Principles）
> - 上下文层: context hook 修剪（Curator 摘要替换旧 turn）
> - 对话层: steer 注入（触发 LLM 自我反思）

- [x] **2.1** `grc-prompts.ts` — **新建**，prompt 模板
  - **Generator 系统层**:
    - `buildBaseGRCPrompt()`: 基础认知框架（~200 tokens, 见 §5.1）
    - `buildReflectorInjection(advice)`: Reflector 意见注入格式（见 §5.5）
  - **Generator 对话层**:
    - `buildReflectionSteerPrompt()`: steer 反思引导（见 §5.2）
  - **Reflector 任务定义**:
    - `buildReflectorSubagentPrompt(conversation)`: 完整 prompt（见 §5.3）
  - **Curator 任务定义**:
    - `buildCuratorSubagentPrompt(conversation)`: 完整 prompt（见 §5.4）
    - `buildCuratorSummaryMessage(summary)`: 修剪用 summary message 格式

- [x] **2.2** `grc-subagent.ts` — **新建**，核心执行引擎
  - `serializeConversation(branch, options)`: 序列化对话历史
    - 支持 maxTokens 截断
    - 保留第一条 user message（目标）
    - 保留最近 N turn
    - 工具输出截断（toolResultMaxChars）
  - `executeReflector(conversation, model, auth, config)`: 调用 complete()
  - `parseReflectorOutput(raw)`: 解析+验证 Reflector 输出
    - 必须包含"方向评估"section
    - 空洞确认("没问题") → hasSubstantiveContent=false
    - 格式错误 → 返回 null
  - `executeCurator(conversation, model, auth, config)`: 调用 complete()
  - `parseCuratorOutput(raw)`: 解析+验证 Curator 输出
    - 必须包含"目标"+"已完成"
    - 提取 `<!-- PRINCIPLE: ... -->` 标记
    - 格式错误 → 返回 null

- [x] **2.3** 单独测试 GRC 三层增强
  - 已通过真实本地 Pi CLI 环境验证 GRC 触发、steer、R/C 执行、状态持久化、context 修剪与 principles 落盘
  - 仍可继续补充离线固定输入的纯函数测试样例
  - 用一段固定的对话文本手动调用 `executeReflector()` 和 `executeCurator()`
  - 验证输出格式、解析逻辑、错误处理
  - **对比测试**: 构造一个 15 turn 对话，比较 LLM 在以下三种上下文中的回答质量:
    - (A) 原始 50 条消息平铺
    - (B) systemPrompt 注入 Reflector 意见
    - (C) Curator 摘要 + 最近 4 turn + Reflector 意见
  - 预期 C >> B > A（在目标保持度和方案一致性上）

**验证**: 给 R/C 一段真实的对话历史，检查输出质量和解析正确性。对比测试确认三层增强的实际效果。

---

## 阶段 3: 基础集成 — session 事件链

**目标**: 将 GRC 基础逻辑接入 index.ts 的事件链，普通模式运行。

- [x] **3.1** `index.ts` — session_start 集成
  - 初始化 GRC 状态 (`createInitialGRCState()`)
  - 从 appendEntry 恢复 GRC 状态 (`restoreGRCState()`)
  - 确保 .grc/ 目录存在

- [x] **3.2** `index.ts` — before_agent_start 集成
  - 注入基础 GRC prompt 到 systemPrompt（始终）
  - 注入 GRC 模式 prompt（如 mode="grc"）
  - 注入 Reflector 意见（如 status="done" 且有内容）

- [x] **3.3** `index.ts` — turn_end 集成
  - `incrementTurn(grcState)`
  - 检查 `shouldTriggerGRC()` → 切换模式 + 启动 R/C
  - 检查 `shouldTriggerNextCycle()` → 启动新一轮 R/C
  - steer 注入反思引导 prompt

- [x] **3.4** `index.ts` — session_shutdown 集成
  - 持久化 GRC 状态 (`pi.appendEntry("grc-state", ...)`)

**验证**:
- 对话 < 6 turn: GRC 基础 prompt 注入但不触发 GRC
- 对话 >= 6 turn: GRC 触发，steer 注入，R/C 后台启动
- 日志验证每个步骤的执行

---

## 阶段 4: 原则系统 + Widget 改造

**目标**: 实现 principles 存储/检索/注入，Widget 融合 GRC 状态显示。

- [x] **4.1** `grc-principles.ts` — **新建**，原则管理
  - `extractPrinciples(text)`: 解析 `<!-- PRINCIPLE: ... -->` 标记
  - `savePrinciple(content, tags, source, dir)`: 保存 YAML
  - `loadAllPrinciples(dir)`: 加载所有原则
  - `searchPrinciples(query, principles, limit)`: 关键词搜索
  - `formatPrinciplesForInjection(principles, maxTokens)`: 注入格式
  - `bumpPrincipleHitCount(dir, id)`: 更新命中次数
  - `cleanupPrinciples(dir, maxCount)`: 清理

- [x] **4.2** `index.ts` — 原则注入
  - session_start 中加载 principles
  - before_agent_start 中搜索相关 principles 并注入
  - Curator 完成时调用 savePrinciple()

- [x] **4.3** `context-tracker.ts` — Widget 改造
  - 当前实现已在 `index.ts` 中完成 GRC Widget 格式化，并修正 tracker turnCount 语义
  - 如需进一步收敛职责，可后续再把 widget 逻辑下沉回 tracker
  - 重构 `formatStatus()`:
    - 普通模式: `T:5 | 📝3 | ⏱12m`
    - GRC 模式: `T:8 | 📝5 | ⏱20m | ◆ R:✓ C:⟳`
  - 新增 `formatGRCWidget(tracker, grcState)` 函数
  - 状态字符映射: idle→"·", running→"⟳", done→"✓", failed→"✗"

- [x] **4.4** `index.ts` — Status 状态栏通知
  - GRC 触发时: setStatus 短暂提示
  - R/C 完成时: setStatus 短暂提示
  - 5 秒后自动清除

- [x] **4.5** `/PTA` 命令
  - `/PTA` 或 `/PTA status`: GRC 完整状态
  - `/PTA on`: 强制 GRC
  - `/PTA off`: 停用 GRC
  - `/PTA reflect`: 手动触发 Reflector
  - `/PTA curate`: 手动触发 Curator
  - `/PTA principles`: 列出/搜索原则
  - `/PTA config`: 显示配置
  - 额外实现：同时注册小写 `/pta` 与大写 `/PTA`
  - 额外实现：`/pta reflect` 与 `/pta curate` 可单独触发，不再总是一起运行

**验证**:
- Widget 在普通/GRC 模式下显示正确
- GRC 状态变化时 status 短暂闪烁
- principles 能保存、搜索、注入
- /PTA 各子命令正常工作

---

## 阶段 5: Context 修剪 + Compact 融合

**目标**: Curator 驱动的上下文修剪，接管 Pi compact 机制。

- [x] **5.1** `grc-context-manager.ts` — **新建**
  - `findTurnBoundaries(messages)`: 计算 turn 边界
    - turn 起始: role="user" 的消息
    - turn 结束: 下一条 role="user" 之前
  - `pruneContext(messages, grcState, config)`:
    - Curator 有摘要 → 用 summary message 替换已处理的旧 turn
    - 保留最近 `curatorKeepRecentTurns` 个 turn
    - 无摘要 → 直通
    - 异常 → 直通（安全回退）
  - `buildCuratorSummaryMessage(summary)`: 构建 user role 的 summary

- [x] **5.2** `index.ts` — context hook
  - 新增 `pi.on("context", ...)` handler
  - GRC 模式 + Curator 有摘要 → `pruneContext()`
  - 普通模式 → 不干预

- [x] **5.3** `compaction.ts` — GRC 模式变更
  - `session_before_compact` 已切换为“优先使用 Curator 摘要”策略
  - GRC 模式下 `session_before_compact`:
    - 优先使用 Curator 摘要
    - 无 Curator 摘要 → 回退现有行为
  - 普通模式: 不变
  - 当前实现会在 compaction details 中记录 `strategy = curator-summary | llm-summary`

**验证**:
- GRC 模式 10+ turn: LLM context 被修剪（日志确认）
- 修剪后 messages 格式正确（turn 边界完整）
- 手动 `/compact`: 使用 Curator 摘要
- Pi 原生 compact 在 GRC 模式下不触发（context 已被控制）
- 隔离加载测试确认编译后的 jiti 产物包含：
  - `/pta` 与 `/PTA` 命令注册
  - `Using curator summary for compaction` 分支
- `grc-state.ts` 纯函数测试确认：
  - 第 6 轮自动触发
  - forced-on / forced-off 语义正确

---

## 阶段 6: 稳定性 + 打磨

**目标**: 错误处理、日志、文档。

> 状态：v1.0 主实现已完成。以下内容主要作为完成记录与补充回归参考。

- [x] **6.1** 错误处理
  - R/C 失败降级逻辑
  - context 修剪异常回退
  - 模型 API Key 缺失降级
  - 并发保护（R/C 运行中不重复启动）
  - 补充实现：`/reload` / shutdown 后不再恢复陈旧 `running` 状态
  - 补充实现：后台任务回写增加 session generation 守卫，避免旧 Promise 污染新会话

- [x] **6.2** 日志
  - 已覆盖：GRC 触发、R/C 完成/失败、context 修剪统计、principles 保存、Reflector 无实质建议
  - GRC 状态变更 (mode switch, GRC trigger)
  - R/C 启动/完成/失败 + 耗时
  - Context 修剪统计 (删了多少 turn, 保留多少)
  - Principles 提取/注入

- [x] **6.3** 文档
  - README / TODO / DESIGN-GRC 已同步到当前实现状态
  - README.md 更新
  - 配置文档
  - /PTA 命令文档

- [x] **6.4** 清理
  - `.grc/` 目录方案已未采用，当前无需实现该项
  - principles 数量上限
  - session 切换时 GRC 状态重置
  - /reload 后状态恢复
  - 补充实现：session_start / session_shutdown 都会执行 principles 上限清理
  - 补充实现：module state 在 init failure / shutdown 后显式 reset

**已完成验证**:
- `restoreGRCState()` 会把持久化的 `running` 状态恢复为 `idle`
- `forced-off` 会清空悬空运行态并回到 `mode=normal`
- 扩展修改后仍可被 Pi 隔离加载并编译
- `scripts/tui-regression.sh` 已通过真实 tmux + Pi TUI 回归：
  - `/pta status`
  - `/pta on`
  - `/pta off`
  - `/pta reflect`
  - `/pta curate`
  - `/reload` 后状态保持与 running→idle 恢复
  - `/new` 后 session-scoped 状态重置
  - `/resume` 对话框打开与 All 视图切换

**建议补充回归（非当前阻塞项）**:
- 断网测试 R/C 失败降级
- 20+ turn 长对话稳定性
- `/resume` 的“恢复到指定旧 session”人工交互回归（已确认对话框可打开，但自动化选择受全局 session 列表排序影响，暂不作为稳定脚本断言）

---

## 阶段依赖关系

```
阶段1 (类型/配置/状态机)
  ↓
阶段2 (Prompt引擎 + R/C 执行核心)  ← 最关键，决定 GRC 实际能力
  ↓
阶段3 (基础集成到事件链)
  ↓
阶段4 (原则系统 + Widget)
  ↓
阶段5 (Context修剪 + Compact融合)
  ↓
阶段6 (稳定性)
```

**阶段 2 是最重要的**：它决定了 R/C 的 prompt 质量、输出解析、质量验证。
如果阶段 2 的输出质量不够，后续所有阶段的注入和修剪都没有意义。

---

## 文件创建/修改速查

### 新建文件
| 文件 | 阶段 | 核心职责 |
|------|------|----------|
| `grc-state.ts` | 1 | 状态机 |
| `grc-prompts.ts` | 2 | 所有 prompt 模板 |
| `grc-subagent.ts` | 2 | R/C 的 complete() 调度 + 输出解析 |
| `grc-principles.ts` | 4 | 原则的 CRUD + 检索 |
| `grc-context-manager.ts` | 5 | context 修剪 |
| `scripts/tui-regression.sh` | 6 | 真实 Pi TUI 回归脚本（tmux 驱动） |

### 修改文件
| 文件 | 阶段 | 改动范围 |
|------|------|----------|
| `types.ts` | 1 | 新增类型 |
| `config.ts` | 1 | 新增 grc 默认配置 |
| `index.ts` | 3,4,5 | 渐进集成 GRC 到事件链 |
| `compaction.ts` | 5 | GRC 模式 compact 变更 |
| `context-tracker.ts` | 4 | Widget 融合 GRC |
| `utils.ts` | 按需 | 辅助函数 |

### 不修改
| 文件 | 原因 |
|------|------|
| `memory-index.ts` | principles 通过 grc-principles.ts 封装 |
| `memory.ts` | 不改动现有记忆接口 |
| `package.json` | 无新增依赖；仅新增 `test` / `test:tui` 测试命令 |

---

## v2.0 迭代需求（记录，不实现）

> 以下需求在 v1.0 架构中预留扩展点，但不在本次实施范围内。

### N1: 原则的语义检索
- 用 embedding 模型替代关键词匹配
- 提升 principles 注入的相关性
- 扩展点: `searchPrinciples()` 的 options 参数

### N2: 原则的阶段感知注入
- 检测对话所处阶段（设计/编码/调试）
- 注入不同类型的 principles
- 扩展点: `formatPrinciplesForInjection()` 的策略参数

### N3: 原则的自动合并与验证
- 相似 principles 合并
- 过时 principles 标记/清理
- 由空闲时的 Curator 执行

### N4: 原则的衰减与刷新
- 注入权重随时间衰减
- 被命中时刷新权重
- 扩展点: PrincipleItem 的 metadata 字段

### N5: R/C 升级为 fork session
- 让 R/C 有工具调用能力（读文件、运行测试）
- 适用于 Curator 需要验证代码变更是否正确的场景
- 扩展点: `grc-subagent.ts` 的执行策略可替换

### N6: 团队级 Principles 共享
- 导出/导入 principles
- 团队共享的 principles 仓库
- 扩展点: principles 的存储层抽象
