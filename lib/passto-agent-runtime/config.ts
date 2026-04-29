import * as fs from "node:fs";
import * as path from "node:path";
import type { CompletionPolicy } from "./types.ts";

export type LifecycleConfig = {
  completionPolicy?: CompletionPolicy;
  idleTimeoutMs?: number;
  terminateGraceMs?: number;
};

export type ExecutorMode = "single" | "parallel" | "sequential" | "dag";
export type ExecutorThinking = "low" | "medium" | "high";
export type SandboxCleanupPolicy = "always" | "on-success" | "on-failure" | "never";

export type ExecutorRuntimeDefaults = {
  mode?: ExecutorMode;
  completionPolicy?: CompletionPolicy;
  idleTimeoutMs?: number;
  timeoutMs?: number;
  terminateGraceMs?: number;
  maxConcurrency?: number;
  sandboxCleanupPolicy?: SandboxCleanupPolicy;
  preserveSandboxOnFailure?: boolean;
  preferredThinking?: ExecutorThinking;
};

export type ExecutorRoleModelDefaults = {
  preferredModel?: string;
  preferredThinking?: ExecutorThinking;
  fallbackModels?: string[];
};

export type ExecutorModelPolicyConfig = {
  defaultModel?: string;
  fallbackModels?: string[];
  roleDefaults?: Record<string, ExecutorRoleModelDefaults>;
};

export type ExecutorTimeoutHeuristicsConfig = {
  smallTaskMs?: number;
  mediumTaskMs?: number;
  largeTaskMs?: number;
  maxAutoTimeoutMs?: number;
};

export type ExecutorContractConfig = ExecutorRuntimeDefaults & {
  preferredModel?: string;
  preferredThinking?: ExecutorThinking;
};

export type ExecutorStageConfig = ExecutorRuntimeDefaults & {
  preferredModel?: string;
  preferredThinking?: ExecutorThinking;
};

export type ExecutorConfig = {
  defaults?: ExecutorRuntimeDefaults;
  modelPolicy?: ExecutorModelPolicyConfig;
  timeouts?: ExecutorTimeoutHeuristicsConfig;
  contracts?: Record<string, ExecutorContractConfig>;
  stages?: Record<string, ExecutorStageConfig>;
};

type RuntimeConfig = {
  subagent?: {
    defaults?: LifecycleConfig;
    contracts?: Record<string, LifecycleConfig>;
  };
  executor?: ExecutorConfig;
};

const CONFIG_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "config.json");

function isCompletionPolicy(value: unknown): value is CompletionPolicy {
  return value === "agent-end" || value === "process-exit";
}

function isExecutorMode(value: unknown): value is ExecutorMode {
  return value === "single" || value === "parallel" || value === "sequential" || value === "dag";
}

function isExecutorThinking(value: unknown): value is ExecutorThinking {
  return value === "low" || value === "medium" || value === "high";
}

