---
schema_version: "1"
project:
  name: passto-executor
  cwd: /tmp/passto-executor
stage: builder
executor:
  type: reviewer
task:
  title: Phase 4 worktree sandbox example
expected_output:
  todolist:
    - Verify a worktree-backed sandbox path
  checklist:
    - Use a git-backed project root
    - Preserve failed sandboxes when debugging is required
    - Keep strategy choice explicit
constraints:
  - Do not silently fall back when worktree support is unavailable
  - Treat worktree mode as a bounded first-slice isolation backend
  - Preserve cleanup-policy semantics across sandbox strategies
---
Exercise a worktree-backed sandbox strategy for a git-backed project root.

This fixture documents Milestone 2 sandbox intent. Actual strategy wiring remains part of invocation/runtime configuration rather than task frontmatter.
