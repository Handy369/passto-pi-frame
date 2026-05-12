import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  ensureAppendSystemPromptSync,
  projectAppendSystemPrompt,
} from '../grc-generator-contract.ts';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'passto-append-sync-'));
}

test('ensureAppendSystemPromptSync writes projected prompt when target is missing', async () => {
  const dir = await makeTempDir();
  const targetPath = path.join(dir, 'APPEND_SYSTEM.md');
  const contract = '# Generator Contract\n\n## Constitution\n\n- A\n- B\n- C\n- D\n- E\n- F\n- G\n- H\n';

  const result = await ensureAppendSystemPromptSync({ targetPath, contract });
  const actual = await fs.readFile(targetPath, 'utf-8');

  assert.equal(result.status, 'updated');
  assert.equal(actual.trim(), projectAppendSystemPrompt(contract));
});

test('ensureAppendSystemPromptSync returns unchanged when target already matches', async () => {
  const dir = await makeTempDir();
  const targetPath = path.join(dir, 'APPEND_SYSTEM.md');
  const contract = '# Generator Contract\n\n## Constitution\n\n- A\n- B\n- C\n- D\n- E\n- F\n- G\n- H\n';
  const expected = `${projectAppendSystemPrompt(contract)}\n`;
  await fs.writeFile(targetPath, expected, 'utf-8');

  const result = await ensureAppendSystemPromptSync({ targetPath, contract });

  assert.equal(result.status, 'unchanged');
  assert.equal((await fs.readFile(targetPath, 'utf-8')), expected);
});

test('ensureAppendSystemPromptSync skips write when contract is missing and fallback writes are disabled', async () => {
  const dir = await makeTempDir();
  const targetPath = path.join(dir, 'APPEND_SYSTEM.md');

  const result = await ensureAppendSystemPromptSync({ targetPath, contract: null });

  assert.equal(result.status, 'skipped-missing-contract');
  await assert.rejects(fs.readFile(targetPath, 'utf-8'));
});
