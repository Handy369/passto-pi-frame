import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  buildSkillReviewExportModel,
  exportSkillReviewBundle,
} from '../skill-review-export.ts';
import {
  persistBundleReceipt,
  persistSkillAggregateArtifacts,
  persistSkillReviewBundle,
  type SkillUsageFact,
} from '../plugin/skill-explore/index.ts';

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

function createUsageFact(overrides?: Partial<SkillUsageFact>): SkillUsageFact {
  return {
    factId: 'fact-1',
    observedAt: '2026-05-17T12:00:00.000Z',
    session: {
      sessionFile: '/tmp/demo.jsonl',
      sessionKey: 'demo-session',
      agentRound: 1,
    },
    skill: {
      skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      skillName: 'skills-maker',
      skillFileName: 'SKILL.md',
      skillKey: 'skills-maker',
    },
    read: {
      source: 'top-agent',
      toolName: 'read',
      entryIndex: 1,
    },
    context: {
      signalType: 'advance',
      taskShapeKey: 'top-agent:make-skill',
      taskShapeLabel: 'make skill',
      userIntentLabel: '新增 skill',
    },
    artifactRefs: {
      roundFactsFile: '/tmp/round-facts.json',
      sessionSummaryFile: '/tmp/summary.json',
    },
    ...overrides,
  };
}

