# Passto Executor Phase 4 Milestone 3 — Compatibility Expansion Plan

## Purpose

This document narrows Phase 4 down to Milestone 3 only:

- expand compatibility beyond the first narrow adapter flow
- improve real migration value for callers with legacy-style invocation shapes
- keep compatibility explicit and honest without implying a full historical shell

This is the third actionable implementation slice of Phase 4.

## Milestone goal

Move from:
- one narrow adapter: `legacyRequestToInvocation(request)`
- constrained legacy request-field support
- migration docs centered on a single path

To:
- broader compatibility tiers
- clearer adaptation of request + options + result surfaces where needed
- more practical migration guidance for real callers

## Scope

### In scope
- broader compatibility request-shape adaptation
- legacy execution-options adaptation where useful
- limited result-shape compatibility only when required by downstream callers
- clearer compatibility entrypoint policy
- more examples/tests/docs for migration scenarios

### Out of scope
- a full `subagent` historical command shell
- TUI/render compatibility layers
- Ralph/subagent child-runtime parity work
- compatibility claims that exceed the actual executor/runtime surface
- speculative support for every historical call shape

---

## Recommended implementation posture

Keep compatibility as a migration surface, not a second executor architecture.

Prefer:
- staged compatibility tiers
- explicit unsupported areas
- small adapters that map into the normal executor path
- result shaping only where there is a real downstream need
- documentation that preserves runtime honesty

The target is not “perfect backward compatibility.”
The target is “useful migration coverage with bounded scope.”

---

## Proposed compatibility model

### Suggested tiering
The next compatibility layers should likely be:

1. **Request adaptation**
   - broaden supported request fields and shapes
2. **Request + options adaptation**
   - adapt more legacy execution options into executor runtime/execution policy
3. **Targeted result adaptation**
   - only where a caller genuinely needs a compatibility-facing result shape

### Suggested guiding rule
Every compatibility flow should still preserve the executor spine:

`legacy request -> invocation -> assembly -> execution -> optional compatibility result mapping`

That keeps compatibility additive and prevents it from bypassing the Phase 3/4 substrate.

### First expansion priorities
Recommended first additions:

- broader request-field support
- legacy execution-options adaptation
- compatibility documentation for staged migration paths

Delay result-shape compatibility unless a concrete consumer requires it.

---

## Execution checklist

### 1. Lock compatibility scope for Milestone 3
- [ ] Define the supported compatibility tiers for this milestone
- [ ] Decide whether Milestone 3 includes:
  - [ ] request adaptation only
  - [ ] request + options adaptation
  - [ ] targeted result shaping
- [ ] List explicit non-goals for compatibility so docs stay honest

### 2. Expand request adaptation
- [ ] Review the current legacy request shape and identify the next useful fields
- [ ] Decide whether multiple legacy request variants need separate adapter functions
- [ ] Add broader request-field mapping where justified
- [ ] Preserve a clean mapping into `ExecutorInvocation`
- [ ] Keep caller/source provenance explicit in compatibility-generated invocations

### 3. Add options adaptation
- [ ] Define which legacy execution options are worth adapting now
- [ ] Map legacy options into executor runtime/execution policy where coherent
- [ ] Avoid options that imply unsupported runtime parity
- [ ] Decide whether options adaptation lives in the same adapter or a separate helper

### 4. Decide result adaptation posture
- [ ] Determine whether any downstream consumer actually requires compatibility-shaped results
- [ ] If yes, define a minimal compatibility result mapper
- [ ] If no, explicitly defer result shaping and document that decision
- [ ] Avoid inventing a large response-compatibility surface without real demand

### 5. Clarify compatibility entrypoint policy
- [ ] Decide whether compatibility remains helper-only
- [ ] Or whether it gains a more explicit surfaced entrypoint/package path
- [ ] Keep the root API honest about what is stable vs transitional migration support

### 6. Add tests
- [ ] Broader request-shape adaptation test
- [ ] Options-adaptation test
- [ ] Provenance/caller-shaping test for compatibility-generated invocations
- [ ] Result-adaptation test only if result mapping is added
- [ ] Compatibility behavior test under supported execution modes relevant to the adapters

### 7. Update docs/examples
- [ ] Update `compatibility/README.md`
- [ ] Update `compatibility/MIGRATION_GUIDE.md`
- [ ] Add one or more new compatibility examples
- [ ] Document staged migration recipes:
  - [ ] legacy request path
  - [ ] invocation path
  - [ ] task-document path
- [ ] Keep runtime limitation wording consistent with existing notes

---

## Likely target files

Core compatibility files:
- `compatibility/legacy-invocation-adapter.ts`
- new compatibility adapter/helper files if needed
- `compatibility/README.md`
- `compatibility/MIGRATION_GUIDE.md`

Potential package/export surface touchpoints:
- `index.ts`
- possible future compatibility barrel if adopted later

Tests/examples:
- `test/compatibility.test.mjs`
- additional compatibility-focused test files if separation is cleaner
- `examples/` with one or more new Phase 4 compatibility examples

---

## Suggested implementation order

### Step 1 — Freeze supported tiers first
Do first:
- decide whether this milestone includes result shaping or not
- decide which options are worth adapting
- define explicit compatibility non-goals

This prevents silent scope creep.

### Step 2 — Expand request and options adaptation
Do next:
- broaden request mapping
- add options mapping
- keep generated invocation provenance explicit

### Step 3 — Add tests before broad docs claims
Then:
- verify each new supported shape with tests
- verify unsupported areas still fail/omit honestly

### Step 4 — Update migration docs and examples
Only after behavior is stable:
- write staged migration guidance
- add realistic examples
- document what still is not supported

---

## Definition of done for Milestone 3

Milestone 3 is complete when:

- [ ] compatibility supports more than one narrow adapter pathway
- [ ] broader request adaptation is implemented and tested
- [ ] legacy execution-options adaptation exists where justified
- [ ] compatibility-generated invocations preserve clear provenance
- [ ] result adaptation is either minimally implemented or explicitly deferred
- [ ] migration docs/examples are practical and honest
- [ ] compatibility still does not imply a full historical shell

## Practical warning

Do not let Milestone 3 turn into a full backward-compatibility program.

Good Milestone 3 outcome:
- more real caller migration coverage exists
- adapter scope is clearer
- tests are stronger
- docs are practical

Bad Milestone 3 outcome:
- response/TUI/render parity gets pulled in prematurely
- adapter logic bypasses the main executor pipeline
- compatibility promises more than the runtime can actually support
