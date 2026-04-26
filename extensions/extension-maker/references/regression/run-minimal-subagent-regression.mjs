import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSubagent } from '../../../../lib/passto-agent-runtime/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../..');
const extensionDir = path.resolve(__dirname, '../..');
const baseDir = process.env.EXT_MAKER_REGRESSION_DIR?.trim() || '/tmp/extension-maker-regression';
const targetDir = path.join(baseDir, 'todo-mini');
const reviewRulesPath = path.join(extensionDir, 'references', 'review-rules.md');
const extensionsDocPath = '/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md';
const tuiDocPath = '/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/tui.md';

function parseJsonLenient(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('empty-json-output');

  const tryParse = (candidate) => JSON.parse(String(candidate).trim());

  try {
    return tryParse(raw);
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        return tryParse(fenced[1]);
      } catch {
        // continue to object extraction fallback
      }
    }

    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return tryParse(raw.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('invalid-json-output');
  }
}

function readIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
}

function buildReviewerPrompt({ specText, implementationMethodText, indexText }) {
  const reviewRulesText = readIfExists(reviewRulesPath);
  const extensionsDocText = readIfExists(extensionsDocPath);
  const tuiDocText = readIfExists(tuiDocPath);
  const reviewJsonShape = JSON.stringify({
    reviewedBySubagent: true,
    subagentMode: 'spawn',
    verdict: 'pass | fail',
    derivedImplementationModel: {},
    implementationContractCheck: {},
    categoryConsistencyCheck: {
      expectedCategory: 'stateful-workflow',
      hasOrchestratorLoop: true,
      hasTerminationLogic: false,
      hasKnowledgeModel: false,
      behaviorCoverage: [],
      downgradeDetected: false,
      consistent: true,
    },
    checks: [],
    findings: [],
    criticalIssues: [],
    suggestedFixes: [],
  }, null, 2);

  return [
    'You are an isolated review agent for a generated Pi extension.',
    'Return STRICT JSON only. No markdown fences. No explanation outside JSON.',
    'Review dynamically from official docs + spec + implementation contract + generated code.',
    'Mandatory review order: category consistency -> downgrade detection -> behavior coverage -> API signatures -> state/isolation.',
    'If any mandatory behavior is missing, verdict MUST be fail.',
    '',
    'Return exactly this JSON shape (keys may be filled with real values):',
    reviewJsonShape,
    '',
    '--- REVIEW RULES ---',
    reviewRulesText,
    '',
    '--- SPEC ---',
    specText,
    '',
    '--- IMPLEMENTATION METHOD ---',
    implementationMethodText,
    '',
    '--- INDEX.TS ---',
    indexText,
    '',
    '--- EXTENSIONS DOCS ---',
    extensionsDocText,
    '',
    '--- TUI DOCS ---',
    tuiDocText,
  ].join('\n');
}

async function runReviewer({ specText, implementationMethodText, indexText, reviewOutputPath }) {
  const reviewerPrompt = buildReviewerPrompt({ specText, implementationMethodText, indexText });
  const reviewerResult = await runSubagent({
    agent: 'reviewer',
    prompt: reviewerPrompt,
    cwd: targetDir,
    sessionMode: 'spawn',
    tools: ['read', 'bash'],
    noSession: true,
    noContextFiles: true,
    offline: true,
    timeoutMs: 600_000,
    maxDepth: 3,
    preventCycles: true,
  });

  let review;
  try {
    review = parseJsonLenient(reviewerResult.finalOutputText || '');
  } catch (error) {
    review = {
      reviewedBySubagent: true,
      subagentMode: 'spawn',
      verdict: 'fail',
      parseError: String(error),
      rawOutput: reviewerResult.finalOutputText || '',
      derivedImplementationModel: {},
      implementationContractCheck: {},
      categoryConsistencyCheck: {
        expectedCategory: 'stateful-workflow',
        hasOrchestratorLoop: false,
        hasTerminationLogic: false,
        hasKnowledgeModel: false,
        behaviorCoverage: [],
        downgradeDetected: false,
        consistent: false,
      },
      checks: [],
      findings: ['Reviewer output was not valid JSON'],
      criticalIssues: ['REVIEW_JSON_INVALID'],
      suggestedFixes: ['Fix reviewer prompt or parser'],
    };
  }

  review.reviewedBySubagent = true;
  review.subagentMode = 'spawn';
  review.provenance = reviewerResult.provenance;
  review.runtime = {
    runId: reviewerResult.runId,
    success: reviewerResult.success,
    exitCode: reviewerResult.exitCode,
    stopReason: reviewerResult.stopReason,
    errorMessage: reviewerResult.errorMessage,
  };

  fs.writeFileSync(reviewOutputPath, JSON.stringify(review, null, 2) + '\n');
  return { reviewerResult, review };
}

