# P0 Minimal Rebuild Design

状态：draft
日期：2026-05-21
范围：passto-desk 主线能力设计
目标：定义结构级重建能力的 P0 最小可执行版本，并明确 room-first / trusted-domain 两条 rebuild path 的 contract、失败处理与 proof 标准。

---

## 1. Why

P0 重建能力的目的，不是“重新画图”，而是解决共享工作台长期演化后，局部 patch 不再是最低总成本的问题。

具体来说，重建能力存在的目的有四个：

1. **让当前语义重新主导画布**
   - 避免历史图元布局继续绑架当前结构表达。
   - 当图经过多轮 append / human 手工调整 / annotation 增长 / relation 扩散后，需要一次受控重投影恢复结构主导权。

2. **吸收人类已经在共享画布上做过的有效修改**
   - 重建前不能默认信任旧 domain v3。
   - 如果人类已经在 room 上补了 note、annotation、relation、group、lane 或调整了结构标签，系统应优先考虑当前 room 是否包含更新事实。

3. **在 append 与 full replace 之间建立可控更新层**
   - P0 不做 element-level surgery。
   - 但需要提供一个结构主导、受控重建的能力层，避免系统只能在 append 和 full rebuild 之间二选一。

4. **保证 domain / scene / runtime state 一致**
   - 重建不是单纯“改 room”。
   - 必须形成：结构状态 → scene 投影 → room 写入 → 回读验证 的闭环。

---

## 2. What

P0 要实现的，不是任意局部 patch，而是：

## agent-first structural rebuild

能力定义：
- 输入一个当前工作台状态
- 先确定当前结构真相源
- 在结构层应用修改
- forward 生成目标 scene
- replace 写回 room
- 回读验证一致性

### 非目标

P0 暂不处理：
- 在当前 scene 上做 element 级局部 surgery
- 保留复杂人工微调布局完全不变
- 自动合并多人并发冲突
- 高精度视觉 diff / merge
- 多 scope 并行重建

---

## 3. Path 对比结论

### Path A：pure domain-first rebuild

Flow：
1. 读取已有 domain v3
2. 修改 domain v3
3. forward transform
4. replace 到 room

优点：
- 最简单
- proof 最容易
- 与“domain 是 agent 主真相源”口径一致

风险：
- 容易覆盖 room 上尚未回写的人类修改
- 对共享协作场景过于理想化

适用：
- 单 agent 连续操作
- 用户明确要求覆盖 room
- 已知当前 room 没有新的人工修改

---

### Path B：room-first rebuild

Flow：
1. export 当前 room 的 domainJson
2. 在导出的 domain 上应用结构修改
3. forward transform
4. replace 到 room
5. export 验证

优点：
- 最能吸收人工新改动
- 最符合共享工作台现实
- 当前已有工具面基本支持

风险：
- reverse fidelity 不足时会带来歧义
- 人工纯视觉微调可能被 forward 重排覆盖

适用：
- 默认共享协作场景
- room 可能被人类改过
- 不确定当前本地 domain 是否过时

---

## 4. P0 默认策略

P0 默认主路径应为：

## room-first reconcile -> structural modify -> forward transform -> replace room

即：
1. 获取当前共享画布现状
2. reverse / export 成当前结构化状态
3. 在该结构化状态上进行修改
4. forward transform 生成目标 scene
5. replace 到 room
6. 输出验证结果与必要 warnings

### 只有满足以下条件时，才允许 trusted-domain path：
- 用户明确要求以当前 domain 为准覆盖 room
- 当前轮上下文明确说明没有人工改动
- 或系统已有可信 freshness 信号证明 domain 未过时

---

## 5. 人类调整画布时的设计判断

### 人类只做视觉位置调整
示例：
- 挪节点位置
- 调 annotation 位置
- 调局部间距

判断：
- 这些信息更偏 visual / layout
- room-first path 仍优于 trusted-domain path
- 但 forward 可能覆盖掉人工细调布局

结论：
- P0 不承诺保留人工微调布局
- P0 优先保证结构语义一致与主干可读性

### 人类新增结构信息
示例：
- 加 note / annotation
- 补新 relation
- 加 group / lane
- 改 label

判断：
- 这些信息必须优先吸收进结构层
- room-first path 明显优于 trusted-domain path

### 人类做了非规范涂改
示例：
- free text
- 没绑定的箭头
- 大矩形乱框
- 无 target 的说明文字

判断：
- reverse 结果可能出现 ambiguity
- 此时仍应先 reverse / export，但需要 warning / conflict detection / human confirm

---

## 6. P0 最小 scope

P0 支持：
- 当前已绑定 room
- 从当前 room 导出结构化状态
- 在结构化状态上做修改
- 重新生成 scene
- replace 写回 room
- 再导出校验

