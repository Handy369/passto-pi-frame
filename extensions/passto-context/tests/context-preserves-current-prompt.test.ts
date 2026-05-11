import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeRecentAgentRoundMessagesWithContext } from '../grc-context-manager.ts';

test('mergeRecentAgentRoundMessagesWithContext preserves current prompt-round user message when branch snapshot lags', () => {
  const branchMessages = [
    {
      role: 'user',
      content: [{ type: 'text', text: '第2轮用户消息' }],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: '第2轮助手回复' }],
    },
  ];

  const eventMessages = [
    {
      role: 'user',
      content: [{ type: 'text', text: '第2轮用户消息' }],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: '第2轮助手回复' }],
    },
    {
      role: 'user',
      content: [{ type: 'text', text: '第3轮当前最新用户消息' }],
    },
  ];

  const merged = mergeRecentAgentRoundMessagesWithContext(branchMessages, eventMessages);

  assert.equal(merged.length, 3);
  assert.equal(merged[2]?.role, 'user');
  assert.equal(
    (merged[2]?.content as Array<{ type?: string; text?: string }>)[0]?.text,
    '第3轮当前最新用户消息',
  );
});

test('mergeRecentAgentRoundMessagesWithContext keeps event tail after matching recent round sequence', () => {
  const branchMessages = [
    {
      role: 'user',
      content: [{ type: 'text', text: 'round-2 user' }],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'round-2 assistant' }],
    },
    {
      role: 'user',
      content: [{ type: 'text', text: 'round-3 user' }],
    },
    {
      role: 'assistant',
      content: [{ type: 'text', text: 'round-3 assistant' }],
    },
  ];

  const eventMessages = [
    {
      role: 'custom',
      customType: 'system-prefix',
      content: [{ type: 'text', text: 'older trimmed context' }],
    },
    ...branchMessages,
    {
      role: 'user',
      content: [{ type: 'text', text: 'round-4 current prompt' }],
    },
  ];

  const merged = mergeRecentAgentRoundMessagesWithContext(branchMessages, eventMessages as never);

  assert.equal(merged.length, 5);
  assert.equal(merged[0]?.role, 'user');
  assert.equal(merged[4]?.role, 'user');
  assert.equal(
    (merged[4]?.content as Array<{ type?: string; text?: string }>)[0]?.text,
    'round-4 current prompt',
  );
});
