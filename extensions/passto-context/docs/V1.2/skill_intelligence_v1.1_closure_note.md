# Skill Intelligence v1.1 收口完成说明

> 日期：2026-05-17  
> 适用范围：`skill-explore / runtime-proof` 线  
> 状态：v1.1 收口完成；v1.2 最小闭环已落地，扩展项待继续

---

## 1. 一句话结论

`skill-explore / runtime-proof` 这条线现在应统一表述为：

> **v1.1 已收口完成。当前代码基线在不回退 v1.1 的前提下，已额外落地 v1.2 的最小闭环；其余未完成项属于 v1.2 扩展，而不是 v1.1 残留。**

---

## 2. v1.1 已完成什么

v1.1 的收口目标已经完成，主要包括：

- `agent_end` 驱动的 `skill-explore` hosted plugin 基线成立
- top-agent / subagent 的 `read .../SKILL.md` 可被稳定抽取
- session-scoped runtime evidence 可持久化并恢复
- widget `记:<principlesExtracted>+<skillReadCount>` 已接入真实计数
- runtime-proof 双场景验证已通过

如果只问“v1.1 是否完成”，答案应是：**完成。**

---

## 3. 当前代码基线比 v1.1 多做了什么

在 v1.1 收口之后，当前代码又继续补入了 v1.2 的最小闭环能力：

- `SkillUsageFact` / `SkillAggregateSummary` / aggregate 落盘
- `SkillReviewBundle` / `BundleReceipt` / ready-reviewed 索引
- ready bundle 主动扫描与选择策略：`target skill -> newer -> richer signals`
- `ready -> bundle -> receipt` 的真实 consumption proof
- `/ptc skills status|ready|reviewed|aggregate|export` 命令面
- `skill-review-model.json` / `review.html` 导出 surface
- `skill-explore-read-ready-bundle.mjs` 支持 `--format json|markdown`
- selection 口径已同步到脚本、测试、README、proof 文档与样例文档

这部分应表述为：

> **v1.2 最小闭环已落地**

而不应再反向改写成“v1.1 仍未完成”。

---

## 4. 仍未完成的是什么

当前仍未完成的项目，统一归到 **v1.2 扩展项**，包括：

- `summaryEntry + skill read` join
- cross-session aggregate
- `descriptionHash` version bucket
- task-shape / cluster
- opportunity hypothesis
- benchmark handoff bundle
- write-back review workflow（如 decision import / adopt / approve）
- Outcome Proof 完整闭环

因此，后续若再说“还有哪些没做”，应明确说：

> **这些是 v1.2 扩展项，不阻断 v1.1 收口完成。**

---

## 5. 推荐对外表述

推荐统一使用以下表述：

> Skill Intelligence 这条线的 **v1.1 已收口完成**。  
> 在不回退 v1.1 基线的前提下，当前实现已进一步落地 v1.2 的最小闭环：  
> `runtime evidence -> ready selection -> bundle consumption -> receipt proof`。  
> 其余未完成项属于 v1.2 扩展，不再计入“v1.1 未完成”。

短版可写成：

> **v1.1 done; v1.2 minimal loop landed; expansion pending.**

---

## 6. 权威参照

当前版本口径以以下文件为准：

- `docs/skill_intelligence_v1.1.md`
- `docs/runtime-proof/skills-maker-p4-proof.md`
- `docs/runtime-proof/skills-maker-ready-adopt-proof.md`
- `docs/runtime-proof/skills-maker-ready-receipt-proof.md`
- `README.md`

如需判断某条能力属于：
- v1.1 收口项
- v1.2 最小闭环
- v1.2 扩展项

应优先回到 `docs/skill_intelligence_v1.1.md` 的最新状态说明，而不是沿用旧轮次口头表述。
