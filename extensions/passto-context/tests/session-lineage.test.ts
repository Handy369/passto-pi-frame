import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

import { buildSessionLineageSummaryWarehouse } from '../session-lineage.ts';

function makeCuratorArtifact(agentRound: number, sessionFile: string, goal: string, searchQuery: string) {
  return {
    type: 'custom',
    customType: 'grc-curator-artifact',
    data: {
      customType: 'grc-curator-artifact',
      agentRound,
      recordedAt: `2026-05-16T10:0${agentRound}:00.000Z`,
      processedUpToUserTurn: agentRound * 2,
      summaryEntry: {
        agentRound,
        timestamp: `2026-05-16T10:0${agentRound}:00.000Z`,
        sessionFile,
        summary: {
          goal,
          completed: [],
          keyDecisions: [],
          filesChanged: [{ path: 'index.ts', action: 'edit' }],
          status: 'done',
          blockers: [],
        },
        sessionPointers: {
          file: sessionFile,
          searchQuery,
        },
      },
    },
  };
}

async function writeSessionFile(filePath: string, parentSession: string | null, entries: unknown[]): Promise<void> {
  const header = {
    type: 'session',
    version: 3,
    id: path.basename(filePath, '.jsonl'),
    timestamp: '2026-05-16T10:00:00.000Z',
    cwd: '/tmp/project',
    ...(parentSession ? { parentSession } : {}),
  };

  const lines = [JSON.stringify(header), ...entries.map((entry) => JSON.stringify(entry))];
  await fs.writeFile(filePath, `${lines.join('\n')}\n`, 'utf-8');
}

test('buildSessionLineageSummaryWarehouse merges current branch with parentSession chain', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-lineage-'));
  const parentFile = path.join(tempDir, 'parent.jsonl');
  const childFile = path.join(tempDir, 'child.jsonl');

  await writeSessionFile(parentFile, null, [
    makeCuratorArtifact(1, parentFile, '父 session 目标', 'parent history'),
  ]);

  const currentBranch = [
    makeCuratorArtifact(2, childFile, '子 session 目标', 'child history'),
  ];

  await writeSessionFile(childFile, parentFile, currentBranch);

  const warehouse = await buildSessionLineageSummaryWarehouse({
    sessionFile: childFile,
    currentBranch,
    maxDepth: 4,
  });

  assert.deepEqual(warehouse.map((item) => `${item.sessionFile}#${item.agentRound}`), [
    `${parentFile}#1`,
    `${childFile}#2`,
  ]);
});

test('buildSessionLineageSummaryWarehouse respects maxDepth and dedupes current session entries', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-lineage-depth-'));
  const grandparentFile = path.join(tempDir, 'grandparent.jsonl');
  const parentFile = path.join(tempDir, 'parent.jsonl');
  const childFile = path.join(tempDir, 'child.jsonl');

  await writeSessionFile(grandparentFile, null, [
    makeCuratorArtifact(1, grandparentFile, 'grandparent', 'gp'),
  ]);
  await writeSessionFile(parentFile, grandparentFile, [
    makeCuratorArtifact(2, parentFile, 'parent', 'p'),
  ]);

  const currentBranch = [
    makeCuratorArtifact(3, childFile, 'child current branch', 'child'),
  ];
  await writeSessionFile(childFile, parentFile, currentBranch);

  const limited = await buildSessionLineageSummaryWarehouse({
    sessionFile: childFile,
    currentBranch,
    maxDepth: 1,
  });
  assert.deepEqual(limited.map((item) => `${item.sessionFile}#${item.agentRound}`), [
    `${parentFile}#2`,
    `${childFile}#3`,
  ]);

  const full = await buildSessionLineageSummaryWarehouse({
    sessionFile: childFile,
    currentBranch,
    maxDepth: 2,
  });
  assert.deepEqual(full.map((item) => `${item.sessionFile}#${item.agentRound}`), [
    `${grandparentFile}#1`,
    `${parentFile}#2`,
    `${childFile}#3`,
  ]);
});
