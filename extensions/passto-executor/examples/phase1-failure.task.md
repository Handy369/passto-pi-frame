---
schema_version: "1"
task_id: "phase1-failure"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "reviewer"

task:
  title: "Failure-path sample"

expected_output:
  todolist:
    - "Exercise parse and invocation on a second sample"
  checklist:
    - "Keep the example minimal"

constraints:
  - "No real execution required"
---

This sample exists to verify the task-doc wrapper and a second frontmatter shape.
