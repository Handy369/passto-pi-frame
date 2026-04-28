# Passto Executor Phase 2 Task Breakdown

## Phase 2 goal

Phase 2 should evolve `passto-executor` from a verified Phase 1 skeleton into a minimally functional execution container.

The goal is not to expand scope indiscriminately. The goal is to fill the Phase 1 seams with real capabilities while preserving the current architectural path:

`task.md -> invocation -> assembly -> resolved context -> execution`

## Phase 1 baseline

Phase 1 already established:

- `task.md` parsing in `executor-core/task-doc.ts`
- invocation shaping in `executor-core/invocation.ts`
- context assembly in `executor-core/assembly.ts`
- child runtime abstraction in `executor-core/runtime.ts`
- normalized events/results in `executor-core/events.ts` and `executor-core/result.ts`
- execution entrypoints in `executor-core/execute.ts` and `executor-core/task-entry.ts`
- replaceable seams for run storage and sandboxing in `executor-core/run-store.ts` and `executor-core/sandbox.ts`

Phase 2 should build on those seams rather than replacing them.

## Current Phase 1 limitations to address

Phase 2 should directly address these known limitations:

- `task-doc.ts` uses a minimal custom frontmatter parser
- `run-store.ts` only provides an in-memory store
- `sandbox.ts` only provides `NoopSandboxManager`
- `execute.ts` effectively runs only a single primary perspective
- runtime wiring is structurally correct but still thin

---

## Workstream A — Harden task.md parsing and schema validation

### Objective
Make `task.md` a more reliable production input contract.

### Tasks
- Replace or significantly harden the custom YAML/frontmatter parser in `executor-core/task-doc.ts`
- Preserve the public `parseTaskDoc()` / `readTaskDoc()` API shape where practical
- Improve nested object and array handling
- Improve parser failure diagnostics with clearer field-level errors
- Tighten schema validation for:
  - `schemaVersion`
  - `project`
  - `stage`
  - `expectedOutput`
  - `inputs`
  - `hints`

### Suggested deliverables
- hardened `executor-core/task-doc.ts`
- additional malformed and valid task fixtures
- parser-focused test coverage

### Suggested fixtures
- `test/fixtures/valid-minimal.task.md`
- `test/fixtures/valid-multiperspective.task.md`
- `test/fixtures/invalid-missing-schema.task.md`
- `test/fixtures/invalid-bad-inputs.task.md`

---

## Workstream B — Typed run store and persistence

### Objective
Upgrade run storage from a stub into a real execution record layer.

### Tasks
- Introduce stronger stored types instead of generic `Record<string, unknown>` payloads:
  - `ExecutorRunManifest`
  - `StoredExecutorEventRecord`
  - `StoredExecutorResult`
  - `StoredExecutorFailure`
- Keep `InMemoryExecutorRunStore` for tests
- Add a persistent file-backed store implementation
- Define an on-disk run layout, for example:

```txt
.runs/
  <runId>/
    manifest.json
    events.jsonl
    result.json
    failure.json
```

- Add minimal readback APIs for later audit/TUI use:
  - `getRunManifest(runId)`
  - `getRunEvents(runId)`
  - `getRunResult(runId)`

### Suggested deliverables
- typed `executor-core/run-store.ts`
- file-backed store implementation
- persistence tests and recovery/readback tests

### Suggested directory evolution
- keep interfaces in `executor-core/run-store.ts`
- optionally add implementation files under `executor-core/store/`

---

## Workstream C — Real sandbox manager

### Objective
Replace the no-op sandbox with a real isolated execution workspace.

### Tasks
- Refine the sandbox contract in `executor-core/sandbox.ts`
- Define minimum responsibilities:
  - create sandbox
  - expose sandbox root path
  - cleanup sandbox
  - preserve metadata for run/perspective/source root
- Implement the first real sandbox mode:
  - temp-copy sandbox, or
  - git-worktree sandbox
- Add cleanup policy controls, such as:
  - `always`
  - `on-success`
  - `never`
- Wire sandbox lifecycle into `execute.ts`
  - create before child execution
  - use sandbox root as child cwd
  - cleanup after execution according to policy

### Suggested deliverables
- real sandbox implementation
- sandbox lifecycle integration in execution path
- sandbox tests

### Suggested directory evolution
- keep contract in `executor-core/sandbox.ts`
- optionally add concrete implementations under `executor-core/sandbox/`

---

## Workstream D — Multi-perspective orchestration

### Objective
Move from a single-perspective execution path to a basic orchestration engine.

### Tasks
- Define the initial scheduling model for perspectives
- Stop assuming `context.perspectives[0]` is the only execution path
- Add orchestration support for:
  - `single`
  - `sequential`
  - `parallel`
- Do not fully implement DAG orchestration yet, but keep the mode visible and controlled
- Aggregate per-perspective outputs into a run-level result
- Extend events to better represent per-perspective progress and completion
- Run contract verification per perspective where appropriate

### Suggested deliverables
- new orchestration module, e.g. `executor-core/orchestration.ts`
- sequential execution support
- parallel execution support
- updated result aggregation model
- orchestration tests

