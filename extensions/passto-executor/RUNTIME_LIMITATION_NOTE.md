# Ralph/Subagent Runtime Limitation Note

## Scope

This note narrows the currently known limitation around Ralph-capable child execution when `passto-executor` delegates through the current subagent runtime path.

## Current observed behavior

`passto-executor` can successfully:

- construct child runtime params
- launch child runs through `runSubagent(...)`
- collect child events/results
- verify Ralph-loop contracts from emitted artifacts/events

In direct investigation outside the executor path, `runSubagent(...)` has now been shown capable of running a real Ralph loop child successfully when the child profile is configured correctly.

However, this still does **not** prove that `passto-executor` itself currently exposes a fully equivalent Ralph-capable child-runtime surface.

## Current narrowed statement

The known limitation should currently be phrased as:

- normal child execution works
- direct `runSubagent(...)` execution can support a real Ralph loop when the child profile does not accidentally block Ralph tools
- Ralph-loop verification can inspect outputs/events after execution
- but executor documentation should still avoid claiming full Ralph-capable child-runtime parity
- executor now normalizes child completion to `process-exit` regardless of caller preference, and shapes `ralph-loop` runs toward `ralph-executor`
- broader parity claims should still remain conservative until deeper coverage is tested across more scenarios

## Most likely blame surface to investigate next

The main unresolved area is no longer whether `runSubagent(...)` can support Ralph tools at all. The sharper remaining issue is how executor-facing child runtime shaping interacts with the actual child tool surface.

Key findings from direct investigation:
- a broken/over-specific `ralph-executor` profile can prevent Ralph execution even when the underlying child runtime is otherwise capable
- explicit duplicate Ralph extension injection can create tool conflicts
- a restrictive `tools` whitelist in the child profile can hide `ralph_start` / `ralph_done`
- once those profile/tool-surface issues are removed, direct `runSubagent(...)` Ralph-loop execution can succeed

Primary remaining layers for executor-side investigation:
- `passto-executor` contract-to-runtime wiring
- executor-side child profile / tool-surface selection policy
- whether executor should guard, adapt, or explicitly shape Ralph-capable child runs

## Suggested next diagnostic step

Use a focused fixture or probe that:
- runs a child execution with a Ralph-oriented contract
- records raw child events
- records runtime provenance
- distinguishes between:
  - child execution success
  - contract artifact verification success
  - actual child tool-surface parity

This should keep the limitation statement precise and prevent executor docs from over-claiming runtime equivalence.
