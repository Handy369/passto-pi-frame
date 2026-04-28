---
schema_version: "1"
task_id: "invalid-bad-inputs"

project:
  name: "pi-sandbox"
  cwd: "/tmp/project"

stage: "builder"

expected_output:
  todolist:
    - "This should fail"
  checklist:
    - "input kind is invalid"

inputs:
  - kind: "banana"
    path: "./oops.txt"
    required: true
---

Invalid fixture with unsupported input kind.