### Suggested boundaries
- keep `execute.ts` as the main entrypoint
- push scheduling logic into a dedicated orchestration module to avoid overloading `execute.ts`

---

## Workstream E — Runtime integration and compatibility strategy

### Objective
Make runtime invocation more realistic while staying honest about current child-runtime limitations.

### Tasks
- Refine `RunExecutorChildParams` in `executor-core/runtime.ts`
- Clearly separate:
  - executor-level policy
  - child-runtime transport params
  - sandbox/runtime-derived execution params
- Improve mapping from assembled context into child execution
- Ensure runtime wiring includes:
  - cwd from sandbox
  - completion policy
  - timeouts
  - extensions
  - agent selection
  - spawn/fork strategy if needed
- Expand `compatibility/README.md` into a clearer migration note
- Explicitly document the known blocker around Ralph-capable child execution and avoid pretending that the current subagent path is fully equivalent

### Suggested deliverables
- refined runtime parameter mapping
- updated compatibility documentation
- explicit note on Ralph/subagent limitation in runtime docs

---

## Workstream F — Tests, fixtures, examples, and developer ergonomics

### Objective
Keep Phase 2 verifiable and easy to iterate on.

### Tasks
- Split the current monolithic skeleton test into focused suites:
  - `test/task-doc.test.mjs`
  - `test/run-store.test.mjs`
  - `test/sandbox.test.mjs`
  - `test/execute.test.mjs`
  - `test/orchestration.test.mjs`
- Add fixture-driven tests for:
  - valid/invalid task docs
  - store persistence
  - sandbox lifecycle
  - sequential execution
  - parallel execution
- Add richer sample tasks:
  - `examples/phase2-sequential.task.md`
  - `examples/phase2-parallel.task.md`
  - `examples/phase2-sandboxed.task.md`
- Update README to reflect actual Phase 2 capabilities and limits

### Suggested deliverables
- split test suite
- fixture directory
- new example task docs
- updated README

---

## Recommended directory evolution

Phase 2 should prefer small additive changes instead of a major restructure.

### Current structure

```txt
extensions/passto-executor/
  executor-core/
  compatibility/
  examples/
  test/
```

### Suggested Phase 2 structure

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

    store/
      file-run-store.ts

    sandbox/
      temp-copy-sandbox.ts
      worktree-sandbox.ts

  compatibility/
    README.md

  examples/
    phase1-sample.task.md
    phase1-failure.task.md
    phase2-sequential.task.md
    phase2-parallel.task.md
    phase2-sandboxed.task.md

  test/
    task-doc.test.mjs
    run-store.test.mjs
    sandbox.test.mjs
    execute.test.mjs
    orchestration.test.mjs
    fixtures/
```

The `store/` and `sandbox/` subdirectories are optional, but they are recommended if concrete implementations start to grow.

---

## Recommended execution order

### Milestone 1 — Input and persistence foundation
- Harden `task-doc.ts`
- Add valid/invalid fixtures
- Introduce typed run-store payloads
- Implement file-backed run store
- Add readback/recovery tests

### Milestone 2 — Real execution environment
- Design non-noop sandbox details
- Implement first real sandbox mode
- Wire sandbox into execution path
- Add cleanup policy
- Add sandbox tests

### Milestone 3 — Multi-perspective orchestration
- Add orchestration module
- Implement sequential execution
- Implement parallel execution
- Extend result/event aggregation
- Add orchestration tests and example tasks

### Milestone 4 — Runtime integration and documentation
- Refine child-runtime parameter mapping
- Expand compatibility note
- Document Ralph/subagent limitation clearly
- Update README with supported Phase 2 capabilities
- Add smoke examples for common execution paths

---

## Phase 2 checklist

### Milestone 1 — Input + persistence
- [ ] Replace or harden custom `task.md` frontmatter parser
- [ ] Add malformed and valid task fixtures
- [ ] Introduce typed run-store manifest/result/failure records
- [ ] Implement file-backed run store
- [ ] Add store readback helpers and tests

### Milestone 2 — Real execution environment
- [ ] Design non-noop sandbox contract details
- [ ] Implement first real sandbox mode
- [ ] Wire sandbox lifecycle into execution path
- [ ] Add sandbox cleanup policy
- [ ] Add sandbox tests

### Milestone 3 — Multi-perspective orchestration
- [ ] Add orchestration module for perspective scheduling
- [ ] Implement sequential perspective execution
- [ ] Implement parallel perspective execution
- [ ] Extend result/event aggregation for multiple perspectives
- [ ] Add orchestration tests and example tasks

### Milestone 4 — Runtime integration + docs
- [ ] Refine child runtime parameter mapping
- [ ] Document compatibility strategy vs `pi-subagent`
- [ ] Document known Ralph/subagent limitation explicitly in runtime notes
- [ ] Update README with Phase 2 supported capabilities
- [ ] Add smoke examples for sequential/parallel runs

---

## Final guidance

Phase 2 should not chase every future feature at once.

The highest-value move is to convert the existing Phase 1 seams into real capabilities:

- parser
- store
- sandbox
- orchestration

If those four areas are implemented cleanly, later phases can grow on top of the current architecture without forcing a rewrite.
