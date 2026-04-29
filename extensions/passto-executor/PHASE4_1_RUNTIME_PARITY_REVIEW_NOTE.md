# Passto Executor Phase 4.1 Runtime Parity Review Note

## Review outcome

Phase 4.1 investigation can be considered successful for its intended scope.

The ambiguity around Ralph/subagent child-runtime parity has been reduced substantially.

Most importantly, the investigation established that:
- the underlying `runSubagent(...)` path is capable of real Ralph-loop execution
- the earlier failure mode was not proof of a fundamentally incapable child runtime
- the most important failures were caused by runtime/profile shaping choices rather than by contract verification itself
- `passto-executor` still should not broadly claim full child-runtime parity, but it now has a much sharper and more accurate boundary

## Original ambiguity

At the start of Phase 4.1, the project had a narrowed but still unresolved limitation statement:
- child runs could be launched
- events/results could be collected
- Ralph-loop verification could run after execution
- but it was still unknown whether a child launched through the current runtime path could actually expose Ralph-capable tools during execution

The core risk was false confidence:
- launch success does not imply runtime parity
- post-run verification does not imply runtime parity

That distinction proved to be correct and useful.

## What the investigation established

### 1. The child runtime itself is not fundamentally incapable

Direct probing showed that a child launched through `runSubagent(...)` can:
- expose `ralph_start`
- expose `ralph_done`
- start a real Ralph loop
- receive a Ralph loop iteration prompt
- reach `<promise>COMPLETE</promise>` in a real child run

This means the system should no longer speak as if the subagent child path is inherently unable to run Ralph loops.

### 2. The earlier failure was configuration-driven

The most important failure was traced to the child profile layer.

Specifically:
- the `ralph-executor` profile previously carried a restrictive `tools` whitelist
- that whitelist excluded extension-provided Ralph tools
- the child therefore launched successfully but could not see `ralph_start` / `ralph_done`
- the child honestly reported tool unavailability instead of executing the loop

This is a fundamentally different diagnosis from “the runtime cannot do it.”

### 3. Explicit extension injection also created misleading failures

During the investigation, additional issues were observed:
- an over-specific extension path in the Ralph profile was incorrect for the current machine layout
- explicit duplicate Ralph extension injection could create tool-registration conflicts

These problems were important, but they were still secondary to the more structural issue:
- the child tool surface had been accidentally constrained by profile shaping

### 4. Post-run verification was honest, but not sufficient

The earlier verifier path was not wrong.

It already encoded an important truth:
- verifier success/failure is downstream evidence
- verifier behavior alone cannot prove that the child had the required tools during execution

Phase 4.1 confirmed that this distinction should remain part of project documentation and testing discipline.

## Key root-cause findings

### A. Profile/tool-surface shaping can break runtime parity

The strongest finding from the investigation is that child-runtime parity can fail because of:
- restrictive profile `tools` whitelists
- mismatched extension-path assumptions
- duplicate explicit extension injection

and not only because of child runtime transport or process management.

That means future parity work must treat agent profiles and tool-surface shaping as first-class runtime configuration, not only as prompt cosmetics.

### B. `passto-executor` should own lifecycle semantics conservatively

A separate but related conclusion emerged during the investigation:
- `passto-executor` is better understood as a process-oriented execution container
- it should not let caller-supplied `agent-end` preferences determine child shutdown behavior

The implementation now reflects this direction:
- executor child completion is normalized to `process-exit`
- lifecycle is governed by natural process exit, idle timeout, hard timeout, and terminate grace handling
- `ralph-loop` runs are shaped toward `ralph-executor` and process-oriented execution

This is an executor-surface decision, not a claim of universal parity.

## What changed because of the investigation

### Runtime/profile conclusions
- the `ralph-executor` profile was corrected so it no longer whitelists away Ralph tools
- explicit duplicate Ralph extension injection is no longer treated as the preferred path for the profile
- a regression test now guards against reintroducing a restrictive Ralph tool whitelist

### Executor conclusions
- executor-side child runtime shaping now steers `ralph-loop` runs toward `ralph-executor`
- executor normalizes child completion to `process-exit` regardless of caller preference
- documentation now explains that compatibility inputs may still mention `completionPolicy`, but executor-owned lifecycle remains process-oriented

### Documentation conclusions
- the runtime limitation note is now more precise
- the evidence matrix now separates:
  - parameter shaping evidence
  - verifier evidence
  - direct child-runtime evidence
- the compatibility docs now explain that legacy `agent-end` semantics are not preserved inside executor runs

## What is now proven vs not proven

### Proven
- `runSubagent(...)` can support a real Ralph loop when the child profile is configured correctly
- a misconfigured profile can hide required tools even when the child otherwise launches successfully
- executor should not rely on `agent-end` semantics for container-style execution
- post-run verification and runtime capability must remain distinct concepts

### Not yet broadly proven
- full Ralph-capable parity across every executor path and scenario
- fork-mode parity relative to spawn-mode behavior
- parity across arbitrary extension mixes or more complex delegated workflows
- that every future contract/extension combination will be safe under current shaping rules

## Updated product posture

The most accurate current posture is now:
- do **not** claim universal child-runtime parity through `passto-executor`
- do **not** describe the subagent child path as fundamentally incapable of Ralph execution
- do treat child profile/tool-surface shaping as a real runtime correctness concern
- do keep executor lifecycle process-oriented and conservative

## Recommendation

The investigation supports a **bounded support** posture rather than either extreme.

### Not recommended
- claiming full parity now
- keeping the old vague limitation statement
- treating verifier output as sufficient evidence of runtime parity

### Recommended
- keep the sharper limitation statement
- continue shaping executor-owned Ralph runs conservatively
- preserve tests that protect the Ralph profile from tool-surface regressions
- treat child profile/tool-surface design as part of runtime architecture, not just authoring style

## Final assessment

Phase 4.1 achieved its main goal.

It converted a vague runtime-parity caveat into a more evidence-backed conclusion:
- the child runtime can run Ralph loops
- earlier failures were largely caused by configuration and tool-surface shaping
- executor lifecycle policy should remain process-oriented
- broader parity claims should still remain conservative until more scenarios are covered

This is enough to say that the project now has a much clearer understanding of where the real boundary lies, and what follow-up work should focus on next.
