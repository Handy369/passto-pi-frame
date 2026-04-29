---
name: passto-planner
description: 输入目标描述、本地路径或 URL，输出 passto-plan.md。
---

# Passto Planner

完整 workflow：研究 → 访谈 → 规格综合 → 计划 → 审计 → 整合 → 分段 → 执行产物。

## 交互约束

- 产品模式确认：唯一单选，使用 `passto_planner_question(...)`
- 其他选择型互动：统一使用 `passto_planner_multiselect(...)`
- 所有多选都必须 `allowOther: true`
- 手动输入支持 `|` 分隔多项
- 必要时可在多选后追加 `passto_planner_prompt(...)`
- 详细访谈优先使用 `passto_planner_interview_round(...)`
- 计划审阅必须使用 `passto_planner_review_gate(...)`

## Workflow

### 1. 校验目标输入

先调用：

```ts
passto_planner_fetch_target({ target: "<path-or-url>" })
passto_planner_start({ target: "<path-or-url>" })
```

回退：

```ts
passto_planner_back({ planningDir: "<planning_dir>" })
```

### 2. 分析目标材料

读取目标材料，按 `references/analysis-protocol.md` 写入：

```text
<planning_dir>/analysis.md
```

### 3. Research Decision

Research 固定 3 个方向：
1. 本地代码仓库研究
2. 关键环境 / 依赖 / 外部事实限制研究
3. Web Search 最佳实践研究

#### 3.1 产品模式确认（唯一单选）

```ts
passto_planner_question({
  title: "基于当前分析，这个项目更适合被规划为哪种产品模式？",
  options: ["独立产品", "PI 生态产品"]
})
```

#### 3.2 本地代码仓库研究范围

```ts
passto_planner_multiselect({
  title: "请确认本地代码仓库研究范围",
  options: [
    "没有项目代码，进入下一步",
    "有项目代码，需要研究当前 cwd",
    "有项目代码，需要输入路径",
    "需要额外关注已有模式与约定",
    "需要额外关注依赖与配置"
  ],
  allowOther: true,
  otherPrompt: "请输入其他代码仓库研究范围；多项请用 | 分隔",
  placeholder: "extension 生命周期 | TUI 交互"
})
```

如选择输入路径，继续：

```ts
passto_planner_prompt({
  title: "请输入项目代码路径",
  placeholder: "/absolute/path/to/repo"
})
```

#### 3.3 关键环境 / 依赖 / 外部事实限制

```ts
passto_planner_multiselect({
  title: "请确认关键环境 / 依赖 / 外部事实限制",
  options: [
    "PI CLI",
    "本地规则 / 内部规范",
    "外部 API / 第三方服务",
    "部署 / 运行环境限制",
    "权限 / 合规 / 授权限制"
  ],
  allowOther: true,
  otherPrompt: "请输入其他项；多项请用 | 分隔",
  placeholder: "企业内网 | 私有 SDK | 数据驻留要求"
})
```

#### 3.4 Web Search topics

```ts
passto_planner_multiselect({
  title: "请确认需要做 Web Search 的 topics",
  options: derivedTopics,
  allowOther: true,
  otherPrompt: "请输入其他 topics；多项请用 | 分隔",
  placeholder: "pricing best practices 2026 | risk control patterns"
})
```

完成后更新：

```text
<planning_dir>/analysis.md
```

### 4. Execute Research

先读取 `references/subagent-prompt-contracts.md`。

这是 `passto-executor` 容器中 `stage=planner` 运行的 `passto-planner` 内部 research orchestration。

Research 方向：
- 代码仓库研究：仅在用户明确确认存在本地代码仓库时启动
- 关键环境 / 依赖 / 外部事实限制研究：固定执行
- Web Search：每个 topic 一个独立 research subtask

执行规则：
- 由 `passto-planner` 主体负责启动、管理、汇总 research subtasks
- research subtasks 只返回结果，不写文件，不推进 workflow
- 主体统一把研究结果写入 `<planning_dir>/passto-research.md`
- 具体子任务运行由 frame 允许运行的 agent-runtime 机制承载，不把某个具体宿主工具名当作 workflow 契约本体

约束：
- Web Search 必须按 topic split
- 最多并行 2 个 web research subtasks
- 每个 web research subtask 必须在初始 prompt 中显式限定 topic 边界、输出格式、停止条件与“不写文件”要求
- 若当前实现不支持 mid-run steering，则必须在初始 prompt 中预先要求子任务在有限轮次内收敛并完成摘要
- 所有 research subtasks 完成自己的结果后必须立即停止，禁止继续推进到后续步骤

