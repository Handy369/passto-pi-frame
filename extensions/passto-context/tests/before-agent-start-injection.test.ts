import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBeforeAgentStartPrompt } from '../before-agent-start-injection.ts';
import { createInitialGRCState } from '../grc-state.ts';
import type { GRCState, MemoryItem, PasstoContextConfig, PrincipleItem, SummaryEntry } from '../types.ts';

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
      enabled: true,
      dir: '/tmp/passto-memory',
      maxInjectionTokens: 2000,
      maxMemoryFiles: 500,
      maxMemoryAgeDays: 90,
      autoExtract: true,
    },
    tracking: {
      enabled: true,
      showWidget: true,
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
      draftGoalEnabled: true,
      subagentModel: 'gemini-3-flash',
      subagentModelProvider: 'opencode',
      maxReflectorTokens: 1500,
      maxCuratorSummaryTokens: 3000,
      principlesDir: '/tmp/principles',
      maxPrinciplesInjection: 3,
      maxPrinciples: 100,
      orchestratorToolPrefixes: ['passto_planner_'],
      widgetNoticeMaxChars: 24,
      lineageSummaryMaxDepth: 8,
    },
    logEnabled: true,
    logLevel: 'debug',
  };
}

function makeSummaryEntry(agentRound: number, goal: string): SummaryEntry {
  return {
    agentRound,
    timestamp: `2026-05-13T12:0${agentRound}:00.000Z`,
    sessionFile: '/tmp/active-session.jsonl',
    sessionEntryRange: {
      startAgentEntryIndex: agentRound * 10,
      endAgentEntryIndex: agentRound * 10 + 5,
    },
    summary: {
      goal,
      completed: [`round ${agentRound} completed item`],
      keyDecisions: [`round ${agentRound} decision`],
      filesChanged: [{ path: `src/round-${agentRound}.ts`, action: 'edit' }],
      status: `round ${agentRound} status`,
      blockers: agentRound === 2 ? ['need history search'] : [],
    },
    sessionPointers: {
      file: '/tmp/active-session.jsonl',
      searchQuery: `round ${agentRound} history search`,
    },
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
      lastAdvice: '先验证 restore → warehouse → search 链路，再做更大改动。',
    },
    curator: {
      ...createInitialGRCState().curator,
      status: 'done',
      lastGoalState: {
        version: 2,
        agentRound: 4,
        updatedAt: '2026-05-13T12:10:00.000Z',
        rootGoalIds: ['goal-memory-chain'],
        currentFocusGoalId: 'goal-injection-check',
        nodes: [
          {
            id: 'goal-memory-chain',
            parentId: null,
            assertion: '验证 before_agent_start 注入链是否包含历史摘要检索指导',
            kind: 'goal',
            status: 'active',
            signal: 'explicit',
            atomicity: 'composite',
            phase: 'execute',
            sinceRound: 2,
            lastTouchedRound: 4,
            lastConfirmedRound: 4,
            priority: 0,
            order: 0,
          },
          {
            id: 'goal-injection-check',
            parentId: 'goal-memory-chain',
            assertion: '检查 GoalTree 焦点注入是否进入 before_agent_start system prompt',
            kind: 'subgoal',
            status: 'active',
            signal: 'explicit',
            atomicity: 'atomic',
            phase: 'testing',
            sinceRound: 4,
            lastTouchedRound: 4,
            lastConfirmedRound: 4,
            priority: 0,
            order: 1,
          },
          {
            id: 'goal-summary-search',
            parentId: 'goal-memory-chain',
            assertion: '保留 summary warehouse 检索指导',
            kind: 'subgoal',
            status: 'suspended',
            signal: 'explicit',
            atomicity: 'atomic',
            phase: 'plan',
            sinceRound: 3,
            lastTouchedRound: 4,
            lastConfirmedRound: 4,
            priority: 0,
            order: 2,
          },
        ],
        migrations: [
          {
            id: 'm-1',
            fromGoalId: 'legacy-goal',
            toGoalId: 'goal-injection-check',
            type: 'refine',
            atRound: 4,
            triggerSignal: 'advance',
            reason: '从泛化注入核查下钻到具体 GoalTree 注入验证。',
          },
        ],
        prunedCount: 0,
      },
      runtimeDraftGoalState: {
        baseGoalStateRound: 4,
        sourceAgentRound: 5,
        createdAt: '2026-05-13T12:11:00.000Z',
        source: 'generator',
        goalState: {
          version: 2,
          agentRound: 5,
          updatedAt: '2026-05-13T12:11:00.000Z',
          rootGoalIds: ['goal-memory-chain'],
          currentFocusGoalId: 'draft-goal',
          nodes: [
            {
              id: 'goal-memory-chain',
              parentId: null,
              assertion: '验证 before_agent_start 注入链是否包含历史摘要检索指导',
              kind: 'goal',
              status: 'active',
              signal: 'explicit',
              atomicity: 'composite',
              phase: 'execute',
              sinceRound: 2,
              lastTouchedRound: 5,
              lastConfirmedRound: 4,
              priority: 0,
              order: 0,
            },
            {
              id: 'draft-goal',
              parentId: 'goal-memory-chain',
              assertion: '当前轮新增的 draft anchor',
              kind: 'subgoal',
              status: 'active',
              signal: 'draft',
              atomicity: 'undecided',
              phase: 'plan',
              sinceRound: 5,
              lastTouchedRound: 5,
              lastConfirmedRound: 5,
              priority: 0,
              order: 3,
            },
          ],
          migrations: [],
          prunedCount: 0,
        },
      },
      runtimeProvisionalOverlay: {
        sourceAgentRound: 5,
        createdAt: '2026-05-13T12:11:00.000Z',
        source: 'generator',
        userGoalState: {
          baseUserGoalTreeRound: 4,
          sourceAgentRound: 5,
          createdAt: '2026-05-13T12:11:00.000Z',
          source: 'generator',
          userGoalTree: {
            version: 1,
            agentRound: 5,
            updatedAt: '2026-05-13T12:11:00.000Z',
            currentFocusUserGoalId: 'draft-goal',
            rootUserGoalIds: ['goal-memory-chain'],
            userGoals: [
              {
                id: 'goal-memory-chain',
                parentId: null,
                assertion: '验证 before_agent_start 注入链是否包含历史摘要检索指导',
                status: 'executing',
                xNodeModelId: 'xnode-goal-memory-chain',
                sinceRound: 2,
                lastTouchedRound: 5,
              },
            ],
          },
        },
        xNodeState: {
          baseXNodeModelRound: null,
          sourceAgentRound: 5,
          createdAt: '2026-05-13T12:11:00.000Z',
          source: 'generator',
          xNodeModel: {
            version: 1,
            userGoalId: 'goal-memory-chain',
            agentRound: 5,
            updatedAt: '2026-05-13T12:11:00.000Z',
            currentFocusXNodeId: 'draft-goal',
            rootXNodeIds: ['goal-memory-chain'],
            nodes: [
              {
                id: 'goal-memory-chain',
                parentId: null,
                assertion: '验证 before_agent_start 注入链是否包含历史摘要检索指导',
                status: 'active',
                atomicity: 'composite',
                phase: 'execute',
                why: { summary: '验证 before_agent_start 注入链是否包含历史摘要检索指导', confidence: 'partial' },
                what: { summary: '验证 before_agent_start 注入链是否包含历史摘要检索指导', confidence: 'partial' },
                flow: { summary: 'phase=execute; atomicity=composite', confidence: 'partial' },
                structure: { summary: 'runtime provisional overlay', confidence: 'partial' },
                runtimeProof: { summary: 'provisional overlay has not been curator-confirmed yet', confidence: 'open' },
                sinceRound: 2,
                lastTouchedRound: 5,
                priority: 0,
                order: 0,
              },
              {
                id: 'draft-goal',
                parentId: 'goal-memory-chain',
                assertion: '当前轮新增的 draft anchor',
                status: 'active',
                atomicity: 'undecided',
                phase: 'plan',
                why: { summary: '当前轮新增的 draft anchor', confidence: 'partial' },
                what: { summary: '当前轮新增的 draft anchor', confidence: 'partial' },
                flow: { summary: 'phase=plan; atomicity=undecided', confidence: 'partial' },
                structure: { summary: 'runtime provisional overlay', confidence: 'partial' },
                runtimeProof: { summary: 'provisional overlay has not been curator-confirmed yet', confidence: 'open' },
                sinceRound: 5,
                lastTouchedRound: 5,
                priority: 0,
                order: 1,
              },
            ],
          },
        },
      },
      lastSignal: {
        type: 'advance',
        confidence: 0.91,
        evidence: '当前工作仍在推进同一目标链',
      },
      lastCertaintyAssessment: {
        dimensions: {
          why: 'closed',
          what: 'closed',
          flow: 'partial',
          structure: 'closed',
          runtimeProof: 'open',
        },
        keyGaps: ['runtimeProof: 尚未验证 before_agent_start 注入结果'],
        nextStepType: 'run_tests',
        confidence: 0.82,
      },
      summaryCache: [
        makeSummaryEntry(2, '验证被挤出窗口的历史摘要仍可检索'),
        makeSummaryEntry(4, '当前 round，不应进入 summary-cache 注入'),
      ],
      lastSummaryEntry: makeSummaryEntry(4, '当前 round，不应进入 summary-cache 注入'),
    },
  };
}

