import { runSubagent, type SubagentRunResult, type SubagentUsage, type SubagentProgress } from "../../../lib/passto-agent-runtime/index.ts";

export interface ExecutorChildProgress {
  phase?: "starting" | "running" | "finishing" | "done" | "error";
  elapsedMs?: number;
  currentTool?: string;
  currentToolArgsPreview?: string;
  lastAssistantText?: string;
  recentActivity?: string[];
}

export interface ExecutorRuntimeTransportOptions {
  sessionMode?: "spawn" | "fork";
  forkSessionSnapshotJsonl?: string;
  maxDepth?: number;
  parentDepth?: number;
  parentAgentStack?: string[];
  preventCycles?: boolean;
}

export interface ExecutorRuntimeExecutionPolicy {
  completionPolicy?: "agent-end" | "process-exit";
  idleTimeoutMs?: number;
  timeoutMs?: number;
  terminateGraceMs?: number;
}

export interface ExecutorChildResult {
  runId: string;
  exitCode: number;
  success: boolean;
  messages: unknown[];
  stderr: string;
  rawEvents: unknown[];
  usage: SubagentUsage;
  stopReason?: string;
  errorMessage?: string;
  finalOutputText: string;
  progress: ExecutorChildProgress;
  provenance: SubagentRunResult["provenance"];
}

export interface RunExecutorChildParams {
  agent: string;
  prompt: string;
  cwd: string;
  extensions?: string[];
  executionPolicy?: ExecutorRuntimeExecutionPolicy;
  transport?: ExecutorRuntimeTransportOptions;
  onProgress?: (progress: ExecutorChildProgress & { usage?: SubagentUsage }) => void;
}

export function toSubagentRunParams(params: RunExecutorChildParams) {
  return {
    agent: params.agent,
    prompt: params.prompt,
    cwd: params.cwd,
    extensions: params.extensions,
    sessionMode: params.transport?.sessionMode,
    forkSessionSnapshotJsonl: params.transport?.forkSessionSnapshotJsonl,
    completionPolicy: params.executionPolicy?.completionPolicy,
    idleTimeoutMs: params.executionPolicy?.idleTimeoutMs,
    timeoutMs: params.executionPolicy?.timeoutMs,
    terminateGraceMs: params.executionPolicy?.terminateGraceMs,
    maxDepth: params.transport?.maxDepth,
    parentDepth: params.transport?.parentDepth,
    parentAgentStack: params.transport?.parentAgentStack,
    preventCycles: params.transport?.preventCycles,
  };
}

function toExecutorChildProgress(progress: SubagentProgress): ExecutorChildProgress & { usage?: SubagentUsage } {
  return {
    phase: progress.phase,
    elapsedMs: progress.elapsedMs,
    currentTool: progress.currentTool,
    currentToolArgsPreview: progress.currentToolArgsPreview,
    lastAssistantText: progress.lastAssistantText,
    recentActivity: progress.recentActivity,
    usage: progress.usage,
  };
}

export async function runExecutorChild(params: RunExecutorChildParams): Promise<ExecutorChildResult> {
  const result = await runSubagent(toSubagentRunParams(params), {
    onProgress(progress) {
      params.onProgress?.(toExecutorChildProgress(progress));
    },
  });

  return {
    runId: result.runId,
    exitCode: result.exitCode,
    success: result.success,
    messages: result.messages,
    stderr: result.stderr,
    rawEvents: result.rawEvents ?? [],
    usage: result.usage,
    stopReason: result.stopReason,
    errorMessage: result.errorMessage,
    finalOutputText: result.finalOutputText,
    progress: {
      phase: result.progress.phase,
      elapsedMs: result.progress.elapsedMs,
      currentTool: result.progress.currentTool,
      currentToolArgsPreview: result.progress.currentToolArgsPreview,
      lastAssistantText: result.progress.lastAssistantText,
      recentActivity: result.progress.recentActivity,
    },
    provenance: result.provenance,
  };
}
