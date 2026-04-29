# Passto AI Frame Architecture

## Purpose

This document explains the intended system architecture around `passto-ai-frame`, with `passto-executor` as the first mature implementation foundation.

It focuses on:
- system layers
- responsibility boundaries
- invocation and context assembly flow
- runtime and workspace isolation posture
- artifact and feedback flow
- the relationship among `passto-executor`, `pi-subagent`, and `passto-agent-runtime`

## Architectural summary

`passto-ai-frame` should be understood as a layered system, not as a single runtime package.

A useful high-level model is:

1. **Frame-level caller**
   - builder
   - orchestrator
   - operator workflow
   - future self-hosted planning/development loop
2. **Invocation layer**
   - task-doc path
   - direct invocation path
3. **Executor assembly layer**
   - normalize inputs
   - resolve defaults and runtime policy
   - shape child execution context
4. **Execution layer**
   - orchestration mode
   - sandbox strategy
   - child runtime launch
   - event/result collection
5. **Artifact / feedback layer**
   - run manifests
   - events
   - results
   - preserved sandboxes/worktrees
   - verification outputs

Core path:

`task.md -> invocation -> assembly -> resolved context -> execution -> artifacts`

## Layer-by-layer view

## 1. Frame-level callers

These are the layers that decide **what work should be done**.

Typical future examples:
- a builder that generates coding/review tasks
- an operator that runs diagnostic or migration flows
- a planner that decomposes a larger goal into executor-ready units
- a self-hosted loop that consumes prior outputs and schedules follow-up runs

Responsibilities:
- decide goals and workflow structure
- choose when to create a `task.md` vs direct invocation
- choose presets, roles, constraints, and execution intent
- consume executor artifacts and decide next steps

Non-responsibilities:
- should not own low-level child process lifecycle rules
- should not manually reconstruct executor internals already handled by assembly
- should not assume historical `subagent` shutdown semantics apply inside executor runs

## 2. Invocation layer

This layer defines **how work is expressed** before executor-owned assembly.

There are two intended input paths.

### A. Task document path
A `task.md` acts as a reviewable execution contract.

Use when:
- the work should be inspectable and versionable
- humans may review or edit the task before execution
- the run should be reproducible from a file-backed specification

### B. Direct invocation path
An upstream caller constructs an `ExecutorInvocation` or equivalent normalized input directly.

Use when:
- the workflow is highly programmatic
- the caller already has structured planning state
- file-backed review is not required for every step

### Architectural rule
Both paths should converge into the same normalized executor pipeline.

That means:
- task documents are not a separate runtime product
- direct invocation is not an escape hatch around executor boundaries
- both are front doors into the same assembly/execution spine

## 3. Executor assembly layer

This layer is where `passto-executor` becomes more than a launcher.

Its job is to convert a user-facing or orchestrator-facing invocation into an executor-owned resolved runtime context.

Key outputs include:
- normalized perspectives
- execution mode
- sandbox strategy choice
- runtime policy
- agent/profile selection
- extension list
- resolved cwd/workspace strategy
- result persistence settings

### Why this layer matters
This is the architectural center of the frame.

It is where the system decides:
- what defaults apply
- what execution mode is valid
- what runtime posture should be enforced
- which concerns belong to the caller vs the executor

### Current maturity
This layer already exists in real form inside `passto-executor` as:
- invocation shaping
- context assembly
- runtime-policy shaping
- orchestration planning

What is still expected to deepen later:
- richer preset/role resolution
- more explicit model/tool-surface policy resolution
- stronger separation of caller intent vs executor-owned runtime policy

## 4. Execution layer

This layer decides **how the resolved work actually runs**.

It includes:
- orchestration mode
  - `single`
  - `sequential`
  - `parallel`
  - bounded `dag`
- sandbox selection
  - noop
  - temp-copy
  - worktree
- child runtime invocation
- event collection
- contract verification
- result aggregation and persistence

### Current posture
The execution layer is now process-oriented.

That means executor-owned child lifecycle is governed by:
- natural process exit
- idle timeout
- hard timeout
- terminate grace handling

and not by:
- caller-controlled `agent-end` shutdown preference

This is a major architectural decision because it defines `passto-executor` as a container-style execution runtime rather than a thin one-shot delegation shell.

## 5. Artifact and feedback layer

This layer is what makes the frame usable in larger workflows.

Outputs may include:
- run manifest metadata
- event streams
- aggregated result summaries
- failure records
- preserved sandbox/worktree paths
- contract-verification outputs
- child raw-event evidence when needed

These artifacts are important because they are the main handoff surface back to:
- builders
- operators
- planners
- review loops
- future self-hosted development flows

### Architectural rule
The frame should prefer explicit artifacts over hidden runtime assumptions.

