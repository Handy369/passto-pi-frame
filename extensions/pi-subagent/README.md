# Pi Subagent

**Delegate tasks to runtime agent profiles with configurable context modes (`spawn` / `fork`).**

Pi Subagent is now a thin extension shell over `passto-agent-runtime`.
It keeps the familiar `subagent` tool protocol, while moving execution, CLI construction,
event parsing, and runtime guards into the shared runtime.

## Why Pi Subagent

**Profile-driven delegation** — Run reusable runtime agent profiles such as `default`, `reviewer`, or `coder`.

**Context Control** — Choose `spawn` (fresh context) or `fork` (inherit current session context), depending on the task.

**Parallel Execution** — Run multiple subagents at once.

**Thin Wrapper** — This extension focuses on tool protocol, orchestration, and rendering. The execution core lives in `passto-agent-runtime`.

## Install

### Option 1: Install from npm (recommended)

```bash
pi install npm:@mjakl/pi-subagent
```

### Option 2: Install via git

```bash
pi install git:github.com/mjakl/pi-subagent
```

### Option 3: Manual Installation

Clone this repository to your Pi extensions directory:

```bash
cd ~/.pi/agent/extensions
git clone https://github.com/mjakl/pi-subagent.git
cd pi-subagent
npm install
```

## Configuration

### Delegation Guards (Depth + Cycle Prevention)

By default, this extension enforces two runtime guards:

1. **Depth guard** (`--subagent-max-depth`, default `3`)
   - Main agent starts at depth `0`
   - Delegation is allowed while `currentDepth < maxDepth`
   - With default depth `3`: depth `0`, `1`, and `2` can delegate; depth `3` cannot
2. **Cycle guard** (`--subagent-prevent-cycles`, default `true`)
   - Blocks delegating to any agent name already present in the current delegation stack
   - Prevents self-recursion and cyclic handoffs

You can configure depth with either:

- CLI flag: `--subagent-max-depth <n>`
- Environment variable: `PI_SUBAGENT_MAX_DEPTH=<n>`

You can configure cycle prevention with either:

- CLI flag: `--subagent-prevent-cycles` / `--no-subagent-prevent-cycles`
- Environment variable: `PI_SUBAGENT_PREVENT_CYCLES=true|false`

Internal env vars managed by the extension/runtime and propagated to child processes:

- `PI_SUBAGENT_DEPTH`
- `PI_SUBAGENT_MAX_DEPTH`
- `PI_SUBAGENT_STACK`
- `PI_SUBAGENT_PREVENT_CYCLES`

### Context Mode (`spawn` vs `fork`)

`subagent` supports a top-level `mode` switch:

- `spawn` (default) — Child receives only the task string (`Task: ...`). Best for isolated, reproducible work; typically lower token/cost and less context leakage.
- `fork` — Child receives a forked snapshot of the current session context **plus** the task string. Best for follow-up work that depends on prior context; typically higher token/cost and may include sensitive context.

Examples:

```json
{ "agent": "reviewer", "task": "Review the API design", "mode": "spawn" }
```

```json
{ "agent": "coder", "task": "Implement the approved plan", "mode": "fork" }
```

If omitted, mode defaults to `spawn`.

### Explicit child extensions

`subagent` can inject extra child extensions explicitly via `extensions`.
Use this when the child process must have a specific extension/tool surface, instead of relying on auto-discovery.

Example:

```json
{
  "agent": "default",
  "task": "Execute the prepared Ralph task file",
  "extensions": ["/Users/handy/.pi/agent/extensions/ralph-wiggum/index.ts"]
}
```

### Execution contract

`subagent` also supports an optional `executionContract` field. Currently supported:

- `ralph-loop`

This is used to distinguish “child really executed via Ralph loop” from “child merely imitated Ralph-like behavior”.

### Completion policy

`subagent` supports two lifecycle completion modes:

