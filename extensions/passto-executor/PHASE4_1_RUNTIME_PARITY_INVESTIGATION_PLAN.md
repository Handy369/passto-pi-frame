# Passto Executor Phase 4.1 — Runtime Parity Investigation Plan

## Purpose

Phase 4.1 is a focused investigation phase.

Its job is **not** to broadly extend `passto-executor` feature scope.
Its job is to turn the currently known Ralph/subagent child-runtime limitation into a precise, evidence-backed boundary and a concrete recommendation.

Core question:

**What is the real capability gap between `passto-executor` child execution and a child runtime that can honestly be described as Ralph/subagent-capable?**

## Problem statement

The current implementation can already do several important things:
- shape child runtime params
- launch child execution through the current runtime path
- collect child events/results
- run post-execution contract verification

However, those facts do **not** prove runtime parity.

In particular, the project should still avoid claiming that child runs launched through `passto-executor` expose a fully equivalent Ralph/subagent tool surface.

The unresolved question is whether the limitation is caused by:
- child launch parameter wiring
- child runtime/tool registration
- extension discovery/injection
- process-mode differences such as spawn vs fork
- event/bridge environment differences
- contract assumptions that verify outputs without proving runtime capability

## Phase 4.1 goal

Investigate and define the real child-runtime parity boundary between `passto-executor` child execution and Ralph/subagent-capable runtime execution, then produce a concrete recommendation for:
- repair
- partial support
- or explicit non-support

## Non-goals

Phase 4.1 should **not** start by doing any of the following:
- claiming full parity before investigation
- rewriting the executor runtime architecture
- rewriting `pi-subagent`
- rebuilding the extension system wholesale
- expanding DAG, sandbox, compatibility, or package API scope
- implementing speculative parity fixes before the failure mode is isolated

## Investigation framing

Phase 4.1 should distinguish at least three layers of success:

### Layer A — Launch success
The child process can be started and can complete or exit.

### Layer B — Output/contract verification success
The parent can inspect emitted artifacts/events and conclude that a contract such as `ralph-loop` appears satisfied or unsatisfied.

### Layer C — Real runtime parity
The child runtime actually exposes the tools, control flow, and environment needed for Ralph/subagent-capable execution.

The investigation must avoid treating A or B as proof of C.

## Working hypotheses

Possible causes to test include:

1. **Launch-path wiring gap**
   - runtime params are incomplete or incorrectly mapped for child parity scenarios

2. **Tool registration gap**
   - child runtime launches, but required tools are not registered or not visible in the child process

3. **Extension injection gap**
   - required extensions/tools are available in the parent runtime but not actually loaded in child runs

4. **Process-mode gap**
   - spawn and fork modes differ materially in what context or tools the child receives

5. **Bridge/environment gap**
   - child execution lacks editor/workspace/runtime context needed by some tools

6. **Contract false-confidence gap**
   - post-run verification may show expected artifacts while the runtime itself was not truly parity-capable

## Research questions

Phase 4.1 should answer the following questions.

### 1. What child capabilities are present today?
For each relevant child mode, determine whether the runtime can:
- start successfully
- emit lifecycle events
- use standard executor child behavior
- access Ralph-related tools
- access subagent/delegation tools
- access extension-provided tools
- honor execution contracts as runtime behavior rather than only post-run verification

### 2. Which capabilities differ by mode?
Compare at least:
- `spawn`
- `fork`

If supported in the relevant runtime path, compare:
- with and without extensions
- with and without explicit execution contracts

### 3. Where exactly does parity fail?
For each failure case, identify whether the issue is primarily in:
- `executor-core/execution/runtime-param-builder.ts`
- `executor-core/execution/execute-perspective.ts`
- `passto-agent-runtime`
- `pi-subagent`
- extension registration/injection behavior
- child environment/context propagation

### 4. What should the product claim after the investigation?
Decide whether the correct project posture is:
- full repair target
- bounded parity target
- or explicit long-term non-support

## Suggested evidence model

Every meaningful finding should be recorded in a small matrix like this:

- scenario name
- execution mode
- extensions requested
- expected tools/capabilities
- observed tools/capabilities
- observed events/artifacts
- launch success: yes/no
- contract verification success: yes/no
- runtime parity success: yes/no
- suspected blame layer

## Proposed workstreams

### Workstream 1 — Capability inventory
Audit the current child-runtime path and document:
- how runtime params are built
- what mode/extension fields are forwarded
- what contracts are verified and when
- what current tests do and do not prove

### Workstream 2 — Minimal repro fixtures
Create one or more focused fixtures that attempt child execution requiring:
- Ralph-loop behavior
- tool registration visibility
- extension-provided capability

The fixture should be able to show the difference between:
- child launched
- contract verified
- actual tool/runtime parity achieved

### Workstream 3 — Mode comparison
Run the same probe under:
- spawn
- fork

and compare observed capability differences.

### Workstream 4 — Blame isolation
Determine whether the issue belongs primarily to:
- `passto-executor`
- `passto-agent-runtime`
- `pi-subagent`
- extension loading/registration
- environmental/bridge assumptions

### Workstream 5 — Recommendation
Based on evidence, produce one of these recommendations:

#### Option A — Repair now
Use when the failure mode is localized and fixable with bounded changes.

#### Option B — Support a narrower parity target
Use when full parity is too broad but a well-defined subset is achievable.

#### Option C — Keep explicit non-support
Use when the runtime architecture should not promise parity and docs/contracts should continue to state that clearly.

## Proposed deliverables

### Required deliverables
- `PHASE4_1_RUNTIME_PARITY_INVESTIGATION_PLAN.md`
- `.ralph/passto-executor-phase4_1-runtime-parity.md`
- one investigation note or review note capturing findings
- one parity matrix / evidence artifact
- one or more focused probe tests or fixtures if needed

### Likely supporting artifacts
- doc updates to `RUNTIME_LIMITATION_NOTE.md`
- test coverage clarifying what is and is not proven
- recommendation note for a follow-on implementation phase if repair is chosen

## Candidate files to inspect first

Primary executor files:
- `executor-core/execution/runtime-param-builder.ts`
- `executor-core/execution/execute-perspective.ts`
- `executor-core/execution/contract-verification.ts`
- `executor-core/contracts.ts`
- `executor-core/runtime.ts`
- `RUNTIME_LIMITATION_NOTE.md`
- `test/runtime-limitation.test.mjs`
- `test/runtime.test.mjs`

Reference/runtime-adjacent files:
- `../pi-subagent/ralph-verification.ts`
- relevant `pi-subagent` runtime/tool loading path
- relevant `passto-agent-runtime` launch path if needed

## Success criteria

Phase 4.1 is successful when all of the following are true:
- the current limitation is described in a more precise and evidence-backed way
- launch success, contract verification success, and true runtime parity are clearly separated
- the primary suspected blame layer is narrowed substantially
- docs/tests no longer accidentally imply more runtime parity than has been proven
- the project has a concrete recommendation for repair, bounded support, or explicit non-support

## Completion posture

Phase 4.1 does **not** require that runtime parity be repaired.

It is complete when the ambiguity is removed and the next decision becomes clear.

## One-line posture

Phase 4.1 should convert a vague runtime-parity caveat into a tested capability map and an explicit product/runtime decision.
