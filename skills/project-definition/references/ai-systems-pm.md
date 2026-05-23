# AI Systems PM

> **last_verified: 2026-05-14**
> migrated from: `agent-product-manager/references/ai-systems-pm.md`

## 作用

这是 `project-definition` 中专门面向 AI / Agent 产品的能力模块。

它处理的不是普通功能规划，而是以下系统性问题：

- Agent 的 workflow 如何设计
- benchmark 应该怎么定义
- 哪些环节必须 HITL（Human-in-the-Loop）
- 如何建立 trust / confidence / review 机制
- 失败时如何 fallback，而不是直接崩掉

核心原则：

> AI 产品不是“能跑起来”就算完成，而是要能在不确定性下稳定地产生可控结果。

---

## 适用场景

- 设计 AI Agent 的端到端工作流
- 为 AI 功能定义 success criteria 与 benchmark
- 判断哪些任务可以全自动，哪些必须人工审核
- 设计 confidence gating、人工接管、审批流
- 设计 fallback：模型失败、工具失败、证据不足、低置信度时怎么办
- 做 AI 产品的上线前 readiness review

---

## 核心输出

1. **Workflow Map**
2. **Benchmark Plan**
3. **HITL Decision Matrix**
4. **Trust & Review Policy**
5. **Fallback Strategy**
6. **Launch Readiness Checklist**

---

## 一、Workflow 设计

先不要问“模型多强”，先问系统怎么工作。

### 推荐拆法

```text
Input
→ Intent / context understanding
→ Planning
→ Retrieval / tool use
→ Generation / action
→ Verification
→ Human review (if needed)
→ Output / execution
→ Logging / learning
```

### PM 需要明确的问题

- 输入来自哪里？结构化还是非结构化？
- 成功输出到底是什么？草稿、建议、动作还是已执行结果？
- 哪一步最容易引入风险？
- 哪一步成本最高？
- 哪一步最需要可解释性？
- 哪一步必须可回滚？

### Workflow 设计原则

- 尽量把高风险环节后置审批
- 把 verification 设计成独立阶段，不依赖生成阶段自证
- 能结构化就结构化，少依赖开放式自由输出
- 让日志、证据链、输入输出可追踪

---

## 二、Benchmark 思维

AI PM 不能只问“用户觉得不错吗”，必须问：

> 在什么任务上、用什么标准、与什么基线相比、稳定表现如何？

### benchmark 的最小结构

```markdown
## Benchmark Definition
- Task family:
- User segment:
- Gold-standard or expected output:
- Baseline:
- Metrics:
- Acceptance threshold:
- Failure categories:
```

### 必须定义的 5 件事

1. **任务单元**
   - 不是“AI 助手整体表现”
   - 而是：摘要、分类、检索、建议、规划、执行、校验等具体任务

2. **基线 baseline**
   - 人工完成
   - 旧流程
   - 非 AI 功能
   - 更简单的 prompt / 规则系统

3. **评价指标**
   - 质量：正确率、完成率、可接受率、编辑距离、人工采纳率
   - 效率：耗时、轮次、人工介入次数
   - 成本：token、API、人工审查成本
   - 风险：误判率、越权率、幻觉率、漏报率

4. **阈值 threshold**
   - 不能只看平均值，要设上线阈值
   - 例如：
     - task success rate ≥ 85%
     - critical error rate ≤ 1%
     - HITL rate ≤ 30%

5. **失败分类**
   - 理解错
   - 检索错
   - 推理错
   - 工具调用错
   - 输出格式错
   - 安全/权限错
   - 置信度判断错

### benchmark 设计原则

- 按任务族拆 benchmark，不做一个总分迷信
- 平均分没有意义，要关注长尾失败
- 评测集要覆盖真实脏数据与边界条件
- 线上与离线 benchmark 分开看

---

## 三、HITL（Human-in-the-Loop）

不是所有任务都适合全自动。

### 判断维度

| 维度 | 低风险自动化 | 高风险需 HITL |
|---|---|---|
| 错误代价 | 可逆、影响小 | 不可逆、影响大 |
| 可验证性 | 容易自动校验 | 难以自动校验 |
| 权限敏感度 | 无关键权限 | 涉及资金、数据、法律、发布 |
| 置信度 | 高且稳定 | 低或波动大 |
| 用户容错 | 可接受偶发错误 | 几乎不能错 |

