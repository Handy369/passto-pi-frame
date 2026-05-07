import { buildCuratorSummaryMessage } from "./grc-prompts.js";

interface ContextLikeMessage {
  role: string;
  timestamp?: number;
  customType?: string;
  content?: unknown;
  display?: boolean;
  [key: string]: unknown;
}

interface OptimizeContextOptions {
  summary: string;
  processedUpToTurn: number;
  keepRecentTurns: number;
}

interface TurnBoundary {
  startIndex: number;
  endIndex: number;
  turnNumber: number;
}

export function optimizeContextMessages<T extends ContextLikeMessage>(
  messages: T[],
  options: OptimizeContextOptions,
): T[] {
  const filteredMessages = filterInternalMessages(messages);
  if (!options.summary.trim()) return filteredMessages;

  const boundaries = findTurnBoundaries(filteredMessages);
  if (boundaries.length === 0) return filteredMessages;

  const dropTurns = Math.min(
    Math.max(options.processedUpToTurn, 0),
    Math.max(boundaries.length - Math.max(options.keepRecentTurns, 0), 0),
  );

  if (dropTurns <= 0) {
    return filteredMessages;
  }

  const preservedStartIndex = dropTurns >= boundaries.length ? filteredMessages.length : boundaries[dropTurns].startIndex;
  const preserved = filteredMessages.slice(preservedStartIndex);
  const summaryMessage = {
    role: "custom",
    customType: "grc-curator-summary",
    content: buildCuratorSummaryMessage(options.summary),
    display: false,
    timestamp: Date.now(),
  } as T;

  return [summaryMessage, ...preserved];
}

export function findTurnBoundaries<T extends ContextLikeMessage>(messages: T[]): TurnBoundary[] {
  const userIndexes: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i]?.role === "user") {
      userIndexes.push(i);
    }
  }

  const boundaries: TurnBoundary[] = [];
  for (let i = 0; i < userIndexes.length; i++) {
    const startIndex = userIndexes[i];
    const nextStartIndex = userIndexes[i + 1] ?? messages.length;
    boundaries.push({
      startIndex,
      endIndex: nextStartIndex - 1,
      turnNumber: i + 1,
    });
  }

  return boundaries;
}

function filterInternalMessages<T extends ContextLikeMessage>(messages: T[]): T[] {
  return messages.filter((message, index) => {
    if (message.role !== "custom") return true;

    if (message.customType === "grc-curator-summary") {
      return false;
    }

    if (message.customType === "grc-reflection-steer") {
      return index === messages.length - 1;
    }

    return true;
  });
}
