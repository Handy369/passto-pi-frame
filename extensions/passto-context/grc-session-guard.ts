export function normalizeSessionFile(sessionFile?: string | null): string | null {
  if (typeof sessionFile !== 'string') return null;
  const trimmed = sessionFile.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getSessionStateGuardReason(
  activeSessionFile: string | null | undefined,
  currentSessionFile?: string | null,
  restoreReady: boolean = true,
): string | null {
  if (!restoreReady) {
    return 'restore-not-ready';
  }

  const active = normalizeSessionFile(activeSessionFile);
  const current = normalizeSessionFile(currentSessionFile);
  if (active !== current) {
    return `session-mismatch(active=${active ?? 'ephemeral'}, current=${current ?? 'ephemeral'})`;
  }

  return null;
}

export function isSessionStateReady(
  activeSessionFile: string | null | undefined,
  currentSessionFile?: string | null,
  restoreReady: boolean = true,
): boolean {
  return getSessionStateGuardReason(activeSessionFile, currentSessionFile, restoreReady) === null;
}