That means:
- upstream layers should consume persisted outputs where practical
- debugging should be possible through manifests/events/workspaces
- later orchestration should build from recorded facts, not guesswork

## Invocation, presets, and resolved context

A central long-term question in `passto-ai-frame` is:

> what should the caller specify directly, and what should the executor resolve?

The architecture should eventually distinguish at least four sources of truth.

### 1. Caller intent
Examples:
- task goal
- explicit constraints
- execution mode intent
- required outputs
- high-level role selection

### 2. Preset / role policy
Examples:
- default agent/profile
- recommended extensions
- skill bundles
- review/coding posture
- safe tool-surface defaults

### 3. Executor defaults and enforcement
Examples:
- completion policy normalization
- sandbox defaults
- timeout fallback rules
- result persistence rules
- orchestration validity checks

### 4. Environment-derived context
Examples:
- project root
- repository/worktree status
- available extensions
- workspace/editor context where relevant

### Design principle
The caller should express **intent**, while the executor should own **runtime correctness**.

This principle already shows up in the current system:
- callers may express lifecycle preferences
- but executor normalizes child completion to `process-exit`
- callers may request compatibility-style fields
- but executor still shapes them into executor-owned runtime behavior

## Relationship among key packages

## `passto-executor`

Primary role:
- the execution substrate and container layer of the frame

Responsibilities:
- parse task docs
- normalize invocation
- assemble resolved context
- choose orchestration/sandbox behavior
- launch child execution
- collect/persist run artifacts
- provide bounded compatibility helpers

It should continue to be the main place where execution policy becomes concrete.

## `pi-subagent`

Primary role:
- lower-level child execution and result/event shaping support

Responsibilities today include:
- running delegated child tasks
- mediating child event streams
- providing runtime-native behavior that executor can build on
- hosting some contract-verification-adjacent utilities

Architecturally, `pi-subagent` is a runtime building block, not the whole frame.

## `passto-agent-runtime`

Primary role:
- runtime profile, agent, and child-process launch substrate

Responsibilities include:
- agent profile loading
- runtime configuration resolution
- contract lifecycle defaults
- extension inheritance/injection behavior
- low-level launch shaping used by child execution

Architecturally, this sits below `passto-executor` and is one of the key places where tool-surface correctness can be affected.

## Runtime parity and profile/tool-surface discipline

Phase 4.1 established an important architectural lesson:
- runtime parity failures are not only transport failures
- they can also be caused by profile/tool-surface shaping

Examples of real risk areas:
- restrictive tool whitelists
- stale extension paths
- duplicate extension injection
- incorrect runtime shaping for long-lived loop-style contracts

### Architectural implication
Profile design is part of runtime correctness.

It should not be treated only as prompt decoration or convenience metadata.

For the frame, this means:
- extension-friendly profiles should be explicit
- restrictive profiles should be intentional and documented
- executor-path parity tests should protect important flows like Ralph loops

## Isolation model

Workspace isolation is a core architectural feature, not only a debugging convenience.

### Current supported strategies
- noop
- temp-copy
- worktree

### Preferred long-term posture
For meaningful project work, the architecture should lean toward real isolation, especially:
- worktree-backed execution for repository tasks
- preserved failed sandboxes for debugging when useful
- explicit sandbox metadata for traceability

### Why isolation matters
It enables:
- safer automated changes
- reproducibility
- easier post-run inspection
- multi-run / multi-perspective experimentation with reduced workspace contamination

## Event and artifact flow

A simplified flow is:

1. upstream caller creates task or invocation
2. executor assembles resolved context
3. executor prepares sandbox
4. executor launches child runtime
5. child emits events and produces outputs
6. executor aggregates results and persists artifacts
7. upstream caller consumes the run result, artifacts, and preserved workspace if needed

This flow should remain visible in docs and tests because it is one of the strongest unifying ideas in the frame.

## Current architectural maturity

### Mature enough to rely on
- core executor pipeline
- bounded orchestration modes including DAG
- sandbox strategy model including worktrees
- persistence and readback
- compatibility migration surface
- process-oriented child lifecycle posture

### Not yet fully productized
- preset catalog and role-resolution system
- frame-level orchestrator abstraction
- builder/operator workflow library
- self-hosted bootstrap workflows
- broader executor-path parity coverage across many scenarios

## Recommended next architectural step

The next step should be to build one vertical frame-level flow that uses the current architecture end to end:
- upstream orchestrator or builder shapes work
- executor assembles and runs it in an isolated workspace
- artifacts are fed back into the next step

That will validate the architecture more effectively than continuing to refine individual executor internals in isolation.

## One-line architecture summary

`passto-ai-frame` is a layered system in which frame-level callers express intent, `passto-executor` resolves and executes that intent inside isolated process-oriented containers, and explicit artifacts feed the next planning/build/review step.