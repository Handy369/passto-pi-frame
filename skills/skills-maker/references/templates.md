# Templates

以下模板都共享同一六段骨架。差异只在 Flow / Surface 的形状展开上。

---

## 1. 通用 Skill Skeleton Card

```md
# Skill Skeleton Card

- target skill:
- task mode: create / refactor / audit

## Why
- why this skill exists:
- uncertainty compressed:
- where agent drifts without it:
- value improved:

## What
- main goal:
- main deliverable:
- adjacent work it does not own:
- non-goals:

## Structure
- required files:
- optional files:
- forbidden files:
- runtime surface files:
- external validation assets:

## Flow
- trigger:
- first read / first action:
- workflow:
- handoff:
- stop condition:

## Surface
- entry file:
- externalized materials:
- output carrier:
- minimal read path:

## Runtime Proof
- proof types:
- first thing to verify:
- black-box signals:
- allowed semantic variants:
- forbidden narrow literals:
```

---

## 2. 局部强化型快捷模板

```md
# Local-Strengthening Skill

## Why
- compress one bounded uncertainty:
- stop one common local drift:

## What
- one bounded workstream:
- narrow deliverable:
- adjacent tasks not owned:

## Structure
- usually small SKILL.md
- references only when needed
- explicitly forbid empty scaffolding

## Flow
- narrow trigger
- short adopt path
- finish after one bounded outcome

## Surface
- small entry surface
- narrow output contract
- minimal read path

## Runtime Proof
- route correctness
- bounded-work adopt
- no adjacent false positive
```

---

## 3. 组合编排型快捷模板

```md
# Orchestrated-Composite Skill

## Why
- stabilize a complex goal through coordinated methods:
- prevent drift across neighboring subpaths:

## What
- complex top-level deliverable:
- multiple subpaths:
- which subpaths are not top-level entry points:

## Structure
- router SKILL.md
- references / child materials only when they change route or adopt
- optional templates / checklists
- forbid decorative references with no runtime value

## Flow
- top-level route
- choose minimal subpath
- handoff between submethods
- explicit stop condition per path

## Surface
- router + path map
- clear entry and minimal read order

## Runtime Proof
- stable routing
- reasonable subpath selection
- clear handoff
- better overall delivery quality
```

---

## 4. 多输入同构型快捷模板

```md
# Multi-Input Homomorphic Skill

## Why
- reuse one stable method across many input types:
- prevent output drift caused by surface-level input variation:

## What
- one output shape over multiple input types:
- explicitly name unsupported input classes:

## Structure
- one skill
- one common workflow
- optional per-input notes only when needed

## Flow
- many inputs
- same core processing logic
- consistent output contract

## Surface
- multiple input entry cues
- unified external output form

## Runtime Proof
- workflow consistency across inputs
- output consistency across inputs
- no unsupported hidden input class
```

---

## 5. Boundary Pack

```md
# Boundary Pack

- target skill:
- current main output:
- current main action:
- adjacent skills / workflows:

## should-not-trigger
- request type:
- why not:
- correct destination:

## should-trigger
- request type:
- why yes:
- expected adopt signal:

## non-goals
- even if hit, do not expand into:

## first action after hit
- first read / first decision / first deliverable:

## positive examples
- example:
  - why should trigger:
  - expected adopt signal:

## negative examples
- example:
  - why should not trigger:
  - correct destination:
```

---

## 6. Structure Decision Table

```md
# Structure Decision Table

| artifact | status(required/optional/forbidden) | runtime or external | why it exists / why absent | owner behavior it changes |
|---|---|---|---|---|
| SKILL.md |  | runtime |  |  |
| references/ |  | runtime or external |  |  |
| templates/ |  | runtime or external |  |  |
| scripts/ |  | runtime or external |  |  |
| checklists/ |  | runtime or external |  |  |
| validation/runtime-proof.md |  | external |  |  |
```

使用规则：
- 不能全写 `optional`
- 至少要有一项明确 `forbidden` 或“无需生成”的说明，避免骨架膨胀
- `validation/runtime-proof.md` 默认视为外部验证资产，不自动进入 runtime surface

---

## 7. Output Contract Card

```md
# Output Contract Card

- target skill:
- task mode: create / refactor / audit
- one-line definition:
- final deliverable:
- what counts as adopt:
- what does not count as complete:
- minimum required artifacts:
- structure decision summary:
- proof plan:
- regression check after change:
```

---

## 8. Drift Audit Card

```md
# Drift Audit Card

- target skill:
- current drift symptoms:
- missing boundary elements:
- missing structure decisions:
- missing adopt / proof signals:
- smallest repair order:
- how to verify no regression:
```

---

## 9. Runtime Proof Card

```md
# Runtime Proof Card

- target skill:
- first thing to verify:
- proof types:
- black-box signals:
- allowed semantic variants:
- forbidden narrow literals:
- shape-specific risk:
- external verification asset needed?: yes / no
```
