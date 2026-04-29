# Passto Executor Phase 4 Milestone 4 — API Convergence Plan

## Purpose

This document narrows Phase 4 down to Milestone 4 only:

- shrink and stabilize the root public API
- separate stable public exports from advanced/internal ones
- align package metadata and docs with the intended integration surface

This is the fourth actionable implementation slice of Phase 4.

## Milestone goal

Move from:
- a convenient but broad root `index.ts`
- internal helpers exposed as incidental public API
- package metadata/docs that still reflect an evolving internal-first surface

To:
- a clearer stable root API
- explicit secondary entrypoints or advanced/internal access paths if adopted
- tighter package metadata and documentation alignment

## Scope

### In scope
- root export-surface narrowing
- definition of stable public API
- secondary entrypoints if adopted
- package metadata updates needed for the chosen export policy
- docs resync for the chosen API surface
- light smoke checks for intended entrypoints if useful

### Out of scope
- large directory renames without functional need
- rewriting executor internals just to fit a new export shape
- full package publishing/distribution work beyond local package metadata needs
- compatibility expansion beyond what affects public API placement
- Ralph/subagent child-runtime parity work

---

## Recommended implementation posture

Keep Milestone 4 disciplined and conservative.

Prefer:
- a small stable root API
- explicit advanced/internal access paths if needed
- minimal import-path churn for the most important user-facing entrypoints
- docs that match the chosen package story exactly

The target is not “perfect package architecture.”
The target is “a safer and more intentional integration surface.”

---

## Proposed API model

### Stable root API
The root package surface should center on durable user-facing concepts.

Recommended root runtime exports:

- `executeInvocation`
- `executeTaskDoc`
- `taskDocToInvocation`
- `assembleExecutorContext`
- `legacyRequestToInvocation`

Recommended root public types:

- `ExecutorInvocation`
- `ResolvedExecutorContext`
- `ExecutorRunResult`
- `ExecutorRuntimePolicy`
- `SandboxCleanupPolicy`

### Advanced/internal surface
The following are useful but should not necessarily remain implied stable root API forever:

- low-level execution helpers
- runtime-param builder helpers
- scheduler internals
- run-index helpers
- lower-level store helpers
- sandbox backend implementations

If still needed externally, prefer secondary entrypoints rather than root export sprawl.

### Suggested entrypoint posture
If Phase 4 adopts secondary entrypoints, the likely model is:

- `@handy/passto-executor` — stable public API
- `@handy/passto-executor/executor-core` — advanced/internal executor surface
- `@handy/passto-executor/compatibility` — compatibility-facing exports

This aligns with the post-Phase-3 structure without forcing large directory changes.

---

## Execution checklist

### 1. Freeze the public API policy
- [ ] Define which functions/types belong in the stable root API
- [ ] Define which exports are advanced/internal
- [ ] Decide whether compatibility helpers stay at root or move behind a dedicated secondary entrypoint
- [ ] Decide whether `StrategySandboxManager` belongs in stable public API or advanced/internal surface

### 2. Choose entrypoint structure
- [ ] Decide whether Phase 4 adopts secondary entrypoints now
- [ ] If yes, define target entrypoints:
  - [ ] root package entrypoint
  - [ ] `executor-core` entrypoint
  - [ ] `compatibility` entrypoint
- [ ] Decide whether any transitional duplicate exports are needed to reduce churn

### 3. Narrow the root export surface
- [ ] Review current `index.ts` exports one by one
- [ ] Keep only intentionally stable exports at root
- [ ] Move advanced/internal exports behind secondary entrypoints if adopted
- [ ] Avoid breaking the most important user-facing flows unnecessarily

### 4. Update package metadata
- [ ] Update `package.json` if an export map is introduced
- [ ] Ensure metadata reflects the chosen public API story
- [ ] Recheck description/keywords only if needed for consistency
- [ ] Ensure Pi extension entrypoint expectations remain intact

### 5. Resync docs
- [ ] Update `README.md` package entrypoints section
- [ ] Update directory/export notes if needed
- [ ] Update compatibility docs if compatibility entrypoint placement changes
- [ ] Keep examples aligned with the chosen package import paths

### 6. Add validation checks
- [ ] Add smoke checks for intended import entrypoints if useful
- [ ] Verify the stable root API supports the main documented workflows
- [ ] Verify advanced/internal surfaces remain reachable where intentionally allowed

---

## Likely target files

Core package surface:
- `index.ts`
- possible new barrel files such as:
  - `executor-core/index.ts`
  - `compatibility/index.ts`

Package metadata:
- `package.json`

Docs:
- `README.md`
- `compatibility/README.md`
- `DIRECTORY_AND_EXPORT_SURFACE_PROPOSAL.md` if a brief post-decision sync is helpful

Tests/checks:
- smoke checks for import entrypoints if added

---

## Suggested implementation order

### Step 1 — Define the stable API first
Do first:
- decide what the root API promises
- decide what remains advanced/internal
- decide whether secondary entrypoints are worth the extra complexity now

This avoids accidental export churn later.

### Step 2 — Reshape exports minimally
Do next:
- adjust `index.ts`
- add secondary barrels only if the chosen policy truly needs them
- avoid touching internal module boundaries without necessity

### Step 3 — Update metadata and docs immediately after
Then:
- align `package.json`
- align README/docs/examples
- make the package story readable to external consumers

### Step 4 — Add smoke checks last
Only after the export shape settles:
- validate intended import paths
- catch accidental package-surface regressions

---

## Definition of done for Milestone 4

Milestone 4 is complete when:

- [ ] the root export surface is smaller and intentionally stable
- [ ] advanced/internal surfaces are clearly separated
- [ ] secondary entrypoints exist if that design is adopted
- [ ] package metadata matches the chosen export policy
- [ ] docs/examples use the intended import paths consistently
- [ ] import entrypoints are validated well enough to avoid accidental regressions

## Practical warning

Do not let Milestone 4 turn into a cosmetic package refactor.

Good Milestone 4 outcome:
- root API is clearer
- internal flexibility improves
- docs are more accurate
- package consumers have a better mental model

Bad Milestone 4 outcome:
- large import churn for little value
- unnecessary directory moves
- over-designed layering before actual consumers need it
