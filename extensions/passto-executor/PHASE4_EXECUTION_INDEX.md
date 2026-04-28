# Passto Executor Phase 4 Execution Index

## Purpose

This document is the top-level navigation and execution index for Phase 4.

It ties together:

- the overall Phase 4 scope
- milestone-specific plans
- milestone ordering and dependencies
- what is ready to execute now
- what is intentionally deferred to Phase 4.1

Use this file as the first stop before starting any Phase 4 implementation loop.

---

## Phase 4 summary

Phase 4 evolves `passto-executor` from a Phase 3 integration-ready execution substrate into a more:

- execution-capable
- isolation-capable
- migration-capable
- integration-stable

platform layer.

Core path to preserve:

`task.md -> invocation -> assembly -> resolved context -> execution`

Primary goals:

1. make DAG execution real
2. add a real worktree-backed sandbox backend
3. expand compatibility beyond the first narrow adapter slice
4. converge the API/export surface into a more stable package story

---

## Scope boundary

### In Phase 4
- DAG execution
- worktree sandboxing
- compatibility expansion
- API / integration-surface convergence

### Not in Phase 4
- Ralph/subagent child-runtime parity investigation or repair

That work is intentionally deferred to:

- **Phase 4.1 — Ralph/Subagent Child-Runtime Parity Investigation**

Reason:
- it is important but orthogonal
- it should not block the main platform-hardening track
- separating it keeps Phase 4 execution cleaner and more predictable

---

## Core planning documents

### Phase-wide planning
- `PHASE4_TASK_BREAKDOWN.md`
  - master execution checklist for the whole phase

### Milestone-specific plans
- `PHASE4_MILESTONE1_DAG_EXECUTION_PLAN.md`
  - first implementation slice: make `dag` mode executable
- `PHASE4_MILESTONE2_WORKTREE_SANDBOX_PLAN.md`
  - second implementation slice: add worktree-backed isolation
- `PHASE4_MILESTONE3_COMPATIBILITY_EXPANSION_PLAN.md`
  - third implementation slice: grow migration/compatibility surface
- `PHASE4_MILESTONE4_API_CONVERGENCE_PLAN.md`
  - fourth implementation slice: stabilize root API and integration surface

### Phase 3 carry-forward references
- `PHASE3_REVIEW_NOTE.md`
  - what Phase 3 achieved and what remained intentionally incomplete
- `DIRECTORY_AND_EXPORT_SURFACE_PROPOSAL.md`
  - guidance relevant to Milestone 4 API/export cleanup
- `README.md`
- `executor-core/README.md`

---

## Milestone order

Recommended order:

1. **Milestone 1 — DAG execution foundation**
2. **Milestone 2 — Worktree sandboxing**
3. **Milestone 3 — Compatibility expansion**
4. **Milestone 4 — API and integration-surface convergence**

Why this order:

- DAG execution is the largest remaining functional gap after Phase 3
- worktree sandboxing is the next biggest operational upgrade
- compatibility should expand on top of the stronger execution and isolation substrate
- API cleanup is safest after the new functional surfaces have settled

---

## Milestone dependency map

### Milestone 1 — DAG execution foundation
**Primary dependency posture:** can start immediately

Depends on Phase 3 baseline:
- dependency metadata
- DAG validation
- bounded concurrency primitives
- orchestration event vocabulary

Blocks / influences:
- Milestone 3 compatibility examples and docs may need to reflect real DAG support once available

### Milestone 2 — Worktree sandboxing
**Primary dependency posture:** can be planned now, best implemented after Milestone 1 starts settling

Depends on Phase 3 baseline:
- sandbox metadata
- cleanup/preservation policy
- strategy manager

Influences:
- stronger operational story for Phase 3+ execution
- compatibility examples that rely on preserved/debuggable workspaces

### Milestone 3 — Compatibility expansion
**Primary dependency posture:** should follow Milestones 1–2 conceptually

Depends on:
- stable understanding of supported execution modes
- stronger sandbox story if compatibility docs mention real operational behavior

Influences:
- migration docs
- example coverage
- package-facing consumer expectations

### Milestone 4 — API convergence
**Primary dependency posture:** should come last

Depends on:
- decisions from Milestones 1–3 about what should remain public
- settled understanding of which helpers are durable package concepts vs internal details

Influences:
- long-term package stability
- import-path discipline
- documentation accuracy

---

## Phase 4 execution outcome

Phase 4 implementation has now been completed.

### Final review reference
- `PHASE4_REVIEW_NOTE.md`
  - final assessment of the completed phase
- `PHASE4_AND_4_1_HANDOFF_NOTE.md`
  - one-page handoff summary for the completed Phase 4 + 4.1 state and recommended next continuation path

### Completed milestone outcomes
- **Milestone 1 — DAG execution foundation**
  - bounded real DAG execution landed
  - required-dependency scheduling and downstream skip behavior landed
  - DAG-aware waiting/skipped/progress events are live and tested
