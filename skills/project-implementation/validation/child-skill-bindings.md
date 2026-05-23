# Project Implementation Child Skill Bindings

## 目标

说明 `project-implementation` 如何把子 Skill 绑定成会真实改变执行路径的实施控制器，而不是平铺工具箱。

唯一骨架仍然是：

```text
Why → What → Structure → Flow → Surface → Runtime Proof
```

这些绑定不是第二结构，而是父 Skill 在不同实施主路径上的行为约束。

---

## 一、五条主路径控制器

### 1. `incremental-implementation`
路径：`/Users/handy/.claude/skills/incremental-implementation/SKILL.md`

- 何时绑定：当前主动作是 build / implement，且需求已足够明确
- 改变什么：首动作从“直接大改”变成“先定义当前切片”
- 不替代什么：不替代 debug / proof / review，也不在定义模糊时硬推进

### 2. `debugging-and-error-recovery`
路径：`/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`

- 何时绑定：当前主动作是 debug / fix / recover，且已出现失败信号
- 改变什么：首动作从“试着改改看”变成“先停线、保留证据、稳定复现”
- 不替代什么：不替代新功能 build

### 3. `test-driven-development`
路径：`/Users/handy/.claude/skills/test-driven-development/SKILL.md`

- 何时绑定：当前主动作是 test / prove / regression，或 bug 修复需要先建失败证明
- 改变什么：首动作从“先写代码”变成“先建立失败证明”
- 不替代什么：不替代普通 build 路径或 review gate

### 4. `code-review-and-quality`
路径：`/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`

- 何时绑定：当前主动作是 review / assess / gate
- 改变什么：首动作从“继续改代码”变成“先审测试与验证故事，再审实现”
- 不替代什么：不替代 build / debug / proof 主路径

### 5. `shipping-and-launch`
路径：`/Users/handy/.claude/skills/shipping-and-launch/SKILL.md`

- 何时绑定：当前主动作是 ship / release / rollback
- 改变什么：首动作从“直接部署”变成“先确认 readiness / rollout / rollback 条件，再执行上线”
- 不替代什么：不在功能未达最小完成线时强行发布，也不替代 workflow / pipeline 本身的自动化建设

---

## 二、build / boundary 实现器

### `api-and-interface-design`
- 何时绑定：当前主实现面是 API endpoint、typed contract、module boundary、props shape
- 改变什么：先收敛 contract，再落实现
- 不替代什么：不替代高层 architecture definition

### `frontend-ui-engineering`
- 何时绑定：当前主实现面是 page / component / interaction
- 改变什么：先收敛界面骨架、状态与反馈，再写 UI 代码
- 不替代什么：不替代高层 UI/UX 定义

---

## 三、cross-path 风险强化器

这些 skill 不是只属于 review；当它们代表当前主要风险时，也可在 build 路径中提前补入。

### `security-and-hardening`
- 何时绑定：主风险在 trust boundary、auth/authz、secret、PII、upload、webhook、payment、external integration
- 改变什么：先识别 trust boundary 与 abuse path，再实现或审查防护
- 不替代什么：不把所有实现都拉入安全模式

### `performance-optimization`
- 何时绑定：已有性能目标、回归证据或明确 bottleneck 线索
- 改变什么：先建立 baseline，再定位瓶颈并复测
- 不替代什么：不接受“感觉更快”的盲优化

### `code-simplification`
- 何时绑定：功能已成立，但复杂度本身成为主要阻力
- 改变什么：先确认行为边界，再做局部简化
- 不替代什么：不把模块重写伪装成简化

---

## 四、process / evidence 强化器

### `source-driven-development`
- 何时绑定：当前实现高度依赖特定框架/库的官方推荐模式
- 改变什么：先核版本与官方来源，再写框架相关实现
- 不替代什么：不替代普通逻辑实现

### `context-engineering`
- 何时绑定：上下文散乱、读取面过大、agent 已开始偏航
- 改变什么：先缩减与重排上下文，再继续当前路径
- 不替代什么：不替代实际实现路径本身

### `git-workflow-and-versioning`
- 何时绑定：提交边界、保存点、worktree、冲突处理、历史整理成为当前阻力
- 改变什么：先划清变更边界与保存点，再执行 git 操作
- 不替代什么：不把实现问题错误转换成纯 git 问题

---

## 五、ship / release 强化器

### `ci-cd-and-automation`
- 何时绑定：workflow、quality gate、pipeline 或自动反馈回路是主交付物
- 改变什么：先定义 gate / trigger / feedback loop，再改 workflow
- 不替代什么：不把普通功能实现都转成 CI/CD 问题

### `documentation-and-adrs`
- 何时绑定：发布、公共接口变化或重要实现决策需要被记录
- 改变什么：把“做了什么”升级为“为什么这样做、后续如何理解”
- 不替代什么：不替代实现、review 或 rollout 本身

### `shipping-and-launch` 与 `ci-cd-and-automation` 的相邻边界
- 若主交付物是发布 readiness、staged rollout、monitoring、rollback preparation：先走 `shipping-and-launch`
- 若主交付物是 workflow、quality gate、pipeline、preview / deploy automation 本身：先走 `ci-cd-and-automation`
- 不要因为“发布前顺手改了 CI”就让 `ci-cd-and-automation` 吸走 ship 主路径
- 不要因为“automation 最终服务发布”就让 `shipping-and-launch` 吸走 workflow 主任务

---

## 六、运行态验证子 Skill 与相邻验证 Skill

### `visual-feedback-ui-qa`
- 角色：`project-implementation` 的运行态验证子 Skill
- 用途：当 UI / runtime validation 成为当前证据缺口时，提供真实运行态 UI QA 路径

### `browser-runtime-observation`
- 角色：`project-implementation` 的运行态技术验证强化器
- 用途：当当前主缺口是 DOM / console / network / accessibility / Lighthouse / performance / memory 等真实浏览器技术证据时补入
- 不替代什么：不替代轻量网页交互，也不替代用户可见反馈 QA

### `browser-testing-with-devtools`
- 角色：废弃兼容别名，不是 `project-implementation` 的 direct child
- 用途：仅用于把旧入口平滑转交到 `browser-runtime-observation`，不再承担独立浏览器验证方法面

### `chrome-devtools-mcp`
- 角色：底层 DevTools MCP reference，不是公开主调度 skill
- 用途：承载原始 tool guide、低层能力速查与专项故障排查材料

---

## 七、最小绑定顺序

### 明确要做功能
`project-implementation` → `incremental-implementation` → 必要时 `api-and-interface-design` / `frontend-ui-engineering` / `browser-runtime-observation`

### 明确是 bug
`project-implementation` → `debugging-and-error-recovery` → 必要时 `browser-runtime-observation` → `test-driven-development`

### 明确要先补证明
`project-implementation` → `test-driven-development` → 必要时 `browser-runtime-observation`

### 明确要做 gate
`project-implementation` → `code-review-and-quality` → 必要时 `visual-feedback-ui-qa` / `browser-runtime-observation`

### 明确要上线
`project-implementation` → `shipping-and-launch` → 必要时 `ci-cd-and-automation` / `git-workflow-and-versioning` / `documentation-and-adrs`
