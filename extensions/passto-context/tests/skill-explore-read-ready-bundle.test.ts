import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import {
  getPreferredReadySkillReviewBundle,
  persistSkillReviewBundle,
  runSkillExploreAgentEndBridge,
} from '../plugin/skill-explore/index.ts';

const execFileAsync = promisify(execFile);

test('skill-explore ready reader returns explicit downgrade when no ready bundle exists', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-empty-'));
  const scriptPath = path.resolve('scripts/skill-explore-read-ready-bundle.mjs');

  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
  ], {
    cwd: path.resolve('.'),
  });

  const result = JSON.parse(stdout) as {
    found: boolean;
    mode: string;
    reason: string;
  };

  assert.equal(result.found, false);
  assert.equal(result.mode, 'audit');
  assert.match(result.reason, /缺少 runtime evidence|不存在 ready bundle/);
});

test('skill-explore ready reader supports markdown downgrade output', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-empty-md-'));
  const scriptPath = path.resolve('scripts/skill-explore-read-ready-bundle.mjs');

  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
    '--format', 'markdown',
  ], {
    cwd: path.resolve('.'),
  });

  assert.match(stdout, /# Skill Explore Ready Bundle Read Result/);
  assert.match(stdout, /found: false/);
  assert.match(stdout, /缺少 runtime evidence|不存在 ready bundle/);
});

test('skill-explore ready reader picks latest ready bundle and returns bundle-layer evidence', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-found-'));
  const scriptPath = path.resolve('scripts/skill-explore-read-ready-bundle.mjs');

  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T17:00:00.000Z',
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
        recordedAt: '2026-05-17T17:00:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round 1 summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T17:00:01.000Z',
          summary: {
            goal: '验证 ready bundle 主动扫描',
            completed: [],
            keyDecisions: ['先扫 ready index，再读 bundle'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.9,
          evidence: '继续推进同一目标',
        },
      },
    },
  ];

  await runSkillExploreAgentEndBridge({
    branch,
    sessionFile: '/tmp/ready-reader-session.jsonl',
    rootDir,
  });

  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
  ], {
    cwd: path.resolve('.'),
  });

  const result = JSON.parse(stdout) as {
    found: boolean;
    readLayer: string;
    selection: {
      strategy: string;
      requestedTargetSkill?: string;
      orderedBy: string[];
      signalRichness: { notableSignalTotal: number; usageFactCount: number; totalReads: number };
    };
    selectionSummary: {
      orderedByText: string;
      signalRichness: { notableSignalTotal: number; usageFactCount: number; totalReads: number };
    };
    readyEntry: { bundleId: string };
    bundle: { targetSkill: { skillKey: string } };
    decision: { mode: string; decision: string };
  };

  assert.equal(result.selectionSummary.orderedByText, 'newer -> richer-signals');
  assert.equal(result.selectionSummary.signalRichness.notableSignalTotal, result.selection.signalRichness.notableSignalTotal);
  assert.equal(result.selectionSummary.signalRichness.usageFactCount, result.selection.signalRichness.usageFactCount);
  assert.equal(result.selectionSummary.signalRichness.totalReads, result.selection.signalRichness.totalReads);

  assert.equal(result.found, true);
  assert.equal(result.readLayer, 'bundle');
  assert.equal(result.selection.strategy, 'latest');
  assert.deepEqual(result.selection.orderedBy, ['newer', 'richer-signals']);
  assert.match(result.readyEntry.bundleId, /^bundle:project-implementation:unversioned:/);
  assert.equal(result.bundle.targetSkill.skillKey, 'project-implementation');
  assert.equal(result.decision.mode, 'audit');
  assert.match(result.decision.decision, /runtime evidence|重构/);
});

