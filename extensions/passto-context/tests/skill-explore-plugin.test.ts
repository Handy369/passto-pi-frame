import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  attachOutcomeProxyToSkillUsageFacts,
  buildSkillAggregateSummaries,
  buildSkillExploreRoundFactsFromBranch,
  buildSkillReviewBundle,
  buildSkillUsageFactsFromBranch,
  extractCuratorArtifactsFromBranch,
  formatSkillProofMetric,
  getSkillExploreRuntimeSnapshotFromBranch,
  groupSkillUsageFactsBySkillVersion,
  listBundleReceipts,
  listReadySkillReviewBundles,
  getLatestReadySkillReviewBundle,
  listReviewedSkillReviewBundles,
  listSkillAggregateSummaries,
  persistBundleReceipt,
  persistSkillAggregateArtifacts,
  persistSkillExploreArtifacts,
  persistSkillReviewBundle,
  readLatestSkillExploreSessionIndex,
  resolveSkillExploreArtifactRoot,
  runSkillExploreAgentEndBridge,
} from '../plugin/skill-explore/index.ts';

test('skill-explore plugin extracts top-agent and subagent skill reads by round', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T10:00:00.000Z',
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/Users/handy/.claude/skills/project-implementation/SKILL.md' },
          },
        ],
      },
    },
    {
      type: 'message',
      message: {
        role: 'toolResult',
        toolName: 'subagent',
        details: {
          results: [
            {
              agent: 'reviewer',
              task: 'review skill routing',
              messages: [
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'toolCall',
                      name: 'read',
                      arguments: { path: '/Users/handy/.claude/skills/subagent-guide/SKILL.md' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 2,
        totalCompletedAgentRounds: 1,
        userTurnsAtStart: 2,
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: JSON.stringify({ path: '/Users/handy/.claude/skills/project-definition/SKILL.md' }),
          },
        ],
      },
    },
  ];

  const roundFacts = buildSkillExploreRoundFactsFromBranch(branch, '/tmp/demo-session.jsonl');
  assert.equal(roundFacts.length, 2);
  assert.equal(roundFacts[0]?.skillReads.length, 2);
  assert.equal(roundFacts[1]?.skillReads.length, 1);
  assert.equal(roundFacts[0]?.skillReads[0]?.source, 'top-agent');
  assert.equal(roundFacts[0]?.skillReads[1]?.source, 'subagent');

  const runtime = getSkillExploreRuntimeSnapshotFromBranch(branch, '/tmp/demo-session.jsonl');
  assert.equal(runtime.skillReadCount, 3);
});

test('skill-explore plugin reuses curator artifact parsing from branch entries', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 3,
        recordedAt: '2026-05-17T11:00:00.000Z',
        processedUpToUserTurn: 2,
        summary: 'round 3 curator artifact',
        summaryEntry: {
          agentRound: 3,
          timestamp: '2026-05-17T11:00:00.000Z',
          summary: {
            goal: '补 P0 helper',
            completed: ['抽出 curator artifact parser 复用点'],
            keyDecisions: ['skill-explore 直接复用 grc-restore parseCuratorArtifactEntry'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.91,
          evidence: '当前轮在推进同一目标链',
        },
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        recordedAt: '2026-05-17T11:01:00.000Z',
      },
    },
  ];

  const artifacts = extractCuratorArtifactsFromBranch(branch);
  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0]?.agentRound, 3);
  assert.equal(artifacts[0]?.summaryEntry?.summary.goal, '补 P0 helper');
  assert.equal(artifacts[0]?.signal?.type, 'advance');
});

test('buildSkillUsageFactsFromBranch joins top-agent skill read with curator artifact by round', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T12:00:00.000Z',
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/Users/handy/.claude/skills/project-implementation/SKILL.md' },
          },
        ],
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 1,
        recordedAt: '2026-05-17T12:00:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round 1 summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T12:00:01.000Z',
          summary: {
            goal: '补 SkillUsageFact join',
            completed: [],
            keyDecisions: ['按 agentRound 做第一版 join'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.95,
          evidence: '同一目标链继续推进',
        },
      },
    },
  ];

  const facts = buildSkillUsageFactsFromBranch(branch, '/tmp/demo-session.jsonl');
  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.session.agentRound, 1);
  assert.equal(facts[0]?.skill.skillName, 'project-implementation');
  assert.equal(facts[0]?.read.source, 'top-agent');
  assert.equal(facts[0]?.context.signalType, 'advance');
  assert.ok((facts[0]?.context.summaryEntryId ?? '').startsWith('tmp-demo-session-'));
  assert.ok((facts[0]?.context.summaryEntryId ?? '').endsWith(':summary:1'));
  assert.equal(facts[0]?.context.taskShapeKey, 'top-agent:skillusagefact-join');
  assert.equal(facts[0]?.context.taskShapeLabel, '补 SkillUsageFact join');
  assert.equal(facts[0]?.context.userIntentLabel, '补 SkillUsageFact join');
  assert.match(facts[0]?.artifactRefs.roundFactsFile ?? '', /round-skill-usage-facts\.json$/);
});

