---
schema_version: "1"
task_id: "phase3-compat-legacy-invocation"

project:
  name: "pi-sandbox"
  cwd: "/Users/handy/dev/pi-sandbox"

stage: "builder"

executor:
  type: "passto-compat-adapter"

task:
  title: "Exercise legacy compatibility invocation flow"

expected_output:
  todolist:
    - "Adapt a legacy-style request into ExecutorInvocation"
    - "Execute through passto-executor without bypassing core seams"
  checklist:
    - "Preserve task -> invocation -> assembly -> execution path"
    - "Do not claim full legacy shell parity"

constraints:
  - "Keep compatibility explicit and narrow"

hints:
  preferred_model: "PASSTOAI-TW/HubTo-TW/qwen3.6-plus"
  preferred_thinking: "medium"
  preferred_role: "builder"
---

Use a compatibility adapter to transform a legacy subagent-like request into an executor invocation, then run it through the normal passto-executor execution path.
