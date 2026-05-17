export function normalizePTCSubcommand(subcommand: string | undefined): string | undefined {
  const normalized = subcommand?.trim().toLowerCase();
  if (!normalized) {
    return normalized;
  }

  if (normalized === 'compact') {
    return 'rotate';
  }

  return normalized;
}
