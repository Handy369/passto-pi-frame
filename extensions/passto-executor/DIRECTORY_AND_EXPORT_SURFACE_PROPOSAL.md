# Passto Executor Directory and Export Surface Proposal

## Purpose

This note captures a small, non-blocking cleanup proposal for `passto-executor` after Phase 3.

It does **not** propose a large refactor.
Its purpose is to improve:

- directory clarity
- export-surface discipline
- example discoverability
- future Phase 4 evolution safety

## Current assessment

The current structure is already healthy enough to keep.

What is working well now:

- `execute.ts` no longer absorbs all runtime complexity
- execution helpers are separated under `executor-core/execution/`
- sandbox, store, compatibility, and examples each have visible boundaries
- the root `index.ts` provides a convenient package entrypoint

Because of that, the right next step is **light structure clarification**, not a broad reorganization.

---

## 1. Directory naming guidance

### 1.1 `run-store.ts` and `store/`

Current layout:

- `executor-core/run-store.ts`
- `executor-core/store/file-run-store.ts`
- `executor-core/store/run-index.ts`

This is workable, but the boundary is not immediately obvious to a new reader.

### Recommendation

Prefer a documentation-first clarification before any file moves:

- `run-store.ts` should be treated as the main run-store contract surface and shared store-facing types/helpers
- `store/` should be treated as file-backed persistence helpers and concrete disk-oriented implementations

### Optional Phase 4 restructure

Only if the store surface grows further, consider:

- `executor-core/store/contracts.ts`
- `executor-core/store/in-memory-run-store.ts`
- `executor-core/store/file-run-store.ts`
- `executor-core/store/run-index.ts`

This should be treated as a **Phase 4+ cleanup**, not a Phase 3 follow-up requirement.

---

### 1.2 `compatibility/`

Current layout and naming are good.

### Recommendation

Keep `compatibility/` as the directory name.

Why:

- it can hold legacy adapters
- it can later hold response/render compatibility helpers
- it is broader and more durable than names like `legacy/` or `adapters/`

### Conclusion

No rename is recommended.

---

### 1.3 `execution/`

Current layout:

- `execution/runtime-param-builder.ts`
- `execution/contract-verification.ts`
- `execution/execute-perspective.ts`
- `execution/execute-plan.ts`

This is a reasonable grouping.

### Recommendation

Do not split `execution/` further yet.

Only reconsider if it grows into a larger cluster of runtime-dispatch helpers. At that point, Phase 4 could consider secondary groupings such as:

- `execution/runtime/`
- `execution/dispatch/`
- `execution/contracts/`

For now, further splitting would be premature.

---

### 1.4 `sandbox/strategy-manager.ts`

Current layout is acceptable.

### Recommendation

Keep the current shape until there are multiple real sandbox backends.

If Phase 4 adds more concrete strategies, then consider:

- `sandbox/strategies/temp-copy.ts`
- `sandbox/strategies/worktree.ts`
- `sandbox/strategies/noop.ts`
- `sandbox/strategy-manager.ts`

Until then, no move is necessary.

---

## 2. Export surface guidance

## 2.1 Root `index.ts`

The current root `index.ts` is convenient but fairly broad.
That creates a medium-term risk:

- internal helpers may become accidental public API
- downstream users may depend on implementation details that should stay flexible

### Recommendation

In Phase 4, consider splitting exports into:

- a **stable public API** at the package root
- a more explicit **advanced/internal API** behind a secondary entrypoint

Example direction:

- `@handy/passto-executor`
- `@handy/passto-executor/executor-core`
- `@handy/passto-executor/compatibility`

This would reduce future breaking-surface pressure without removing internal power-user access.

Status note:
- This direction has now been adopted in a bounded form with explicit secondary entrypoints for `executor-core` and `compatibility`.

---

## 2.2 Suggested stable public API

The root export surface should eventually center on the most important user-facing operations.

Suggested public runtime exports:

