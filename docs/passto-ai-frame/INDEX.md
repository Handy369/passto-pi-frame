# Passto AI Frame Documentation Index

## Purpose

This directory collects the current in-repo design documents for `passto-ai-frame`.

These docs are intended to provide:
- a top-level understanding of the frame
- the relationship between the frame and `passto-executor`
- the current architecture and runtime posture
- the roadmap from completed executor phases into the next frame-level phase

If you are reading this area for the first time, start here.

## Recommended reading order

### 1. Overview
- `OVERVIEW.md`
  - what `passto-ai-frame` is
  - what is already implemented today
  - how `passto-executor` fits into the broader frame

### 2. Architecture
- `ARCHITECTURE.md`
  - system layers and boundaries
  - task-doc path vs direct invocation path
  - executor assembly and execution model
  - artifact flow and package relationships

### 3. Runtime posture
- `RUNTIME_POSTURE.md`
  - process-oriented lifecycle policy
  - executor vs caller responsibility boundary
  - compatibility posture
  - runtime parity and profile/tool-surface discipline

### 4. Roadmap
- `ROADMAP.md`
  - summary of completed executor phases
  - mapping from executor hardening into frame-level development
  - recommended Phase 5 direction

## Relationship to executor phase documents

The most detailed implementation history still lives under:
- `extensions/passto-executor/`

Important executor references include:
- `extensions/passto-executor/PHASE4_EXECUTION_INDEX.md`
- `extensions/passto-executor/PHASE4_REVIEW_NOTE.md`
- `extensions/passto-executor/PHASE4_1_RUNTIME_PARITY_REVIEW_NOTE.md`
- `extensions/passto-executor/PHASE4_AND_4_1_HANDOFF_NOTE.md`
- `extensions/passto-executor/PHASE5_PLAN.md`

Use those when you need:
- implementation-phase detail
- milestone-level planning context
- runtime parity investigation evidence
- concrete next-phase executor/frame planning

## Current documentation set in one sentence

Together, these docs say that `passto-ai-frame` is evolving into a layered workflow system built on top of `passto-executor`, which is now mature enough to serve as a process-oriented execution substrate with isolated workspaces, persisted artifacts, bounded compatibility, and a clearer runtime posture.
