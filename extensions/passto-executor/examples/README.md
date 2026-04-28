# Passto Executor Examples

This directory contains example `task.md` fixtures organized by evolution stage.

## Phase 1 baseline

- `phase1-sample.task.md` — minimal valid task fixture
- `phase1-failure.task.md` — failure-oriented baseline fixture

## Phase 2 orchestration baseline

- `phase2-bootstrap.task.md` — early bootstrap fixture
- `phase2-sequential.task.md` — sequential multi-perspective flow
- `phase2-parallel.task.md` — parallel multi-perspective flow

## Phase 3 capability examples

- `phase3-bounded-parallel.task.md` — bounded concurrency for parallel execution
- `phase3-debug-preserve-sandbox.task.md` — failure debugging with explicit sandbox preservation policy
- `phase3-compat-legacy-invocation.task.md` — compatibility adapter flow for legacy-style requests and migration into the executor spine

## Phase 4 capability examples

- `phase4-dag.task.md` — bounded DAG execution intent and dependency-model example
- `phase4-worktree-sandbox.task.md` — worktree-backed sandbox intent and cleanup-policy example

## How to use these examples

Use these fixtures to exercise the executor path:

`task.md -> invocation -> assembly -> resolved context -> execution`

They are examples of supported task shapes and capability intent, not proof of advanced unsupported features such as DAG retries/resume semantics or Ralph-capable child-runtime parity.
