# Passto Executor / Passto AI Frame Phase 5 Plan

## Purpose

Phase 5 should begin after the completion of Phase 4 and Phase 4.1.

Its job is not to reopen Phase 4 platform hardening work item by item.
Its job is to use the now-stable `passto-executor` substrate as the execution foundation for the next layer of `passto-ai-frame`.

## Starting point

Already complete:
- task-doc-driven execution
- invocation -> assembly -> execution path
- real multi-perspective orchestration including bounded DAG execution
- real sandbox strategies including worktree isolation
- file-backed persistence and run inspection
- bounded compatibility support
- narrowed package entrypoints
- clarified executor runtime posture as process-oriented

This means Phase 5 can assume a credible execution substrate exists.

## Phase 5 goal

Turn `passto-executor` from a strong execution substrate into the execution foundation of a more visible frame-level workflow system.

In short:
- less emphasis on internal executor capability expansion for its own sake
- more emphasis on how frame-level callers shape, launch, inspect, and iterate on work through the executor

## Non-goals

Phase 5 should not start by doing any of the following:
- broad runtime rewrites without a proven failure mode
- re-litigating whether executor should be process-oriented
- promising full parity for every child-runtime scenario up front
- collapsing back into a legacy `subagent` shell design
- turning compatibility into a vague full-history emulation layer

## Main workstreams

### Workstream A — Invocation contract and resolved-context policy

#### Objective
Clarify the contract between frame-level callers and `passto-executor`.

#### Questions to answer
- What is the smallest stable invocation shape that an orchestrator/builder should construct directly?
- Which fields should come from:
  - caller input
  - presets/roles
  - executor defaults
  - runtime policy
- Where should agent/model/skill/tool-surface policy be resolved?
- How should task-doc execution and direct invocation execution align?

#### Deliverables
- invocation contract note
- resolved-context policy note
- examples of task-doc path vs direct invocation path

### Workstream B — Frame-level orchestrator integration

#### Objective
Define how an upstream orchestrator composes work into executor runs and consumes results.

#### Tasks
- model one orchestrator-to-executor flow
- define expected artifact handoff surface
- define what events/results are most important upstream
- clarify how multi-step workflows chain executor runs together

#### Deliverables
- one orchestrator integration example
- one artifact-consumption example
- docs describing upstream/downstream boundaries

### Workstream C — Builder/operator bootstrap workflow

#### Objective
Move beyond isolated executor tests into a realistic vertical workflow.

#### Tasks
- implement one builder-style end-to-end scenario
- implement one operator/reviewer-style scenario if justified
- show how executor outputs drive the next planning or coding step

#### Deliverables
- vertical sample workflow(s)
- workflow-specific docs
- regression tests where practical

### Workstream D — Executor runtime parity hardening

#### Objective
Convert the sharper Phase 4.1 runtime understanding into better end-to-end coverage.

#### Tasks
- add executor-path Ralph-loop smoke coverage
- compare spawn vs fork where relevant
- add regression protection for extension-friendly child profiles
- document safe vs unsafe profile/tool-surface patterns

#### Deliverables
- executor-path parity tests
- profile/tool-surface guidance note
- updated runtime posture docs if new evidence appears

### Workstream E — Frame documentation and package role clarity

#### Objective
Make the repository describe the frame as a system, not only the executor as a component.

#### Tasks
- fill `docs/passto-ai-frame/`
- describe package/component roles
- clarify relationship among:
  - `passto-executor`
  - `pi-subagent`
  - `passto-agent-runtime`
  - future builder/operator layers

#### Deliverables
- overview doc
- architecture doc
- roadmap doc
- package-role summary

## Suggested execution order

1. write frame-level docs and invocation policy notes
2. implement one vertical orchestrator/builder example
3. harden executor-path parity coverage around that example
4. expand builder/operator flows only after the first end-to-end path is stable

## Success criteria

Phase 5 is successful when:
- the frame-level architecture is documented in-repo
- at least one upstream orchestrator/builder flow is real, not only described
- executor integration boundaries are clearer than they are today
- parity hardening is driven by real vertical flows rather than abstract fear
- the project can explain itself as a system, not only as a collection of executor internals

## One-line summary

Phase 5 should productize the layer above `passto-executor`: define how the frame shapes invocations, launches isolated runs, consumes artifacts, and builds realistic builder/operator workflows on top of the now-hardened execution substrate.
