import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  runSubagent,
  type SubagentProgress,
  type SubagentRunResult,
  type SubagentUsage,
} from "../../lib/passto-agent-runtime/index.ts";
import { renderCall, renderResult } from "./render.js";
import { resolveLifecycleOverrides } from "./lifecycle-overrides.js";
import { getToolResultSummariesFromRawEvents } from "./display-items.js";
import { buildProgressUpdateText } from "./render-helpers.js";
import { formatRuntimeProfilesForPrompt, listRuntimeProfileSummaries } from "./runtime-profiles.js";
import {
  type DelegationMode,
  type SingleResult,
  type SubagentDetails,
  DEFAULT_DELEGATION_MODE,
  emptyUsage,
  getResultSummaryText,
  isResultError,
  isResultSuccess,
} from "./types.js";
import { parseExecutionContract } from "./contracts.js";
import { verifyRalphLoop } from "./ralph-verification.js";

const MAX_PARALLEL_TASKS = 8;
const MAX_CONCURRENCY = 4;
const DEFAULT_MAX_DELEGATION_DEPTH = 3;
const DEFAULT_PREVENT_CYCLE_DELEGATION = true;
const SUBAGENT_DEPTH_ENV = "PI_SUBAGENT_DEPTH";
const SUBAGENT_MAX_DEPTH_ENV = "PI_SUBAGENT_MAX_DEPTH";
const SUBAGENT_STACK_ENV = "PI_SUBAGENT_STACK";
const SUBAGENT_PREVENT_CYCLES_ENV = "PI_SUBAGENT_PREVENT_CYCLES";

const TaskItem = Type.Object({
  agent: Type.String({
    description: "Runtime agent profile name or markdown profile path.",
  }),
  task: Type.String({
    description:
      "Task description for this delegated run. In spawn mode include all required context; in fork mode the subagent also sees your current session context.",
  }),
  cwd: Type.Optional(
    Type.String({ description: "Working directory for this agent's process" }),
  ),
  extensions: Type.Optional(
    Type.Array(Type.String(), {
      description: "Extra child extensions to inject via --extension.",
    }),
  ),
  executionContract: Type.Optional(
    Type.String({
      description: 'Optional execution contract, e.g. "ralph-loop".',
    }),
  ),
  completionPolicy: Type.Optional(
    Type.String({ description: 'Completion policy: "agent-end" or "process-exit".' }),
  ),
  idleTimeoutMs: Type.Optional(
    Type.Number({ description: "Max idle time before parent intervenes." }),
  ),
  terminateGraceMs: Type.Optional(
    Type.Number({ description: "Grace period between SIGTERM and SIGKILL." }),
  ),
});

const SubagentParams = Type.Object({
  agent: Type.Optional(
    Type.String({
      description:
        "Runtime agent profile name or markdown profile path for single mode.",
    }),
  ),
  task: Type.Optional(
    Type.String({
      description:
        "Task description for single mode. In spawn mode it must be self-contained; in fork mode the subagent also receives your current session context.",
    }),
  ),
  tasks: Type.Optional(
    Type.Array(TaskItem, {
      description:
        "For parallel mode: array of {agent, task} objects. Each task runs in an isolated process concurrently. Do NOT also set agent/task when using this.",
    }),
  ),
  mode: Type.Optional(
    Type.String({
      description:
        "Context mode for delegated runs. 'spawn' (default) sends only your task prompt. 'fork' adds a snapshot of current session context plus your task prompt.",
      default: DEFAULT_DELEGATION_MODE,
    }),
  ),
  cwd: Type.Optional(
    Type.String({
      description: "Working directory for the agent process (single mode only)",
    }),
  ),
  extensions: Type.Optional(
    Type.Array(Type.String(), {
      description: "Extra child extensions to inject via --extension.",
    }),
  ),
  executionContract: Type.Optional(
    Type.String({
      description: 'Optional execution contract, e.g. "ralph-loop".',
    }),
  ),
  completionPolicy: Type.Optional(
    Type.String({ description: 'Completion policy: "agent-end" or "process-exit".' }),
  ),
  idleTimeoutMs: Type.Optional(
    Type.Number({ description: "Max idle time before parent intervenes." }),
  ),
  terminateGraceMs: Type.Optional(
    Type.Number({ description: "Grace period between SIGTERM and SIGKILL." }),
  ),
});

