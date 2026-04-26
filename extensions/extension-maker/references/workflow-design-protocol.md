# Workflow Design Protocol (Lightweight)

在将自然语言转化为 Extension 规格时，遵循**“意图-状态-交互”三角模型**，避免过度发散。

## 1. 意图锚定 (Intent Anchoring)
- **一句话目标**: 这个 Extension 到底帮用户解决什么问题？
- **核心输入**: 用户需要给什么？（参数、文件、文本）。
- **核心输出**: 用户最后看到什么？（结果文件、UI 提示）。

## 2. 状态机拆解 (State Machine Design)
- **Step 1**: 接收输入，保存初始状态。
- **Step 2..N**: 核心处理步骤（计算、转换、写入）。
- **Final Step**: 交付结果或请求确认。

## 3. 交互接口定义 (Interaction Mapping)
根据意图选择 **Pi TUI** 中最合适的交互：
- **输入文本**: `ctx.ui.input`
- **做选择**: `ctx.ui.select` / `ctx.ui.multiselect`
- **确认/否决**: `ctx.ui.confirm`
- **看进度**: `ctx.ui.setStatus` / `ctx.ui.setWidget`
- **弹窗提示**: `ctx.ui.notify`

## 4. 隔离性设计 (Isolation Design)
- **命名规范**: 工具名必须为 `ext_{slug}_action`。
- **入口**: 必须是 `/command` 触发。
