---
schema_version: "1"
task_id: "phase3-bounded-parallel"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "builder"

executor:
  type: "passto-builder-phase3"

task:
  title: "Exercise bounded parallel execution"

expected_output:
  todolist:
    - "Run multiple perspectives with explicit bounded concurrency"
    - "Preserve aggregated output and per-perspective summaries"
  checklist:
    - "Respect maxConcurrency"
    - "Do not claim DAG execution support"

constraints:
  - "Keep execution within passto-executor core seams"

hints:
  preferred_model: "PASSTOAI-TW/HubTo-TW/qwen3.6-plus"
  preferred_thinking: "medium"
  preferred_role: "builder"
---

Run a bounded parallel flow where perspectives may execute concurrently, but only up to the configured concurrency limit.
