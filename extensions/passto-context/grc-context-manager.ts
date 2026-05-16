import type { AgentRoundBoundaryEntry } from "./types.ts";
import { estimateTokens } from "./utils.ts";

interface ContextLikeMessage {
  role: string;
  timestamp?: number;
  customType?: string;
  content?: unknown;
  display?: boolean;
  [key: string]: unknown;
}

interface BranchEntryLike {
  type?: string;
  customType?: string;
  data?: unknown;
  message?: unknown;
}

interface MessageContentBlockLike {
  type?: string;
  text?: string;
}

interface MessageLike {
  role?: string;
  content?: unknown;
}

function cloneMessage<T>(message: T): T {
  return JSON.parse(JSON.stringify(message)) as T;
}

export interface AgentRoundBoundary {
  agentRound: number;
  startEntryIndex: number;
  endEntryIndex: number;
  userTurnsAtStart: number;
  totalCompletedAgentRounds: number;
  createdAt?: string;
}

export function findAgentRoundBoundaries<T extends BranchEntryLike>(branch: T[]): AgentRoundBoundary[] {
  const boundaries: AgentRoundBoundary[] = [];
  let current: AgentRoundBoundary | null = null;

  for (let i = 0; i < branch.length; i++) {
    const entry = branch[i];
    if (entry?.type !== "custom" || entry.customType !== "passto-round-boundary") {
      continue;
    }

    const data = entry.data as AgentRoundBoundaryEntry | undefined;
    if (!data || typeof data.agentRound !== "number") {
      continue;
    }

    if (current) {
      current.endEntryIndex = i - 1;
      boundaries.push(current);
    }

    current = {
      agentRound: data.agentRound,
      startEntryIndex: i,
      endEntryIndex: i,
      userTurnsAtStart: typeof data.userTurnsAtStart === "number" ? data.userTurnsAtStart : 0,
      totalCompletedAgentRounds:
        typeof data.totalCompletedAgentRounds === "number" ? data.totalCompletedAgentRounds : Math.max(0, data.agentRound - 1),
      createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
    };
  }

  if (current) {
    current.endEntryIndex = Math.max(current.startEntryIndex, branch.length - 1);
    boundaries.push(current);
  }

  return boundaries;
}

export function findAgentRoundBoundaryByRound<T extends BranchEntryLike>(
  branch: T[],
  agentRound: number,
): AgentRoundBoundary | null {
  return findAgentRoundBoundaries(branch).find((boundary) => boundary.agentRound === agentRound) ?? null;
}

export function resolveAgentRoundEntryRange<T extends BranchEntryLike>(
  branch: T[],
  agentRound: number,
): { startAgentEntryIndex: number; endAgentEntryIndex: number } | null {
  const boundary = findAgentRoundBoundaryByRound(branch, agentRound);
  if (!boundary) return null;

  let endAgentEntryIndex = boundary.endEntryIndex;
  while (endAgentEntryIndex >= boundary.startEntryIndex) {
    const entry = branch[endAgentEntryIndex];
    const message = entry?.message as MessageLike | undefined;
    if (entry?.type === "message" && message?.role === "user") {
      endAgentEntryIndex -= 1;
      continue;
    }
    break;
  }

  return {
    startAgentEntryIndex: boundary.startEntryIndex,
    endAgentEntryIndex: Math.max(boundary.startEntryIndex, endAgentEntryIndex),
  };
}

export function getCurrentAgentRoundEntries<T extends BranchEntryLike>(branch: T[]): T[] {
  const boundaries = findAgentRoundBoundaries(branch);
  if (boundaries.length === 0) {
    return branch.filter((entry) => entry?.type === "message" && !!entry.message);
  }

  const current = boundaries[boundaries.length - 1];
  return branch
    .slice(current.startEntryIndex, current.endEntryIndex + 1)
    .filter((entry) => entry?.type === "message" && !!entry.message);
}

