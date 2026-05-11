import test from 'node:test';
import assert from 'node:assert/strict';

import { formatReflectorDiagnosisLabel, normalizeReflectorDiagnosis } from '../grc-reflector-diagnosis.ts';

test('normalizeReflectorDiagnosis accepts valid payload', () => {
  const diagnosis = normalizeReflectorDiagnosis({
    aligned: false,
    driftSource: 'curator_misjudgment',
    confidence: 0.74,
    evidence: ['Curator 连续两轮误收窄目标。', '当前 round 仍在补救该偏移。'],
    explanation: '偏移主要来自目标基线收窄。',
  });

  assert.deepEqual(diagnosis, {
    aligned: false,
    driftSource: 'curator_misjudgment',
    confidence: 0.74,
    evidence: ['Curator 连续两轮误收窄目标。', '当前 round 仍在补救该偏移。'],
    explanation: '偏移主要来自目标基线收窄。',
  });
});

test('normalizeReflectorDiagnosis rejects out-of-range confidence and invalid schema', () => {
  assert.equal(normalizeReflectorDiagnosis({
    aligned: true,
    driftSource: 'none',
    confidence: 1.2,
    evidence: ['bad confidence'],
  }), null);

  assert.equal(normalizeReflectorDiagnosis({
    aligned: true,
    driftSource: 'none',
    confidence: 0.5,
    evidence: [],
  }), null);
});

test('formatReflectorDiagnosisLabel formats compact observability text', () => {
  const label = formatReflectorDiagnosisLabel({
    aligned: true,
    driftSource: 'none',
    confidence: 0.88,
    evidence: ['当前执行保持对齐。'],
  });

  assert.equal(label, 'aligned=true, driftSource=none, confidence=0.88, evidence=1');
  assert.equal(formatReflectorDiagnosisLabel(null), null);
});
