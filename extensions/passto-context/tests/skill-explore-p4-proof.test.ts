import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('skill-explore P4 proof script generates bundle output doc receipt and reviewed index', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'skill-explore-p4-proof-'));
  const fixtureDir = path.resolve('tests/fixtures/skill-explore-p4');
  const sessionFile = path.join(fixtureDir, 'minimal-session.jsonl');
  const outputDocPath = path.join(rootDir, 'docs', 'runtime-proof', 'skills-maker-p4-proof.md');
  const scriptPath = path.resolve('scripts/skill-explore-p4-proof.mjs');
  const skillsMakerSkillPath = path.join(fixtureDir, 'skills-maker', 'SKILL.md');
  const handoffReferencePath = path.join(fixtureDir, 'skills-maker', 'references', 'skill-explore-handoff.md');

  const { stdout } = await execFileAsync('node', [
    '--experimental-strip-types',
    scriptPath,
    '--session', sessionFile,
    '--root-dir', rootDir,
    '--output-doc', outputDocPath,
    '--skills-maker-skill', skillsMakerSkillPath,
    '--handoff-reference', handoffReferencePath,
    '--consumer-run-id', 'fixture-proof-run',
    '--generated-at', '2026-05-17T15:10:00.000Z',
    '--consumed-at', '2026-05-17T15:12:00.000Z',
  ], {
    cwd: path.resolve('.'),
  });

  const result = JSON.parse(stdout) as {
    usageFactCount: number;
    bundleId: string;
    bundleFile: string;
    outputDocPath: string;
    receiptFile: string;
    reviewedIndexFile: string;
    decision: string;
  };

  const bundle = JSON.parse(await readFile(result.bundleFile, 'utf-8')) as {
    bundleId: string;
    targetSkill: { skillKey: string };
    scope: { usageFactCount: number };
  };
  const receipt = JSON.parse(await readFile(result.receiptFile, 'utf-8')) as {
    bundleId: string;
    consumer: string;
    consumerRunId: string;
    result: { status: string; outputDocPath?: string };
  };
  const reviewed = JSON.parse(await readFile(result.reviewedIndexFile, 'utf-8')) as Array<{
    bundleId: string;
    latestReceipt: { consumerRunId: string; result: { status: string } };
  }>;
  const outputDoc = await readFile(result.outputDocPath, 'utf-8');

  assert.equal(result.usageFactCount, 1);
  assert.match(result.bundleId, /^bundle:project-implementation:unversioned:/);
  assert.equal(bundle.bundleId, result.bundleId);
  assert.equal(bundle.targetSkill.skillKey, 'project-implementation');
  assert.equal(bundle.scope.usageFactCount, 1);

  assert.equal(receipt.bundleId, result.bundleId);
  assert.equal(receipt.consumer, 'skills-maker');
  assert.equal(receipt.consumerRunId, 'fixture-proof-run');
  assert.equal(receipt.result.status, 'reviewed');
  assert.equal(receipt.result.outputDocPath, outputDocPath);

  assert.equal(reviewed.length, 1);
  assert.equal(reviewed[0]?.bundleId, result.bundleId);
  assert.equal(reviewed[0]?.latestReceipt.consumerRunId, 'fixture-proof-run');
  assert.equal(reviewed[0]?.latestReceipt.result.status, 'reviewed');

  assert.match(outputDoc, /本次完整消费了 skill-explore handoff 产物/);
  assert.match(outputDoc, /读取路径/);
  assert.match(outputDoc, /当前缺口/);
  assert.match(outputDoc, /先继续累积 runtime evidence/);
  assert.match(result.decision, /先继续累积 runtime evidence/);
});