interface DelegationDepthConfig {
  currentDepth: number;
  maxDepth: number;
  canDelegate: boolean;
  ancestorAgentStack: string[];
  preventCycles: boolean;
}

interface SessionSnapshotSource {
  getHeader: () => unknown;
  getBranch: () => unknown[];
}

function parseDelegationMode(raw: unknown): DelegationMode | null {
  if (raw === undefined) return DEFAULT_DELEGATION_MODE;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "spawn" || normalized === "fork") return normalized;
  return null;
}

function buildForkSessionSnapshotJsonl(
  sessionManager: SessionSnapshotSource,
): string | null {
  const header = sessionManager.getHeader();
  if (!header || typeof header !== "object") return null;

  const branchEntries = sessionManager.getBranch();
  const lines = [JSON.stringify(header)];
  for (const entry of branchEntries) lines.push(JSON.stringify(entry));
  return `${lines.join("\n")}\n`;
}

function parseNonNegativeInt(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseBoolean(raw: unknown): boolean | null {
  if (typeof raw === "boolean") return raw;
  if (typeof raw !== "string") return null;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return null;
}

function parseAgentStack(raw: unknown): string[] | null {
  if (raw === undefined) return [];
  if (typeof raw !== "string") return null;
  if (!raw.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) return null;
  if (!parsed.every((value) => typeof value === "string")) return null;
  return parsed.map((value) => value.trim()).filter((value) => value.length > 0);
}

function getMaxDepthFlagFromArgv(argv: string[]): string | null {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--subagent-max-depth") return argv[i + 1] ?? "";
    if (arg.startsWith("--subagent-max-depth=")) {
      return arg.slice("--subagent-max-depth=".length);
    }
  }
  return null;
}

function getPreventCyclesFlagFromArgv(
  argv: string[],
): string | boolean | null {
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--subagent-prevent-cycles") {
      const maybeValue = argv[i + 1];
      if (maybeValue !== undefined && !maybeValue.startsWith("--")) {
        return maybeValue;
      }
      return true;
    }
    if (arg === "--no-subagent-prevent-cycles") return false;
    if (arg.startsWith("--subagent-prevent-cycles=")) {
      return arg.slice("--subagent-prevent-cycles=".length);
    }
  }
  return null;
}

