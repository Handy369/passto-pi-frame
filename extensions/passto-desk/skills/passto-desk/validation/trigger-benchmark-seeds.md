# Passto Desk Trigger Benchmark Seeds

> 目的：验证 agent 会不会在“没提 Excalidraw / 没提工具名”的情况下，仍然正确命中 `passto-desk`，并在命中后进入 **semantic → view → mapping → visual** 的 v3 workflow，而不是直接拼 elements。

## Positive seeds

### P1
**user**: 这个系统关系有点绕，你先帮我搭个结构骨架，我们边看边改。
- why should trigger: 需要共享结构骨架承载后续协作
- expected adopt signal: agent 主动建议共享工作台，先收敛主节点与关系

### P2
**user**: 不要只用文字说了，把我们刚才的讨论放到同一个工作台里继续整理。
- why should trigger: 明确要求共享工作台协作
- expected adopt signal: agent 进入 create/bind 判断，并准备最小语义图

### P3
**user**: 先把模块、依赖和调用关系摆出来，我想看着改。
- why should trigger: 需要关系图作为共享中间物
- expected adopt signal: agent 先问模块/依赖/方向，再导入语义图

### P4
**user**: 读取一下当前白板上的内容，告诉我现在的结构，然后我们继续补全。
- why should trigger: 需要从现有共享工作台读回并继续推进
- expected adopt signal: agent 选择 bind/read 路径，并优先 `export_domain_json`

### P5
**user**: 这个方案我现在脑子里很乱，你先外化一下，给我一个可以一起改的版本。
- why should trigger: 需要把模糊想法外化成共享中间物
- expected adopt signal: agent 先搭最小骨架，再标记待确认部分

### P6
**user**: 我们做个共享结构图，把这几个阶段和依赖关系整理清楚。
- why should trigger: 共享结构图就是当前最贴切交付物
- expected adopt signal: agent 命中 passto-desk，并先确认阶段与依赖

### P7
**user**: 用 passto-desk 先画一个骨架图，我们看着改。
- why should trigger: 用户显式点名 skill / tool surface，且目标是共享工作台协作
- expected adopt signal: agent 先读取 skill/runtime references，再走最小骨架导入路径

### P8
**user**: 这个流程你先外化出来，但别一下画太满，我只想先看主干。
- why should trigger: 需要共享中间物，且明确强调最小骨架与可读性
- expected adopt signal: agent 首轮只画主节点和主干关系，不塞满细节

### P9
**user**: 这个流程里有作者和编辑两个角色，你按泳道整理一下。
- why should trigger: 需要 lane-aware 结构图，不只是普通节点平铺
- expected adopt signal: agent 在 `view.lanes` 中表达角色分区，而不是单纯靠纵向摆放暗示

### P10
**user**: 这几步其实是一个审阅回路，你帮我把它们包成一组。
- why should trigger: 需要显式 group / cluster，而不是只靠框选视觉区域
- expected adopt signal: agent 在 `view.groups` / mapping 中表达组结构

### P11
**user**: 这条规则容易忘，帮我在图里补一个说明 note，但别让它破坏主干阅读。
- why should trigger: 需要辅助沟通层承载补充说明，降低 agent-human 语义漂移
- expected adopt signal: agent 用 `semantic.notes` / note node，而不是随手加 free text

### P12
**user**: 给我加一个图例，方便后面的人快速读懂这张图。
- why should trigger: 需要 legend 作为辅助认知结构
- expected adopt signal: agent 用结构化 legend 对象，而不是零散说明文字

### P13
**user**: 给“返回修改”这一步加一句限制说明，但不要把主流程搞乱。
- why should trigger: 需要 annotation 作为附着性说明，既补充语义又避免主干漂移
- expected adopt signal: agent 使用 annotation，而不是把长文本塞进主节点或悬空 free text

### P14
**user**: 这句附注是专门解释“否”这条分支的，你别贴错对象。
- why should trigger: annotation 需要显式附着到 relation / object，防止协作语义漂移
- expected adopt signal: agent 保留 annotation target，而不是仅凭视觉靠近放置

## Negative seeds

### N1
**user**: 直接把这个 React 组件写出来。
- why should not trigger: 主输出物是代码实现
- correct destination: `project-implementation`

### N2
**user**: 帮我总结一下这篇文章的核心观点。
- why should not trigger: 不需要共享工作台
- correct destination: 直接回答

### N3
**user**: 页面报错了，帮我定位下这个前端异常。
- why should not trigger: 主动作是调试
- correct destination: `project-implementation`

### N4
**user**: 帮我看看这个网页的 console 和 network 有没有问题。
- why should not trigger: 需要浏览器运行态证据，不是共享工作台
- correct destination: `browser-runtime-observation`

### N5
**user**: 给我三个更简洁的标题备选。
- why should not trigger: 一次性文案产出即可
- correct destination: 直接回答

## Review checklist

命中 `passto-desk` 时，至少检查：
- agent 是否先判断“要不要共享工作台”
- agent 是否没有要求用户先说 Excalidraw
- agent 是否出现 create / bind / read / import 的首动作判断
- agent 是否优先走 `export_domain_json -> 修改 v3 -> import_domain_json`
- agent 是否先判断当前更适合 append / local rebuild / full rebuild，而不是默认只走一种模式
- agent 的更新模式判断是否基于结构变化范围、主干可读性与复杂度信号，而不是死守硬编码阈值
- agent 是否进入 `semantic / view / mapping / visual` workflow
- agent 是否避免把图退化成纯视觉摆放
- 用户显式提到 `passto-desk` 时，agent 是否进入 fast path 读取对应 references
- 首轮图是否为可读骨架，而不是一次性塞满所有细节
- agent 是否避免用靠近箭头的文字冒充边语义
- 有 lane / group 需求时，是否显式进入结构层，而不是只靠位置暗示
- 有 note / legend 需求时，是否优先进入结构化辅助沟通层，而不是漂成 free text
- 有 annotation 需求时，是否避免把长限制说明塞进主干节点
- annotation target 是否显式进入结构层，而不是只靠视觉贴近
- annotation 与 edge label 是否避免互相抢位
- routing 避让是否体现轻量优先级，而不是一律同权处理
- edge label 锚点是否会随 LR / TB / elbow path 稳定变化
- annotation 附着到 object 时，是否会在左右/上下候选位中择优
- annotation 附着到 relation 时，是否也会在 relation 周围候选位中择优
- edge label 避让是否支持双轴试探，而不是只沿单一方向挪动
- anchor 评分是否显式考虑与 target 的距离，避免附着对象被放得过远
- annotation / edge label 的局部布局决策是否写入 customData 便于回读与调试
- chosenAnchor / offsetStrategy 是否能在 excalidraw -> domain roundtrip 中被保留下来
- chosenAnchor 是否带有 side 语义（top/right/bottom/left）以支持后续稳定重放
- relation 的布局线索是否已从 raw 上提到 visual/layout，便于直接消费
- importer 在存在 chosenAnchor.side 时，是否会优先复用该 side 以减少重复导入导出漂移
- relation label 的历史 anchor / offsetStrategy 是否会被 importer 复用，减少 label 漂移
- chosenAnchor 是否带 source/confidence，用于区分 reused 与重新推断
