import test from 'node:test';
import assert from 'node:assert/strict';

import { applyDraftDispositionsToRuntimeProvisionalOverlay } from '../grc-provisional-overlay.ts';
import type { DraftDisposition, RuntimeProvisionalOverlay } from '../types.ts';

function makeOverlay(): RuntimeProvisionalOverlay {
  return {
    sourceAgentRound: 11,
    createdAt: '2026-05-21T11:00:00.000Z',
    source: 'generator',
    userGoalState: {
      baseUserGoalTreeRound: 10,
      sourceAgentRound: 11,
      createdAt: '2026-05-21T11:00:00.000Z',
      source: 'generator',
      userGoalTree: {
        version: 1,
        agentRound: 11,
        updatedAt: '2026-05-21T11:00:00.000Z',
        currentFocusUserGoalId: 'draft-root',
        rootUserGoalIds: ['draft-root'],
        userGoals: [
          {
            id: 'draft-root',
            parentId: null,
            assertion: 'draft root',
            status: 'planning',
            xNodeModelId: 'xnode-draft-root',
            sinceRound: 11,
            lastTouchedRound: 11,
          },
        ],
      },
    },
    xNodeState: {
      baseXNodeModelRound: 10,
      sourceAgentRound: 11,
      createdAt: '2026-05-21T11:00:00.000Z',
      source: 'generator',
      xNodeModel: {
        version: 1,
        userGoalId: 'draft-root',
        agentRound: 11,
        updatedAt: '2026-05-21T11:00:00.000Z',
        currentFocusXNodeId: 'draft-child-1',
        rootXNodeIds: ['draft-root'],
        nodes: [
          {
            id: 'draft-root',
            parentId: null,
            assertion: 'draft root',
            status: 'active',
            atomicity: 'composite',
            phase: 'execute',
            why: { summary: 'draft root', confidence: 'partial' },
            what: { summary: 'draft root', confidence: 'partial' },
            flow: { summary: 'draft root', confidence: 'partial' },
            structure: { summary: 'draft root', confidence: 'partial' },
            runtimeProof: { summary: 'draft root proof missing', confidence: 'open' },
            sinceRound: 11,
            lastTouchedRound: 11,
            priority: 0,
            order: 0,
          },
          {
            id: 'draft-child-1',
            parentId: 'draft-root',
            assertion: 'draft child 1',
            status: 'active',
            atomicity: 'atomic',
            phase: 'testing',
            why: { summary: 'draft child 1', confidence: 'partial' },
            what: { summary: 'draft child 1', confidence: 'partial' },
            flow: { summary: 'draft child 1', confidence: 'partial' },
            structure: { summary: 'draft child 1', confidence: 'partial' },
            runtimeProof: { summary: 'draft child 1 proof partial', confidence: 'partial' },
            sinceRound: 11,
            lastTouchedRound: 11,
            priority: 0,
            order: 1,
          },
          {
            id: 'draft-child-2',
            parentId: 'draft-root',
            assertion: 'draft child 2',
            status: 'active',
            atomicity: 'atomic',
            phase: 'plan',
            why: { summary: 'draft child 2', confidence: 'partial' },
            what: { summary: 'draft child 2', confidence: 'partial' },
            flow: { summary: 'draft child 2', confidence: 'partial' },
            structure: { summary: 'draft child 2', confidence: 'partial' },
            runtimeProof: { summary: 'draft child 2 proof missing', confidence: 'open' },
            sinceRound: 11,
            lastTouchedRound: 11,
            priority: 0,
            order: 2,
          },
        ],
        latestRuntimeProof: {
          targetXNodeId: 'draft-child-1',
          atRound: 11,
          resultSummary: 'draft child 1 proof pending',
          proofMode: 'tests',
          proofStatus: 'partial',
          evidence: ['draft child 1 proof partial'],
          verificationMethod: ['run targeted tests'],
        },
        latestProofSignals: [
          {
            id: 'proof-draft-child-1-11-runtime-proof-partial',
            targetXNodeId: 'draft-child-1',
            atRound: 11,
            type: 'runtime-proof-partial',
            message: 'draft child 1 proof incomplete',
            suggestedNextStepType: 'run_tests',
            evidence: ['draft child 1 proof partial'],
          },
        ],
      },
    },
  };
}

test('applyDraftDispositionsToRuntimeProvisionalOverlay clears proof when rewrite removes targeted subtree node', () => {
  const overlay = makeOverlay();
  const dispositions: DraftDisposition[] = [
    {
      goalId: 'draft-root',
      action: 'revise-draft',
      revisedAssertion: 'rewritten draft root',
      subtreeDisposition: 'rewrite-subtree',
      nodeEdits: [
        {
          goalId: 'draft-child-1',
          action: 'remove',
        },
      ],
      newCurrentFocusGoalId: 'draft-root',
      evidence: 'rewrite removes the old proof target',
    },
  ];

  const next = applyDraftDispositionsToRuntimeProvisionalOverlay(overlay, dispositions);
  assert.equal(next?.xNodeState?.xNodeModel.latestRuntimeProof?.targetXNodeId ?? null, 'draft-root');
  assert.notEqual(next?.xNodeState?.xNodeModel.latestProofSignals?.[0]?.targetXNodeId, 'draft-child-1');
});

test('applyDraftDispositionsToRuntimeProvisionalOverlay keeps proof target internally consistent when draft root merges into existing goal', () => {
  const overlay = makeOverlay();
  overlay.xNodeState!.xNodeModel.latestRuntimeProof = {
    targetXNodeId: 'draft-root',
    atRound: 11,
    resultSummary: 'draft root proof pending',
    proofMode: 'tests',
    proofStatus: 'partial',
    evidence: ['draft root proof partial'],
    verificationMethod: ['run targeted tests'],
  };
  overlay.xNodeState!.xNodeModel.latestProofSignals = [
    {
      id: 'proof-draft-root-11-runtime-proof-partial',
      targetXNodeId: 'draft-root',
      atRound: 11,
      type: 'runtime-proof-partial',
      message: 'draft root proof incomplete',
      suggestedNextStepType: 'run_tests',
      evidence: ['draft root proof partial'],
    },
  ];

  const dispositions: DraftDisposition[] = [
    {
      goalId: 'draft-root',
      action: 'confirm-draft',
      subtreeDisposition: 'merge-into-existing',
      mergeTargetGoalId: 'goal-existing',
      evidence: 'draft root is merged into confirmed goal',
    },
  ];

  const next = applyDraftDispositionsToRuntimeProvisionalOverlay(overlay, dispositions);
  assert.notEqual(next?.xNodeState?.xNodeModel.latestRuntimeProof?.targetXNodeId, 'draft-root');
  assert.notEqual(next?.xNodeState?.xNodeModel.latestProofSignals?.[0]?.targetXNodeId, 'draft-root');
  assert.equal(next?.xNodeState?.xNodeModel.latestRuntimeProof?.targetXNodeId, 'draft-child-1');
  assert.equal(next?.xNodeState?.xNodeModel.latestProofSignals?.[0]?.targetXNodeId, 'draft-child-1');
});

test('applyDraftDispositionsToRuntimeProvisionalOverlay drops overlay when discard-subtree removes everything', () => {
  const overlay = makeOverlay();
  const dispositions: DraftDisposition[] = [
    {
      goalId: 'draft-root',
      action: 'discard-draft',
      subtreeDisposition: 'discard-subtree',
      evidence: 'entire provisional subtree should be discarded',
    },
  ];

  const next = applyDraftDispositionsToRuntimeProvisionalOverlay(overlay, dispositions);
  assert.equal(next, null);
});
