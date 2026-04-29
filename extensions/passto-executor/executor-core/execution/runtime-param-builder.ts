import type { ResolvedExecutorRunContext, ExecutorPerspectiveSpec } from "../context.ts";
import type { RunExecutorChildParams } from "../runtime.ts";

export interface BuildRunExecutorChildParamsInput {
  context: ResolvedExecutorRunContext;
  perspective: ExecutorPerspectiveSpec;
  defaultAgent: string;
  defaultExtensions?: string[];
  cwd: string;
  contract?: string;
}

const IMPLEMENTATION_ONLY_BUILDER_TOOLS = [
  "read",
  "write",
  "edit",
  "bash",
  "vscode_get_editor_state",
  "vscode_get_selection",
  "vscode_get_latest_selection",
  "vscode_get_diagnostics",
  "vscode_get_open_editors",
  "vscode_get_workspace_folders",
  "vscode_open_file",
  "vscode_check_document_dirty",
  "vscode_save_document",
  "vscode_get_document_symbols",
  "vscode_get_definitions",
  "vscode_get_type_definitions",
  "vscode_get_implementations",
  "vscode_get_declarations",
  "vscode_get_hover",
  "vscode_get_workspace_symbols",
  "vscode_get_references",
  "vscode_get_code_actions",
  "vscode_execute_code_action",
  "vscode_apply_workspace_edit",
  "vscode_format_document",
  "vscode_format_range",
  "vscode_get_notifications",
  "vscode_clear_notifications",
  "vscode_show_notification",
  "ralph_start",
  "ralph_done",
] as const;

const IMPLEMENTATION_ONLY_BUILDER_APPEND_SYSTEM_PROMPT = [
  "Execution policy: implementation-only builder child mode.",
  "This child agent is for direct implementation work only using code-editing and inspection tools.",
  "Orchestration capabilities are intentionally not provided in this child runtime.",
  "Do not attempt executor/builder/subagent self-invocation or runtime re-entry.",
  "If validation is needed, validate by source-path wiring and lightweight local checks only.",
].join("\n");

function shouldUseImplementationOnlyBuilderProfile(input: BuildRunExecutorChildParamsInput): boolean {
  const executorType = input.context.invocation.executorType?.toLowerCase();
  const stage = input.context.invocation.stage?.toLowerCase();
  const contractName = (input.contract ?? input.perspective.contract?.name ?? input.context.contract?.name ?? "").toLowerCase();
  return executorType === "passto-builder" || stage === "builder" || contractName === "ralph-loop";
}

export function buildRunExecutorChildParams(input: BuildRunExecutorChildParamsInput): RunExecutorChildParams {
  const perspectivePolicy = input.perspective.runtimeOptions;
  const useImplementationOnlyBuilderProfile = shouldUseImplementationOnlyBuilderProfile(input);
  const runtimePolicy = input.context.runtimePolicy;

  return {
    agent: input.perspective.agent ?? input.defaultAgent,
    prompt: input.perspective.task,
    cwd: input.cwd,
    tools: useImplementationOnlyBuilderProfile ? [...IMPLEMENTATION_ONLY_BUILDER_TOOLS] : undefined,
    extensions: undefined,
    appendSystemPrompt: useImplementationOnlyBuilderProfile ? IMPLEMENTATION_ONLY_BUILDER_APPEND_SYSTEM_PROMPT : undefined,
    executionPolicy: {
      completionPolicy: perspectivePolicy?.completionPolicy ?? runtimePolicy.completionPolicy ?? "process-exit",
      idleTimeoutMs: perspectivePolicy?.idleTimeoutMs ?? runtimePolicy.idleTimeoutMs,
      timeoutMs: perspectivePolicy?.timeoutMs ?? runtimePolicy.timeoutMs,
      terminateGraceMs: perspectivePolicy?.terminateGraceMs ?? runtimePolicy.terminateGraceMs,
    },
  };
}
