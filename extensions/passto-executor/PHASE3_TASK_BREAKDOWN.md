# Passto Executor Phase 3 Task Breakdown

## Phase 3 goal

Phase 3 should evolve `passto-executor` from a minimally functional execution container into a more integration-ready and operationally credible execution platform.

Phase 2 already proved that the architecture can support:

`task.md -> invocation -> assembly -> resolved context -> execution`

Phase 3 should preserve that path while improving four areas that Phase 2 intentionally left incomplete:

- richer orchestration
- stronger execution/runtime factoring
- more realistic compatibility and integration surfaces
- more production-oriented sandboxing, persistence, and observability

The goal is still **not** to rewrite the system. The goal is to deepen the existing seams and reduce the main remaining structural risks identified in the Phase 2 review.

---

## Phase 2 baseline

Phase 2 established:

- hardened `task.md` parsing and fixture-driven validation
- typed run-store contracts
- in-memory and file-backed run storage
- real temp-copy sandbox support
- execution with sandboxed cwd
- orchestration support for:
  - `single`
  - `sequential`
  - `parallel`
- aggregated multi-perspective results
- clearer runtime policy vs transport mapping
- updated README and compatibility notes
- focused subsystem tests

This means Phase 3 should **not** revisit whether those seams exist.
It should improve how far they can go in real usage.

---

## Phase 3 themes

The Phase 2 review suggests four major follow-up themes:

1. **Execution decomposition and hardening**
2. **Richer orchestration and scheduling**
3. **Compatibility and integration surface**
4. **Operational durability: sandbox, persistence, observability, recovery**

---

## Workstream A — Execution decomposition and runtime hardening

### Objective
Reduce complexity concentration in `executor-core/execute.ts` and make runtime parameter assembly more explicit, testable, and extensible.

### Why this matters
Phase 2 succeeded, but `execute.ts` still coordinates many responsibilities:

- execution dispatch
- sandbox lifecycle
- child invocation
- contract verification
- event collection
- result persistence

That is manageable now, but it will become a scaling risk if DAG mode, compatibility adapters, retry policies, or richer telemetry are added later.

### Tasks
- Extract per-perspective execution into a dedicated helper or module
- Extract plan execution helpers into their own execution-oriented module
- Centralize child runtime param construction into a dedicated builder, for example:
  - `buildRunExecutorChildParams(...)`
- Separate:
  - execution policy derivation
  - transport derivation
  - sandbox-derived cwd resolution
  - agent / extension selection
- Tighten the contract verification hook so it is easier to extend with additional execution contracts later
- Clarify how run-level vs perspective-level options override each other

### Suggested deliverables
- `executor-core/execution/` subdirectory or equivalent helper modules
- dedicated runtime-param builder
- more granular tests for execution planning vs execution dispatch

### Suggested success criteria
- `execute.ts` remains the public entrypoint but becomes noticeably thinner
- runtime param mapping is testable independently of child execution
- perspective execution is reusable across future orchestration modes

---

## Workstream B — Richer orchestration and scheduling

### Objective
Move from basic multi-perspective execution into a more explicit scheduling model suitable for future DAG and policy-driven orchestration.

### Why this matters
Phase 2 parallel mode is usable, but still minimal:

- `Promise.all(...)`
- no explicit concurrency control
- no dependency-aware scheduling
- no partial cancellation policy
- no advanced event interleaving semantics

Phase 3 should deepen orchestration without prematurely forcing a full production scheduler.

### Tasks
- Introduce a more explicit execution-plan model
- Define planned item metadata such as:
  - dependencies
  - concurrency group
  - priority
  - retry policy
  - allowFailure / requiredForCompletion
- Add bounded concurrency support for parallel runs
  - e.g. `maxConcurrency`
- Introduce a first dependency-aware scheduler model
  - not necessarily full generic DAG at first
  - but enough to support simple dependency edges between perspectives
- Decide and implement Phase 3 DAG posture:
  - either controlled limited DAG support, or
  - a more explicit DAG planner placeholder with validated graph modeling
- Add partial-failure handling rules for multi-perspective execution
- Improve event semantics for concurrent runs:
  - perspective started
  - perspective blocked/waiting
  - perspective completed
  - perspective skipped
  - aggregate progress snapshots

### Suggested deliverables
- upgraded `executor-core/orchestration.ts`
- possibly `executor-core/scheduler.ts`
- richer orchestration result and event model
- tests for bounded concurrency and dependency scheduling

### Suggested success criteria
- orchestration can express more than ordered-list execution
- parallel mode no longer means only unbounded `Promise.all`
- dependency-aware perspective execution is modeled and tested

---

