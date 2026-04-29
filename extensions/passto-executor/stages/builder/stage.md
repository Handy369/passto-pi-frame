---
name: builder
description: Implement or modify project files.
use_cases:
  - implement code
  - edit files
  - run lightweight validation
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
recommended_executor_type: passto-builder
example_task_doc: builder-example.task.md
---

Use this stage for implementation work.
