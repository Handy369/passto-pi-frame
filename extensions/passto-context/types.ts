/**
 * PasstoContext Types
 * Core type definitions for the extension
 */

// =============================================================================
// Configuration
// =============================================================================

export interface PasstoContextConfig {
  compaction: CompactionConfig;
  memory: MemoryConfig;
  tracking: TrackingConfig;
  grc: GRCConfig;
  logLevel: LogLevel;
}

export interface CompactionConfig {
  enabled: boolean;
  model: string;
  modelProvider: string;
  fallbackModel?: string;
  fallbackProvider?: string;
  maxSummaryTokens: number;
  preserveRecentTurns: number;
}

export interface MemoryConfig {
  enabled: boolean;
  dir: string;
  maxInjectionTokens: number;
  maxMemoryFiles: number;
  maxMemoryAgeDays: number;
  autoExtract: boolean;
}

export interface TrackingConfig {
  enabled: boolean;
  showWidget: boolean;
}

export interface GRCConfig {
  enabled: boolean;
  grcTurnThreshold: number;
  grcCooldownTurns: number;
  curatorKeepRecentTurns: number;
  subagentModel: string;
  subagentModelProvider: string;
  maxReflectorTokens: number;
  maxCuratorSummaryTokens: number;
  principlesDir: string;
  maxPrinciplesInjection: number;
  maxPrinciples: number;
}

export type LogLevel = "error" | "warn" | "info" | "debug";

// =============================================================================
// Memory
// =============================================================================

export type MemoryType = "session_summary" | "entity" | "note";

export interface MemoryItem {
  id: string;
  type: MemoryType;
  created: string; // ISO datetime
  tags: string[];
  content: string;
  score?: number; // Search relevance score
}

export interface MemoryInput {
  type: MemoryType;
  tags: string[];
  content: string;
}

export interface IndexedMemory extends MemoryItem {
  filePath: string;
  _tokens: Set<string>; // Pre-tokenized content + tags for fast search
}

// =============================================================================
// Context Tracking
// =============================================================================

export interface SessionState {
  turnCount: number;
  tokenUsage: TokenUsage | null;
  filesModified: string[];
  toolsUsed: Record<string, number>; // tool name → count
  keyDecisions: string[];
  errors: string[];
  startTime: number;
}

export interface TokenUsage {
  current: number;
  limit: number;
}

// =============================================================================
// GRC
// =============================================================================

export type GRCMode = "normal" | "grc";
export type GRCManualMode = "auto" | "forced-on" | "forced-off";
export type SubagentStatus = "idle" | "running" | "done" | "failed";

export interface GRCState {
  mode: GRCMode;
  manualMode: GRCManualMode;
  turnCount: number;
  grcCycleCount: number;
  reflector: {
    status: SubagentStatus;
    lastAdvice: string | null;
    processedUpToTurn: number;
  };
  curator: {
    status: SubagentStatus;
    lastSummary: string | null;
    processedUpToTurn: number;
    principlesExtracted: number;
  };
  activatedAtTurn: number | null;
  lastGrcTriggerTurn: number;
}

export interface ReflectorResult {
  advice: string;
  hasSubstantiveContent: boolean;
  sections: {
    direction: string;
    blindSpots: string[];
    risks: string[];
    suggestions: string[];
  };
}

export interface PrincipleDraft {
  content: string;
  tags: string[];
}

export interface CuratorResult {
  summary: string;
  principles: PrincipleDraft[];
  sections: {
    goal: string;
    completed: string[];
    decisions: string[];
    files: string[];
    status: string;
    nextSteps: string[];
    warnings: string[];
  };
}

export interface PrincipleItem {
  id: string;
  created: string;
  tags: string[];
  content: string;
  metadata: {
    source?: string;
    hitCount?: number;
    lastUsed?: string;
  };
  score?: number;
}

// =============================================================================
// Compaction
// =============================================================================

export interface CompactionResult {
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  details?: unknown;
}

// =============================================================================
// Logger
// =============================================================================

export interface Logger {
  error(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  info(...args: unknown[]): void;
  debug(...args: unknown[]): void;
}

// =============================================================================
// Pi Event Types (re-exported/typed for extension use)
// =============================================================================

// These are simplified versions of the event types from pi-coding-agent
// Actual types come from the @mariozechner/pi-coding-agent package

export interface PiMessage {
  role: "user" | "assistant" | "toolResult" | "system";
  content: PiContentBlock[];
  toolName?: string;
  toolCallId?: string;
  usage?: PiUsage;
  thinking?: string;
  stopReason?: string;
  errorMessage?: string;
  model?: string;
  timestamp?: number;
}

export interface PiContentBlock {
  type: "text" | "toolCall" | "toolResult" | "thinking" | "image" | "audio";
  text?: string;
  name?: string;
  id?: string;
  arguments?: string | Record<string, unknown>;
  content?: unknown;
  source?: { type: string; mediaType?: string; data?: string };
}

export interface PiUsage {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  totalTokens?: number;
  cost?: { total: number };
}