P0 暂不支持：
- 真正局部 scene patch
- 复杂人工布局保真 merge
- 自动多人并发合并
- 高精度 visual diff

### scope 设计原则

P0 可以先引入 scope 概念，但第一版不做局部 scene patch。

scope 先用于：
- 约束修改的是哪块结构
- 约束验证期望
- 给未来 local rebuild 留接口

建议 scope：
- `full`
- `object-set`
- `lane`
- `group`

### P0 写回策略

即使 scope 是 `lane` / `group` / `object-set`，P0 第一版仍统一：
- 在结构层只修改该 scope
- forward 时生成整图
- 最后整图 replace 到 room

这不是“假局部重建”，而是：
- 局部修改发生在结构层
- 视觉写回仍采用最稳定的整图重投影策略

---

## 7. pre-rebuild check

在真正重建前，P0 至少要做一个简化判断：

1. 当前 room 是否存在？
2. 是否能成功 `export_domain_json`？
3. reverse 结果是否可消费？
4. warnings / ambiguities 是否过高？
5. 这次是否允许覆盖人工修改？

如果上述任一项不满足，P0 不应直接写回。

---

## 8. 最小 contract 提议

### RebuildRequest

```ts
type RebuildRequest = {
  mode?: "room-first" | "trusted-domain";
  scope?: {
    kind: "full" | "object-set" | "lane" | "group";
    ids?: string[];
  };
  baseDomainJson?: string;
  modify: {
    kind: string;
    payload: unknown;
  };
  verifyAfterWrite?: boolean;
};
```

### RebuildResult

```ts
type RebuildResult = {
  modeUsed: "room-first" | "trusted-domain";
  precheck: {
    warningCount: number;
    ambiguityCount: number;
    freeTextCount: number;
    acceptable: boolean;
  };
  beforeDomainJson: string;
  afterDomainJson: string;
  writeResult: unknown;
  postCheck?: {
    nodeCount: number;
    edgeCount: number;
    warningCount: number;
    consistent: boolean;
  };
};
```

### 说明

P0 第一版不建议开放通用 patch DSL。

更稳的做法是：
- 先支持“传入一个已修改好的完整 domainJson”
- 或支持“替换某个 scope 的 domain block”

也就是说，P0 第一版更接近：

> rebuild from normalized domain input

而不是：

> 让 runtime 自己理解任意开放式增删改

---

## 9. 失败与歧义处理

### 直接失败
- 未绑定 room
- `export_domain_json` 失败
- reverse 输出不是合法 domain v3
- forward transform 失败
- `import_domain_json` 失败

### soft-fail / 需确认
- ambiguityCount 明显偏高
- freeTextCount 过高
- warnings 表明结构绑定不可靠
- 用户很可能做了大量非规范手工编辑

### 建议行为
- 返回可读的风险说明
- 不自动写回
- 建议 human confirm 或 review 后再 full rebuild

---

## 10. Proof 标准

### 功能 proof
1. 能从当前 room 导出 domain
2. 能在导出 domain 上做一次结构修改
3. 能 forward 成 scene
4. 能 replace 写回 room
5. 能再次导出并确认修改已持久化

### 一致性 proof
至少检查：
- nodeCount / edgeCount 符合预期
- 修改目标已生效
- warningCount 未异常飙升
- roundtrip 后 domain 仍可解析

### 协作态 proof
至少覆盖一个场景：
- 人类先在 room 上做结构性修改
- agent 再走 room-first rebuild
- 人类修改不会被无意忽略

---

## 11. P0 实现拆解建议

### Step 1：内部 rebuild helper
先实现内部 helper，而不是先暴露复杂外部 action。

建议概念分层：
- `prepareRebuildBase(...)`
- `applyStructuralModification(...)`
- `executeRebuild(...)`
- `verifyRebuild(...)`

### Step 2：room-first 主路径
实现：
- export current domain
- modify domain
- import domain
- export verify

### Step 3：trusted-domain 快速路径
实现：
- use provided domain
- import domain
- verify

### Step 4：最小 smoke / fixture proof
增加一组最小验证：
- 无人工改动场景
- 有人工结构性改动场景

---

## 12. 最终结论

P0 正确形态不是：
- element 级局部 patch
- scene 直接 surgery

而是：

## 结构层局部修改 + 整图重投影 + room replace

并且默认采用：

## room-first reconcile -> modify -> forward -> replace

一句话总结：

> P0 最小实现应优先信当前共享 room 的可回读结构状态，而不是盲信旧 domain；先 reverse/export 当前现状，再在结构层修改，再整图 forward replace 写回 room，以此实现可执行、可验证、对人类改动更稳的结构级重建能力。
