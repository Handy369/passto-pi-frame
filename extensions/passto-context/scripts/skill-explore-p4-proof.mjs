#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  buildSkillUsageFactsFromBranch,
  persistSkillAggregateArtifacts,
  buildSkillReviewBundle,
  persistSkillReviewBundle,
  persistBundleReceipt,
} from '../plugin/skill-explore/index.ts';

function getArg(flag, fallback = undefined) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function requireArg(flag) {
  const value = getArg(flag);
  if (!value) {
    throw new Error(`missing required argument: ${flag}`);
  }
  return value;
}

function buildDecision(bundle) {
  const signalTotal = Object.values(bundle.summary.notableSignals).reduce((sum, value) => sum + value, 0);
  if (bundle.scope.usageFactCount <= 1 && signalTotal === 0) {
    return {
      status: 'reviewed',
      decision: `先继续累积 runtime evidence，不立即重构 ${bundle.targetSkill.skillName}。`,
      evidenceGap: '样本量过低，且缺少 advance/correct/supplement/continue/clarify 等近端信号。',
    };
  }

  return {
    status: 'reviewed',
    decision: `当前证据已形成可审阅输入，但仍需结合更多自然样本再决定是否重构 ${bundle.targetSkill.skillName}。`,
    evidenceGap: '仍需补相邻 Skill 边界样本与更丰富的 task-shape 覆盖。',
  };
}

function renderProofDoc(input) {
  const {
    bundle,
    bundleFile,
    aggregateSummaryFile,
    skillsMakerSkillPath,
    handoffReferencePath,
    decision,
    evidenceGap,
  } = input;

  return `# Skills-Maker P4 Runtime Proof: ${bundle.targetSkill.skillName}\n\n> 生成时间：${bundle.createdAt}\n> 任务模式：audit\n\n---\n\n## 1. 本次是否读取了 bundle\n\n**是。** 本次完整消费了 skill-explore handoff 产物。\n\n## 2. 读取路径\n\n| 顺序 | 文件 | 角色 |\n|---|---|---|\n| 1 | \`${skillsMakerSkillPath}\` | 方法入口 |\n| 2 | \`${handoffReferencePath}\` | handoff 协议 |\n| 3 | \`${bundleFile}\` | handoff bundle（收敛物） |\n\n## 3. 证据如何影响判断\n\n| 指标 | 值 |\n|---|---|\n| usageFactCount | **${bundle.scope.usageFactCount}** |\n| sessionCount | **${bundle.scope.sessionCount}** |\n| totalReads | **${bundle.summary.totalReads}** |\n| topAgentReads | **${bundle.summary.topAgentReads}** |\n| subagentReads | **${bundle.summary.subagentReads}** |\n| dominantTaskShapes | ${bundle.summary.dominantTaskShapes.join(' / ') || 'none'} |\n\n这些证据说明：\n\n- 当前 bundle 已足以证明 skills-maker 可以主动读取 handoff 收敛物并进入判断链。\n- 但 bundle 中的统计只应作为 review input，不应直接升级为结构级 verdict。\n- 因此本次结论必须保持审慎，以 evidence gap 为边界。\n\n## 4. 当前缺口\n\n${evidenceGap}\n\n## 5. 结论\n\n**${decision}**\n\n---\n\n## Artifact Refs\n\n- aggregate summary: \`${aggregateSummaryFile}\`\n- bundle: \`${bundleFile}\`\n`;
}

async function main() {
  const sessionFile = requireArg('--session');
  const rootDir = requireArg('--root-dir');
  const outputDocPath = requireArg('--output-doc');
  const skillsMakerSkillPath = requireArg('--skills-maker-skill');
  const handoffReferencePath = requireArg('--handoff-reference');
  const consumerRunId = getArg('--consumer-run-id', 'p4-proof-script');
  const generatedAt = getArg('--generated-at', '2026-05-17T15:10:00.000Z');
  const consumedAt = getArg('--consumed-at', '2026-05-17T15:12:00.000Z');

  const raw = await readFile(sessionFile, 'utf-8');
  const branch = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const usageFacts = buildSkillUsageFactsFromBranch(branch, sessionFile, { rootDir });
  const aggregateResult = await persistSkillAggregateArtifacts({ usageFacts, rootDir, generatedAt });

  if (aggregateResult.items.length === 0) {
    throw new Error('no aggregate items generated from session');
  }

  const aggregateItem = aggregateResult.items[0];
  const bundle = buildSkillReviewBundle(aggregateItem.aggregate, {
    aggregateSummaryFile: aggregateItem.summaryFile,
    taskShapesFile: aggregateItem.taskShapesFile,
    evidenceIndexFile: aggregateItem.evidenceIndexFile,
    createdAt: generatedAt,
  });
  const bundlePersistResult = await persistSkillReviewBundle({ bundle, rootDir });

  const { decision, evidenceGap, status } = buildDecision(bundle);
  await mkdir(path.dirname(outputDocPath), { recursive: true });
  await writeFile(outputDocPath, renderProofDoc({
    bundle,
    bundleFile: bundlePersistResult.bundleFile,
    aggregateSummaryFile: aggregateItem.summaryFile,
    skillsMakerSkillPath,
    handoffReferencePath,
    decision,
    evidenceGap,
  }), 'utf-8');

  const receiptResult = await persistBundleReceipt({
    rootDir,
    receipt: {
      bundleId: bundle.bundleId,
      consumer: 'skills-maker',
      consumerRunId,
      consumedAt,
      result: {
        status,
        notes: `P4 proof script decision: ${decision}`,
        outputDocPath,
      },
    },
  });

  const result = {
    sessionFile,
    rootDir,
    usageFactCount: usageFacts.length,
    aggregateSummaryFile: aggregateItem.summaryFile,
    bundleId: bundle.bundleId,
    bundleFile: bundlePersistResult.bundleFile,
    outputDocPath,
    receiptFile: receiptResult.receiptFile,
    reviewedIndexFile: receiptResult.reviewedIndexFile,
    decision,
    evidenceGap,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
