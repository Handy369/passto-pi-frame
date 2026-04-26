import type { Message } from "@mariozechner/pi-ai";

export type DelegationMode = "spawn" | "fork";
export const DEFAULT_DELEGATION_MODE: DelegationMode = "spawn";

export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  contextTokens: number;
  turns: number;
}

export interface ToolResultSummary {
  toolName: string;
  text?: string;
}

export interface SingleResult {
  agent: string;
  task: string;
  exitCode: number;
  messages: Message[];
  stderr: string;
  usage: UsageStats;
  model?: string;
  stopReason?: string;
  errorMessage?: string;
  sawAgentEnd?: boolean;
  phase?: "starting" | "running" | "finishing" | "done" | "error";
  elapsedMs?: number;
  currentTool?: string;
  currentToolArgsPreview?: string;
  lastAssistantText?: string;
  recentActivity?: string[];
  toolResults?: ToolResultSummary[];
  extensions?: string[];
  executionContract?: string;
  contractSatisfied?: boolean;
  contractReason?: string;
  contractDetails?: Record<string, unknown>;
}

export interface SubagentDetails {
  mode: "single" | "parallel";
  delegationMode: DelegationMode;
  results: SingleResult[];
}

export type DisplayItem =
  | { type: "text"; text: string }
  | { type: "toolCall"; name: string; args: Record<string, unknown> }
  | { type: "toolResult"; toolName: string; text?: string };

export function emptyUsage(): UsageStats {
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

export function aggregateUsage(results: SingleResult[]): UsageStats {
  const total = emptyUsage();
  for (const r of results) {
    total.input += r.usage.input;
    total.output += r.usage.output;
    total.cacheRead += r.usage.cacheRead;
    total.cacheWrite += r.usage.cacheWrite;
    total.cost += r.usage.cost;
    total.turns += r.usage.turns;
  }
  return total;
}

export function getFinalAssistantText(messages: Message[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }
  return "";
}

export function getResultSummaryText(result: Partial<SingleResult> | undefined): string {
  const finalText = result?.messages ? getFinalAssistantText(result.messages) : "";
  if (finalText) return finalText;
  if (typeof result?.errorMessage === "string" && result.errorMessage.trim()) {
    return result.errorMessage.trim();
  }
  const isError =
    (typeof result?.exitCode === "number" && result.exitCode > 0) ||
    result?.stopReason === "error" ||
    result?.stopReason === "aborted";
  if (isError && typeof result?.stderr === "string" && result.stderr.trim()) {
    return result.stderr.trim();
  }
  return "(no output)";
}

export function hasFinalAssistantOutput(r: Pick<SingleResult, "messages">): boolean {
  return getFinalAssistantText(r.messages).trim().length > 0;
}

export function hasSemanticCompletion(
  r: Pick<SingleResult, "messages" | "sawAgentEnd">,
): boolean {
  return Boolean(r.sawAgentEnd) && hasFinalAssistantOutput(r);
}

export function isResultSuccess(r: SingleResult): boolean {
  if (r.exitCode === -1) return false;
  if (hasSemanticCompletion(r)) return true;
  return r.exitCode === 0 && r.stopReason !== "error" && r.stopReason !== "aborted";
}

export function isResultError(r: SingleResult): boolean {
  if (r.exitCode === -1) return false;
  return !isResultSuccess(r);
}

export function getFinalOutput(messages: Message[]): string {
  return getFinalAssistantText(messages);
}
