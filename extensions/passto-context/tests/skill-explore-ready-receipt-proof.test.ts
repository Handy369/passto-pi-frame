import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { runSkillExploreAgentEndBridge } from '../plugin/skill-explore/index.ts';

const execFileAsync = promisify(execFile);

test('skill-explore ready receipt proof consumes latest ready bundle and writes reviewed receipt', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-receipt-'));
  const scriptPath = path.resolve('scripts/skill-explore-ready-receipt-proof.mjs');
  const outputDocPath = path.join(rootDir, 'docs', 'runtime-proof', 'skills-maker-ready-receipt-proof.md');
  const skillsMakerSkillPath = '/Users/handy/.claude/skills/skills-maker/SKILL.md';
  const handoffReferencePath = '/Users/handy/.claude/skills/skills-maker/references/skill-explore-handoff.md';

  const branch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T18:00:00.000Z',
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
        recordedAt: '2026-05-17T18:00:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round 1 summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T18:00:01.000Z',
          summary: {
            goal: '验证 ready 到 receipt 闭环',
            completed: [],
            keyDecisions: ['先扫 ready index，再回写 reviewed receipt'],
            filesChanged: [],
            status: '进行中',
            blockers: [],
          },
        },
        goalState: null,
        signal: {
          type: 'advance',
          confidence: 0.93,
          evidence: '继续推进同一目标',
        },
      },
    },
  ];

  await runSkillExploreAgentEndBridge({
    branch,
    sessionFile: '/tmp/ready-receipt-session.jsonl',
    rootDir,
  });

  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
    '--output-doc', outputDocPath,
    '--skills-maker-skill', skillsMakerSkillPath,
    '--handoff-reference', handoffReferencePath,
    '--consumer-run-id', 'fixture-ready-receipt-run',
    '--consumed-at', '2026-05-17T18:05:00.000Z',
  ], {
    cwd: path.resolve('.'),
  });

  const result = JSON.parse(stdout) as {
    readLayer: string;
    selection: { strategy: string; requestedTargetSkill?: string; orderedBy: string[] };
    bundleId: string;
    receiptFile: string;
    readyIndexFile: string;
    reviewedIndexFile: string;
    readyCountAfter: number;
    reviewedCountAfter: number;
    decision: string;
  };

  const receipt = JSON.parse(await readFile(result.receiptFile, 'utf-8')) as {
    bundleId: string;
    consumer: string;
    consumerRunId: string;
    result: { status: string; outputDocPath?: string };
  };
  const readyAfter = JSON.parse(await readFile(result.readyIndexFile, 'utf-8')) as Array<{ bundleId: string }>;
  const reviewedAfter = JSON.parse(await readFile(result.reviewedIndexFile, 'utf-8')) as Array<{
    bundleId: string;
    latestReceipt: { consumerRunId: string; result: { status: string } };
  }>;
  const outputDoc = await readFile(outputDocPath, 'utf-8');

  assert.equal(result.readLayer, 'ready-index->bundle->receipt');
  assert.equal(result.selection.strategy, 'latest');
  assert.deepEqual(result.selection.orderedBy, ['newer', 'richer-signals']);
  assert.match(result.bundleId, /^bundle:project-implementation:unversioned:/);
  assert.equal(receipt.bundleId, result.bundleId);
  assert.equal(receipt.consumer, 'skills-maker');
  assert.equal(receipt.consumerRunId, 'fixture-ready-receipt-run');
  assert.equal(receipt.result.status, 'reviewed');
  assert.equal(receipt.result.outputDocPath, outputDocPath);

  assert.equal(result.readyCountAfter, 0);
  assert.equal(result.reviewedCountAfter, 1);
  assert.equal(readyAfter.length, 0);
  assert.equal(reviewedAfter.length, 1);
  assert.equal(reviewedAfter[0]?.bundleId, result.bundleId);
  assert.equal(reviewedAfter[0]?.latestReceipt.consumerRunId, 'fixture-ready-receipt-run');
  assert.equal(reviewedAfter[0]?.latestReceipt.result.status, 'reviewed');

  assert.match(outputDoc, /ready-index → bundle → receipt|ready-index -> bundle -> receipt/);
  assert.match(outputDoc, /orderedBy/);
  assert.match(outputDoc, /signalRichness\.notableSignalTotal/);
  assert.match(outputDoc, /signalRichness\.usageFactCount/);
  assert.match(outputDoc, /signalRichness\.totalReads/);
  assert.match(outputDoc, /receipt 回写结果/);
  assert.match(outputDoc, /当前 bundle 已形成可审阅输入|先继续累积 runtime evidence/);
  assert.match(result.decision, /当前 bundle 已形成可审阅输入|先继续累积 runtime evidence/);
});

