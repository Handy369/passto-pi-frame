# Passto Executor Phase 3 Review Note

## Review outcome

Phase 3 can be considered complete.

The current `passto-executor` implementation meets the intended Phase 3 bar:

- the Phase 2 runtime has been evolved into a more integration-ready and operationally credible execution platform
- the core architectural path remains intact:

`task.md -> invocation -> assembly -> resolved context -> execution`

- Phase 3 capabilities were added by deepening existing seams instead of rewriting the system
- tests, examples, migration notes, and runtime notes now reflect the actual current state of the project

## What is working well

### 1. The architecture still held under deeper runtime pressure
Phase 3 added more operational and integration-oriented capability without collapsing module boundaries.

The implementation still clearly separates:
- parsing
- invocation shaping
- assembly
- execution entrypoints
- runtime param mapping
- sandboxing
- orchestration
- persistence
- compatibility adaptation
- contract verification

This is important because Phase 3 work could easily have caused `execute.ts` or the compatibility layer to become a dumping ground.
That did not happen.

### 2. Execution concerns are better factored now
Phase 2 already introduced orchestration and sandboxing, but Phase 3 made the execution surface materially cleaner.

Notable improvements:
- runtime param construction is centralized and tested
- per-perspective execution is extracted
- plan execution helpers are extracted
- `execute.ts` remains the public entrypoint without owning all execution detail

This makes the runtime more maintainable and creates a better substrate for future scheduling or integration work.

### 3. Orchestration is meaningfully more expressive than in Phase 2
Phase 3 improved orchestration in several directions:

- bounded parallel concurrency
- dependency metadata in plans
- DAG validation without pretending DAG execution exists
- richer orchestration event vocabulary

This is a good example of deliberate scope control: the project gained planning/scheduling depth without over-claiming a complete DAG engine.

### 4. Operational seams now look much more real
Sandboxing and persistence are no longer only basic support layers.

Phase 3 added:
- sandbox cleanup/preservation policy
- sandbox metadata
- a pluggable sandbox strategy layer
- richer readback/listing support
- a file-backed run index

These additions make the system feel more like a platform component and less like a narrow demo runtime.

### 5. Compatibility moved from note to first real migration surface
One of the most useful Phase 3 outcomes is that compatibility is no longer only conceptual.

The project now has:
- a first compatibility adapter flow
- compatibility-specific tests
- a migration guide
- a compatibility example

This is still intentionally narrow, which is the right choice.
It demonstrates migration direction without promising a full historical shell.

### 6. Runtime limitation handling became more disciplined
The project still does **not** solve the Ralph/subagent parity problem.

However, it now documents the issue more precisely and avoids over-claiming equivalence.
That is a meaningful quality improvement.

The new runtime limitation note and tests help distinguish:
- normal child execution support
- post-run contract verification support
- true child tool-surface parity

That distinction should continue to be preserved.

## Non-blocking issues / follow-up items

These do not block Phase 3 closure, but they should guide Phase 4 or later hardening work.

### A. There is still no full DAG executor
Phase 3 correctly added DAG validation but stopped short of DAG execution.

This is not a flaw for Phase 3, but it is an obvious next frontier.
Future work will need to decide whether DAG execution should be:
- a limited dependency scheduler first, or
- a more general execution graph engine

### B. The sandbox strategy layer is useful but still light
The pluggable strategy layer is the right architectural move, but it does not yet imply multiple fully mature sandbox backends.

Future work may still want:
- worktree-backed sandboxing
- better exclusion/filter policies
- better large-repository performance

### C. Compatibility is still intentionally narrow
The new adapter flow is valuable, but it is only the first slice.

Still not solved:
- full legacy command parity
- response-shaping compatibility
- TUI/render compatibility
- broader historical call-shape support

That is appropriate, but should remain explicit in future planning.

### D. The runtime limitation is documented, not solved
The Ralph/subagent child-runtime limitation is narrower and better described now, but still unresolved.

This remains one of the most important future areas because it affects how confidently the executor can be used in self-hosted or deeply delegated flows.

### E. README and docs are much better, but will need future resync
The docs are now materially better aligned with implementation.

However, the project has now entered a stage where:
- README
- migration guide
- runtime limitation note
- examples

will need periodic synchronization as soon as Phase 4 begins.

## Final assessment

Phase 3 should be closed as complete.

The implementation now provides:

- thinner and better-factored execution wiring
- centralized runtime param mapping
- bounded concurrency and dependency-aware planning metadata
- DAG validation with honest non-support for DAG execution
- richer orchestration event vocabulary
- sandbox policy, metadata, and pluggable strategy selection
- richer persistence inspection and file-backed run indexing
- a first real compatibility adapter surface
- narrowed and better documented runtime limitations
- expanded tests, examples, and migration notes

This is sufficient to say that `passto-executor` has moved beyond a minimally functional container into a more credible execution substrate.

The remaining work belongs to Phase 4 or later product/platform hardening, not to unfinished Phase 3 scope.