- `executeInvocation`
- `executeTaskDoc`
- `taskDocToInvocation`
- `assembleExecutorContext`
- `legacyRequestToInvocation`

Suggested public core types:

- `ExecutorInvocation`
- `ResolvedExecutorContext`
- `ExecutorRunResult`
- `ExecutorRuntimePolicy`
- `SandboxCleanupPolicy`

These represent the clearest package-level concepts.

---

## 2.3 Suggested advanced/internal API

The following kinds of modules are useful, but should not necessarily be treated as default top-level public API forever:

- execution-plan helpers
- execution-perspective helpers
- low-level runtime-param mapping helpers
- run-index helpers
- low-level store helpers

### Recommendation

Keep them exported for now if needed, but long-term prefer moving them behind an advanced/internal entrypoint rather than default root exposure.

---

## 3. Naming consistency guidance

### 3.1 `task-entry.ts`

The current name works, but its role may not be obvious to first-time readers.

### Recommendation

No rename is required now.

Instead, document it more clearly as:

- task-document-oriented execution entry helpers
- convenience bridge from task artifacts into execution

If the file is ever renamed in Phase 4, names like these may be more explicit:

- `execute-task-doc.ts`
- `task-execution-entry.ts`

But this is not worth churn right now.

---

### 3.2 `runtime.ts` vs `execution/runtime-param-builder.ts`

The distinction is valid, but can be ambiguous at first glance.

### Recommendation

Clarify by documentation rather than rename:

- `runtime.ts` = child runtime interface/contract surface
- `execution/runtime-param-builder.ts` = execution-side runtime parameter assembly

---

### 3.3 `result.ts`

`result.ts` is a fine name for now.

### Recommendation

Leave it in place unless result shaping grows significantly.

If Phase 4 adds more result-specific concerns, a future split could be:

- `result.ts`
- `result-aggregation.ts`
- `result-serialization.ts`

No immediate action is needed.

---

## 4. Example discoverability guidance

The examples are already named well by phase:

- `phase1-*`
- `phase2-*`
- `phase3-*`

### Recommendation

Keep the current naming approach.

If the example set grows much larger, consider a stricter naming pattern:

- `phase3-parallel-bounded.task.md`
- `phase3-sandbox-preserve-failure.task.md`
- `phase3-compat-legacy-invocation.task.md`

For now, the current filenames are readable and sufficient.

---

## 5. Low-risk cleanup actions worth doing next

These are the best follow-up actions because they improve clarity without causing import churn.

### Recommended near-term actions

1. Add a short directory guide to the main `README.md`
   - `executor-core/` — core runtime pipeline and execution logic
   - `compatibility/` — migration and legacy adapter surface
   - `examples/` — task fixtures by phase/capability
   - `test/` — focused subsystem tests

2. Optionally add a small `executor-core/README.md`
   - explain contract modules
   - explain execution helpers
   - explain sandbox/store separation

3. Define a future Phase 4 export-surface policy
   - what counts as stable public API
   - what stays advanced/internal

---

## 6. Actions to defer to Phase 4

These are reasonable later, but should not be done just for cleanliness right now:

- narrowing the root `index.ts` export surface
- adding secondary barrel entrypoints
- moving run-store contracts into `store/`
- splitting `sandbox/` into `strategies/` subfolders
- restructuring `execution/` into multiple second-level groups

---

## 7. Actions not recommended right now

Avoid these unless a real scaling problem appears:

- broad file renames
- broad directory moves
- speculative deep layering
- reorganizing mainly for aesthetics

These would create churn without enough payoff at the current project size.

---

## Final recommendation

`passto-executor` does **not** need a major structural refactor after Phase 3.

The best next move is:

- keep the current directory structure
- improve documentation around directory roles
- gradually tighten the export surface in Phase 4
- only split directories further when real new implementations appear

In short:

**preserve the current structure, add clarity now, and enforce API layering later.**
