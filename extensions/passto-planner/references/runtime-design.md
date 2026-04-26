# Runtime Design

目标：设计运行时状态、中间态承载，以及在当前方案中的呈现方式。

## 必须说明
- 状态保存在哪里
- 用 status / widget / dialog 还是 custom TUI
- 是否需要 back / resume / review gate
- 哪些状态必须显式化

## 输出表格

| 状态 | 原系统如何体现 | 方案中如何体现 | 承载位置 |
|------|----------------|----------------|----------|

## 设计要求
- 区分“中间态”和“最终产物”
- 说明 resume 如何推断
- 说明 stop/back/done 如何实现
- 说明用户在哪些关键节点需要结构化交互

## 输出文件
`runtime-design.md`

参考：
- `../../llm-migration-playbook/02-design-in-pi.md`
- `pi-capabilities.md`（仅在 product mode = PI 生态产品，或明确依赖 PI 时使用）
