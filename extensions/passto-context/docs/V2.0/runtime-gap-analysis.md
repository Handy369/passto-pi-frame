# PasstoContext V2.0 Runtime Gap Analysis

> 状态：Post-E7 Review  
> 更新：2026-05-21  
> 目的：在 E1–E7 已落地后，重新判断当前 repo 与 V2.0 长期目标架构之间**还剩什么 gap**。  
> 正式口径：**用户目标树 + 每用户目标一个 x-node-model + soft policy projection + runtime-proof signal**。

---

## 1. 本文结论

当前 `passto-context` 的 repo 状态，更准确的描述不再是：
- “V2 没实现”
- 也不是“正式对象链还没落到 runtime”

而是：

> **V2.0 主线（E1–E7）已经完成第一轮运行时闭合；当前剩余 gap 主要转向 compatibility 治理、稳定性证明、长期可维护性与后续演进边界。**

也就是说，当前系统已经具备：
- `UserGoalTreeDocument`
- `XNodeModelDocument`
- `XNodePolicyProjection`
- `RuntimeProofRecord / RuntimeProofSignal`
- `RuntimeProvisionalOverlay`
- 双层 completion closure
- artifact / state / restore / replay / injection / status 对上述对象的主链消费

因此当前真正的问题已经不再是“正式对象链是否存在”，而是：
- 哪些 compatibility bridge 还应继续保留
- 哪些 surface 仍存在旧口径残留
- 哪些真实 session / tmux / replay 回归还需要继续加固
- 如何避免在后续演进中重新退化回 GoalTree-first 思维

---

## 2. 已闭合的主线 gap

### 2.1 正式对象真相源已进入主链

当前主链已正式承接：
- `UserGoalTreeDocument`
- `XNodeModelDocument`
- `XNodePolicyProjection`
- `RuntimeProofRecord`
- `RuntimeProofSignal`
- `RuntimeProvisionalOverlay`

因此早期“对象真相源还没切换”的 gap 已闭合。

### 2.2 soft policy 已不再只是孤立字段

`nextStepType` 当前已收口为：
- `XNodePolicyProjection` 的可见策略字段
- `before-agent-start` 注入消费对象的一部分
- `/ptc status` 与 replay surface 的稳定观测对象

因此“只有 soft consumer、没有正式 policy object”的 gap 已闭合。

### 2.3 proof 已进入运行时正式对象层

当前 proof 已具备：
- Curator top-level 正式产出
- artifact / state / restore / replay 跨轮恢复
- `before-agent-start` 注入与 `/ptc status` 优先消费
- provisional subtree disposition 后的 proof target reconcile

因此“proof 仍只是附属验证语义”的 gap 已闭合。

### 2.4 双层完成闭环已进入运行时主链

当前已显式区分：
- local complete
- x-node-model complete
- user goal complete
- user goal tree complete

并已进入：
- sidecar
- restore / replay
- `/ptc status`
- `before-agent-start` injection surface

因此“完成语义仍偏单层”的 gap 已闭合。

---

## 3. 当前仍然存在的 gap，不再是主线缺失，而是收口与治理问题

## 3.1 compatibility bridge 仍需持续治理

当前仍保留：
- `GoalTreeDocument`
- `certaintyAssessment`
- `runtimeDraftGoalState`

这些对象已经不是主真相源，但仍然承担：
- replay-friendly bridge
- legacy fallback
- prompt / surface compatibility

因此当前 gap 不是“是否删掉”，而是：

> **如何确保它们继续只做 bridge，而不在后续实现中重新长回主对象。**

### 3.2 顶层文档与局部设计稿仍有旧世界叙事残留

当前部分文档仍保留：
- “对象链尚未落地”
- “proof signal 尚未主链化”
- “双层完成闭环仍是 gap”

这类描述在 E6 / E7 完成后已不再准确。

因此一个现实 gap 是：

> **文档真相源需要持续跟上主线闭合后的代码现实，避免未来决策继续基于过时 gap。**

### 3.3 真实运行时稳定性仍需长期证明，而不是只靠单次收口

虽然当前已通过：
- `npm run test:grc`
- `npm run test:tmux`
- `npm run test:regression`

但长期看仍需继续关注：
- tmux / session jsonl / host timing 抖动
- replay / reload / restore 的跨轮一致性
- fresh real session proof 的持续稳定性
- object-first surface 是否在后续改动中被局部回退

因此当前 gap 更像：

> **runtime reliability / regression hardening gap，而不是 object model gap。**

### 3.4 五维骨架的“可持续执行质量”仍需继续沉淀

当前五维口径已经进入：
- x-node-model 设计主线
- policy projection 解释口径
- Curator / Generator / runtime proof 叙事

但后续仍有一个更长期的 gap：

> **如何确保新功能、新 surface、新 prompt contract 都继续按 why / what / structure / flow / runtime proof 五维统一演进，而不是再次退化成散乱字段堆砌。**

这属于架构治理与质量守门问题，而不是 E1–E7 的主线缺失。

---

## 4. 按 post-E7 口径重排的后续优先级

### P1：主线文档收口
先做：
- 顶层 V2.0 README 收口
- runtime gap 文档改写为 post-E7 口径
- 补一份 mainline closure note / next-step note

目标：
- 让未来判断基于当前真实主线，而不是旧 gap 文本

### P2：compatibility 治理
再做：
- 梳理 `GoalTreeDocument` / `certaintyAssessment` / `runtimeDraftGoalState` 的残余职责
- 明确哪些必须保留，哪些应冻结，哪些可进一步 shrink
- 对新增实现增加 object-first 守门约束

目标：
- 防止 compatibility bridge 重新膨胀为主对象

### P3：回归与运行时稳定性加固
再做：
- 强化 tmux / host timing 敏感脚本的诊断与等待策略
- 对 replay / reload / fresh-session proof 增补更精确的断言
- 继续维持 `test:regression` 作为主回归入口

目标：
- 把“当前已可通过”进一步变成“长期稳定可依赖”

### P4：长期演进边界
最后做：
- 明确是否需要新增 phase（只有在目标已明显超出 E1–E7 主线时）
- 若要继续推进，应优先围绕 benchmark、runtime reliability、surface quality、compatibility retirement 等明确主题，而不是重新发明 V2 主线对象

目标：
- 后续演进建立在已闭合主线之上，而不是重复补主线

---

## 5. 一句话

> 当前 repo 与 V2.0 长期目标架构之间的主要 gap，已经不再是“有没有用户目标树 / x-node-model / policy projection / proof signal”，而是：**如何在主线已闭合的前提下，持续治理兼容层、稳固运行时证明、并防止系统重新退化回兼容态思维。**
