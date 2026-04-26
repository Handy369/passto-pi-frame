# Fix extension-maker for workflow/system requirements

Repair extension-maker so it no longer downgrades system/workflow requirements into simple single-step tools.

## Goals
- Make extension-maker correctly detect workflow/system-style extension requirements.
- Add hard gates in spec and implementation-method generation for recursive/stateful/orchestrated systems.
- Add review rules that fail when a system requirement is implemented as a thin wrapper tool.
- Use `agent-web-search-pro` as the canonical failure case and regression target.
- Produce a concrete patch plan and implement the fixes in extension-maker if feasible.

## Scope
Focus on:
- /Users/handy/.pi/agent/extensions/extension-maker/index.ts
- /Users/handy/.pi/agent/extensions/extension-maker/SKILL.md
- /Users/handy/.pi/agent/extensions/extension-maker/references/review-rules.md
- any related extension-maker references/spec scaffolding

Reference target:
- /Users/handy/.pi/agent/extensions/agent-web-search-pro
- Original requirement source for `web_search_pro` provided by user

## Canonical Failure Case
`agent-web-search-pro` was supposed to be a recursive multi-round research engine with:
- knowledge pool
- recursive rounds
- sufficiency judgment
- gaps -> subqueries
- multi-engine adapters
- site strategy / agent-reach integration

But extension-maker generated only a single-step enhanced search tool.

This failure must become a regression benchmark.

## Deliverables
- A root-cause analysis recorded in this file
- A list of extension-maker failure modes
- A concrete implementation plan for fixing extension-maker
- Evidence of file changes
- Verification evidence from local reads/grep/checks
- If implemented: updated extension-maker code and rules
- A final summary explaining how the new gates prevent recurrence

## Checklist
- [x] Read Ralph capabilities relevant to this task
- [x] Read extension-maker current workflow prompts and hard gates
- [x] Read extension-maker review rules and identify missing behavior checks
- [x] Read generated `agent-web-search-pro` implementation and compare against original requirement
- [x] Write a concise root-cause section in this file
- [x] Define requirement categories for extension-maker
- [x] Define mandatory spec fields for workflow/system requirements
- [x] Define mandatory implementation-method fields for workflow/system requirements
- [x] Define mandatory review fail conditions for workflow/system requirements
- [x] Patch extension-maker prompts / rules / gates
- [x] Verify changes with local evidence
- [x] Record regression criteria using `agent-web-search-pro`
- [x] Finalize summary and mark complete only when all above are done

## Requirement Categories
Extension-maker should distinguish at least:
- simple-tool
- provider-wrapper
- stateful-workflow
- recursive-research-engine
- multi-agent-orchestrator

## Required Design Changes
The fix should likely include:
- requirement-type detection during intake/spec generation
- stronger spec schema expectations for workflow/system tasks
- stronger implementation-method contract requirements
- review rules that check required behaviors, not just file existence/API shape
- explicit “downgraded implementation” fail state
- clear distinction between:
  - provider-wrapper tools
  - workflow engines
  - recursive research systems

## Suggested Review Questions
Use these as hard checks:
- Does the requirement imply a multi-step stateful workflow?
- Does the implementation contain an orchestrator or main loop?
- Does it implement termination/sufficiency logic when required?
- Does it define intermediate state structures and knowledge models when required?
- Does it implement provider abstraction when multiple engines are requested?
- Is the generated extension merely exposing a provider call instead of implementing the requested system?

## Execution Principles
- Prefer structural fixes over prompt-only fixes.
- Do not stop at “better wording”; add hard validation gates.
- Treat `agent-web-search-pro` as a regression benchmark, not just an example.
- Fail fast if workflow/system requirement fields are missing.
- Record exact evidence for every claimed fix.
- Do analysis before edits.
- Do not batch many risky edits without verification.

## Verification
Capture evidence such as:
- rg matches showing new requirement categories
- rg matches showing new workflow-specific gates
- rg matches showing new review fail conditions
- relevant file paths and line references
- syntax checks / local validation results

## Notes
Use `agent-web-search-pro` as the benchmark failure case throughout.
Do not settle for cosmetic prompt tweaks only.
Prefer structural fixes and hard gates over advisory wording.

## Iteration Script

### Iteration 1 — Evidence-first diagnosis
Goals:
1. Read extension-maker core files.
2. Read current `agent-web-search-pro` implementation.
3. Write Root Cause Analysis before any code edits.