- **Milestone 2 — Worktree sandboxing**
  - real `WorktreeSandboxManager` landed
  - strategy selection is now materially meaningful across noop/temp-copy/worktree
  - cleanup/preservation semantics are explicit and tested for worktree mode
- **Milestone 3 — Compatibility expansion**
  - compatibility expanded from a single adapter into a broader migration-helper surface
  - request + execution-options adaptation landed
  - result adaptation was explicitly deferred instead of implied
- **Milestone 4 — API and integration-surface convergence**
  - root API was narrowed
  - secondary entrypoints landed
  - package metadata/docs/import-path validation were aligned with the new package story

### Ralph bootstrap map
- `.ralph/passto-executor-phase4-m1-dag.md`
  - Milestone 1 bootstrap: DAG execution foundation — completed
- `.ralph/passto-executor-phase4-m2-worktree.md`
  - Milestone 2 bootstrap: worktree sandboxing — completed
- `.ralph/passto-executor-phase4-m3-compat.md`
  - Milestone 3 bootstrap: compatibility expansion — completed
- `.ralph/passto-executor-phase4-m4-api.md`
  - Milestone 4 bootstrap: API and integration-surface convergence — completed

---

## Suggested execution mode by milestone

### Milestone 1 — DAG execution foundation
Recommended mode:
- focused implementation loop
- test-driven iteration
- narrow behavior lock before code expansion

### Milestone 2 — Worktree sandboxing
Recommended mode:
- implementation loop with filesystem/git-behavior verification
- careful cleanup/preservation testing
- explicit metadata validation

### Milestone 3 — Compatibility expansion
Recommended mode:
- incremental adapter extension
- docs/examples/tests moving together
- explicit non-goal policing

### Milestone 4 — API convergence
Recommended mode:
- decision-first pass on export policy
- then minimal code/package/doc changes
- smoke-check validation after export reshaping

---

## Recommended per-milestone deliverables

### Milestone 1 deliverables
- real DAG scheduler path
- DAG execution tests
- DAG-aware event emission
- DAG result/docs/example updates

### Milestone 2 deliverables
- worktree sandbox backend
- strategy-selection clarity
- cleanup/preservation tests
- sandbox docs/example updates

### Milestone 3 deliverables
- broader compatibility adapters
- migration guide expansion
- compatibility examples/tests
- explicit compatibility scope notes

### Milestone 4 deliverables
- narrowed root API
- secondary entrypoints if adopted
- package metadata alignment
- docs/import-path updates

---

## Completion checkpoints

### Phase 4 completion status
All original completion checkpoints are now satisfied:
- `dag` execution exists for a bounded documented model
- bounded concurrency still works under DAG scheduling
- a worktree-backed sandbox backend exists and is tested
- compatibility covers more than the first narrow adapter flow
- the root API/export surface is intentionally smaller and more stable
- docs/examples/package metadata align with the Phase 4 integration story
- runtime parity work remains explicitly separated into Phase 4.1

---

## Phase 4.1 follow-on track

Phase 4.1 investigation is now also documented and linked from this index.

### Phase 4.1 planning / evidence / review chain
- `PHASE4_1_RUNTIME_PARITY_INVESTIGATION_PLAN.md`
  - planning document defining the investigation scope, hypotheses, evidence model, and success criteria
- `PHASE4_1_RUNTIME_PARITY_EVIDENCE_MATRIX.md`
  - structured evidence record separating launch success, verifier success, and true runtime parity findings
- `PHASE4_1_RUNTIME_PARITY_REVIEW_NOTE.md`
  - final investigation summary and updated product/runtime posture

### Phase 4.1 bootstrap reference
- `.ralph/passto-executor-phase4_1-runtime-parity.md`
  - original Ralph bootstrap used to define the investigation track before the work shifted into direct main-session diagnosis

### Phase 4.1 key outcome summary
- direct `runSubagent(...)` probing proved the underlying child runtime can execute a real Ralph loop when the child profile is configured correctly
- the most important historical failure came from profile/tool-surface shaping, especially an over-restrictive `tools` whitelist in `ralph-executor`
- executor-side lifecycle policy has now been clarified as process-oriented:
  - executor normalizes child completion to `process-exit`
  - caller-supplied `agent-end` preferences do not control executor child shutdown behavior
- executor-side Ralph shaping now steers `ralph-loop` runs toward `ralph-executor` while keeping broader parity claims conservative

## Recommended next action

Phase 4 is complete, and Phase 4.1 findings are now captured.

Recommended next step:
- continue any remaining runtime-parity work from the sharper Phase 4.1 baseline rather than from the earlier vague limitation statement

Supporting references:
- `PHASE4_REVIEW_NOTE.md`
- `PHASE4_1_RUNTIME_PARITY_REVIEW_NOTE.md`
- `PHASE4_AND_4_1_HANDOFF_NOTE.md`

---

## One-line posture

Phase 4 should be executed as:

**functional execution maturity first, operational isolation second, migration expansion third, API convergence last.**
