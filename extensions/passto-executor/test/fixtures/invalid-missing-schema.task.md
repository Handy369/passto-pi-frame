---
task_id: "invalid-missing-schema"

project:
  name: "pi-sandbox"
  cwd: "/tmp/project"

stage: "builder"

expected_output:
  todolist:
    - "This should fail"
  checklist:
    - "schema_version is missing"
---

Invalid fixture missing schema_version.
