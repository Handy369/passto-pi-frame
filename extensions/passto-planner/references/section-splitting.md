# Section File Writing

输入：
- `<planning_dir>/passto-plan.md`
- `<planning_dir>/sections/index.md`

输出：
- `<planning_dir>/sections/section-*.md`

执行：
1. 解析 `SECTION_MANIFEST`
2. 检查缺失的 `section-*.md`
3. 同一轮为每个缺失 section 启动一个独立分段子任务
4. 等待全部完成

规则：
- 这是 `passto-executor` 容器中 `stage=planner` 运行的 `passto-planner` 内部分段编写 orchestration
- 主 planner 负责启动、汇总与落盘分段结果
- 分段子任务不重写已有 section
- 只补齐缺失 section
- 每个 section 文件必须完全自包含

模板：
- Background
- Requirements
- Dependencies
- Implementation Details
- Acceptance Criteria
- Files to Create/Modify

完成条件：
- `SECTION_MANIFEST` 中列出的每个 section 都有对应文件
