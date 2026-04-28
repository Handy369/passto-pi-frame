# Passto Executor Phase 4 Milestone 1 — DAG Execution Plan

## Purpose

This document narrows Phase 4 down to the first execution milestone only:

- make `dag` mode executable
- preserve bounded concurrency
- turn current DAG validation and orchestration event vocabulary into real runtime behavior

This is intended to be the first actionable implementation slice of Phase 4.

## Milestone goal

Move from:
- dependency-aware planning metadata
- DAG validation
- bounded concurrency primitives
- waiting/skipped/progress event vocabulary

To:
- real dependency-driven execution for a bounded supported DAG model

## Scope

### In scope
- DAG scheduling for executor perspectives
- dependency-aware release of runnable work
- bounded concurrency under DAG execution
- failure/skip rules for DAG mode
- DAG-aware event emission
- DAG execution tests
- docs/examples updates required by the new behavior

### Out of scope
- Ralph/subagent child-runtime parity work
- general distributed scheduling
- speculative orchestration redesign
- full optional-dependency semantics if they slow down the first supported DAG slice too much
- compatibility expansion beyond what is needed to keep DAG behavior coherent

---

## Recommended implementation posture

Keep the first DAG execution model intentionally bounded.

Prefer:
- perspective-level dependency graph only
- explicit required dependencies
- no fancy graph mutation at runtime
- no retries in the first slice
- no speculative execution
- no resume/recovery semantics yet

The target is not “ultimate graph engine.”
The target is “honest, testable, useful DAG execution.”

---

## Proposed execution model

### First supported model
The first supported DAG mode should likely mean:

- each perspective may declare `dependsOn`
- a perspective becomes runnable only when all required dependencies complete successfully
- if a required dependency fails, dependents are skipped
- scheduler executes runnable nodes up to `maxConcurrency`
- run completes when all nodes are terminal:
  - completed
  - failed
  - skipped

### Suggested terminal states
Per perspective:
- `completed`
- `failed`
- `skipped`
- `waiting`
- `running`

Run-level:
- `success`
- `failure`
- `partial-success` or equivalent aggregate state if needed

### Suggested simplification for first slice
For the first implementation, treat all declared dependencies as required dependencies.

If optional dependency semantics are needed later, add them in a later Phase 4 iteration rather than complicating the first scheduler implementation.

---

## Execution checklist

### 1. Lock the first DAG contract
- [ ] Confirm the first DAG execution model is bounded and documented
- [ ] Treat all initial `dependsOn` edges as required
- [ ] Define terminal run behavior when one branch fails
- [ ] Define whether DAG mode returns aggregate failure vs partial success when some nodes are skipped after upstream failure

### 2. Upgrade orchestration planning
- [ ] Ensure DAG plans expose enough data for a runnable scheduler
- [ ] Confirm planned items carry stable ids, dependency ids, and execution order metadata where useful
- [ ] Confirm DAG validation output remains consumable by execution

### 3. Implement scheduler behavior
- [ ] Add DAG scheduler helper if separate from current parallel/sequential helpers
- [ ] Track node states:
  - [ ] waiting
  - [ ] runnable
  - [ ] running
  - [ ] completed
  - [ ] failed
  - [ ] skipped
- [ ] Release runnable nodes when dependencies complete successfully
- [ ] Skip nodes when required dependencies fail
- [ ] Enforce `maxConcurrency` across runnable nodes
- [ ] Detect scheduler terminal condition when all nodes are resolved

### 4. Connect events to live behavior
- [ ] Emit `perspective.waiting` when blocked on dependencies
- [ ] Emit `perspective.skipped` when upstream failure blocks execution
- [ ] Emit `run.aggregate-progress` during DAG progression
- [ ] Ensure event ordering is good enough for persistence/readback/debugging

### 5. Define result shaping
- [ ] Ensure aggregated results can explain completed/failed/skipped perspectives
- [ ] Ensure stored events/results preserve dependency causality well enough for debugging
- [ ] Decide whether skipped nodes should surface skip reasons in result summaries

### 6. Add tests
- [ ] Linear chain DAG test
- [ ] Diamond DAG test
- [ ] Bounded concurrency DAG test
- [ ] Upstream failure causes downstream skip test
- [ ] Mixed completion/failure aggregate-result test
- [ ] Event-semantics test for waiting/skipped/progress during DAG execution

### 7. Update docs/examples
- [ ] Update README if `dag` mode is now partially supported
- [ ] Add or update a Phase 4 DAG example fixture
- [ ] Keep docs explicit about supported vs unsupported DAG semantics

---

## Likely target files

Core implementation:
- `executor-core/orchestration.ts`
- `executor-core/execution/execute-plan.ts`
- `executor-core/dag.ts`
- `executor-core/events.ts`
- `executor-core/result.ts`

Possible new helper:
- `executor-core/dag-scheduler.ts`
  - or equivalent scheduler helper placement if preferred

Tests:
- `test/orchestration-advanced.test.mjs`
- `test/events-advanced.test.mjs`
- new DAG execution-focused test file if separation is cleaner

Docs/examples:
- `README.md`
- `examples/` with a new Phase 4 DAG example

---

## Suggested implementation order

### Step 1 — Freeze behavior before coding
Do first:
- define exact node state transitions
- define skip/failure rules
- define run-level aggregate status rules

This avoids code churn later.

### Step 2 — Implement minimal scheduler
Do next:
- runnable set calculation
- dependency release
- bounded concurrency gate
- terminal detection

### Step 3 — Connect events and result shaping
Then:
- waiting/skipped/progress event emission
- aggregate result semantics
- persistence/readback friendliness

### Step 4 — Add tests before expanding semantics
Only after the minimal DAG path is green:
- decide whether to add optional dependencies, priorities, or richer failure policy

---

## Definition of done for Milestone 1

Milestone 1 is complete when:

- [ ] `dag` mode executes a documented bounded model
- [ ] dependency-driven scheduling works for simple valid graphs
- [ ] bounded concurrency still applies during DAG execution
- [ ] upstream failure produces explicit downstream skip behavior
- [ ] waiting/skipped/progress events are emitted from real DAG execution
- [ ] result shaping and persisted records remain intelligible
- [ ] tests cover core DAG execution paths
- [ ] docs/examples reflect the new supported behavior honestly

## Practical warning

Do not let Milestone 1 turn into a full orchestration rewrite.

Good Milestone 1 outcome:
- real DAG execution exists
- behavior is explicit
- tests are strong
- scope stays bounded

Bad Milestone 1 outcome:
- too many graph features at once
- optional semantics before core scheduling is stable
- broad refactors unrelated to making `dag` mode actually run
