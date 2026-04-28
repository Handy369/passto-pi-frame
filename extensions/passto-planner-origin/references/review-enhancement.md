# Review Enhancement

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
