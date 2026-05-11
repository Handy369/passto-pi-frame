import test from 'node:test';
import assert from 'node:assert/strict';

import { buildReflectorInput, buildSummaryCacheExcerpt, buildCandidatePrinciples, extractRecentCuratorArtifacts } from '../grc-reflector-input.ts';
import { buildReflectorGoalContext } from '../grc-goal-context.ts';
import { buildReflectorSubagentPrompt } from '../grc-prompts.ts';
import type { GoalStateDocument, PrincipleItem, SummaryEntry } from '../types.ts';

const goalState: GoalStateDocument = {
  version: 1,
  agentRound: 18,
  updatedAt: '2026-05-11T10:00:00.000Z',
  active: [
    {
      id: 'g-18',
      assertion: '给 Reflector 补齐 grounding 输入',
      status: 'active',
      sinceRound: 18,
      lastConfirmedRound: 18,
      signal: 'explicit',
    },
  ],
  completed: [],
  migrations: [],
  prunedCount: 0,
};

const summaryCache: SummaryEntry[] = Array.from({ length: 6 }, (_, index) => ({
  agentRound: index + 1,
  timestamp: `2026-05-11T10:00:0${index}.000Z`,
  summary: {
    goal: `summary goal ${index + 1}`,
    completed: [],
    keyDecisions: [`decision ${index + 1}`],
    filesChanged: [],
    status: `status ${index + 1}`,
    blockers: [],
  },
}));

const candidatePrinciples: PrincipleItem[] = [
  {
    id: 'principle_a',
    created: '2026-05-01T00:00:00.000Z',
    tags: ['reflector', 'compat'],
    content: '先保证 advice + principleOps 主链兼容，再升级结构化输出。',
    metadata: { activeScore: 4 },
    score: 1.5,
  },
  {
    id: 'principle_b',
    created: '2026-05-02T00:00:00.000Z',
    tags: ['grounding'],
    content: '原则更新应优先基于现有原则候选，而不是盲目 create。',
    metadata: { activeScore: 5 },
    score: 1.2,
  },
];

test('buildSummaryCacheExcerpt keeps only the latest configured entries', () => {
  const excerpt = buildSummaryCacheExcerpt(summaryCache, 4);
  assert.deepEqual(excerpt.map((item) => item.agentRound), [3, 4, 5, 6]);
});

test('extractRecentCuratorArtifacts keeps only the latest valid artifacts', () => {
  const artifacts = extractRecentCuratorArtifacts([
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 16,
        recordedAt: '2026-05-11T10:16:00.000Z',
        processedUpToUserTurn: 30,
        summary: 'r16',
        summaryEntry: null,
        goalState: null,
        signal: null,
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 17,
        recordedAt: '2026-05-11T10:17:00.000Z',
        processedUpToUserTurn: 32,
        summary: 'r17',
        summaryEntry: null,
        goalState: null,
        signal: null,
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 18,
        recordedAt: '2026-05-11T10:18:00.000Z',
        processedUpToUserTurn: 34,
        summary: 'r18',
        summaryEntry: null,
        goalState: null,
        signal: null,
      },
    },
  ], 2);

  assert.deepEqual(artifacts.map((item) => item.agentRound), [17, 18]);
});

test('extractRecentCuratorArtifacts tolerates undefined/null branch message slots', () => {
  const artifacts = extractRecentCuratorArtifacts([
    undefined,
    null,
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 19,
        recordedAt: '2026-05-11T10:19:00.000Z',
        processedUpToUserTurn: 36,
        summary: 'r19',
        summaryEntry: null,
        goalState: null,
        signal: null,
      },
    },
    undefined,
  ], 3);

  assert.deepEqual(artifacts.map((item) => item.agentRound), [19]);
});

test('buildCandidatePrinciples uses principlesManager search and tolerates missing manager', () => {
  const queryCalls: Array<{ query: string; limit: number }> = [];
  const manager = {
    search(query: string, limit: number) {
      queryCalls.push({ query, limit });
      return candidatePrinciples.slice(0, limit);
    },
  };

  const selected = buildCandidatePrinciples(manager, 'reflector grounding compatibility', 2);
  assert.equal(queryCalls.length, 1);
  assert.equal(queryCalls[0]?.limit, 2);
  assert.deepEqual(selected.map((item) => item.id), ['principle_a', 'principle_b']);
  assert.deepEqual(buildCandidatePrinciples(null, 'anything', 3), []);
  assert.deepEqual(buildCandidatePrinciples(manager, '   ', 3), []);
});

test('buildReflectorInput assembles summary/artifact/principle grounding for prompt injection', () => {
  const context = buildReflectorGoalContext(goalState);
  const manager = {
    search(query: string, limit: number) {
      assert.match(query, /Reflector grounding/);
      return candidatePrinciples.slice(0, limit);
    },
  };

  const input = buildReflectorInput({
    currentRoundConversation: '[User]\n请继续推进 Reflector grounding\n\n[Assistant]\n开始修改',
    currentGoalState: goalState,
    goalContext: context,
    summaryCache,
    branchEntries: [
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 17,
          recordedAt: '2026-05-11T10:17:00.000Z',
          processedUpToUserTurn: 32,
          summary: 'r17',
          summaryEntry: null,
          goalState: null,
          signal: null,
        },
      },
      {
        type: 'custom',
        customType: 'grc-curator-artifact',
        data: {
          customType: 'grc-curator-artifact',
          agentRound: 18,
          recordedAt: '2026-05-11T10:18:00.000Z',
          processedUpToUserTurn: 34,
          summary: 'r18',
          summaryEntry: null,
          goalState: null,
          signal: null,
        },
      },
    ],
    principlesManager: manager,
    principleQuery: 'Reflector grounding compatibility query',
    summaryCacheLimit: 4,
    curatorArtifactsLimit: 2,
    candidatePrinciplesLimit: 2,
  });

  assert.deepEqual(input.summaryCacheExcerpt?.map((item) => item.agentRound), [3, 4, 5, 6]);
  assert.deepEqual(input.recentCuratorArtifacts?.map((item) => item.agentRound), [17, 18]);
  assert.deepEqual(input.candidatePrinciples?.map((item) => item.id), ['principle_a', 'principle_b']);

  const prompt = buildReflectorSubagentPrompt(input);
  assert.match(prompt, /<summary_cache_excerpt>/);
  assert.match(prompt, /<recent_curator_artifacts>/);
  assert.match(prompt, /<candidate_principles>/);
  assert.match(prompt, /summary goal 6/);
  assert.match(prompt, /principle_a/);
  assert.match(prompt, /currentGoalState \/ goalContext/);
});
