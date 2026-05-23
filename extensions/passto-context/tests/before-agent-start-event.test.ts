import test from 'node:test';
import assert from 'node:assert/strict';

import { createBeforeAgentStartHandler } from '../before-agent-start-event.ts';
import { createInitialGRCState } from '../grc-state.ts';
import type { GRCState, PasstoContextConfig } from '../types.ts';

function makeConfig(): PasstoContextConfig {
  return {
    compaction: {
      enabled: true,
      model: 'gemini-3-flash',
      modelProvider: 'opencode',
      maxSummaryTokens: 4000,
      preserveRecentTurns: 3,
    },
    memory: {
      enabled: false,
      dir: '/tmp/passto-memory',
      maxInjectionTokens: 2000,
      maxMemoryFiles: 500,
      maxMemoryAgeDays: 90,
      autoExtract: true,
    },
    tracking: {
      enabled: false,
      showWidget: false,
    },
    grc: {
      enabled: true,
      midRunTurnThreshold: 15,
      keepRecentAgentRounds: 1,
      maxContextPercent: 8,
      summaryCacheSize: 8,
      maxGoalStateActive: 8,
      maxGoalTreeDepth: 5,
      maxGoalTreeNodes: 20,
      draftGoalEnabled: false,
      subagentModel: 'gemini-3-flash',
      subagentModelProvider: 'opencode',
      maxReflectorTokens: 1500,
      maxCuratorSummaryTokens: 3000,
      principlesDir: '/tmp/principles',
      maxPrinciplesInjection: 0,
      maxPrinciples: 100,
      orchestratorToolPrefixes: ['passto_planner_'],
      widgetNoticeMaxChars: 24,
      lineageSummaryMaxDepth: 8,
    },
    logEnabled: true,
    logLevel: 'debug',
  };
}

function makeGrcState(): GRCState {
  return {
    ...createInitialGRCState(),
    mode: 'grc',
    runtimeMode: 'on',
    currentAgentRound: 4,
    totalAgentRounds: 4,
    turnCount: 4,
    reflector: {
      ...createInitialGRCState().reflector,
      status: 'done',
      lastAdvice: '仅保留顾问意见，其他 GRC 注入应让行。',
      processedUpToTurn: 4,
      processedUpToAgentRound: 4,
      lastReflectedAgentRound: 4,
    },
    curator: {
      ...createInitialGRCState().curator,
      status: 'done',
      lastGoalState: {
        version: 1,
        agentRound: 4,
        updatedAt: '2026-05-13T12:00:00.000Z',
        active: [
          {
            id: 'goal-1',
            assertion: '这个目标在 orchestrator guard 下不应被注入',
            status: 'active',
            sinceRound: 2,
            lastConfirmedRound: 4,
            signal: 'explicit',
          },
        ],
        completed: [],
        migrations: [],
        prunedCount: 0,
      },
      lastSignal: {
        type: 'advance',
        confidence: 0.9,
        evidence: 'still active',
      },
      lastCertaintyAssessment: {
        dimensions: {
          why: 'closed',
          what: 'closed',
          flow: 'partial',
          structure: 'closed',
          runtimeProof: 'open',
        },
        keyGaps: ['runtimeProof: 尚未补齐 before_agent_start 的运行态证据'],
        nextStepType: 'run_tests',
        confidence: 0.84,
      },
      summaryCache: [
        {
          agentRound: 2,
          timestamp: '2026-05-13T10:00:00.000Z',
          summary: {
            goal: '旧摘要，不应在让行时注入',
            completed: ['x'],
            keyDecisions: ['y'],
            filesChanged: [{ path: 'index.ts', action: 'edit' }],
            status: 'done',
            blockers: [],
          },
          sessionPointers: {
            searchQuery: 'orchestrator skip me',
          },
        },
      ],
      processedUpToTurn: 4,
      processedUpToAgentRound: 4,
      lastCuratedAgentRound: 4,
      principlesExtracted: 0,
    },
  };
}

function makeCtx(branch: Array<{ type?: string; customType?: string; data?: unknown }> = []) {
  return {
    sessionManager: {
      getBranch() {
        return branch;
      },
    },
  };
}

