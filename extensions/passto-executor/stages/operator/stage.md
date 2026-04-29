---
name: operator
description: Run non-implementation operational tasks.
use_cases:
  - procedural coordination
  - execution preparation
  - operational checks
required_parameters:
  - project.cwd
  - stage
  - expected_output.todolist
  - expected_output.checklist
optional_parameters:
  - task_id
  - executor.type
  - task.title
  - constraints
  - inputs
  - hints.preferred_model
  - hints.preferred_thinking
  - hints.preferred_role
recommended_executor_type: operator
example_task_doc: operator-example.task.md
---

Use this stage for operator-style work.
