# Passto Executor

`passto-executor` is a task-driven execution container for Pi.

It helps a caller take:
- a project or workspace
- a task goal
- expected outputs
- execution preferences

and run that work inside a normalized executor pipeline with:
- context assembly
- sandbox/worktree isolation
- child-runtime launch
- event/result capture
- persisted run artifacts

If you are a **caller or integrator**, the main thing to know is:

> you describe the work and the expected outputs; `passto-executor` assembles and runs the execution container, then gives you a run result plus inspectable artifacts.

---

## What `passto-executor` is for

Use `passto-executor` when you want to run a task in a more structured way than “just call a child agent once”.

Typical use cases:
- run a coding/review/debug task against a project
- execute work in an isolated temp copy or git worktree
- run one perspective or multiple perspectives
- preserve run artifacts for inspection
- migrate older subagent-like request shapes into a more stable execution path

`passto-executor` is especially useful when the caller wants:
- a stable execution contract
- explicit runtime policy
- file-backed artifacts and results
- isolation from the main workspace

---

## What `passto-executor` is not

`passto-executor` is **not**:
- a full builder/orchestrator product by itself
- a full legacy `subagent` shell replacement
- a guarantee of universal runtime parity across every child profile and extension combination
- a thin one-shot wrapper that exits as soon as the child emits `agent_end`

Its runtime posture is intentionally **process-oriented**.

That means executor-owned runs complete based on:
- natural process exit
- idle timeout
- hard timeout
- termination grace behavior

and not based on caller-controlled `agent-end` shutdown semantics.

---

## Core execution model

The executor follows this path:

`task.md -> invocation -> assembly -> resolved context -> execution`

And it should align project-local artifacts under the shared workspace protocol:

`<cwd>/.passto-ai/{project.md, planner/, executor/, builder/}`

As a caller, you usually enter through one of two input styles:

1. **task document path**
   - provide a `task.md` file
2. **direct invocation path**
   - construct an invocation object in code

Both paths converge into the same executor pipeline.

---

## What you need to provide as input

At a practical level, the caller normally needs to provide:

### 1. Project / workspace context
Examples:
- the repository root or working directory
- the task document path
- runtime options such as sandbox/worktree strategy

### 2. Task goal
Examples:
- implement a feature
- review exported API stability
- investigate a failure
- generate or update files

### 3. Expected output
Examples:
- a code change
- a review note
- an updated file
- a structured run result
- a generated artifact in the sandbox/worktree

### 4. Optional execution preferences
Examples:
- execution mode: `single`, `sequential`, `parallel`, `dag`
- sandbox strategy
- timeout policy
- compatibility-shaped fields for migration scenarios

The executor then uses these inputs to assemble the actual runtime context.

---

## How to specify the desired output

There are two main levels of output specification.

### A. In a `task.md`
The task document can describe:
- the task itself
- constraints/checklists
- expected output or artifacts
- execution hints

This is the best choice when you want the task to be:
- reviewable
- editable by humans
- checked into a repo or shared as a file-backed contract

### B. In a direct invocation
Your invocation can encode the caller's intent directly, including:
- task prompt/body
- inputs
- execution mode
- role/agent preferences
- runtime policy

This is the best choice when execution is driven programmatically by a caller/orchestrator.

---

## Where the output goes

As a caller, you should think of executor outputs in **four places**.

### 1. Immediate run result returned by the API
The main execution APIs return a structured `ExecutorRunResult`.

This is the first place to look for:
- overall success/failure
- per-perspective summaries
- aggregated result data
- high-level run status

### 2. Persisted run artifacts in the project-local executor workspace
If you use file-backed storage, executor should persist artifacts such as:
- manifest metadata
- events
- result records
- failure records

Under the shared project workspace protocol, the default target is:
- `<cwd>/.passto-ai/executor/`

This is the right place when you want:
- auditing
- post-run inspection
- later readback by another tool
- debugging after the process has ended

### 3. Project-local metadata and shared workspace protocol
Executor should also align with the shared project workspace rooted at:
- `<cwd>/.passto-ai/`

In particular, executor should expect or help ensure:
- `<cwd>/.passto-ai/project.md`
- `<cwd>/.passto-ai/planner/`
- `<cwd>/.passto-ai/executor/`
- `<cwd>/.passto-ai/builder/`