test('buildSkillUsageFactsFromBranch joins subagent skill read with curator artifact by round', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 2,
        totalCompletedAgentRounds: 1,
        userTurnsAtStart: 2,
        createdAt: '2026-05-17T12:05:00.000Z',
      },
    },
    {
      type: 'message',
      message: {
        role: 'toolResult',
        toolName: 'subagent',
        details: {
          results: [
            {
              agent: 'reviewer',
              task: 'review skill routing',
              messages: [
                {
                  role: 'assistant',
                  content: [
                    {
                      type: 'toolCall',
                      name: 'read',
                      arguments: { path: '/Users/handy/.claude/skills/subagent-guide/SKILL.md' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 2,
        recordedAt: '2026-05-17T12:05:01.000Z',
        processedUpToUserTurn: 2,
        summary: 'round 2 summary',
        summaryEntry: {
          agentRound: 2,
          timestamp: '2026-05-17T12:05:01.000Z',
          summary: {
            goal: '验证 subagent join',
            completed: [],
            keyDecisions: [],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'supplement',
          confidence: 0.81,
          evidence: '当前轮为补充推进',
        },
      },
    },
  ];

  const facts = buildSkillUsageFactsFromBranch(branch, '/tmp/demo-session.jsonl');
  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.session.agentRound, 2);
  assert.equal(facts[0]?.skill.skillName, 'subagent-guide');
  assert.equal(facts[0]?.read.source, 'subagent');
  assert.equal(facts[0]?.read.subagentName, 'reviewer');
  assert.equal(facts[0]?.context.signalType, 'supplement');
  assert.equal(facts[0]?.context.taskShapeKey, 'subagent:reviewer:review-skill-routing');
  assert.equal(facts[0]?.context.taskShapeLabel, 'review skill routing');
  assert.equal(facts[0]?.context.userIntentLabel, '验证 subagent join');
});

test('buildSkillUsageFactsFromBranch attaches outcomeProxy from nearest later round in same session and skill bucket', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T12:00:00.000Z',
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/Users/handy/.claude/skills/project-implementation/SKILL.md' },
          },
        ],
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 1,
        recordedAt: '2026-05-17T12:00:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round 1 summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T12:00:01.000Z',
          summary: {
            goal: '第一轮实现',
            completed: [],
            keyDecisions: [],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'continue',
          confidence: 0.8,
          evidence: '仍在推进',
        },
      },
    },
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 2,
        totalCompletedAgentRounds: 1,
        userTurnsAtStart: 2,
        createdAt: '2026-05-17T12:05:00.000Z',
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/Users/handy/.claude/skills/project-implementation/SKILL.md' },
          },
        ],
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 2,
        recordedAt: '2026-05-17T12:05:01.000Z',
        processedUpToUserTurn: 2,
        summary: 'round 2 summary',
        summaryEntry: {
          agentRound: 2,
          timestamp: '2026-05-17T12:05:01.000Z',
          summary: {
            goal: '第二轮纠偏',
            completed: [],
            keyDecisions: [],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'correct',
          confidence: 0.9,
          evidence: '进入纠偏',
        },
      },
    },
  ];

  const facts = buildSkillUsageFactsFromBranch(branch, '/tmp/demo-session.jsonl');
  assert.equal(facts.length, 2);
  assert.equal(facts[0]?.outcomeProxy?.nextSignalType, 'correct');
  assert.equal(facts[0]?.outcomeProxy?.hadCorrectionSoon, true);
  assert.equal(facts[0]?.outcomeProxy?.advancedSoon, false);
  assert.equal(facts[1]?.outcomeProxy, undefined);
});

