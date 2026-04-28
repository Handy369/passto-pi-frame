# Compatibility Migration Guide

## Scope

Phase 3 introduces a narrow compatibility adapter for legacy subagent-like request shapes.

This is **not** a full legacy shell. It is a small migration surface that converts a legacy-style request into a normal `ExecutorInvocation`, then runs through the standard path:

`task -> invocation -> assembly -> execution`

## Available adapters

- `legacyRequestToInvocation(request)`
- `legacyRequestToRuntimePolicy(request)`
- `legacyRequestToExecuteOptions(request, options)`
- `executeLegacyRequest(request, options)`
  - file: `compatibility/legacy-invocation-adapter.ts`

## Supported legacy-style fields

The current adapter surface supports a bounded request shape including:

Request-to-invocation fields:
- `task`
- `cwd`
- `agent`
- `role`
- `mode`
- `title`
- `constraints`
- `checklist`
- `todolist`
- `preferredModel`
- `preferredThinking`
- `inputs`

Request-to-runtime-policy fields:
- `mode`
- `maxConcurrency`
- `completionPolicy`
- `idleTimeoutMs`
- `timeoutMs`
- `terminateGraceMs`
- `sandboxCleanupPolicy`
- `preserveSandboxOnFailure`

Important runtime note:
- compatibility inputs may still include `completionPolicy`
- but `passto-executor` normalizes child completion to `process-exit`
- so legacy `agent-end` preferences are read but do not control executor child shutdown behavior

Request-to-execute-options fields:
- `extensions`

## Examples

### Stepwise migration

```ts
import {
  legacyRequestToInvocation,
  legacyRequestToRuntimePolicy,
  executeInvocation,
} from "@handy/passto-executor";

const request = {
  task: "review the exported API",
  cwd: "/tmp/project",
  role: "reviewer",
  mode: "single",
  checklist: ["Check API stability"],
  completionPolicy: "agent-end",
};

const invocation = legacyRequestToInvocation(request);
const runtimePolicy = legacyRequestToRuntimePolicy(request);

// runtimePolicy can be applied when assembling a context explicitly.
// Note: inside passto-executor, child completion is still normalized to process-exit.
```

### Direct compatibility execution helper

```ts
import { executeLegacyRequest } from "@handy/passto-executor";

const result = await executeLegacyRequest({
  task: "review the exported API",
  cwd: "/tmp/project",
  role: "reviewer",
  mode: "single",
  checklist: ["Check API stability"],
  extensions: ["ext-a"],
  completionPolicy: "agent-end",
}, {
  runId: "compat-run",
  agent: "default",
});
```

## What this does not provide

Still out of scope:

- a full `subagent` command compatibility shell
- legacy response/TUI render adapters
- full Ralph-capable child-runtime parity
- a guarantee that all historical call shapes are supported

Result adaptation is intentionally deferred in this milestone. The compatibility layer currently expands request + options migration coverage, not response-surface parity.

## Runtime honesty

The compatibility adapter does **not** change the current runtime limitation around Ralph-capable child execution. It only provides a migration path into the existing executor surface.

It also does not preserve legacy `agent-end` child-completion semantics inside executor runs. Executor lifecycle is process-oriented and normalizes child completion to `process-exit`.
