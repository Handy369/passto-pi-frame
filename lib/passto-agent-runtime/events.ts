import { emptyUsage, type ChildAgentEvent, type SubagentRunResult, type SubagentUsage } from "./types.ts";

type MutableResultState = {
  messages: unknown[];
  rawEvents: unknown[];
  stderr: string;
  usage: SubagentUsage;
  stopReason?: string;
  errorMessage?: string;
  model?: string;
  sawAgentEnd?: boolean;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

function getSeenMessageSignatures(state: MutableResultState): Set<string> {
  const withHidden = state as MutableResultState & { __seenMessageSignatures?: Set<string> };
  if (!withHidden.__seenMessageSignatures) withHidden.__seenMessageSignatures = new Set<string>();
  return withHidden.__seenMessageSignatures;
}

function getTextFromMessage(message: any): string {
  if (!message || !Array.isArray(message.content)) return "";
  for (const part of message.content) {
    if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) return part.text;
  }
  return "";
}

function updateUsage(target: SubagentUsage, usage: any): void {
  if (!usage || typeof usage !== "object") return;
  target.input += Number(usage.input || 0);
  target.output += Number(usage.output || 0);
  target.cacheRead += Number(usage.cacheRead || 0);
  target.cacheWrite += Number(usage.cacheWrite || 0);
  target.cost += Number(usage.cost?.total || usage.cost || 0);
  target.contextTokens = Number(usage.totalTokens || usage.contextTokens || target.contextTokens || 0);
  target.turns += 1;
}

function addAssistantMessage(state: MutableResultState, message: any): ChildAgentEvent[] {
  if (!message || message.role !== "assistant") return [];
  const signature = stableStringify(message);
  const seen = getSeenMessageSignatures(state);
  if (seen.has(signature)) return [];
  seen.add(signature);

  state.messages.push(message);
  if (message.stopReason) state.stopReason = message.stopReason;
  if (message.errorMessage) state.errorMessage = message.errorMessage;
  updateUsage(state.usage, message.usage);

  const text = getTextFromMessage(message);
  const events: ChildAgentEvent[] = [];
  if (text) events.push({ type: "assistant", text, raw: message });

  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      if (part?.type === "toolCall") {
        events.push({
          type: "tool_call",
          toolName: typeof part.name === "string" ? part.name : "unknown",
          argsPreview: part.arguments ? stableStringify(part.arguments).slice(0, 200) : undefined,
          raw: part,
        });
      }
    }
  }

  events.push({ type: "usage", usage: { ...state.usage }, raw: message.usage ?? {} });
  if (message.stopReason || message.errorMessage) {
    events.push({ type: "status", stopReason: state.stopReason, errorMessage: state.errorMessage, raw: message });
  }
  return events;
}

export function createEventState(): MutableResultState {
  return {
    messages: [],
    rawEvents: [],
    stderr: "",
    usage: emptyUsage(),
  };
}

export function processPiEvent(event: any, state: MutableResultState): ChildAgentEvent[] {
  if (!event || typeof event !== "object") return [];
  state.rawEvents.push(event);

  switch (event.type) {
    case "message_end":
    case "turn_end":
      return addAssistantMessage(state, event.message);
    case "tool_result_end": {
      const message = event.message;
      let toolName = "unknown";
      let text: string | undefined;
      if (message && Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part?.type === "toolResult") {
            toolName = typeof part.toolName === "string" ? part.toolName : toolName;
            if (Array.isArray(part.content)) {
              const textPart = part.content.find((item: any) => item?.type === "text" && typeof item.text === "string");
              if (textPart) text = textPart.text;
            }
          }
        }
      }
      return [{ type: "tool_result", toolName, text, raw: event }];
    }
    case "agent_end": {
      state.sawAgentEnd = true;
      const events: ChildAgentEvent[] = [];
      if (Array.isArray(event.messages)) {
        for (const message of event.messages) {
          events.push(...addAssistantMessage(state, message));
        }
      }
      events.push({ type: "done", exitCode: 0 });
      return events;
    }
    default:
      return [];
  }
}

export function processPiJsonLine(line: string, state: MutableResultState): ChildAgentEvent[] {
  if (!line.trim()) return [];
  let event: any;
  try {
    event = JSON.parse(line);
  } catch {
    return [];
  }
  return processPiEvent(event, state);
}

export function getFinalAssistantText(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message: any = messages[i];
    if (!message || message.role !== "assistant" || !Array.isArray(message.content)) continue;
    for (const part of message.content) {
      if (part?.type === "text" && typeof part.text === "string" && part.text.trim()) return part.text;
    }
  }
  return "";
}

export function finalizeEventState(state: MutableResultState): Pick<SubagentRunResult, "messages" | "rawEvents" | "stderr" | "usage" | "stopReason" | "errorMessage" | "finalOutputText"> {
  return {
    messages: state.messages,
    rawEvents: state.rawEvents,
    stderr: state.stderr,
    usage: state.usage,
    stopReason: state.stopReason,
    errorMessage: state.errorMessage,
    finalOutputText: getFinalAssistantText(state.messages),
  };
}
