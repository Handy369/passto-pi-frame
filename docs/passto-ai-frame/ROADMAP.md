# Passto AI Frame Roadmap

## Purpose

This roadmap summarizes what has already been completed in `passto-executor`, how that maps onto the broader `passto-ai-frame` design, and what should happen next.

## Completed foundation phases

### Phase 1 — Execution skeleton
Delivered:
- `task.md` parsing
- invocation shaping
- context assembly
- runtime abstraction
- initial event/result model
- run-store and sandbox seams

Meaning:
- the executor stopped being an idea and became a structured execution skeleton

### Phase 2 — Minimally functional execution container
Delivered:
- stronger parser behavior
- typed run store
- file-backed persistence
- real temp-copy sandboxing
- `single` / `sequential` / `parallel` orchestration
- cleaner runtime-policy mapping

Meaning:
- the executor became usable as a real, if still narrow, execution container

### Phase 3 — Integration-ready execution substrate
Delivered:
- execution factoring and runtime-param builder
- bounded concurrency
- dependency metadata and DAG validation
- richer orchestration events
- pluggable sandbox strategy layer
- richer persistence/readback
- first real compatibility adapter flow

Meaning:
- the executor became more credible as a reusable platform layer

### Phase 4 — Platform hardening
Delivered:
- real bounded DAG execution
- real worktree sandbox strategy
- broader compatibility migration surface
- narrower and more stable API/export surface

Meaning:
- the executor became a stronger platform component instead of only a runtime experiment

### Phase 4.1 — Runtime parity investigation
Delivered:
- a direct investigation into Ralph/subagent child-runtime parity
- evidence that `runSubagent(...)` can execute a real Ralph loop when configured correctly
- root-cause narrowing to profile/tool-surface shaping rather than “fundamentally incapable runtime”
- clarified executor lifecycle posture: process-oriented, `process-exit` owned by executor

Meaning:
- the remaining runtime boundary is much clearer and product claims can now be sharper and more honest

## Current state

The project now has:
- a credible execution substrate in `passto-executor`
- an explicit process-oriented runtime posture
- isolated execution through worktrees
- bounded compatibility support
- tests and docs that largely match the real implementation state

The project does **not** yet have a fully built top-layer frame around:
- presets / role catalogs
- richer resolved-context policy
- builder/operator workflows
- self-hosted orchestration loops

## Recommended next phase

## Phase 5 — Frame-level orchestration and productization

Primary goal:
- move from “strong execution substrate” to “usable frame-level system”

Suggested workstreams:

### Workstream A — Invocation and resolved-context policy
Focus on:
- defining the minimal upstream invocation contract
- clarifying which fields come from caller vs preset vs executor defaults
- introducing clearer preset / role / model / skill resolution rules

### Workstream B — Frame-level orchestrator flow
Focus on:
- how an orchestrator or builder composes work into executor invocations
- how run artifacts/events are consumed upstream
- how task-doc execution and direct invocation execution coexist cleanly

### Workstream C — Builder/operator bootstrap path
Focus on:
- one realistic builder-style workflow
- one operator-style workflow
- end-to-end artifact feedback loops using executor outputs

### Workstream D — Executor parity hardening
Focus on:
- end-to-end Ralph-loop coverage through executor-managed runs
- spawn vs fork parity checks where useful
- profile/tool-surface regression guards

### Workstream E — Documentation and interface productization
Focus on:
- public-facing frame docs
- clearer package roles and boundaries
- examples that show the full frame stack, not only executor internals

## Recommended continuation order

1. document frame-level architecture in the repository
2. define a formal Phase 5 plan
3. implement one vertical orchestrator -> executor -> artifact feedback example
4. deepen executor-side runtime parity coverage
5. only then expand broader frame capabilities

## One-line roadmap summary

Phases 1–4.1 established `passto-executor` as the first mature foundation of `passto-ai-frame`; the next step is Phase 5, where the surrounding frame-level orchestration, preset resolution, and builder/operator workflows become first-class implementation targets.
