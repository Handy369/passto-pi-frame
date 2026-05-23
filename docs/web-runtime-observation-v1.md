# web-runtime-observation-v1

> status: active design record  
> last_updated: 2026-05-19  
> owner: agent  
> scope: 为 `browser-runtime-observation` / `browser-observe` / `chrome-devtools-mcp` 形成统一的浏览器运行态观察分层方案，并对齐当前本地与 CI 落地现状

## 1. Why

当前仓库已经不再处于“只有 DevTools skill 想法、还没形成可落地链路”的阶段，而是已经具备了三类现实资产：

1. **公开主入口 skill**：`browser-runtime-observation`
   - 面向 agent 的正式浏览器运行态技术证据入口
   - 负责 route、mode、artifact contract、budget verdict、runtime readiness

2. **低层工具 reference**：`chrome-devtools-mcp`
   - 面向底层原语、tool guide、专项排障
   - 不再作为公开主调度入口

3. **独立 smoke harness**：`browser-observe/`
   - 独立于 Pi runtime 的真实浏览器 smoke proof 路径
   - 面向真实非 mock `chrome-devtools-mcp` 环境的可复跑验证与 CI artifact

因此，本文档的目标不再是“为 `chrome-devtools-mcp` 单独设计一套方案”，而是明确：

- **对外怎么路由**
- **对内怎么分层**
- **本地 proof 与 CI gate 如何协同**
- **哪些地方应该继续用真实 `chrome-devtools-mcp` 技术标识，哪些地方应该统一成 `browser-runtime-observation` 的公开口径**

---

## 2. Current Repo Facts

以下结论来自当前仓库事实：

### 2.1 已落地的公开入口与实现层

- 已有 skill：`/Users/handy/.claude/skills/browser-runtime-observation/SKILL.md`
- 已有低层 reference：`/Users/handy/.claude/skills/chrome-devtools-mcp/SKILL.md`
- 已有兼容壳：`/Users/handy/.claude/skills/browser-testing-with-devtools/SKILL.md`
- 已有 Pi extension：`/Users/handy/dev/passto-ai/extensions/browser-runtime-observation/`

### 2.2 已落地的仓库脚本入口

根 `package.json` 当前已有：

- `npm run test:browser-runtime-observation`
- `npm run test:web-observe:real`
- `npm run test:web-observe:real:all`
- `npm run test:web-observe:contract`

这意味着：

- `browser-runtime-observation` extension 的协议面 smoke 已有独立入口
- `browser-observe/` 的真实 smoke 与 contract regression 已有仓库级聚合入口

### 2.3 已落地的独立 harness

`browser-observe/README.md` 当前已明确：

- 目标是在真实非 mock `chrome-devtools-mcp` 环境下产出 smoke proof
- 已支持：
  - `smoke:real`
  - `smoke:real:all`
  - `test:contract`
- 已有 artifact 目录与 verdict contract

### 2.4 已落地的 CI workflow

仓库当前已存在：

- `.github/workflows/web-observe-real-smoke.yml`

该 workflow 已实现：

- 安装 Node 与依赖
- 安装 Chrome for Testing
- 运行 `npm run test:web-observe:real:all`
- 从 `RUN_ALL_RESULT_JSON::` marker 解析汇总
- 上传 `browser-observe/artifacts` 与 `run.log`
- 当 marker 缺失或 smoke FAIL 时让 workflow 失败

因此，旧文档里“仓库没有 workflow / 还没有根级入口”的表述已经过时。

---

## 3. Final Layering

推荐并已基本落地的最终分层如下：

### L0 — 公开调度层：`browser-runtime-observation`

职责：
- 作为 **唯一公开浏览器运行态技术证据入口**
- 判断当前任务是否真的需要 DOM / console / network / Lighthouse / a11y / performance / memory 证据
- 产出统一 request / result / evidence / verdict contract
- 在 runtime 中检查是否存在 Chrome DevTools 兼容低层工具
- 用 steering + tool_result 归档方式，编排后续低层工具调用

适用：
- build / debug / proof / review 中需要真实浏览器技术证据的任务
- 需要补 runtime proof，而不只是看代码或单元测试

不负责：
- 轻量点按/填表/截图主流程
- 用户可见反馈 QA 主流程
- 原始 DevTools MCP 低层说明

### L1 — 低层 reference：`chrome-devtools-mcp`

职责：
- 承载低层原语、tool guide、专项排障路径
- 保留真实工具名、真实 server hint、真实 npm 包名、真实命令示例
- 作为 `browser-runtime-observation` 的下钻读物

适用：
- 需要看原始 DevTools MCP 操作说明
- 需要专项 memory / trace / Lighthouse / troubleshooting 参考
- 人工明确要求 `/skill:chrome-devtools-mcp`

