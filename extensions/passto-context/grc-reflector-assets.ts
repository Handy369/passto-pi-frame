import type { ReflectorAssetCandidate } from './types.ts';

const MAX_ASSET_CANDIDATES = 3;
const FORBIDDEN_EXECUTION_HINTS = [
  '立即执行',
  '自动执行',
  '直接创建',
  '立刻创建',
  'run ',
  'execute ',
  'apply immediately',
  'auto-create',
  'automatically create',
];

export function normalizeReflectorAssetCandidates(raw: unknown): ReflectorAssetCandidate[] {
  if (!Array.isArray(raw)) return [];

  const parsed = raw
    .map(parseReflectorAssetCandidate)
    .filter((item): item is ReflectorAssetCandidate => !!item);

  if (parsed.length !== raw.length) return [];
  return parsed.slice(0, MAX_ASSET_CANDIDATES);
}

function parseReflectorAssetCandidate(raw: unknown): ReflectorAssetCandidate | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const type = parseCandidateType(value.type);
  if (!type) return null;

  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const rationale = typeof value.rationale === 'string' ? value.rationale.trim() : '';
  if (!title || !rationale) return null;

  if (containsExecutionSemantics(title) || containsExecutionSemantics(rationale)) return null;

  const evidence = Array.isArray(value.evidence)
    ? value.evidence.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 4)
    : [];
  if (evidence.length === 0) return null;
  if (evidence.some((item) => containsExecutionSemantics(item))) return null;

  const targetPath = typeof value.targetPath === 'string' && value.targetPath.trim() ? value.targetPath.trim() : undefined;
  const scope = value.scope === 'shared' || value.scope === 'domain' ? value.scope : undefined;
  const notes = typeof value.notes === 'string' && value.notes.trim() ? value.notes.trim() : undefined;
  if (notes && containsExecutionSemantics(notes)) return null;

  return {
    type,
    title,
    rationale,
    evidence,
    ...(targetPath ? { targetPath } : {}),
    ...(scope ? { scope } : {}),
    ...(notes ? { notes } : {}),
  };
}

function parseCandidateType(raw: unknown): ReflectorAssetCandidate['type'] | null {
  switch (raw) {
    case 'reference':
    case 'script':
      return raw;
    default:
      return null;
  }
}

function containsExecutionSemantics(text: string): boolean {
  const normalized = text.toLowerCase();
  return FORBIDDEN_EXECUTION_HINTS.some((hint) => normalized.includes(hint.toLowerCase()));
}
