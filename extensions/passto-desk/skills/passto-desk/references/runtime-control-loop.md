# Runtime Control Loop / Forward & Reverse Transform

状态：draft
目的：为 passto-desk 提供运行策略层的骨架说明，连接上层 runtime model 与当前 skill / script 执行面。

---

## 1. 角色定位

本文件不定义系统本体；系统本体见 docs 中的 runtime model。

本文件只回答：
- forward transform 在运行时如何推进
- reverse transform 在运行时如何推进
- parse / validate / persist / inject 如何形成 control loop
- 何时 stop / retry / rebuild / escalate

---

## 2. 两条 transform 路径

### Forward transform
适用于：
- 从用户文本 / 会话信息 / 文件信息出发
- 提取语义对象与关系
- 再投影成 Excalidraw 视图

最小顺序：
1. assemble information
2. extract semantic objects / relations
3. decide current mode / view scope
4. map semantic state to visual state
5. generate or update scene
6. validate result
7. persist state
8. inject into next round if needed

### Reverse transform
适用于：
- 从 Excalidraw scene / 共享白板现状出发
- 回译出语义对象与关系
- 再注入上下文、更新状态与持久化

最小顺序：
1. read scene
2. extract scene signals
3. reconstruct semantic objects / relations
4. detect ambiguities / conflicts
5. update semantic state
6. validate reconstruction
7. persist state
8. inject into next round if needed

---

## 3. Control loop

passto-desk 的可靠性不应主要依赖单次输出，而应依赖以下闭环：

1. parse
2. validate
3. persist
4. inject
5. decide next round

### 当前最小落地映射

上述 control loop 在当前仓库里已经有最小可执行落地，核心 helper 位于：
- `scripts/runtime-contracts.mjs`

当前最小结构包括：
- `SharedSemanticState`
- `TransformOutput`
- `ValidationResult`
- `NextRoundDecision`

当前最小提交点是：
- `commitTransformResult(...)`

它负责把 transform 结果推进为：
- shared state snapshot
- merged state
- validation result
- next-round decision

也就是说，当前 runtime 不再只有抽象策略，而已经具备最小可执行 contract。

### parse
要求：
- 当前轮产出必须能被结构化读取
- 不允许只留下无法进入下一轮的模糊 prose

### validate
至少检查：
- semantic state 是否成形
- 当前 transform 是否完成了本轮目标
- scene / mapping / relation 是否存在明显冲突
- 是否需要 fallback / rebuild / human confirm

### persist
至少明确：
- 什么写回 domain JSON
- 什么写回 scene / .excalidraw
- 什么只作为临时控制状态保留

### inject
要求：
- 下一轮上下文不应只继承原文本
- 应注入本轮更新后的 semantic / control state

### decide next round
可能决策：
- stop
- continue
- retry
- local rebuild
- full rebuild
- escalate to human review

### 当前标准验证入口

当前最小闭环的标准回归入口：

```bash
npm run runtime:smoke
```

它会顺序验证：
- merge
- commit
- reverse transform
- forward transform

---

## 4. 与 Explain-first / Workbench 的关系

### Explain-first
优先：
- 快速形成可读主干
- 先完成 semantic core 的最小稳定表达
- scene 可首轮简化，但主干应 mechanism-first

### Workbench
优先：
- semantic / mapping / visual 稳定
- scene 与 domain 持续可回读、可重建
- control loop 更强调持久化与后续迭代可靠性

---

## 5. 当前后续待落地到 scripts 的部分

本文件先只做策略骨架；以下内容后续应进入 scripts / contract：
- shared state shape
- forward transform I/O contract
- reverse transform I/O contract
- parse / validate / persist / inject contract
- control metadata shape
