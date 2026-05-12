import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { buildGeneratorCharterPrompt } from '../grc-prompts.ts';
import { projectGeneratorCharterPrompt } from '../grc-generator-contract.ts';

const CONTRACT_PATH = path.resolve(import.meta.dirname, '../references/generator-contract.md');

test('buildGeneratorCharterPrompt explains dynamic-layer semantics without repeating Constitution', async () => {
  const prompt = buildGeneratorCharterPrompt();
  const contract = await fs.readFile(CONTRACT_PATH, 'utf-8');

  assert.match(prompt, /GoalState：当前目标链锚点与焦点真相源/);
  assert.match(prompt, /SummaryCache：近期事实压缩索引/);
  assert.match(prompt, /Reflector Advice：post-round 纠偏建议/);
  assert.match(prompt, /Principles：跨多轮、多任务复现过的历史经验启发/);
  assert.match(prompt, /理清真实需求/);
  assert.match(prompt, /考虑替代方案/);
  assert.match(prompt, /检查关键假设/);
  assert.match(prompt, /最能推进结果的单一动作/);
  assert.match(prompt, /显式说明依据/);

  assert.match(contract, /## Generator Charter/);
  assert.match(contract, /## Dynamic Layer Semantics/);
  assert.match(prompt, /优先判断当前用户消息是在继续、补充、纠偏，还是切换目标/);
  assert.match(prompt, /不得覆盖当前目标与现实证据/);

  assert.doesNotMatch(prompt, /修改文件后必须复核/);
  assert.doesNotMatch(prompt, /工具结果优先于内部知识/);
  assert.doesNotMatch(prompt, /当前轮事实/);
});

test('projectGeneratorCharterPrompt falls back to built-in charter when contract is missing', () => {
  const prompt = projectGeneratorCharterPrompt(null);

  assert.match(prompt, /PasstoContext Generator Charter/);
  assert.match(prompt, /GoalState 是当前目标链锚点/);
  assert.match(prompt, /SummaryCache 是近期事实索引/);
  assert.match(prompt, /Reflector advice 是纠偏建议/);
  assert.match(prompt, /principles 是历史经验启发/);
  assert.match(prompt, /理清真正的需求/);
  assert.match(prompt, /考虑替代方案/);
  assert.match(prompt, /检查关键假设/);
  assert.doesNotMatch(prompt, /修改文件后必须复核/);
  assert.doesNotMatch(prompt, /工具结果优先于内部知识/);
});
