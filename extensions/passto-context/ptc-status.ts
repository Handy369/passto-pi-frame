import type { GRCState, RuntimeMode } from './types.ts';

export interface PTCStatusInput {
  sessionDisplayName: string;
  configFileLabel: string;
  runtimeModeLabel: RuntimeMode;
  memoryEnabled: boolean;
  trackingEnabled: boolean;
  widgetEnabled: boolean;
  grcEnabled: boolean;
  currentMode: GRCState['mode'];
  currentAgentRound: number;
  currentTurnRound: number;
  reflectorStatus: GRCState['reflector']['status'];
  lastReflectedAgentRound: number;
  curatorStatus: GRCState['curator']['status'];
  lastCuratedAgentRound: number;
  summaryCacheRounds: number[];
  lastSignalLabel: string;
  latestCuratorArtifactRound: number | null;
  principlesStored: number;
  orchestratorGuardLabel: string;
  sessionTurnCount: number;
  filesModifiedCount: number;
  contextUsageLabel?: string | null;
  latestReflectorAdvice?: string | null;
  latestReflectorDiagnosisLabel?: string | null;
  latestCuratorSummary?: string | null;
  latestGoalTransitionLabel?: string | null;
  currentUserGoal?: {
    id: string;
    assertion: string;
    executionState?: string;
    reviewState?: string;
    relationState?: string;
  } | null;
  currentXNode?: {
    id: string;
    phase: string;
    atomicity: string;
    status: string;
  } | null;
  latestNextStepPolicy?: {
    nextStepType: "plan_repair" | "generate_children" | "execute_atomic_work" | "run_tests" | "seek_acceptance" | "upward_regression";
    confidence: number;
    runtimeProof: "closed" | "open" | "partial";
    keyGaps: string[];
    source?: "x-node-policy" | "certainty-assessment";
  } | null;
  latestRuntimeProof?: {
    proofStatus: "passed" | "failed" | "partial" | "missing";
    proofMode: "tests" | "runtime" | "human-check" | "self-proof" | "mixed";
    targetXNodeId: string;
    signalTypes?: string[];
  } | null;
  latestCompletion?: {
    localComplete: boolean;
    modelComplete: boolean;
    treeComplete: boolean;
    nextFocusUserGoalId: string | null;
    nextOpenXNodeId: string | null;
  } | null;
  provisionalOverlay?: {
    active: boolean;
    sourceAgentRound: number | null;
    hasUserGoalState: boolean;
    hasXNodeState: boolean;
  } | null;
  goalStateSnapshot?: {
    version: 1 | 2;
    active: number;
    completed: number;
    migrations: number;
    pruned: number;
    updatedRound: number;
    nodes?: number;
  } | null;
}