Required actions:
- Read `/Users/handy/.pi/agent/extensions/extension-maker/index.ts`
- Read `/Users/handy/.pi/agent/extensions/extension-maker/references/review-rules.md`
- Read `/Users/handy/.pi/agent/extensions/extension-maker/SKILL.md`
- Read `/Users/handy/.pi/agent/extensions/agent-web-search-pro/index.ts`
- Compare them against the original `web_search_pro` requirement
- Fill `## Root Cause Analysis`
- Fill `## Failure Modes`

Verification to record:
- exact file paths read
- key missing concepts found (e.g. no recursive loop, no knowledge pool, no sufficiency gate)

Stop condition for this iteration:
- Root Cause Analysis written
- No code edits yet unless absolutely necessary

---

### Iteration 2 — Design hard gates
Goals:
1. Turn the diagnosis into enforceable extension-maker rules.
2. Define requirement categories and mandatory fields.

Required actions:
- Define category model:
  - simple-tool
  - provider-wrapper
  - stateful-workflow
  - recursive-research-engine
  - multi-agent-orchestrator
- Write mandatory spec fields for workflow/system requirements
- Write mandatory implementation-method fields for workflow/system requirements
- Write mandatory review fail conditions for downgraded implementations
- Update this task file with concrete design decisions before patching code

Verification to record:
- list of required spec fields
- list of required implementation-method fields
- list of required review fail conditions

Stop condition for this iteration:
- Design decisions are written clearly enough that code patches can follow directly

---

### Iteration 3 — Patch extension-maker prompts and review rules
Goals:
1. Implement the rule changes in extension-maker.
2. Make review behavior fail on workflow downgrades.

Required actions:
- Patch `index.ts` prompts / gates so workflow/system requirements are detected and constrained
- Patch `review-rules.md` so review checks behavior, not only file presence/API shape
- Patch `SKILL.md` if needed to align workflow expectations
- Prefer minimal but structural edits over broad rewrites

Verification to record:
- `rg` evidence for new requirement category logic
- `rg` evidence for workflow-specific mandatory fields
- `rg` evidence for downgraded-implementation fail language
- any syntax validation evidence

Stop condition for this iteration:
- extension-maker source and rules are patched
- local evidence recorded

---

### Iteration 4 — Regression framing and sanity verification
Goals:
1. Confirm the new rules would catch `agent-web-search-pro`-style downgrade.
2. Finalize implementation summary.

Required actions:
- Re-check patched files
- Re-state how `agent-web-search-pro` would now fail review or be forced into stronger spec/method generation
- Fill `## Patch Summary`
- Fill `## Verification Evidence`
- Fill `## Final Summary`

Verification to record:
- exact rule/gate lines that would prevent recurrence
- clear statement of what is now enforced

Stop condition for this iteration:
- regression criteria documented
- summary complete

## Ralph Operator Prompt
When running this loop, prioritize:
1. diagnosis
2. hard-gate design
3. structural patching
4. verification

Do not skip from vague analysis directly to broad code edits.
Do not mark complete unless the regression benchmark is explicitly addressed.

## Suggested Start Parameters
- maxIterations: 20
- itemsPerIteration: 3
- reflectEvery: 4

## Root Cause Analysis

### Core Failure
`agent-web-search-pro` was specified as a **recursive multi-round research engine** (knowledge pool, recursive rounds, sufficiency judgment, gap detection → subqueries, multi-engine adapters, site strategy). Instead, extension-maker generated a **single-step search tool** with a linear adapter call (Tavily → optional deep-read of top 3 results → return). Zero recursive loop, zero knowledge pool, zero sufficiency gate, zero gap detection.

### Why the Downgrade Was Never Caught

**1. No Requirement Category Detection (Intake/Spec Phase)**
- extension-maker has ZERO concept of requirement categories. Every user request flows through the same 7-step pipeline regardless of complexity.
- The spec-intake-rules.md only says: "黑盒分析优先", "暴露方式先决", "Workflow 设计", "State Model", "Isolation", "Review".
- None of these distinguish between "simple API wrapper" and "recursive research engine".
- Result: The spec for agent-web-search-pro describes a linear 7-step workflow (Start → Normalize → Search/Fetch → Refine → Deep Read → Summarize → Return) that completely flattens the recursive requirement.

**2. Spec Generation Has No Mandatory Fields for System/Workflow Requirements**
- The generated spec has no field for: requirement category, complexity tier, mandatory behavioral properties, orchestration requirements.
- There is no schema requirement that forces the generator to specify: recursive loops, knowledge models, termination conditions, gap analysis.
- The `blackBoxAnalysis` section captures inputs/outputs/state but is purely advisory — nothing enfills it into implementation.

