# passto-planner

`passto-planner` 是一个面向 **将初步需求构想 / skills / CLI / shell 脚本 / 文档型 workflow 进行产品化设计的 AI 规划工具**。

它不是一个只服务特定生态的专用规划器，也不是与 gepetto 平行的全新产品，而是一个 **以 gepetto 为基础、强化分析引擎与方案质量控制的规划扩展**。

它保留 gepetto 的核心价值：
- research
- interview
- spec / plan
- review

并在此基础上强化：
- 对目标系统本质的分析
- 由 LLM 判断 target nature，而不是依赖硬编码分类规则
- 允许客户显式选择产品模式：独立产品 / PI 生态产品
- 对输入 / 运行时 / 输出 / 最终产物链路的抽取
- 在分析后识别项目是否存在明确依赖或受限条件
- 只在当前模式或约束明确需要时，按需加载目标环境背景信息
- 对方案闭环性的框架化审计

## 定位

### gepetto
适合：
- 宽泛的功能实施规划
- research → interview → spec → plan → review → sections

### passto-planner
适合：
- 将初步需求构想、skills、CLI、shell 脚本、docs workflow 进行产品化设计
- 在研究阶段强化 workflow 分析能力
- 在方案阶段强化输入 / 输出 / 运行时状态建模
- 由 LLM 先判断目标本质，而不是把输入类型写死成固定模式
- 允许用户在关键时点选择产品模式：独立产品 / PI 生态产品
- 在分析后识别项目依赖和受限条件
- 在审计阶段强化闭环性检查
- 在当前模式或约束明确需要时，再按需引入目标环境背景信息（例如 PI）

## 输入

用户提供目标输入，支持：
- 初步需求构想 / 目标描述
- 本地路径
- URL

目标可指向：
- skills
- CLI 项目
- shell 脚本
- 文档集合
- 一段尚未落地的需求构想

## 输出

在规划目录生成：
- `analysis.md`
- `input-design.md`
- `output-design.md`
- `runtime-design.md`
- `plan.md`

## 内置参考

扩展内置 referral resources，供 LLM 直接读取：
- 通用分析 / 设计 / 校验方法论
- 环境依赖 / 受限条件识别入口方法
- 目标环境背景信息（按需使用）
- 框架化审计方法
- `analysis.md` 到 `plan.md` 的映射规则

目标是避免模型在运行时自己乱搜资料，并让 research / review 建立在统一框架上。