export function serializeCurrentAgentRoundConversation<T extends BranchEntryLike>(
  branch: T[],
  serializer: (entries: Array<{ message?: unknown }>) => string,
): string {
  const entries = getCurrentAgentRoundEntries(branch).map((entry) => ({ message: entry.message }));
  return serializer(entries);
}

export function getPreviousAgentRoundEntries<T extends BranchEntryLike>(branch: T[]): T[] {
  const boundaries = findAgentRoundBoundaries(branch);
  if (boundaries.length === 0) {
    return [];
  }

  for (let i = boundaries.length - 1; i >= 0; i--) {
    const candidate = boundaries[i];
    const entries = branch
      .slice(candidate.startEntryIndex, candidate.endEntryIndex + 1)
      .filter((entry) => entry?.type === "message" && !!entry.message);

    let trimmedLength = entries.length;
    while (trimmedLength > 0) {
      const message = entries[trimmedLength - 1]?.message as MessageLike | undefined;
      if (message?.role !== "user") {
        break;
      }
      trimmedLength -= 1;
    }

    const trimmedEntries = entries.slice(0, trimmedLength);
    if (trimmedEntries.length > 0) {
      return trimmedEntries;
    }
  }

  return [];
}

export function serializePreviousAgentRoundConversation<T extends BranchEntryLike>(
  branch: T[],
  serializer: (entries: Array<{ message?: unknown }>) => string,
): string {
  const entries = getPreviousAgentRoundEntries(branch).map((entry) => ({ message: entry.message }));
  return serializer(entries);
}

export function getLatestUserMessageText<T extends BranchEntryLike>(branch: T[]): string {
  for (let i = branch.length - 1; i >= 0; i--) {
    const message = branch[i]?.message as MessageLike | undefined;
    if (branch[i]?.type !== "message" || !message || message.role !== "user") {
      continue;
    }

    const text = extractMessageText(message.content);
    if (text) {
      return text;
    }
  }

  return "";
}

export function getRecentAgentRoundMessages<T extends BranchEntryLike>(
  branch: T[],
  keepRecentRounds: number,
): ContextLikeMessage[] {
  const boundaries = findAgentRoundBoundaries(branch);
  const safeKeep = Math.max(1, keepRecentRounds);

  const slicedEntries = boundaries.length > safeKeep
    ? branch.slice(boundaries[Math.max(0, boundaries.length - safeKeep)].startEntryIndex)
    : branch;

  const rawMessages = slicedEntries
    .filter((entry) => entry?.type === "message" && !!entry.message)
    .map((entry) => cloneMessage(entry.message as ContextLikeMessage));

  return filterInternalMessages(rawMessages);
}

export function getSlidingWindowAgentRoundMessages<T extends BranchEntryLike>(
  branch: T[],
  minRecentRounds: number,
  contextWindow: number,
  maxContextPercent: number,
): ContextLikeMessage[] {
  const boundaries = findAgentRoundBoundaries(branch);
  const safeMinRounds = Math.max(1, minRecentRounds);
  const safeContextWindow = Math.max(1, contextWindow);
  const safeMaxContextPercent = Math.max(0.1, maxContextPercent);

  if (boundaries.length === 0) {
    return branch
      .filter((entry) => entry?.type === "message" && !!entry.message)
      .map((entry) => cloneMessage(entry.message as ContextLikeMessage));
  }

  const rounds = boundaries.map((boundary) => {
    const messages = branch
      .slice(boundary.startEntryIndex, boundary.endEntryIndex + 1)
      .filter((entry) => entry?.type === "message" && !!entry.message)
      .map((entry) => cloneMessage(entry.message as ContextLikeMessage));
    return filterInternalMessages(messages);
  });

  let startRoundIndex = 0;
  while (rounds.length - startRoundIndex > safeMinRounds) {
    const currentMessages = rounds.slice(startRoundIndex).flat();
    const currentPercent = estimateMessagesPercent(currentMessages, safeContextWindow);
    if (currentPercent <= safeMaxContextPercent) {
      break;
    }

    const removableRounds = rounds.length - startRoundIndex - safeMinRounds;
    const shiftCount = Math.min(removableRounds, getSlidingEvictionRoundCount(currentPercent));
    if (shiftCount <= 0) {
      break;
    }
    startRoundIndex += shiftCount;
  }

  return rounds.slice(startRoundIndex).flat();
}

