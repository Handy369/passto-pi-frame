import type {
  ExportPrinciplesReviewBundleResult,
  ImportPrinciplesReviewDecisionResult,
} from './grc-principles-review.ts';
import { exportPrinciplesReviewBundle, importPrinciplesReviewDecisionFile } from './grc-principles-review.ts';
import type { Logger } from './types.ts';
import { expandHome } from './utils.ts';

export interface HandlePTCPrinciplesReviewCommandOptions {
  principlesDir: string;
  logger: Logger;
  notify: (message: string, level: 'info' | 'warning' | 'error') => void;
  exportBundle?: typeof exportPrinciplesReviewBundle;
  importDecisionFile?: typeof importPrinciplesReviewDecisionFile;
  expandPath?: (value: string) => string;
}

export function getPTCUsageText(): string {
  return 'Usage: /ptc [status|on|off|config|rotate|compact|principles review export|principles review import <file>|skills status|skills ready|skills reviewed|skills aggregate [skillKey|skillName|skillPath]|skills export [skillKey|skillName|skillPath] [output-dir]]';
}

export function formatPrinciplesReviewExportMessage(result: ExportPrinciplesReviewBundleResult): string {
  return [
    'Principles review bundle exported:',
    `- dir: ${result.outputDir}`,
    `- files: review-model.json, review.html`,
    `- snapshot: ${result.registrySnapshotHash}`,
  ].join('\n');
}

export function formatPrinciplesReviewImportMessage(result: ImportPrinciplesReviewDecisionResult): string {
  return [
    'Principles review imported:',
    `- total decisions: ${result.totalDecisions}`,
    `- updated: ${result.updated}`,
    `- active: ${result.active}`,
    `- stale: ${result.stale}`,
    `- archived: ${result.archived}`,
    `- disabled: ${result.disabled}`,
    `- registry: ${result.registryPath}`,
  ].join('\n');
}

export async function handlePTCPrinciplesReviewCommand(
  input: string,
  options: HandlePTCPrinciplesReviewCommandOptions,
): Promise<boolean> {
  const normalized = input.trim();
  if (!normalized.startsWith('principles')) return false;

  const parts = normalized.split(/\s+/);
  if (parts[0] !== 'principles' || parts[1] !== 'review') return false;

  const action = parts[2]?.toLowerCase();
  if (action === 'export') {
    const outputDir = parts[3] ? (options.expandPath ?? expandHome)(parts[3]) : undefined;
    try {
      const result = await (options.exportBundle ?? exportPrinciplesReviewBundle)({
        principlesDir: options.principlesDir,
        outputDir,
        logger: options.logger,
      });
      options.notify(formatPrinciplesReviewExportMessage(result), 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      options.notify(`Export failed: ${message}`, 'error');
    }
    return true;
  }

  if (action === 'import') {
    const decisionFileArg = parts[3];
    if (!decisionFileArg) {
      options.notify(getPTCUsageText(), 'warning');
      return true;
    }

    try {
      const result = await (options.importDecisionFile ?? importPrinciplesReviewDecisionFile)({
        principlesDir: options.principlesDir,
        decisionFilePath: (options.expandPath ?? expandHome)(decisionFileArg),
        logger: options.logger,
      });
      options.notify(formatPrinciplesReviewImportMessage(result), 'info');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      options.notify(`Import failed: ${message}`, 'error');
    }
    return true;
  }

  options.notify(getPTCUsageText(), 'warning');
  return true;
}