test('buildSkillReviewExportModel prefers ready bundle and preserves selection details', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-review-export-ready-'));
  const usageFacts = [createUsageFact()];
  const aggregateResult = await persistSkillAggregateArtifacts({ rootDir, usageFacts, generatedAt: '2026-05-17T13:00:00.000Z' });
  const aggregateItem = aggregateResult.items[0];
  assert.ok(aggregateItem);

  await persistSkillReviewBundle({
    rootDir,
    bundle: {
      bundleId: 'bundle:skills-maker:unversioned:abc',
      createdAt: '2026-05-17T13:05:00.000Z',
      targetSkill: {
        skillKey: 'skills-maker',
        skillName: 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
      scope: {
        from: '2026-05-17T12:00:00.000Z',
        to: '2026-05-17T12:00:00.000Z',
        usageFactCount: 1,
        sessionCount: 1,
      },
      summary: {
        totalReads: 1,
        topAgentReads: 1,
        subagentReads: 0,
        dominantTaskShapes: ['make skill'],
        notableSignals: {
          advance: 1,
          correct: 0,
          supplement: 0,
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
      openQuestions: ['是否需要补 examples'],
      artifactRefs: {
        aggregateSummaryFile: aggregateItem!.summaryFile,
        taskShapesFile: aggregateItem!.taskShapesFile,
        evidenceIndexFile: aggregateItem!.evidenceIndexFile,
      },
    },
  });

  const model = await buildSkillReviewExportModel({
    rootDir,
    logger,
    targetSkill: 'skills-maker',
    exportedAt: '2026-05-17T14:00:00.000Z',
  });

  assert.equal(model.selected.status, 'ready-bundle');
  assert.equal(model.selected.bundle?.targetSkill.skillKey, 'skills-maker');
  assert.equal(model.selected.selection?.requestedTargetSkill, 'skills-maker');
  assert.equal(model.catalog.readyCount, 1);
  assert.equal(model.catalog.aggregateCount, 1);
});

test('buildSkillReviewExportModel falls back to reviewed bundle when no ready bundle exists', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-review-export-reviewed-'));
  const usageFacts = [createUsageFact()];
  const aggregateResult = await persistSkillAggregateArtifacts({ rootDir, usageFacts, generatedAt: '2026-05-17T13:00:00.000Z' });
  const aggregateItem = aggregateResult.items[0];
  assert.ok(aggregateItem);

  const bundle = {
    bundleId: 'bundle:skills-maker:unversioned:reviewed',
    createdAt: '2026-05-17T13:05:00.000Z',
    targetSkill: {
      skillKey: 'skills-maker',
      skillName: 'skills-maker',
      skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
    },
    scope: {
      from: '2026-05-17T12:00:00.000Z',
      to: '2026-05-17T12:00:00.000Z',
      usageFactCount: 1,
      sessionCount: 1,
    },
    summary: {
      totalReads: 1,
      topAgentReads: 1,
      subagentReads: 0,
      dominantTaskShapes: ['make skill'],
      notableSignals: {
        advance: 1,
        correct: 0,
        supplement: 0,
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
    openQuestions: ['是否需要补 examples'],
    artifactRefs: {
      aggregateSummaryFile: aggregateItem!.summaryFile,
      taskShapesFile: aggregateItem!.taskShapesFile,
      evidenceIndexFile: aggregateItem!.evidenceIndexFile,
    },
  };

  await persistSkillReviewBundle({ rootDir, bundle });
  await persistBundleReceipt({
    rootDir,
    receipt: {
      bundleId: bundle.bundleId,
      consumer: 'skills-maker',
      consumerRunId: 'run-reviewed',
      consumedAt: '2026-05-17T14:00:00.000Z',
      result: {
        status: 'reviewed',
        outputDocPath: '/tmp/reviewed-output.md',
      },
    },
  });

  const model = await buildSkillReviewExportModel({
    rootDir,
    logger,
    targetSkill: 'skills-maker',
    exportedAt: '2026-05-17T15:00:00.000Z',
  });

  assert.equal(model.selected.status, 'reviewed-bundle');
  assert.equal(model.selected.reviewedReceipt?.consumerRunId, 'run-reviewed');
  assert.equal(model.catalog.readyCount, 0);
  assert.equal(model.catalog.reviewedCount, 1);
});

test('exportSkillReviewBundle writes skill-review-model.json and review.html', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-review-export-files-'));
  const outputDir = path.join(rootDir, 'custom-export');
  const usageFacts = [createUsageFact()];
  const aggregateResult = await persistSkillAggregateArtifacts({ rootDir, usageFacts, generatedAt: '2026-05-17T13:00:00.000Z' });
  const aggregateItem = aggregateResult.items[0];
  assert.ok(aggregateItem);

  await persistSkillReviewBundle({
    rootDir,
    bundle: {
      bundleId: 'bundle:skills-maker:unversioned:export',
      createdAt: '2026-05-17T13:05:00.000Z',
      targetSkill: {
        skillKey: 'skills-maker',
        skillName: 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
      scope: {
        from: '2026-05-17T12:00:00.000Z',
        to: '2026-05-17T12:00:00.000Z',
        usageFactCount: 1,
        sessionCount: 1,
      },
      summary: {
        totalReads: 1,
        topAgentReads: 1,
        subagentReads: 0,
        dominantTaskShapes: ['make skill'],
        notableSignals: {
          advance: 1,
          correct: 0,
          supplement: 0,
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
      openQuestions: ['是否需要补 examples'],
      artifactRefs: {
        aggregateSummaryFile: aggregateItem!.summaryFile,
        taskShapesFile: aggregateItem!.taskShapesFile,
        evidenceIndexFile: aggregateItem!.evidenceIndexFile,
      },
    },
  });

  const result = await exportSkillReviewBundle({
    rootDir,
    outputDir,
    logger,
    targetSkill: 'skills-maker',
    exportedAt: '2026-05-17T16:00:00.000Z',
  });

  assert.equal(result.outputDir, outputDir);
  assert.equal(result.selectedStatus, 'ready-bundle');

  const reviewModel = JSON.parse(await readFile(result.reviewModelPath, 'utf-8')) as { kind: string; selected: { status: string } };
  const reviewHtml = await readFile(result.reviewHtmlPath, 'utf-8');

  assert.equal(reviewModel.kind, 'skill-review-export-model');
  assert.equal(reviewModel.selected.status, 'ready-bundle');
  assert.match(reviewHtml, /Skill Review Export/);
  assert.match(reviewHtml, /reviewed receipt|Selected Bundle|Selected Aggregate/);
});