### 常见 HITL 触发点

- 低置信度输出
- 多解冲突
- 涉及外部执行（发邮件、删数据、发版、付款）
- 检测到高风险实体或敏感内容
- 超出训练/规则边界的新型输入

### 常见 HITL 模式

1. **pre-approval**：先给建议，人批准后执行
2. **post-review**：先执行低风险动作，再抽样审核
3. **escalation**：只有命中规则才转人工
4. **co-pilot**：默认人主导，AI 辅助生成与分析

---

## 四、Trust 设计

trust 不是“让用户相信 AI 很强”，而是：

> 让用户知道什么时候该信、为什么能信、什么时候不该信。

### trust 设计要素

- 显示证据来源
- 显示关键假设
- 显示不确定性
- 显示建议而非装作确定
- 提供 easy override
- 支持查看 reasoning trace 或 decision trace（在合适层级）

### PM 应定义的 trust policy

```markdown
## Trust Policy
- What the system can be trusted to do:
- What it should never do without review:
- What evidence must be shown:
- What uncertainty must be disclosed:
- What user controls must exist:
```

### 常见错误

- 把流畅文风误当高质量
- 把“模型自信”误当“系统可靠”
- 只强调成功案例，不暴露适用边界

---

## 五、Fallback 设计

fallback 不是异常处理细节，而是 PM 必须定义的用户体验策略。

### 四类 fallback

1. **model fallback**
   - 主模型失败 → 次级模型
   - 高成本模型 → 低成本模型 或反向

2. **workflow fallback**
   - 多步 agent 失败 → 降级为单步建议模式
   - 自动执行失败 → 降级为人工确认模式

3. **evidence fallback**
   - 证据不足时，不继续编造
   - 改为请求更多上下文 / 提供草稿 / 标记待确认

4. **UX fallback**
   - 失败时告诉用户下一步能做什么
   - 保留中间产物，避免整段工作丢失

### fallback 设计模板

```markdown
## Fallback Strategy
| Failure Mode | Detection Signal | Fallback Behavior | User Message | Human Role |
|---|---|---|---|---|
```

### 好 fallback 的标准

- 用户知道系统失败了什么
- 用户知道现在系统做了什么降级
- 用户知道下一步自己该做什么
- 不隐藏失败，不假装成功

---

## 六、Launch Readiness Checklist

上线前至少检查：

```markdown
[ ] 关键任务族已定义 benchmark
[ ] 每个 benchmark 有 baseline 与阈值
[ ] 已定义 failure taxonomy
[ ] 已定义哪些环节 HITL
[ ] 已定义 trust disclosure 策略
[ ] 已定义 fallback 行为
[ ] 已定义日志与审计字段
[ ] 已定义升级/人工接管 owner
[ ] 已定义上线后监控指标
```

---

## 推荐输出模板

```markdown
## AI System PM Brief

### Goal
- 

### Workflow
| Stage | Input | Output | Risks | Verification |
|---|---|---|---|---|

### Benchmark
| Task | Baseline | Metric | Threshold | Notes |
|---|---|---|---|---|

### HITL
| Step | Trigger | Human Role | SLA |
|---|---|---|---|

### Trust
- Evidence shown:
- Confidence policy:
- User override:

### Fallback
| Failure Mode | Fallback | User-facing behavior |
|---|---|---|
```

---

## 与其他文档的关系

- 若仍在探索这个 AI 功能是否值得做 → `discovery.md`
- 若需要整理用户证据与竞品信号 → `research.md`
- 若系统边界明确，要写成正式 spec → `spec-and-scope.md`
- 若需要决定哪些 AI 能力先上路线图 → `roadmap-and-prioritization.md`
- 若上线后要复盘质量、人工介入率、失败率 → `metrics-and-learning.md`

---

## Related

| 关联文档 | 关联内容 |
|---|---|
| [../SKILL.md](../SKILL.md) | 主路由器 |
| [discovery.md](discovery.md) | 先判断 AI 机会是否成立 |
| [spec-and-scope.md](spec-and-scope.md) | 写成正式需求定义 |
| [metrics-and-learning.md](metrics-and-learning.md) | 复盘 benchmark 与线上表现 |
