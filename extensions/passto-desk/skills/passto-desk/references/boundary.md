# Passto Desk Boundary

## Skill one-liner

当任务真正需要一个共享可视化中间物来承载多轮协作，而不是继续停留在纯文本里时，命中 `passto-desk`。

## Boundary judgment order

1. 先看当前主输出物是不是“共享工作台协作中间物”
2. 再看当前主要动作是不是“把纯对话升级为共享工作台协作”
3. 再看命中后的首动作是不是 `create / bind / read / 语义结构收敛`
4. 再看当前是否需要围绕 **semantic / view / mapping / visual** 四层持续修改
5. 最后才看用户有没有提到白板、图、Excalidraw 等名词

## Strong should-trigger cues

以下信号出现 1–2 个，就应认真考虑命中：
- “一起整理一下”某个结构/流程/关系/架构
- “边聊边改”
- “先搭个骨架给我看”
- “不要只文字说了”
- “放到同一个工作台/白板里继续讨论”
- “读一下当前工作台内容再继续改”
- “按泳道整理一下”
- “把这几步包成一组 / 一个回路”
- “补一个说明 note / 图例，方便后面协作”
- “给某一步加一句附注 / 限制条件 / 特殊说明”
- 用户显式提到 `passto-desk` / 共享工作台 / 共享白板 / “先画个图”

## Strong should-not-trigger cues

以下情况通常不该命中：
- 一次性问答就能结束
- 单纯要代码 / 修 bug / 跑测试
- 单纯要文档 / 摘要 / 文案
- 虽然提到图，但真正目标是浏览器运行态调试、性能或 QA

## Adjacent handoff

- 方案定义本身仍不清楚，需要先澄清需求与边界：转 `project-definition`
- 已经明确进入代码实现或调试：转 `project-implementation`
- 目标是看真实网页 DOM / console / network / lighthouse 证据：转 `browser-runtime-observation`
- 目标是做用户可见 UI QA：转 `visual-feedback-ui-qa`

## First action after hit

命中后先做这 4 个判断：
- 需不需要共享工作台
- 当前应 create / bind / read 哪条路径
- 当前应先追问语义结构，还是先摆最小骨架
- 当前是否需要 lane / group / relation label / visual hierarchy / note / legend

如果用户显式点名 `passto-desk`，再额外加一层 fast path：
- 先读 `SKILL.md`
- 再读 `references/runtime-surface.md`
- 再读 `references/readability-and-fast-path.md`
- 然后再进入 create / bind / read / import 判断

如果这些判断没有发生，说明还没有真正 adopt 本技能。