- `agent-end`
  - Ends the child run soon after the runtime observes `agent_end`
  - Best for short, one-shot child tasks where `agent_end` is a reliable finish signal
  - Does **not** wait for later child output after `agent_end`

- `process-exit`
  - Ignores `agent_end` as a process stop signal
  - Waits for the child process to exit naturally
  - Uses `idleTimeoutMs` and `timeoutMs` as safety rails
  - Best for children that may continue doing useful work after one `agent_end`, including Ralph-style loop progression

#### Recommended default

Prefer `process-exit` unless you have a very short child task and explicitly want `agent_end` to act as the completion boundary.

In practice, `process-exit` is recommended for:
- long-running child tasks
- children that may emit more output after `agent_end`
- loop-driven or continuation-style execution such as `ralph-loop`
- cases where you want behavior closer to Paperclip's single-run lifecycle model

`agent-end` is mainly useful for:
- very short one-shot tasks
- compatibility with older behavior
- tasks where waiting for process exit is unnecessary noise

## Agent Profiles

The `agent` field is no longer a dynamically discovered user/project agent name.
It now means:

1. a **runtime agent profile name**, such as:
   - `default`
   - `reviewer`
   - `coder`
   - `ralph-executor`
2. or a **markdown profile path**

Examples:

```json
{ "agent": "reviewer", "task": "Audit these files for correctness" }
```

```json
{ "agent": "/abs/path/to/custom-agent.md", "task": "Refactor this module" }
```

### What an agent profile really is

An `agents/*.md` file is best understood as a **reusable prompt/profile template**.
Its core value is not discoverability. Its value is that it:

- packages a stable subagent role
- bundles reusable defaults such as model / thinking / tools / session mode
- provides repeatable guidance for child-process execution
- reduces repeated call-site configuration

In that sense, agent profiles are conceptually similar to skills, but they are specialized for subagent runtime execution.

### Profile format

Profiles are Markdown files with YAML frontmatter and body content:

```markdown
---
name: reviewer
description: Isolated review agent
model: PASSTOAI-TW/HubTo-TW/qwen3.6-plus
thinking: low
tools: read,bash,grep,find,ls
sessionMode: spawn
timeoutMs: 600000
maxDepth: 1
---

You are an isolated review agent.
```

The frontmatter provides runtime defaults; the Markdown body becomes the profile system prompt.

Profile frontmatter can also define lifecycle defaults such as:
- `completionPolicy`
- `idleTimeoutMs`
- `terminateGraceMs`

In addition, lifecycle defaults are configured in:
- `lib/passto-agent-runtime/config.json`

This includes:
- `subagent.defaults` for general runtime lifecycle defaults
- `subagent.contracts.<contractName>` for contract-specific lifecycle defaults such as `ralph-loop`

Example:

```json
{
  "subagent": {
    "defaults": {
      "completionPolicy": "process-exit",
      "idleTimeoutMs": 15000,
      "terminateGraceMs": 5000
    },
    "contracts": {
      "ralph-loop": {
        "completionPolicy": "process-exit",
        "idleTimeoutMs": 60000,
        "terminateGraceMs": 10000
      }
    }
  }
}
```

These values should live in config instead of being hardcoded in tool code. The runtime only keeps a minimal technical fallback when config is missing.

## How Communication Works

### The Isolation Model

Each subagent always runs in a **separate `pi` process**:

- ❌ No shared memory/state with the parent process
- ❌ No visibility into sibling subagents
- ✅ Its own model/tool/runtime loop
- ✅ Started with `PI_OFFLINE=1` to reduce spawn overhead
- ✅ Inherits relevant parent CLI configuration through `passto-agent-runtime`

What it can see depends on `mode`:

- `spawn`
  - ✅ Receives: profile prompt + `Task: ...`
  - ❌ Does not receive parent session history
- `fork`
  - ✅ Receives: forked snapshot of current parent session context + `Task: ...`

### What Gets Sent to Subagents

#### `spawn` mode

`subagent({ agent: "reviewer", task: "Audit these files" })` sends:

