# Black Box Design Protocol for Extensions

在将自然语言转化为 Extension 规格时，必须遵循“黑盒逆向”分析法，避免陷入细节。

## 1. 黑盒定义 (Black Box Definition)
- **输入 (Inputs)**: 用户给什么？(文字? 文件? 选中的代码? 配置?)
- **输出 (Outputs)**: 用户得到什么？(修改后的文件? 弹窗提示? 新生成的代码? 外部系统调用?)
- **本质**: 这个工具在“转换”什么？

## 2. 逆向推导 (Reverse Engineering)
- 从 **Outputs** 倒推：为了产生这个输出，必须经过哪些步骤？
- 识别 **中间产物**: 步骤之间需要传递什么数据？(这就是 State 需要存的字段)。
- 识别 **阻断点**: 哪里需要用户确认？哪里需要外部工具？

## 3. 运行时状态设计 (Runtime State)
- 根据中间产物，定义 `.state.json` 的结构。
- 确保状态机能够支撑从 Input 到 Output 的完整路径。

## 4. 闭环验证 (Loop Verification)
- 检查设计是否覆盖了所有 Input 场景。
- 检查 Output 是否符合用户预期。

**执行要求**：在 Step 2 生成 JSON Spec 前，必须先在思维链中执行此分析，或在 Step 1 使用 `ext_maker_analyze` 输出分析报告。