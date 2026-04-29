---
schema_version: "1"
task_id: "phase2-bootstrap"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "builder"

executor:
  type: "passto-builder-mini"

task:
  title: "Implement Phase 2 foundations for passto-executor"

expected_output:
  todolist:
    - "Harden task.md parsing and validation"
    - "Add typed persistent run-store support"
    - "Implement first real sandbox mode"
    - "Add sequential and parallel perspective orchestration"
    - "Refine runtime wiring and compatibility notes"
    - "Split tests and add Phase 2 examples"
  checklist:
    - "Preserve the Phase 1 architecture path from task.md to execution"
    - "Build on existing seams instead of replacing core module boundaries"
    - "Keep execute.ts as entrypoint and move scheduling into a dedicated orchestration module"
    - "Treat DAG execution as out of scope unless only represented as a controlled placeholder"
    - "Document known Ralph/subagent runtime limitations explicitly"

constraints:
  - "Do not rewrite the Phase 1 architecture from scratch"
  - "Prefer additive directory changes over large restructuring"
  - "Do not claim full Ralph-capable child execution if the runtime blocker remains unresolved"
  - "Keep all outputs under /Users/handy/dev/pi-sandbox/extensions/passto-executor"

inputs:
  - kind: "file"
    path: "./PHASE2_TASK_BREAKDOWN.md"
    required: true
  - kind: "file"
    path: "./PHASE1_ARCHITECTURE_NOTE.md"
    required: true
  - kind: "file"
    path: "./PHASE1_REVIEW_NOTE.md"
    required: true
  - kind: "file"
    path: "./README.md"
    required: true

hints:
  preferred_model: "PASSTOAI-TW/HubTo-TW/qwen3.6-plus"
  preferred_thinking: "medium"
  preferred_role: "builder"
---

Implement Phase 2 for `passto-executor` as a minimally functional execution container.

Start from the completed Phase 1 skeleton and preserve its architectural path:

`task.md -> invocation -> assembly -> resolved context -> execution`

Primary objectives:
- harden `executor-core/task-doc.ts`
- upgrade `executor-core/run-store.ts` from in-memory-only stub to typed persistence layer
- replace `NoopSandboxManager` with a first real sandbox implementation
- add a dedicated orchestration path for sequential and parallel perspective execution
- refine runtime parameter mapping and compatibility documentation
- split tests by concern and add richer Phase 2 examples

Suggested implementation shape:
- keep core contracts in `executor-core/`
- add `executor-core/orchestration.ts`
- optionally add `executor-core/store/` and `executor-core/sandbox/` for growing concrete implementations
- expand `examples/` and `test/fixtures/` as needed

Completion criteria:
- parser is more robust and covered by fixture-driven tests
- run storage supports typed payloads and a file-backed implementation
- execution can run with a real sandboxed cwd
- sequential and parallel perspective modes are implemented at a basic level
- README and compatibility docs reflect actual Phase 2 behavior and limitations
