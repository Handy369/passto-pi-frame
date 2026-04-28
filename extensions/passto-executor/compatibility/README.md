# Compatibility Notes

Phase 3 keeps compatibility intentionally narrow and explicit.

## Current role of the compatibility layer

The compatibility area is still not a full legacy shell, but it is no longer only a note. It now includes a first small migration surface for legacy subagent-like request shapes.

Current direction:
- adapt legacy-style requests onto `task -> invocation -> assembly -> execution`
- preserve a migration path for older call sites without collapsing the new executor boundaries
- keep compatibility intentionally smaller than full historical subagent behavior
- expand request/options adaptation before introducing any response-shaping layer
- preserve executor-owned lifecycle semantics rather than reintroducing legacy child shutdown behavior

## What is available now

`passto-executor` now provides compatibility-adjacent capabilities that a migration layer can target:

- hardened `task.md` parsing
- typed run-store contracts plus file-backed persistence and run inspection helpers
- sandbox metadata plus explicit cleanup/preservation policy
- `single`, `sequential`, and `parallel` orchestration modes
- bounded concurrency for parallel execution
- aggregated multi-perspective results
- compatibility helpers:
  - `legacyRequestToInvocation(request)`
  - `legacyRequestToRuntimePolicy(request)`
  - `legacyRequestToExecuteOptions(request, options)`
  - `executeLegacyRequest(request, options)`

See also:
- `compatibility/MIGRATION_GUIDE.md`
- `compatibility/legacy-invocation-adapter.ts`
- `../examples/phase3-compat-legacy-invocation.task.md`

## What is still not available

Still not implemented in the current bounded compatibility surface:
- a full `subagent`-style compatibility command surface
- legacy response-shaping adapters
- render adapters or TUI compatibility helpers
- full Ralph-capable child-runtime parity

Compatibility result shaping is still intentionally deferred. The current migration value comes from broader request + execution-options adaptation into the normal executor path.

## Known runtime limitation

Direct `runSubagent(...)` investigation has shown that Ralph-loop child execution can work when the child profile is configured correctly.

However, compatibility work should still preserve two important distinctions:
- executor-owned child lifecycle is process-oriented and normalizes completion to `process-exit`
- the system should still avoid broad claims of full Ralph-capable child-runtime parity through every executor path until deeper coverage exists

Any compatibility shell or migration adapter should preserve these distinctions explicitly instead of hiding them.
