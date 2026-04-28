# PI Capabilities Referral

本文件作为 passto-planner 的内置 referral resource，供 LLM 直接读取，不需要自行搜索。

## PI 中适合放 extension 的能力
- slash commands
- tool registration
- runtime state
- widget / status
- session glue
- path normalization
- stop / resume / back / done

## PI 中适合放 skill 的能力
- workflow protocol
- step semantics
- references indexing
- model behavior guidance

## PI 中常见输入能力
- command args
- tool parameters
- ctx.ui.select
- ctx.ui.input
- ctx.ui.confirm
- 自定义 TUI

## PI 中常见输出能力
- 文件写入
- 目录结构
- state file
- status / widget
- tool text + details

## 设计原则
- 先分析本质，再设计外壳
- 先列清单，再做映射
- 先保证输入/输出/状态完整，再优化 UI
- 关键节点不要错误简化
- 优先原生 UI，必要时再上 custom TUI
- 在受限目标环境下，必须把环境边界当作 research 输入，而不是事后补丁
