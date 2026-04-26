# Implement agent-web-search-pro v2 as a research workflow

Upgrade `agent-web-search-pro` from a single-step enhanced search tool into a structured research workflow.

## Mission
Implement v2 so the extension supports:
- planning a research question
- searching candidate pages
- selecting pages to browse
- extracting query-focused evidence
- synthesizing current evidence into sufficient / insufficient judgments
- returning structured outputs for both humans and LLM agents

Do not treat this as a UI polish task.
Do not stop at better summaries or prompt wording.
This is a workflow and architecture upgrade.

## Primary Goals
- Introduce workflow-first architecture for `agent-web-search-pro`
- Add phase-specific tools:
  - `ext_agent_web_search_pro_plan_research`
  - `ext_agent_web_search_pro_search` (upgraded role)
  - `ext_agent_web_search_pro_browse_pages`
  - `ext_agent_web_search_pro_synthesize_research`
- Add shared types and basic knowledge model
- Preserve and reuse existing provider infrastructure where reasonable
- Make outputs more consumable by LLMs and more legible to humans
- Prepare the codebase for later recursive multi-round research loops

## Phase Targets

### Phase 1 (required)
Implement:
- `types.ts`
- `providers/` extraction where feasible
- `workflow/plan-research.ts`
- `workflow/search-round.ts`
- `workflow/browse-pages.ts`
- `workflow/synthesize-research.ts`
- updated `index.ts` registration and orchestration
- upgraded search output:
  - `searchMeta`
  - `webResults`
  - `recommendedToBrowse`
- browse output:
  - `browseMeta`
  - `pageAnalyses`
  - `adoptedKnowledge`
- synthesis output:
  - `sufficient`
  - `coveredAspects`
  - `missingAspects`
  - `gaps`
  - `answer?`
  - `sources?`

### Phase 2 (stretch goal)
If Phase 1 is solid and verified, optionally add:
- internal `ResearchState`
- `runResearchLoop`
- `max_rounds`
- `nextSuggestedSubQueries`
- basic recursive orchestration

## Scope
Primary target directory:
- /Users/handy/.pi/agent/extensions/agent-web-search-pro

Reference context:
- original web_search_pro requirement from user
- v2 research-workflow spec and implementation blueprint already discussed in conversation

Preserve useful existing parts where possible:
- Tavily integration
- Jina Reader integration
- curl fallback
- config loading
- onUpdate progress messaging
- existing command/tool registration patterns if still valid

## Non-Goals
Do NOT prioritize these before workflow architecture is in place:
- adding every search provider
- polishing CLI copy only
- building the final perfect recursive loop first
- advanced ranking models
- UI-only observability changes without structural outputs

## Required Architecture Outcomes
By the end of Phase 1, the code should no longer behave like a single-step tool pretending to be a research engine.

It should instead have:
- explicit workflow stages
- clear tool boundaries
- reusable shared types
- outputs that distinguish:
  - planning
  - searching
  - browsing
  - synthesizing

## Required Tool Outcomes

### 1) plan_research
Must accept:
- `query`
- optional `context`
- optional `includeSites`
- optional `engines`

Must return:
- `originalQuery`
- `researchPlan.aspects`
- `researchPlan.initialSubQueries`
- `researchPlan.suggestedSiteTypes`
- `researchPlan.suggestedEngines`
- `researchPlan.planningNotes`

### 2) search
Must evolve from “final answer-ish search tool” into “candidate discovery tool”.
Must return:
- `searchMeta`
- `webResults`
- `recommendedToBrowse`
- `researchStatus`

### 3) browse_pages
Must accept:
- `focusQuery`
- `urls`
- optional `maxPages`

Must return:
- `browseMeta`
- `pageAnalyses`
- `adoptedKnowledge`
- `rejectedPages`

### 4) synthesize_research
Must accept:
- `originalQuery`
- `knowledge`
- optional `round`
- optional `maxRounds`