## Workstream C — Compatibility and integration surface

### Objective
Turn compatibility from a documentation note into a small but real migration layer.

### Why this matters
Phase 2 documented compatibility honestly, but did not implement a true compatibility shell.
If `passto-executor` is going to sit under builder/orchestrator workflows, callers need a stable migration surface rather than just notes.

### Tasks
- Define the minimum supported legacy compatibility surface
- Decide what should be adapted from older `pi-subagent`-style calls into executor invocations
- Add adapter(s) for:
  - legacy invocation shape -> `ExecutorInvocation`
  - legacy execution options -> executor runtime policy / transport policy
  - legacy result shape -> executor result mapping where needed
- Clarify what will **not** be supported in compatibility mode
- Decide whether compatibility is:
  - internal-only adapter helpers, or
  - an exposed command/tool surface
- Add compatibility-focused examples and tests
- Document migration recipes from legacy subagent entrypoints to `task.md` / invocation-based execution

### Suggested deliverables
- a real `compatibility/` adapter module set
- compatibility README upgraded from note to migration guide
- test coverage for at least one legacy-style adapter flow

### Suggested success criteria
- at least one realistic legacy-style call path can execute through `passto-executor`
- compatibility scope is explicit and test-backed
- documentation moves from “future note” to “usable migration guide”

---

## Workstream D — Sandbox evolution and workspace isolation policy

### Objective
Upgrade workspace isolation from a functional temp-copy sandbox into a more scalable and policy-driven system.

### Why this matters
Phase 2 temp-copy sandbox is real and useful, but it is still a baseline implementation:

- can be expensive for larger trees
- has limited preservation/debug policy
- is not yet worktree-aware
- may not scale well for many perspectives or large repositories

### Tasks
- Add cleanup policy controls explicitly:
  - `always`
  - `on-success`
  - `on-failure`
  - `never`
- Add sandbox metadata manifesting for audit/debugging
- Introduce an alternative sandbox implementation, likely:
  - `worktree-sandbox.ts`, or
  - a pluggable local-isolation strategy
- Decide how multi-perspective runs should isolate workspaces:
  - one sandbox per perspective
  - shared base + derived per-perspective sandbox
- Add preservation hooks for failed runs to support debugging
- Improve copy/filter policy so heavy or irrelevant directories can be excluded when safe
- Add tests for cleanup policies and preservation behavior

### Suggested deliverables
- `executor-core/sandbox/worktree-sandbox.ts` or equivalent
- sandbox policy expansion in `sandbox.ts`
- sandbox preservation/debug tests

### Suggested success criteria
- more than one sandbox strategy exists
- cleanup and preservation behavior are explicit and test-backed
- large-repo or multi-perspective execution story improves materially

---

## Workstream E — Persistence, replay, and observability

### Objective
Make run storage useful not only for write-once persistence, but also for inspection, replay support, and developer/operator visibility.

### Why this matters
Phase 2 file-backed persistence is enough for a functional record layer, but not yet enough for strong auditability or operational tooling.

### Tasks
- Expand stored run metadata:
  - timestamps
  - execution mode
  - perspective-level status history
  - sandbox metadata
  - runtime provenance details
- Improve event schema stability and document it
- Add richer readback APIs:
  - list runs
  - list events by perspective
  - summarize run health/status
- Add simple replay/debug utilities or helper functions
- Consider adding a run index for efficient listing
- Define basic recovery semantics:
  - what can be resumed?
  - what can only be inspected?
- Add tests for readback, indexing, and event integrity

### Suggested deliverables
- run index or manifest listing support
- richer readback helpers
- event schema note / persistence note
- optional debug/replay helper module

### Suggested success criteria
- run persistence supports inspection workflows, not just write completion
- events/results can be navigated by perspective or run summary
- storage format becomes more useful for TUI or reporting integration

---

## Workstream F — Ralph/runtime limitation investigation

### Objective
Either reduce or clearly isolate the Ralph/subagent child-runtime limitation.

### Why this matters
Phase 2 correctly documented the limitation, but it is still a major constraint for self-hosted or builder-like flows.

### Tasks
- Reproduce the exact child-runtime tool registration failure in a minimal fixture
- Determine whether the issue is caused by:
  - extension double-loading
  - extension discovery path issues
  - transport/runtime startup differences
  - fork/spawn context issues
- Add diagnostic logging or a controlled probe harness
- Test whether the problem belongs in:
  - `passto-agent-runtime`
  - `pi-subagent`
  - extension loading policy
  - executor invocation strategy
- If it cannot be solved in Phase 3, isolate it more explicitly in runtime APIs and documentation

