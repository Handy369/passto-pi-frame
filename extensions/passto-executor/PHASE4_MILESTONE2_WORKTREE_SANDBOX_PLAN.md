# Passto Executor Phase 4 Milestone 2 — Worktree Sandbox Plan

## Purpose

This document narrows Phase 4 down to Milestone 2 only:

- add a real worktree-backed sandbox strategy
- make sandbox strategy selection materially useful
- preserve explicit cleanup/preservation behavior across sandbox backends

This is the second actionable implementation slice of Phase 4.

## Milestone goal

Move from:
- temp-copy sandbox as the only meaningful isolation backend
- cleanup/preservation policy support
- sandbox metadata
- pluggable strategy selection

To:
- at least two meaningful sandbox strategies
- a usable worktree-backed isolation path
- explicit, testable strategy behavior across temp-copy, noop, and worktree-backed modes

## Scope

### In scope
- worktree-backed sandbox implementation
- strategy selection behavior for sandbox backends
- sandbox metadata expansion where needed
- cleanup/preservation semantics for worktree mode
- test coverage for cross-strategy behavior
- docs updates required by the new sandbox capability

### Out of scope
- Ralph/subagent child-runtime parity work
- distributed remote workspaces
- generalized workspace snapshot/replay systems
- speculative repository acceleration layers beyond what is needed for worktree mode
- broad sandbox API redesign unless required by the worktree backend

---

## Recommended implementation posture

Keep Milestone 2 practical and operational.

Prefer:
- one real new backend: worktree-based isolation
- no large sandbox rewrite
- explicit metadata and lifecycle behavior
- consistent strategy-selection semantics
- strong failure-preservation behavior for debugging

The target is not “every possible sandbox backend.”
The target is “a second real backend that materially improves the isolation story.”

---

## Proposed sandbox model

### First supported worktree model
The first worktree-backed strategy should likely mean:

- create a dedicated git worktree per sandboxed perspective
- derive a stable sandbox/worktree path from run + perspective identity
- preserve current sandbox metadata shape while enriching provenance where useful
- respect existing cleanup policy semantics:
  - `always`
  - `on-success`
  - `on-failure`
  - `never`
- preserve failed worktrees when policy requires it

### Suggested assumptions for first slice
To keep the first implementation bounded:

- assume project roots intended for worktree mode are git repositories
- treat missing git/worktree capability as an explicit strategy failure, not silent fallback
- avoid advanced branch-management behavior unless needed for correctness
- prefer deterministic naming and cleanup over clever reuse/caching

### Multi-perspective isolation posture
The default recommendation for the first slice is:

- one worktree per perspective

Reason:
- simplest isolation model
- easiest provenance story
- easiest cleanup/preservation story
- avoids hidden coupling between perspectives

If optimization is needed later, shared-base/derived strategies can come afterward.

---

## Execution checklist

### 1. Lock the first worktree strategy contract
- [ ] Confirm worktree mode is the second real sandbox backend
- [ ] Confirm worktree strategy requires a git-backed project root
- [ ] Define failure behavior when git/worktree creation is unavailable
- [ ] Confirm initial isolation model is one worktree per perspective

### 2. Define strategy lifecycle behavior
- [ ] Define worktree naming/path derivation rules
- [ ] Define strategy provenance fields to expose in metadata
- [ ] Define cleanup behavior for each cleanup policy:
  - [ ] `always`
  - [ ] `on-success`
  - [ ] `on-failure`
  - [ ] `never`
- [ ] Define preservation-on-failure semantics
- [ ] Decide whether failed cleanup should surface as hard error or recorded best-effort failure

### 3. Implement worktree backend
- [ ] Add `executor-core/sandbox/worktree-sandbox.ts`
- [ ] Create worktree-backed `SandboxManager` implementation
- [ ] Ensure returned `SandboxHandle.metadata` includes accurate strategy/provenance
- [ ] Ensure cleanup removes worktree resources correctly when policy allows
- [ ] Ensure preserved worktrees remain inspectable after failure-oriented runs

### 4. Reassess sandbox contracts only if needed
- [ ] Keep `sandbox.ts` stable if possible
- [ ] Extend `SandboxMetadata` only where worktree provenance genuinely needs more fields
- [ ] Avoid broad API churn unless required to support both temp-copy and worktree backends cleanly

### 5. Strengthen strategy-selection semantics
- [ ] Confirm behavior for explicit strategy selection
- [ ] Confirm behavior for default strategy selection
- [ ] Confirm unknown strategy rejection remains explicit
- [ ] Decide whether run-level strategy override is sufficient or whether per-perspective override must be supported now

### 6. Add tests
- [ ] Worktree sandbox creation test
- [ ] Worktree cleanup test
- [ ] Worktree preserve-on-failure test
- [ ] Cleanup-policy behavior test across strategies
- [ ] Strategy-manager selection test including worktree backend
- [ ] Metadata integrity test for worktree strategy provenance
- [ ] Explicit failure test for non-git or unsupported worktree setup if applicable

### 7. Update docs/examples
- [ ] Update README sandbox capability notes
- [ ] Update `executor-core/README.md` sandbox section if needed
- [ ] Add or update a Phase 4 sandbox example fixture
- [ ] Keep docs explicit about assumptions and current limitations of worktree mode

---

## Likely target files

Core implementation:
- `executor-core/sandbox.ts`
- `executor-core/sandbox/strategy-manager.ts`
- `executor-core/sandbox/temp-copy-sandbox.ts`
- `executor-core/sandbox/worktree-sandbox.ts`

Possible future directory refinement only if multiple concrete backends now justify it:
- `executor-core/sandbox/strategies/`

Tests:
- existing sandbox tests
- a new worktree-focused sandbox test file if separation is cleaner

Docs/examples:
- `README.md`
- `executor-core/README.md`
- `examples/` with a new Phase 4 sandbox example if helpful

---

## Suggested implementation order

### Step 1 — Freeze lifecycle semantics first
Do first:
- define naming/provenance rules
- define cleanup/preservation semantics
- define failure behavior for unsupported worktree conditions

This avoids backend code churn later.

### Step 2 — Implement minimal worktree backend
Do next:
- creation
- metadata
- cleanup
- preservation logic

### Step 3 — Reconcile strategy-manager behavior
Then:
- ensure strategy selection remains explicit and stable
- ensure no ambiguity between requested strategy and reported metadata

### Step 4 — Add tests before optimization
Only after the worktree path is stable:
- consider further metadata refinement
- consider directory reshaping such as `sandbox/strategies/`
- consider optimization/reuse ideas

---

## Definition of done for Milestone 2

Milestone 2 is complete when:

- [ ] a worktree-backed sandbox backend exists
- [ ] at least two meaningful sandbox strategies are usable
- [ ] cleanup/preservation behavior is explicit across strategies
- [ ] worktree strategy metadata is visible and accurate
- [ ] strategy selection is operationally meaningful and test-backed
- [ ] failure/debug preservation works for worktree mode
- [ ] docs/examples explain the new sandbox capability honestly

## Practical warning

Do not let Milestone 2 turn into a generalized sandbox platform rewrite.

Good Milestone 2 outcome:
- real worktree backend exists
- strategy behavior is explicit
- metadata is useful
- tests are strong
- docs are honest

Bad Milestone 2 outcome:
- over-designed backend abstractions before a second real backend settles
- too much branch/reuse/caching cleverness in the first slice
- large directory churn without functional value
