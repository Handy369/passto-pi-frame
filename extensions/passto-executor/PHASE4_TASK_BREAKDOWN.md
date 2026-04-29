# Passto Executor Phase 4 Task Breakdown

## Phase 4 goal

Evolve `passto-executor` from a Phase 3 integration-ready execution substrate into a more execution-capable, isolation-capable, and integration-stable platform layer.

Preserve the core path:

`task.md -> invocation -> assembly -> resolved context -> execution`

Phase 4 focuses on four areas:

1. DAG execution
2. stronger sandboxing through a real worktree-backed strategy
3. compatibility expansion beyond the first narrow adapter
4. API and integration-surface convergence

## Scope split

Phase 4 does **not** include Ralph/subagent child-runtime parity investigation or repair.
That work is intentionally split into:

- **Phase 4.1 — Ralph/Subagent Child-Runtime Parity Investigation**

Reason:
- it is important but orthogonal
- it should not block DAG, sandbox, compatibility, or API hardening
- keeping it separate reduces scope distortion

## Phase 3 baseline to preserve

Already complete from Phase 3:

- thinner execution wiring and extracted execution helpers
- centralized runtime parameter mapping
- `single`, `sequential`, and `parallel` execution modes
- bounded parallel concurrency
- dependency metadata in orchestration plans
- structural DAG validation
- richer orchestration event vocabulary
- sandbox cleanup/preservation policy controls
- sandbox metadata
- pluggable sandbox strategy selection
- richer persistence inspection and run listing
- file-backed run index
- a first compatibility adapter flow for legacy-style requests
- updated README, migration notes, examples, and review notes

Phase 4 builds on these directly.

---

## Milestone plan

### Milestone 1 — DAG execution foundation

#### Objectives
- make `dag` mode executable, not just validated
- preserve bounded concurrency under dependency scheduling
- turn waiting/skipped/progress events into live behavior

#### Execution checklist
- [ ] Define the first supported DAG execution model
- [ ] Implement dependency-aware release of runnable perspectives
- [ ] Respect `maxConcurrency` while executing DAG-ready work
- [ ] Define skip behavior for failed required dependencies
- [ ] Define skip behavior for missing upstream outputs
- [ ] Decide whether optional dependencies are in or out of scope
- [ ] Define DAG completion states:
  - [ ] full success
  - [ ] partial success
  - [ ] blocked/incomplete termination
- [ ] Emit real DAG-aware orchestration events:
  - [ ] `perspective.waiting`
  - [ ] `perspective.skipped`
  - [ ] `run.aggregate-progress`
- [ ] Persist ordering/causality clearly enough for inspection
- [ ] Add tests for:
  - [ ] linear dependency chain
  - [ ] diamond dependency graph
  - [ ] bounded concurrency under DAG execution
  - [ ] failure propagation
  - [ ] skip behavior

#### Target files
- `executor-core/orchestration.ts`
- `executor-core/execution/execute-plan.ts`
- new DAG-aware scheduling helpers if needed
- orchestration/result tests

#### Success criteria
- [ ] `dag` mode executes a bounded, documented supported model
- [ ] dependency graphs run correctly
- [ ] bounded concurrency still holds
- [ ] failure/skip behavior is explicit and test-backed

---

### Milestone 2 — Worktree sandboxing

#### Objectives
- add a real worktree-backed sandbox backend
- make sandbox strategy selection operationally meaningful
- preserve explicit cleanup/preservation semantics across strategies

#### Execution checklist
- [ ] Implement a worktree-backed sandbox strategy
- [ ] Decide file location:
  - [ ] `executor-core/sandbox/worktree-sandbox.ts`
  - [ ] optional `executor-core/sandbox/strategies/` split if warranted
- [ ] Define strategy selection behavior:
  - [ ] default strategy
  - [ ] per-run override
  - [ ] per-perspective override if needed
- [ ] Define worktree naming/provenance rules
- [ ] Define worktree cleanup behavior
- [ ] Define preservation-on-failure behavior
- [ ] Extend sandbox metadata to always expose chosen strategy/provenance
- [ ] Decide multi-perspective isolation posture:
  - [ ] one worktree per perspective
  - [ ] shared base + derived isolation
- [ ] Consider safe exclusion/filter rules where useful
- [ ] Add tests for:
  - [ ] worktree creation
  - [ ] worktree cleanup
  - [ ] failure preservation
  - [ ] strategy fallback behavior
  - [ ] metadata integrity across strategies

#### Target files
- `executor-core/sandbox.ts`
- `executor-core/sandbox/worktree-sandbox.ts`
- `executor-core/sandbox/strategy-manager.ts`
- sandbox tests/docs

#### Success criteria
- [ ] at least two meaningful sandbox strategies exist
- [ ] worktree-backed isolation is usable and tested
- [ ] strategy selection is a real operational choice
- [ ] metadata and cleanup behavior are explicit across strategies

---

### Milestone 3 — Compatibility expansion