export function formatPTCStatus(input: PTCStatusInput): string {
  const lines: string[] = ['## PasstoContext Runtime Status', ''];

  lines.push(`- **Session**: \`${input.sessionDisplayName}\``);
  lines.push(`- **配置文件**: ${input.configFileLabel}`);
  lines.push(`- **Runtime**: ${input.runtimeModeLabel}`);
  lines.push(`- **Memory**: ${input.memoryEnabled ? 'on' : 'off'}`);
  lines.push(`- **Tracking**: ${input.trackingEnabled ? 'on' : 'off'}`);
  lines.push(`- **Widget**: ${input.widgetEnabled ? 'on' : 'off'}`);
  lines.push(`- **GRC**: ${input.grcEnabled ? 'on' : 'off'}`);
  lines.push(`- **Session turns**: ${input.sessionTurnCount}`);
  lines.push(`- **Files modified**: ${input.filesModifiedCount}`);
  lines.push(`- **Current mode**: ${input.currentMode}`);
  lines.push(`- **Current agent-round**: ${input.currentAgentRound}`);
  lines.push(`- **Current turn-round**: ${input.currentTurnRound}`);
  lines.push(`- **Reflector status**: ${input.reflectorStatus}`);
  lines.push(`- **Last reflected round**: ${input.lastReflectedAgentRound}`);
  lines.push(`- **Curator status**: ${input.curatorStatus}`);
  lines.push(`- **Last curated round**: ${input.lastCuratedAgentRound}`);
  lines.push(
    `- **SummaryCache entries**: ${input.summaryCacheRounds.length}${input.summaryCacheRounds.length > 0 ? ` (rounds=${input.summaryCacheRounds.join(',')})` : ''}`,
  );
  lines.push(`- **Last Signal**: ${input.lastSignalLabel}`);
  lines.push(`- **Latest Curator Artifact Round**: ${input.latestCuratorArtifactRound ?? 'none'}`);
  lines.push(`- **Principles stored**: ${input.principlesStored}`);
  lines.push(`- **Orchestrator guard**: ${input.orchestratorGuardLabel}`);

  if (input.contextUsageLabel) {
    lines.push(`- **Context usage**: ${input.contextUsageLabel}`);
  }

  if (input.latestReflectorDiagnosisLabel) {
    lines.push('', '### Latest Reflector Diagnosis', input.latestReflectorDiagnosisLabel);
  }

  if (input.latestGoalTransitionLabel) {
    lines.push('', '### Latest Goal Transition', input.latestGoalTransitionLabel);
  }

  if (input.currentUserGoal || input.currentXNode) {
    lines.push('', '### Current Object Focus');
    if (input.currentUserGoal) {
      lines.push(`- userGoalId=${input.currentUserGoal.id}, executionState=${input.currentUserGoal.executionState ?? 'unknown'}, reviewState=${input.currentUserGoal.reviewState ?? 'unknown'}, relationState=${input.currentUserGoal.relationState ?? 'unknown'}`);
      lines.push(`- assertion=${input.currentUserGoal.assertion}`);
    }
    if (input.currentXNode) {
      lines.push(`- xNodeId=${input.currentXNode.id}, phase=${input.currentXNode.phase}, atomicity=${input.currentXNode.atomicity}, status=${input.currentXNode.status}`);
    }
  }

  if (input.latestNextStepPolicy) {
    lines.push('', '### Latest Policy Projection');
    lines.push(`- nextStepType=${input.latestNextStepPolicy.nextStepType}, confidence=${input.latestNextStepPolicy.confidence}, runtimeProof=${input.latestNextStepPolicy.runtimeProof}${input.latestNextStepPolicy.source ? `, source=${input.latestNextStepPolicy.source}` : ''}`);
    if (input.latestNextStepPolicy.keyGaps.length > 0) {
      lines.push(`- keyGaps=${input.latestNextStepPolicy.keyGaps.join('；')}`);
    }
  }

  if (input.latestRuntimeProof) {
    lines.push('', '### Latest Runtime Proof');
    lines.push(`- targetXNodeId=${input.latestRuntimeProof.targetXNodeId}, proofStatus=${input.latestRuntimeProof.proofStatus}, proofMode=${input.latestRuntimeProof.proofMode}`);
    if (input.latestRuntimeProof.signalTypes && input.latestRuntimeProof.signalTypes.length > 0) {
      lines.push(`- proofSignals=${input.latestRuntimeProof.signalTypes.join('；')}`);
    }
  }

  if (input.provisionalOverlay) {
    lines.push('', '### Runtime Provisional Overlay');
    lines.push(`- active=${input.provisionalOverlay.active}, sourceAgentRound=${input.provisionalOverlay.sourceAgentRound ?? 'none'}, userGoalState=${input.provisionalOverlay.hasUserGoalState}, xNodeState=${input.provisionalOverlay.hasXNodeState}`);
  }

  if (input.latestCompletion) {
    lines.push('', '### Latest Completion Closure');
    lines.push(`- localComplete=${input.latestCompletion.localComplete}, modelComplete=${input.latestCompletion.modelComplete}, treeComplete=${input.latestCompletion.treeComplete}`);
    lines.push(`- nextFocusUserGoalId=${input.latestCompletion.nextFocusUserGoalId ?? 'none'}, nextOpenXNodeId=${input.latestCompletion.nextOpenXNodeId ?? 'none'}`);
  }

  if (input.latestReflectorAdvice) {
    lines.push('', '### Latest Reflector Advice', input.latestReflectorAdvice);
  }

  if (input.latestCuratorSummary) {
    const summary = input.latestCuratorSummary.length > 1200
      ? `${input.latestCuratorSummary.slice(0, 1200)}\n...`
      : input.latestCuratorSummary;
    lines.push('', '### Latest Curator Summary', summary);
  }

  if (input.goalStateSnapshot) {
    lines.push('', '### GoalState Snapshot');
    lines.push(
      `- version=${input.goalStateSnapshot.version}, active=${input.goalStateSnapshot.active}, completed=${input.goalStateSnapshot.completed}, migrations=${input.goalStateSnapshot.migrations}, pruned=${input.goalStateSnapshot.pruned}, updatedRound=${input.goalStateSnapshot.updatedRound}${input.goalStateSnapshot.nodes != null ? `, nodes=${input.goalStateSnapshot.nodes}` : ''}`,
    );
  }

  return `${lines.join('\n')}\n`;
}
