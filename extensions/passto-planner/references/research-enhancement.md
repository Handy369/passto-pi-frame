# Research Enhancement

`passto-planner` 作为 gepetto 的强化版，在 Research 阶段不只做传统的：
- codebase research
- web research

还要额外加入：

## 1. Workflow Research

目标：研究目标系统**如何从输入流转到最终产物**。

核心方法：

```text
用户输入
-> 运行时节点 + 当前节点加载输入
-> 输出
-> 下一节点输入
-> ...
-> 最终产出物
```

要回答的问题：
- 用户输入有哪些？
- 每个运行时节点是什么？
- 每个节点加载了哪些环境变量、配置、默认值、上游输出？
- 每个节点输出了什么？
- 这些输出如何进入下一节点？
- 最终产出物在哪里形成？

## 2. Environment Research

只有当分析判断目标环境是受限环境时，才进行环境研究。

要研究：
- 能做什么
- 不能做什么
- 原系统有哪些动作在目标环境里无法直接复刻
- 需要用什么方式承载

如果识别出的目标环境是 PI，研究重点包括：
- extension 能力边界
- skill 能力边界
- TUI 交互边界
- tool 参数与返回值模式
- state / resume / widget / status 能力

## 输出要求

研究结果应在 `analysis.md` 中显式体现，不要只作为脑内理解。

至少增加以下章节：
- `# Workflow Research`
- `# Target Environment Constraints`
