export type SessionMode = "spawn" | "fork";

export type SubagentUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
};

export type ChildAgentEvent =
  | { type: "assistant"; text: string; raw: unknown }
  | { type: "tool_call"; toolName: string; argsPreview?: string; raw: unknown }
  | { type: "tool_result"; toolName: string; text?: string; raw: unknown }
  | { type: "usage"; usage: SubagentUsage; raw: unknown }
  | { type: "status"; stopReason?: string; errorMessage?: string; raw: unknown }
  | { type: "stderr"; text: string }
  | { type: "done"; exitCode: number };

export type SubagentProgress = {
  runId: string;
  phase: "starting" | "running" | "finishing" | "done" | "error";
  startedAt: number;
  updatedAt: number;
  elapsedMs: number;
  currentTool?: string;
  currentToolArgsPreview?: string;
  lastAssistantText?: string;
  recentActivity: string[];
  usage: SubagentUsage;
  stopReason?: string;
  errorMessage?: string;
  exitCode?: number;
};

export type ArtifactItem = {
  kind: string;
  path: string;
  title?: string;
  mediaType?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type ArtifactManifest = {
  runId: string;
  createdAt: string;
  producer: string;
  items: ArtifactItem[];
};

export type ArtifactUrlStrategy =
  | { type: "none" }
  | { type: "file" }
  | { type: "local-server"; baseUrl: string }
  | { type: "custom"; resolve: (item: ArtifactItem) => string | undefined };

export type CompletionPolicy = "agent-end" | "process-exit";

export type PiChildRunOptions = {
  prompt: string;
  cwd: string;
  agent?: string;
  sessionMode?: SessionMode;
  forkSessionSnapshotJsonl?: string;
  model?: string;
  thinking?: "off" | "low" | "medium" | "high" | string;
  tools?: string[];
  extensions?: string[];
  skills?: string[];
  noTools?: boolean;
  noExtensions?: boolean;
  inheritParentExtensions?: boolean;
  noSkills?: boolean;
  noPromptTemplates?: boolean;
  noContextFiles?: boolean;
  offline?: boolean;
  noSession?: boolean;
  appendSystemPrompt?: string;
  extraArgs?: string[];
  timeoutMs?: number;
  completionPolicy?: CompletionPolicy;
  idleTimeoutMs?: number;
  terminateGraceMs?: number;
  maxDepth?: number;
  preventCycles?: boolean;
  parentDepth?: number;
  parentAgentStack?: string[];
  env?: Record<string, string>;
};

export type AgentProfile = {
  name: string;
  description?: string;
  model?: string;
  thinking?: string;
  tools?: string[];
  skills?: string[];
  extensions?: string[];
  inheritParentExtensions?: boolean;
  sessionMode?: SessionMode;
  timeoutMs?: number;
  completionPolicy?: CompletionPolicy;
  idleTimeoutMs?: number;
  terminateGraceMs?: number;
  maxDepth?: number;
  systemPrompt: string;
  filePath: string;
};

export type SubagentRunResult = {
  runId: string;
  cwd: string;
  sessionMode: SessionMode;
  exitCode: number;
  success: boolean;
  stopReason?: string;
  errorMessage?: string;
  usage: SubagentUsage;
  messages: unknown[];
  stderr: string;
  rawEvents?: unknown[];
  finalOutputText: string;
  progress: SubagentProgress;
  artifacts?: ArtifactManifest;
  provenance: {
    reviewedBySubagent: boolean;
    subagentMode: SessionMode;
    transport: "pi-cli-json";
    runtimeVersion: string;
    agentProfile?: string;
    agentProfilePath?: string;
    modelName?: string;
    thinking?: string;
  };
};

export type RunSubagentCallbacks = {
  onEvent?: (event: ChildAgentEvent) => void;
  onProgress?: (progress: SubagentProgress) => void;
};

export function emptyUsage(): SubagentUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cost: 0,
    contextTokens: 0,
    turns: 0,
  };
}