#### Objectives
- grow compatibility beyond the first adapter slice
- keep migration support explicit and honest
- improve real caller migration coverage without claiming full historical parity

#### Execution checklist
- [ ] Define the next supported compatibility tiers
- [ ] Decide whether supported tiers include:
  - [ ] request adaptation only
  - [ ] request + options adaptation
  - [ ] request + options + result shaping
- [ ] Add broader request-field adaptation
- [ ] Add legacy execution-options adaptation
- [ ] Add result-shape mapping only where required
- [ ] Decide whether compatibility remains helper-only or gains a surfaced entrypoint
- [ ] Clarify unsupported compatibility areas in docs
- [ ] Add additional compatibility examples for realistic migration scenarios
- [ ] Add tests for:
  - [ ] broader request-shape adaptation
  - [ ] options adaptation
  - [ ] result-shape compatibility where implemented
  - [ ] compatibility behavior under sequential/parallel/DAG-supported flows where relevant
- [ ] Update migration docs with staged recipes:
  - [ ] legacy-style request path
  - [ ] invocation path
  - [ ] task-document path

#### Target files
- `compatibility/README.md`
- `compatibility/MIGRATION_GUIDE.md`
- expanded `compatibility/` adapters
- compatibility fixtures/examples/tests

#### Success criteria
- [ ] compatibility supports more than one narrow request pathway
- [ ] migration guidance is practical for real callers
- [ ] compatibility scope stays explicit and does not imply a full legacy shell

---

### Milestone 4 — API and integration-surface convergence

#### Objectives
- shrink and stabilize the root public API
- separate stable public exports from advanced/internal ones
- align docs and package metadata with the intended integration surface

#### Execution checklist
- [ ] Define the stable root API surface
- [ ] Decide which exports remain top-level public API
- [ ] Decide which exports move behind advanced/internal entrypoints
- [ ] Introduce secondary entrypoints if adopted:
  - [ ] `@handy/passto-executor`
  - [ ] `@handy/passto-executor/executor-core`
  - [ ] `@handy/passto-executor/compatibility`
- [ ] Narrow `index.ts`
- [ ] Decide status of low-level helpers:
  - [ ] execution helpers
  - [ ] runtime-param builder helpers
  - [ ] store internals
  - [ ] run-index helpers
- [ ] Update `package.json` metadata as needed
- [ ] Add export map if adopted
- [ ] Resync README/docs/examples with the chosen API surface
- [ ] Add entrypoint smoke checks if useful

#### Target files
- `index.ts`
- possible secondary barrel files
- `package.json`
- README/docs

#### Success criteria
- [ ] root API is smaller and more intentional
- [ ] advanced/internal surfaces remain available where needed
- [ ] docs and package metadata match the chosen export policy

---

## Recommended execution order

1. **Milestone 1 — DAG execution foundation**
2. **Milestone 2 — Worktree sandboxing**
3. **Milestone 3 — Compatibility expansion**
4. **Milestone 4 — API and integration-surface convergence**

Reason:
- DAG execution is the largest functional gap left from Phase 3
- worktree sandboxing is the next biggest operational upgrade
- compatibility should expand on top of the stronger execution substrate
- API/export cleanup is best done after the new surfaces settle

---

## Explicit non-goals

Do **not** include these in Phase 4:

- Ralph/subagent child-runtime parity investigation or repair
- a full-fidelity historical legacy shell
- large speculative directory renames without functional need
- broad product-layer builder/reviewer/orchestrator logic
- production-distributed scheduling beyond the local execution model

---

## Phase 4.1 placeholder

Track separately:

## Phase 4.1 — Ralph/Subagent Child-Runtime Parity Investigation

Future focus:
- isolate the child runtime/tool exposure failure mode
- distinguish launch success from actual child tool-surface parity
- build probe fixtures and provenance logging if needed
- determine whether the issue belongs to:
  - `passto-agent-runtime`
  - `pi-subagent`
  - extension registration
  - process-mode differences

This is intentionally outside the main Phase 4 work.

---

## Phase 4 completion checklist

Phase 4 is complete when:

- [ ] `dag` execution is implemented for a bounded, documented supported model
- [ ] bounded concurrency still works under DAG scheduling
- [ ] a worktree-backed sandbox strategy exists and is tested
- [ ] sandbox strategy selection is a real user-visible operational choice
- [ ] compatibility covers more than the first narrow adapter flow
- [ ] migration docs/examples reflect the expanded compatibility surface honestly
- [ ] the root export surface is smaller and more stable
- [ ] secondary entrypoints exist if that design is adopted
- [ ] package metadata and docs match the chosen integration surface
- [ ] runtime parity work remains explicitly tracked separately as Phase 4.1

## Final posture

Phase 4 is a platform-hardening and integration-maturation phase.

Its job is to:
- make dependency graphs executable
- support stronger isolation
- expand migration value
- present a more disciplined public integration surface

Its job is **not** to absorb the runtime parity investigation.
