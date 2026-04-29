# Phase 4.1 Runtime Parity Evidence Matrix

## Purpose

This matrix is used to separate three different kinds of success:
- launch success
- post-run contract verification success
- true runtime parity success

It is intentionally conservative: a scenario does **not** count as runtime parity merely because a child process launched or because a verifier produced a meaningful result.

## Current baseline findings

### Scenario: standard executor child launch with runtime-policy mapping
- Source:
  - `executor-core/execution/runtime-param-builder.ts`
  - `test/runtime.test.mjs`
- What is proven:
  - child params are built with agent, prompt, cwd, extensions, and execution-policy fields
  - perspective runtime overrides are mapped over run defaults
- Launch success proven: **No**
  - these tests only prove parameter shaping, not an actual child process launch
- Contract verification success proven: **No**
- Runtime parity success proven: **No**
- Primary takeaway:
  - parameter mapping exists, but this is only configuration preparation evidence

### Scenario: executor perspective execution with post-run contract verification
- Source:
  - `executor-core/execution/execute-perspective.ts`
  - `executor-core/execution/contract-verification.ts`
  - `executor-core/contracts.ts`
- What is proven:
  - child execution result handling can map raw events
  - run-store events can be persisted
  - contract verification runs after child execution using task/cwd/rawEvents
- Launch success proven: **Partially / indirectly**
  - the code path clearly supports child execution, but this matrix entry is based on code inspection rather than a dedicated parity probe
- Contract verification success proven: **Yes**
  - verifier invocation is explicit and post-execution
- Runtime parity success proven: **No**
- Primary takeaway:
  - contract verification is downstream of child execution and is not proof that the child had Ralph/subagent-capable tools available during execution

### Scenario: `ralph-loop` verifier behavior on missing fixture/runtime evidence
- Source:
  - `test/runtime-limitation.test.mjs`
  - `executor-core/contracts.ts`
- What is proven:
  - the verifier can return a structured unsatisfied result
  - the project already encodes the idea that verification outcome does not imply runtime parity
- Launch success proven: **No**
- Contract verification success proven: **Yes**
- Runtime parity success proven: **No**
- Primary takeaway:
  - current tests validate honesty of the verifier surface, not parity of child runtime tool availability

## Updated direct-investigation findings

### Scenario: direct `runSubagent(...)` with `ralph-executor` profile after removing restrictive tool whitelist
- Source:
  - live probe run in the main session
  - `lib/passto-agent-runtime/agents/ralph-executor.md`
- What is proven:
  - direct child execution can successfully expose `ralph_start` and `ralph_done`
  - the child can start a real Ralph loop, receive the iteration prompt, and reach `<promise>COMPLETE</promise>`
- Launch success proven: **Yes**
- Contract verification success proven: **Indirectly yes**
  - the observed raw events include real Ralph tool calls rather than only synthetic post-run evidence
- Runtime parity success proven: **Partially / at subagent-runtime layer**
- Primary takeaway:
  - the underlying `runSubagent(...)` path is capable of Ralph-loop execution when the child profile does not block extension-provided tools

### Scenario: misconfigured `ralph-executor` profile with restrictive `tools` whitelist
- Source:
  - direct probe before profile correction
  - `lib/passto-agent-runtime/agents/ralph-executor.md`
- What is proven:
  - a child may launch successfully yet still lack `ralph_start` / `ralph_done`
  - the profile-level `tools: read,bash,edit,write` whitelist was sufficient to hide Ralph tools from the child runtime surface
- Launch success proven: **Yes**
- Contract verification success proven: **No**
- Runtime parity success proven: **No**
- Primary takeaway:
  - runtime parity can fail because of profile/tool-surface shaping, not because the underlying subagent runtime is fundamentally incapable

## Current suspected blame layers

Based on the updated audit and direct probes, the most plausible remaining unresolved layers are:
- executor-side contract-to-runtime shaping
- executor-side profile/tool-surface selection policy
- extension loading/injection behavior when executor chooses explicit child surfaces
- spawn vs fork context differences where relevant

## First investigation checklist

The next probe or audit should explicitly answer:
- did the child process actually launch?
- which tools were visible inside the child runtime?
- were requested extensions actually loaded?
- did spawn and fork differ?
- did the verifier report on artifacts/events that could exist without real runtime parity?

## Interpretation rule

Until a probe demonstrates actual child-visible tool availability, the project should continue to treat:
- param mapping
- child-result handling
- contract verification

as necessary but insufficient evidence for runtime parity.
