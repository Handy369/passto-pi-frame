export type BuilderChecklistItem = {
  id: string;
  text: string;
  done?: boolean;
};

export type BuilderArtifactRef = {
  type: string;
  path?: string;
  runId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
};

export type BuilderInput = {
  goal: string;
  executionPrompt?: string;
  task?: string;
  taskPackage?: {
    title?: string;
    tasks?: string[];
    checklist?: BuilderChecklistItem[];
    constraints?: string[];
    acceptanceCriteria?: string[];
  };
  cwd: string;
  expectedOutputs: string[];
  todolist?: string[];
  constraints?: string[];
  checklist?: BuilderChecklistItem[];
  acceptanceCriteria?: string[];
  driverContext?: string;
  preferredModel?: string;
  preferredThinking?: "low" | "medium" | "high";
  stage?: string;
  resumeState?: Record<string, unknown>;
  sandboxStrategy?: "noop" | "temp-copy" | "worktree";
  executionEngine?: "ralph-loop";
  projectMetadataPath?: string;
  plannerDir?: string;
  executorDir?: string;
  builderDir?: string;
};

export type BuilderPhase =
  | "prepare"
  | "local_plan"
  | "execute"
  | "verify"
  | "summarize";

export type BuilderStatus =
  | "starting"
  | "preparing"
  | "executing"
  | "verifying"
  | "summarizing"
  | "blocked"
  | "completed"
  | "failed";

export type BuilderStateSnapshot = {
  phase: BuilderPhase;
  status: BuilderStatus;
  currentAction: string;
  todoList: string[];
  checklist: BuilderChecklistItem[];
  completedItems: string[];
  artifacts: BuilderArtifactRef[];
  blockers: string[];
  needsAttention: boolean;
  summary: string;
};

export type BuilderArtifactSummary = {
  total: number;
  byType: Record<string, number>;
  primaryWorkspacePath?: string;
  executorBridgeRunId?: string;
};

export type BuilderVerificationReport = {
  verifiedArtifactType?: string;
  verifiedPath?: string;
  verificationMode: "exists-check" | "custom";
  summary: string;
};

export type BuilderResult = {
  finalStatus: "success" | "failed" | "blocked" | "needs_review";
  resultSummary: string;
  producedArtifacts: BuilderArtifactRef[];
  artifactSummary?: BuilderArtifactSummary;
  remainingWork: string[];
  handoffNote: string;
  verificationSummary?: string;
  verificationReport?: BuilderVerificationReport;
  failureReason?: string;
  resumeHint?: string;
  primaryRunId?: string;
  bootstrapReport?: {
    title: string;
    finalStatus: string;
    summary: string;
    primaryRunId?: string;
    artifactSummary?: BuilderArtifactSummary;
    handoffNote: string;
    remainingWork: string[];
    verificationSummary?: string;
  };
  executorContext?: {
    executorType?: string;
    executionEngine?: string;
    projectName?: string;
    cwd?: string;
  };
};