**3. Implementation-Method Generation Is Unconstrained**
- The implementation-method.json for agent-web-search-pro describes a single `executeSearchLikeFlow()` function. No orchestrator, no main loop, no knowledge pool structure, no sufficiency logic.
- The `implementationPlan.approach` field says "实现命令 + 工具双入口，统一通过 executeSearchLikeFlow()" — this is a single-step description for what should be a multi-round engine.
- Nothing in codegen-mapping.md says "if the requirement implies a recursive system, you MUST define an orchestrator loop in implementation-method".

**4. Review Rules Check API Shape, Not Behavior**
- The review-rules.md is entirely about: "从 docs 推导 API 签名 → 检查实现是否匹配签名".
- The 12 checks in the agent-web-search-pro review are ALL about: "registerCommand signature matches", "registerTool signature matches", "ctx.ui.notify usage correct", "state file path resolution correct", "output truncation correct".
- Zero checks about: "Does the implementation contain a recursive research loop?", "Does it implement sufficiency judgment?", "Does it have a knowledge pool?", "Is this a downgrade of the specified behavior?"
- The review passed with verdict="pass" despite being a massive behavioral downgrade.

**5. No Downgraded-Implementation Fail State**
- There is no concept of "downgraded implementation" anywhere in the review protocol.
- The review can only fail on: API signature mismatch, missing files, invalid JSON, docs inconsistency.
- It cannot fail on: "you implemented a search tool when the spec describes a research engine".

### Evidence Summary
| File | Missing Concept |
|------|----------------|
| spec-intake-rules.md | No requirement categories, no complexity analysis, no behavioral requirements |
| codegen-mapping.md | No "if workflow/system, then orchestrator loop required" rule |
| review-rules.md | No behavior verification, no downgrade detection |
| index.ts (Step 2 prompt) | No mandatory spec fields for workflow requirements |
| index.ts (Step 4 prompt) | No mandatory implementation-method fields for workflow requirements |
| review.json (agent-web-search-pro) | All 12 checks are API/structural, 0 are behavioral |

## Failure Modes

| # | Failure Mode | Root Location | Impact |
|---|---|---|---|
| F1 | No requirement category detection during intake | spec-intake-rules.md + Step 2 prompt | All requests treated identically regardless of complexity |
| F2 | Spec lacks mandatory fields for workflow/system requirements | Step 2 prompt + spec-intake-rules.md | Recursive/orchestration requirements silently dropped |
| F3 | Implementation-method lacks mandatory fields for workflow systems | Step 4 prompt + codegen-mapping.md | No orchestrator loop, knowledge model, or termination logic required |
| F4 | Review checks API shape only, not behavioral correctness | review-rules.md | Downgraded implementations pass review |
| F5 | No "downgraded implementation" fail condition | review-rules.md + Step 6 prompt | Review cannot detect when a system requirement is implemented as a thin wrapper |
| F6 | Black-box analysis is advisory, not enforceable | black-box-design-protocol.md | Analysis results never translate to implementation constraints |
| F7 | No complexity tier gating in the pipeline | index.ts (ext_maker_next) | Simple tool path and system engine path are identical

## Design Decisions (Iteration 2)

### Requirement Category Model
The extension-maker MUST classify each user request into one of these categories during Step 1/2:

| Category | Keyword Signals | Example |
|----------|----------------|---------|
| `simple-tool` | Single input → single output, no state, no multi-step | "format JSON", "copy to clipboard" |
| `provider-wrapper` | Wraps external API/CLI, thin transformation layer | "wrap Tavily API", "curl-based fetcher" |
| `stateful-workflow` | Multi-step user-facing flow, state machine, user confirmations | "multi-step setup wizard", "interactive code reviewer" |
| `recursive-research-engine` | Multi-round autonomous loop, knowledge accumulation, sufficiency judgment, gap detection | "recursive web researcher", "deep analysis engine" |
| `multi-agent-orchestrator` | Coordinates multiple sub-agents, delegation, aggregation | "team of specialized agents", "delegated task router" |

### Mandatory Spec Fields by Category

**ALL categories must have** (current baseline):
- `slug`, `name`, `description`, `userGoal`, `exposureMode`, `blackBoxAnalysis`, `workflow`, `interfaces`, `isolation`, `review`

