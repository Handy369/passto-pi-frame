import type { Message } from "@earendil-works/pi-ai";
import type { DisplayItem, ToolResultSummary } from "./types.js";

export function getDisplayItems(messages: Message[], toolResults: ToolResultSummary[] = []): DisplayItem[] {
  const items: DisplayItem[] = [];
  const pendingToolResults = [...toolResults];

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.content) {
      if (part.type === "text") {
        items.push({ type: "text", text: part.text });
        continue;
      }
      if (part.type !== "toolCall") continue;

      const toolName = part.name;
      items.push({ type: "toolCall", name: toolName, args: part.arguments });

      const matchingResultIndex = pendingToolResults.findIndex((result) => result.toolName === toolName);
      if (matchingResultIndex >= 0) {
        const [matchingResult] = pendingToolResults.splice(matchingResultIndex, 1);
        items.push({ type: "toolResult", toolName: matchingResult.toolName, text: matchingResult.text });
      }
    }
  }

  for (const result of pendingToolResults) {
    items.push({ type: "toolResult", toolName: result.toolName, text: result.text });
  }
  return items;
}

export function getToolResultSummariesFromRawEvents(rawEvents: unknown[] | undefined): ToolResultSummary[] {
  if (!Array.isArray(rawEvents)) return [];

  const results: ToolResultSummary[] = [];
  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    const typedEvent = event as { type?: unknown; message?: { content?: unknown[] } };
    if (typedEvent.type !== "tool_result_end") continue;

    let toolName = "unknown";
    let text: string | undefined;
    const parts = Array.isArray(typedEvent.message?.content) ? typedEvent.message.content : [];
    for (const part of parts) {
      if (!part || typeof part !== "object") continue;
      const toolPart = part as { type?: unknown; toolName?: unknown; content?: unknown[] };
      if (toolPart.type !== "toolResult") continue;
      if (typeof toolPart.toolName === "string" && toolPart.toolName.trim()) {
        toolName = toolPart.toolName;
      }
      const contentItems = Array.isArray(toolPart.content) ? toolPart.content : [];
      const textItem = contentItems.find(
        (item) => item && typeof item === "object" && (item as { type?: unknown }).type === "text" && typeof (item as { text?: unknown }).text === "string",
      ) as { text?: string } | undefined;
      if (textItem?.text?.trim()) {
        text = textItem.text.trim();
      }
    }

    results.push({ toolName, text });
  }

  return results;
}
