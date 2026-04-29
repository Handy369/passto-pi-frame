# passto-executor stages

`stages/` 是 `passto-executor` 的 stage registry。

规则：
- 每个子目录代表一个 stage
- 每个子目录必须包含 `stage.md`
- `stage.md` 的 frontmatter 描述该 stage 的元数据
- `passto-agent` 可显式读取这些文件判断 stage、参数和示例
- `passto-executor` 使用该目录校验 task-doc 中的 `stage`

当前 stage：
- `builder`
- `reviewer`
- `operator`