test('before_agent_start event handler returns early when session scope guard fails', async () => {
  let startCalls = 0;
  const handler = createBeforeAgentStartHandler({
    getConfig: () => makeConfig(),
    getGRCState: () => makeGrcState(),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => false,
    updateOrchestrationSuspension() {},
    getSessionScopeGuardReason: () => 'session-mismatch(active=/tmp/a.jsonl, current=/tmp/b.jsonl)',
    isCurrentSessionStateReady: () => false,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => true,
    startGRCBackgroundJobs() {
      startCalls += 1;
    },
    logger: null,
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx(),
  );

  assert.equal(result, undefined);
  assert.equal(startCalls, 0);
});

test('before_agent_start event handler returns early when runtimeMode is off', async () => {
  let startCalls = 0;
  const handler = createBeforeAgentStartHandler({
    getConfig: () => makeConfig(),
    getGRCState: () => ({ ...makeGrcState(), runtimeMode: 'off' }),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => false,
    updateOrchestrationSuspension() {},
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => false,
    isGRCAutoProcessingAllowed: () => true,
    startGRCBackgroundJobs() {
      startCalls += 1;
    },
    logger: null,
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx(),
  );

  assert.equal(result, undefined);
  assert.equal(startCalls, 0);
});

test('before_agent_start event handler auto-starts curator jobs when runtime is ready and no curator is running', async () => {
  let startCalls = 0;
  let receivedTargets: string | null = null;
  let receivedCtx: unknown = null;
  const debugLogs: string[] = [];
  const ctx = makeCtx();

  const handler = createBeforeAgentStartHandler({
    getConfig: () => makeConfig(),
    getGRCState: () => makeGrcState(),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => false,
    updateOrchestrationSuspension() {},
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => true,
    startGRCBackgroundJobs(startCtx, targets) {
      startCalls += 1;
      receivedCtx = startCtx;
      receivedTargets = targets;
    },
    logger: {
      debug(message: string) {
        debugLogs.push(message);
      },
      warn() {},
      error() {},
    },
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    ctx,
  );

  assert.equal(startCalls, 1);
  assert.equal(receivedCtx, ctx);
  assert.equal(receivedTargets, 'curator');
  assert.ok(result);
  assert.match(result.systemPrompt, /^BASE SYSTEM/);
  assert.ok(debugLogs.some((line) => /before_agent_start injection summary:/.test(line)));
  assert.ok(debugLogs.some((line) => /nextStepType=run_tests/.test(line)));
  assert.ok(debugLogs.some((line) => /policyConfidence=0\.84/.test(line)));
  assert.ok(debugLogs.some((line) => /policySource=certainty-assessment/.test(line)));
});

test('before_agent_start event handler prefers x-node policy projection in debug summary when sidecar exists', async () => {
  const debugLogs: string[] = [];
  const state = makeGrcState();
  state.curator.lastUserGoalTree = {
    version: 1,
    agentRound: 4,
    updatedAt: '2026-05-13T12:00:00.000Z',
    currentFocusUserGoalId: 'goal-1',
    rootUserGoalIds: ['goal-1'],
    userGoals: [
      {
        id: 'goal-1',
        parentId: null,
        assertion: '这个目标在 orchestrator guard 下不应被注入',
        status: 'planning',
        xNodeModelId: 'xnode-goal-1',
        sinceRound: 2,
        lastTouchedRound: 4,
      },
    ],
  };
  state.curator.lastXNodeModels = [
    {
      version: 1,
      userGoalId: 'goal-1',
      agentRound: 4,
      updatedAt: '2026-05-13T12:00:00.000Z',
      currentFocusXNodeId: 'goal-1',
      rootXNodeIds: ['goal-1'],
      nodes: [],
      latestPolicyProjection: {
        xNodeId: 'goal-1',
        derivedAtRound: 4,
        dimensions: {
          why: 'partial',
          what: 'partial',
          flow: 'partial',
          structure: 'partial',
          runtimeProof: 'open',
        },
        keyGaps: ['runtimeProof: 尚未补齐 before_agent_start 的运行态证据'],
        nextStepType: 'plan_repair',
        confidence: 0.52,
        guidance: ['当前优先补计划/定义/依赖缺口，再继续实现。'],
      },
    },
  ];

  const handler = createBeforeAgentStartHandler({
    getConfig: () => makeConfig(),
    getGRCState: () => state,
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => false,
    updateOrchestrationSuspension() {},
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => true,
    startGRCBackgroundJobs() {},
    logger: {
      debug(message: string) {
        debugLogs.push(message);
      },
      warn() {},
      error() {},
    },
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx(),
  );

  assert.ok(result);
  assert.ok(debugLogs.some((line) => /nextStepType=plan_repair/.test(line)));
  assert.ok(debugLogs.some((line) => /policyConfidence=0\.52/.test(line)));
  assert.ok(debugLogs.some((line) => /policySource=x-node-policy/.test(line)));
});

test('before_agent_start event handler stays projection-first when draftGoalEnabled is on', async () => {
  const cfg = makeConfig();
  cfg.grc.draftGoalEnabled = true;

  const handler = createBeforeAgentStartHandler({
    getConfig: () => cfg,
    getGRCState: () => makeGrcState(),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => false,
    updateOrchestrationSuspension() {},
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => true,
    startGRCBackgroundJobs() {},
    logger: null,
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx(),
  );

  assert.ok(result);
  assert.match(result.systemPrompt, /applyUserGoalProjection/);
  assert.match(result.systemPrompt, /reviewState/);
  assert.doesNotMatch(result.systemPrompt, /Draft Goal Runtime 协议/);
  assert.doesNotMatch(result.systemPrompt, /draftGoalOp/);
});

test('before_agent_start event handler does not auto-start curator when curatorPromise already exists', async () => {
  let startCalls = 0;
  const runningCuratorPromise = Promise.resolve();

  const handler = createBeforeAgentStartHandler({
    getConfig: () => makeConfig(),
    getGRCState: () => makeGrcState(),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => runningCuratorPromise,
    getOrchestrationSuspended: () => false,
    updateOrchestrationSuspension() {},
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => true,
    startGRCBackgroundJobs() {
      startCalls += 1;
    },
    logger: null,
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx(),
  );

  assert.equal(startCalls, 0);
  assert.ok(result);
  assert.match(result.systemPrompt, /^BASE SYSTEM/);
});


test('before_agent_start event handler does not auto-start curator when grc is disabled', async () => {
  let startCalls = 0;

  const handler = createBeforeAgentStartHandler({
    getConfig: () => ({
      ...makeConfig(),
      grc: {
        ...makeConfig().grc,
        enabled: false,
      },
    }),
    getGRCState: () => makeGrcState(),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => false,
    updateOrchestrationSuspension() {},
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => true,
    startGRCBackgroundJobs() {
      startCalls += 1;
    },
    logger: null,
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx(),
  );

  assert.equal(startCalls, 0);
  assert.ok(result);
  assert.match(result.systemPrompt, /^BASE SYSTEM/);
});

test('before_agent_start event handler does not auto-start curator after updateOrchestrationSuspension flips runtime into suspended state', async () => {
  let startCalls = 0;
  let suspended = false;

  const handler = createBeforeAgentStartHandler({
    getConfig: () => makeConfig(),
    getGRCState: () => makeGrcState(),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => suspended,
    updateOrchestrationSuspension() {
      suspended = true;
    },
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => !suspended,
    startGRCBackgroundJobs() {
      startCalls += 1;
    },
    logger: null,
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx(),
  );

  assert.equal(suspended, true);
  assert.equal(startCalls, 0);
  assert.ok(result);
  assert.match(result.systemPrompt, /^BASE SYSTEM/);
});

test('before_agent_start event handler keeps non-GRC injections disabled under orchestration suspension but still injects reflector advice', async () => {
  let startCalls = 0;
  let suspended = false;
  const handler = createBeforeAgentStartHandler({
    getConfig: () => makeConfig(),
    getGRCState: () => makeGrcState(),
    getPrinciples: () => null,
    getMemory: () => null,
    getCuratorPromise: () => null,
    getOrchestrationSuspended: () => suspended,
    updateOrchestrationSuspension() {
      suspended = true;
    },
    getSessionScopeGuardReason: () => null,
    isCurrentSessionStateReady: () => true,
    isRuntimeEnabled: () => true,
    isGRCAutoProcessingAllowed: () => false,
    startGRCBackgroundJobs() {
      startCalls += 1;
    },
    logger: null,
  });

  const result = await handler(
    { prompt: '继续', systemPrompt: 'BASE SYSTEM' },
    makeCtx([
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 2,
          summaryEntry: makeGrcState().curator.summaryCache[0],
        },
      },
      {
        type: 'message',
        data: undefined,
      },
    ]),
  );

  assert.equal(startCalls, 0);
  assert.ok(result);
  assert.match(result.systemPrompt, /^BASE SYSTEM/);
  assert.match(result.systemPrompt, /顾问意见/);
  assert.match(result.systemPrompt, /仅保留顾问意见/);
  assert.doesNotMatch(result.systemPrompt, /PasstoContext Generator Charter/);
  assert.doesNotMatch(result.systemPrompt, /当前目标状态/);
  assert.doesNotMatch(result.systemPrompt, /最近对话摘要缓存/);
  assert.doesNotMatch(result.systemPrompt, /ptc_search_summary/);
});
