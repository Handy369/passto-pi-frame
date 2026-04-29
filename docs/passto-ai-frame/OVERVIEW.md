# Passto AI Frame Overview

## What this project is

`passto-ai-frame` is the broader system design that `passto-executor` is intended to serve.

It is not only a child-process launcher and not only a compatibility wrapper around older `subagent` flows.
It is a layered execution and development frame intended to support:
- task-driven execution
- orchestrated multi-agent or multi-perspective work
- isolated workspace execution
- builder / operator workflows
- eventually self-hosted development loops

## Current implementation center

Today, the most mature implemented part of the frame is:
- `extensions/passto-executor`

That package now provides the strongest concrete substrate for the frame design:
- `task.md` parsing and invocation shaping
- assembled executor context
- execution orchestration
- sandboxed execution
- run persistence
- compatibility adapters
- bounded package/API surface

## Core design posture

The current system should be understood as:
- `task.md` as a stable execution contract
- invocation shaping by an upstream caller or orchestrator
- executor-owned assembly into a resolved runtime context
- process-oriented child execution inside an isolated workspace
- explicit run artifacts, events, and reviewable results

Core path:

`task.md -> invocation -> assembly -> resolved context -> execution`

## Relationship to `pi-subagent`

`passto-ai-frame` grows out of practical experience with `pi-subagent`, but it is not intended to remain only a parameter reshaping shell around historical subagent behavior.

The main design shift is:
- move from ad-hoc one-shot delegation semantics
- toward a more explicit execution-container model

That shift is now visible in `passto-executor`, especially after Phase 4.1:
- executor child lifecycle is process-oriented
- executor normalizes child completion to `process-exit`
- caller-supplied `agent-end` preferences do not control executor child shutdown behavior

## What is already real

Implemented and verified today in `passto-executor`:
- `single`, `sequential`, `parallel`, and bounded `dag` execution support
- temp-copy and worktree sandbox strategies
- file-backed run storage and readback
- compatibility migration helpers for legacy-style requests
- narrowed root package API plus secondary entrypoints
- clearer runtime posture around Ralph/subagent-capable child execution

## What is not yet fully built

The broader frame still needs stronger top-layer productization around:
- orchestrator-to-invocation shaping
- preset / role / model / skill resolution
- memory/context layering
- builder/operator workflows
- self-hosted bootstrap flows
- deeper end-to-end parity coverage through executor-managed Ralph paths

## Current one-line summary

`passto-ai-frame` is becoming a layered execution frame whose first mature foundation is `passto-executor`: a process-oriented execution container with task-doc inputs, isolated workspaces, persisted run artifacts, and bounded compatibility support.
