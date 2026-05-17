import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPTCSkillsAggregateMessage,
  formatPTCSkillsExportMessage,
  formatPTCSkillsReadyMessage,
  formatPTCSkillsReviewedMessage,
  formatPTCSkillsStatusMessage,
  getPTCSkillsUsageText,
  handlePTCSkillsCommand,
} from '../ptc-skills-command.ts';

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

test('handlePTCSkillsCommand reports status snapshot', async () => {
  const notices: Array<{ message: string; level: string }> = [];

  const handled = await handlePTCSkillsCommand('skills status', {
    logger,
    rootDir: '/tmp/skill-explore',
    notify: (message, level) => notices.push({ message, level }),
    resolveArtifactRoot: () => '/tmp/skill-explore',
    readLatestSessionIndex: async () => ({
      sessionFile: '/tmp/demo.jsonl',
      sessionKey: 'demo-session',
      updatedAt: '2026-05-17T15:00:00.000Z',
      totalSkillReads: 7,
      summaryFile: '/tmp/summary.json',
      roundFactsFile: '/tmp/round-facts.json',
    }),
    listReadyBundles: async () => [{
      bundleId: 'bundle-1',
      bundleFile: '/tmp/bundle-1.json',
      createdAt: '2026-05-17T14:00:00.000Z',
      targetSkill: {
        skillKey: 'skills-maker',
        skillName: 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
    }],
    listReviewedBundles: async () => [{
      bundleId: 'bundle-2',
      bundleFile: '/tmp/bundle-2.json',
      latestReceipt: {
        bundleId: 'bundle-2',
        consumer: 'skills-maker',
        consumerRunId: 'run-2',
        consumedAt: '2026-05-17T14:05:00.000Z',
        result: { status: 'reviewed' },
      },
    }],
    listAggregates: async () => [{
      aggregateId: 'agg-1',
      generatedAt: '2026-05-17T14:10:00.000Z',
      skill: {
        skillKey: 'skills-maker',
        skillName: 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
      window: {
        from: '2026-05-17T13:00:00.000Z',
        to: '2026-05-17T14:00:00.000Z',
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
        advance: 1,
        correct: 0,
        supplement: 0,
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
        usageFactFiles: ['/tmp/facts.json'],
      },
    }],
  });

  assert.equal(handled, true);
  assert.equal(notices[0]?.level, 'info');
  assert.match(notices[0]?.message ?? '', /Skill Explore Status/);
  assert.match(notices[0]?.message ?? '', /readyBundles: 1/);
  assert.match(notices[0]?.message ?? '', /reviewedBundles: 1/);
  assert.match(notices[0]?.message ?? '', /aggregateSummaries: 1/);
});

test('handlePTCSkillsCommand reports ready reviewed and aggregate surfaces', async () => {
  const notices: Array<{ message: string; level: string }> = [];

  const baseOptions = {
    logger,
    rootDir: '/tmp/skill-explore',
    notify: (message: string, level: string) => notices.push({ message, level }),
    listReadyBundles: async () => [{
      bundleId: 'bundle-1',
      bundleFile: '/tmp/bundle-1.json',
      createdAt: '2026-05-17T14:00:00.000Z',
      targetSkill: {
        skillKey: 'skills-maker',
        skillName: 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
    }],
    listReviewedBundles: async () => [{
      bundleId: 'bundle-2',
      bundleFile: '/tmp/bundle-2.json',
      latestReceipt: {
        bundleId: 'bundle-2',
        consumer: 'skills-maker',
        consumerRunId: 'run-2',
        consumedAt: '2026-05-17T14:05:00.000Z',
        result: { status: 'adopted', outputDocPath: '/tmp/output.md' },
      },
    }],
    listAggregates: async (input?: { rootDir?: string; targetSkill?: string }) => [{
      aggregateId: 'agg-1',
      generatedAt: '2026-05-17T14:10:00.000Z',
      skill: {
        skillKey: input?.targetSkill ?? 'skills-maker',
        skillName: input?.targetSkill ?? 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
      window: {
        from: '2026-05-17T13:00:00.000Z',
        to: '2026-05-17T14:00:00.000Z',
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
        advance: 1,
        correct: 0,
        supplement: 0,
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
        usageFactFiles: ['/tmp/facts.json'],
      },
    }],
    readLatestSessionIndex: async () => null,
    resolveArtifactRoot: () => '/tmp/skill-explore',
  };

  assert.equal(await handlePTCSkillsCommand('skills ready', baseOptions), true);
  assert.match(notices.at(-1)?.message ?? '', /Ready Bundles/);
  assert.match(notices.at(-1)?.message ?? '', /skills-maker/);

  assert.equal(await handlePTCSkillsCommand('skills reviewed', baseOptions), true);
  assert.match(notices.at(-1)?.message ?? '', /Reviewed Bundles/);
  assert.match(notices.at(-1)?.message ?? '', /adopted/);

  assert.equal(await handlePTCSkillsCommand('skills aggregate skills-maker', baseOptions), true);
  assert.match(notices.at(-1)?.message ?? '', /Aggregate Summaries/);
  assert.match(notices.at(-1)?.message ?? '', /requestedTargetSkill: skills-maker/);

  assert.equal(await handlePTCSkillsCommand('skills export skills-maker /tmp/skill-export', {
    ...baseOptions,
    expandPath: (value: string) => value,
    exportReviewBundle: async (input) => ({
      outputDir: input.outputDir ?? '/tmp/skill-export',
      reviewModelPath: '/tmp/skill-export/skill-review-model.json',
      reviewHtmlPath: '/tmp/skill-export/review.html',
      exportSessionId: '2026-05-17T16-00-00Z',
      artifactRoot: '/tmp/skill-explore',
      selectedStatus: 'ready-bundle',
    }),
  }), true);
  assert.match(notices.at(-1)?.message ?? '', /Skill review bundle exported/);
  assert.match(notices.at(-1)?.message ?? '', /skill-review-model\.json, review\.html/);
});

test('handlePTCSkillsCommand warns on unsupported action and ignores non-skills input', async () => {
  const notices: Array<{ message: string; level: string }> = [];

  assert.equal(await handlePTCSkillsCommand('status', {
    logger,
    notify: (message, level) => notices.push({ message, level }),
  }), false);

  assert.equal(await handlePTCSkillsCommand('skills nope', {
    logger,
    notify: (message, level) => notices.push({ message, level }),
  }), true);
  assert.equal(notices[0]?.level, 'warning');
  assert.match(notices[0]?.message ?? '', /skills ready/);
});

test('format helpers expose stable skills command copy', () => {
  assert.match(getPTCSkillsUsageText(), /skills status/);
  assert.match(getPTCSkillsUsageText(), /skills ready/);
  assert.match(getPTCSkillsUsageText(), /skills reviewed/);
  assert.match(getPTCSkillsUsageText(), /skills aggregate/);
  assert.match(getPTCSkillsUsageText(), /skills export/);

  assert.match(
    formatPTCSkillsStatusMessage({
      artifactRoot: '/tmp/root',
      latestSession: null,
      readyCount: 0,
      reviewedCount: 0,
      aggregateCount: 0,
    }),
    /artifactRoot: \/tmp\/root/,
  );

  assert.match(
    formatPTCSkillsReadyMessage([{
      bundleId: 'bundle-1',
      bundleFile: '/tmp/bundle-1.json',
      createdAt: '2026-05-17T14:00:00.000Z',
      targetSkill: {
        skillKey: 'skills-maker',
        skillName: 'skills-maker',
        skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
      },
    }]),
    /bundle-1/,
  );

  assert.match(
    formatPTCSkillsReviewedMessage([{
      bundleId: 'bundle-2',
      bundleFile: '/tmp/bundle-2.json',
      latestReceipt: {
        bundleId: 'bundle-2',
        consumer: 'skills-maker',
        consumerRunId: 'run-2',
        consumedAt: '2026-05-17T14:05:00.000Z',
        result: { status: 'reviewed' },
      },
    }]),
    /run-2/,
  );

  assert.match(
    formatPTCSkillsAggregateMessage({
      requestedTargetSkill: 'skills-maker',
      summaries: [{
        aggregateId: 'agg-1',
        generatedAt: '2026-05-17T14:10:00.000Z',
        skill: {
          skillKey: 'skills-maker',
          skillName: 'skills-maker',
          skillPath: '/Users/handy/.claude/skills/skills-maker/SKILL.md',
        },
        window: {
          from: '2026-05-17T13:00:00.000Z',
          to: '2026-05-17T14:00:00.000Z',
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
          advance: 1,
          correct: 0,
          supplement: 0,
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
          usageFactFiles: ['/tmp/facts.json'],
        },
      }],
    }),
    /requestedTargetSkill: skills-maker/,
  );

  assert.match(
    formatPTCSkillsExportMessage({
      outputDir: '/tmp/skill-export',
      reviewModelPath: '/tmp/skill-export/skill-review-model.json',
      reviewHtmlPath: '/tmp/skill-export/review.html',
      exportSessionId: '2026-05-17T16-00-00Z',
      artifactRoot: '/tmp/skill-explore',
      selectedStatus: 'ready-bundle',
    }),
    /skill-review-model\.json, review\.html/,
  );
});
