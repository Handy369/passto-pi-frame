# Skills-Maker Ready-Index Adopt Proof

> 生成时间：2026-05-17
> 任务模式：audit

---

## 1. 本次是否读取了 `skill-explore` 产物

**是。** 本次采用了 `ready-index → bundle` 的最小消费路径。

## 2. 读取路径

| 顺序 | 文件 | 角色 |
|---|---|---|
| 1 | `/Users/handy/.claude/skills/skills-maker/SKILL.md` | 方法入口 |
| 2 | `/Users/handy/.claude/skills/skills-maker/references/skill-explore-handoff.md` | handoff 协议 |
| 3 | `/Users/handy/.passtocontext/skill-explore/handoff/skills-maker/indexes/ready.json` | 发现层（非主真相源） |
| 4 | `/Users/handy/.passtocontext/skill-explore/handoff/skills-maker/bundles/bundle_typescript-skills_unversioned_n9zzja.json` | handoff bundle（主读取对象） |
| 5 | `/Users/handy/.passtocontext/skill-explore/aggregates/by-skill/typescript-skills/unversioned/summary.json` | 下钻核对 aggregate window |

## 3. 证据如何影响判断

- `ready.json` 只用来发现最新可读 bundle，不直接承担判断语义。
- 真正影响判断的是 bundle 本体中的：
  - `targetSkill = typescript-skills`
  - `scope.usageFactCount = 4`
  - `summary.notableSignals = { advance: 1, continue: 3 }`
  - `reviewFocus` 中暂无 correctionSoon / subagent 样本
- 因此，这些证据足以让 `skills-maker` 进入 **audit** 模式，但仍不足以直接下结构级 verdict。

## 4. adopt 信号

本次 adopt 成立的原因不是“提到了 runtime evidence”，而是发生了以下可观察行为：

1. 先判断当前任务属于 runtime-evidence 型 audit
2. 用户未提供 bundle 路径时，先查 `ready.json`
3. 只选最新 1 条 ready 项
4. 立即回读 bundle 本体，而不是停在索引层
5. 输出中明确标注读取层级与证据对判断的影响

## 5. 降级规则

若 `ready.json` 不存在、为空或 bundleFile 失效，则应显式输出：

- 当前缺少可用 runtime evidence
- 本次只能按普通 `skills-maker` 流程继续
- 后续应补：ready bundle 或显式 bundle 路径

## 6. 结论

本次 proof 表明：`skills-maker` 的 adopt 流程现在不仅能在用户直给 bundle 路径时消费 handoff，也能在**无显式 bundle 路径**时，先通过 `ready.json` 发现候选 bundle，再回到 bundle 本体完成最小证据消费。
