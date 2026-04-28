---
schema_version: "1"
task_id: "phase3-debug-preserve-sandbox"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "reviewer"

executor:
  type: "passto-debug-sandbox"

task:
  title: "Exercise sandbox preservation for failure debugging"

expected_output:
  todolist:
    - "Run in a sandbox with explicit preservation policy"
    - "Preserve failure artifacts for later inspection"
  checklist:
    - "Use sandbox cleanup policy intentionally"
    - "Expose sandbox metadata for debugging"

constraints:
  - "Keep preservation behavior explicit"

hints:
  preferred_model: "PASSTOAI-TW/HubTo-TW/qwen3.6-plus"
  preferred_thinking: "medium"
  preferred_role: "reviewer"
---

Run a failure-oriented task in a sandbox configured to preserve the workspace for debugging and post-run inspection.
