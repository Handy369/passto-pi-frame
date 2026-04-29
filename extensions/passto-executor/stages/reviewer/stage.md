---
name: reviewer
description: Review changes or outputs against explicit expectations.
use_cases:
  - review code
  - inspect results
  - check acceptance criteria
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
recommended_executor_type: reviewer
example_task_doc: reviewer-example.task.md
---

Use this stage for review and evaluation work.
