import * as path from "node:path";
import { SUBAGENT_DEPTH_ENV, SUBAGENT_MAX_DEPTH_ENV, SUBAGENT_PREVENT_CYCLES_ENV, SUBAGENT_STACK_ENV } from "./cli.ts";
import { getDefaultLifecycleConfig } from "./config.ts";
import type { CompletionPolicy, PiChildRunOptions } from "./types.ts";

export const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const TECHNICAL_FALLBACK_IDLE_TIMEOUT_MS = 15 * 1000;
const TECHNICAL_FALLBACK_TERMINATE_GRACE_MS = 5 * 1000;
export const DEFAULT_MAX_DEPTH = 1;

export type GuardContext = {
  nextDepth: number;
  propagatedMaxDepth: number;
  propagatedStack: string[];
};

function toNonNegativeInt(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.floor(num) : fallback;
}

export function resolveParentDepth(options: PiChildRunOptions): number {
  return toNonNegativeInt(options.parentDepth ?? process.env[SUBAGENT_DEPTH_ENV], 0);
}

export function resolveMaxDepth(options: PiChildRunOptions): number {
  return toNonNegativeInt(options.maxDepth ?? process.env[SUBAGENT_MAX_DEPTH_ENV], DEFAULT_MAX_DEPTH);
}

export function resolveParentStack(options: PiChildRunOptions): string[] {
  if (Array.isArray(options.parentAgentStack)) return [...options.parentAgentStack];
  const raw = process.env[SUBAGENT_STACK_ENV];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function resolvePreventCycles(options: PiChildRunOptions): boolean {
  if (typeof options.preventCycles === "boolean") return options.preventCycles;
  const raw = process.env[SUBAGENT_PREVENT_CYCLES_ENV];
  return raw === undefined ? true : raw !== "0";
}

export function resolveTimeoutMs(options: PiChildRunOptions): number {
  return toNonNegativeInt(options.timeoutMs, DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
}

export function resolveCompletionPolicy(options: PiChildRunOptions): CompletionPolicy {
  const defaults = getDefaultLifecycleConfig();
  if (options.completionPolicy === "agent-end" || options.completionPolicy === "process-exit") {
    return options.completionPolicy;
  }
  if (defaults.completionPolicy === "agent-end" || defaults.completionPolicy === "process-exit") {
    return defaults.completionPolicy;
  }
  return "process-exit";
}

export function resolveIdleTimeoutMs(options: PiChildRunOptions): number {
  const defaults = getDefaultLifecycleConfig();
  return toNonNegativeInt(options.idleTimeoutMs, defaults.idleTimeoutMs ?? TECHNICAL_FALLBACK_IDLE_TIMEOUT_MS)
    || defaults.idleTimeoutMs
    || TECHNICAL_FALLBACK_IDLE_TIMEOUT_MS;
}

export function resolveTerminateGraceMs(options: PiChildRunOptions): number {
  const defaults = getDefaultLifecycleConfig();
  return toNonNegativeInt(options.terminateGraceMs, defaults.terminateGraceMs ?? TECHNICAL_FALLBACK_TERMINATE_GRACE_MS)
    || defaults.terminateGraceMs
    || TECHNICAL_FALLBACK_TERMINATE_GRACE_MS;
}

export function validateToolScope(options: PiChildRunOptions): void {
  if (options.noTools && options.tools && options.tools.length > 0) {
    throw new Error("Invalid options: cannot set both tools and noTools");
  }
}

export function validateSessionMode(options: PiChildRunOptions): void {
  if (options.sessionMode === "fork" && !options.forkSessionSnapshotJsonl?.trim()) {
    throw new Error("fork mode requires forkSessionSnapshotJsonl");
  }
}

export function validateCwd(options: PiChildRunOptions): void {
  if (!options.cwd?.trim()) throw new Error("runSubagent requires cwd");
  const resolved = path.resolve(options.cwd);
  if (!resolved) throw new Error("Invalid cwd");
}

export function createGuardContext(options: PiChildRunOptions, runLabel: string): GuardContext {
  const parentDepth = resolveParentDepth(options);
  const maxDepth = resolveMaxDepth(options);
  const parentStack = resolveParentStack(options);
  const preventCycles = resolvePreventCycles(options);
  const nextDepth = parentDepth + 1;
  const propagatedStack = [...parentStack, runLabel];

  if (nextDepth > maxDepth) {
    throw new Error(`Subagent depth exceeded: nextDepth=${nextDepth}, maxDepth=${maxDepth}`);
  }

  if (preventCycles && parentStack.includes(runLabel)) {
    throw new Error(`Subagent cycle detected for run label: ${runLabel}`);
  }

  return {
    nextDepth,
    propagatedMaxDepth: maxDepth,
    propagatedStack,
  };
}

export function validateRunOptions(options: PiChildRunOptions): void {
  if (!options.prompt?.trim()) throw new Error("runSubagent requires a non-empty prompt");
  validateCwd(options);
  validateSessionMode(options);
  validateToolScope(options);
}
