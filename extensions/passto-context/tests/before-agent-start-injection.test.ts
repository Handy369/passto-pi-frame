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
      subagentModel: 'gemini-3-flash',
      subagentModelProvider: 'opencode',
      maxReflectorTokens: 1500,
      maxCuratorSummaryTokens: 3000,
      principlesDir: '/tmp/principles',
      maxPrinciplesInjection: 3,
      maxPrinciples: 100,
      orchestratorToolPrefixes: ['passto_planner_'],
      widgetNoticeMaxChars: 24,
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
        version: 1,
        agentRound: 4,
        updatedAt: '2026-05-13T12:10:00.000Z',
        active: [
          {
            id: 'goal-memory-chain',
            assertion: '验证 before_agent_start 注入链是否包含历史摘要检索指导',
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
        confidence: 0.91,
        evidence: '当前工作仍在推进同一目标链',
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

test('buildBeforeAgentStartPrompt composes runtime injections end-to-end for before_agent_start', () => {
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

  const result = buildBeforeAgentStartPrompt({
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
  assert.match(result.systemPrompt, /当前焦点目标:/);
  assert.match(result.systemPrompt, /验证 before_agent_start 注入链是否包含历史摘要检索指导/);
  assert.match(result.systemPrompt, /最近对话摘要缓存/);
  assert.match(result.systemPrompt, /Agent Round 2/);
  assert.doesNotMatch(result.systemPrompt, /Agent Round 4/);
  assert.match(result.systemPrompt, /ptc_search_summary/);
  assert.match(result.systemPrompt, /顾问意见/);
  assert.match(result.systemPrompt, /先验证 restore → warehouse → search 链路/);
  assert.match(result.systemPrompt, /经验原则（来自历史会话）/);
  assert.match(result.systemPrompt, /复杂任务应优先验证关键假设/);
  assert.match(result.systemPrompt, /Relevant Context from Memory/);
  assert.match(result.systemPrompt, /summary warehouse/);

  assert.match(result.diagnostics.join(' | '), /generator-charter/);
  assert.match(result.diagnostics.join(' | '), /goal-state\(/);
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

test('buildBeforeAgentStartPrompt records skip diagnostics when runtime injections are disabled or unavailable', () => {
  const config = makeConfig();
  config.grc.enabled = false;
  config.memory.enabled = false;

  const result = buildBeforeAgentStartPrompt({
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
  assert.match(result.diagnostics.join(' | '), /summary-cache:skip/);
  assert.match(result.diagnostics.join(' | '), /summary-search-guidance:skip\(enabled=false\)/);
  assert.match(result.diagnostics.join(' | '), /reflector:skip/);
  assert.match(result.diagnostics.join(' | '), /principles:skip/);
  assert.match(result.diagnostics.join(' | '), /memories:skip\(enabled=false, manager=false\)/);
});
