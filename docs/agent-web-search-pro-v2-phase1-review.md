# Review agent-web-search-pro v2 Phase 1 with structured acceptance tests

Evaluate whether `agent-web-search-pro v2 Phase 1` has truly upgraded from a single-step search wrapper into a structured research workflow.

## Mission
Run structured acceptance testing against the implemented v2 workflow and produce a clear review summary covering:
- what works well
- what is weak
- which module is the bottleneck
- whether Phase 2 should start now or Phase 1 should be strengthened first

This is a review and validation task, not an implementation task.
Do not modify production code unless a tiny fix is strictly required for running the review and is clearly documented.
Primary output is evaluation evidence and recommendation.

## Target
- /Users/handy/.pi/agent/extensions/agent-web-search-pro

## Workflow Stages Under Review
- `ext_agent_web_search_pro_plan_research`
- `ext_agent_web_search_pro_search`
- `ext_agent_web_search_pro_browse_pages`
- `ext_agent_web_search_pro_synthesize_research`

## Review Questions
1. Does `plan_research` truly decompose the problem into usable research aspects and subqueries?
2. Does `search` behave like candidate discovery instead of a thin search-result wrapper?
3. Does `browse_pages` extract query-focused evidence rather than just text?
4. Does `synthesize_research` make credible sufficient / insufficient judgments?
5. Is the overall system now meaningfully closer to a research workflow?
6. Should the next step be Phase 2 loop work, or more Phase 1 strengthening?

## Required Test Cases
Run all 5.

### Test 1 — Official + community mixed complex question
Question: Apple TV 是否支持通过 SSH 或远程桌面连接 Mac？
Expected focus:
- Apple TV capability boundary
- SSH feasibility
- remote desktop feasibility
- jailbreak requirement
- alternative path / limits

### Test 2 — Official factual question
Question: OpenAI Responses API 是否支持 structured outputs？
Expected focus:
- prioritize official docs
- identify support model / fields / constraints

### Test 3 — Community comparison question
Question: Cursor 和 Windsurf 哪个更适合个人独立开发者？
Expected focus:
- pricing
- coding capability
- agent/automation
- stability
- use-case differences

### Test 4 — Recent changes / time-sensitive question
Question: 2026 年 Vercel AI SDK 有哪些主要变化？
Expected focus:
- release / changelog / migration / timeline awareness

### Test 5 — Fact + implementation advice question
Question: 我想把 Next.js SaaS 部署到 Vercel，如何设计最小可行的 observability 方案？
Expected focus:
- logs
- error monitoring
- performance
- metrics
- alerts
- minimum viable setup

## Review Procedure
For each test case:
1. Run `plan_research`
2. Select one strong `initialSubQuery` and run `search`
3. Take the top recommended URLs from `recommendedToBrowse` and run `browse_pages`
4. Feed `adoptedKnowledge` into `synthesize_research`
5. Score each stage and record observations

If one subquery is clearly insufficient, it is acceptable to run one additional `search` for a second subquery, but do not simulate full Phase 2 recursion. This review is still Phase 1-focused.

## Scoring Rubric
Each test case gets 0-2 points for each stage:
- Planning: 0-2
- Search: 0-2
- Browse: 0-2
- Synthesize: 0-2

Total per test: 0-8

Interpretation:
- 7-8 = strong pass
- 5-6 = basic pass but weak strategy
- 3-4 = structure exists but behavior unstable
- 0-2 = poor / still wrapper-like

## Stage-specific Checks

### A. plan_research
Check:
- aspects are relevant and non-trivial
- initialSubQueries are useful and not just repeated paraphrases
- suggested site types make sense

### B. search
Check:
- webResults are relevant
- recommendedToBrowse is meaningful
- reasons are specific rather than templated
- researchStatus covered/missing aspects are useful

### C. browse_pages
Check:
- pageAnalyses include summary, keyFacts, keyQuotes
- evidence is tied to the focus query
- adoptedKnowledge has actual research value

### D. synthesize_research
Check:
- sufficient is credible
- missingAspects/gaps are specific
- answer is responsive to the original query
- sources align with the answer

## Required Deliverables
Update this task file with:
- per-test observations
- per-stage scores
- overall scores
- strongest module
- weakest module
- recommendation: proceed to Phase 2 or strengthen Phase 1 first

Also produce a final concise summary that states:
1. What Phase 1 already achieved
2. What is still weak
3. The single highest-value next step

## Constraints
- Prefer evidence over opinion
- Record concrete examples of good/bad outputs
- Do not overstate success just because fields exist
- Judge the quality of behavior, not only presence of schema
- Avoid broad code changes during the review

## Checklist
- [ ] Read current extension files enough to understand workflow entry points
- [ ] Run Test 1 and score all four stages
- [ ] Run Test 2 and score all four stages
- [ ] Run Test 3 and score all four stages
- [ ] Run Test 4 and score all four stages
- [ ] Run Test 5 and score all four stages
- [ ] Compute total and average scores
- [ ] Identify strongest module
- [ ] Identify weakest module
- [ ] Make go / no-go recommendation for Phase 2
- [ ] Write final summary

## Iteration Script

### Iteration 1 — Read and set up review method
- Read the extension structure and confirm the four v2 workflow tools exist
- Write a short testing method section in this file
- Do not start scoring until the method is clear

### Iteration 2 — Run Tests 1 and 2
- Execute full four-stage review flow for Test 1 and Test 2
- Record detailed notes and scores

### Iteration 3 — Run Tests 3 and 4
- Execute full four-stage review flow for Test 3 and Test 4
- Record detailed notes and scores

### Iteration 4 — Run Test 5 and synthesize the review
- Execute full four-stage review flow for Test 5
- Compute totals
- Write strongest / weakest module analysis
- Write recommendation and final summary

## Execution Principles
- Be conservative in scoring
- Low-quality but schema-complete outputs should not receive high scores
- A strong search stage does not compensate for weak synthesis
- A strong synthesis stage cannot compensate for irrelevant browsing evidence
- The goal is to decide the next product step, not to praise the implementation

## Testing Method
(To be filled during execution)

## Test 1 Record
(To be filled during execution)

## Test 2 Record
(To be filled during execution)

## Test 3 Record
(To be filled during execution)

## Test 4 Record
(To be filled during execution)

## Test 5 Record
(To be filled during execution)

## Overall Scoring
(To be filled during execution)

## Strongest Module
(To be filled during execution)

## Weakest Module
(To be filled during execution)

## Recommendation
(To be filled during execution)

## Final Summary
(To be filled during execution)
