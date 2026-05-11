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
  latestCuratorSummary?: string | null;
  goalStateSnapshot?: {
    active: number;
    completed: number;
    migrations: number;
    pruned: number;
    updatedRound: number;
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
      `- active=${input.goalStateSnapshot.active}, completed=${input.goalStateSnapshot.completed}, migrations=${input.goalStateSnapshot.migrations}, pruned=${input.goalStateSnapshot.pruned}, updatedRound=${input.goalStateSnapshot.updatedRound}`,
    );
  }

  return `${lines.join('\n')}\n`;
}
