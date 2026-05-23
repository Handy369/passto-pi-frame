# Curator Replay Strict Companion 测试方案

> 日期：2026-05-21  
> 状态：已落地；最近一次本地 proof 通过（`deepseek/deepseek-v4-flash`）  
> 目标：为 `test:curator-replay` 当前的 smoke / stability 口径补一条严格契约 companion

---

## 1. 目标

已新增一条独立 strict 验证面，避免当前 `test:curator-replay` 同时承担：

- 真实 session 稳定性
- curator object payload 完整性
- proof / policy / transition 用户可见 surface 完整性

strict companion 的职责是：

> **只要通过，就意味着 curator replay 的关键 object contract 与 status surface 在真实链路中完整成立。**

---

## 2. 命名与入口

已新增 script：

```bash
npm run test:curator-replay:strict
```

实现文件：

```bash
./scripts/curator-policy-replay-strict-regression.sh
```

当前脚本分工：

- `test:curator-replay` = smoke / stability
- `test:curator-replay:strict` = strict contract
- `test:regression:strict` = `test:grc` + strict companion 的组合入口

---

## 3. strict 与 smoke 的分工

### 3.1 smoke（已有）

验证：

- 最近可接受 curator artifact 存在
- reload / replay 不损坏状态
- `grc-state` 与 `/ptc status` 在前后保持稳定

### 3.2 strict（已新增）

验证：

- round-2 curator artifact 必须存在
- round-2 artifact 必须是 object-rich payload
- `goalState / userGoalTree / xNodeModels / signal / lastPolicyProjection / latestRuntimeProof` 满足最小非空契约
- `latestGoalTransition` 为 optional transition surface：存在时必须与 status / replay 对齐；为 `null` 时 `/ptc status` 不应强制渲染 `Latest Goal Transition`
- `/ptc status` 在 reload 前后都必须呈现关键 surface
- 若 proof source 设计上要求可见，则必须有结构化证据，而不是仅靠模糊日志判断

---

## 4. strict 硬性验收条件

推荐最小硬门槛如下。

### 4.1 artifact round

必须满足：

- session jsonl 中存在 `customType = "grc-curator-artifact"`
- 且 `agentRound = 2`

不允许：

- round-1 fallback 通过

### 4.2 goal object contract

round-2 artifact 中必须满足：

- `goalState.version === 2`
- `userGoalTree.currentFocusUserGoalId` 非空
- `xNodeModels` 为非空数组
- 至少一个 `xNodeModel.currentFocusXNodeId` 非空

### 4.3 policy contract

round-2 artifact 中至少满足其一，但建议优先两者都要：

- `lastPolicyProjection.nextStepType` 非空
- `certaintyAssessment.nextStepType` 非空

推荐 strict 模式直接要求：

- `lastPolicyProjection != null`
- `certaintyAssessment != null`

### 4.4 signal / transition contract

必须满足：

- `signal.type` 非空
- `latestGoalTransition` 若非空，则 `label` 必须非空，并且 replay/state/status surface 必须与 artifact 对齐
- `latestGoalTransition` 若为 `null`，这是合法状态；strict 应验证 reload 后 state 也为 `null`，并且 `/ptc status` 不渲染 `Latest Goal Transition` 区块

### 4.5 runtime proof contract

必须满足：

- `latestRuntimeProof.targetXNodeId` 非空
- `latestRuntimeProof.proofStatus` 非空
- `latestRuntimeProof.proofMode` 非空
- `latestProofSignals` 必须是数组
- 当 `latestRuntimeProof.proofStatus !== "passed"` 时，`latestProofSignals` 必须为非空数组，且至少一个 `type` 非空
- 当 `latestRuntimeProof.proofStatus === "passed"` 时，`latestProofSignals=[]` 是合法状态

### 4.6 status surface contract

reload 前后 `/ptc status` 都必须出现：

- `Latest Curator Artifact Round`
- `Latest Policy Projection`
- `Latest Runtime Proof`
- `Last Signal`

并且内容与 round-2 artifact 对齐。

对于 `Latest Goal Transition`：
- 当 round-2 artifact 的 `latestGoalTransition` 非空时，status 必须出现该区块并展示对应 label。
- 当 round-2 artifact 的 `latestGoalTransition` 为 `null` 时，status 不应强制出现该区块。

### 4.7 state replay contract

最新 `grc-state.curator` 必须满足：

- `lastCuratedAgentRound === 2`
- `processedUpToAgentRound === 2`
- `lastGoalState.version === 2`
- `lastSignal.type === artifact.signal.type`
- 若 `artifact.latestGoalTransition` 非空，则 `latestGoalTransition.label === artifact.latestGoalTransition.label`
- 若 `artifact.latestGoalTransition` 为 `null`，则 replay 后 `latestGoalTransition` 也必须为 `null`
- `lastCertaintyAssessment.nextStepType === artifact.certaintyAssessment.nextStepType`

---

## 5. 输出分级建议

strict 脚本建议不要只输出 PASS/FAIL，建议分级：

