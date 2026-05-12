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
  logEnabled: boolean;
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
  midRunTurnThreshold: number;
  keepRecentAgentRounds: number;
  maxContextPercent: number;
  summaryCacheSize: number;
  maxGoalStateActive: number;
  subagentModel: string;
  subagentModelProvider: string;
  maxReflectorTokens: number;
  maxCuratorSummaryTokens: number;
  principlesDir: string;
  maxPrinciplesInjection: number;
  maxPrinciples: number;
  orchestratorToolPrefixes: string[];
  widgetNoticeMaxChars: number;
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
export type RuntimeMode = "on" | "off";
export type SubagentStatus = "idle" | "running" | "done" | "failed";

export interface GRCState {
  mode: GRCMode;
  runtimeMode: RuntimeMode;
  turnCount: number; // legacy compatibility: mirrors completed agent-rounds in v1.1
  totalAgentRounds: number;
  currentAgentRound: number;
  currentTurnRound: number;
  grcCycleCount: number;
  reflector: {
    status: SubagentStatus;
    lastAdvice: string | null;
    lastDiagnosis?: ReflectorDiagnosis | null;
    processedUpToTurn: number; // legacy compatibility
    processedUpToAgentRound: number;
    lastReflectedAgentRound: number;
  };
  curator: {
    status: SubagentStatus;
    lastSummary: string | null;
    lastSummaryEntry: SummaryEntry | null;
    lastGoalState: GoalStateDocument | null;
    lastSignal: GoalStateSignal | null;
    summaryCache: SummaryEntry[];
    processedUpToTurn: number; // legacy compatibility
    processedUpToAgentRound: number;
    lastCuratedAgentRound: number;
    principlesExtracted: number;
  };
  activatedAtTurn: number | null;
  lastGrcTriggerTurn: number;
}

export interface ReflectorGoalContext {
  currentFocusGoalId: string | null;
  focusPath: Array<{
    id: string;
    assertion: string;
    status: "active" | "suspended" | "completed";
  }>;
  siblingActiveGoals: Array<{
    id: string;
    assertion: string;
  }>;
  recentMigrations: Array<{
    fromGoalId: string | null;
    toGoalId: string;
    reason: string;
  }>;
}

export type ReflectorDriftSource =
  | "none"
  | "goal_state_drift"
  | "generator_execution_drift"
  | "curator_misjudgment"
  | "mixed";

export interface ReflectorDiagnosis {
  aligned: boolean;
  driftSource: ReflectorDriftSource;
  confidence: number;
  evidence: string[];
  explanation?: string;
}

export interface ReflectorAssetCandidate {
  type: "reference" | "script";
  title: string;
  rationale: string;
  evidence: string[];
  targetPath?: string;
  scope?: "shared" | "domain";
  notes?: string;
}

export interface ReflectorInput {
  currentRoundConversation: string;
  currentGoalState: GoalStateDocument | null;
  goalContext?: ReflectorGoalContext | null;
  summaryCacheExcerpt?: SummaryEntry[];
  recentCuratorArtifacts?: CuratorArtifactEntry[];
  candidatePrinciples?: PrincipleItem[];
}

export interface ReflectorResult {
  advice: string;
  principleOps: PrincipleOp[];
  diagnosis?: ReflectorDiagnosis | null;
  assetCandidates?: ReflectorAssetCandidate[];
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

export type PrincipleOp =
  | {
      op: "create";
      content: string;
      tags: string[];
    }
  | {
      op: "reuse";
      targetId: string;
    }
  | {
      op: "merge";
      targetId: string;
      content: string;
      tags: string[];
    }
  | {
      op: "conflict";
      targetId: string;
      content: string;
      tags: string[];
    };

export interface SummaryEntry {
  agentRound: number;
  timestamp: string;
  sessionFile?: string;
  sessionEntryRange?: {
    startAgentEntryIndex: number;
    endAgentEntryIndex: number;
  };
  summary: {
    goal: string;
    completed: string[];
    keyDecisions: string[];
    filesChanged: Array<{
      path: string;
      action: "read" | "edit" | "write" | "bash";
    }>;
    status: string;
    blockers: string[];
  };
  sessionPointers?: {
    file?: string;
    searchQuery?: string;
  };
}

export interface GoalStateSignal {
  type: "advance" | "correct" | "supplement" | "continue" | "clarify";
  confidence: number;
  evidence: string;
}

export interface GoalStateDocument {
  version: 1;
  agentRound: number;
  updatedAt: string;
  active: Array<{
    id: string;
    assertion: string;
    status: "active" | "suspended";
    sinceRound: number;
    lastConfirmedRound: number;
    signal: "explicit" | "inferred";
  }>;
  completed: Array<{
    id: string;
    assertion: string;
    completedAtRound: number;
  }>;
  migrations: Array<{
    from: string;
    to: string;
    atRound: number;
    reason: string;
  }>;
  prunedCount: number;
}

export interface CuratorResult {
  summary: string;
  summaryEntry: SummaryEntry | null;
  goalState: GoalStateDocument | null;
  signal: GoalStateSignal | null;
  closureEvidence: string[];
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

export interface CuratorArtifactEntry {
  customType: "grc-curator-artifact";
  agentRound: number;
  recordedAt: string;
  processedUpToUserTurn: number;
  summary: string | null;
  summaryEntry: SummaryEntry | null;
  goalState: GoalStateDocument | null;
  signal: GoalStateSignal | null;
}

export interface ReflectorArtifactEntry {
  customType: "grc-reflector-artifact";
  agentRound: number;
  recordedAt: string;
  diagnosis: ReflectorDiagnosis | null;
  advice: string | null;
  principleOps: PrincipleOp[];
  assetCandidates?: ReflectorAssetCandidate[];
}

export interface AgentRoundBoundaryEntry {
  customType: "passto-round-boundary";
  agentRound: number;
  totalCompletedAgentRounds: number;
  userTurnsAtStart: number;
  createdAt: string;
}

export interface PrincipleItem {
  id: string;
  created: string;
  updated?: string;
  tags: string[];
  content: string;
  metadata: {
    source?: string;
    sources?: string[];
    hintCount?: number;
    activeScore?: number;
    lastHintedAt?: string;
    hintTimestamps?: string[];
    lastDecayAt?: string;
    mergeCount?: number;
    conflictGroupId?: string;
    lifecycle?: "active" | "stale" | "archived" | "disabled";
    // legacy compatibility
    hitCount?: number;
    lastUsed?: string;
    conflictStatus?: "clean" | "needs-review";
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
  flush?(): Promise<void>;
}

// =============================================================================
// Pi Event Types (re-exported/typed for extension use)
// =============================================================================

// These are simplified versions of the event types from pi-coding-agent
// Actual types come from the @earendil-works/pi-coding-agent package

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