输出：

```text
<planning_dir>/passto-research.md
```

### 5. 详细访谈

先读取 `references/interview-protocol.md`。

优先使用：

```ts
passto_planner_interview_round(...)
```

约束：
- 每轮 2–4 题
- 可切换题目
- 可修改前题答案
- 除产品模式外，选择题统一多选 + 手动输入
- 必要时追加 `passto_planner_prompt(...)`

### 6. 保存访谈记录

写入：

```text
<planning_dir>/passto-interview.md
```

### 7. Spec Synthesis

写入：

```text
<planning_dir>/passto-spec.md
```

### 8. 生成初始计划

写入：

```text
<planning_dir>/pre-plan.md
```

### 9. 外部审计

先读取：
- `references/subagent-prompt-contracts.md`
- `references/review-enhancement.md`

这是 `passto-executor` 容器中 `stage=planner` 运行的 `passto-planner` 内部 review orchestration。

执行规则：
- 由 `passto-planner` 主体并行启动 2 个 review subtasks
- review subtasks 只负责审计，不负责整合、改写、写文件或推进 workflow
- 主体负责收集 review 结果并写入：
  - `<planning_dir>/reviews/gpt-5.4-review.md`
  - `<planning_dir>/reviews/claude-opus-4-6-review.md`
- 具体子任务运行由 frame 允许运行的 agent-runtime 机制承载，不把某个具体宿主工具名当作 workflow 契约本体

建议 reviewer 配置：
- `PASSTOAI-TW/AUTH/gpt-5.4`
- `PASSTOAI-TW/AUTH/claude-opus-4-6`

### 10. 整合外部反馈

写入：

```text
<planning_dir>/passto-integration-notes.md
```

### 11. 用户审阅计划

先读取 `references/review-gate-protocol.md`。

必须使用：

```ts
passto_planner_review_gate({
  title: "计划审阅",
  message: "请审阅并按需编辑 passto-plan.md。",
  filePath: "<planning_dir>/passto-plan.md"
})
```

### 12. 格式化增强

写入：

```text
<planning_dir>/passto-plan.md
```

### 13. 创建分段索引

先读取 `references/section-index.md`。

写入：

```text
<planning_dir>/sections/index.md
```

要求：`index.md` 必须以 `SECTION_MANIFEST` 开头。

### 14. 编写分段文件

先读取 `references/section-splitting.md`。

要求：
- 解析 `SECTION_MANIFEST`
- 只为缺失的 `section-*.md` 启动 Agent
- 同一轮并行启动
- 等待全部完成

### 15. 生成执行文件

为了将规划无缝转化为代码实现，必须生成以下两个文件：

**输出 1：`<planning_dir>/passto-ralph-loop-prompt.md`**
- 用途：供 ralph-wiggum 自动执行代码开发。
- 内容要求：**必须内联嵌入 `sections/` 下所有 section-*.md 的完整内容**。
- 目的：让 Ralph 在一个 Prompt 上下文中拥有完整的开发指引，无需切换文件。

**输出 2：`<planning_dir>/passto-ralphy-prd.md`**
- 用途：供 Ralphy CLI 作为 PRD 使用。
- 内容要求：**必须包含按顺序排列的任务列表**，通过文件路径引用各个 section 文件。
- 目的：让 CLI 能按步骤调度开发任务，保持开发进度的可追踪性。

### 16. 最终检查

确认已生成：
- `passto-research.md`
- `passto-interview.md`
- `passto-spec.md`
- `pre-plan.md`
- `passto-plan.md`
- `passto-integration-notes.md`
- `reviews/`
- `sections/index.md`
- 全部 `section-*.md`
- `passto-ralph-loop-prompt.md`
- `passto-ralphy-prd.md`

### 17. 输出总结

最后调用：

```ts
passto_planner_done({ planningDir: "<planning_dir>" })
```

## 续传点

| 已有文件 | 续传位置 |
|---------|---------|
| 无 | 第 2 步 |
| analysis.md | 第 3 步 |
| + passto-research.md | 第 5 步 |
| + passto-interview.md | 第 7 步 |
| + passto-spec.md | 第 8 步 |
| + pre-plan.md | 第 9 步 |
| + reviews/ | 第 10 步 |
| + passto-integration-notes.md | 第 11 步 |
| + passto-plan.md | 第 13 步 |
| + sections/index.md | 第 14 步 |
| 所有 section 文件齐全 | 第 15 步 |
| + passto-ralph-loop-prompt.md + passto-ralphy-prd.md | 完成 |