Must return:
- `sufficient`
- `confidence`
- `coveredAspects`
- `missingAspects`
- `gaps`
- `answer?`
- `sources?`
- `nextSuggestedSubQueries?`

## Required Data Model
Introduce shared types for at least:
- `ResearchPlan`
- `SearchCandidate`
- `RecommendedPage`
- `PageAnalysis`
- `KnowledgeItem`
- `SufficiencyResult`

If feasible, also add:
- `ResearchState`

## Constraints
- Prefer gradual refactoring over full rewrite.
- Keep the extension working during refactor as much as practical.
- Reuse existing provider logic.
- Avoid giant new monolithic functions.
- Avoid leaving orchestration logic buried in one oversized `index.ts`.
- Record evidence for each structural change.

## Acceptance Criteria

### Architecture
- Shared types exist in a dedicated file
- Workflow logic is split into workflow modules
- Provider logic is separated from workflow logic
- `index.ts` becomes thinner than before

### Behavior
- There is a working planning stage
- There is a working search stage with `recommendedToBrowse`
- There is a working browse stage with extracted facts/quotes/summaries
- There is a working synthesis stage with `sufficient/gaps`

### Product semantics
- The extension now exposes research workflow semantics instead of only provider semantics
- A human or LLM can see:
  - what was planned
  - what was searched
  - what was browsed
  - what is covered
  - what is still missing

### Regression intent
- The extension should clearly move toward the original recursive-research intent
- It should no longer be reasonably described as “just a search wrapper with deepRead”

## Deliverables
- Updated code in `/Users/handy/.pi/agent/extensions/agent-web-search-pro`
- This task file updated with:
  - progress
  - decisions
  - evidence
  - blockers
- A final summary of:
  - what Phase 1 completed
  - what remains for Phase 2
  - what was intentionally deferred
- Verification evidence from file reads, searches, and sanity checks

## Checklist
- [ ] Read current `agent-web-search-pro/index.ts`
- [ ] Identify reusable provider/config/progress code
- [ ] Define and add shared types in `types.ts`
- [ ] Extract or create provider modules as needed
- [ ] Implement `workflow/plan-research.ts`
- [ ] Refactor search behavior into `workflow/search-round.ts`
- [ ] Implement `workflow/browse-pages.ts`
- [ ] Implement `workflow/synthesize-research.ts`
- [ ] Update `index.ts` to register v2 workflow tools
- [ ] Preserve or adapt existing search entry for compatibility where sensible
- [ ] Verify tool outputs are workflow-shaped
- [ ] Record evidence for new files and tool registrations
- [ ] Record evidence for key output fields
- [ ] Write final Phase 1 summary
- [ ] Only then consider Phase 2 loop work

## Iteration Script

### Iteration 1 — Read and map current implementation
Goals:
1. Read current code thoroughly.
2. Identify which existing code should be preserved vs relocated.
3. Produce a concrete mapping from current code to v2 modules before editing.

Required actions:
- Read `/Users/handy/.pi/agent/extensions/agent-web-search-pro/index.ts`
- Read config-related files if needed
- Identify:
  - provider logic
  - config logic
  - URL reading logic
  - search result shaping logic
  - current tool registration logic
- Write a “Current-to-v2 mapping” section in this file

Verification to record:
- files read
- reusable components found
- oversized/mixed-responsibility areas found

Stop condition:
- mapping section written
- no major edits yet unless small safe extraction only

---

### Iteration 2 — Define types and module boundaries
Goals:
1. Create the shared type system.
2. Lock the module architecture.

Required actions:
- Add `types.ts`
- Define workflow module responsibilities
- If appropriate, create empty or scaffolded workflow/provider files
- Write a “Module plan” section in this task file

Verification to record:
- exact file paths created
- type names introduced
- any new folder structure

Stop condition:
- shared types exist or are scaffolded
- module boundaries are clear

---

### Iteration 3 — Implement planning and upgraded search
Goals:
1. Add `plan_research`
2. Upgrade `search` into a candidate discovery stage