```txt
[Profile system prompt from runtime agent profile]

User: Task: Audit these files
```

#### `fork` mode

`subagent({ agent: "reviewer", task: "Audit these files", mode: "fork" })` sends:

```txt
[Forked snapshot of current session context]
[Profile system prompt from runtime agent profile]

User: Task: Audit these files
```

## What Comes Back to the Main Agent

| Data                              | Main Agent Sees                         | TUI Shows              |
| --------------------------------- | --------------------------------------- | ---------------------- |
| Summary text in tool result       | ✅ Yes                                  | ✅ Yes                 |
| Structured execution details      | ✅ Via tool `details` for rendering     | ✅ Yes                 |
| Tool calls made by subagent       | ❌ Not as direct parent tool invocations | ✅ Yes (expanded view) |
| Token usage / cost                | ❌ Not in top-level text output         | ✅ Yes                 |
| Reasoning/thinking steps          | ❌ No                                   | ❌ No                  |
| Error messages                    | ✅ Yes (on failure)                     | ✅ Yes                 |

The main agent receives summary text in the tool result content, while richer structured execution details are attached in `details` for TUI rendering.

## Parallel Mode Behavior

When running multiple agents in parallel:

- All subagents start concurrently up to the configured concurrency limit
- The top-level `mode` applies to all tasks in that call
- Main agent receives a combined result after all finish

Example result shape:

```txt
Parallel: 2/3 succeeded

[reviewer] completed: ...

[coder] completed: ...

[custom-agent] failed: ...
```

## Execution contracts

`subagent` can optionally validate that a child process followed a specific execution protocol instead of merely imitating it.

Currently supported:
- `ralph-loop`

When `executionContract: "ralph-loop"` is provided, `pi-subagent` verifies child raw events and `.ralph` artifacts to distinguish a real Ralph-driven loop from a prompt-level imitation.

`ralph-loop`-specific lifecycle defaults should be configured in:
- `lib/passto-agent-runtime/config.json`
- path: `subagent.contracts["ralph-loop"]`

This is the preferred place to tune:
- `completionPolicy`
- `idleTimeoutMs`
- `terminateGraceMs`

For most Ralph scenarios, `process-exit` is the recommended mode because the child may continue meaningful work after an `agent_end` event.

Typical checks include:
- whether `ralph_start` was observed
- whether `ralph_done` was observed
- whether `.ralph/<name>.state.json` exists
- whether the Ralph iteration advanced
- whether the Ralph task file exists

## Features

- **Runtime-native execution** — Delegation runs through `passto-agent-runtime`
- **Explicit child extension injection** — Pass `extensions` when the child must have a specific runtime surface
- **Execution contract verification** — Distinguish protocol-backed execution from prompt imitation
- **Context Mode Switch** — `spawn` and `fork` per call
- **Depth + Cycle Guards** — Prevent runaway recursive delegation by default
- **Streaming Updates** — Watch subagent progress in real time
- **Rich TUI Rendering** — Collapsed/expanded views with usage stats, tool previews, and markdown output
- **Profile-based delegation** — Use named profiles or markdown paths as reusable runtime prompt templates

## Project Structure

```txt
index.ts                — Extension entry point and orchestration
render.ts               — TUI rendering
render-helpers.ts       — Progress and activity formatting helpers
display-items.ts        — Convert messages/raw events into renderable display items
types.ts                — Shared result/render helpers
contracts.ts            — Execution contract parsing
ralph-verification.ts   — Ralph loop contract verification
runtime-profiles.ts     — Runtime profile discovery and prompt formatting
lifecycle-overrides.ts  — Contract-aware lifecycle override resolution
test/runtime-native.test.mjs — Runtime and lifecycle regression tests
```

## Attribution

Inspired by implementations from [vaayne/agent-kit](https://github.com/vaayne/agent-kit) and [mariozechner/pi-mono](https://github.com/badlogic/pi-mono).

## License

MIT
