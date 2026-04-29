# Project Overview

## Primary Project
- Name: `passto-planner`
- CWD: `/Users/handy/dev/pi-sandbox`
- Main implementation root: `extensions/passto-planner`
- Project role: internal planner executor running inside the `passto-executor` container

## Required Background Contexts
This project must be understood through **two background layers**:

1. **`passto-planner` itself**
2. **the broader `passto-framework` architecture**

The builder/executor child should treat both as required context, not optional reference material.

---

## Background Layer A: passto-planner

### What `passto-planner` is
`passto-planner` is an internal planner executor used to turn target inputs into structured product/planning artifacts.

Its intended workflow includes:
- analysis
- research
- interview
- spec synthesis
- plan generation
- review
- section generation

### Current verified state of passto-planner
Already true:
- lifecycle/session bridge is implemented
- planner docs / prompts have been aligned to the container-executor architecture
- Step 4 / Step 9 orchestration semantics have been corrected

Not yet true:
- Step 4 research happy-path is not truly implemented
- Step 9 review happy-path is not truly implemented
- Step 10 integration happy-path is not truly implemented

### Current implementation gap
The key gap is that `passto-planner` still lacks a **minimal real nested orchestration strategy**.

At present:
- `planner/workflow.ts` is still scaffold-oriented
- `planner/nested-execution.ts` is still placeholder-oriented
- real research/review/integration artifact generation is not yet wired

### Current implementation target
The current implementation target is only:
- expand planner nested execution contracts
- add one real nested execution strategy
- implement the Step 4 minimal research path
- generate real `passto-research.md`

Do **not** implement in this run:
- Step 9 review
- Step 10 integration
- full planner workflow completion
- section-writing orchestration
- advanced orchestration framework generalization

---

## Background Layer B: passto-framework

### What `passto-framework` means here
`passto-framework` refers to the broader frame architecture documented in `~/passto-ai-frame`, especially the container / executor / internal-mode hierarchy.

### Current framework architecture
The correct architecture is:
- `passto-executor` is the only public execution container
- `passto-planner`, `passto-builder`, and future `passto-review` are internal executors
- `stage` is the seam used to select which internal executor runs inside the container
- executors are not public entrypoints
- executors do not run independently of the container
- `lib/passto-agent-runtime` is the runtime carrier layer

### Important boundary rules
- `passto-executor` is a **container**, not a peer executor
- `passto-builder` is internal-only
- `passto-planner` is internal-only
- executor-internal orchestration must not be described as a concrete host-tool contract
- implementation carrier choices may vary, but planner semantics must remain planner-internal

### Why this framework context matters for the current task
The current Step 4 implementation must not accidentally:
- re-expose builder/planner as public tools
- collapse executor vs executor-internal orchestration boundaries
- hardcode a host tool name as the workflow contract
- over-design a generic orchestration system before the first minimal real path exists

---

## Current Goal
Implement the first minimal real planner-internal orchestration path for `passto-planner` Step 4 research.

### Concrete scope
Only implement:
- planner nested execution contract expansion
- one real nested execution strategy
- Step 4 minimal research execution path
- real generation of `passto-research.md`

### Out of scope
Do not implement:
- Step 9 review
- Step 10 integration
- full 17-step planner workflow
- section-writing orchestration
- advanced steering / retry / generalized orchestration framework

---

## Reference Documents
Primary execution plan:
- `/Users/handy/passto-ai-frame/passto-planner/0429/Step4-minimal-research-builder-execution-plan.md`

Supporting project-status background:
- `/Users/handy/passto-ai-frame/passto-planner/0429/当前现状与后续整体计划.md`

Supporting framework-architecture background:
- `/Users/handy/passto-ai-frame/0429架构进展总结.md`

---

## Required Builder Outcome
A successful implementation run should produce:
- code changes for the Step 4 minimal research path
- validation evidence that `passto-research.md` is really generated
- a concise summary of changed files and remaining placeholder areas

---

## Important Constraints
- Preserve the container / executor / internal-orchestration boundary.
- Treat `passto-planner` as the primary project context.
- Treat `passto-framework` as the required architecture context.
- Do not reintroduce internal executors as public entrypoints.
- Do not write workflow contracts in terms of concrete host tool names.
- Keep the implementation minimal and low-risk.
- Prefer a real minimal closed loop over broad abstraction.