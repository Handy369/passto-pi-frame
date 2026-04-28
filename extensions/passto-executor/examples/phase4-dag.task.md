---
schema_version: "1"
project:
  name: passto-executor
  cwd: /tmp/passto-executor
stage: builder
executor:
  type: orchestrator
task:
  title: Phase 4 DAG execution example
expected_output:
  todolist:
    - Validate a bounded DAG execution path
  checklist:
    - Respect declared perspective dependencies
    - Preserve bounded concurrency
    - Do not claim retry or resume semantics
constraints:
  - Treat dependsOn edges as required dependencies
  - Skip downstream work when an upstream dependency fails
  - Keep the first DAG model intentionally bounded
---
Coordinate a bounded DAG run across multiple perspectives.

Suggested perspectives for manual invocation wiring:
- builder
- reviewer depends on builder
- shipper depends on reviewer

This fixture documents Phase 4 DAG intent rather than encoding multi-perspective graph structure directly in frontmatter.