export function mergeRecentAgentRoundMessagesWithContext<T extends ContextLikeMessage>(
  recentAgentRoundMessages: T[],
  eventMessages: T[],
): T[] {
  const filteredEventMessages = filterInternalMessages(eventMessages);
  if (recentAgentRoundMessages.length === 0) {
    return filteredEventMessages;
  }
  if (filteredEventMessages.length === 0) {
    return recentAgentRoundMessages.map((message) => cloneMessage(message));
  }

  const matchStartIndex = findMessageSequenceStartIndex(filteredEventMessages, recentAgentRoundMessages);
  if (matchStartIndex >= 0) {
    const suffix = filteredEventMessages.slice(matchStartIndex + recentAgentRoundMessages.length);
    return [
      ...recentAgentRoundMessages.map((message) => cloneMessage(message)),
      ...suffix.map((message) => cloneMessage(message)),
    ];
  }

  const trailingUserMessages = collectTrailingUserMessages(filteredEventMessages);
  if (trailingUserMessages.length > 0) {
    return [
      ...recentAgentRoundMessages.map((message) => cloneMessage(message)),
      ...trailingUserMessages.map((message) => cloneMessage(message)),
    ];
  }

  return recentAgentRoundMessages.map((message) => cloneMessage(message));
}

function extractMessageText(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((block) => {
      if (!block || typeof block !== "object") {
        return "";
      }
      const value = block as MessageContentBlockLike;
      return value.type === "text" && typeof value.text === "string" ? value.text.trim() : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function collectTrailingUserMessages<T extends ContextLikeMessage>(messages: T[]): T[] {
  const trailing: T[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role !== "user") {
      break;
    }
    trailing.unshift(messages[i]);
  }
  return trailing;
}

function findMessageSequenceStartIndex<T extends ContextLikeMessage>(haystack: T[], needle: T[]): number {
  if (needle.length === 0 || haystack.length < needle.length) {
    return -1;
  }

  const haystackKeys = haystack.map((message) => buildMessageKey(message));
  const needleKeys = needle.map((message) => buildMessageKey(message));

  for (let start = 0; start <= haystackKeys.length - needleKeys.length; start++) {
    let matched = true;
    for (let i = 0; i < needleKeys.length; i++) {
      if (haystackKeys[start + i] !== needleKeys[i]) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return start;
    }
  }

  return -1;
}

function buildMessageKey(message: ContextLikeMessage): string {
  const base = {
    role: message.role,
    customType: message.customType ?? "",
    toolName: String((message as { toolName?: unknown }).toolName ?? ""),
    content: normalizeContentForKey(message.content),
  };
  return JSON.stringify(base);
}

function normalizeContentForKey(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const value = block as Record<string, unknown>;
      if (value.type === "text" && typeof value.text === "string") {
        return value.text.trim();
      }
      if (value.type === "toolCall") {
        return `tool:${String(value.name ?? "")}:${JSON.stringify(value.arguments ?? "")}`;
      }
      if (value.type === "thinking" && typeof value.text === "string") {
        return value.text.trim();
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function estimateMessagesTokens(messages: ContextLikeMessage[]): number {
  return estimateTokens(JSON.stringify(messages));
}

function estimateMessagesPercent(messages: ContextLikeMessage[], contextWindow: number): number {
  if (contextWindow <= 0) return 0;
  return (estimateMessagesTokens(messages) / contextWindow) * 100;
}

function getSlidingEvictionRoundCount(currentPercent: number): number {
  if (currentPercent >= 30) {
    return 3;
  }
  if (currentPercent > 15) {
    return 2;
  }
  return 1;
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
