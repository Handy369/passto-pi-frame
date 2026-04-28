---
schema_version: "1"
task_id: "valid-minimal"

project:
  name: "pi-sandbox"
  cwd: "/tmp/project"

stage: "builder"

expected_output:
  todolist:
    - "Do one thing"
  checklist:
    - "Stay minimal"
---

Minimal valid task doc fixture.
