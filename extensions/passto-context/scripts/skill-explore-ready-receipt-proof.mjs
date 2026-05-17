#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  getPreferredReadySkillReviewBundle,
  listBundleReceipts,
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
      mode: 'audit',
      status: 'reviewed',
      decision: `先继续累积 runtime evidence，不立即重构 ${bundle.targetSkill.skillName}。`,
      evidenceGap: '样本量过低，且缺少 advance/correct/supplement/continue/clarify 等近端信号。',
    };
  }

  return {
    mode: 'audit',
    status: 'reviewed',
    decision: `当前 bundle 已形成可审阅输入，但仍需结合更多自然样本再决定是否重构 ${bundle.targetSkill.skillName}。`,
    evidenceGap: '已有 ready bundle，但还不足以直接升级为结构级 verdict。',
  };
}

function renderProofDoc(input) {
  const {
    readyIndexFile,
    bundle,
    bundleFile,
    aggregateSummaryFile,
    skillsMakerSkillPath,
    handoffReferencePath,
    priorReceipts,
    decision,
    evidenceGap,
    selection,
  } = input;

  return `# Skills-Maker Ready → Receipt Runtime Proof: ${bundle.targetSkill.skillName}

> 生成时间：${new Date().toISOString()}
> 任务模式：audit

---

## 1. 本次是否读取了 \`skill-explore\` 产物

**是。** 本次采用了 \`ready-index → bundle → receipt\` 的真实消费闭环。

## 2. 读取路径

| 顺序 | 文件 | 角色 |
|---|---|---|
| 1 | \`${skillsMakerSkillPath}\` | 方法入口 |
| 2 | \`${handoffReferencePath}\` | handoff 协议 |
| 3 | \`${readyIndexFile}\` | ready 发现层（派生索引） |
| 4 | \`${bundleFile}\` | handoff bundle（主读取对象） |
| 5 | \`${aggregateSummaryFile}\` | aggregate summary（必要时核对窗口与覆盖范围） |

## 3. 选择依据

- strategy: \`${selection.strategy}\`
- orderedBy: \`${Array.isArray(selection.orderedBy) ? selection.orderedBy.join(' -> ') : 'unknown'}\`
- requestedTargetSkill: ${selection.requestedTargetSkill ? `\`${selection.requestedTargetSkill}\`` : 'none'}
- signalRichness.notableSignalTotal: **${selection.signalRichness?.notableSignalTotal ?? 'unknown'}**
- signalRichness.usageFactCount: **${selection.signalRichness?.usageFactCount ?? 'unknown'}**
- signalRichness.totalReads: **${selection.signalRichness?.totalReads ?? 'unknown'}**

## 4. 证据如何影响判断

| 指标 | 值 |
|---|---|
| usageFactCount | **${bundle.scope.usageFactCount}** |
| sessionCount | **${bundle.scope.sessionCount}** |
| totalReads | **${bundle.summary.totalReads}** |
| topAgentReads | **${bundle.summary.topAgentReads}** |
| subagentReads | **${bundle.summary.subagentReads}** |
| dominantTaskShapes | ${bundle.summary.dominantTaskShapes.join(' / ') || 'none'} |
| priorReceipts | **${priorReceipts.length}** |

这些证据说明：

- 本次先用 \`ready.json\` 发现候选 bundle，但并没有停在索引层。
- 真正参与判断的是 bundle 本体与 aggregate summary。
- 当前证据足以进入 \`audit\`，并产出一份定义类输出，再把结果写回 receipt。
- 但这些统计仍只是 review input，不应直接升级为结构级 verdict。

## 5. 当前缺口

${evidenceGap}

## 6. 结论

**${decision}**

## 7. receipt 回写结果

- consumer: \`skills-maker\`
- result.status: \`reviewed\`
- priorReceipts before write: **${priorReceipts.length}**
- after write: bundle 应从 \`ready.json\` 退出，并出现在 \`reviewed.json\`

---

## Artifact Refs

- ready index: \`${readyIndexFile}\`
- aggregate summary: \`${aggregateSummaryFile}\`
- bundle: \`${bundleFile}\`
`;
}

async function main() {
  const rootDir = requireArg('--root-dir');
  const outputDocPath = requireArg('--output-doc');
  const skillsMakerSkillPath = requireArg('--skills-maker-skill');
  const handoffReferencePath = requireArg('--handoff-reference');
  const targetSkill = getArg('--target-skill');
  const consumerRunId = getArg('--consumer-run-id', 'ready-receipt-proof-script');
  const consumedAt = getArg('--consumed-at', new Date().toISOString());
  const readyIndexFile = path.join(rootDir, 'handoff', 'skills-maker', 'indexes', 'ready.json');

  const latest = await getPreferredReadySkillReviewBundle({ rootDir, targetSkill });
  if (!latest) {
    throw new Error('no ready bundle available for ready -> receipt proof');
  }

  const priorReceipts = await listBundleReceipts(latest.bundle.bundleId, rootDir);
  const { mode, status, decision, evidenceGap } = buildDecision(latest.bundle);

  await mkdir(path.dirname(outputDocPath), { recursive: true });
  await writeFile(outputDocPath, renderProofDoc({
    readyIndexFile,
    bundle: latest.bundle,
    bundleFile: latest.entry.bundleFile,
    aggregateSummaryFile: latest.bundle.artifactRefs.aggregateSummaryFile,
    skillsMakerSkillPath,
    handoffReferencePath,
    priorReceipts,
    decision,
    evidenceGap,
    selection: latest.selection,
  }), 'utf-8');

  const receiptResult = await persistBundleReceipt({
    rootDir,
    receipt: {
      bundleId: latest.bundle.bundleId,
      consumer: 'skills-maker',
      consumerRunId,
      consumedAt,
      result: {
        status,
        notes: `Ready->receipt proof decision: ${decision}`,
        outputDocPath,
      },
    },
  });

  const readyAfter = JSON.parse(await readFile(receiptResult.readyIndexFile, 'utf-8'));
  const reviewedAfter = JSON.parse(await readFile(receiptResult.reviewedIndexFile, 'utf-8'));

  process.stdout.write(`${JSON.stringify({
    mode,
    readLayer: 'ready-index->bundle->receipt',
    selection: latest.selection,
    rootDir,
    bundleId: latest.bundle.bundleId,
    bundleFile: latest.entry.bundleFile,
    outputDocPath,
    receiptFile: receiptResult.receiptFile,
    readyIndexFile: receiptResult.readyIndexFile,
    reviewedIndexFile: receiptResult.reviewedIndexFile,
    readyCountAfter: Array.isArray(readyAfter) ? readyAfter.length : null,
    reviewedCountAfter: Array.isArray(reviewedAfter) ? reviewedAfter.length : null,
    decision,
    evidenceGap,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
