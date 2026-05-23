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
  maxGoalTreeDepth: number;
  maxGoalTreeNodes: number;
  draftGoalEnabled: boolean;
  subagentModel: string;
  subagentModelProvider: string;
  maxReflectorTokens: number;
  maxCuratorSummaryTokens: number;
  principlesDir: string;
  maxPrinciplesInjection: number;
  maxPrinciples: number;
  orchestratorToolPrefixes: string[];
  widgetNoticeMaxChars: number;
  lineageSummaryMaxDepth: number;
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

export interface GoalTransitionSummary {
  label: string;
  completedAssertion: string | null;
  currentAssertion: string | null;
}

export interface RuntimeDraftGoalState {
  baseGoalStateRound: number | null;
  sourceAgentRound: number;
  createdAt: string;
  goalState: GoalTreeDocument;
  source: "generator";
}

export interface RuntimeProvisionalUserGoalState {
  baseUserGoalTreeRound: number | null;
  sourceAgentRound: number;
  createdAt: string;
  userGoalTree: UserGoalTreeDocument;
  source: "generator";
}

export interface RuntimeProvisionalXNodeState {
  baseXNodeModelRound: number | null;
  sourceAgentRound: number;
  createdAt: string;
  xNodeModel: XNodeModelDocument;
  source: "generator";
}

export interface RuntimeProvisionalOverlay {
  sourceAgentRound: number;
  createdAt: string;
  source: "generator";
  userGoalState: RuntimeProvisionalUserGoalState | null;
  xNodeState: RuntimeProvisionalXNodeState | null;
}

export interface DraftDispositionNodeEdit {
  goalId: string;
  action: "update" | "remove";
  newAssertion?: string;
  newParentId?: string | null;
  newPhase?: GoalNodePhase;
  newAtomicity?: GoalNodeAtomicity;
  newOrder?: number;
}

export interface DraftDisposition {
  goalId: string;
  action: "confirm-draft" | "revise-draft" | "discard-draft";
  revisedAssertion?: string;
  revisedParentGoalId?: string | null;
  subtreeDisposition?: "keep-subtree" | "reparent-subtree" | "merge-into-existing" | "discard-subtree" | "rewrite-subtree";
  mergeTargetGoalId?: string;
  nodeEdits?: DraftDispositionNodeEdit[];
  newCurrentFocusGoalId?: string | null;
  evidence: string;
}