**`stateful-workflow` and above must ADD**:
- `requirementCategory`: one of the 5 categories
- `complexityTier`: `"simple" | "moderate" | "complex" | "system"`
- `orchestrationRequirements`: array of { type, description } for loops, state machines, coordination
- `mandatoryBehaviors`: array of behavior descriptions that MUST appear in implementation
- `terminationCriteria`: description of when/how the system decides to stop

**`recursive-research-engine` and `multi-agent-orchestrator` must ALSO ADD**:
- `knowledgeModel`: structure for accumulated knowledge/state across rounds
- `roundControl`: { maxRounds, sufficiencyCheck, gapDetection, subqueryStrategy }
- `multiRoundLoop`: explicit description of the main orchestrator loop

### Mandatory Implementation-Method Fields by Category

**ALL categories must have** (current baseline):
- `exposureStrategy`, `stateStrategy`, `filePathStrategy`, `uiApiUsage`, `implementationPlan`

**`stateful-workflow` and above must ADD**:
- `orchestratorDesign`: description of main control flow / state machine
- `behaviorContract`: mapping from spec's `mandatoryBehaviors` to implementation approach

**`recursive-research-engine` and `multi-agent-orchestrator` must ALSO ADD**:
- `loopDesign`: { entryCondition, bodyDescription, terminationCondition, maxIterations, stateAccumulation }
- `knowledgeStructure`: how knowledge/information is accumulated across rounds
- `sufficiencyLogic`: how the system decides when to stop

### Mandatory Review Fail Conditions (NEW)

The review MUST fail (verdict="fail") if ANY of the following are detected:

1. **CATEGORY_MISMATCH**: The implementation does not contain the structural elements required by the spec's `requirementCategory`. E.g., spec says `recursive-research-engine` but implementation has no main loop.
2. **MISSING_ORCHESTRATOR**: For `recursive-research-engine` / `multi-agent-orchestrator`, no orchestrator function / main loop exists in the code.
3. **MISSING_TERMINATION_LOGIC**: For categories requiring `terminationCriteria`, no termination/sufficiency logic exists.
4. **MISSING_KNOWLEDGE_MODEL**: For `recursive-research-engine`, no knowledge accumulation structure exists.
5. **SINGLE_STEP_DOWNGRADE**: The spec describes a multi-round/multi-step system but the implementation is a single-step function call with no loop or state machine.
6. **BEHAVIOR_MISSING**: Any item in spec's `mandatoryBehaviors` is not implemented in code.
7. **WRONG_COMPLEXITY_TIER**: Implementation complexity is below spec's `complexityTier`.

### Where Changes Will Be Made

| File | Change |
|------|--------|
| `references/spec-intake-rules.md` | Add requirement categories, mandatory fields by category, category detection rules |
| `references/codegen-mapping.md` | Add implementation-method mandatory fields by category |
| `references/review-rules.md` | Add behavioral fail conditions, downgrade detection |
| `index.ts` (buildPrompt Step 2) | Add mandatory spec field instructions based on detected category |
| `index.ts` (buildPrompt Step 4) | Add mandatory implementation-method field instructions |
| `index.ts` (buildStrictJsonReviewPrompt) | Add category-aware review instructions |
| `index.ts` (ext_maker_next Step 2→3 gate) | Add spec schema validation for mandatory fields |

## Patch Summary

### Files Modified
1. **`references/spec-intake-rules.md`** (rewritten, 3392 bytes)
   - Added 5-level requirement category model: simple-tool, provider-wrapper, stateful-workflow, recursive-research-engine, multi-agent-orchestrator
   - Added category detection rules with signal keywords
   - Added mandatory spec fields by category (orchestrationRequirements, mandatoryBehaviors, terminationCriteria, knowledgeModel, roundControl, multiRoundLoop)
   - Added JSON schema example for recursive-research-engine

2. **`references/codegen-mapping.md`** (rewritten, 4189 bytes)
   - Added Section 0.5: Category-to-implementation-structure mapping
   - Added mandatory implementation-method fields by category (orchestratorDesign, behaviorContract, loopDesign, knowledgeStructure, sufficiencyLogic)
   - Added downgrade implementation prohibition rules

3. **`references/review-rules.md`** (rewritten, 4462 bytes)
   - Added Section 3: Category-Aware Review with 7 downgrade detection checks
   - Added mandatory review fail conditions: CATEGORY_MISMATCH, MISSING_ORCHESTRATOR, MISSING_TERMINATION, MISSING_KNOWLEDGE_MODEL, SINGLE_STEP_DOWNGRADE, BEHAVIOR_MISSING, WRONG_COMPLEXITY
   - Added required review order: Category → Downgrade → Behavior → API → State/Isolation
   - Added `categoryConsistencyCheck` to required review.json schema

