# Executor Core

This directory contains the core runtime pipeline for `passto-executor`.

The overall path remains:

`task.md -> invocation -> assembly -> resolved context -> execution`

## Directory role

`executor-core/` is the implementation heart of the executor. It contains:

- task document parsing and invocation shaping
- resolved context assembly
- execution entrypoints and execution helpers
- runtime interface and runtime parameter mapping
- orchestration planning and scheduling helpers
- sandbox contracts and implementations
- run-store contracts and persistence helpers
- result shaping and event mapping

## High-level file groups

### Task and invocation path

- `task-doc.ts` — parse and validate `task.md` documents
- `invocation.ts` — shape executor invocations
- `assembly.ts` — assemble resolved execution context
- `task-entry.ts` — convenience entry helpers from task documents into execution

### Execution path

- `execute.ts` — main public execution entrypoint at the core layer
- `execution/execute-perspective.ts` — per-perspective execution logic
- `execution/execute-plan.ts` — plan dispatch logic for single/sequential/parallel modes
- `execution/runtime-param-builder.ts` — assemble child runtime parameters
- `execution/contract-verification.ts` — execution-contract verification helpers

### Runtime and orchestration

- `runtime.ts` — child runtime interface/contract surface
- `orchestration.ts` — plan construction and mode shaping
- `scheduler.ts` — bounded-concurrency helpers
- `dag.ts` — structural DAG validation
- `events.ts` — executor event shaping and orchestration event vocabulary

### Persistence and results

- `run-store.ts` — run-store contracts, shared types, and in-memory read/write support
- `store/file-run-store.ts` — file-backed persistence implementation
- `store/run-index.ts` — file-backed run index for faster listing/status workflows
- `result.ts` — result shaping and aggregated run summaries

### Sandbox layer

- `sandbox.ts` — sandbox contracts, metadata, and cleanup policy definitions
- `sandbox/temp-copy-sandbox.ts` — temp-copy sandbox implementation
- `sandbox/worktree-sandbox.ts` — git worktree-backed sandbox implementation
- `sandbox/strategy-manager.ts` — strategy-selection wrapper for pluggable sandbox backends

## Boundary guidance

A useful rule of thumb is:

- files in `executor-core/` define the execution substrate
- `compatibility/` adapts legacy or migration-oriented request shapes onto this substrate
- `examples/` demonstrates supported task shapes and capability intent

## Current scope boundaries

`executor-core/` currently supports:

- `single`, `sequential`, `parallel`, and bounded `dag` execution modes
- bounded concurrency for parallel and bounded DAG execution
- dependency-aware planning metadata
- DAG validation plus required-dependency DAG scheduling
- sandbox cleanup/preservation policy
- temp-copy, noop, and worktree-backed sandbox strategies
- richer persistence inspection/listing support

It still intentionally does **not** provide:

- advanced DAG semantics such as retries, resume/recovery, or optional dependency policies
- a complete legacy compatibility shell
- guaranteed Ralph-capable child-runtime parity
