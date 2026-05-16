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

function daysAgoIso(days: number, minuteOffset = 0): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000 - minuteOffset * 60 * 1000).toISOString();
}

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
            activeScore: 6,
            hintCount: 6,
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
            origin: 'manual',
            promoted: true,
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
            origin: 'reflector',
            promoted: false,
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

  const rewritten = JSON.parse(await fs.readFile(registryPath, 'utf-8'));
  const rewrittenById = new Map(rewritten.principles.map((item: any) => [item.id, item]));

  assert.equal(rewrittenById.get('principle_active_custom')?.metadata?.customNote, 'keep-me');
  assert.equal(rewrittenById.get('principle_active_custom')?.metadata?.origin, 'manual');
  assert.equal(rewrittenById.get('principle_active_custom')?.metadata?.promoted, true);
  assert.equal(rewrittenById.get('principle_archived_custom')?.metadata?.customFlag, 'still-here');
  assert.equal(rewrittenById.get('principle_archived_custom')?.metadata?.origin, 'reflector');
  assert.equal(rewrittenById.get('principle_archived_custom')?.metadata?.promoted, false);
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

test('listInjectable prioritizes promoted manual principles under injection limit', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-promoted-priority-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: '2026-05-12T02:20:00.000Z',
      principles: [
        {
          id: 'principle_reflector_hot',
          created: '2026-05-12T02:10:00.000Z',
          updated: '2026-05-12T02:10:00.000Z',
          tags: ['runtime'],
          content: '普通 reflector 原则，但活跃分更高。',
          metadata: {
            origin: 'reflector',
            promoted: false,
            activeScore: 99,
            hintCount: 99,
            hintTimestamps: ['2026-05-12T02:10:00.000Z'],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_manual_promoted',
          created: '2026-05-12T02:11:00.000Z',
          updated: '2026-05-12T02:11:00.000Z',
          tags: ['constitution'],
          content: '人工晋升原则应优先注入 Generator。',
          metadata: {
            origin: 'manual',
            promoted: true,
            activeScore: 1,
            hintCount: 1,
            hintTimestamps: ['2026-05-12T02:11:00.000Z'],
            lifecycle: 'active',
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  assert.deepEqual(manager.listInjectable(1).map((item) => item.id), ['principle_manual_promoted']);

  await fs.rm(dir, { recursive: true, force: true });
});

test('formatPrinciplesForInjection renders promoted manual principles as a separate constitution layer', () => {
  const injected = formatPrinciplesForInjection([
    {
      id: 'principle_manual_promoted',
      created: '2026-05-12T02:11:00.000Z',
      updated: '2026-05-12T02:11:00.000Z',
      tags: ['constitution'],
      content: '人工晋升原则应优先于普通历史经验层。',
      metadata: {
        origin: 'manual',
        promoted: true,
        lifecycle: 'active',
      },
    },
    {
      id: 'principle_reflector_regular',
      created: '2026-05-12T02:12:00.000Z',
      updated: '2026-05-12T02:12:00.000Z',
      tags: ['runtime'],
      content: '普通 reflector 原则仍作为历史经验层注入。',
      metadata: {
        origin: 'reflector',
        promoted: false,
        lifecycle: 'active',
      },
    },
  ]);

  assert.match(injected, /人工宪法原则/);
  assert.match(injected, /人工晋升原则应优先于普通历史经验层/);
  assert.match(injected, /经验原则（来自历史会话）/);
  assert.match(injected, /普通 reflector 原则仍作为历史经验层注入/);
});

test('applyPrincipleOps create hit and expand are hitCount-driven', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-hit-model-'));
  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  await manager.applyPrincipleOps([
    { op: 'create', content: '先做最小验证闭环。', tags: ['verification'] },
  ], { hardMaxCount: 100, source: 'reflector-test' });

  const created = manager.list()[0];
  assert.ok(created);
  assert.equal(created?.metadata.hitCount, 1);
  assert.equal(created?.metadata.hintCount, 1);
  assert.equal(created?.metadata.hintTimestamps?.length, 1);

  await manager.applyPrincipleOps([
    { op: 'hit', targetId: created!.id },
  ], { hardMaxCount: 100, source: 'reflector-test' });

  const afterHit = manager.list().find((item) => item.id === created!.id);
  assert.equal(afterHit?.metadata.hitCount, 2);
  assert.equal(afterHit?.metadata.hintCount, 2);
  assert.equal(afterHit?.metadata.hintTimestamps?.length, 2);

  await manager.applyPrincipleOps([
    {
      op: 'expand',
      targetId: created!.id,
      content: '先做最小验证闭环，再决定是否扩展范围。',
      tags: ['verification', 'scope'],
    },
  ], { hardMaxCount: 100, source: 'reflector-test' });

  const afterExpand = manager.list().find((item) => item.id === created!.id);
  assert.equal(afterExpand?.metadata.hitCount, 3);
  assert.equal(afterExpand?.metadata.hintCount, 3);
  assert.equal(afterExpand?.metadata.hintTimestamps?.length, 3);
  assert.match(afterExpand?.content ?? '', /再决定是否扩展范围/);

  await fs.rm(dir, { recursive: true, force: true });
});

test('listInjectable only includes manual promoted or reflector principles above hit threshold', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-inject-threshold-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: new Date().toISOString(),
      principles: [
        {
          id: 'principle_manual_promoted',
          created: daysAgoIso(1),
          updated: daysAgoIso(1),
          tags: ['constitution'],
          content: '人工晋升原则可直接注入。',
          metadata: {
            origin: 'manual',
            promoted: true,
            activeScore: 0,
            hintCount: 0,
            hitCount: 0,
            hintTimestamps: [],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_reflector_cold',
          created: daysAgoIso(10),
          updated: daysAgoIso(1),
          tags: ['runtime'],
          content: '命中不足 5 次的 reflector 原则不应注入。',
          metadata: {
            origin: 'reflector',
            promoted: false,
            activeScore: 5,
            hintCount: 5,
            hitCount: 5,
            hintTimestamps: [daysAgoIso(25), daysAgoIso(20), daysAgoIso(15), daysAgoIso(10), daysAgoIso(5)],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_reflector_ready',
          created: daysAgoIso(20),
          updated: daysAgoIso(1),
          tags: ['runtime'],
          content: '命中超过 5 次的 reflector 原则可以注入。',
          metadata: {
            origin: 'reflector',
            promoted: false,
            activeScore: 6,
            hintCount: 6,
            hitCount: 6,
            hintTimestamps: [daysAgoIso(25), daysAgoIso(20), daysAgoIso(15), daysAgoIso(10), daysAgoIso(5), daysAgoIso(1)],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_manual_unpromoted',
          created: daysAgoIso(5),
          updated: daysAgoIso(1),
          tags: ['manual'],
          content: '未 promoted 的 manual 原则不应自动注入。',
          metadata: {
            origin: 'manual',
            promoted: false,
            activeScore: 50,
            hintCount: 50,
            hitCount: 50,
            hintTimestamps: [daysAgoIso(1)],
            lifecycle: 'active',
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);

  assert.deepEqual(
    manager.listInjectable(10).map((item) => item.id),
    ['principle_manual_promoted', 'principle_reflector_ready'],
  );

  await fs.rm(dir, { recursive: true, force: true });
});

// Removed: 30-day hint window auto-delete was replaced by PrinciplesCurator governance.
test.skip('prune deletes only reflector principles older than 30 days with <=1 recent hits', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ptc-principles-prune-window-'));
  const registryPath = path.join(dir, 'principles-registry.json');

  await fs.writeFile(
    registryPath,
    JSON.stringify({
      version: 2,
      updatedAt: new Date().toISOString(),
      principles: [
        {
          id: 'principle_manual_promoted_old',
          created: daysAgoIso(60),
          updated: daysAgoIso(40),
          tags: ['constitution'],
          content: '即使长期未命中，人工晋升原则也不应被自动删掉。',
          metadata: {
            origin: 'manual',
            promoted: true,
            activeScore: 0,
            hintCount: 0,
            hitCount: 0,
            hintTimestamps: [],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_reflector_old_one_hit',
          created: daysAgoIso(60),
          updated: daysAgoIso(40),
          tags: ['legacy'],
          content: '超过 30 天仍只有一次近期命中的 reflector 原则应被删掉。',
          metadata: {
            origin: 'reflector',
            promoted: false,
            activeScore: 1,
            hintCount: 1,
            hitCount: 1,
            hintTimestamps: [daysAgoIso(5)],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_reflector_old_two_hits',
          created: daysAgoIso(60),
          updated: daysAgoIso(40),
          tags: ['legacy'],
          content: '超过 30 天但近 30 天命中超过一次的 reflector 原则应保留。',
          metadata: {
            origin: 'reflector',
            promoted: false,
            activeScore: 2,
            hintCount: 2,
            hitCount: 2,
            hintTimestamps: [daysAgoIso(10), daysAgoIso(5)],
            lifecycle: 'active',
          },
        },
        {
          id: 'principle_reflector_new_one_hit',
          created: daysAgoIso(5),
          updated: daysAgoIso(5),
          tags: ['new'],
          content: '新创建不足 30 天的 reflector 原则不应被立即删掉。',
          metadata: {
            origin: 'reflector',
            promoted: false,
            activeScore: 1,
            hintCount: 1,
            hitCount: 1,
            hintTimestamps: [daysAgoIso(5)],
            lifecycle: 'active',
          },
        },
      ],
    }, null, 2),
    'utf-8',
  );

  const manager = createPrinciplesManager(logger);
  await manager.load(dir);
  await manager.prune(100);

  const ids = manager.list().map((item) => item.id);
  assert.match(ids.join(','), /principle_manual_promoted_old/);
  assert.match(ids.join(','), /principle_reflector_old_two_hits/);
  assert.match(ids.join(','), /principle_reflector_new_one_hit/);
  assert.doesNotMatch(ids.join(','), /principle_reflector_old_one_hit/);

  await fs.rm(dir, { recursive: true, force: true });
});