function resolveDelegationDepthConfig(pi: ExtensionAPI): DelegationDepthConfig {
  const depthRaw = process.env[SUBAGENT_DEPTH_ENV];
  const parsedDepth = parseNonNegativeInt(depthRaw);
  if (depthRaw !== undefined && parsedDepth === null) {
    console.warn(
      `[pi-subagent] Ignoring invalid ${SUBAGENT_DEPTH_ENV}="${depthRaw}". Expected a non-negative integer.`,
    );
  }
  const currentDepth = parsedDepth ?? 0;

  const stackRaw = process.env[SUBAGENT_STACK_ENV];
  const ancestorAgentStack = parseAgentStack(stackRaw);
  if (stackRaw !== undefined && ancestorAgentStack === null) {
    console.warn(
      `[pi-subagent] Ignoring invalid ${SUBAGENT_STACK_ENV} value. Expected a JSON array of agent names.`,
    );
  }

  const envMaxDepthRaw = process.env[SUBAGENT_MAX_DEPTH_ENV];
  const envMaxDepth = parseNonNegativeInt(envMaxDepthRaw);
  if (envMaxDepthRaw !== undefined && envMaxDepth === null) {
    console.warn(
      `[pi-subagent] Ignoring invalid ${SUBAGENT_MAX_DEPTH_ENV}="${envMaxDepthRaw}". Expected a non-negative integer.`,
    );
  }

  const argvFlagRaw = getMaxDepthFlagFromArgv(process.argv);
  const argvFlagMaxDepth =
    argvFlagRaw !== null ? parseNonNegativeInt(argvFlagRaw) : null;
  if (argvFlagRaw !== null && argvFlagMaxDepth === null) {
    console.warn(
      `[pi-subagent] Ignoring invalid --subagent-max-depth value "${argvFlagRaw}". Expected a non-negative integer.`,
    );
  }

  const runtimeFlagValue = pi.getFlag("subagent-max-depth");
  const runtimeFlagMaxDepth =
    typeof runtimeFlagValue === "string"
      ? parseNonNegativeInt(runtimeFlagValue)
      : null;
  if (
    argvFlagRaw === null &&
    typeof runtimeFlagValue === "string" &&
    runtimeFlagMaxDepth === null
  ) {
    console.warn(
      `[pi-subagent] Ignoring invalid --subagent-max-depth value "${runtimeFlagValue}". Expected a non-negative integer.`,
    );
  }

  const envPreventCyclesRaw = process.env[SUBAGENT_PREVENT_CYCLES_ENV];
  const envPreventCycles = parseBoolean(envPreventCyclesRaw);
  if (envPreventCyclesRaw !== undefined && envPreventCycles === null) {
    console.warn(
      `[pi-subagent] Ignoring invalid ${SUBAGENT_PREVENT_CYCLES_ENV}="${envPreventCyclesRaw}". Expected true/false.`,
    );
  }

  const argvPreventCyclesRaw = getPreventCyclesFlagFromArgv(process.argv);
  const argvPreventCycles =
    typeof argvPreventCyclesRaw === "boolean"
      ? argvPreventCyclesRaw
      : parseBoolean(argvPreventCyclesRaw);
  if (
    typeof argvPreventCyclesRaw === "string" &&
    argvPreventCycles === null
  ) {
    console.warn(
      `[pi-subagent] Ignoring invalid --subagent-prevent-cycles value "${argvPreventCyclesRaw}". Expected true/false.`,
    );
  }

  const runtimePreventCyclesRaw = pi.getFlag("subagent-prevent-cycles");
  const runtimePreventCycles = parseBoolean(runtimePreventCyclesRaw);
  if (
    argvPreventCyclesRaw === null &&
    runtimePreventCyclesRaw !== undefined &&
    runtimePreventCycles === null
  ) {
    console.warn(
      `[pi-subagent] Ignoring invalid --subagent-prevent-cycles value "${String(runtimePreventCyclesRaw)}". Expected true/false.`,
    );
  }

  const flagMaxDepth = argvFlagMaxDepth ?? runtimeFlagMaxDepth;
  const maxDepth = flagMaxDepth ?? envMaxDepth ?? DEFAULT_MAX_DELEGATION_DEPTH;
  const preventCycles =
    argvPreventCycles ??
    runtimePreventCycles ??
    envPreventCycles ??
    DEFAULT_PREVENT_CYCLE_DELEGATION;

  return {
    currentDepth,
    maxDepth,
    canDelegate: currentDepth < maxDepth,
    ancestorAgentStack: ancestorAgentStack ?? [],
    preventCycles,
  };
}

function makeDetailsFactory(delegationMode: DelegationMode) {
  return (mode: "single" | "parallel") =>
    (results: SingleResult[]): SubagentDetails => ({
      mode,
      delegationMode,
      results,
    });
}

function toUsageStats(usage: SubagentUsage | undefined) {
  if (!usage) return emptyUsage();
  return {
    input: usage.input,
    output: usage.output,
    cacheRead: usage.cacheRead,
    cacheWrite: usage.cacheWrite,
    cost: usage.cost,
    contextTokens: usage.contextTokens,
    turns: usage.turns,
  };
}

function toRunningSingleResult(
  agent: string,
  task: string,
  progress: SubagentProgress,
  metadata?: { extensions?: string[]; executionContract?: string },
): SingleResult {
  return {
    agent,
    task,
    exitCode: progress.exitCode ?? -1,
    messages: [],
    stderr: "",
    usage: toUsageStats(progress.usage),
    stopReason: progress.stopReason,
    errorMessage: progress.errorMessage,
    phase: progress.phase,
    elapsedMs: progress.elapsedMs,
    currentTool: progress.currentTool,
    currentToolArgsPreview: progress.currentToolArgsPreview,
    lastAssistantText: progress.lastAssistantText,
    recentActivity: [...progress.recentActivity],
    extensions: metadata?.extensions,
    executionContract: metadata?.executionContract,
  };
}