This lets planner, executor, and builder collaborate through one project-local protocol instead of writing unrelated artifacts into the workspace root.

### 4. Files produced inside the sandbox/worktree/project
If the child task edits files or creates artifacts, those outputs live in the execution workspace.

Depending on the sandbox strategy, this may be:
- the original project root
- a temp-copy sandbox
- a git worktree

If preservation is enabled or the run fails with preserve-on-failure behavior, you can inspect those files directly.

---

## Project workspace protocol

`passto-executor` should align with the shared project workspace protocol used across planner, executor, and builder.

Project-local baseline:

```text
<cwd>/
  .passto-ai/
    project.md
    planner/
    executor/
    builder/
```

At minimum, executor should ensure these directories exist before persisting project-local run artifacts.
For compatibility requests executed through the root command/tool entrypoints, file-backed run artifacts should default to `<cwd>/.passto-ai/executor/`.

---

## Which API should you use

## Stable root API: `@handy/passto-executor`

Most callers should start with the root package.

Primary entrypoints:
- `executeInvocation(invocation, options)`
- `executeTaskDoc(taskDocPath, options)`
- `taskDocToInvocation(taskDoc)`
- `assembleExecutorContext(invocation, options)`

Compatibility helpers also available from the root package:
- `legacyRequestToInvocation(request)`
- `legacyRequestToRuntimePolicy(request)`
- `legacyRequestToExecuteOptions(request, options)`
- `executeLegacyRequest(request, options)`

Useful root-exported types include:
- `ExecutorInvocation`
- `ResolvedExecutorRunContext`
- `ExecutorRuntimePolicy`
- `ExecutorRunResult`
- `SandboxCleanupPolicy`

## Advanced entrypoints

If you need lower-level helpers or implementation-adjacent surfaces, use:
- `@handy/passto-executor/executor-core`
- `@handy/passto-executor/compatibility`

These are better suited for advanced integrations than for ordinary callers.

---

## Recommended caller flows

### Flow 1: execute a reviewed `task.md`
Use when:
- a human authored or reviewed the task file
- you want a durable execution contract

Typical flow:
1. create `task.md`
2. call `executeTaskDoc(taskDocPath, options)`
3. inspect the returned `ExecutorRunResult`
4. inspect persisted run artifacts or preserved sandbox/worktree if needed

### Flow 2: execute a programmatic invocation
Use when:
- a higher-level tool is generating work dynamically
- you already have structured state in code

Typical flow:
1. construct `ExecutorInvocation`
2. call `executeInvocation(invocation, options)`
3. inspect the returned `ExecutorRunResult`
4. inspect run artifacts if deeper auditing is needed

### Flow 3: migrate a legacy-style request
Use when:
- you have an older subagent-like call shape
- you want to migrate gradually without rewriting everything at once

Typical flow:
1. adapt via compatibility helpers
2. run through `executeLegacyRequest(...)` or stepwise conversion
3. move toward normal invocation/task-doc usage over time

---

## Minimal examples

### Example: execute a task document

```ts
import { executeTaskDoc } from "@handy/passto-executor";

const result = await executeTaskDoc("./examples/phase4-dag.task.md", {
  runId: "example-run-1",
  agent: "default",
});

console.log(result.status);
```

### Example: execute a direct invocation

```ts
import { executeInvocation } from "@handy/passto-executor";

const result = await executeInvocation({
  task: "Review the exported API and write a short note",
  cwd: "/path/to/project",
  expectedOutput: "A short review note saved in the project workspace",
  perspectives: [
    {
      id: "review",
      prompt: "Review the exported API and summarize risks.",
    },
  ],
}, {
  runId: "example-run-2",
  agent: "reviewer",
});

console.log(result.status);
```

### Example: execute a legacy-style request

```ts
import { executeLegacyRequest } from "@handy/passto-executor";

const result = await executeLegacyRequest({
  task: "review the exported API",
  cwd: "/path/to/project",
  role: "reviewer",
  mode: "single",
  checklist: ["Check API stability"],
}, {
  runId: "compat-run",
  agent: "default",
});
```

---

