# Passto Executor Phase 4 / 4.1 Handoff Note

## Status

Phase 4 and Phase 4.1 can both be considered complete for their intended scope.

### Phase 4 completed
- DAG execution is real and tested
- worktree sandboxing is real and tested
- compatibility is broader and still intentionally bounded
- API/export surface is narrower and clearer

### Phase 4.1 completed
- the Ralph/subagent child-runtime ambiguity was investigated directly
- the main failure mode was narrowed from a vague runtime caveat to concrete child profile / tool-surface shaping issues
- executor-side lifecycle policy is now clarified and implemented as process-oriented

## Current system posture

### What `passto-executor` is
`passto-executor` is now best understood as a:
- process-oriented execution container
- multi-perspective orchestration substrate
- bounded compatibility and integration layer

Core path remains:

`task.md -> invocation -> assembly -> resolved context -> execution`

### What is now true
- child execution works through the normal executor spine
- executor child lifecycle is normalized to `process-exit`
- child completion is governed by:
  - natural process exit
  - idle timeout
  - hard timeout
  - terminate grace behavior
- `ralph-loop` runs are now shaped toward `ralph-executor`
- direct `runSubagent(...)` probing proved that real Ralph-loop child execution is possible when the child profile is configured correctly

### What was learned in Phase 4.1
The earlier Ralph/subagent failure was **not** proof that the child runtime was fundamentally incapable.

The most important root cause was:
- incorrect child profile / tool-surface shaping

Most notably:
- a restrictive `tools` whitelist in `ralph-executor` hid `ralph_start` / `ralph_done`

This means runtime parity risk must be treated as a:
- profile configuration concern
- tool-surface concern
- executor shaping concern

not only as a transport/runtime-launch concern.

## What the system should and should not claim

### Safe claims
- Phase 4 platform hardening is complete
- direct `runSubagent(...)` can execute a real Ralph loop under a correct profile
- executor is process-oriented and does not use caller-controlled `agent-end` child completion
- compatibility provides a migration path, not a full historical shell

### Claims to avoid
- full child-runtime parity is proven across every executor path
- every contract/extension/profile combination is parity-safe
- compatibility preserves all historical child lifecycle semantics

## Verification snapshot

### Tests
- `extensions/passto-executor`: `node --test`
  - **64 passing, 0 failing**
- `extensions/pi-subagent`: `node --test test/runtime-native.test.mjs`
  - **30 passing, 0 failing**

### Diagnostics
- `extensions/passto-executor`: 0 diagnostics
- `extensions/pi-subagent`: 0 diagnostics

## Key reference documents

### Phase 4
- `PHASE4_EXECUTION_INDEX.md`
- `PHASE4_REVIEW_NOTE.md`

### Phase 4.1
- `PHASE4_1_RUNTIME_PARITY_INVESTIGATION_PLAN.md`
- `PHASE4_1_RUNTIME_PARITY_EVIDENCE_MATRIX.md`
- `PHASE4_1_RUNTIME_PARITY_REVIEW_NOTE.md`
- `.ralph/passto-executor-phase4_1-runtime-parity.md`

## If work continues next

Recommended continuation order:

### 1. Deepen executor-side parity coverage
Focus on:
- more end-to-end Ralph-loop executor coverage
- spawn vs fork parity checks where useful
- broader contract/profile/tool-surface regression coverage

### 2. Harden profile/tool-surface discipline
Focus on:
- documenting which profiles intentionally use restrictive tool whitelists
- preventing future profile regressions that accidentally hide extension-provided tools
- clarifying when a child profile should be minimal vs extension-friendly

### 3. Continue bounded executor hardening, not broad rewrites
Future work should prefer:
- incremental runtime shaping improvements
- more explicit guardrails and tests
- documentation sync

Future work should avoid:
- vague parity claims
- speculative runtime rewrites without a proven failure mode
- collapsing executor back into a one-shot delegation wrapper

## One-line handoff

Phase 4 made `passto-executor` a stronger execution platform; Phase 4.1 proved that the sharpest remaining Ralph/subagent issues are mostly about child profile and tool-surface correctness, while confirming that executor itself should stay process-oriented.
