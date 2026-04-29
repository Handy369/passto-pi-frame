# Passto Executor Phase 4 Review Note

## Review outcome

Phase 4 can be considered complete.

The current `passto-executor` implementation now meets the intended Phase 4 bar:

- the Phase 3 integration-ready substrate has been extended into a more execution-capable, isolation-capable, migration-capable, and integration-stable platform layer
- the core architectural path still holds:

`task.md -> invocation -> assembly -> resolved context -> execution`

- the work was delivered milestone-by-milestone through bounded Ralph loops rather than broad refactors
- tests, examples, package entrypoints, and docs now reflect the real system state more accurately than at the end of Phase 3

## What Phase 4 delivered

### 1. DAG execution became real, not only validated

Phase 3 had dependency metadata, DAG validation, and event vocabulary, but no real DAG execution.

Phase 4 Milestone 1 added:
- bounded DAG execution
- dependency-gated scheduling
- required-dependency semantics
- downstream skip behavior after upstream failure
- live `perspective.waiting`, `perspective.skipped`, and `run.aggregate-progress` behavior
- DAG result shaping and persistence coverage

This is intentionally a first-slice DAG model rather than a full graph engine, which is the right scope choice.

### 2. Sandboxing now has more than one real backend

Phase 3 introduced sandbox policy and a pluggable strategy seam, but still had only one meaningful isolation backend.

Phase 4 Milestone 2 added:
- a real `WorktreeSandboxManager`
- worktree provenance metadata
- explicit non-git rejection for worktree mode
- tested cleanup / preserve-on-failure behavior for worktrees
- a real operational distinction between `noop`, `temp-copy`, and `worktree`

A subtle but important improvement was also made:
- sandbox cleanup now receives the real child success/failure outcome instead of always assuming success

That change makes preservation semantics materially more trustworthy across strategies.

### 3. Compatibility expanded into a more useful migration layer

Phase 3 compatibility was intentionally narrow and centered on a single request adapter.

Phase 4 Milestone 3 expanded this into a broader but still bounded migration surface:
- broader request adaptation
- execution-options adaptation
- a direct `executeLegacyRequest(...)` helper
- clearer compatibility docs and staged migration guidance

Just as important, Phase 4 kept compatibility honest:
- no full historical shell claim
- no result-surface parity claim
- no Ralph child-runtime parity claim
- result adaptation explicitly deferred rather than implied

This preserves trust in the migration surface.

### 4. The package story is clearer and safer now

Before Phase 4 Milestone 4, the root package surface had become broad enough to risk accidental public API dependence on implementation details.

Milestone 4 improved this by:
- shrinking the root `index.ts`
- defining a smaller stable root API
- introducing explicit secondary entrypoints:
  - `@handy/passto-executor`
  - `@handy/passto-executor/executor-core`
  - `@handy/passto-executor/compatibility`
- updating `package.json` export maps
- adding entrypoint smoke tests

This is a strong packaging improvement without requiring disruptive directory churn.

## Verification summary

By the end of Phase 4:
- VS Code diagnostics were clean
- the workspace test suite passed fully
- the final observed test total was:
  - **62 passing tests**
  - **0 failing tests**

The test surface now covers:
- DAG execution
- orchestration behavior
- sandbox strategies including worktrees
- compatibility migration helpers
- package entrypoints
- persistence/readback behavior

## What is working well now

### A. The architecture remained stable under deeper capability growth

Phase 4 added real scheduling, a second real sandbox backend, broader compatibility, and a clearer package story without collapsing boundaries.

The implementation still clearly separates:
- invocation shaping
- assembly
- execution
- orchestration
- sandboxing
- persistence
- compatibility
- package/export policy

That is a strong sign that the current architecture is holding.

### B. Scope control was generally disciplined

Each milestone was kept bounded:
- M1 did not try to become a full orchestration engine
- M2 did not become a generalized sandbox platform rewrite
- M3 did not turn into full backward-compatibility theater
- M4 did not become a cosmetic refactor spree

This is one of the main reasons Phase 4 landed cleanly.

### C. The docs are now closer to the truth of the system

At the end of Phase 4, the docs/examples/package notes are materially more aligned with implementation:
- DAG support is described honestly as bounded
- worktree sandboxing is documented as real
- compatibility is documented as migration-oriented rather than parity-oriented
- package entrypoints are now intentional and documented

## Non-blocking follow-up items

These do not block Phase 4 closure, but they should guide later work.

### 1. DAG semantics are still intentionally limited

Still not implemented:
- retries
- resume/recovery
- optional dependency semantics
- richer failure policies
- broader graph execution semantics

This is acceptable for Phase 4, but it leaves a clear future evolution path.

### 2. Worktree sandboxing is first-slice practical, not final-form

The worktree backend is real and useful, but still bounded.

Possible future work:
- larger-repository performance improvements
- richer provenance/readback helpers
- per-perspective strategy overrides if later justified
- more sophisticated reuse/caching models

### 3. Compatibility is broader, but still intentionally incomplete

Still out of scope:
- full legacy command-shell parity
- response/TUI/render compatibility
- every historical call shape

This should remain explicit in future planning so compatibility does not over-promise.

### 4. Runtime parity remains deferred, not solved

The biggest intentionally deferred item is still:
- **Phase 4.1 — Ralph/Subagent Child-Runtime Parity Investigation**

That remains the correct next hard technical planning frontier because it affects how confidently deep delegation and child-runtime claims can be made.

### 5. Package surface policy will need future maintenance

Now that secondary entrypoints exist, future work should protect the distinction between:
- stable root API
- advanced/internal entrypoints

Otherwise root surface sprawl may reappear over time.

## Final assessment

Phase 4 should be closed as complete.

The implementation now provides:
- bounded real DAG execution
- a real worktree sandbox backend
- broader compatibility migration helpers
- a smaller and more intentional root package API
- explicit secondary entrypoints
- updated docs/examples/package metadata
- stronger tests and smoke validation

This is sufficient to say that `passto-executor` has evolved from an integration-ready execution substrate into a more operationally credible and integration-stable platform layer.

The next meaningful work should now move to either:
- **Phase 4.1** runtime parity investigation
- or a new phase focused on deeper production hardening beyond the current bounded capability model