function makeCtx() {
  return {
    sessionManager: {
      getBranch() {
        return [
          {
            type: 'custom',
            customType: 'grc-curator-artifact',
            data: {
              customType: 'grc-curator-artifact',
              agentRound: 2,
              summaryEntry: makeSummaryEntry(2, '验证被挤出窗口的历史摘要仍可检索'),
            },
          },
          {
            type: 'custom',
            customType: 'grc-curator-artifact',
            data: {
              customType: 'grc-curator-artifact',
              agentRound: 4,
              summaryEntry: makeSummaryEntry(4, '当前 round，不应进入 summary-cache 注入'),
            },
          },
        ];
      },
      getSessionFile() {
        return '/tmp/active-session.jsonl';
      },
    },
  };
}

function makePrinciple(content: string): PrincipleItem {
  return {
    id: 'principle-1',
    created: '2026-05-13T11:00:00.000Z',
    tags: ['memory', 'grc'],
    content,
    metadata: {
      origin: 'reflector',
    },
  };
}

function makeMemory(content: string): MemoryItem {
  return {
    id: 'memory-1',
    type: 'session_summary',
    created: '2026-05-13T11:30:00.000Z',
    tags: ['memory'],
    content,
  };
}

test('buildBeforeAgentStartPrompt composes runtime injections end-to-end for before_agent_start', async () => {
  const principles = {
    listInjectable(limit: number) {
      return limit > 0 ? [makePrinciple('复杂任务应优先验证关键假设，而不是连续重复试错。')] : [];
    },
  };

  const memory = {
    search(query: string, limit: number) {
      assert.equal(query, '请继续排查 before_agent_start 注入链');
      assert.equal(limit, 5);
      return [makeMemory('之前已经确认 SummaryCache 只是近期窗口，跨轮历史需走 summary warehouse。')];
    },
    formatForInjection(memories: MemoryItem[], maxTokens: number) {
      assert.equal(maxTokens, 2000);
      assert.equal(memories.length, 1);
      return '--- Relevant Context from Memory (1 items) ---\n### [session summary] memory-1\n之前已经确认 SummaryCache 只是近期窗口，跨轮历史需走 summary warehouse。';
    },
  };

  const result = await buildBeforeAgentStartPrompt({
    event: {
      prompt: '请继续排查 before_agent_start 注入链',
      systemPrompt: 'BASE SYSTEM',
    },
    config: makeConfig(),
    grcState: makeGrcState(),
    orchestrationSuspended: false,
    ctx: makeCtx(),
    principles,
    memory,
  });

  assert.match(result.systemPrompt, /^BASE SYSTEM/);
  assert.match(result.systemPrompt, /PasstoContext Generator Charter/);
  assert.match(result.systemPrompt, /更上层目标链/);
  assert.match(result.systemPrompt, /最近若干个 agent-round 的原始对话/);
  assert.match(result.systemPrompt, /applyUserGoalProjection/);
  assert.match(result.systemPrompt, /reviewState/);
  assert.doesNotMatch(result.systemPrompt, /Draft Goal Runtime 协议/);
  assert.doesNotMatch(result.systemPrompt, /draftGoalOp/);
  assert.match(result.systemPrompt, /当前焦点目标:/);
  assert.match(result.systemPrompt, /\[active\]\[explicit\]\[composite\]\[execute\] 验证 before_agent_start 注入链是否包含历史摘要检索指导/);
  assert.match(result.systemPrompt, /\[active\]\[draft\]\[undecided\]\[plan\] 当前轮新增的 draft anchor/);
  assert.doesNotMatch(result.systemPrompt, /检查 GoalTree 焦点注入是否进入 before_agent_start system prompt/);
  assert.doesNotMatch(result.systemPrompt, /并行活跃目标:/);
  assert.doesNotMatch(result.systemPrompt, /保留 summary warehouse 检索指导/);
  assert.doesNotMatch(result.systemPrompt, /最近目标迁移:/);
  assert.doesNotMatch(result.systemPrompt, /legacy-goal → goal-injection-check/);
  assert.match(result.systemPrompt, /当前用户目标树/);
  assert.match(result.systemPrompt, /当前用户目标:\n- \[executing\] 验证 before_agent_start 注入链是否包含历史摘要检索指导/);
  assert.match(result.systemPrompt, /根用户目标:\n- \[executing\] 验证 before_agent_start 注入链是否包含历史摘要检索指导/);
  assert.match(result.systemPrompt, /当前 XNode 执行模型/);
  assert.match(result.systemPrompt, /绑定用户目标: goal-memory-chain/);
  assert.match(result.systemPrompt, /当前 XNode 焦点路径:/);
  assert.match(result.systemPrompt, /\[active\]\[composite\]\[execute\] 验证 before_agent_start 注入链是否包含历史摘要检索指导/);
  assert.match(result.systemPrompt, /\[active\]\[draft\]\[undecided\]\[plan\] 当前轮新增的 draft anchor/);
  assert.match(result.systemPrompt, /焦点五维摘要:/);
  assert.match(result.systemPrompt, /runtimeProof\[open\]: no first-class runtime proof has been recovered yet from compatibility GoalState/);
  assert.match(result.systemPrompt, /最新 proof: status=missing, mode=self-proof/);
  assert.match(result.systemPrompt, /proof evidence: no first-class runtime proof has been recovered yet from compatibility GoalState/);
  assert.match(result.systemPrompt, /proof signal: runtime-proof-missing/);
  assert.match(result.systemPrompt, /Context \/ Method \/ Proof Packets/);
  assert.match(result.systemPrompt, /ContextParameterPacket/);
  assert.match(result.systemPrompt, /currentFocusUserGoalId=goal-memory-chain/);
  assert.match(result.systemPrompt, /currentFocusXNodeModelId=xnode-goal-memory-chain/);
  assert.match(result.systemPrompt, /currentFocusXNodeId=draft-goal/);
  assert.match(result.systemPrompt, /focusXNodePath=goal-memory-chain > draft-goal/);
  assert.match(result.systemPrompt, /Runtime Context Hint Surface/);
  assert.match(result.systemPrompt, /dynamicStateSource=object-sidecars/);
  assert.match(result.systemPrompt, /focusUserGoalIdCandidate=goal-memory-chain/);
  assert.match(result.systemPrompt, /phaseCandidate=plan/);
  assert.match(result.systemPrompt, /policyHint=plan_repair/);
  assert.match(result.systemPrompt, /constraint=Hints and candidates are for LLM reasoning only/);
  assert.match(result.systemPrompt, /MethodPacket/);
  assert.match(result.systemPrompt, /method packets are advisory method references, not workflow commands/);
  assert.match(result.systemPrompt, /GoalRelationDecision/);
  assert.match(result.systemPrompt, /advisoryOnly=true/);
  assert.match(result.systemPrompt, /RuntimeProofValidation/);
  assert.match(result.systemPrompt, /PostNodeCommit/);
  assert.match(result.systemPrompt, /ProofPacket/);
  assert.match(result.systemPrompt, /targetXNodeModelId=xnode-goal-memory-chain/);
  assert.match(result.systemPrompt, /userVisibleSummary=x-node draft-goal proof status derived from phase=plan \/ confidence=open/);
  assert.match(result.systemPrompt, /当前 proof \/ signal 摘要/);
  assert.match(result.systemPrompt, /targetXNodeId=draft-goal/);
  assert.match(result.systemPrompt, /proofStatus=missing/);
  assert.match(result.systemPrompt, /proofSignals:/);
  assert.match(result.systemPrompt, /runtime-proof-missing: 当前焦点 当前轮新增的 draft anchor 缺少可消费的 proof 记录/);
  assert.match(result.systemPrompt, /当前 policy: plan_repair \(confidence=0\.52\)/);
  assert.match(result.systemPrompt, /当前 policy projection:/);
  assert.match(result.systemPrompt, /why=partial what=partial flow=partial structure=partial runtimeProof=open/);
  assert.match(result.systemPrompt, /推荐下一步: plan_repair/);
  assert.doesNotMatch(result.systemPrompt, /compatibility fallback from certaintyAssessment/);
  assert.match(result.systemPrompt, /当前运行时执行策略/);
  assert.match(result.systemPrompt, /当前 x-node policy projection: plan_repair/);
  assert.match(result.systemPrompt, /policy hint nextStepType: plan_repair/);
  assert.doesNotMatch(result.systemPrompt, /Curator 推荐下一步类型/);
  assert.match(result.systemPrompt, /目标确定性提升层/);
  assert.match(result.systemPrompt, /direct-answer gate/);
  assert.match(result.systemPrompt, /ContextParameterRequest/);
  assert.match(result.systemPrompt, /并行调用 subagent \/ provider/);
  assert.match(result.systemPrompt, /RuntimeProofRecord/);
  assert.match(result.systemPrompt, /最近对话摘要缓存/);
  assert.match(result.systemPrompt, /Agent Round 2/);
  assert.doesNotMatch(result.systemPrompt, /Agent Round 4/);
  assert.match(result.systemPrompt, /ptc_search_summary/);
  assert.match(result.systemPrompt, /parentSession lineage/);
  assert.match(result.systemPrompt, /顾问意见/);
  assert.match(result.systemPrompt, /先验证 restore → warehouse → search 链路/);
  assert.match(result.systemPrompt, /经验原则（来自历史会话）/);
  assert.match(result.systemPrompt, /复杂任务应优先验证关键假设/);
  assert.match(result.systemPrompt, /Relevant Context from Memory/);
  assert.match(result.systemPrompt, /summary warehouse/);

  assert.match(result.diagnostics.join(' | '), /generator-charter/);
  assert.match(result.diagnostics.join(' | '), /goal-state\(.+source=object-sidecars-primary/);
  assert.doesNotMatch(result.diagnostics.join(' | '), /effective-with-provisional-primary|goal-state-bridge/);
  assert.match(result.diagnostics.join(' | '), /user-goal-tree\(1\//);
  assert.match(result.diagnostics.join(' | '), /x-node-model\(2\//);
  assert.doesNotMatch(result.diagnostics.join(' | '), /user-goal-tree\(.+provisional|x-node-model\(.+provisional/);
  assert.match(result.diagnostics.join(' | '), /context-method-proof-packets\(/);
  assert.match(result.diagnostics.join(' | '), /runtime-proof\(missing\//);
  assert.match(result.diagnostics.join(' | '), /next-step-policy\(plan_repair\//);
  assert.match(result.diagnostics.join(' | '), /summary-cache\(2\//);
  assert.match(result.diagnostics.join(' | '), /summary-search-guidance\(2\//);
  assert.match(result.diagnostics.join(' | '), /reflector\(/);
  assert.match(result.diagnostics.join(' | '), /principles\(1\//);
  assert.match(result.diagnostics.join(' | '), /memories\(1\//);

  assert.equal(result.principleUsageCandidates.length, 1);
  assert.equal(result.principleUsageCandidates[0]?.id, 'principle-1');
  assert.equal(result.injectedMemories.length, 1);
  assert.equal(result.injectedMemories[0]?.id, 'memory-1');
});

test('buildBeforeAgentStartPrompt prefers top-level curator proof payload over x-node model proof surface', async () => {
  const grcState = makeGrcState();
  grcState.curator.latestRuntimeProof = {
    targetXNodeId: 'top-level-proof-goal',
    atRound: 4,
    resultSummary: 'top-level proof should override model-level proof summary injection',
    proofMode: 'runtime',
    proofStatus: 'passed',
    evidence: ['verified in real runtime session'],
    verificationMethod: ['browser runtime observation'],
  };
  grcState.curator.latestProofSignals = [
    {
      id: 'proof-top-level-proof-goal-4-runtime-proof-conflicted',
      targetXNodeId: 'top-level-proof-goal',
      atRound: 4,
      type: 'runtime-proof-conflicted',
      message: 'legacy model-level proof surface should no longer win injection priority',
      evidence: ['top-level payload preferred'],
    },
  ];

  const result = await buildBeforeAgentStartPrompt({
    event: {
      prompt: '继续检查 proof 注入优先级',
      systemPrompt: 'BASE SYSTEM',
    },
    config: makeConfig(),
    grcState,
    orchestrationSuspended: false,
    ctx: makeCtx(),
    principles: null,
    memory: null,
  });

  assert.match(result.systemPrompt, /当前 proof \/ signal 摘要/);
  assert.match(result.systemPrompt, /targetXNodeId=top-level-proof-goal/);
  assert.match(result.systemPrompt, /proofStatus=passed/);
  assert.match(result.systemPrompt, /proofMode=runtime/);
  assert.match(result.systemPrompt, /resultSummary=top-level proof should override model-level proof summary injection/);
  assert.match(result.systemPrompt, /runtime-proof-conflicted: legacy model-level proof surface should no longer win injection priority/);
  assert.match(result.diagnostics.join(' | '), /runtime-proof\(passed\/.+source=curator-top-level/);
});

test('buildBeforeAgentStartPrompt records skip diagnostics when runtime injections are disabled or unavailable', async () => {
  const config = makeConfig();
  config.grc.enabled = false;
  config.memory.enabled = false;

  const result = await buildBeforeAgentStartPrompt({
    event: {
      prompt: 'noop',
      systemPrompt: 'BASE',
    },
    config,
    grcState: {
      ...createInitialGRCState(),
      runtimeMode: 'on',
    },
    orchestrationSuspended: false,
    ctx: {
      sessionManager: {
        getBranch() {
          return [];
        },
        getSessionFile() {
          return '/tmp/skip.jsonl';
        },
      },
    },
    principles: null,
    memory: null,
  });

  assert.equal(result.systemPrompt, 'BASE');
  assert.deepEqual(result.principleUsageCandidates, []);
  assert.deepEqual(result.injectedMemories, []);
  assert.match(result.diagnostics.join(' | '), /generator-charter:skip/);
  assert.match(result.diagnostics.join(' | '), /goal-state:skip/);
  assert.match(result.diagnostics.join(' | '), /user-goal-tree:skip/);
  assert.match(result.diagnostics.join(' | '), /x-node-model:skip/);
  assert.match(result.diagnostics.join(' | '), /runtime-proof:skip/);
  assert.match(result.diagnostics.join(' | '), /summary-cache:skip/);
  assert.match(result.diagnostics.join(' | '), /summary-search-guidance:skip\(enabled=false\)/);
  assert.match(result.diagnostics.join(' | '), /reflector:skip/);
  assert.match(result.diagnostics.join(' | '), /principles:skip/);
  assert.match(result.diagnostics.join(' | '), /memories:skip\(enabled=false, manager=false\)/);
});