test('buildSkillUsageFactsFromBranch still emits degraded fact when curator artifact is missing', () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 3,
        totalCompletedAgentRounds: 2,
        userTurnsAtStart: 3,
        createdAt: '2026-05-17T12:10:00.000Z',
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/Users/handy/.claude/skills/project-definition/SKILL.md' },
          },
        ],
      },
    },
  ];

  const facts = buildSkillUsageFactsFromBranch(branch, '/tmp/demo-session.jsonl');
  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.session.agentRound, 3);
  assert.equal(facts[0]?.skill.skillName, 'project-definition');
  assert.equal(facts[0]?.context.signalType, undefined);
  assert.equal(facts[0]?.context.summaryEntryId, undefined);
  assert.equal(facts[0]?.context.taskShapeKey, 'top-agent:skill-read');
  assert.equal(facts[0]?.context.taskShapeLabel, 'top-agent skill read');
  assert.equal(facts[0]?.context.userIntentLabel, undefined);
  assert.equal(facts[0]?.observedAt, '2026-05-17T12:10:00.000Z');
});

test('attachOutcomeProxyToSkillUsageFacts and buildSkillAggregateSummaries derive correctionSoon from next signal', () => {
  const facts = attachOutcomeProxyToSkillUsageFacts([
    {
      factId: 'fact-1',
      observedAt: '2026-05-17T12:00:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 1 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 1 },
      context: {
        signalType: 'continue',
        taskShapeKey: 'top-agent:implement-api',
        taskShapeLabel: 'implement api',
        userIntentLabel: '实现 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
    {
      factId: 'fact-2',
      observedAt: '2026-05-17T12:05:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 2 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'subagent', toolName: 'read', entryIndex: 2, subagentName: 'reviewer', subagentTask: 'review API changes' },
      context: {
        signalType: 'correct',
        taskShapeKey: 'subagent:reviewer:review-api-changes',
        taskShapeLabel: 'review API changes',
        userIntentLabel: '补充检查 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
    {
      factId: 'fact-3',
      observedAt: '2026-05-17T12:10:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 3 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 4 },
      context: {
        signalType: 'advance',
        taskShapeKey: 'top-agent:implement-api',
        taskShapeLabel: 'implement api',
        userIntentLabel: '继续实现 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
  ]);

  assert.equal(facts[0]?.outcomeProxy?.nextSignalType, 'correct');
  assert.equal(facts[0]?.outcomeProxy?.hadCorrectionSoon, true);
  assert.equal(facts[1]?.outcomeProxy?.nextSignalType, 'advance');
  assert.equal(facts[1]?.outcomeProxy?.advancedSoon, true);
  assert.equal(facts[2]?.outcomeProxy, undefined);

  const summaries = buildSkillAggregateSummaries(facts, { generatedAt: '2026-05-17T13:00:00.000Z' });
  assert.equal(summaries.length, 1);
  assert.deepEqual(summaries[0]?.evidencePools.correctionSoonFactIds, ['fact-1']);
  assert.equal(summaries[0]?.taskShapeBreakdown[0]?.taskShapeKey, 'top-agent:implement-api');
  assert.equal(summaries[0]?.taskShapeBreakdown[0]?.nextSignalBreakdown.correct, 1);
  assert.equal(summaries[0]?.taskShapeBreakdown[0]?.nextSignalBreakdown.unknown, 1);
  assert.equal(summaries[0]?.taskShapeBreakdown[1]?.taskShapeKey, 'subagent:reviewer:review-api-changes');
  assert.equal(summaries[0]?.taskShapeBreakdown[1]?.nextSignalBreakdown.advance, 1);
});

test('groupSkillUsageFactsBySkillVersion and buildSkillAggregateSummaries aggregate counts and task shapes', () => {
  const facts = [
    {
      factId: 'fact-1',
      observedAt: '2026-05-17T12:00:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 1 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 1 },
      context: {
        signalType: 'advance',
        taskShapeKey: 'top-agent:implement-api',
        taskShapeLabel: 'implement api',
        userIntentLabel: '实现 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
    {
      factId: 'fact-2',
      observedAt: '2026-05-17T12:05:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 2 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'subagent', toolName: 'read', entryIndex: 2, subagentName: 'reviewer', subagentTask: 'review API changes' },
      context: {
        signalType: 'supplement',
        taskShapeKey: 'subagent:reviewer:review-api-changes',
        taskShapeLabel: 'review API changes',
        userIntentLabel: '补充检查 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
    {
      factId: 'fact-3',
      observedAt: '2026-05-17T12:10:01.000Z',
      session: { sessionFile: '/tmp/b.jsonl', sessionKey: 'session-b', agentRound: 1 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 4 },
      context: {
        signalType: undefined,
        taskShapeKey: 'top-agent:implement-api',
        taskShapeLabel: 'implement api',
        userIntentLabel: undefined,
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-b/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-b/skill-explore-summary.json',
      },
    },
  ];

  const groups = groupSkillUsageFactsBySkillVersion(facts);
  assert.equal(groups.size, 1);

  const summaries = buildSkillAggregateSummaries(facts, { generatedAt: '2026-05-17T13:00:00.000Z' });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]?.skill.skillKey, 'project-implementation');
  assert.equal(summaries[0]?.window.from, '2026-05-17T12:00:01.000Z');
  assert.equal(summaries[0]?.window.to, '2026-05-17T12:10:01.000Z');
  assert.equal(summaries[0]?.window.sessionCount, 2);
  assert.equal(summaries[0]?.window.usageFactCount, 3);
  assert.equal(summaries[0]?.window.roundCount, 3);
  assert.equal(summaries[0]?.counts.totalReads, 3);
  assert.equal(summaries[0]?.counts.topAgentReads, 2);
  assert.equal(summaries[0]?.counts.subagentReads, 1);
  assert.equal(summaries[0]?.counts.uniqueTaskShapes, 2);
  assert.equal(summaries[0]?.signalsAfterRead.advance, 1);
  assert.equal(summaries[0]?.signalsAfterRead.supplement, 1);
  assert.equal(summaries[0]?.signalsAfterRead.unknown, 1);
  assert.equal(summaries[0]?.taskShapeBreakdown[0]?.taskShapeKey, 'top-agent:implement-api');
  assert.equal(summaries[0]?.taskShapeBreakdown[0]?.count, 2);
  assert.deepEqual(summaries[0]?.taskShapeBreakdown[0]?.sampleFactIds, ['fact-1', 'fact-3']);
  assert.deepEqual(summaries[0]?.evidencePools.subagentFactIds, ['fact-2']);
  assert.deepEqual(summaries[0]?.evidencePools.ambiguousFactIds, ['fact-3']);
  assert.deepEqual(summaries[0]?.artifactRefs.usageFactFiles, [
    '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
    '/tmp/root/sessions/session-b/round-skill-usage-facts.json',
  ]);
});

test('groupSkillUsageFactsBySkillVersion separates different version buckets', () => {
  const facts = [
    {
      factId: 'fact-a',
      observedAt: '2026-05-17T12:00:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 1 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
        versionKey: 'v1',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 1 },
      context: { taskShapeKey: 'top-agent:implement-api', taskShapeLabel: 'implement api', userIntentLabel: '实现 API' },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
    {
      factId: 'fact-b',
      observedAt: '2026-05-17T12:01:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 2 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
        versionKey: 'v2',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 2 },
      context: { taskShapeKey: 'top-agent:implement-api', taskShapeLabel: 'implement api', userIntentLabel: '实现 API' },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
  ];

  const groups = groupSkillUsageFactsBySkillVersion(facts);
  assert.equal(groups.size, 2);

  const summaries = buildSkillAggregateSummaries(facts, { generatedAt: '2026-05-17T13:00:00.000Z' });
  assert.equal(summaries.length, 2);
  assert.deepEqual(summaries.map((item) => item.skill.versionKey), ['v1', 'v2']);
});

test('buildSkillReviewBundle maps aggregate into handoff bundle contract', () => {
  const aggregate = buildSkillAggregateSummaries(attachOutcomeProxyToSkillUsageFacts([
    {
      factId: 'fact-1',
      observedAt: '2026-05-17T12:00:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 1 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 1 },
      context: {
        signalType: 'continue',
        taskShapeKey: 'top-agent:implement-api',
        taskShapeLabel: 'implement api',
        userIntentLabel: '实现 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
    {
      factId: 'fact-2',
      observedAt: '2026-05-17T12:05:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 2 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'subagent', toolName: 'read', entryIndex: 2, subagentName: 'reviewer', subagentTask: 'review API changes' },
      context: {
        signalType: 'correct',
        taskShapeKey: 'subagent:reviewer:review-api-changes',
        taskShapeLabel: 'review API changes',
        userIntentLabel: '补充检查 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
  ]), { generatedAt: '2026-05-17T13:00:00.000Z' })[0]!;

  const bundle = buildSkillReviewBundle(aggregate, {
    aggregateSummaryFile: '/tmp/summary.json',
    taskShapesFile: '/tmp/task-shapes.json',
    evidenceIndexFile: '/tmp/evidence-index.json',
    createdAt: '2026-05-17T13:05:00.000Z',
  });

  assert.match(bundle.bundleId, /^bundle:project-implementation:unversioned:/);
  assert.equal(bundle.createdAt, '2026-05-17T13:05:00.000Z');
  assert.equal(bundle.targetSkill.skillKey, 'project-implementation');
  assert.equal(bundle.scope.usageFactCount, 2);
  assert.equal(bundle.summary.totalReads, 2);
  assert.deepEqual(bundle.reviewFocus.correctionSoonCases, ['fact-1']);
  assert.deepEqual(bundle.reviewFocus.subagentCases, ['fact-2']);
  assert.equal(bundle.openQuestions.length, 3);
  assert.equal(bundle.artifactRefs.aggregateSummaryFile, '/tmp/summary.json');
});

test('persistSkillAggregateArtifacts writes summary task-shapes and evidence-index files under aggregate bucket', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-aggregate-'));
  const usageFacts = attachOutcomeProxyToSkillUsageFacts([
    {
      factId: 'fact-1',
      observedAt: '2026-05-17T12:00:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 1 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'top-agent', toolName: 'read', entryIndex: 1 },
      context: {
        signalType: 'continue',
        taskShapeKey: 'top-agent:implement-api',
        taskShapeLabel: 'implement api',
        userIntentLabel: '实现 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
    {
      factId: 'fact-2',
      observedAt: '2026-05-17T12:05:01.000Z',
      session: { sessionFile: '/tmp/a.jsonl', sessionKey: 'session-a', agentRound: 2 },
      skill: {
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
        skillName: 'project-implementation',
        skillFileName: 'SKILL.md',
        skillKey: 'project-implementation',
      },
      read: { source: 'subagent', toolName: 'read', entryIndex: 2, subagentName: 'reviewer', subagentTask: 'review API changes' },
      context: {
        signalType: 'correct',
        taskShapeKey: 'subagent:reviewer:review-api-changes',
        taskShapeLabel: 'review API changes',
        userIntentLabel: '补充检查 API',
      },
      artifactRefs: {
        roundFactsFile: '/tmp/root/sessions/session-a/round-skill-usage-facts.json',
        sessionSummaryFile: '/tmp/root/sessions/session-a/skill-explore-summary.json',
      },
    },
  ]);

  const result = await persistSkillAggregateArtifacts({
    usageFacts,
    rootDir,
    generatedAt: '2026-05-17T13:00:00.000Z',
  });

  assert.equal(result.items.length, 1);
  assert.match(result.items[0]?.aggregateDir ?? '', /aggregates\/by-skill\/project-implementation\/unversioned$/);

  const summary = JSON.parse(await readFile(result.items[0]!.summaryFile, 'utf-8')) as { counts: { totalReads: number } };
  const taskShapes = JSON.parse(await readFile(result.items[0]!.taskShapesFile, 'utf-8')) as Array<{ taskShapeKey: string }>;
  const evidenceIndex = JSON.parse(await readFile(result.items[0]!.evidenceIndexFile, 'utf-8')) as {
    evidencePools: { correctionSoonFactIds: string[] };
    usageFactFiles: string[];
  };

  assert.equal(summary.counts.totalReads, 2);
  assert.deepEqual(taskShapes.map((item) => item.taskShapeKey), [
    'subagent:reviewer:review-api-changes',
    'top-agent:implement-api',
  ]);
  assert.deepEqual(evidenceIndex.evidencePools.correctionSoonFactIds, ['fact-1']);
  assert.deepEqual(evidenceIndex.usageFactFiles, ['/tmp/root/sessions/session-a/round-skill-usage-facts.json']);
});

test('persistSkillReviewBundle and persistBundleReceipt write handoff artifacts and rebuild indexes', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-handoff-'));
  const bundle = {
    bundleId: 'bundle:project-implementation:unversioned:demo',
    createdAt: '2026-05-17T13:05:00.000Z',
    targetSkill: {
      skillKey: 'project-implementation',
      skillName: 'project-implementation',
      skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
    },
    scope: {
      from: '2026-05-17T12:00:01.000Z',
      to: '2026-05-17T12:05:01.000Z',
      usageFactCount: 2,
      sessionCount: 1,
    },
    summary: {
      totalReads: 2,
      topAgentReads: 1,
      subagentReads: 1,
      dominantTaskShapes: ['implement api', 'review API changes'],
      notableSignals: {
        advance: 0,
        correct: 1,
        supplement: 0,
        continue: 1,
        clarify: 0,
      },
    },
    reviewFocus: {
      representativeHits: ['fact-1', 'fact-2'],
      correctionSoonCases: ['fact-1'],
      subagentCases: ['fact-2'],
      ambiguousCases: [],
    },
    openQuestions: ['是否需要拆 skill？'],
    artifactRefs: {
      aggregateSummaryFile: '/tmp/summary.json',
      taskShapesFile: '/tmp/task-shapes.json',
      evidenceIndexFile: '/tmp/evidence-index.json',
    },
  };

  const persistedBundle = await persistSkillReviewBundle({ bundle, rootDir });
  const readyBefore = JSON.parse(await readFile(path.join(rootDir, 'handoff', 'skills-maker', 'indexes', 'ready.json'), 'utf-8')) as Array<{ bundleId: string }>;
  const reviewedBefore = JSON.parse(await readFile(path.join(rootDir, 'handoff', 'skills-maker', 'indexes', 'reviewed.json'), 'utf-8')) as Array<unknown>;

  assert.equal((await readFile(persistedBundle.bundleFile, 'utf-8')).includes('bundle:project-implementation:unversioned:demo'), true);
  assert.deepEqual(readyBefore.map((item) => item.bundleId), ['bundle:project-implementation:unversioned:demo']);
  assert.equal(reviewedBefore.length, 0);

  await persistBundleReceipt({
    rootDir,
    receipt: {
      bundleId: bundle.bundleId,
      consumer: 'skills-maker',
      consumerRunId: 'run-001',
      consumedAt: '2026-05-17T13:10:00.000Z',
      result: {
        status: 'reviewed',
        notes: '先记录 findings',
      },
    },
  });

  await persistBundleReceipt({
    rootDir,
    receipt: {
      bundleId: bundle.bundleId,
      consumer: 'skills-maker',
      consumerRunId: 'run-002',
      consumedAt: '2026-05-17T13:12:00.000Z',
      result: {
        status: 'adopted',
        outputDocPath: '/tmp/output.md',
      },
    },
  });

  const receipts = await listBundleReceipts(bundle.bundleId, rootDir);
  const readyAfter = JSON.parse(await readFile(path.join(rootDir, 'handoff', 'skills-maker', 'indexes', 'ready.json'), 'utf-8')) as Array<unknown>;
  const reviewedAfter = JSON.parse(await readFile(path.join(rootDir, 'handoff', 'skills-maker', 'indexes', 'reviewed.json'), 'utf-8')) as Array<{
    bundleId: string;
    latestReceipt: { consumerRunId: string; result: { status: string } };
  }>;

  assert.deepEqual(receipts.map((item) => item.consumerRunId), ['run-001', 'run-002']);
  assert.equal(readyAfter.length, 0);
  assert.equal(reviewedAfter.length, 1);
  assert.equal(reviewedAfter[0]?.bundleId, bundle.bundleId);
  assert.equal(reviewedAfter[0]?.latestReceipt.consumerRunId, 'run-002');
  assert.equal(reviewedAfter[0]?.latestReceipt.result.status, 'adopted');
});

test('skill-explore plugin persists round facts and latest summary under configured root', async () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/Users/handy/.claude/skills/project-implementation/SKILL.md' },
          },
        ],
      },
    },
  ];

  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-plugin-'));
  const result = await persistSkillExploreArtifacts({
    branch,
    sessionFile: '/tmp/demo-session.jsonl',
    rootDir,
  });

  assert.equal(result.summary.totalSkillReads, 1);

  const summary = JSON.parse(await readFile(result.summaryFile, 'utf-8')) as { totalSkillReads: number };
  const latest = JSON.parse(await readFile(result.latestFile, 'utf-8')) as { totalSkillReads: number };

  assert.equal(summary.totalSkillReads, 1);
  assert.equal(latest.totalSkillReads, 1);
});

test('listReviewedSkillReviewBundles reads reviewed index entries ordered by consumedAt', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-reviewed-'));
  const bundle = {
    bundleId: 'bundle:project-implementation:unversioned:abc',
    createdAt: '2026-05-17T13:00:00.000Z',
    targetSkill: {
      skillKey: 'project-implementation',
      skillName: 'project-implementation',
      skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
    },
    scope: {
      from: '2026-05-17T12:00:00.000Z',
      to: '2026-05-17T12:30:00.000Z',
      usageFactCount: 2,
      sessionCount: 1,
    },
    summary: {
      totalReads: 2,
      topAgentReads: 2,
      subagentReads: 0,
      dominantTaskShapes: ['implement api'],
      notableSignals: {
        advance: 1,
        correct: 0,
        supplement: 1,
        continue: 0,
        clarify: 0,
      },
    },
    reviewFocus: {
      representativeHits: ['fact-1'],
      correctionSoonCases: [],
      subagentCases: [],
      ambiguousCases: [],
    },
    openQuestions: ['是否需要拆 skill'],
    artifactRefs: {
      aggregateSummaryFile: '/tmp/summary.json',
    },
  };

  await persistSkillReviewBundle({ bundle, rootDir });
  await persistBundleReceipt({
    rootDir,
    receipt: {
      bundleId: bundle.bundleId,
      consumer: 'skills-maker',
      consumerRunId: 'run-1',
      consumedAt: '2026-05-17T13:05:00.000Z',
      result: { status: 'reviewed' },
    },
  });

  const reviewed = await listReviewedSkillReviewBundles(rootDir);
  assert.equal(reviewed.length, 1);
  assert.equal(reviewed[0]?.bundleId, bundle.bundleId);
  assert.equal(reviewed[0]?.latestReceipt.consumerRunId, 'run-1');
});

test('listSkillAggregateSummaries filters by target skill and sorts newest first', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-aggregate-list-'));
  await mkdir(path.join(rootDir, 'aggregates', 'by-skill', 'project-implementation', 'unversioned'), { recursive: true });
  await mkdir(path.join(rootDir, 'aggregates', 'by-skill', 'skills-maker', 'unversioned'), { recursive: true });

  await writeFile(
    path.join(rootDir, 'aggregates', 'by-skill', 'project-implementation', 'unversioned', 'summary.json'),
    `${JSON.stringify({
      aggregateId: 'agg-1',
      generatedAt: '2026-05-17T13:00:00.000Z',
      skill: {
        skillKey: 'project-implementation',
        skillName: 'project-implementation',
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
      },
      window: {
        from: '2026-05-17T12:00:00.000Z',
        to: '2026-05-17T12:30:00.000Z',
        sessionCount: 1,
        usageFactCount: 2,
        roundCount: 2,
      },
      counts: {
        totalReads: 2,
        topAgentReads: 2,
        subagentReads: 0,
        uniqueTaskShapes: 1,
      },
      signalsAfterRead: {
        advance: 1,
        correct: 0,
        supplement: 1,
        continue: 0,
        clarify: 0,
        unknown: 0,
      },
      taskShapeBreakdown: [],
      evidencePools: {
        representativeFactIds: ['fact-1'],
        correctionSoonFactIds: [],
        subagentFactIds: [],
        ambiguousFactIds: [],
      },
      artifactRefs: {
        usageFactFiles: ['/tmp/a.json'],
      },
    }, null, 2)}\n`,
    'utf-8',
  );

  await writeFile(
    path.join(rootDir, 'aggregates', 'by-skill', 'skills-maker', 'unversioned', 'summary.json'),
    `${JSON.stringify({
      aggregateId: 'agg-2',
      generatedAt: '2026-05-17T14:00:00.000Z',
      skill: {
        skillKey: 'skills-maker',
        skillName: 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
      window: {
        from: '2026-05-17T13:00:00.000Z',
        to: '2026-05-17T13:30:00.000Z',
        sessionCount: 1,
        usageFactCount: 1,
        roundCount: 1,
      },
      counts: {
        totalReads: 1,
        topAgentReads: 1,
        subagentReads: 0,
        uniqueTaskShapes: 1,
      },
      signalsAfterRead: {
        advance: 0,
        correct: 1,
        supplement: 0,
        continue: 0,
        clarify: 0,
        unknown: 0,
      },
      taskShapeBreakdown: [],
      evidencePools: {
        representativeFactIds: ['fact-2'],
        correctionSoonFactIds: ['fact-2'],
        subagentFactIds: [],
        ambiguousFactIds: [],
      },
      artifactRefs: {
        usageFactFiles: ['/tmp/b.json'],
      },
    }, null, 2)}\n`,
    'utf-8',
  );

  const allSummaries = await listSkillAggregateSummaries({ rootDir });
  assert.equal(allSummaries.length, 2);
  assert.equal(allSummaries[0]?.skill.skillKey, 'skills-maker');
  assert.equal(allSummaries[1]?.skill.skillKey, 'project-implementation');

  const filtered = await listSkillAggregateSummaries({ rootDir, targetSkill: 'project-implementation' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.skill.skillKey, 'project-implementation');
});

test('readLatestSkillExploreSessionIndex and resolveSkillExploreArtifactRoot expose latest session pointer', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-latest-index-'));
  await mkdir(path.join(rootDir, 'latest'), { recursive: true });
  await writeFile(
    path.join(rootDir, 'latest', 'latest-session.json'),
    `${JSON.stringify({
      sessionFile: '/tmp/demo.jsonl',
      sessionKey: 'demo-session',
      updatedAt: '2026-05-17T15:00:00.000Z',
      totalSkillReads: 7,
      summaryFile: '/tmp/summary.json',
      roundFactsFile: '/tmp/round-facts.json',
    }, null, 2)}\n`,
    'utf-8',
  );

  const latest = await readLatestSkillExploreSessionIndex(rootDir);
  assert.equal(latest?.sessionKey, 'demo-session');
  assert.equal(latest?.totalSkillReads, 7);
  assert.equal(resolveSkillExploreArtifactRoot(rootDir), rootDir);
});

test('runSkillExploreAgentEndBridge auto-persists aggregate and ready bundle for unread receipt state', async () => {
  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T16:00:00.000Z',
      },
    },
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'toolCall',
            name: 'read',
            arguments: { path: '/Users/handy/.claude/skills/project-implementation/SKILL.md' },
          },
        ],
      },
    },
    {
      type: 'custom',
      customType: 'grc-curator-artifact',
      data: {
        customType: 'grc-curator-artifact',
        agentRound: 1,
        recordedAt: '2026-05-17T16:00:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round 1 summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T16:00:01.000Z',
          summary: {
            goal: '实现自动产 bundle',
            completed: [],
            keyDecisions: ['agent_end 先自动落 aggregate 与 ready bundle'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.88,
          evidence: '继续推进同一实现目标',
        },
      },
    },
  ];

  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-bridge-'));
  const result = await runSkillExploreAgentEndBridge({
    branch,
    sessionFile: '/tmp/bridge-session.jsonl',
    rootDir,
  });

  const readyIndex = await listReadySkillReviewBundles(rootDir);
  const latestReady = await getLatestReadySkillReviewBundle(rootDir);
  const reviewedIndex = JSON.parse(await readFile(path.join(rootDir, 'handoff', 'skills-maker', 'indexes', 'reviewed.json'), 'utf-8')) as Array<unknown>;
  const aggregateSummary = JSON.parse(await readFile(path.join(rootDir, 'aggregates', 'by-skill', 'project-implementation', 'unversioned', 'summary.json'), 'utf-8')) as {
    counts: { totalReads: number };
    signalsAfterRead: { advance: number };
  };

  assert.equal(result.summary.totalSkillReads, 1);
  assert.equal(result.usageFacts?.length, 1);
  assert.equal(result.aggregateResult?.items.length, 1);
  assert.equal(result.bundleFiles?.length, 1);
  assert.equal(readyIndex.length, 1);
  assert.equal(reviewedIndex.length, 0);
  assert.match(readyIndex[0]?.bundleId ?? '', /^bundle:project-implementation:unversioned:/);
  assert.equal(latestReady?.entry.bundleId, readyIndex[0]?.bundleId);
  assert.equal(latestReady?.bundle.targetSkill.skillKey, 'project-implementation');
  assert.equal(aggregateSummary.counts.totalReads, 1);
  assert.equal(aggregateSummary.signalsAfterRead.advance, 1);
});

test('formatSkillProofMetric appends skill read count after existing created count', () => {
  assert.equal(formatSkillProofMetric(3, 12), '记:3+12');
  assert.equal(formatSkillProofMetric(-1, -2), '记:0+0');
});
