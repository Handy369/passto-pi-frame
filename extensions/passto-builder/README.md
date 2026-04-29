# Passto Builder

`passto-builder` is the builder executor of `passto-ai-frame`.

It is a workflow-backed executor implemented under `extensions/passto-builder/`, but it should not be treated as an isolated extension product. Its architecture identity is:
- a frame-native specialized executor
- running through `passto-executor`
- consuming concrete task or task-package inputs
- emitting intermediate state and final handoff results for the current project driver and future `passto-manager`

## Design context

The active design context for this implementation lives in:
- `~/passto-ai-frame/INDEX.md`
- `~/passto-ai-frame/WORKFLOW_BACKED_EXECUTORS_ARCHITECTURE.md`
- `~/passto-ai-frame/passto-builder/BUILDER_EXECUTOR_SPEC.md`
- `~/passto-ai-frame/passto-builder/LOOP_ENGINE_ARCHITECTURE.md`
- `~/passto-ai-frame/passto-builder/BUILDER_IMPLEMENTATION_PLAN.md`
- `~/passto-ai-frame/passto-builder/BUILDER_BOOTSTRAP_LAYOUT.md`
- `~/passto-ai-frame/passto-builder/FRAME_INTEGRATION_CONSTRAINTS.md`

## Current scope

The first implementation goal is to provide:
- builder contracts and state model
- a workflow skeleton
- a loop-engine boundary
- a Ralph-backed first loop-engine implementation
- a bridge to `passto-executor`
- a first executor-backed vertical slice with structured snapshots and final result shaping

Important architecture note:
- `passto-builder` is internal-only and should not expose command/tool entrypoints to the LLM.
- `passto-executor` is the only user-visible execution entrypoint in `passto-ai-frame`.
- builder loop engines are internal build-modes and must not re-enter `passto-executor`.

This package is intentionally early-stage and architecture-first.

## Current bootstrap status

The current bootstrap already includes:
- frame-oriented builder contracts
- input normalization
- builder workflow/state skeleton
- a Ralph loop engine boundary and first integration path
- an executor-owned internal builder bridge using `executeInvocation(...)`
- lightweight formatter helpers for internal/manual workflows
- early tests for contracts, bridge mapping, workflow, and vertical-slice behavior

Current limitations:
- the executor-backed path is still an early vertical slice
- status emission is still snapshot-based rather than event-stream-shaped
- artifact/result mapping is still intentionally lightweight compared with a production provenance model
- some prior public-entry-path assumptions are being removed as builder becomes internal-only
- task-file and `project.md` consumption from the planner workspace protocol is not yet fully implemented

## Project workspace protocol alignment

`passto-builder` should align with the shared project-local workspace rooted at:

```text
<cwd>/.passto-ai/
```

In particular, builder should treat these as the default collaboration paths:
- `<cwd>/.passto-ai/project.md`
- `<cwd>/.passto-ai/planner/`
- `<cwd>/.passto-ai/executor/`
- `<cwd>/.passto-ai/builder/`

The current bootstrap implementation should now default builder-owned note/report artifacts into:
- `<cwd>/.passto-ai/builder/`

Task-file-driven loading from planner outputs is a next step, but the path protocol itself is now part of the expected builder posture.

## Milestone status

The current implementation now satisfies the first meaningful bootstrap milestone.
See:
- `BOOTSTRAP_MILESTONE_ASSESSMENT.md`

## Manual invocation helpers

Current internal/manual helpers include:
- `runBuilderCommand(input)`
- `formatBuilderCommandResult(response)`
- `runBuilderFromJsonFile(path)`
- `runBuilderTask(input)`
- `formatBuilderToolResult(response)`

The JSON-file path is intended as a lightweight bootstrap helper for current project-driver experimentation, not as the final production CLI shape.

Current command-facing helpers now expose:
- structured result
- bootstrap report
- condensed bootstrap report text
- handoff text
- snapshot headlines

## Test stratification note

Current tests are starting to split into:
- fast workflow-focused tests
- medium vertical-slice tests
- heavier manual-surface/integration-style tests

See `test/README.md` for the current grouping.

## Early vertical-slice behavior

The current builder bootstrap can now:
- normalize a builder task input
- run a staged builder workflow
- route execution through the Ralph loop engine boundary
- shape an executor-backed run path
- propagate executor-bridge metadata into builder artifacts
- write a real workspace note artifact in the target cwd
- return structured snapshots, produced artifacts, and a final handoff result
- expose primary executor run context in the final builder result
- summarize artifact provenance in a more manual/project-driver-friendly way
- produce clearer handoff text for command/tool-facing manual summaries
- carry lightweight verification summary and bootstrap report structures in final results
- expose which artifact/path was verified in the lightweight verification layer

This is still an early implementation, but it now validates a real file-output path rather than only an abstract result-shaping flow.
