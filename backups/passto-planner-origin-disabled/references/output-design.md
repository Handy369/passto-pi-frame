# Output Design

目标：把最终产出物映射到当前方案的持久化方案。

## 必须说明
- 存储在哪里
- 用什么形式持久化
- 谁负责写
- 哪些参与 resume / recovery

## 输出表格

| 产物 | 原系统位置/形式 | 方案中的位置/形式 | 写入者 | 恢复方式 |
|------|------------------|-------------------|--------|----------|

## 设计要求
- 明确路径策略（绝对 / 相对）
- 明确命名规范
- 明确主上下文与 subagent 的写入职责
- 优先“subagent 只返回结果，主上下文统一写文件”

## 输出文件
`output-design.md`

参考：
- `../../llm-migration-playbook/02-design-in-pi.md`
- `pi-capabilities.md`（仅在 product mode = PI 生态产品，或明确依赖 PI 时使用）
