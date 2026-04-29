# Planner Bootstrap Implementation Context

## Purpose

This document is the temporary manual orchestration context for the first `passto-planner` bootstrap implementation slice.

It exists because the planner is not yet fully implemented as the producer of `.passto-ai/project.md`, planner design artifacts, and phase/task documents.
Until that planner-native loop exists, this directory acts as an artificial bootstrap driver for the first implementation phase.

---

## Current posture

We are implementing the new planner bootstrap in:
- `extensions/passto-planner/`

The planner must be reintroduced as:
- a frame-native workflow-backed planner executor
- running through `passto-executor`
- capable of bounded nested expert execution
- owner of synthesis, artifact writing, and planner→builder handoff shaping

The implementation is intentionally scoped to the first meaningful vertical slice.

---

## Relevant design sources

Preserve and align with these design documents:
- `~/passto-ai-frame/DESIGN.md`
- `~/passto-ai-frame/passto-planner/CURRENT_PLANNER_ANALYSIS.md`
- `~/passto-ai-frame/passto-planner/PLANNER_EXECUTOR_SPEC.md`
- `~/passto-ai-frame/passto-planner/PLANNER_BUILDER_HANDOFF_SPEC.md`
- `~/passto-ai-frame/passto-planner/PLANNER_IMPLEMENTATION_ROADMAP.md`
- `~/passto-ai-frame/passto-planner/PLANNER_BOOTSTRAP_LAYOUT.md`
- `~/passto-ai-frame/passto-planner/LEGACY_PLANNER_MIGRATION_MAP.md`
- `~/passto-ai-frame/passto-planner/NESTED_EXECUTOR_FEASIBILITY_NOTE.md`
- `~/passto-ai-frame/passto-planner/PLANNER_NESTED_EXECUTION_VALIDATION_PLAN.md`
- `~/passto-ai-frame/passto-planner/PLANNER_BOOTSTRAP_TASK.md`
- `~/passto-ai-frame/passto-planner/PLANNER_BOOTSTRAP_IMPLEMENTATION_CUT_PLAN.md`
- `~/passto-ai-frame/passto-planner/PROJECT_WORKSPACE_PROTOCOL.md`

---

## Shared project workspace protocol

The planner bootstrap should target the shared project-local workspace rooted at:
- `<cwd>/.passto-ai/`

Expected shared structure:

```text
<cwd>/
  .passto-ai/
    project.md
    planner/
      design/
      task/
    executor/
    builder/
```

Current ecosystem status:
- `passto-executor` now ensures the `.passto-ai/` directory structure exists before execution.
- compatibility/root executor entrypoints now default persisted run artifacts into `<cwd>/.passto-ai/executor/`.
- `passto-builder` now defaults builder-owned note/report artifacts into `<cwd>/.passto-ai/builder/`.
- `passto-planner` is the missing producer of project metadata and planner-owned design/task artifacts.

---

## First bootstrap objective

Implement the first narrow but real planner slice that proves:
1. planner runs through a frame-native runtime path
2. planner launches one bounded expert child perspective run
3. planner receives the child result
4. planner writes planner-owned synthesis artifacts
5. planner emits a structured planner result with parent/child run linkage
6. planner emits an initial planner→builder handoff artifact

Recommended first expert perspective:
- `technical-architecture`

Supported planning types from the start:
- `standalone-product`
- `pi-ecosystem-product`

---

## Expected planner-owned artifacts for cut 1

The first implementation cut should produce at least:
- `.passto-ai/planner/design/analysis.md`
- `.passto-ai/planner/design/planner-perspective-synthesis.md`
- `.passto-ai/planner/design/planner-handoff.json`

These are planner-owned outputs.
The child expert run may provide findings, but it must not own the planner synthesis artifact or directly advance the planner workflow.

---

## Temporary bootstrap input posture

This `builder/` directory exists only as a temporary bootstrap driver while planner-native artifact production is not yet available.

The files here are manual transition inputs:
- `builder-input.json`
- `executor-request.json`
- `implementation-context.md`

They should be treated as:
- short-lived bootstrap scaffolding
- explicit documentation of the first implementation mission
- not the final planner UX or production protocol

Long-term target:
- planner itself should produce and maintain `.passto-ai/project.md`
- planner itself should produce `.passto-ai/planner/design/` outputs
- planner itself should produce phase-first task specs under `.passto-ai/planner/task/`
- builder and executor should consume those planner-produced artifacts directly

---

## Implementation boundaries

In scope for the first planner cut:
- minimal planner contracts
- planning type boundary
- one perspective definition
- nested child execution bridge
- nested-execution guards
- planner-owned synthesis writing
- structured planner result
- planner→builder handoff artifact
- command/tool entry surface
- focused seam tests and one vertical-slice test

Out of scope for this cut:
- full legacy workflow migration
- many-perspective optimization
- deep interview loops
- review loops
- full task-package pipeline
- complete `.passto-ai/project.md` authoring flow
- broad executor rewrites

---

## Deliverable posture

The planner bootstrap should be implemented as a real frame-native extension slice under:
- `extensions/passto-planner/`

It should preserve a credible migration path toward:
- project-local planning metadata
- phase-first task decomposition
- planner-managed downstream builder handoff
- bounded nested expert execution under executor control
