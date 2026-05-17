import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_ORCHESTRATOR_SCAN_TAIL_ENTRIES,
  detectExternalOrchestratorFromBranch,
} from '../orchestrator-guard.ts';

test('detectExternalOrchestratorFromBranch matches recent toolName within tail window', () => {
  const branch = [
    { type: 'message', message: { role: 'assistant', toolName: 'bash' } },
    { type: 'message', message: { role: 'assistant', toolName: 'passto_planner_start' } },
  ];

  const result = detectExternalOrchestratorFromBranch(branch, ['passto_planner_']);
  assert.deepEqual(result, {
    suspended: true,
    reason: '检测到外部编排流程：passto_planner_start',
  });
});

test('detectExternalOrchestratorFromBranch matches recent toolCall block within tail window', () => {
  const branch = [
    {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          { type: 'toolCall', name: 'passto_executor_run' },
        ],
      },
    },
  ];

  const result = detectExternalOrchestratorFromBranch(branch, ['passto_executor_']);
  assert.equal(result.suspended, true);
  assert.match(result.reason, /passto_executor_run/);
});

test('detectExternalOrchestratorFromBranch ignores orchestrator tool outside tail window', () => {
  const branch = [
    { type: 'message', message: { role: 'assistant', toolName: 'passto_planner_start' } },
    ...Array.from({ length: DEFAULT_ORCHESTRATOR_SCAN_TAIL_ENTRIES }, (_, i) => ({
      type: 'message',
      message: { role: 'assistant', toolName: `bash-${i}` },
    })),
  ];

  const result = detectExternalOrchestratorFromBranch(branch, ['passto_planner_']);
  assert.deepEqual(result, { suspended: false, reason: '' });
});

test('detectExternalOrchestratorFromBranch still scans whole branch when shorter than tail window', () => {
  const branch = Array.from({ length: 20 }, (_, i) => ({
    type: 'message',
    message: { role: 'assistant', toolName: i === 0 ? 'passto_builder_run' : `bash-${i}` },
  }));

  const result = detectExternalOrchestratorFromBranch(branch, ['passto_builder_']);
  assert.equal(result.suspended, true);
  assert.match(result.reason, /passto_builder_run/);
});
