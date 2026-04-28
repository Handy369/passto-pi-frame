---
schema_version: "1"
task_id: "phase2-parallel"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "reviewer"

executor:
  type: "passto-review-mini"

task:
  title: "Exercise parallel executor mode"

expected_output:
  todolist:
    - "Run multiple perspectives concurrently"
    - "Aggregate multi-perspective output"
  checklist:
    - "Use parallel mode"
    - "Preserve per-perspective summaries"

constraints:
  - "Do not claim DAG support"

hints:
  preferred_model: "PASSTOAI-TW/HubTo-TW/qwen3.6-plus"
  preferred_thinking: "medium"
  preferred_role: "reviewer"
---

Run a parallel executor flow and verify that independent perspectives can complete concurrently while still producing a combined aggregated result.
