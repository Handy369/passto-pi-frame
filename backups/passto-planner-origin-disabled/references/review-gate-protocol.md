# Review Gate Protocol

使用：

```ts
passto_planner_review_gate({
  title: "计划审阅",
  message: "请审阅并按需编辑 passto-plan.md。",
  filePath: "<planning_dir>/passto-plan.md"
})
```

规则：
- 第一层选项顺序固定：
  1. `我将直接修改 MD，请等待`
  2. `审阅通过，继续`
- 若进入手动修改：
  - 提示编辑 `passto-plan.md`
  - 只显示：`已完成修改，继续`
- 在用户明确继续前，不得推进 workflow
