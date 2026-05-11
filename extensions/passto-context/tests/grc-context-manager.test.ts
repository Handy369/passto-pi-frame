import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLatestUserMessageText,
  getPreviousAgentRoundEntries,
  getSlidingWindowAgentRoundMessages,
  serializePreviousAgentRoundConversation,
} from '../grc-context-manager.ts';

const branch = [
  {
    type: 'custom',
    customType: 'passto-round-boundary',
    data: {
      customType: 'passto-round-boundary',
      agentRound: 1,
      totalCompletedAgentRounds: 0,
      userTurnsAtStart: 1,
      createdAt: '2026-05-09T10:00:00.000Z',
    },
  },
  {
    type: 'message',
    message: {
      role: 'user',
      content: [{ type: 'text', text: '先实现 Reflector 输入升级' }],
    },
  },
  {
    type: 'message',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: '好的，我先修改 types.ts 和 prompt。' }],
    },
  },
  {
    type: 'custom',
    customType: 'passto-round-boundary',
    data: {
      customType: 'passto-round-boundary',
      agentRound: 2,
      totalCompletedAgentRounds: 1,
      userTurnsAtStart: 2,
      createdAt: '2026-05-09T10:05:00.000Z',
    },
  },
  {
    type: 'message',
    message: {
      role: 'user',
      content: [{ type: 'text', text: '继续把 Curator 挪到 before_agent_start' }],
    },
  },
];

test('getPreviousAgentRoundEntries returns the last completed agent round slice', () => {
  const entries = getPreviousAgentRoundEntries(branch);
  assert.equal(entries.length, 2);
  assert.equal((entries[0] as { message: { role: string } }).message.role, 'user');
  assert.equal((entries[1] as { message: { role: string } }).message.role, 'assistant');
});

test('serializePreviousAgentRoundConversation serializes the previous round conversation only', () => {
  const conversation = serializePreviousAgentRoundConversation(
    branch,
    (entries) => entries
      .map((entry) => {
        const message = entry.message as { role?: string; content?: Array<{ type?: string; text?: string }> } | undefined;
        const text = Array.isArray(message?.content)
          ? message.content
              .filter((block) => block?.type === 'text' && typeof block.text === 'string')
              .map((block) => block.text)
              .join('\n')
          : '';
        return `[${message?.role ?? 'unknown'}]\n${text}`;
      })
      .join('\n\n'),
  );

  assert.match(conversation, /先实现 Reflector 输入升级/);
  assert.match(conversation, /修改 types.ts 和 prompt/);
  assert.doesNotMatch(conversation, /继续把 Curator 挪到 before_agent_start/);
});

test('getLatestUserMessageText returns current user first message content from branch tail', () => {
  const text = getLatestUserMessageText(branch);
  assert.equal(text, '继续把 Curator 挪到 before_agent_start');
});

test('getSlidingWindowAgentRoundMessages keeps at least min recent rounds even when token budget is tiny', () => {
  const richBranch = [
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: 1, totalCompletedAgentRounds: 0, userTurnsAtStart: 1 },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'round-1 user '.repeat(30) }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'round-1 assistant '.repeat(30) }] } },
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: 2, totalCompletedAgentRounds: 1, userTurnsAtStart: 2 },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'round-2 user '.repeat(30) }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'round-2 assistant '.repeat(30) }] } },
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: 3, totalCompletedAgentRounds: 2, userTurnsAtStart: 3 },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'round-3 user '.repeat(30) }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'round-3 assistant '.repeat(30) }] } },
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: 4, totalCompletedAgentRounds: 3, userTurnsAtStart: 4 },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'round-4 user '.repeat(30) }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'round-4 assistant '.repeat(30) }] } },
  ];

  const messages = getSlidingWindowAgentRoundMessages(richBranch, 3, 100, 8);
  const texts = messages
    .flatMap((message) => Array.isArray(message.content) ? message.content : [])
    .filter((block): block is { type?: string; text?: string } => !!block && typeof block === 'object')
    .map((block) => block.text ?? '')
    .join('\n');

  assert.match(texts, /round-2 user/);
  assert.match(texts, /round-3 user/);
  assert.match(texts, /round-4 user/);
  assert.doesNotMatch(texts, /round-1 user/);
});

test('getSlidingWindowAgentRoundMessages evicts 2 or 3 oldest rounds based on current percent thresholds while keeping min recent rounds', () => {
  const buildRound = (round: number, repeat: number) => ([
    {
      type: 'custom',
      customType: 'passto-round-boundary',
      data: { customType: 'passto-round-boundary', agentRound: round, totalCompletedAgentRounds: round - 1, userTurnsAtStart: round },
    },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: (`round-${round} user `).repeat(repeat) }] } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: (`round-${round} assistant `).repeat(repeat) }] } },
  ]);

  const branchMedium = [
    ...buildRound(1, 20),
    ...buildRound(2, 20),
    ...buildRound(3, 20),
    ...buildRound(4, 20),
    ...buildRound(5, 20),
  ];
  const medium = getSlidingWindowAgentRoundMessages(branchMedium, 3, 200, 8);
  const mediumTexts = medium.flatMap((m) => Array.isArray(m.content) ? m.content : []).map((b) => (b as { text?: string }).text ?? '').join('\n');
  assert.doesNotMatch(mediumTexts, /round-1 user/);
  assert.doesNotMatch(mediumTexts, /round-2 user/);
  assert.match(mediumTexts, /round-3 user/);
  assert.match(mediumTexts, /round-4 user/);
  assert.match(mediumTexts, /round-5 user/);

  const branchLarge = [
    ...buildRound(1, 40),
    ...buildRound(2, 40),
    ...buildRound(3, 40),
    ...buildRound(4, 40),
    ...buildRound(5, 40),
    ...buildRound(6, 40),
  ];
  const large = getSlidingWindowAgentRoundMessages(branchLarge, 3, 200, 8);
  const largeTexts = large.flatMap((m) => Array.isArray(m.content) ? m.content : []).map((b) => (b as { text?: string }).text ?? '').join('\n');
  assert.doesNotMatch(largeTexts, /round-1 user/);
  assert.doesNotMatch(largeTexts, /round-2 user/);
  assert.doesNotMatch(largeTexts, /round-3 user/);
  assert.match(largeTexts, /round-4 user/);
  assert.match(largeTexts, /round-5 user/);
  assert.match(largeTexts, /round-6 user/);
});