Required actions:
- Implement `workflow/plan-research.ts`
- Implement or refactor `workflow/search-round.ts`
- Register or wire `plan_research`
- Refactor existing `search` output shape to include:
  - `searchMeta`
  - `webResults`
  - `recommendedToBrowse`
  - `researchStatus`

Verification to record:
- file paths changed
- tool registration evidence
- grep/read evidence for new output fields

Stop condition:
- planning exists
- search is no longer only provider-output-shaped

---

### Iteration 4 — Implement browse_pages
Goals:
1. Add true browse-stage semantics.
2. Extract evidence instead of only returning raw text/snippets.

Required actions:
- Implement `workflow/browse-pages.ts`
- Reuse Jina/curl/fetch logic if possible
- Return:
  - `browseMeta`
  - `pageAnalyses`
  - `adoptedKnowledge`
  - `rejectedPages`

Verification to record:
- file paths changed
- evidence of new browse tool registration
- evidence of `keyFacts`, `keyQuotes`, `summary`, `adoptedKnowledge`

Stop condition:
- browse stage exists as a first-class workflow phase

---

### Iteration 5 — Implement synthesize_research
Goals:
1. Add sufficiency semantics.
2. Stop treating “search results” as equivalent to “research answer”.

Required actions:
- Implement `workflow/synthesize-research.ts`
- Return:
  - `sufficient`
  - `confidence`
  - `coveredAspects`
  - `missingAspects`
  - `gaps`
  - optional `answer`
  - optional `sources`
- Wire tool registration

Verification to record:
- file paths changed
- evidence of new synthesis fields
- explanation of sufficiency heuristics used

Stop condition:
- synthesis stage exists and exposes sufficient/gaps

---

### Iteration 6 — Integration cleanup and Phase 1 verification
Goals:
1. Ensure v2 phases fit together coherently.
2. Thin down `index.ts` if possible.
3. Record final Phase 1 outcome.

Required actions:
- Re-read updated `index.ts`
- Check all v2 tools are registered and wired
- Verify shared types and workflow modules exist
- Record Phase 1 completion summary
- Record Phase 2 backlog explicitly

Verification to record:
- grep evidence for tool names
- grep evidence for core type names
- grep evidence for workflow module imports
- any sanity checks available

Stop condition:
- Phase 1 deliverables completed and documented

---

### Iteration 7+ — Optional Phase 2 loop work
Only start if Phase 1 is solid.
Possible actions:
- add `ResearchState`
- add `runResearchLoop`
- add `max_rounds`
- add `nextSuggestedSubQueries`
- add basic gaps -> next-step orchestration

Do not start Phase 2 if Phase 1 outputs are still weak or unclear.

## Execution Principles
- Architecture first, wording second.
- Workflow semantics first, UI polish second.
- Preserve useful code, but do not preserve the wrong mental model.
- Search is only one phase of research.
- Browsing and synthesis must be explicit phases.
- Always record concrete evidence.
- Do not claim completion without Phase 1 acceptance criteria satisfied.

## Verification
Capture evidence such as:
- file tree changes
- new type definitions
- new workflow modules
- new tool registrations
- output field names
- line references
- any sanity-check commands or reads

## Notes
If a tradeoff is needed:
- choose clearer workflow semantics over backward-compatible but misleading output shapes
- choose small structural modules over giant one-file logic
- choose explicit research-stage outputs over vague summaries

## Anti-Drift Rules
- Do not declare success if only `search` output became more verbose.
- Do not replace architecture work with description/prompt updates.
- Do not keep all new workflow logic inside `index.ts`.
- Do not skip browse-stage evidence extraction.
- Do not skip synthesis-stage `sufficient/gaps`.
- Do not start Phase 2 recursion until Phase 1 workflow tools are coherent.

## Current-to-v2 mapping
(To be filled during execution)

## Module plan
(To be filled during execution)

## Progress Notes
(To be filled during execution)

## Verification Evidence
(To be filled during execution)

## Phase 2 Backlog
(To be filled during execution)

## Final Summary
(To be filled during execution)