4. **`index.ts`** (modified, 58742 bytes)
   - Step 2 prompt: Added mandatory category classification, mandatory spec fields, downgrade prevention instruction
   - Step 4 prompt: Added mandatory implementation-method fields for workflow/system categories, downgrade prevention instruction
   - Step 6 prompt: Added category consistency check, downgrade detection, behavior coverage check, ordered review steps
   - buildStrictJsonReviewPrompt: Added categoryConsistencyCheck to JSON shape, added 3 CRITICAL review instructions
   - ext_maker_next Step 2→3 gate: Added spec schema validation for workflow/system mandatory fields (orchestrationRequirements, mandatoryBehaviors, terminationCriteria, knowledgeModel, roundControl, multiRoundLoop)
   - ext_maker_next Step 4→5 gate: Added implementation-method schema validation for workflow/system mandatory fields (orchestratorDesign, behaviorContract, loopDesign, knowledgeStructure, sufficiencyLogic)

## Verification Evidence

### 1. Requirement Categories in spec-intake-rules.md
```
grep -n "requirementCategory" references/spec-intake-rules.md → lines 7, 43, 63
grep -n "recursive-research-engine\|multi-agent-orchestrator\|stateful-workflow" references/spec-intake-rules.md → lines 19-25, 44-46, 63-82
```

### 2. Mandatory Fields in codegen-mapping.md
```
grep -n "loopDesign\|knowledgeStructure\|sufficiencyLogic" references/codegen-mapping.md → lines 27-46
grep -n "downgrade" references/codegen-mapping.md → lines 52-55
```

### 3. Downgrade Detection in review-rules.md
```
grep -n "SINGLE_STEP_DOWNGRADE\|CATEGORY_MISMATCH\|MISSING_ORCHESTRATOR" references/review-rules.md → lines 47-51
grep -n "categoryConsistencyCheck" references/review-rules.md → lines 90-97
```

### 4. Hard Gates in index.ts
```
grep -n "spec-missing-workflow-fields\|spec-missing-system-fields" index.ts → lines 746, 766
grep -n "method-missing-workflow-fields\|method-missing-system-fields" index.ts → lines 821, 841
grep -n "MANDATORY.*requirementCategory\|MANDATORY.*mandatoryBehaviors" index.ts → lines 306, 310
grep -n "SINGLE_STEP_DOWNGRADE" index.ts → lines 265, 314
```

### 5. Syntax Validation
- Balanced braces: 0 (correct)
- Balanced parens: 0 (correct) 
- Balanced brackets: 0 (correct)
- File size: 58742 bytes

### 6. Regression: How agent-web-search-pro Would Now Fail
If the agent-web-search-pro spec were re-generated with these rules:
1. **Step 2 gate**: The spec would need `requirementCategory: "recursive-research-engine"`, `mandatoryBehaviors` array with multi-round loop, knowledge pool, sufficiency judgment, gap detection. If the agent tries to generate a linear 7-step workflow → blocked at Step 2→3 gate with reason `spec-missing-system-fields`.
2. **Step 4 gate**: The implementation-method would need `loopDesign`, `knowledgeStructure`, `sufficiencyLogic`. If the agent generates a single `executeSearchLikeFlow()` → blocked at Step 4→5 gate with reason `method-missing-system-fields`.
3. **Step 6 review**: Even if it somehow bypassed the gates, the review would detect `SINGLE_STEP_DOWNGRADE` — spec describes multi-round system but implementation is a single API call → `verdict: fail` with criticalIssue.

## Final Summary

The extension-maker now has **structural gates** at 4 levels that prevent system/workflow requirements from being downgraded:

1. **Spec Generation (Step 2)**: Forces category classification and mandatory behavioral fields
2. **Spec Validation (Step 2→3 gate)**: Hard gate blocks progression if mandatory fields are missing
3. **Implementation-Method Generation (Step 4)**: Forces orchestrator/loop/knowledge model definitions
4. **Implementation-Method Validation (Step 4→5 gate)**: Hard gate blocks progression if mandatory fields are missing
5. **Review (Step 6)**: Category-aware review with explicit downgrade detection fail conditions
6. **Review Prompt to Subagent**: Explicitly instructs the isolated reviewer to check for SINGLE_STEP_DOWNGRADE and category mismatches

This is not cosmetic prompt wording — these are executable gates in `ext_maker_next` that check JSON schemas, and explicit fail conditions in `review-rules.md` that the isolated subagent reviewer must enforce.
