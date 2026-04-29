# Passto Executor Phase 1 Architecture Note

## What Phase 1 establishes

Phase 1 defines the initial container-shaped execution surface for `passto-executor`.

In frame terms, this establishes the earliest version of:
- the only top-level execution entry
- the container that later selects an executor by `stage`
- the assembly boundary that supplies runtime inputs executors cannot independently own

The implemented skeleton now covers this path:

1. `task.md` frontmatter + body parsing via `executor-core/task-doc.ts`
2. invocation shaping via `executor-core/invocation.ts`
3. context assembly via `executor-core/assembly.ts`
4. child execution abstraction via `executor-core/runtime.ts`
5. normalized events via `executor-core/events.ts`
6. result shaping via `executor-core/result.ts`
7. execution entrypoints via:
   - `executor-core/execute.ts`
   - `executor-core/task-entry.ts`
8. storage/sandbox placeholders via:
   - `executor-core/run-store.ts`
   - `executor-core/sandbox.ts`

## What Phase 1 explicitly does not establish yet

Phase 1 is not a full execution platform. It does **not** yet provide:

- persistent run storage
- git worktree isolation
- real multi-perspective scheduling
- full sequential / parallel / dag orchestration
- production-grade YAML parsing
- legacy `subagent` compatibility shell implementation

## Why this is enough for Phase 1

This skeleton is sufficient because it freezes the core boundaries needed for later phases:

- `task.md` is the invocation contract
- `ExecutorInvocation` is the orchestrator-facing normalized input
- `ResolvedExecutorRunContext` is the executor-owned assembled context
- `ExecutorRunResult` and `ExecutorEvent` define the initial runtime truth model
- run-store and sandbox now exist as replaceable seams rather than future ad-hoc additions
- the container/executor split can later be layered on top without replacing these core seams

## Handoff to later phases

Future phases should build on these seams instead of bypassing them:

- harden parsing rather than replacing the `task.md -> invocation` path
- replace in-memory store with persistent store behind the same interface
- replace no-op sandbox with worktree-backed isolation behind the same interface
- extend `execute.ts` from single-perspective flow into broader orchestration without collapsing module boundaries
- layer executor selection by `stage` on top of the container without turning executors into peer public entrypoints
