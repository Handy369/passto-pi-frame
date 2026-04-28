# Synthesis & Check

组合：
- 输入设计
- 输出设计
- 运行时状态设计

然后回表核对分析阶段清单。

## 成立条件
- 用户输入完整覆盖
- 最终产物完整覆盖
- 环境变量 / 配置 / 依赖完整覆盖
- 中间态完整承载
- 运行时状态完整承载
- 不可简化节点未被错误简化

## 输出要求
最终写 `plan.md`，并保证包含：
- Target Summary
- User Inputs
- Env / Config / Dependencies
- Runtime Nodes and Intermediate States
- Final Artifacts
- PI Boundary Summary
- Architecture Plan
- Workflow Plan
- Commands and Tools Plan
- State and TUI Plan
- Persistence Plan
- Risks and Open Questions
- Validation Checklist

参考：
- `../../llm-migration-playbook/03-synthesize-and-verify.md`