function toSingleResult(
  agent: string,
  task: string,
  result: SubagentRunResult,
  metadata?: { extensions?: string[]; executionContract?: string },
): SingleResult {
  return {
    agent,
    task,
    exitCode: result.exitCode,
    messages: result.messages as any[],
    stderr: result.stderr,
    usage: toUsageStats(result.usage),
    stopReason: result.stopReason,
    errorMessage: result.errorMessage,
    sawAgentEnd: result.progress.phase === "done" || result.progress.phase === "finishing",
    phase: result.progress.phase,
    elapsedMs: result.progress.elapsedMs,
    currentTool: result.progress.currentTool,
    currentToolArgsPreview: result.progress.currentToolArgsPreview,
    lastAssistantText: result.progress.lastAssistantText,
    recentActivity: [...result.progress.recentActivity],
    toolResults: getToolResultSummariesFromRawEvents(result.rawEvents),
    extensions: metadata?.extensions,
    executionContract: metadata?.executionContract,
  };
}

async function mapConcurrent<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results: TOut[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

export default function (pi: ExtensionAPI) {
  pi.registerFlag("subagent-max-depth", {
    description: "Maximum allowed subagent delegation depth (default: 3).",
    type: "string",
  });
  pi.registerFlag("subagent-prevent-cycles", {
    description:
      "Block delegating to agents already in the current delegation stack (default: true).",
    type: "boolean",
  });

  const depthConfig = resolveDelegationDepthConfig(pi);
  const { currentDepth, maxDepth, canDelegate, ancestorAgentStack, preventCycles } =
    depthConfig;
  const runtimeProfiles = listRuntimeProfileSummaries();
  const runtimeProfilesPrompt = formatRuntimeProfilesForPrompt(runtimeProfiles);

  pi.on("before_agent_start", async (event) => {
    if (!canDelegate) return;
    return {
      systemPrompt:
        event.systemPrompt +
        `\n\n## Subagent tool guidance\n\nUse the \`subagent\` tool when you want to delegate a bounded task to an isolated child pi process instead of continuing in the current agent.\n\n### When to use \`subagent\`\n- Use it for isolated review, implementation, or analysis subtasks.\n- Use it when a runtime profile is a better fit than continuing in the current role.\n- Use parallel mode only when multiple tasks are independent and can run simultaneously.\n- Do not use parallel mode for tasks that depend on each other's outputs.\n\n### How to choose the \`agent\` field\nThe \`agent\` field is **not** a legacy discovered agent name. It must be one of:\n1. a runtime profile name\n2. a markdown profile path\n\nAvailable runtime profiles discovered from \`lib/passto-agent-runtime/agents\`:\n${runtimeProfilesPrompt}\n\n### Practical profile-selection hints\n- Prefer **default** for general-purpose delegated execution.\n- Prefer **reviewer** for audit, validation, contract/spec checks, and critical review.\n- Prefer **coder** for implementation work that should follow a fixed spec or implementation contract.\n- Use a markdown profile path only when a custom role template is explicitly needed.\n\n### Mode selection rules\n- Prefer **spawn** by default.\n- Use **spawn** when the task can be fully described in the task string.\n- Use **fork** only when the child must inherit the current session context, such as prior discussion, file reads, or decisions already made in this session.\n- Avoid unnecessary **fork** because it increases context size, cost, and leakage risk.\n\n### Invocation rules\nUse exactly one invocation shape:\n- Single mode: provide \`agent\` and \`task\`\n- Parallel mode: provide \`tasks\`\n- Never provide both shapes in the same call\n\n### Task-writing rules\n- Write the delegated task as a bounded instruction with a clear outcome.\n- In **spawn** mode, include all required context in the task itself.\n- If you need structured output, explicitly ask the child to return structured text or strict JSON.\n- Do not assume sibling subagents share state with each other.\n\n### Runtime delegation guards\n- Max depth: current depth ${currentDepth}, max depth ${maxDepth}\n- Cycle prevention: ${preventCycles ? "enabled" : "disabled"}\n- Current delegation stack: ${ancestorAgentStack.length > 0 ? ancestorAgentStack.join(" -> ") : "(root)"}\n`,
    };
  });

  if (!canDelegate) return;

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: [
      "Delegate work to specialized subagents running in isolated pi processes.",
      "",
      "The `agent` field should be a runtime agent profile name or a markdown profile path.",
      "Examples: `default`, `reviewer`, `coder`, `/abs/path/to/custom-agent.md`.",
      "",
      "IMPORTANT: Use exactly ONE invocation shape:",
      "  Single mode:   set `agent` and `task` (both required together).",
      "  Parallel mode: set `tasks` array (do NOT also set `agent`/`task`).",
      "",
      "Optional context mode switch:",
      '  mode: "spawn" (default) -> child gets only your task prompt.',
      '  mode: "fork"            -> child gets current session context + your task prompt.',
      "",
      'Example single:   { agent: "reviewer", task: "Review README.md", mode: "spawn" }',
      'Example parallel: { tasks: [{ agent: "reviewer", task: "..." }, { agent: "coder", task: "..." }], mode: "fork" }',
    ].join("\n"),
      parameters: SubagentParams,

      async execute(_toolCallId, params, signal, onUpdate, ctx) {
        const delegationMode = parseDelegationMode(params.mode);
        if (!delegationMode) {
          const makeDetails = makeDetailsFactory(DEFAULT_DELEGATION_MODE);
          return {
            content: [
              {
                type: "text",
                text: `Invalid mode "${String(params.mode)}". Expected "spawn" or "fork".`,
              },
            ],
            details: makeDetails("single")([]),
            isError: true,
          };
        }

        const makeDetails = makeDetailsFactory(delegationMode);

        let forkSessionSnapshotJsonl: string | undefined;
        if (delegationMode === "fork") {
          forkSessionSnapshotJsonl = buildForkSessionSnapshotJsonl(
            ctx.sessionManager,
          ) ?? undefined;
          if (!forkSessionSnapshotJsonl) {
            return {
              content: [
                {
                  type: "text",
                  text: 'Cannot use mode="fork": failed to snapshot current session context.',
                },
              ],
              details: makeDetails("single")([]),
              isError: true,
            };
          }
        }

        const executionContract = parseExecutionContract(params.executionContract);
        if (params.executionContract !== undefined && !executionContract) {
          return {
            content: [{ type: "text", text: `Invalid executionContract \"${String(params.executionContract)}\".` }],
            details: makeDetails("single")([]),
            isError: true,
          };
        }

        const hasTasks = (params.tasks?.length ?? 0) > 0;
        const hasSingle = Boolean(params.agent && params.task);
        if (Number(hasTasks) + Number(hasSingle) !== 1) {
          return {
            content: [
              {
                type: "text",
                text: "Invalid parameters. Provide exactly one invocation shape.",
              },
            ],
            details: makeDetails("single")([]),
            isError: true,
          };
        }

        if (params.tasks && params.tasks.length > 0) {
          return executeParallel(
            params.tasks,
            delegationMode,
            forkSessionSnapshotJsonl,
            ctx.cwd,
            currentDepth,
            ancestorAgentStack,
            maxDepth,
            preventCycles,
            signal,
            onUpdate,
            makeDetails,
          );
        }

        if (params.agent && params.task) {
          return executeSingle(
            params.agent,
            params.task,
            params.cwd,
            params.extensions,
            executionContract ?? undefined,
            delegationMode,
            forkSessionSnapshotJsonl,
            ctx.cwd,
            currentDepth,
            ancestorAgentStack,
            maxDepth,
            preventCycles,
            signal,
            onUpdate,
            makeDetails,
            params.completionPolicy,
            params.idleTimeoutMs,
            params.terminateGraceMs,
          );
        }

        return {
          content: [{ type: "text", text: "Invalid parameters." }],
          details: makeDetails("single")([]),
          isError: true,
        };
      },

      renderCall: (args, theme) => renderCall(args, theme),
      renderResult: (result, { expanded }, theme) =>
        renderResult(result, expanded, theme),
    });

  async function executeSingle(
    agentName: string,
    task: string,
    cwd: string | undefined,
    extensions: string[] | undefined,
    executionContract: string | undefined,
    delegationMode: DelegationMode,
    forkSessionSnapshotJsonl: string | undefined,
    defaultCwd: string,
    parentDepth: number,
    parentAgentStack: string[],
    maxDepthValue: number,
    preventCyclesValue: boolean,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: any) => void) | undefined,
    makeDetails: ReturnType<typeof makeDetailsFactory>,
    completionPolicy?: string,
    idleTimeoutMs?: number,
    terminateGraceMs?: number,
  ) {
    try {
      const lifecycleOverrides = resolveLifecycleOverrides(executionContract, {
        completionPolicy,
        idleTimeoutMs,
        terminateGraceMs,
      });

      const runtimeResult = await runSubagent(
        {
          agent: agentName,
          prompt: `Task: ${task}`,
          cwd: cwd ?? defaultCwd,
          extensions,
          sessionMode: delegationMode,
          forkSessionSnapshotJsonl,
          noSession: delegationMode === "spawn",
          offline: true,
          maxDepth: maxDepthValue,
          preventCycles: preventCyclesValue,
          parentDepth,
          parentAgentStack,
          completionPolicy: lifecycleOverrides.completionPolicy,
          idleTimeoutMs: lifecycleOverrides.idleTimeoutMs,
          terminateGraceMs: lifecycleOverrides.terminateGraceMs,
        },
        {
          onProgress(progress) {
            if (!onUpdate) return;
            onUpdate({
              content: [
                {
                  type: "text",
                  text: buildProgressUpdateText(progress, 1),
                },
              ],
              details: makeDetails("single")([
                toRunningSingleResult(agentName, task, progress, { extensions, executionContract }),
              ]),
            });
          },
        },
        signal,
      );

      const result = toSingleResult(agentName, task, runtimeResult, { extensions, executionContract });
      if (executionContract === "ralph-loop") {
        const contractResult = verifyRalphLoop({ rawEvents: runtimeResult.rawEvents, task, cwd: cwd ?? defaultCwd });
        result.contractSatisfied = contractResult.contractSatisfied;
        result.contractReason = contractResult.reason;
        result.contractDetails = contractResult as unknown as Record<string, unknown>;
      }
      if (isResultError(result) || (executionContract === "ralph-loop" && result.contractSatisfied === false)) {
        return {
          content: [
            {
              type: "text" as const,
              text: executionContract === "ralph-loop" && result.contractSatisfied === false
                ? `Agent contract failed: ${result.contractReason || getResultSummaryText(result)}`
                : `Agent ${result.stopReason || "failed"}: ${getResultSummaryText(result)}`,
            },
          ],
          details: makeDetails("single")([result]),
          isError: true,
        };
      }

      return {
        content: [{ type: "text" as const, text: getResultSummaryText(result) }],
        details: makeDetails("single")([result]),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const result: SingleResult = {
        agent: agentName,
        task,
        exitCode: 1,
        messages: [],
        stderr: message,
        usage: emptyUsage(),
        stopReason: "error",
        errorMessage: message,
      };
      return {
        content: [{ type: "text" as const, text: `Agent failed: ${message}` }],
        details: makeDetails("single")([result]),
        isError: true,
      };
    }
  }

  async function executeParallel(
    tasks: Array<{ agent: string; task: string; cwd?: string; extensions?: string[]; executionContract?: string; completionPolicy?: string; idleTimeoutMs?: number; terminateGraceMs?: number }>,
    delegationMode: DelegationMode,
    forkSessionSnapshotJsonl: string | undefined,
    defaultCwd: string,
    parentDepth: number,
    parentAgentStack: string[],
    maxDepthValue: number,
    preventCyclesValue: boolean,
    signal: AbortSignal | undefined,
    onUpdate: ((partial: any) => void) | undefined,
    makeDetails: ReturnType<typeof makeDetailsFactory>,
  ) {
    if (tasks.length > MAX_PARALLEL_TASKS) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Too many parallel tasks (${tasks.length}). Max is ${MAX_PARALLEL_TASKS}.`,
          },
        ],
        details: makeDetails("parallel")([]),
        isError: true,
      };
    }

    const allResults: SingleResult[] = tasks.map((t) => ({
      agent: t.agent,
      task: t.task,
      exitCode: -1,
      messages: [],
      stderr: "",
      usage: emptyUsage(),
    }));

    const emitProgress = () => {
      if (!onUpdate) return;
      const running = allResults.filter((r) => r.exitCode === -1).length;
      const done = allResults.filter((r) => r.exitCode !== -1).length;
      onUpdate({
        content: [
          {
            type: "text",
            text: `Parallel: ${done}/${allResults.length} done, ${running} running...`,
          },
        ],
        details: makeDetails("parallel")([...allResults]),
      });
    };

    emitProgress();

    const results = await mapConcurrent(tasks, MAX_CONCURRENCY, async (t, index) => {
      try {
        const taskExecutionContract = parseExecutionContract(t.executionContract) ?? undefined;
        const lifecycleOverrides = resolveLifecycleOverrides(taskExecutionContract, {
          completionPolicy: t.completionPolicy,
          idleTimeoutMs: t.idleTimeoutMs,
          terminateGraceMs: t.terminateGraceMs,
        });

        const runtimeResult = await runSubagent(
          {
            agent: t.agent,
            prompt: `Task: ${t.task}`,
            cwd: t.cwd ?? defaultCwd,
            extensions: t.extensions,
            sessionMode: delegationMode,
            forkSessionSnapshotJsonl,
            noSession: delegationMode === "spawn",
            offline: true,
            maxDepth: maxDepthValue,
            preventCycles: preventCyclesValue,
            parentDepth,
            parentAgentStack,
            completionPolicy: lifecycleOverrides.completionPolicy,
            idleTimeoutMs: lifecycleOverrides.idleTimeoutMs,
            terminateGraceMs: lifecycleOverrides.terminateGraceMs,
          },
          {
            onProgress(progress) {
              allResults[index] = toRunningSingleResult(t.agent, t.task, progress, {
                extensions: t.extensions,
                executionContract: taskExecutionContract,
              });
              emitProgress();
            },
          },
          signal,
        );

        const result = toSingleResult(t.agent, t.task, runtimeResult, {
          extensions: t.extensions,
          executionContract: taskExecutionContract,
        });
        if (taskExecutionContract === "ralph-loop") {
          const contractResult = verifyRalphLoop({ rawEvents: runtimeResult.rawEvents, task: t.task, cwd: t.cwd ?? defaultCwd });
          result.contractSatisfied = contractResult.contractSatisfied;
          result.contractReason = contractResult.reason;
          result.contractDetails = contractResult as unknown as Record<string, unknown>;
        }
        allResults[index] = result;
        emitProgress();
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const result: SingleResult = {
          agent: t.agent,
          task: t.task,
          exitCode: 1,
          messages: [],
          stderr: message,
          usage: emptyUsage(),
          stopReason: "error",
          errorMessage: message,
        };
        allResults[index] = result;
        emitProgress();
        return result;
      }
    });

    const successCount = results.filter((r) => isResultSuccess(r) && r.contractSatisfied !== false).length;
    const summaries = results.map((r) =>
      `[${r.agent}] ${isResultError(r) ? "failed" : "completed"}: ${getResultSummaryText(r)}`,
    );

    return {
      content: [
        {
          type: "text" as const,
          text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n")}`,
        },
      ],
      details: makeDetails("parallel")(results),
      isError: successCount !== results.length,
    };
  }
}

export const __internal = {
  resolveLifecycleOverrides,
};
