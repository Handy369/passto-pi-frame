# Project Definition Child Skill Bindings

## 目标

说明 `project-definition` 如何把外部子 Skill 与内部 references 绑定为父 Skill 六段骨架中的局部强化器。

唯一骨架仍然是：

```text
Why → What → Structure → Flow → Surface → Runtime Proof
```

这些绑定不是第二结构，而是父 Skill 在不同节点调用的强化路径。

---

## 一、Why / What 前段强化

### `idea-refine`
路径：`/Users/handy/.claude/skills/idea-refine/SKILL.md`

#### 何时绑定
- 用户只有粗糙想法
- 需要从 idea 走到 problem framing
- 需要澄清用户是谁、成功是什么、MVP 是什么

#### 强化什么
- Why：为什么值得做
- What：要解决的核心问题、MVP、not doing

#### 不该替代什么
- 不替代完整 spec
- 不替代 implementation plan

---

## 二、What / Structure 强化

### `spec-driven-development`
路径：`/Users/handy/.claude/skills/spec-driven-development/SKILL.md`

#### 何时绑定
- 要开始写 PRD / spec / scope / acceptance criteria
- 需求仍有假设、边界、成功标准未写清

#### 强化什么
- What：定义目标、用户、成功标准
- Structure：spec 文档骨架
- Flow：spec → plan → tasks → implement 的前置顺序

#### 不该替代什么
- 不替代 discovery / research
- 不直接承担 implementation

---

## 三、Flow / Surface 强化

### `planning-and-task-breakdown`
路径：`/Users/handy/.claude/skills/planning-and-task-breakdown/SKILL.md`

#### 何时绑定
- spec / scope 已足够清楚
- 需要切 implementation plan
- 需要 task list / checkpoint / dependency graph

#### 强化什么
- Flow：顺序、依赖、checkpoint、parallelization
- Surface：plan 文档 / task list / checkpoint 作为可交付物

#### 不该替代什么
- 不替代前期 spec 澄清
- 不在 spec 仍模糊时过早调用

---

## 四、内部 references 与子 Skill 的关系

### references 是什么
内部 references 是父 Skill 的方法材料与子路径说明。

### 子 Skill 是什么
子 Skill 是父 Skill 在某些节点调用的外部局部强化器。

### 绑定原则
- 先按当前主输出物选一个主 reference
- 只有当 reference 不足以稳定收敛当前节点时，才绑定一个子 Skill
- 不要一开始同时绑定多个子 Skill

---

## 五、最小绑定顺序

### 想法很糊
`discovery.md` → 必要时 `idea-refine`

### 要出 spec
`spec-and-scope.md` → 必要时 `spec-driven-development`

### 要切实施计划
`handoff-and-implementation-plan.md` → 必要时 `planning-and-task-breakdown`
