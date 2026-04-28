# Interview Protocol

访谈在主上下文中进行。

输入：
- 初始 spec
- `passto-research.md`（如存在）

交互约束：
- 只有产品模式确认允许单选
- 其余选择题统一多选 + 手动输入
- 手动输入支持 `|`
- 必要时可追加 `passto_planner_prompt`

规则：
- 优先使用 `passto_planner_interview_round`
- 每轮 2–4 题
- 可切换题目
- 可修改前题答案
- 不重复已明确内容
- 不足时继续下一轮

问题簇：
- MVP 最小闭环
- 输入 / 输出边界
- 成功判定 / 验收标准
- 失败处理 / retry / fallback
- 用户角色 / 操作路径
- 非目标
- 风险
- 依赖与约束
- 与现有系统 / PI 的关系
- 输出物形式
- 分阶段上线
- 审计建议采纳边界

示例：

```ts
passto_planner_interview_round({
  title: "详细访谈：第 1 轮",
  questions: [
    {
      id: "mvp-loop",
      prompt: "第一版 MVP 你最希望先打通哪几条最小闭环？",
      options: [
        "从 spec 输入到计划输出",
        "从命令触发到 artifact 落盘",
        "从失败检测到 retry / self-heal",
        "从 reviewer 审核到执行推进"
      ],
      allowOther: true,
      otherPrompt: "请补充最小闭环；多项请用 | 分隔",
      placeholder: "shell wrapper 输入 | validator 审核 | 文件输出"
    },
    {
      id: "io-boundary",
      prompt: "这些闭环的输入、输出、校验点是什么？",
      placeholder: "输入 / 输出 / 校验点 / 失败处理"
    }
  ]
})
```

保存：
- 写入 `<planning_dir>/passto-interview.md`
