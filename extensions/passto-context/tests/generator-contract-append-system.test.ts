import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  projectAppendSystemPrompt,
  projectGeneratorCharterPrompt,
  validateAppendSystemSync,
} from '../grc-generator-contract.ts';

const CONTRACT_PATH = path.resolve(import.meta.dirname, '../references/generator-contract.md');

test('projectAppendSystemPrompt exports Constitution-only prompt without Generator charter or dynamic layers', async () => {
  const contract = await fs.readFile(CONTRACT_PATH, 'utf-8');
  const prompt = projectAppendSystemPrompt(contract);

  assert.match(prompt, /## 核心原则/);
  assert.match(prompt, /## 执行模式/);
  assert.match(prompt, /## 工具策略/);
  assert.match(prompt, /工具结果优先于内部知识和用户描述/);
  assert.match(prompt, /短闭环验证/);
  assert.match(prompt, /始终围绕当前用户目标行动/);
  assert.match(prompt, /修改文件后必须复核/);
  assert.match(prompt, /不确定时显式标记并给出最小验证路径/);

  assert.doesNotMatch(prompt, /GoalState/);
  assert.doesNotMatch(prompt, /SummaryCache/);
  assert.doesNotMatch(prompt, /Reflector/);
  assert.doesNotMatch(prompt, /Curator/);
  assert.doesNotMatch(prompt, /principles 注入逻辑/);
  assert.doesNotMatch(prompt, /Generator Charter/);
});

test('projectAppendSystemPrompt fallback stays Constitution-only when contract is missing', () => {
  const prompt = projectAppendSystemPrompt(null);

  assert.match(prompt, /工具结果优先于内部知识和用户描述/);
  assert.match(prompt, /修改文件后必须复核/);
  assert.doesNotMatch(prompt, /GoalState/);
  assert.doesNotMatch(prompt, /SummaryCache/);
  assert.doesNotMatch(prompt, /Reflector advice/);
});

test('validateAppendSystemSync matches projected output and rejects generator-charter prompt', async () => {
  const contract = await fs.readFile(CONTRACT_PATH, 'utf-8');
  const appendPrompt = projectAppendSystemPrompt(contract);
  const charterPrompt = projectGeneratorCharterPrompt(contract);

  assert.equal(validateAppendSystemSync(appendPrompt, contract).matches, true);
  assert.equal(validateAppendSystemSync(charterPrompt, contract).matches, false);
});
