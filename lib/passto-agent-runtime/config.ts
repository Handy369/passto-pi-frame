import * as fs from "node:fs";
import * as path from "node:path";
import type { CompletionPolicy } from "./types.ts";

export type LifecycleConfig = {
  completionPolicy?: CompletionPolicy;
  idleTimeoutMs?: number;
  terminateGraceMs?: number;
};

type RuntimeConfig = {
  subagent?: {
    defaults?: LifecycleConfig;
    contracts?: Record<string, LifecycleConfig>;
  };
};

const CONFIG_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "config.json");

function isCompletionPolicy(value: unknown): value is CompletionPolicy {
  return value === "agent-end" || value === "process-exit";
}

function sanitizeLifecycleConfig(value: unknown): LifecycleConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: LifecycleConfig = {};
  if (isCompletionPolicy(record.completionPolicy)) out.completionPolicy = record.completionPolicy;
  if (typeof record.idleTimeoutMs === "number" && Number.isFinite(record.idleTimeoutMs) && record.idleTimeoutMs >= 0) {
    out.idleTimeoutMs = Math.floor(record.idleTimeoutMs);
  }
  if (typeof record.terminateGraceMs === "number" && Number.isFinite(record.terminateGraceMs) && record.terminateGraceMs >= 0) {
    out.terminateGraceMs = Math.floor(record.terminateGraceMs);
  }
  return out;
}

function loadRuntimeConfig(): RuntimeConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as RuntimeConfig;
  } catch {
    return {};
  }
}

export function getDefaultLifecycleConfig(): LifecycleConfig {
  const config = loadRuntimeConfig();
  return sanitizeLifecycleConfig(config.subagent?.defaults);
}

export function getContractLifecycleConfig(contractName: string | undefined): LifecycleConfig {
  if (!contractName) return {};
  const config = loadRuntimeConfig();
  return sanitizeLifecycleConfig(config.subagent?.contracts?.[contractName]);
}
