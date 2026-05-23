# Curator Replay Regression 口径调整说明 / ADR Note

> 日期：2026-05-21  
> 适用范围：`extensions/passto-context/scripts/curator-policy-replay-regression.sh`  
> 状态：已落地

---

## 1. 一句话结论

本轮对 `test:curator-replay` 的收敛结论是：

> **先把真实 Pi / tmux curator replay 回归稳定为“reload/replay 稳定性烟测”，不再把它单独当作严格契约测试。**

换句话说，当前脚本的主职责从：

- 强校验 round-2 curator artifact + policy/proof/status surface 完整呈现

收敛为：

- 验证存在最近可接受 curator artifact
- 验证 `grc-state` 可恢复
- 验证 `/reload` 前后 curator 轻状态不漂移

---

## 2. 背景

此前 `curator-policy-replay-regression.sh` 的 README 口径与脚本断言都偏向严格模式，默认假设：

1. round-2 `grc-curator-artifact` 必然稳定落盘
2. `goalState / certaintyAssessment / lastPolicyProjection / latestRuntimeProof / signal / latestGoalTransition` 等结构会完整出现
3. `/ptc status` 在 reload 前后都应呈现 `Latest Goal Transition`、`Latest Policy Projection`、`Latest Runtime Proof`
4. 日志中应出现 `proofSource=curator-payload` 或 `proofSource=x-node-fallback`

但真实运行中，Curator 仍存在非确定性：

- 结构化 payload 可能被截断
- 某些 round 只有 summary，没有完整 object payload
- proof/policy surface 可能缺失，但 replay 链本身仍然可恢复
- round-2 并不总能作为稳定回归锚点

这导致脚本容易把“上游输出波动”放大成“回归失败”，从而降低主回归链稳定性。

---

## 3. 决策

本轮决定：

1. **保留 `test:curator-replay`，但把它重新定义为 smoke / stability replay test**
2. **允许验证对象回退到最近可接受 curator artifact（round-2 优先，否则 round-1）**
3. **允许 `goalState / certainty / signal / transition / runtime proof` 为 `null`，前提是 reload 前后恢复语义一致**
4. **不再把 `proofSource=...` 日志 marker 作为硬门槛**
5. **把严格契约验证从当前脚本中拆出，后续以独立 strict 用例补回**

一句话：

> **先保“链路稳定”，再用 companion strict suite 保“对象完整”。**

---

## 4. 当前脚本现在实际验证什么

当前 `./scripts/curator-policy-replay-regression.sh` 主要验证：

- 真实 Pi / tmux 会话中至少出现一个可接受的 `grc-curator-artifact`
- 持久化 `grc-state.curator.lastCuratedAgentRound / processedUpToAgentRound` 与该 artifact round 对齐
- `/ptc status` 在 reload 前后都能稳定打开并显示 curator runtime surface
- 若 artifact 某些字段缺失，reload 后恢复结果与 artifact 仍保持一致
- replay / reload 不会把 curator 状态恢复坏掉

它**不再单独保证**：

- round-2 artifact 必然存在
- `Latest Goal Transition / Latest Policy Projection / Latest Runtime Proof` 必然出现
- `proofSource=curator-payload` 必然进入日志
- 最新 round 一定携带 object-rich payload

---

## 5. 为什么这样做

核心权衡是：

### 5.1 先保护主回归链稳定性

`npm run test:regression` 是当前主回归入口。若 `test:curator-replay` 继续承担过多 LLM 非确定性断言，就会频繁把“上游波动”误报成“链路损坏”。

### 5.2 把“链路活着”和“契约完整”拆开

这是两个不同问题：

- **stability**：artifact 是否存在、reload/replay 是否还能工作
- **strict contract**：proof/policy/transition/object sidecars 是否完整并进入 surface

把它们混在一个真实 session 脚本里，会让 CI 既不稳，也不清晰。

### 5.3 为后续 strict suite 留出清晰边界

当前放宽不是否定 strict contract，而是承认：

> **strict contract 需要独立验证面，不应继续和 smoke replay 脚本混在一起。**

---

## 6. 已知代价 / 风险

本轮放宽带来以下风险：

1. **假阳性风险上升**
   - 脚本通过，不代表 round-2 object-rich curator payload 也稳定通过。

2. **覆盖面收缩**
   - 当前脚本更偏 replay/reload 稳定性，较少覆盖 proof/policy/transition 的完整 surface。

3. **“稳定”不能替代“正确”**
   - reload 前后稳定，只能说明状态没坏；不能自动说明 surface 一定完整、一定是最新、一定符合设计预期。

因此本轮决策的成立前提是：

> **必须补一条 strict contract test，而不是永久只保留 smoke 口径。**

---

## 7. 后续明确动作

后续建议分两层：

### A. 保留当前 smoke test

继续把 `test:curator-replay` 作为：

- 真实 Pi / tmux curator replay 稳定性回归
- `npm run test:tmux` / `npm run test:regression` 的默认组成部分

### B. 新增 strict companion

已新增 companion 验证面：

- `test:curator-replay:strict`
- `test:regression:strict`（`test:grc` + strict companion）

其职责是：

- 强校验 round-2 artifact
- 强校验 object-rich payload
- 强校验 `/ptc status` 的 proof/policy surface，并按 optional 语义校验 transition surface
- 明确区分 `STRICT PASS` 与 `DEGRADED PASS`

---

## 8. 推荐统一口径

后续描述该脚本时，推荐统一使用：

> **`test:curator-replay` 当前是 curator replay / reload 稳定性烟测；严格的 proof/policy/transition 契约验证由独立 strict companion 覆盖。**

避免继续把它描述成：

- “round-2 curator policy replay 完整契约回归”

否则会让 README 口径与真实脚本职责再次偏离。

---

## 9. 与当前仓库状态的关系

截至 strict companion 落地后：

- `npm --prefix extensions/passto-context run test:curator-replay` 通过
- `npm --prefix extensions/passto-context run test:regression` 全绿
- `npm --prefix extensions/passto-context run test:curator-replay:strict` 通过（provider/model：`deepseek / deepseek-v4-flash`）
- `npm --prefix extensions/passto-context run test:regression:strict` 通过
- 当前 proof 强度已从 **stable smoke / partial contract proof** 补强为 **smoke + strict companion proof**

因此推荐在后续 review / release 沟通中明确标注：

- 主回归已恢复稳定
- strict contract 已由 companion suite 覆盖；若 future failure 出现，应优先归因到 round-2 object payload / status surface / replay 对齐问题，而不是回头放宽 smoke test

---

## 10. 一句话

> **这次调整的价值，不是把验证做弱，而是把“真实 session 稳定性”与“严格对象契约”拆成两个更清晰、也更可维护的验证层。**