## Sandbox and workspace behavior

Supported strategies include:
- `noop`
- `temp-copy`
- `worktree`

Use these to control where the task runs and where file outputs land.

### Practical rule of thumb
- use `noop` only when you intentionally want to operate in-place
- use `temp-copy` for lightweight isolation
- use `worktree` for safer repository-oriented task execution

---

## Execution modes

Supported execution modes:
- `single`
- `sequential`
- `parallel`
- `dag`

Use:
- `single` for one main perspective
- `sequential` when order matters
- `parallel` when perspectives can run independently
- `dag` when dependencies between perspectives must be modeled explicitly

Current DAG support is intentionally bounded rather than a full general-purpose workflow engine.

---

## Compatibility

Compatibility support exists for migration, not for full historical shell emulation.

See:
- `compatibility/README.md`
- `compatibility/MIGRATION_GUIDE.md`

Use compatibility helpers when you need to move from legacy request shapes toward the standard executor path.

---

## Runtime posture and limitations

### Executor lifecycle
Executor child lifecycle is process-oriented by design:
- child completion is normalized to `process-exit`
- caller-supplied `agent-end` preferences are ignored inside executor runs
- completion depends on natural process exit, idle timeout, hard timeout, and termination grace handling

### Ralph / loop-style execution
The broader runtime stack has demonstrated that Ralph-style loop execution can work when the child profile is configured correctly.

`passto-executor` also shapes `ralph-loop` runs toward a suitable child profile and process-oriented lifecycle.

However, callers should still avoid assuming that every profile/extension/runtime combination has full proven parity in every scenario.

See:
- `RUNTIME_LIMITATION_NOTE.md`

---

## Directory guide

- `executor-core/` — lower-level runtime pipeline, execution logic, orchestration, persistence, and sandbox primitives
- `compatibility/` — migration helpers and notes for legacy-style request adaptation
- `examples/` — sample task documents
- `test/` — tests covering parser, execution, orchestration, sandbox, persistence, and compatibility behavior

---

## Examples by caller scenario

Use the examples based on the kind of caller workflow you have.

### I want to run one straightforward task
Start with:
- `examples/phase1-sample.task.md`

Use this when:
- you have one main task
- you want the simplest task-doc flow
- you want to learn the minimum input shape first

### I want ordered multi-step execution
Use:
- `examples/phase2-sequential.task.md`

Use this when:
- later steps depend on earlier steps
- you want one perspective to finish before the next starts

### I want independent perspectives to run concurrently
Use:
- `examples/phase2-parallel.task.md`
- `examples/phase3-bounded-parallel.task.md`

Use this when:
- perspectives do not depend on each other
- you want faster execution through parallelism
- you may want bounded concurrency rather than unbounded fan-out

### I want to preserve a debug workspace after failure
Use:
- `examples/phase3-debug-preserve-sandbox.task.md`

Use this when:
- you want to inspect generated files after execution
- you need a preserved sandbox/workspace for debugging

### I am migrating an older subagent-like call shape
Use:
- `examples/phase3-compat-legacy-invocation.task.md`

Use this when:
- you are moving from legacy request shapes
- you want a compatibility-oriented migration example

### I want dependency-aware execution
Use:
- `examples/phase4-dag.task.md`

Use this when:
- some perspectives must wait for others
- you want explicit dependency modeling rather than only sequential or parallel execution

### I want safer repository-oriented isolation
Use:
- `examples/phase4-worktree-sandbox.task.md`

Use this when:
- you want execution in a git worktree
- you want output files isolated from the main working tree

### Full example list
- `examples/phase1-sample.task.md`
- `examples/phase2-sequential.task.md`
- `examples/phase2-parallel.task.md`
- `examples/phase3-bounded-parallel.task.md`
- `examples/phase3-debug-preserve-sandbox.task.md`
- `examples/phase3-compat-legacy-invocation.task.md`
- `examples/phase4-dag.task.md`
- `examples/phase4-worktree-sandbox.task.md`

---

## In one sentence

`passto-executor` is a process-oriented, task-driven execution container: you provide the work intent, project context, and expected outputs, and it assembles an execution run with isolation, orchestration, and persisted artifacts that you can inspect afterward.