不负责：
- 公开主路由
- 统一 browser runtime 验证入口

### L2 — 独立 smoke / proof harness：`browser-observe/`

职责：
- 独立于 Pi runtime，直接在真实 `chrome-devtools-mcp` 环境下跑 smoke
- 产出可复跑 artifact、scenario verdict 与 CI summary 证据
- 作为“真实非 mock 环境 proof”与“CI 弱 gate”承载面

适用：
- 真实 Chrome + 真实 MCP server 的 smoke proof
- 多 scenario 批量运行
- CI 中的独立 smoke lane

不负责：
- 取代 agent 会话中的高层调度判断
- 取代 `browser-runtime-observation` 作为公开 agent skill

---

## 4. Public Routing Rules

统一后的公开口径应为：

- **真实浏览器运行态技术证据**  
  → `browser-runtime-observation`

- **低层 DevTools 原语 / tool guide / troubleshooting**  
  → `chrome-devtools-mcp`

- **轻量网页交互 / 登录 / 点击 / 填表 / 抓文本 / 截图**  
  → `agent-browser`

- **用户可见反馈 / 可用性 / 状态感知 QA**  
  → `visual-feedback-ui-qa`

- **旧名称兼容**  
  `browser-testing-with-devtools` 只作为 deprecated shim，把旧路由转交到 `browser-runtime-observation`

---

## 5. Why `chrome-devtools-mcp` Is No Longer the Center

`chrome-devtools-mcp` 仍然重要，但重要性在于：

- 它是**真实低层能力来源**
- 它提供**真实工具族与真实运行时证据抓取能力**
- `browser-observe/` 和 `browser-runtime-observation` 都要与它兼容

但它不再适合作为“方案中心”的原因是：

1. 它是 **tool-centric**，不是 **route-centric**
2. 它不能代替 agent 层的 adopt/routing 决策
3. 它不能自然代替独立 smoke harness 与 CI contract
4. 用户真正需要的是“什么时候走浏览器运行态证据”，而不是先看底层 MCP 文档

所以当前正确关系是：

- **公开入口中心**：`browser-runtime-observation`
- **真实低层工具中心**：`chrome-devtools-mcp`
- **仓库 smoke / CI 中心**：`browser-observe/`

---

## 6. Capability Split by Use Case

### 6.1 交互会话里的深诊断 / runtime proof

首选：`browser-runtime-observation`

原因：
- 它先判断目标与 mode
- 它统一 artifact / verdict contract
- 它能把低层结果归档成 `normalizedEvidence`
- 它能表达 readiness / blocked / budget fail 等高层语义

必要时再下钻：`chrome-devtools-mcp`

### 6.2 真实非 mock 环境 smoke proof

首选：`browser-observe/`

原因：
- 它直接面向真实 `chrome-devtools-mcp` 环境
- 它适合独立复跑与 scenario 批量运行
- 它已有 `PASS / FAIL / ERROR` verdict 语义
- 它已有 artifact 目录与 log marker

### 6.3 CI 中的自动化 gate

首选：`browser-observe/` 的弱 gate

当前已落地思路：
- 用真实 smoke 场景产出 artifact
- 用 workflow summary 汇总 scenario 结果
- 用 marker 缺失 / overall fail 作为失败条件

不建议：
- 直接把交互式 `browser-runtime-observation` extension 当 CI runner
- 直接把全部重型 trace / memory / 登录态页面纳入强 gate

---

## 7. Current Command Surface

### 7.1 根目录入口

```bash
npm run test:browser-runtime-observation
npm run test:web-observe:real
npm run test:web-observe:real:all
npm run test:web-observe:contract
```

### 7.2 `browser-observe/` 子目录入口

```bash
npm --prefix ./browser-observe run smoke:real
npm --prefix ./browser-observe run smoke:real:all
npm --prefix ./browser-observe run test:contract
```

### 7.3 显式 scenario 运行

```bash
node ./browser-observe/scripts/real-smoke.mjs --scenario ./browser-observe/scenarios/public-homepage.json
node ./browser-observe/scripts/real-smoke.mjs --scenario ./browser-observe/scenarios/wikipedia-homepage.json
```

---

## 8. Artifact and Verdict Contract

### 8.1 `browser-runtime-observation` extension

关注：
- `request.json`
- `result.json`
- `evidence.json`
- `verdict.json`
- `recommendedToolCalls`
- `normalizedEvidence`

这层主要服务：
- agent runtime 编排
- review / proof / downstream automation

### 8.2 `browser-observe/` harness

