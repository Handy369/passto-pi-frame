---
schema_version: "1"
task_id: "valid-multiperspective"

project:
  name: "pi-sandbox"
  cwd: "/tmp/project"

stage: "reviewer"

executor:
  type: "passto-review-mini"

task:
  title: "Review a richer task"

expected_output:
  todolist:
    - "Parse nested-like structures"
    - "Preserve inputs"
  checklist:
    - "Validate stage"
    - "Validate hints"

constraints:
  - "Do not mutate source files"
  - "Return structured feedback"

inputs:
  - kind: "file"
    path: "./src/index.ts"
    label: "entrypoint"
    required: true
  - kind: "inline"
    content: "review the exported API"
    label: "instruction"
    required: false

hints:
  preferred_model: "demo-model"
  preferred_thinking: "medium"
  preferred_role: "reviewer"
---

Richer valid task doc fixture.
