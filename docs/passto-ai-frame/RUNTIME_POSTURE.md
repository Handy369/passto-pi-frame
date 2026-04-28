# Passto AI Frame Runtime Posture

## Purpose

This document captures the current runtime posture of `passto-ai-frame` as established by the implemented `passto-executor` substrate and the Phase 4.1 runtime parity investigation.

It is intended to answer questions like:
- what kind of runtime the system is trying to be
- which lifecycle rules belong to the executor vs the caller
- what compatibility does and does not mean
- how strong current parity claims really are
- why profile/tool-surface design must be treated as part of runtime correctness

## Core posture

The current frame runtime should be understood as:
- process-oriented
- artifact-producing
- isolation-friendly
- explicit about bounded support and non-goals

This is **not** a posture of:
- thin legacy-shell emulation
- caller-owned child shutdown semantics
- silent tool-surface magic
- broad parity claims without evidence

## Primary runtime identity

The main currently implemented runtime identity is:

### `passto-executor` as a process-oriented execution container

This means:
- callers express execution intent
- executor assembles a resolved runtime context
- executor owns child execution policy
- executor persists events/results/artifacts for later inspection

This is a stronger and more stable identity than:
- “a helper that forwards a call to subagent-like child execution and exits when the child emits `agent_end`”

## Lifecycle control boundary

One of the clearest conclusions from the current work is that lifecycle ownership should be explicit.

### Caller responsibilities
Callers may provide:
- task goal
- execution mode intent
- constraints and checklist items
- runtime hints
- compatibility-shaped requests where supported

### Executor responsibilities
Executor owns:
- final child lifecycle posture
- child runtime shaping
- sandbox/worktree setup and cleanup
- timeout and termination behavior
- event/result persistence
- contract verification integration

### Current lifecycle rule
Inside executor-managed runs:
- child completion is normalized to `process-exit`

In practice this means child shutdown is governed by:
- natural process exit
- idle timeout
- hard timeout
- terminate grace behavior

and **not** by:
- caller-supplied `agent-end` preference

## Why this posture exists

The process-oriented lifecycle decision is not only stylistic.
It protects important classes of workloads:
- multi-turn child runs
- loop-style contracts like Ralph
- children that emit intermediate completion-like events before true process completion
- longer-lived tool usage sequences

If executor allowed caller-controlled `agent-end` shutdown semantics by default, these runs could be truncated prematurely.

## Compatibility posture

Compatibility should be understood as a bounded migration aid.

### What compatibility means today
- legacy-style request shapes can be adapted into executor invocation/runtime options
- older call sites can be migrated incrementally
- request/options migration can happen without reintroducing the entire historical shell

### What compatibility does not mean
- full historical command-shell parity
- automatic preservation of all legacy response surfaces
- automatic preservation of all legacy child lifecycle semantics
- an excuse to dissolve executor-owned runtime rules

### Specific lifecycle implication
A compatibility input may still contain fields like `completionPolicy`, but:
- executor may read them
- executor may normalize them
- executor still owns final child lifecycle behavior

## Runtime parity posture

The system should be honest and precise about parity claims.

### What is now supported by evidence
- direct `runSubagent(...)` probing showed that a child can execute a real Ralph loop when the child profile is configured correctly
- the underlying runtime is not inherently incapable of Ralph-loop execution
- executor can shape Ralph-loop runs toward a suitable child profile and process-oriented lifecycle defaults

### What is not yet broadly proven
- full parity across every executor path and contract combination
- parity across all profile/extension/tool-surface combinations
- parity across all spawn/fork contexts without further coverage

### Current safe claim
The runtime can support real Ralph-capable child execution in proven scenarios, but broader executor-wide parity claims should remain conservative until more end-to-end coverage exists.

## Profile and tool-surface discipline

The strongest architectural lesson from Phase 4.1 is that runtime correctness depends heavily on tool-surface shaping.

### Why this matters
A child may:
- launch successfully
- emit lifecycle events
- even produce some useful output

and still fail to be truly parity-capable because required tools were hidden or conflicted.

### Real risk sources already observed
- restrictive `tools` whitelists
- stale extension paths
- duplicate extension injection
- profile defaults that are too narrow for extension-heavy workflows

### Runtime policy implication
Profiles should be treated as runtime configuration, not merely authoring convenience.

The system should distinguish among:
- minimal/restrictive profiles
- general-purpose profiles
- extension-friendly profiles for loop/delegation-heavy workflows

## Isolation posture

Isolation is part of runtime design, not only a testing convenience.

### Current supported strategies
- noop
- temp-copy
- worktree

### Preferred operational posture
For meaningful repository work, stronger isolation should be favored where possible, especially:
- worktree-backed execution
- preserved failed sandboxes for debugging
- explicit sandbox metadata for traceability

## Artifact posture

The runtime should prefer explicit artifacts over hidden assumptions.

Important outputs include:
- run manifests
- event logs
- aggregated results
- failure records
- preserved sandbox/worktree locations
- contract verification outputs

### Why this matters
This posture supports:
- reproducibility
- auditing
- debugging
- handoff to orchestrators/builders/operators
- future self-hosted loops that operate on recorded state

## Posture for future work

### Good continuation patterns
- deepen end-to-end executor coverage using real vertical flows
- add regression tests around profile/tool-surface correctness
- keep docs aligned with actual runtime evidence
- evolve frame-level callers without weakening executor-owned runtime boundaries

### Bad continuation patterns
- claim full parity because one direct probe worked
- reintroduce caller-owned shutdown semantics into executor
- treat compatibility as full historical emulation by default
- hide profile/runtime risks behind vague abstraction layers
- perform broad runtime rewrites without a concrete failure mode

## Current one-line policy statement

`passto-ai-frame` currently treats runtime execution as executor-owned, process-oriented, artifact-producing, and isolation-friendly; compatibility is bounded, parity claims are evidence-limited, and profile/tool-surface correctness is part of runtime correctness itself.
