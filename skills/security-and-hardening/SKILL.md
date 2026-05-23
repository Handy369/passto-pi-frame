---
name: security-and-hardening
description: >
  用于 trust boundary、认证授权、敏感数据处理或外部集成是当前主风险面的局部强化 Skill。当 build 或 review 路径下，
  当前变化跨越不可信输入、权限边界、secret、session、PII、file upload、webhook、payment 等安全敏感区时使用。
  它由 project-implementation 按需补入，用来先识别 trust boundary 与 abuse path，再落安全实现或审查结论。
---

# Security and Hardening

## Top-level Boundary Pack

### current main output
- trust boundary 清单
- 关键 abuse / misuse path
- 安全实现改动或安全 findings
- 与边界对应的验证证据

### current main action
- 识别 trust boundary 与 attacker path
- 区分不可信输入、权限边界、敏感数据流
- 对高风险路径补安全实现或给出安全审查结论
- 用验证证据证明边界被显式防护

### should-trigger
当当前变化满足以下任一项时，优先进入本 Skill：
- 跨越不可信输入或第三方返回边界
- 涉及 authn / authz / session / token / secret
- 涉及 PII / payment / upload / webhook / callback
- 安全成为当前 build 或 review 路径下的主风险面

### should-not-trigger
以下请求不应由本 Skill 接管：
- 当前变化不跨越安全敏感边界
- 当前主任务只是普通功能实现，安全不是主风险
- 当前主任务是产品层面的安全策略定义，而不是实现/审查边界
- 当前主任务是纯性能、纯可读性或纯实现节奏问题

### adjacent destination
- build / implement 切片推进 → `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- review / quality gate → `/Users/handy/.claude/skills/code-review-and-quality/SKILL.md`
- performance 主风险 → `/Users/handy/.claude/skills/performance-optimization/SKILL.md`
- 定义不足、需先澄清需求或策略边界 → `/Users/handy/.claude/skills/project-definition/SKILL.md`
- 顶层实施路由 → `/Users/handy/.claude/skills/project-implementation/SKILL.md`

### non-goals
- 不负责把所有代码都拉入安全模式
- 不替代普通功能实现
- 不替代高层安全治理或完整安全体系设计
- 不在风险收敛后继续无限扩张成全面安全评估

### first action after hit
先画最小 trust boundary：谁可控、谁不可信、谁有权限、谁不该看到什么；如果没有先完成这一步，就不算真正 adopt 本 Skill。

### positive examples
- “这个 webhook 接口要接第三方回调，先帮我看伪造请求和 secret 校验怎么防。”
  - why should trigger: 明显跨越第三方不可信输入与 secret 验证边界
  - expected adopt signal: 先列 trust boundary / abuse path，再落防护或 findings
- “这次改动涉及文件上传和用户可见数据，帮我先做一轮安全审查。”
  - why should trigger: 安全边界是当前主风险
  - expected adopt signal: 先识别边界与 misuse path，再输出安全结论与验证证据

### negative examples
- “这个页面已经明确，先切第一刀实现。”
  - why should not trigger: 当前主任务是 build 节奏，不是安全主风险
  - correct destination: `/Users/handy/.claude/skills/incremental-implementation/SKILL.md`
- “这个测试为什么挂了，先找根因。”
  - why should not trigger: 当前主任务是 debug
  - correct destination: `/Users/handy/.claude/skills/debugging-and-error-recovery/SKILL.md`
- “帮我给这个接口做性能优化。”
  - why should not trigger: 当前主风险是性能而不是安全
  - correct destination: `/Users/handy/.claude/skills/performance-optimization/SKILL.md`

## Why

这个 Skill 用于压缩“功能能跑，但信任边界和滥用路径没有被显式收敛”的安全不确定性。

如果没有它，agent 很容易：
- 只实现 happy path，不识别 attacker path
- 把客户端校验误当安全边界
- 混淆 authentication、authorization、validation、sanitization
- 在 secret、session、PII、第三方回调等场景里留下隐患

---

## What

### 主目标
把安全敏感实现收敛成**先识别 trust boundary 与 abuse path，再实现或审查**的路径。

### 主输出物
- trust boundary 清单
- 关键 abuse / misuse path
- 安全实现改动或安全 findings
- 与边界对应的验证证据

### 不负责
- 不替代普通功能实现
- 不把所有代码都拉入安全审查模式
- 不替代产品层面的安全策略讨论

它通常作为：
- `/Users/handy/.claude/skills/project-implementation/SKILL.md`
的 build 或 review 路径专项实现器被补入。

---

## Structure

默认只需单一 `SKILL.md`。

### Structure Decision Summary

| artifact | status | runtime or external | why it exists / why absent |
|---|---|---|---|
| `SKILL.md` | required | runtime | security-sensitive 节点入口；负责 trust boundary 首动作、abuse path 识别与验证证据要求 |
| `references/` | forbidden | runtime | 当前 skill 足够小，不需要额外 reference 面；新增会放大 security path surface |
| `validation/` | forbidden | external | 当前没有 benchmark / preflight / runtime-proof 等独立 external 资产需要维护 |
| `scripts/` | forbidden | runtime | 当前 skill 的价值在边界识别与防护约束，不在脚本层 |
| `templates/` | forbidden | runtime | 当前 skill 的输出形状稳定，不需要模板目录 |

它在父 Skill 中真正改变的是：
- 首动作：先识别 trust boundary / attacker path，而不是先补代码细节
- 证据形状：从“功能可用”变成“边界被显式防护、敏感路径被验证”

---

## Flow

1. 先确认当前变化是否跨越安全敏感边界：
   - 用户输入
   - 第三方返回/回调
   - 认证授权
   - session / token / secret
   - PII / payment / upload
2. 先画出最小 trust boundary：谁可控、谁不可信、谁有权限、谁不该看到什么
3. 先列 abuse / misuse path：
   - 越权
   - 注入
   - XSS
   - secret 泄露
   - 伪造回调 / 上传滥用 / 速率滥用
4. 再实现或审查防护：
   - 边界验证
   - 参数化查询
   - 输出编码 / 安全 headers
   - authn / authz 检查
   - secret/session 安全处理
5. 对高风险路径给出验证证据：测试、配置检查、手工验证、审查结论
6. 风险收敛后停止，不把它无限扩成完整安全体系设计

### 关键约束
- 先 trust boundary，后代码细节
- 客户端校验不是安全边界
- 外部输入与第三方返回都视为不可信
- 权限检查要贴近资源边界，而不是只检查“是否登录”
- 不记录敏感数据，不提交 secret，不暴露内部错误细节

### 何时不该使用
- 当前变化不跨越安全敏感边界
- 安全不是当前主风险
- 仍在高层产品/架构定义阶段

---

## Surface

这是一个局部强化型 Skill：
- 入口窄
- 只在 trust boundary 成为主风险时补入
- 输出稳定围绕 boundary / abuse path / guard

在父 Skill `project-implementation` 中，通常位于：
- build 或 review 路径下的 security-sensitive 节点

---

## Runtime Proof

先验证：补入本 Skill 后，首动作是否真的从“继续做功能”变成“先识别 trust boundary 与 abuse path”。

再验证：
- trust boundary 是否被明确列出
- 关键 abuse path 是否被覆盖
- 实现或 findings 是否贴着真实边界
- 是否产出了对应验证证据
- 是否没有把泛泛安全常识当成完成证明

可接受 proof：
- human review
- targeted tests / config verification
- downstream quality（越权、注入、泄露类返工是否更少）
