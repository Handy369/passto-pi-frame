import type { ReflectorDiagnosis, ReflectorDriftSource } from './types.ts';

export function normalizeReflectorDiagnosis(raw: unknown): ReflectorDiagnosis | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.aligned !== 'boolean') return null;

  const driftSource = parseReflectorDriftSource(value.driftSource);
  if (!driftSource) return null;

  const confidence = typeof value.confidence === 'number' ? clampReflectorConfidence(value.confidence) : NaN;
  if (!Number.isFinite(confidence)) return null;

  const evidence = Array.isArray(value.evidence)
    ? value.evidence.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 5)
    : [];

  if (evidence.length === 0) return null;

  const explanation = typeof value.explanation === 'string' && value.explanation.trim()
    ? value.explanation.trim()
    : undefined;

  return {
    aligned: value.aligned,
    driftSource,
    confidence,
    evidence,
    ...(explanation ? { explanation } : {}),
  };
}

export function formatReflectorDiagnosisLabel(diagnosis: ReflectorDiagnosis | null | undefined): string | null {
  if (!diagnosis) return null;
  return `aligned=${diagnosis.aligned}, driftSource=${diagnosis.driftSource}, confidence=${diagnosis.confidence.toFixed(2)}, evidence=${diagnosis.evidence.length}`;
}

function parseReflectorDriftSource(raw: unknown): ReflectorDriftSource | null {
  switch (raw) {
    case 'none':
    case 'goal_state_drift':
    case 'generator_execution_drift':
    case 'curator_misjudgment':
    case 'mixed':
      return raw;
    default:
      return null;
  }
}

function clampReflectorConfidence(value: number): number {
  if (!Number.isFinite(value)) return NaN;
  if (value < 0 || value > 1) return NaN;
  return value;
}
