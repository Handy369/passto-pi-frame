---
schema_version: "1"
task_id: "phase2-sequential"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "builder"

executor:
  type: "passto-builder-mini"

task:
  title: "Exercise sequential executor mode"

expected_output:
  todolist:
    - "Run builder then reviewer perspectives"
    - "Aggregate multi-perspective output"
  checklist:
    - "Use sequential mode"
    - "Stop on first failure"

constraints:
  - "Keep execution within the executor core"

hints:
  preferred_model: "PASSTOAI-TW/HubTo-TW/qwen3.6-plus"
  preferred_thinking: "medium"
  preferred_role: "builder"
---

Run a sequential two-perspective executor flow and verify that output aggregation and failure boundaries remain correct.
