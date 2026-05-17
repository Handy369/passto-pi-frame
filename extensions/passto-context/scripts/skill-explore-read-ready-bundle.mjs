#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import process from 'node:process';

import {
  getPreferredReadySkillReviewBundle,
  listBundleReceipts,
} from '../plugin/skill-explore/index.ts';

function getArg(flag, fallback = undefined) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function getOutputFormat() {
  const format = getArg('--format', 'json');
  return typeof format === 'string' && format.trim().toLowerCase() === 'markdown'
    ? 'markdown'
    : 'json';
}

function buildDecision(bundle) {
  const signalTotal = Object.values(bundle.summary.notableSignals).reduce((sum, value) => sum + value, 0);
  if (bundle.scope.usageFactCount <= 1 && signalTotal === 0) {
    return {
      mode: 'audit',
      decision: `先继续累积 runtime evidence，不立即重构 ${bundle.targetSkill.skillName}。`,
      reason: '样本量过低，且缺少近端信号。',
    };
  }

  return {
    mode: 'audit',
    decision: `当前 bundle 已形成可审阅输入，但仍需结合更多自然样本再决定是否重构 ${bundle.targetSkill.skillName}。`,
    reason: '已有 ready bundle，但还不足以直接升级为结构级 verdict。',
  };
}

function buildSelectionSummary(selection) {
  return {
    orderedByText: Array.isArray(selection.orderedBy)
      ? selection.orderedBy.join(' -> ')
      : 'unknown',
    signalRichness: selection.signalRichness,
  };
}

function renderMarkdown(result) {
  if (!result.found) {
    return `# Skill Explore Ready Bundle Read Result

> mode: ${result.mode}
> found: false
> format: markdown

## 1. 结果

${result.reason}

## 2. 降级动作

按普通 skills-maker 流程继续，并显式标注缺少 runtime evidence。`;
  }

  return `# Skill Explore Ready Bundle Read Result: ${result.bundle.targetSkill.skillName}

> mode: ${result.mode}
> found: true
> readLayer: ${result.readLayer}
> format: markdown

## 1. 选择依据

- strategy: \`${result.selection.strategy}\`
- orderedBy: \`${result.selectionSummary.orderedByText}\`
- requestedTargetSkill: ${result.selection.requestedTargetSkill ? `\`${result.selection.requestedTargetSkill}\`` : 'none'}
- signalRichness.notableSignalTotal: **${result.selectionSummary.signalRichness?.notableSignalTotal ?? 'unknown'}**
- signalRichness.usageFactCount: **${result.selectionSummary.signalRichness?.usageFactCount ?? 'unknown'}**
- signalRichness.totalReads: **${result.selectionSummary.signalRichness?.totalReads ?? 'unknown'}**

## 2. 读取对象

- readyEntry.bundleId: \`${result.readyEntry.bundleId}\`
- readyEntry.bundleFile: \`${result.readyEntry.bundleFile}\`
- aggregateSummaryRef: \`${result.aggregateSummaryRef}\`
- aggregateSummaryWindow.from: \`${result.aggregateSummaryWindow?.from ?? 'unknown'}\`
- aggregateSummaryWindow.to: \`${result.aggregateSummaryWindow?.to ?? 'unknown'}\`

## 3. 证据摘要

| 指标 | 值 |
|---|---|
| usageFactCount | **${result.bundle.scope.usageFactCount}** |
| sessionCount | **${result.bundle.scope.sessionCount}** |
| totalReads | **${result.bundle.summary.totalReads}** |
| topAgentReads | **${result.bundle.summary.topAgentReads}** |
| subagentReads | **${result.bundle.summary.subagentReads}** |
| priorReceipts | **${result.priorReceipts.length}** |
| dominantTaskShapes | ${result.bundle.summary.dominantTaskShapes.join(' / ') || 'none'} |

## 4. 判断结果

- decision: ${result.decision.decision}
- reason: ${result.decision.reason}`;
}

function emitResult(result, format) {
  if (format === 'markdown') {
    process.stdout.write(`${renderMarkdown(result)}\n`);
    return;
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function main() {
  const rootDir = getArg('--root-dir');
  const targetSkill = getArg('--target-skill');
  const format = getOutputFormat();
  const latest = await getPreferredReadySkillReviewBundle({ rootDir, targetSkill });

  if (!latest) {
    emitResult({
      found: false,
      mode: 'audit',
      reason: '当前不存在 ready bundle；按普通 skills-maker 流程继续，并显式标注缺少 runtime evidence。',
    }, format);
    return;
  }

  const receipts = await listBundleReceipts(latest.bundle.bundleId, rootDir);
  const aggregateSummary = JSON.parse(await readFile(latest.bundle.artifactRefs.aggregateSummaryFile, 'utf-8'));
  const decision = buildDecision(latest.bundle);
  const result = {
    found: true,
    mode: decision.mode,
    readLayer: 'bundle',
    selection: latest.selection,
    selectionSummary: buildSelectionSummary(latest.selection),
    readyEntry: latest.entry,
    bundle: latest.bundle,
    priorReceipts: receipts,
    aggregateSummaryRef: latest.bundle.artifactRefs.aggregateSummaryFile,
    aggregateSummaryWindow: aggregateSummary.window,
    decision,
  };

  emitResult(result, format);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
