# Debugging and Error Recovery — Routing Cases

> status: ready-to-run
> target skill: `debugging-and-error-recovery`
> protocol: `/Users/handy/.claude/skills/skills-maker/validation/skill-routing-blackbox-protocol.md`

## 1. Target Skill Snapshot

### target
- name: `debugging-and-error-recovery`
- description summary:
  - failure-first
  - 已经出现测试失败 / 构建损坏 / 运行时异常 / 日志报错
  - 先停线、保留证据、稳定复现、定位根因、修复并补回归防护

### adjacent skills to guard against

#### `project-implementation`
- 顶层实施路由器
- 先判定 build / debug / test / review / ship
- 风险：它可能吃掉所有“代码类请求”，导致不下沉到 debug 子 skill

#### `incremental-implementation`
- build / implement 切片推进
- 风险：只要提示词看起来像“开始改代码”，就可能被它吸走

#### `test-driven-development`
- proof-first / test-first
- 风险：只要提示词强调“先补测试”，就可能被它吸走

#### `using-agent-skills`
- 定义 vs 实施的弱兜底
- 风险较低，但如果提示词过模糊，可能停留在兜底而不下沉到 debug

---

## 2. Routing Hypothesis

要让 `debugging-and-error-recovery` strong hit，提示词必须突出：

1. **失败已经发生**
   - 测试挂了 / 构建坏了 / 运行时报错 / console error / stack trace
2. **当前主任务是定位根因与恢复行为**
   - 不是“先做功能”
   - 不是“先补失败测试”
3. **强调证据与复现**
   - 复现 / 错误日志 / 根因 / 回归防护

如果提示词改成：
- “这个功能需求已经清楚，先切第一刀实现”
则应被 `incremental-implementation` 吸走，而不是命中 debug。

---

## 3. Ready-to-Run Prompts

## A. Positive — should trigger `debugging-and-error-recovery`

### case id
`debug-positive-typeerror-root-cause`

### prompt
这个项目里有个测试已经挂了，报的是 TypeError。先别直接改实现，先帮我保留错误证据、稳定复现、定位根因，确认为什么会报错，再做最小修复并补回归防护。

### expected evidence
- 前 1~3 个有效动作内读取：
  - `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- 首动作倾向：
  - 读失败输出 / 测试 / 相关源码
  - 而不是直接 edit 代码

### failure meaning
如果没读目标 `SKILL.md`，即使后续真的修好了，也记为：
- `missed-positive`

---

## B. Adjacent Negative — should NOT trigger `debugging-and-error-recovery`

### case id
`debug-negative-first-slice-implement`

### prompt
这个功能需求已经清楚。请在这个项目里切第一刀：给 UserService 新增一个 getUserTierLabel(id) 方法；如果用户有 profile，就返回 tier 的大写字符串；如果没有 profile，就返回 UNKNOWN；并补最小验证结果。

### expected evidence
- 不应读取：
  - `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- 更可能读取：
  - `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
  - 或 `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### failure meaning
如果读取了 `debugging-and-error-recovery/SKILL.md`，记为：
- `false-positive`

---

## C. Boundary Stress — debug vs TDD

### case id
`debug-boundary-regression-guard-after-failure`

### prompt
这个 bug 已经稳定复现了，当前测试也在挂。我想先搞清楚根因，再决定要不要补 failing test。你先帮我收集错误证据、定位问题来源，修完后再补最小回归防护。

### intent
这是故意压在 `debugging-and-error-recovery` 与 `test-driven-development` 边界上的混合提示词：
- 有失败
- 有回归防护
- 但主顺序是先根因定位，再决定测试

### expected evidence
更理想的 strong hit 是：
- 先读 `debugging-and-error-recovery/SKILL.md`
- 而不是优先读 `test-driven-development/SKILL.md`

### failure meaning
- 若先读 TDD：说明 proof-first 表述过强，debug surface 不够稳
- 若两者都不读：说明 description 仍不足以触发 adopt

---

## 4. Execution Rule For This Skill

执行顺序固定为：

1. 先跑 `debug-positive-typeerror-root-cause`
2. 若未 strong hit：
   - 停止
   - 只分析 `debugging-and-error-recovery` 与相邻 skill 的文案
3. 只有正例 strong hit 后，才跑：
   - `debug-negative-first-slice-implement`
4. 最后再跑：
   - `debug-boundary-regression-guard-after-failure`

未完成第 1 步 strong hit，不得推进到下一类 skill。

---

## 5. Result Table Template

| case_id | case_type | prompt | first_3_tool_calls | target_skill_read | adjacent_skill_read | verdict | notes |
|---|---|---|---|---|---|---|---|
| debug-positive-typeerror-root-cause | positive | 这个项目里有个测试已经挂了，报的是 TypeError。先别直接改实现，先帮我保留错误证据、稳定复现、定位根因，确认为什么会报错，再做最小修复并补回归防护。 | 1) read debugging-and-error-recovery/SKILL.md 2) bash find fixture files 3) bash ls fixture dir | yes | none | strong-hit | 命中后先读目标 skill，再读 package/src/test/runner 并执行 npm test 复现失败 |
| debug-negative-first-slice-implement | adjacent-negative |  |  |  |  |  |  |
| debug-boundary-regression-guard-after-failure | boundary-stress |  |  |  |  |  |  |
