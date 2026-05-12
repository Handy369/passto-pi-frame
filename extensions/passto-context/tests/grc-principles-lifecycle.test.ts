import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createPrinciplesManager, formatPrinciplesForInjection } from '../grc-principles.ts';

const logger = {
  error: () => {},
  warn: () => {},
  info: () => {},
  debug: () => {},
};

test('listInjectable and search skip stale/archived/disabled principles', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-lifecycle-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T02:00:00.000Z',
      principles: [
        {
          id: 'principle_active',
          created: '2026-05-12T01:00:00.000Z',
          updated: '2026-05-12T01:00:00.000Z',
          tags: ['quality'],
          content: '修改文件后必须验证结果。',
          metadata: {
            activeScore: 10,
            hintCount: 10,
            hintTimestamps: ['2026-05-12T01:00:00.000Z'],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_stale',
          created: '2026-05-12T01:01:00.000Z',
          updated: '2026-05-12T01:01:00.000Z',
          tags: ['legacy'],
          content: '引用 RequirementLedger 的旧原则应停止注入。',
          metadata: {
            activeScore: 50,
            hintCount: 50,
            hintTimestamps: ['2026-05-12T01:01:00.000Z'],
            lifecycle: 'stale',
          },
        },
        {
          id: 'principle_archived',
          created: '2026-05-12T01:01:30.000Z',
          updated: '2026-05-12T01:01:30.000Z',
          tags: ['legacy'],
          content: '这是已归档的旧原则。',
          metadata: {
            activeScore: 50,
            hintCount: 50,
            hintTimestamps: ['2026-05-12T01:01:30.000Z'],
            lifecycle: 'archived',
          },
        },
        {
          id: 'principle_disabled',
          created: '2026-05-12T01:02:00.000Z',
          updated: '2026-05-12T01:02:00.000Z',
          tags: ['legacy'],
          content: '这是已停用的旧原则。',
          metadata: {
            activeScore: 80,
            hintCount: 80,
            hintTimestamps: ['2026-05-12T01:02:00.000Z'],
            lifecycle: 'disabled',
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  assert.deepEqual(manager.listInjectable(10).map((item) => item.id), ['principle_active']);
  assert.deepEqual(manager.search('旧原则', 10), []);
  assert.deepEqual(manager.search('RequirementLedger', 10), []);
  assert.deepEqual(manager.search('验证结果', 10).map((item) => item.id), ['principle_active']);

  const injected = formatPrinciplesForInjection(manager.listInjectable(10));
  assert.match(injected, /历史经验启发/);
  assert.match(injected, /修改文件后必须验证结果/);
  assert.doesNotMatch(injected, /RequirementLedger/);
  assert.doesNotMatch(injected, /已归档/);
  assert.doesNotMatch(injected, /已停用/);

  const diagnostics = manager.getDiagnostics();
  assert.equal(diagnostics.health.total, 4);
  assert.equal(diagnostics.health.injectable, 1);
  assert.equal(diagnostics.review.staleCandidates, 1);

  await fs.rm(dir, { recursive: true, force: true });
});

test('review diagnostics count pseudo and oversized candidates', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-review-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T02:03:00.000Z',
      principles: [
        {
          id: 'principle_pseudo',
          created: '2026-05-12T02:02:00.000Z',
          updated: '2026-05-12T02:02:00.000Z',
          tags: ['legacy'],
          content: '新增：同步文档。新增：更新 README 并记录迁移备注。',
          metadata: {
            activeScore: 2,
            hintCount: 2,
            hintTimestamps: ['2026-05-12T02:02:00.000Z'],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_oversized',
          created: '2026-05-12T02:02:30.000Z',
          updated: '2026-05-12T02:02:30.000Z',
          tags: ['legacy'],
          content: '这是一条超长原则。'.repeat(40),
          metadata: {
            activeScore: 1,
            hintCount: 1,
            hintTimestamps: ['2026-05-12T02:02:30.000Z'],
            lifecycle: 'active',
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  const diagnostics = manager.getDiagnostics();
  assert.equal(diagnostics.review.pseudoCandidates, 1);
  assert.equal(diagnostics.review.oversizedCandidates, 1);

  await fs.rm(dir, { recursive: true, force: true });
});

test('legacy principles without lifecycle remain injectable', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-legacy-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T02:05:00.000Z',
      principles: [
        {
          id: 'principle_legacy',
          created: '2026-05-12T01:05:00.000Z',
          updated: '2026-05-12T01:05:00.000Z',
          tags: ['legacy'],
          content: '未标记 lifecycle 的旧原则默认仍可注入。',
          metadata: {
            activeScore: 5,
            hintCount: 5,
            hintTimestamps: ['2026-05-12T01:05:00.000Z'],
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  const injectable = manager.listInjectable(10);
  assert.deepEqual(injectable.map((item) => item.id), ['principle_legacy']);
  assert.equal(injectable[0]?.metadata.lifecycle, 'active');

  await fs.rm(dir, { recursive: true, force: true });
});

test('writeRegistry preserves unknown metadata fields and lifecycle across rewrites', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-preserve-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T02:10:00.000Z',
      principles: [
        {
          id: 'principle_active_custom',
          created: '2026-05-12T01:10:00.000Z',
          updated: '2026-05-12T01:10:00.000Z',
          tags: ['quality'],
          content: '写回时应保留未知 metadata 字段。',
          metadata: {
            activeScore: 4,
            hintCount: 4,
            hintTimestamps: ['2026-05-12T01:10:00.000Z'],
            lifecycle: 'active',
            customNote: 'keep-me',
          },
        },
        {
          id: 'principle_archived_custom',
          created: '2026-05-12T01:11:00.000Z',
          updated: '2026-05-12T01:11:00.000Z',
          tags: ['legacy'],
          content: '归档原则写回时也应保留未知 metadata 字段。',
          metadata: {
            activeScore: 7,
            hintCount: 7,
            hintTimestamps: ['2026-05-12T01:11:00.000Z'],
            lifecycle: 'archived',
            customFlag: 'still-here',
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  const all = manager.list();
  const active = all.find((item) => item.id === 'principle_active_custom');
  const archived = all.find((item) => item.id === 'principle_archived_custom');
  assert.ok(active);
  assert.ok(archived);

  await manager.markUsed([active!, archived!]);

  const rewritten = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
  const rewrittenById = new Map(rewritten.principles.map((item: any) => [item.id, item]));

  assert.equal(rewrittenById.get('principle_active_custom')?.metadata?.customNote, 'keep-me');
  assert.equal(rewrittenById.get('principle_archived_custom')?.metadata?.customFlag, 'still-here');
  assert.equal(rewrittenById.get('principle_archived_custom')?.metadata?.lifecycle, 'archived');

  await fs.rm(dir, { recursive: true, force: true });
});

test('registry data wins over legacy yaml when registry already exists', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-registry-wins-'));
  const registryPath = path.join(dir, 'principles-registry.json');
  const legacyYamlPath = path.join(dir, 'legacy-principle.yaml');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T02:15:00.000Z',
      principles: [
        {
          id: 'registry_only_principle',
          created: '2026-05-12T02:14:00.000Z',
          updated: '2026-05-12T02:14:00.000Z',
          tags: ['clean'],
          content: '已有 registry 时，应以 registry 为唯一主来源。',
          metadata: {
            activeScore: 3,
            hintCount: 3,
            hintTimestamps: ['2026-05-12T02:14:00.000Z'],
            lifecycle: 'active',
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  await fs.writeFile(
    legacyYamlPath,
    [
      'created: 2026-05-12T02:13:00.000Z',
      'tags:',
      '  - legacy',
      'content: 这是不应在已有 registry 时被重新吸入的 legacy 条目。',
      'metadata:',
      '  source: legacy-yaml',
      '  hitCount: 2',
      '  lastUsed: 2026-05-12T02:13:00.000Z',
      '',
    ].join('\n'),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  assert.deepEqual(manager.list().map((item) => item.id), ['registry_only_principle']);
  assert.equal(manager.getDiagnostics().migration.migratedYamlFiles, 0);
  assert.equal(manager.getDiagnostics().migration.legacyYamlFilesDetected, 0);

  await fs.rm(dir, { recursive: true, force: true });
});