test('skill-explore ready reader supports markdown output with selection details', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-found-md-'));
  const scriptPath = path.resolve('scripts/skill-explore-read-ready-bundle.mjs');

  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T17:10:00.000Z',
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
        recordedAt: '2026-05-17T17:10:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round md summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T17:10:01.000Z',
          summary: {
            goal: '验证 markdown 输出',
            completed: [],
            keyDecisions: ['展示 selection 细节'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.92,
          evidence: 'markdown proof',
        },
      },
    },
  ];

  await runSkillExploreAgentEndBridge({
    branch,
    sessionFile: '/tmp/ready-reader-markdown-session.jsonl',
    rootDir,
  });

  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
    '--format', 'markdown',
  ], {
    cwd: path.resolve('.'),
  });

  assert.match(stdout, /# Skill Explore Ready Bundle Read Result: project-implementation/);
  assert.match(stdout, /## 1\. 选择依据/);
  assert.match(stdout, /orderedBy: `newer -> richer-signals`/);
  assert.match(stdout, /signalRichness\.notableSignalTotal/);
  assert.match(stdout, /## 2\. 读取对象/);
  assert.match(stdout, /## 4\. 判断结果/);
});

test('skill-explore ready reader prefers requested target skill and falls back to latest when absent', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-target-'));
  const scriptPath = path.resolve('scripts/skill-explore-read-ready-bundle.mjs');

  const branchA = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T16:59:00.000Z',
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
        recordedAt: '2026-05-17T16:59:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round A summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T16:59:01.000Z',
          summary: {
            goal: '先生成 project-implementation ready bundle',
            completed: [],
            keyDecisions: ['A'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.9,
          evidence: 'A',
        },
      },
    },
  ];

  const branchB = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T17:00:00.000Z',
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
            arguments: { path: '/Users/handy/.pi/agent/skills/pi-cli/SKILL.md' },
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
        recordedAt: '2026-05-17T17:00:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round B summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T17:00:01.000Z',
          summary: {
            goal: '后生成 pi-cli ready bundle',
            completed: [],
            keyDecisions: ['B'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.91,
          evidence: 'B',
        },
      },
    },
  ];

  await runSkillExploreAgentEndBridge({
    branch: branchA,
    sessionFile: '/tmp/ready-target-a.jsonl',
    rootDir,
  });
  await runSkillExploreAgentEndBridge({
    branch: branchB,
    sessionFile: '/tmp/ready-target-b.jsonl',
    rootDir,
  });

  const { stdout: targetedStdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
    '--target-skill', 'project-implementation',
  ], {
    cwd: path.resolve('.'),
  });

  const targeted = JSON.parse(targetedStdout) as {
    found: boolean;
    selection: {
      strategy: string;
      requestedTargetSkill?: string;
      orderedBy: string[];
      signalRichness: { notableSignalTotal: number; usageFactCount: number; totalReads: number };
    };
    selectionSummary: {
      orderedByText: string;
      signalRichness: { notableSignalTotal: number; usageFactCount: number; totalReads: number };
    };
    bundle: { targetSkill: { skillKey: string } };
  };

  assert.equal(targeted.selectionSummary.orderedByText, 'target-skill -> newer -> richer-signals');

  assert.equal(targeted.found, true);
  assert.equal(targeted.selection.strategy, 'target-skill');
  assert.equal(targeted.selection.requestedTargetSkill, 'project-implementation');
  assert.deepEqual(targeted.selection.orderedBy, ['target-skill', 'newer', 'richer-signals']);
  assert.equal(targeted.bundle.targetSkill.skillKey, 'project-implementation');

  const { stdout: fallbackStdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
    '--target-skill', 'non-existent-skill',
  ], {
    cwd: path.resolve('.'),
  });

  const fallback = JSON.parse(fallbackStdout) as {
    found: boolean;
    selection: {
      strategy: string;
      requestedTargetSkill?: string;
      orderedBy: string[];
      signalRichness: { notableSignalTotal: number; usageFactCount: number; totalReads: number };
    };
    selectionSummary: {
      orderedByText: string;
      signalRichness: { notableSignalTotal: number; usageFactCount: number; totalReads: number };
    };
    bundle: { targetSkill: { skillKey: string } };
  };

  assert.equal(fallback.selectionSummary.orderedByText, 'target-skill -> newer -> richer-signals');

  assert.equal(fallback.found, true);
  assert.equal(fallback.selection.strategy, 'latest-fallback');
  assert.equal(fallback.selection.requestedTargetSkill, 'non-existent-skill');
  assert.deepEqual(fallback.selection.orderedBy, ['target-skill', 'newer', 'richer-signals']);
  assert.equal(fallback.bundle.targetSkill.skillKey, 'pi-cli');
});