### Suggested deliverables
- reproduction note or diagnostics fixture
- runtime limitation analysis note
- possible mitigation strategy or narrowed blame surface

### Suggested success criteria
- the limitation is either reduced, reproduced cleanly, or isolated enough to guide future work
- executor docs can reference a precise failure mode instead of a broad caveat

---

## Workstream G — Tests, fixtures, and developer ergonomics

### Objective
Keep Phase 3 safe to iterate on while broadening scope.

### Tasks
- Add tests for:
  - bounded-concurrency orchestration
  - dependency-aware scheduling
  - sandbox preservation policies
  - compatibility adapter flows
  - persistence readback/listing behavior
  - runtime param builder behavior
- Add richer example tasks for:
  - dependency-aware execution
  - bounded parallel review
  - failure preservation / debug mode
  - compatibility entrypoint usage
- Add a minimal “how to run” section to README
- Consider a developer note for manual verification workflows

### Suggested deliverables
- expanded fixture set
- richer examples directory
- README usage section
- optional `docs/` notes for recovery/debugging

### Suggested success criteria
- each major new Phase 3 surface has direct tests and at least one example
- manual verification becomes easier for future contributors

---

## Recommended directory evolution

Phase 3 should still favor additive structure over major churn.

### Suggested Phase 3 structure

```txt
extensions/passto-executor/
  executor-core/
    assembly.ts
    context.ts
    contracts.ts
    events.ts
    execute.ts
    invocation.ts
    orchestration.ts
    result.ts
    run-store.ts
    runtime.ts
    sandbox.ts
    task-doc.ts
    task-entry.ts

    execution/
      execute-perspective.ts
      execute-plan.ts
      runtime-param-builder.ts

    store/
      file-run-store.ts
      run-index.ts

    sandbox/
      temp-copy-sandbox.ts
      worktree-sandbox.ts

    compatibility/
      legacy-invocation-adapter.ts
      legacy-result-adapter.ts

  compatibility/
    README.md
    MIGRATION_GUIDE.md

  examples/
    phase2-sequential.task.md
    phase2-parallel.task.md
    phase3-bounded-parallel.task.md
    phase3-dependent-perspectives.task.md
    phase3-debug-preserve-sandbox.task.md
    phase3-compat-legacy-invocation.task.md

  test/
    compatibility.test.mjs
    orchestration-advanced.test.mjs
    persistence.test.mjs
    runtime.test.mjs
    sandbox-policy.test.mjs
    ...existing Phase 2 tests...
```

This structure is illustrative, not mandatory.
The main intent is to prevent `execute.ts` and `runtime.ts` from absorbing all future complexity.

---

## Recommended execution order

### Milestone 1 — Execution refactor and runtime hardening
- Thin `execute.ts`
- Extract perspective execution helpers
- Add runtime-param builder
- Add execution-focused tests

### Milestone 2 — Orchestration deepening
- Add bounded concurrency
- Add dependency-aware planning model
- Improve concurrent event semantics
- Add advanced orchestration tests

### Milestone 3 — Sandbox and persistence hardening
- Add cleanup/preservation policy
- Add second sandbox strategy or stronger sandbox abstraction
- Add run indexing and richer readback
- Add recovery/debug utilities

### Milestone 4 — Compatibility and integration
- Implement minimum compatibility adapter flow
- Add migration guide and examples
- Add compatibility tests

### Milestone 5 — Ralph/runtime limitation investigation
- Produce precise repro or mitigation
- Update runtime notes based on findings
- Decide whether the issue blocks Phase 4 self-hosting goals

---

## Completion criteria

Phase 3 should be considered complete when most of the following are true:

- `execute.ts` is thinner and no longer the main concentration point for all execution concerns
- runtime param mapping is centralized and independently tested
- orchestration supports bounded concurrency and at least simple dependency-aware execution
- sandbox policy is explicit and at least one stronger isolation/preservation strategy exists beyond the baseline temp-copy implementation
- persistence supports richer inspection/listing workflows
- at least one compatibility adapter flow is implemented and tested
- the Ralph/subagent limitation is either more precisely diagnosed or better isolated/documented
- README, migration notes, and examples reflect actual Phase 3 behavior

---

## Non-goals for Phase 3

To avoid scope collapse, Phase 3 should still avoid trying to do everything.

Recommended non-goals:
- fully general production scheduler with every DAG feature
- complete replacement of all legacy subagent infrastructure
- production-grade distributed execution
- full UI/TUI rendering system
- solving every upstream runtime limitation inside this phase

The purpose of Phase 3 is to make `passto-executor` robust enough to serve as a serious integration substrate, not to finish the entire product surface.