function ensureInputs() {
  if (!fs.existsSync(reviewRulesPath)) {
    throw new Error(`Missing review rules: ${reviewRulesPath}`);
  }
}

async function main() {
  ensureInputs();

  fs.rmSync(baseDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(targetDir, '.ralph'), { recursive: true });

  const spec = {
    name: 'todo-mini-regression',
    description: 'Minimal regression extension for extension-maker subagent loop validation.',
    requirementCategory: 'stateful-workflow',
    complexityTier: 'workflow',
    exposureMode: 'tool-only',
    mandatoryBehaviors: [
      'Register add_task tool',
      'Register list_tasks tool',
      'Register mark_done tool',
      'Persist tasks in .state.json',
      'Handle missing task id with explicit error',
    ],
  };

  const implementationMethod = {
    implementationContractVersion: 1,
    extensionName: 'todo-mini-regression',
    exposureStrategy: {
      mode: 'tool-only',
      rationale: 'LLM-only regression harness',
    },
    stateStrategy: {
      storageFile: '.state.json',
      shape: {
        nextId: 'number',
        tasks: [{ id: 'number', title: 'string', done: 'boolean' }],
      },
    },
    filePathStrategy: {
      statePath: 'path.join(__dirname, ".state.json")',
    },
    orchestratorDesign: {
      type: 'stateful-workflow',
      summary: 'Register three tools backed by read/write helpers for todo state.',
    },
    behaviorContract: spec.mandatoryBehaviors.map((b) => ({ behavior: b, implementationApproach: 'Implement directly in index.ts' })),
  };

  const specPath = path.join(targetDir, 'extension-generator-spec.json');
  const implementationMethodPath = path.join(targetDir, 'implementation-method.json');
  const indexPath = path.join(targetDir, 'index.ts');
  const codegenRunPath = path.join(targetDir, 'codegen-run.json');
  const review1Path = path.join(targetDir, 'review-round1.json');
  const review2Path = path.join(targetDir, 'review-round2.json');
  const canonicalReviewPath = path.join(targetDir, 'review.json');

  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + '\n');
  fs.writeFileSync(implementationMethodPath, JSON.stringify(implementationMethod, null, 2) + '\n');

  const specText = fs.readFileSync(specPath, 'utf-8');
  const implementationMethodText = fs.readFileSync(implementationMethodPath, 'utf-8');

  const firstTaskFilePath = path.join(targetDir, '.ralph', 'codegen-todo-mini.md');
  fs.writeFileSync(firstTaskFilePath, `# Codegen Task: todo-mini\n\nImplement ${indexPath}\n\n## Checklist\n- [ ] Read spec and implementation-method\n- [ ] Implement add_task/list_tasks/mark_done\n- [ ] Persist state to .state.json\n- [ ] Record verification evidence\n`);

  const coderPrompt = [
    'You are the isolated code implementation subagent for extension-maker.',
    'Implement index.ts in the target directory.',
    'You must treat implementation-method.json as the implementation contract.',
    'Use a Ralph-style iterative approach and update the task file if needed.',
    'Do not redesign the spec.',
    '',
    `Target directory: ${targetDir}`,
    `Ralph task file: ${firstTaskFilePath}`,
    '',
    'Required workflow:',
    '1. Read the spec and implementation-method carefully.',
    '2. Implement index.ts in the target directory.',
    '3. Record verification evidence in the task file.',
    '4. Summarize files changed and checks run.',
    '',
    'Implementation requirements:',
    '- Export/register exactly 3 tools: add_task, list_tasks, mark_done.',
    '- Persist tasks to .state.json in target directory.',
    '- mark_done must error when task id is missing.',
    '- Keep implementation simple and local.',
    '',
    '--- SPEC ---',
    specText,
    '',
    '--- IMPLEMENTATION METHOD ---',
    implementationMethodText,
  ].join('\n');

  const coderResult = await runSubagent({
    agent: 'coder',
    prompt: coderPrompt,
    cwd: targetDir,
    sessionMode: 'spawn',
    tools: ['read', 'bash', 'edit', 'write'],
    noSession: true,
    noContextFiles: true,
    offline: true,
    timeoutMs: 900_000,
    maxDepth: 3,
    preventCycles: true,
  });

  if (!fs.existsSync(indexPath)) throw new Error('coder did not generate index.ts');

  fs.writeFileSync(codegenRunPath, JSON.stringify({
    generatedBySubagent: true,
    agent: 'coder',
    sessionMode: 'spawn',
    repairMode: false,
    runId: coderResult.runId,
    success: coderResult.success,
    finalOutputText: coderResult.finalOutputText,
  }, null, 2) + '\n');

  let brokenIndexText = fs.readFileSync(indexPath, 'utf-8');
  const beforeMutation = brokenIndexText;

  if (/\bmark_done\s*:/.test(brokenIndexText)) {
    brokenIndexText = brokenIndexText.replace(/\bmark_done\s*:/, 'mark_done_broken:');
  } else if (/(["'])mark_done\1/.test(brokenIndexText)) {
    brokenIndexText = brokenIndexText.replace(/(["'])mark_done\1/, '$1mark_done_broken$1');
  } else {
    brokenIndexText = brokenIndexText.replace(/\bmarkDone\b/, 'markDoneBroken');
  }

  if (brokenIndexText === beforeMutation) {
    throw new Error('failed to precisely mutate mark_done registration');
  }
  fs.writeFileSync(indexPath, brokenIndexText, 'utf-8');

  const round1 = await runReviewer({
    specText,
    implementationMethodText,
    indexText: fs.readFileSync(indexPath, 'utf-8'),
    reviewOutputPath: review1Path,
  });
  fs.copyFileSync(review1Path, canonicalReviewPath);

  const repairTaskFilePath = path.join(targetDir, '.ralph', 'codegen-todo-mini-repair.md');
  fs.writeFileSync(repairTaskFilePath, [
    '# Codegen Repair Task: todo-mini',
    '',
    `Repair ${indexPath} based on review findings.`,
    '',
    '## Repair Context',
    `Review path: ${review1Path}`,
    '',
    '## Checklist',
    '- [ ] Read review-round1.json',
    '- [ ] Restore missing mandatory behavior(s)',
    '- [ ] Preserve valid existing implementation',
    '- [ ] Re-verify all tools are present',
  ].join('\n'));

  const repairPrompt = [
    'You are the isolated code implementation subagent for extension-maker.',
    'This is NOT a first-pass implementation.',
    'This is a review-driven repair cycle.',
    'Read the current index.ts and review JSON, then fix only the reviewed issues while preserving valid implementation.',
    '',
    'HARD CONTRACT RULES:',
    '1. SPEC + IMPLEMENTATION-METHOD ARE THE SOURCE OF TRUTH.',
    '2. REVIEW JSON is only a defect report. It MUST NOT redefine the architecture.',
    '3. Do NOT replace the Pi extension SDK with any other SDK.',
    '4. Do NOT replace .state.json persistence with session replay, appendEntry, ctx.sessionManager, MCP SDK, or any alternative state model.',
    '5. Do NOT switch exposure mode. It must remain tool-only.',
    '6. Do NOT rewrite working parts just because reviewer suggests a different style.',
    '7. Make the minimum code changes required to satisfy the review while preserving the original contract.',
    '',
    'NON-NEGOTIABLE IMPLEMENTATION CONSTRAINTS:',
    '- Must use import type { ExtensionAPI } from @mariozechner/pi-coding-agent',
    '- Must use export default function (pi: ExtensionAPI) { ... }',
    '- Must use pi.registerTool(...)',
    '- Must use Type.Object / Type.String / Type.Number from @sinclair/typebox',
    '- Must persist state in .state.json via local file I/O in the target directory',
    '- Must provide exactly 3 tools named add_task, list_tasks, mark_done',
    '- mark_done must throw on missing task id',
    '',
    `Target directory: ${targetDir}`,
    `Ralph task file: ${repairTaskFilePath}`,
    `Review path: ${review1Path}`,
    '',
    'Repair goals:',
    '- Restore the missing mark_done tool registration if absent or renamed.',
    '- Ensure all three tools are correctly registered: add_task, list_tasks, mark_done.',
    '- Preserve .state.json persistence and explicit missing-id error handling.',
    '- Keep the same Pi SDK, same entry-point pattern, and same state model.',
    '- Do not redesign unrelated parts.',
    '',
    'Allowed edits in this repair round:',
    '- rename wrong tool name(s)',
    '- fix explicit error signaling to use throw',
    '- fix minor contract mismatches in existing Pi-style code',
    '',
    'Forbidden edits in this repair round:',
    '- migrating to another SDK',
    '- replacing file persistence with session-based persistence',
    '- rewriting the whole extension from scratch unless the current file is irreparably broken',
    '- changing mandatory behavior semantics',
    '',
    '--- SPEC ---',
    specText,
    '',
    '--- IMPLEMENTATION METHOD ---',
    implementationMethodText,
    '',
    '--- CURRENT INDEX.TS ---',
    fs.readFileSync(indexPath, 'utf-8'),
    '',
    '--- REVIEW JSON ---',
    fs.readFileSync(review1Path, 'utf-8'),
  ].join('\n');

  const repairResult = await runSubagent({
    agent: 'coder',
    prompt: repairPrompt,
    cwd: targetDir,
    sessionMode: 'spawn',
    tools: ['read', 'bash', 'edit', 'write'],
    noSession: true,
    noContextFiles: true,
    offline: true,
    timeoutMs: 900_000,
    maxDepth: 3,
    preventCycles: true,
  });

  const repairRunPath = path.join(targetDir, 'codegen-run-repair.json');
  fs.writeFileSync(repairRunPath, JSON.stringify({
    generatedBySubagent: true,
    agent: 'coder',
    sessionMode: 'spawn',
    repairMode: true,
    reviewPath: review1Path,
    runId: repairResult.runId,
    success: repairResult.success,
    finalOutputText: repairResult.finalOutputText,
  }, null, 2) + '\n');

  const round2 = await runReviewer({
    specText,
    implementationMethodText,
    indexText: fs.readFileSync(indexPath, 'utf-8'),
    reviewOutputPath: review2Path,
  });
  fs.copyFileSync(review2Path, canonicalReviewPath);

  const summary = {
    repoRoot,
    extensionDir,
    targetDir,
    assertions: {
      indexGenerated: fs.existsSync(indexPath),
      codegenRunRecorded: fs.existsSync(codegenRunPath),
      reviewRound1Generated: fs.existsSync(review1Path),
      reviewedBySubagentRound1: round1.review.reviewedBySubagent === true,
      subagentModeSpawnRound1: round1.review.subagentMode === 'spawn',
      verdictFailRound1: String(round1.review.verdict).toLowerCase() === 'fail',
      repairRunRecorded: fs.existsSync(repairRunPath),
      reviewRound2Generated: fs.existsSync(review2Path),
      reviewedBySubagentRound2: round2.review.reviewedBySubagent === true,
      verdictPassRound2: String(round2.review.verdict).toLowerCase() === 'pass',
    },
    coder: {
      runId: coderResult.runId,
      success: coderResult.success,
      stopReason: coderResult.stopReason,
    },
    reviewerRound1: {
      runId: round1.reviewerResult.runId,
      success: round1.reviewerResult.success,
      stopReason: round1.reviewerResult.stopReason,
    },
    repairCoder: {
      runId: repairResult.runId,
      success: repairResult.success,
      stopReason: repairResult.stopReason,
    },
    reviewerRound2: {
      runId: round2.reviewerResult.runId,
      success: round2.reviewerResult.success,
      stopReason: round2.reviewerResult.stopReason,
    },
    reviewHeadline: {
      round1Verdict: round1.review.verdict,
      round1CriticalIssues: round1.review.criticalIssues,
      round2Verdict: round2.review.verdict,
      round2CriticalIssues: round2.review.criticalIssues,
    },
  };

  fs.writeFileSync(path.join(targetDir, 'regression-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