test('getPreferredReadySkillReviewBundle applies newer before richer signals', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-priority-'));
  const aggregateSummaryFile = path.join(rootDir, 'aggregates', 'summary.json');

  await persistSkillReviewBundle({
    rootDir,
    bundle: {
      bundleId: 'bundle:older-richer',
      createdAt: '2026-05-17T10:00:00.000Z',
      targetSkill: {
        skillKey: 'typescript-skills',
        skillName: 'typescript-skills',
        skillPath: '/Users/handy/.pi/agent/skills/typescript-skills/SKILL.md',
      },
      scope: {
        from: '2026-05-17T09:00:00.000Z',
        to: '2026-05-17T10:00:00.000Z',
        usageFactCount: 9,
        sessionCount: 2,
      },
      summary: {
        totalReads: 9,
        topAgentReads: 9,
        subagentReads: 0,
        dominantTaskShapes: ['older-richer'],
        notableSignals: {
          advance: 4,
          correct: 3,
          supplement: 1,
          continue: 0,
          clarify: 0,
        },
      },
      reviewFocus: {
        representativeHits: ['fact-1'],
        correctionSoonCases: ['fact-2'],
        subagentCases: [],
        ambiguousCases: [],
      },
      openQuestions: ['older richer'],
      artifactRefs: {
        aggregateSummaryFile,
      },
    },
  });

  await persistSkillReviewBundle({
    rootDir,
    bundle: {
      bundleId: 'bundle:newer-thinner',
      createdAt: '2026-05-17T11:00:00.000Z',
      targetSkill: {
        skillKey: 'pi-cli',
        skillName: 'pi-cli',
        skillPath: '/Users/handy/.pi/agent/skills/pi-cli/SKILL.md',
      },
      scope: {
        from: '2026-05-17T10:30:00.000Z',
        to: '2026-05-17T11:00:00.000Z',
        usageFactCount: 1,
        sessionCount: 1,
      },
      summary: {
        totalReads: 1,
        topAgentReads: 1,
        subagentReads: 0,
        dominantTaskShapes: ['newer-thinner'],
        notableSignals: {
          advance: 0,
          correct: 0,
          supplement: 0,
          continue: 0,
          clarify: 0,
        },
      },
      reviewFocus: {
        representativeHits: ['fact-3'],
        correctionSoonCases: [],
        subagentCases: [],
        ambiguousCases: [],
      },
      openQuestions: ['newer thinner'],
      artifactRefs: {
        aggregateSummaryFile,
      },
    },
  });

  const selected = await getPreferredReadySkillReviewBundle({ rootDir });

  assert.ok(selected);
  assert.equal(selected.selection.strategy, 'latest');
  assert.deepEqual(selected.selection.orderedBy, ['newer', 'richer-signals']);
  assert.equal(selected.bundle.targetSkill.skillKey, 'pi-cli');
  assert.equal(selected.selection.signalRichness.notableSignalTotal, 0);
});

test('getPreferredReadySkillReviewBundle uses richer signals when createdAt ties', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-richness-'));
  const aggregateSummaryFile = path.join(rootDir, 'aggregates', 'summary.json');
  const createdAt = '2026-05-17T12:00:00.000Z';

  await persistSkillReviewBundle({
    rootDir,
    bundle: {
      bundleId: 'bundle:tie-low-signal',
      createdAt,
      targetSkill: {
        skillKey: 'project-implementation',
        skillName: 'project-implementation',
        skillPath: '/Users/handy/.claude/skills/project-implementation/SKILL.md',
      },
      scope: {
        from: '2026-05-17T11:50:00.000Z',
        to: createdAt,
        usageFactCount: 1,
        sessionCount: 1,
      },
      summary: {
        totalReads: 1,
        topAgentReads: 1,
        subagentReads: 0,
        dominantTaskShapes: ['tie-low'],
        notableSignals: {
          advance: 0,
          correct: 0,
          supplement: 0,
          continue: 0,
          clarify: 0,
        },
      },
      reviewFocus: {
        representativeHits: ['fact-low'],
        correctionSoonCases: [],
        subagentCases: [],
        ambiguousCases: [],
      },
      openQuestions: ['tie low'],
      artifactRefs: {
        aggregateSummaryFile,
      },
    },
  });

  await persistSkillReviewBundle({
    rootDir,
    bundle: {
      bundleId: 'bundle:tie-high-signal',
      createdAt,
      targetSkill: {
        skillKey: 'typescript-skills',
        skillName: 'typescript-skills',
        skillPath: '/Users/handy/.pi/agent/skills/typescript-skills/SKILL.md',
      },
      scope: {
        from: '2026-05-17T11:55:00.000Z',
        to: createdAt,
        usageFactCount: 4,
        sessionCount: 1,
      },
      summary: {
        totalReads: 4,
        topAgentReads: 4,
        subagentReads: 0,
        dominantTaskShapes: ['tie-high'],
        notableSignals: {
          advance: 2,
          correct: 1,
          supplement: 1,
          continue: 0,
          clarify: 0,
        },
      },
      reviewFocus: {
        representativeHits: ['fact-high'],
        correctionSoonCases: ['fact-high-correct'],
        subagentCases: [],
        ambiguousCases: [],
      },
      openQuestions: ['tie high'],
      artifactRefs: {
        aggregateSummaryFile,
      },
    },
  });

  const selected = await getPreferredReadySkillReviewBundle({ rootDir });

  assert.ok(selected);
  assert.equal(selected.selection.strategy, 'latest');
  assert.equal(selected.bundle.targetSkill.skillKey, 'typescript-skills');
  assert.equal(selected.selection.signalRichness.notableSignalTotal, 4);
  assert.equal(selected.selection.signalRichness.usageFactCount, 4);
  assert.equal(selected.selection.signalRichness.totalReads, 4);
});
