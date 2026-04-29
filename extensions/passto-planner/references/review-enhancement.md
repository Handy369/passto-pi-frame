# Review Enhancement

本文件定义 `passto-planner` 在外部审计阶段的 review 强化要求。

这些 review 子任务属于：
- `passto-executor` 容器中的 `stage=planner`
- `passto-planner` 执行器内部 review orchestration

主 planner 负责：
- 启动 review 子任务
- 收集 review 结果
- 写入 `reviews/*.md`
- 后续再统一整合到 `passto-integration-notes.md`

review 子任务不负责：
- 直接改写计划
- 写文件
- 推进后续 workflow

审计框架：

```text
用户输入
-> 运行时节点 + 当前节点加载输入
-> 输出
-> 下一节点输入
-> ...
-> 最终产出物
```

reviewer 必须检查：
- 输入闭环
- 运行时节点闭环
- 输出链路闭环
- 最终产物闭环
- 目标环境约束

review prompt 必须包含：

```text
Do not review this plan only as a generic architecture document.
Review it as an execution-ready product plan.

Use the following frame:
User inputs -> runtime nodes + loaded inputs -> outputs -> next-node inputs -> ... -> final artifacts.

Check whether the plan preserves this chain completely under the target environment constraints.
```

审计结果至少包含：
- 输入闭环问题
- 运行时节点闭环问题
- 产物闭环问题
- 目标环境约束问题
- 建议修正项

执行约束：
- reviewer 只返回审计结果，不写文件
- reviewer 完成当前结果后立即停止
- review 结果由主 planner 统一落盘并进入后续整合
