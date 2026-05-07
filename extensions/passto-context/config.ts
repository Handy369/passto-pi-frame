/**
 * PasstoContext Configuration
 * Loads and manages the extension configuration from a simple JSON file
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import type { PasstoContextConfig, CompactionConfig, MemoryConfig, TrackingConfig, GRCConfig, LogLevel } from "./types.js";
import { deepMerge, expandHome, getDefaultConfigDir, getDefaultMemoryDir } from "./utils.js";

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_COMPACTION: CompactionConfig = {
  enabled: true,
  model: "gemini-3-flash",
  modelProvider: "opencode",
  fallbackModel: undefined,
  fallbackProvider: undefined,
  maxSummaryTokens: 4000,
  preserveRecentTurns: 3,
};

const DEFAULT_MEMORY: MemoryConfig = {
  enabled: true,
  dir: getDefaultMemoryDir(),
  maxInjectionTokens: 2000,
  maxMemoryFiles: 500,
  maxMemoryAgeDays: 90,
  autoExtract: true,
};

const DEFAULT_TRACKING: TrackingConfig = {
  enabled: true,
  showWidget: true,
};

const DEFAULT_GRC: GRCConfig = {
  enabled: true,
  grcTurnThreshold: 6,
  grcCooldownTurns: 4,
  curatorKeepRecentTurns: 4,
  subagentModel: "gemini-3-flash",
  subagentModelProvider: "opencode",
  maxReflectorTokens: 1500,
  maxCuratorSummaryTokens: 3000,
  principlesDir: "~/.passtocontext/memory/principles",
  maxPrinciplesInjection: 5,
  maxPrinciples: 100,
};

const DEFAULT_LOG_LEVEL: LogLevel = "info";

function getFullDefaults(): PasstoContextConfig {
  return {
    compaction: { ...DEFAULT_COMPACTION },
    memory: { ...DEFAULT_MEMORY },
    tracking: { ...DEFAULT_TRACKING },
    grc: { ...DEFAULT_GRC },
    logLevel: DEFAULT_LOG_LEVEL,
  };
}

// =============================================================================
// Config File Paths
// =============================================================================

function getConfigPath(): string {
  const customPath = process.env.PASSTOCONTEXT_CONFIG;
  if (customPath) return expandHome(customPath);
  return path.join(getDefaultConfigDir(), "config.json");
}

// =============================================================================
// Config Loader
// =============================================================================

/**
 * Load configuration from JSON file, falling back to defaults
 */
export async function loadConfig(): Promise<PasstoContextConfig> {
  const configPath = getConfigPath();

  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const userConfig = JSON.parse(raw) as Partial<PasstoContextConfig>;

    // Ensure memory.dir is expanded
    if (userConfig.memory?.dir) {
      userConfig.memory.dir = expandHome(userConfig.memory.dir);
    }

    // Ensure grc.principlesDir is expanded
    if (userConfig.grc?.principlesDir) {
      userConfig.grc.principlesDir = expandHome(userConfig.grc.principlesDir);
    }

    const merged = deepMerge(getFullDefaults(), userConfig);

    // Validate compaction model
    if (!merged.compaction.model || !merged.compaction.modelProvider) {
      merged.compaction.model = DEFAULT_COMPACTION.model;
      merged.compaction.modelProvider = DEFAULT_COMPACTION.modelProvider;
    }

    // Validate memory dir
    if (!merged.memory.dir) {
      merged.memory.dir = getDefaultMemoryDir();
    }

    // Validate grc principles dir
    if (!merged.grc.principlesDir) {
      merged.grc.principlesDir = expandHome(DEFAULT_GRC.principlesDir);
    }

    return merged;
  } catch (err) {
    // File doesn't exist or is invalid — use defaults
    return getFullDefaults();
  }
}

/**
 * Save configuration to JSON file
 */
export async function saveConfig(config: PasstoContextConfig): Promise<void> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // Ensure directory exists
  await fs.mkdir(configDir, { recursive: true });

  // Write with nice formatting
  const json = JSON.stringify(config, null, 2);
  await fs.writeFile(configPath, json, "utf-8");
}

/**
 * Get the config file path (for display purposes)
 */
export function getConfigFilePath(): string {
  return getConfigPath();
}

/**
 * Create a default config file if none exists
 */
export async function ensureConfigExists(): Promise<PasstoContextConfig> {
  const configPath = getConfigPath();

  try {
    await fs.access(configPath);
    // File exists, load it
    return loadConfig();
  } catch {
    // File doesn't exist, create with defaults
    const defaults = getFullDefaults();
    await saveConfig(defaults);
    return defaults;
  }
}

/**
 * Validate a config object (basic sanity checks)
 */
export function validateConfig(config: PasstoContextConfig): string[] {
  const errors: string[] = [];

  // Compaction validation
  if (config.compaction.maxSummaryTokens < 500) {
    errors.push("compaction.maxSummaryTokens must be >= 500");
  }
  if (config.compaction.maxSummaryTokens > 32000) {
    errors.push("compaction.maxSummaryTokens must be <= 32000");
  }
  if (config.compaction.preserveRecentTurns < 0) {
    errors.push("compaction.preserveRecentTurns must be >= 0");
  }

  // Memory validation
  if (config.memory.maxInjectionTokens < 0) {
    errors.push("memory.maxInjectionTokens must be >= 0");
  }
  if (config.memory.maxMemoryFiles < 1) {
    errors.push("memory.maxMemoryFiles must be >= 1");
  }
  if (config.memory.maxMemoryAgeDays < 1) {
    errors.push("memory.maxMemoryAgeDays must be >= 1");
  }

  // GRC validation
  if (config.grc.grcTurnThreshold < 1) {
    errors.push("grc.grcTurnThreshold must be >= 1");
  }
  if (config.grc.grcCooldownTurns < 0) {
    errors.push("grc.grcCooldownTurns must be >= 0");
  }
  if (config.grc.curatorKeepRecentTurns < 0) {
    errors.push("grc.curatorKeepRecentTurns must be >= 0");
  }
  if (config.grc.maxReflectorTokens < 100) {
    errors.push("grc.maxReflectorTokens must be >= 100");
  }
  if (config.grc.maxCuratorSummaryTokens < 200) {
    errors.push("grc.maxCuratorSummaryTokens must be >= 200");
  }
  if (config.grc.maxPrinciplesInjection < 0) {
    errors.push("grc.maxPrinciplesInjection must be >= 0");
  }
  if (config.grc.maxPrinciples < 1) {
    errors.push("grc.maxPrinciples must be >= 1");
  }
  if (!config.grc.subagentModel) {
    errors.push("grc.subagentModel is required");
  }
  if (!config.grc.subagentModelProvider) {
    errors.push("grc.subagentModelProvider is required");
  }

  // Log level validation
  if (!["error", "warn", "info", "debug"].includes(config.logLevel)) {
    errors.push("logLevel must be one of: error, warn, info, debug");
  }

  return errors;
}
