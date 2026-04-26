import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RalphLoopContractResult } from "./contracts.js";

function extractToolCalls(rawEvents: unknown[] | undefined): string[] {
  if (!Array.isArray(rawEvents)) return [];
  const calls: string[] = [];
  for (const event of rawEvents) {
    if (!event || typeof event !== "object") continue;
    const typed = event as { type?: unknown; message?: { content?: unknown[] } };
    if (typed.type !== "message_end" && typed.type !== "turn_end" && typed.type !== "agent_end") continue;
    const messages = typed.type === "agent_end"
      ? ((event as any).messages as unknown[] | undefined) ?? []
      : typed.message ? [typed.message] : [];
    for (const message of messages) {
      const content = Array.isArray((message as any)?.content) ? (message as any).content : [];
      for (const part of content) {
        if (part && typeof part === "object" && (part as any).type === "toolCall" && typeof (part as any).name === "string") {
          calls.push((part as any).name);
        }
      }
    }
  }
  return calls;
}

export function buildRalphPaths(task: string, cwd: string): { stateFilePath?: string; taskFilePath?: string } {
  const loopName = task.match(/\.ralph\/([^\s`]+)\.md/)?.[1] ?? task.match(/name[:：]\s*`?([\w-]+)`?/i)?.[1];
  if (!loopName) return {};
  return {
    stateFilePath: path.resolve(cwd, ".ralph", `${loopName}.state.json`),
    taskFilePath: path.resolve(cwd, ".ralph", `${loopName}.md`),
  };
}

export function verifyRalphLoop(params: {
  rawEvents?: unknown[];
  task: string;
  cwd: string;
}): RalphLoopContractResult {
  const toolCalls = extractToolCalls(params.rawEvents);
  const ralphStartObserved = toolCalls.includes("ralph_start");
  const ralphDoneObserved = toolCalls.includes("ralph_done");

  const { stateFilePath, taskFilePath } = buildRalphPaths(params.task, params.cwd);
  const ralphStateFileFound = !!stateFilePath && existsSync(stateFilePath);
  const ralphTaskFileUpdated = !!taskFilePath && existsSync(taskFilePath);

  let ralphIterationAdvanced = false;
  if (ralphStateFileFound && stateFilePath) {
    try {
      const parsed = JSON.parse(readFileSync(stateFilePath, "utf-8")) as { iteration?: number };
      ralphIterationAdvanced = typeof parsed.iteration === "number" && parsed.iteration >= 2;
    } catch {
      ralphIterationAdvanced = false;
    }
  }

  const contractSatisfied = ralphStartObserved && ralphDoneObserved && ralphStateFileFound && ralphTaskFileUpdated && ralphIterationAdvanced;

  let reason: string | undefined;
  if (!ralphStartObserved) reason = "ralph_start not observed in child raw events";
  else if (!ralphDoneObserved) reason = "ralph_done not observed in child raw events";
  else if (!ralphStateFileFound) reason = "Ralph state file not found";
  else if (!ralphTaskFileUpdated) reason = "Ralph task file not found or not updated";
  else if (!ralphIterationAdvanced) reason = "Ralph iteration did not advance";

  return {
    executionContract: "ralph-loop",
    contractSatisfied,
    reason,
    ralphStartObserved,
    ralphDoneObserved,
    ralphStateFileFound,
    ralphIterationAdvanced,
    ralphTaskFileUpdated,
    ralphStateFilePath: stateFilePath,
    ralphTaskFilePath: taskFilePath,
  };
}

export const __internal = { extractToolCalls, buildRalphPaths };