function isSandboxCleanupPolicy(value: unknown): value is SandboxCleanupPolicy {
  return value === "always" || value === "on-success" || value === "on-failure" || value === "never";
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
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

function sanitizeExecutorRuntimeDefaults(value: unknown): ExecutorRuntimeDefaults {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: ExecutorRuntimeDefaults = {};
  if (isExecutorMode(record.mode)) out.mode = record.mode;
  if (isCompletionPolicy(record.completionPolicy)) out.completionPolicy = record.completionPolicy;
  const idleTimeoutMs = asNonNegativeInt(record.idleTimeoutMs);
  if (idleTimeoutMs !== undefined) out.idleTimeoutMs = idleTimeoutMs;
  const timeoutMs = asNonNegativeInt(record.timeoutMs);
  if (timeoutMs !== undefined) out.timeoutMs = timeoutMs;
  const terminateGraceMs = asNonNegativeInt(record.terminateGraceMs);
  if (terminateGraceMs !== undefined) out.terminateGraceMs = terminateGraceMs;
  const maxConcurrency = asNonNegativeInt(record.maxConcurrency);
  if (maxConcurrency !== undefined) out.maxConcurrency = maxConcurrency;
  if (isSandboxCleanupPolicy(record.sandboxCleanupPolicy)) out.sandboxCleanupPolicy = record.sandboxCleanupPolicy;
  if (typeof record.preserveSandboxOnFailure === "boolean") out.preserveSandboxOnFailure = record.preserveSandboxOnFailure;
  if (isExecutorThinking(record.preferredThinking)) out.preferredThinking = record.preferredThinking;
  return out;
}

function sanitizeExecutorRoleModelDefaults(value: unknown): ExecutorRoleModelDefaults {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: ExecutorRoleModelDefaults = {};
  if (typeof record.preferredModel === "string" && record.preferredModel.trim()) out.preferredModel = record.preferredModel;
  if (isExecutorThinking(record.preferredThinking)) out.preferredThinking = record.preferredThinking;
  if (Array.isArray(record.fallbackModels)) {
    out.fallbackModels = record.fallbackModels.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return out;
}

function sanitizeExecutorModelPolicyConfig(value: unknown): ExecutorModelPolicyConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: ExecutorModelPolicyConfig = {};
  if (typeof record.defaultModel === "string" && record.defaultModel.trim()) out.defaultModel = record.defaultModel;
  if (Array.isArray(record.fallbackModels)) {
    out.fallbackModels = record.fallbackModels.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (record.roleDefaults && typeof record.roleDefaults === "object" && !Array.isArray(record.roleDefaults)) {
    out.roleDefaults = Object.fromEntries(
      Object.entries(record.roleDefaults).map(([key, entry]) => [key, sanitizeExecutorRoleModelDefaults(entry)]),
    );
  }
  return out;
}

function sanitizeExecutorTimeoutHeuristicsConfig(value: unknown): ExecutorTimeoutHeuristicsConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const out: ExecutorTimeoutHeuristicsConfig = {};
  const smallTaskMs = asNonNegativeInt(record.smallTaskMs);
  if (smallTaskMs !== undefined) out.smallTaskMs = smallTaskMs;
  const mediumTaskMs = asNonNegativeInt(record.mediumTaskMs);
  if (mediumTaskMs !== undefined) out.mediumTaskMs = mediumTaskMs;
  const largeTaskMs = asNonNegativeInt(record.largeTaskMs);
  if (largeTaskMs !== undefined) out.largeTaskMs = largeTaskMs;
  const maxAutoTimeoutMs = asNonNegativeInt(record.maxAutoTimeoutMs);
  if (maxAutoTimeoutMs !== undefined) out.maxAutoTimeoutMs = maxAutoTimeoutMs;
  return out;
}

function sanitizeExecutorNamedConfigs<T extends ExecutorContractConfig | ExecutorStageConfig>(
  value: unknown,
): Record<string, T> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeExecutorRuntimeDefaults(entry)]);
  return Object.fromEntries(entries) as Record<string, T>;
}

function sanitizeExecutorConfig(value: unknown): ExecutorConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return {
    defaults: sanitizeExecutorRuntimeDefaults(record.defaults),
    modelPolicy: sanitizeExecutorModelPolicyConfig(record.modelPolicy),
    timeouts: sanitizeExecutorTimeoutHeuristicsConfig(record.timeouts),
    contracts: sanitizeExecutorNamedConfigs<ExecutorContractConfig>(record.contracts),
    stages: sanitizeExecutorNamedConfigs<ExecutorStageConfig>(record.stages),
  };
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

export function getExecutorConfig(): ExecutorConfig {
  const config = loadRuntimeConfig();
  return sanitizeExecutorConfig(config.executor);
}

export function getExecutorDefaults(): ExecutorRuntimeDefaults {
  return getExecutorConfig().defaults ?? {};
}

export function getExecutorModelPolicyConfig(): ExecutorModelPolicyConfig {
  return getExecutorConfig().modelPolicy ?? {};
}

export function getExecutorTimeoutHeuristicsConfig(): ExecutorTimeoutHeuristicsConfig {
  return getExecutorConfig().timeouts ?? {};
}

export function getExecutorContractConfig(contractName: string | undefined): ExecutorContractConfig {
  if (!contractName) return {};
  return getExecutorConfig().contracts?.[contractName] ?? {};
}

export function getExecutorStageConfig(stageName: string | undefined): ExecutorStageConfig {
  if (!stageName) return {};
  return getExecutorConfig().stages?.[stageName] ?? {};
}
