import type { CuratorResult, GoalStateDocument, GoalStateSignal, SummaryEntry } from "./types.ts";

export function parseCuratorOutput(raw: string): CuratorResult | null {
  const text = raw.trim();
  if (!text.includes("## 目标") || !text.includes("## 已完成")) {
    return null;
  }

  const parsedPayload = extractCuratorPayload(text);
  const summary = stripTrailingJsonBlock(text).trim();

  return {
    summary,
    summaryEntry: parsedPayload?.summaryEntry ?? null,
    goalState: parsedPayload?.goalState ?? null,
    signal: parsedPayload?.signal ?? null,
    closureEvidence: parsedPayload?.closureEvidence ?? [],
    sections: {
      goal: extractSection(summary, "目标"),
      completed: extractListSection(summary, "已完成"),
      decisions: extractListSection(summary, "关键决策"),
      files: extractListSection(summary, "修改的文件"),
      status: extractSection(summary, "当前状态"),
      nextSteps: extractListSection(summary, "下一步"),
      warnings: extractListSection(summary, "注意事项"),
    },
  };
}

function extractCuratorPayload(text: string): {
  signal: GoalStateSignal | null;
  closureEvidence: string[];
  summaryEntry: SummaryEntry | null;
  goalState: GoalStateDocument | null;
} | null {
  const match = text.match(/```json\s*([\s\S]*?)```\s*$/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1].trim()) as Record<string, unknown>;
    return {
      signal: parseGoalStateSignal(parsed.signal),
      closureEvidence: parseStringArray(parsed.closureEvidence),
      summaryEntry: parseSummaryEntry(parsed.summaryEntry),
      goalState: parseGoalStateDocument(parsed.goalState),
    };
  } catch {
    return null;
  }
}

function parseGoalStateSignal(raw: unknown): GoalStateSignal | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const type = typeof value.type === "string" ? value.type : "";
  const confidence = typeof value.confidence === "number" ? value.confidence : 0;
  const evidence = typeof value.evidence === "string" ? value.evidence.trim() : "";
  if (!["advance", "correct", "supplement", "continue", "clarify"].includes(type)) return null;
  return {
    type: type as GoalStateSignal["type"],
    confidence,
    evidence,
  };
}

function parseSummaryEntry(raw: unknown): SummaryEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const agentRound = typeof value.agentRound === "number" ? value.agentRound : 0;
  const summary = value.summary && typeof value.summary === "object" ? value.summary as Record<string, unknown> : null;
  if (!summary) return null;
  return {
    agentRound,
    timestamp: new Date().toISOString(),
    summary: {
      goal: typeof summary.goal === "string" ? summary.goal.trim() : "",
      completed: parseStringArray(summary.completed),
      keyDecisions: parseStringArray(summary.keyDecisions),
      filesChanged: parseFilesChanged(summary.filesChanged),
      status: typeof summary.status === "string" ? summary.status.trim() : "",
      blockers: parseStringArray(summary.blockers),
    },
    sessionPointers:
      value.sessionPointers && typeof value.sessionPointers === "object"
        ? { searchQuery: typeof (value.sessionPointers as Record<string, unknown>).searchQuery === "string" ? String((value.sessionPointers as Record<string, unknown>).searchQuery) : undefined }
        : undefined,
  };
}

function parseGoalStateDocument(raw: unknown): GoalStateDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const version = value.version === 1 ? 1 : null;
  const agentRound = typeof value.agentRound === "number" ? value.agentRound : 0;
  if (version !== 1) return null;
  return {
    version,
    agentRound,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    active: parseGoalStateActiveItems(value.active),
    completed: parseGoalStateCompletedItems(value.completed),
    migrations: parseGoalStateMigrations(value.migrations),
    prunedCount: typeof value.prunedCount === "number" ? value.prunedCount : 0,
  };
}

function parseStringArray(raw: unknown): string[] {
  return Array.isArray(raw)
    ? raw.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function parseFilesChanged(raw: unknown): SummaryEntry["summary"]["filesChanged"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const path = typeof value.path === "string" ? value.path.trim() : "";
      const action = typeof value.action === "string" ? value.action : "";
      if (!path || !["read", "edit", "write", "bash"].includes(action)) return null;
      return { path, action: action as SummaryEntry["summary"]["filesChanged"][number]["action"] };
    })
    .filter((item): item is SummaryEntry["summary"]["filesChanged"][number] => !!item);
}

function parseGoalStateActiveItems(raw: unknown): GoalStateDocument["active"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      const status = value.status === "suspended" ? "suspended" : value.status === "active" ? "active" : null;
      const sinceRound = typeof value.sinceRound === "number" ? value.sinceRound : 0;
      const lastConfirmedRound = typeof value.lastConfirmedRound === "number" ? value.lastConfirmedRound : sinceRound;
      const signal = value.signal === "inferred" ? "inferred" : value.signal === "explicit" ? "explicit" : null;
      if (!id || !assertion || !status || !signal) return null;
      return { id, assertion, status, sinceRound, lastConfirmedRound, signal };
    })
    .filter((item): item is GoalStateDocument["active"][number] => !!item);
}

function parseGoalStateCompletedItems(raw: unknown): GoalStateDocument["completed"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const assertion = typeof value.assertion === "string" ? value.assertion.trim() : "";
      const completedAtRound = typeof value.completedAtRound === "number" ? value.completedAtRound : 0;
      if (!id || !assertion) return null;
      return { id, assertion, completedAtRound };
    })
    .filter((item): item is GoalStateDocument["completed"][number] => !!item);
}

function parseGoalStateMigrations(raw: unknown): GoalStateDocument["migrations"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const from = typeof value.from === "string" ? value.from.trim() : "";
      const to = typeof value.to === "string" ? value.to.trim() : "";
      const atRound = typeof value.atRound === "number" ? value.atRound : 0;
      const reason = typeof value.reason === "string" ? value.reason.trim() : "";
      if (!from || !to || !reason) return null;
      return { from, to, atRound, reason };
    })
    .filter((item): item is GoalStateDocument["migrations"][number] => !!item);
}

function stripTrailingJsonBlock(text: string): string {
  return text.replace(/\n?```json\s*[\s\S]*?```\s*$/, "").trim();
}

function extractSection(text: string, title: string): string {
  const pattern = new RegExp(`## ${escapeRegExp(title)}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? "";
}

function extractListSection(text: string, title: string): string[] {
  const section = extractSection(text, title);
  if (!section) return [];

  return section
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