test('skill-explore ready receipt proof prefers requested target skill when provided', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-ready-receipt-target-'));
  const scriptPath = path.resolve('scripts/skill-explore-ready-receipt-proof.mjs');
  const outputDocPath = path.join(rootDir, 'docs', 'runtime-proof', 'skills-maker-ready-receipt-proof.md');
  const skillsMakerSkillPath = '/Users/handy/.claude/skills/skills-maker/SKILL.md';
  const handoffReferencePath = '/Users/handy/.claude/skills/skills-maker/references/skill-explore-handoff.md';

  const branchA = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: {
        customType: 'passto-round-boundary',
        agentRound: 1,
        totalCompletedAgentRounds: 0,
        userTurnsAtStart: 1,
        createdAt: '2026-05-17T18:00:00.000Z',
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
        recordedAt: '2026-05-17T18:00:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round A summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T18:00:01.000Z',
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
          confidence: 0.93,
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
        createdAt: '2026-05-17T18:01:00.000Z',
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
        recordedAt: '2026-05-17T18:01:01.000Z',
        processedUpToUserTurn: 1,
        summary: 'round B summary',
        summaryEntry: {
          agentRound: 1,
          timestamp: '2026-05-17T18:01:01.000Z',
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
          confidence: 0.94,
          evidence: 'B',
        },
      },
    },
  ];

  await runSkillExploreAgentEndBridge({
    branch: branchA,
    sessionFile: '/tmp/ready-receipt-target-a.jsonl',
    rootDir,
  });
  await runSkillExploreAgentEndBridge({
    branch: branchB,
    sessionFile: '/tmp/ready-receipt-target-b.jsonl',
    rootDir,
  });

  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--root-dir', rootDir,
    '--output-doc', outputDocPath,
    '--skills-maker-skill', skillsMakerSkillPath,
    '--handoff-reference', handoffReferencePath,
    '--target-skill', 'project-implementation',
    '--consumer-run-id', 'fixture-ready-receipt-target-run',
    '--consumed-at', '2026-05-17T18:05:00.000Z',
  ], {
    cwd: path.resolve('.'),
  });

  const result = JSON.parse(stdout) as {
    selection: { strategy: string; requestedTargetSkill?: string; orderedBy: string[] };
    bundleId: string;
    readyCountAfter: number;
    reviewedCountAfter: number;
  };

  const reviewedAfter = JSON.parse(await readFile(path.join(rootDir, 'handoff', 'skills-maker', 'indexes', 'reviewed.json'), 'utf-8')) as Array<{
    bundleId: string;
    latestReceipt: { consumerRunId: string };
  }>;

  assert.equal(result.selection.strategy, 'target-skill');
  assert.equal(result.selection.requestedTargetSkill, 'project-implementation');
  assert.deepEqual(result.selection.orderedBy, ['target-skill', 'newer', 'richer-signals']);
  assert.match(result.bundleId, /^bundle:project-implementation:unversioned:/);
  assert.equal(result.readyCountAfter, 1);
  assert.equal(result.reviewedCountAfter, 1);
  assert.equal(reviewedAfter.length, 1);
  assert.match(reviewedAfter[0]?.bundleId ?? '', /^bundle:project-implementation:unversioned:/);
});