export interface DraftGoalOp {
  action: "create" | "refine-current-draft" | "no-op";
  goal?: {
    assertion: string;
    kind?: "goal" | "subgoal" | "branch";
    parentGoalId?: string | null;
    atomicity?: GoalNodeAtomicity;
    phase?: GoalNodePhase;
  };
  reason: string;
}

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
    lastGoalState: GoalStateAny | null;
    lastUserGoalTree?: UserGoalTreeDocument | null;
    lastXNodeModels?: XNodeModelDocument[];
    runtimeDraftGoalState?: RuntimeDraftGoalState | null;
    runtimeProvisionalOverlay?: RuntimeProvisionalOverlay | null;
    lastSignal: GoalStateSignal | null;
    lastCertaintyAssessment: CertaintyAssessment | null;
    lastPolicyProjection?: XNodePolicyProjection | null;
    latestRuntimeProof?: RuntimeProofRecord | null;
    latestProofSignals?: RuntimeProofSignal[] | null;
    latestGoalTransition?: GoalTransitionSummary | null;
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
    signal?: "explicit" | "inferred" | "draft";
    atomicity?: GoalNodeAtomicity;
    phase?: GoalNodePhase;
  }>;
  siblingActiveGoals: Array<{
    id: string;
    assertion: string;
    signal?: "explicit" | "inferred" | "draft";
    phase?: GoalNodePhase;
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

export interface SlimPrincipleItem {
  id: string;
  tags: string[];
  content: string;
}

export interface ReflectorInput {
  currentRoundConversation: string;
  currentGoalState: GoalStateAny | null;
  goalContext?: ReflectorGoalContext | null;
  summaryCacheExcerpt?: SummaryEntry[];
  recentCuratorArtifacts?: CuratorArtifactEntry[];
  allPrinciples?: SlimPrincipleItem[];
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
    }
  | {
      op: "hit";
      targetId: string;
    }
  | {
      op: "expand";
      targetId: string;
      content: string;
      tags: string[];
    };

export interface SummaryEntry {
  agentRound: number;
  timestamp: string;
  sessionFile?: string;
  lineageDepth?: number;
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
  type: "advance" | "correct" | "supplement" | "continue" | "clarify" | "confirm-draft" | "revise-draft" | "discard-draft";
  confidence: number;
  evidence: string;
}

export type GoalNodePhase =
  | "plan"
  | "plan_insufficient"
  | "execute"
  | "testing"
  | "pending_acceptance"
  | "complete";

export type GoalNodeAtomicity = "atomic" | "composite" | "undecided";

export interface GoalNode {
  id: string;
  parentId: string | null;
  assertion: string;
  kind: "goal" | "subgoal" | "branch";
  status: "active" | "suspended" | "completed";
  signal: "explicit" | "inferred" | "draft";
  atomicity: GoalNodeAtomicity;
  phase: GoalNodePhase;
  sinceRound: number;
  lastTouchedRound: number;
  lastConfirmedRound: number;
  completedAtRound?: number;
  priority: number;
  order: number;
}

export interface GoalTreeMigration {
  id: string;
  fromGoalId: string | null;
  toGoalId: string;
  type: "create" | "refine" | "split" | "pivot" | "resume" | "complete";
  atRound: number;
  triggerSignal: GoalStateSignal["type"];
  reason: string;
}

export interface GoalTreeDocument {
  version: 2;
  agentRound: number;
  updatedAt: string;
  rootGoalIds: string[];
  currentFocusGoalId: string | null;
  nodes: GoalNode[];
  migrations: GoalTreeMigration[];
  lastSignal?: GoalStateSignal;
  prunedCount: number;
}

export interface UserGoalTreeDocument {
  version: 1;
  agentRound: number;
  updatedAt: string;
  currentFocusUserGoalId: string | null;
  rootUserGoalIds: string[];
  userGoals: UserGoalNode[];
  completion?: UserGoalTreeCompletion | null;
}

export type UserGoalExecutionState =
  | "identified"
  | "planning"
  | "executing"
  | "testing"
  | "pending_acceptance"
  | "completed";

export type UserGoalReviewState =
  | "generator_projected"
  | "curator_reviewed"
  | "user_confirmed";

export type UserGoalRelationState =
  | "active"
  | "revised"
  | "superseded"
  | "merged"
  | "split"
  | "migrated"
  | "discarded"
  | "reopened";

export interface UserGoalSource {
  createdBy: "generator" | "curator" | "restore" | "migration";
  lastUpdatedBy: "generator" | "curator" | "user" | "system" | "restore" | "migration";
  sourceUserTurnId?: string;
  sourceAgentRound?: number;
  evidenceEntryIds?: string[];
}

export interface UserGoalNode {
  id: string;
  parentId: string | null;
  assertion: string;
  status: "identified" | "planning" | "executing" | "completed";
  executionState?: UserGoalExecutionState;
  reviewState?: UserGoalReviewState;
  relationState?: UserGoalRelationState;
  source?: UserGoalSource;
  xNodeModelId: string | null;
  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;
}

export interface XNodeModelDocument {
  version: 1;
  id: string;
  userGoalId: string;
  agentRound: number;
  updatedAt: string;
  currentFocusXNodeId: string | null;
  rootXNodeIds: string[];
  nodes: XNode[];
  latestPolicyProjection?: XNodePolicyProjection | null;
  latestRuntimeProof?: RuntimeProofRecord | null;
  latestProofSignals?: RuntimeProofSignal[];
  commitLog?: XNodeCommit[];
  completion?: XNodeModelCompletion | null;
}

export interface UserGoalTreeCompletion {
  treeComplete: boolean;
  completedUserGoalIds: string[];
  openUserGoalIds: string[];
  nextFocusUserGoalId: string | null;
}

export interface XNodeModelCompletion {
  localComplete: boolean;
  modelComplete: boolean;
  completedNodeCount: number;
  openNodeCount: number;
  nextOpenXNodeId: string | null;
}

export interface XNodePolicyProjection {
  xNodeId: string;
  derivedAtRound: number;
  dimensions: {
    why: "open" | "partial" | "closed";
    what: "open" | "partial" | "closed";
    flow: "open" | "partial" | "closed";
    structure: "open" | "partial" | "closed";
    runtimeProof: "open" | "partial" | "closed";
  };
  keyGaps: string[];
  nextStepType: "plan_repair" | "generate_children" | "execute_atomic_work" | "run_tests" | "seek_acceptance" | "upward_regression";
  confidence: number;
  guidance: string[];
}

export interface XNode {
  id: string;
  parentId: string | null;
  assertion: string;
  status: "active" | "suspended" | "completed";
  atomicity: GoalNodeAtomicity;
  phase: GoalNodePhase;
  why: XNodeFacet;
  what: XNodeFacet;
  flow: XNodeFacet;
  structure: XNodeFacet;
  runtimeProof: XNodeFacet;
  sinceRound: number;
  lastTouchedRound: number;
  completedAtRound?: number;
  priority: number;
  order: number;
}

export interface XNodeFacet {
  summary: string;
  confidence: "open" | "partial" | "closed";
  evidence?: string[];
  method?: string[];
}

export interface RuntimeProofRecord {
  targetXNodeId: string;
  atRound: number;
  resultSummary: string;
  proofMode: "tests" | "runtime" | "human-check" | "self-proof" | "mixed";
  proofStatus: "passed" | "failed" | "partial" | "missing";
  evidence: string[];
  verificationMethod: string[];
}

export interface ArtifactRef {
  id: string;
  path?: string;
  kind?: string;
  summary?: string;
}

export interface XNodeCommit {
  commitId: string;
  userGoalId: string;
  xNodeModelId: string;
  xNodeId: string;
  resultStatus: "completed" | "partial" | "blocked";
  outputRefs: ArtifactRef[];
  proofRefs: RuntimeProofRecord[];
  statePatch: {
    phase?: XNode["phase"];
    status?: XNode["status"];
    nextFocusXNodeId?: string | null;
    updatedFacets?: Partial<Record<"why" | "what" | "flow" | "structure" | "runtimeProof", XNodeFacet>>;
  };
  evidence: string[];
}

export interface RuntimeContextHintSurface {
  dynamicStateSource: "object-sidecars" | "goal-state-fallback" | "unresolved_context_state";
  focusUserGoalIdCandidate: string | null;
  focusXNodeModelIdCandidate: string | null;
  focusXNodeIdCandidate: string | null;
  phaseCandidate: XNode["phase"] | "unresolved_context_state" | null;
  phaseEvidence: string[];
  policyHint: XNodePolicyProjection["nextStepType"] | null;
  proofStatusHint: RuntimeProofRecord["proofStatus"] | null;
  warnings: string[];
}

export interface ContextParameterPacket {
  currentFocusUserGoalId: string | null;
  currentFocusXNodeModelId: string | null;
  currentFocusXNodeId: string | null;
  runtimeContextHintSurface: RuntimeContextHintSurface;
  focusUserGoalPath: UserGoalNode[];
  focusXNodePath: XNode[];
  sleepingUserGoals: UserGoalNode[];
  recentArtifacts: ArtifactRef[];
  latestCommits: XNodeCommit[];
  latestRuntimeProof: RuntimeProofRecord | null;
}

export interface MethodPacket {
  methodRef: string;
  purpose: string;
  advisoryOnly: boolean;
  whenToUse: string[];
  inputContract: string[];
  outputContract: string[];
}

export interface ProofPacket {
  targetUserGoalId: string;
  targetXNodeModelId: string;
  targetXNodeId: string;
  proofStatus: RuntimeProofRecord["proofStatus"];
  evidence: string[];
  verificationMethod: string[];
  userVisibleSummary: string;
}

export interface ContextMethodProofPackets {
  contextParameterPacket: ContextParameterPacket;
  methodPackets: MethodPacket[];
  proofPacket: ProofPacket | null;
}

export interface RuntimeProofSignal {
  id: string;
  targetXNodeId: string;
  atRound: number;
  type:
    | "runtime-proof-failed"
    | "runtime-proof-partial"
    | "runtime-proof-missing"
    | "runtime-proof-conflicted";
  message: string;
  suggestedNextStepType?: XNodePolicyProjection["nextStepType"];
  evidence?: string[];
}

export type GoalStateAny = GoalStateDocument | GoalTreeDocument;

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

export interface CertaintyAssessment {
  dimensions: {
    why: "closed" | "open" | "partial";
    what: "closed" | "open" | "partial";
    flow: "closed" | "open" | "partial";
    structure: "closed" | "open" | "partial";
    runtimeProof: "closed" | "open" | "partial";
  };
  keyGaps: string[];
  nextStepType: "plan_repair" | "generate_children" | "execute_atomic_work" | "run_tests" | "seek_acceptance" | "upward_regression";
  confidence: number;
}

export interface CuratorAuditAdvice {
  parentAlignmentWarning?: string | null;
  possibleGoalMisclassification?: string | null;
  suggestedRecovery?: string | null;
  advisoryOnly: true;
}

export interface CuratorResult {
  summary: string;
  summaryEntry: SummaryEntry | null;
  goalState: GoalStateAny | null;
  userGoalTree?: UserGoalTreeDocument | null;
  xNodeModels?: XNodeModelDocument[] | null;
  reconciliationOps?: import("./grc-curator-reconciliation.ts").CuratorReconciliationOp[] | null;
  reconciliationWarnings?: string[];
  auditAdvice?: CuratorAuditAdvice | null;
  lastPolicyProjection?: XNodePolicyProjection | null;
  signal: GoalStateSignal | null;
  closureEvidence: string[];
  certaintyAssessment?: CertaintyAssessment | null;
  latestRuntimeProof?: RuntimeProofRecord | null;
  latestProofSignals?: RuntimeProofSignal[] | null;
  draftGoalOp?: DraftGoalOp | null;
  draftDispositions?: DraftDisposition[] | null;
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
  goalState: GoalStateAny | null;
  userGoalTree?: UserGoalTreeDocument | null;
  xNodeModels?: XNodeModelDocument[] | null;
  reconciliationOps?: import("./grc-curator-reconciliation.ts").CuratorReconciliationOp[] | null;
  reconciliationWarnings?: string[];
  auditAdvice?: CuratorAuditAdvice | null;
  signal: GoalStateSignal | null;
  certaintyAssessment?: CertaintyAssessment | null;
  lastPolicyProjection?: XNodePolicyProjection | null;
  latestRuntimeProof?: RuntimeProofRecord | null;
  latestProofSignals?: RuntimeProofSignal[] | null;
  draftGoalOp?: DraftGoalOp | null;
  draftDispositions?: DraftDisposition[] | null;
  runtimeProvisionalOverlay?: RuntimeProvisionalOverlay | null;
  latestGoalTransition?: GoalTransitionSummary | null;
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
    origin?: "reflector" | "manual";
    promoted?: boolean;
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