### 5.1 STRICT PASS

含义：

- round-2 object-rich artifact 存在
- status surface 完整
- replay 一致

### 5.2 DEGRADED PASS

含义：

- 仅供调试或临时观察，不应让 CI 主链按通过处理
- 例如 round-1 存在、reload 稳定，但 round-2/完整 surface 不成立

### 5.3 FAIL

含义：

- strict contract 未成立

对于 CI，建议：

- `test:curator-replay:strict` 中 **DEGRADED 仍返回非 0**
- 只有 `STRICT PASS` 返回 0

这样语义最清楚。

---

## 6. 实现建议

### 6.1 复用现有 smoke 脚本框架

建议直接复用当前脚本中的：

- tmux 启动
- wait_for_session_jsonl
- wait_for_jsonl_pattern
- `/ptc status` pane 捕获
- `/reload` 流程

避免重新造一个完全独立的 harness。

### 6.2 抽出共享 Python 校验器

当前脚本已有较长的 inline Python 校验逻辑。建议后续拆成：

- `scripts/lib/validate-curator-replay-smoke.py`
- `scripts/lib/validate-curator-replay-strict.py`

或单文件：

- `scripts/lib/validate-curator-replay.py --mode smoke|strict`

收益：

- smoke / strict 差异显式化
- 更容易维护与对比
- README 更容易说明两条脚本各自职责

### 6.3 proofSource 不建议继续只看日志

strict 模式更推荐：

- 直接读 artifact / state 中的结构化字段
- 如确实需要 source 归因，建议把 proofSource 进入 artifact/state/debug custom entry

不推荐继续把：

- `grep log for proofSource=...`

当成 strict 核心断言。

---

## 7. CI 接入建议

建议脚本分层：

### 默认主链

```bash
npm run test:regression
```

仍只包含：

- `test:grc`
- `test:tmux`（其中含 smoke `test:curator-replay`）

### 补充严格链

已新增：

```bash
npm run test:regression:strict
```

当前串联：

- `npm run test:grc`
- `npm run test:curator-replay:strict`

建议在更重的 nightly / pre-release 阶段执行；本地开发可按需单跑 `test:curator-replay:strict`。

### Post-V2 维护口径

验证分层维护当前属于 post-V2 hardening backlog，不是 V2.0 主线完成前的阻塞项。当前推荐口径是：

- 保留 `test:curator-replay` 作为 smoke / stability proof，不把它升级成严格契约入口
- 保留 `test:curator-replay:strict` 作为 object contract / status surface / replay 对齐 proof
- 保留 `test:regression:strict` 作为 release / pre-merge gate
- 不在没有新 failure 或新 surface 的情况下继续扩写测试入口

当 replay / restore / status / proof surface 发生代码变更，或 strict proof 出现不稳定失败时，再把本 backlog 提升为当前执行项。

---

## 8. 推荐实施顺序

### Phase 1（已完成）

先做文档与命名收敛：

- README 明确 `test:curator-replay` 是 smoke
- 新增 strict plan 文档

### Phase 2（已完成）

新增 strict 脚本：

- 从当前 smoke 脚本复制一份 strict companion
- 恢复强断言
- 明确 round-2 only
- provider/model 已收敛为当前 Pi 可识别的 `deepseek / deepseek-v4-flash`

### Phase 3（按需）

如 strict 仍不稳定，再处理上游问题：

- Curator payload 截断
- object-rich payload 不稳定
- proof/policy/status surface 漏渲染

原则是：

> **优先修上游链路，不继续靠放宽 strict 契约来收敛。**

---

## 9. 完成定义

当以下条件同时满足时，可认为 strict companion 建立完成：

1. 存在独立 `test:curator-replay:strict`
2. README 清楚区分 smoke 与 strict
3. strict 只接受 round-2 object-rich curator artifact
4. strict 对 `/ptc status` 的 policy/proof surface 做强校验，并按 optional 语义校验 transition surface
5. strict replay 后 `grc-state.curator` 与 artifact round-2 完整对齐
6. strict 可稳定在真实本地环境跑通，或至少能把失败明确归因到上游非确定性 / payload 缺失点

当前本地 proof：

```bash
npm --prefix extensions/passto-context run test:curator-replay:strict
npm --prefix extensions/passto-context run test:regression:strict
```

结果：`STRICT PASS`；严格组合入口 `test:regression:strict` 也已通过。关键证据包括：

- round-2 policy surface `nextStepType=run_tests`
- round-2 policy surface `runtimeProof=partial`
- round-2 artifact `proofStatus=partial`
- round-2 artifact `proofSignalType=runtime-proof-partial`，或在 `proofStatus=passed` 时允许 `proofSignalType=none`
- reload 后 `processedUpToAgentRound=2`
- reload 后 `lastCuratedAgentRound=2`
- pre/post reload status 与 round-2 object-rich curator artifact 对齐

---

## 10. 一句话

> **当前 `test:curator-replay` 负责证明“链路没坏”；strict companion 负责证明“链路真的按设计完整工作”。**
