---
schema_version: "1"
task_id: "phase1-sample"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "builder"

executor:
  type: "passto-builder-mini"

task:
  title: "Bootstrap passto-executor skeleton"

expected_output:
  todolist:
    - "Create core skeleton modules"
    - "Document Phase 1 scope"
  checklist:
    - "Keep implementation skeleton-only"
    - "Align with task.md to invocation to context flow"

constraints:
  - "Do not implement full orchestrator"

inputs:
  - kind: "file"
    path: "./README.md"
    required: true

hints:
  preferred_model: "PASSTOAI-TW/HubTo-TW/qwen3.6-plus"
  preferred_thinking: "low"
  preferred_role: "builder"
---

Build the first coherent Phase 1 skeleton for passto-executor.
Focus on task parsing, invocation mapping, context assembly, and runtime abstraction.