当前 artifact 重点包括：
- `request.json`
- `tools.json`
- `calls/*.json`
- `snapshot.txt`
- `screenshot.png`
- `console.txt`
- `network.txt`
- `lighthouse/`
- `summary.json`
- `verdict.json`
- 失败时附加 `failure.json`

当前 verdict 重点语义：
- `PASS`
- `FAIL`
- `ERROR`

这层主要服务：
- 真实 smoke proof
- CI summary
- 失败定位

---

## 9. CI Positioning

当前仓库已经不是“还没接 CI”的状态，而是已经有一个独立 lane：

- workflow: `.github/workflows/web-observe-real-smoke.yml`
- cadence:
  - `workflow_dispatch`
  - `schedule`（每周一次）

这说明当前 CI 策略已经从“纯设计”进入“真实 smoke 预演 + artifact proof”阶段。

### 当前 CI lane 的正确定位

它是：
- **独立 smoke proof lane**
- **artifact-producing lane**
- **弱 gate / 可观察 gate**

它不是：
- 全仓主回归链替代品
- 所有 browser-facing 场景的强 gate
- 登录态复杂页面的一站式 E2E 平台

### 当前 CI gate 的合理边界

适合继续保留：
- 公开页面 smoke
- 真实 Chrome 启动证明
- 真实 `chrome-devtools-mcp` 调用链证明
- artifact 上传
- marker / verdict 解析失败即失败

暂不建议扩成默认强 gate：
- 登录态复杂流程
- memory snapshot 深分析
- trace-heavy 长时性能检查
- 高波动第三方页面上的严格 score 阈值

---

## 10. Non-goals

当前方案不追求：

- 用 `chrome-devtools-mcp` 取代 Playwright / Node 测试生态
- 把所有浏览器任务统一塞进一个 skill 或一个 runner
- 把 `browser-runtime-observation` 直接变成 CI 执行器
- 把 `browser-observe/` 反过来变成公开 agent 路由层
- 在本轮把所有 browser-facing 页面都拉进强 gate

---

## 11. Recommended Working Model

推荐的稳定工作模型是：

1. **Agent 路由阶段**  
   用 `browser-runtime-observation` 决定是否需要真实浏览器技术证据

2. **低层下钻阶段**  
   仅在需要原语或专项排障时，下钻 `chrome-devtools-mcp`

3. **真实 smoke / CI proof 阶段**  
   用 `browser-observe/` 产出非 mock 环境证据

4. **文档/审查收口阶段**  
   把结论收敛回：
   - build 是否成立
   - debug 根因在哪
   - proof 是否足够
   - review / CI 是否通过

---

## 12. Minimal Acceptance Criteria

当前分层方案的最小完成标准应为：

1. `browser-runtime-observation` 已作为唯一公开主入口
2. `chrome-devtools-mcp` 已收敛为低层 reference
3. `browser-testing-with-devtools` 已降级为兼容壳
4. `browser-observe/` 已可在真实非 mock 环境产出 smoke artifact
5. 根 `package.json` 已暴露明确入口
6. CI 已存在独立 smoke proof workflow
7. 文档、skill 路由口径与当前仓库现实一致

按当前仓库状态，这 7 项已基本成立。

---

## 13. Recommended Next Slices

后续更值得推进的切片不是再讨论“要不要把 `chrome-devtools-mcp` 当主入口”，而是：

### Slice A — 扩 scenario 集

继续补充：
- 更稳定的公开页面场景
- 更明确的 ignore 策略样例
- 多 scenario 汇总的失败摘要可读性

### Slice B — 强化 contract regression

继续保护：
- marker 协议
- verdict 结构
- artifact 索引结构
- summary / run-all 输出语义

### Slice C — 优化 CI 摘要与假成功防护

继续增强：
- marker 缺失时的更清晰错误摘要
- scenario 级 failure reason 聚合
- artifact deep link / 更可读的 summary table

### Slice D — 文档与 router benchmark 收口

继续确保：
- 其它相邻 skill 不再把 `chrome-devtools-mcp` 当公开主入口
- benchmark/validation 文案继续对齐新口径
- 历史设计文档中的旧叙述逐步升级

---

## 14. Final Recommendation

当前仓库的正确结论已经不是：

> “为 `chrome-devtools-mcp` 设计一套将来可能接入的方案。”

而是：

> “以 `browser-runtime-observation` 作为公开主入口，
> 以 `chrome-devtools-mcp` 作为低层 reference，
> 以 `browser-observe/` 作为真实非 mock smoke / CI proof harness，
> 三层协同构成统一的浏览器运行态观察体系。”

这也是当前最符合仓库现实、最利于继续迭代、且最不容易让路由与实现再次混线的方案。
