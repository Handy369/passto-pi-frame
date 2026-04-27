import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { renderFinalResult, renderProgressUpdate, runSubagent } from "../../lib/passto-agent-runtime/index.ts";

// ============================================================================
// 1. State & Config Definitions
// ============================================================================

interface MakerState {
  userIdea: string;
  planningDir: string;
  targetDir: string;
  currentStep: number;
  slug: string;
  exposureMode?: "command-only" | "tool-only" | "both";
  reviewExecuted?: boolean;
  startedAt: string;
}

interface FlowDetails {
  shouldContinue?: boolean;
  nextSuggestedAction?: string;
  blocked?: boolean;
  reason?: string;
  done?: boolean;
  [key: string]: unknown;
}

const STEP_NAMES: Record<number, string> = {
  1: "需求采集",
  2: "生成规格 JSON",
  3: "校验规格",
  4: "生成核心代码",
  5: "生成文档体系",
  6: "执行生成审计",
  7: "交付确认",
};

const TOTAL_STEPS = Object.keys(STEP_NAMES).length;
const STATE_FILE = ".extension-maker-state.json";

// ============================================================================
// 2. Helpers
// ============================================================================

// Simplified slug to avoid long names and ensure filesystem safety
function sanitize(input: string): string {
  const clean = input
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^[\s./\\_-]+/, "")
    .replace(/\.(md|markdown|txt|json|ts|tsx|js|jsx)$/i, "")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .toLowerCase();
  return clean.slice(0, 32) || "my-extension";
}

function statePath(dir: string): string {
  return path.join(dir, STATE_FILE);
}

function getStableBaseDir(): string {
  return path.resolve(__dirname, "..", "..", ".extension-maker");
}

function saveState(state: MakerState): void {
  try {
    if (!fs.existsSync(state.planningDir)) fs.mkdirSync(state.planningDir, { recursive: true });
    fs.writeFileSync(statePath(state.planningDir), JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Save State Error:", e);
  }
}

function loadState(dir: string): MakerState | null {
  try {
    if (!fs.existsSync(statePath(dir))) return null;
    return JSON.parse(fs.readFileSync(statePath(dir), "utf-8"));
  } catch {
    return null;
  }
}

function removeState(dir: string): void {
  try {
    const p = statePath(dir);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
}

function updateUI(ctx: ExtensionContext, state: MakerState | null): void {
  if (!ctx.hasUI || !state) {
    ctx.ui.setStatus("extension-maker", undefined);
    ctx.ui.setWidget("extension-maker", undefined);
    return;
  }
  ctx.ui.setStatus(
    "extension-maker",
    `🛠️ ${state.slug} · Step ${state.currentStep}/${TOTAL_STEPS}`,
  );
}

function flowDetails(base?: FlowDetails, extra?: Record<string, unknown>): FlowDetails {
  return {
    ...(base ?? {}),
    ...(extra ?? {}),
  };
}

function resolveUniqueSlug(baseDir: string, rawSlug: string): string {
  const baseSlug = rawSlug || "my-extension";
  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    const planningDir = path.join(baseDir, candidate);
    const targetDir = path.join(baseDir, "generated", candidate);
    const planningExists = fs.existsSync(planningDir);
    const targetExists = fs.existsSync(targetDir);

    if (!planningExists && !targetExists) return candidate;

    const suffix = `-${counter}`;
    const maxBaseLength = Math.max(1, 32 - suffix.length);
    candidate = `${baseSlug.slice(0, maxBaseLength)}${suffix}`;
    counter += 1;
  }
}

function inferMinimumRequirementCategory(userIdea: string): {
  minimumCategory: "simple-tool" | "provider-wrapper" | "stateful-workflow" | "recursive-research-engine" | "multi-agent-orchestrator";
  matchedSignals: string[];
} {
  const text = String(userIdea || "").toLowerCase();
  const hasAny = (patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));
  const matchedSignals: string[] = [];

  const orchestratorSignals = [
    /multiple agents?/, /multi-agent/, /subagents?/, /delegate/, /delegation/, /orchestrat/, /协调/, /委派/, /多个\s*agent/, /子\s*agent/
  ];
  const recursiveSignals = [
    /recursive/, /recursion/, /loop/, /multi-round/, /multi round/, /iterative/, /iterate/, /sufficien/, /gap/, /sub-?queries?/, /knowledge\s*pool/, /knowledge\s*model/, /knowledge\s*accumulation/, /research\s*engine/, /research\s*workflow/, /递归/, /循环/, /多轮/, /迭代/, /充分性/, /缺口/, /子查询/, /知识池/, /知识模型/, /知识积累/, /调研引擎/
  ];
  const workflowSignals = [
    /workflow/, /stateful/, /state machine/, /wizard/, /step-by-step/, /multi-step/, /approval/, /checkpoint/, /流程/, /状态机/, /多步/, /向导/, /确认点/
  ];
  const providerSignals = [
    /api wrapper/, /wrap .*api/, /provider/, /adapter/, /封装.*api/, /封装.*cli/, /适配器/, /包装器/
  ];

  if (hasAny(orchestratorSignals)) {
    matchedSignals.push("multi-agent-orchestrator-signals");
    return { minimumCategory: "multi-agent-orchestrator", matchedSignals };
  }
  if (hasAny(recursiveSignals)) {
    matchedSignals.push("recursive-research-engine-signals");
    return { minimumCategory: "recursive-research-engine", matchedSignals };
  }
  if (hasAny(workflowSignals)) {
    matchedSignals.push("stateful-workflow-signals");
    return { minimumCategory: "stateful-workflow", matchedSignals };
  }
  if (hasAny(providerSignals)) {
    matchedSignals.push("provider-wrapper-signals");
    return { minimumCategory: "provider-wrapper", matchedSignals };
  }

  return { minimumCategory: "simple-tool", matchedSignals };
}

function categoryRank(category: string): number {
  const order = ["simple-tool", "provider-wrapper", "stateful-workflow", "recursive-research-engine", "multi-agent-orchestrator"];
  const index = order.indexOf(category);
  return index === -1 ? -1 : index;
}

function parseJsonLenient(text: string): any {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("empty-json-output");

  const tryParse = (candidate: string): any => JSON.parse(candidate.trim());

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

    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const objectSlice = raw.slice(firstBrace, lastBrace + 1);
      return tryParse(objectSlice);
    }

    throw new Error("invalid-json-output");
  }
}

function buildFailedReview(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    reviewedBySubagent: true,
    subagentMode: "spawn",
    verdict: "fail",
    derivedImplementationModel: {
      status: "unavailable",
      reason: "isolated-review-failed-or-returned-invalid-json",
    },
    implementationContractCheck: {
      status: "unavailable",
      reason: "isolated-review-failed-or-returned-invalid-json",
    },
    checks: [],
    findings: [],
    criticalIssues: [],
    suggestedFixes: [],
    ...partial,
  };
}

function sanitizeImplementationMethodContent(rawContent: string): string {
  const raw = String(rawContent ?? "");
  let parsed: any;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;

  const blockedKeys = new Set([
    "reviewInput",
    "reviewPath",
    "reviewJsonPath",
    "reviewFile",
    "reviewFilePath",
    "reviewRequested",
    "reviewExecuted",
    "reviewFeedback",
    "reviewFindings",
    "reviewVerdict",
    "reviewSummary",
    "repairLoop",
    "rollbackStep",
    "rollbackReason",
    "repairContext",
    "repairNotes",
  ]);

  const strip = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(strip);
    if (!value || typeof value !== "object") return value;

    const next: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (blockedKeys.has(key)) continue;
      next[key] = strip(child);
    }
    return next;
  };

  const cleaned = strip(parsed) as Record<string, unknown>;
  return `${JSON.stringify(cleaned, null, 2)}\n`;
}

function extractReviewRepairContext(review: any): {
  verdict: string;
  criticalIssues: string[];
  findings: string[];
  suggestedFixes: string[];
} {
  const toLines = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      : [];

  return {
    verdict: String(review?.verdict ?? "fail"),
    criticalIssues: toLines(review?.criticalIssues),
    findings: toLines(review?.findings),
    suggestedFixes: toLines(review?.suggestedFixes),
  };
}

function loadRepairContextFromReviewPath(reviewPath: string): {
  verdict: string;
  criticalIssues: string[];
  findings: string[];
  suggestedFixes: string[];
} {
  try {
    const review = JSON.parse(fs.readFileSync(reviewPath, "utf-8"));
    return extractReviewRepairContext(review);
  } catch {
    return {
      verdict: "fail",
      criticalIssues: ["review.json could not be parsed"],
      findings: [],
      suggestedFixes: ["Fix review.json and rerun repair cycle"],
    };
  }
}

function buildRalphCodegenTask(input: {
  slug: string;
  targetDir: string;
  specText: string;
  implementationMethodText: string;
  category: string;
  mandatoryBehaviors: string[];
  repairContext?: {
    reviewPath: string;
    verdict: string;
    criticalIssues: string[];
    findings: string[];
    suggestedFixes: string[];
  };
}): string {
  const behaviorChecklist = input.mandatoryBehaviors.length > 0
    ? input.mandatoryBehaviors.map((item) => `- [ ] ${item}`).join("\n")
    : "- [ ] Implement the required behaviors from spec and implementation-method";

  const repairSection = input.repairContext
    ? `\n## Repair Context\nThis is a repair cycle triggered by failed Step 6 review.\n\nReview file:\n${input.repairContext.reviewPath}\n\nVerdict:\n${input.repairContext.verdict}\n\nCritical Issues\n${input.repairContext.criticalIssues.length > 0 ? input.repairContext.criticalIssues.map((item) => `- ${item}`).join("\n") : "- <none>"}\n\nFindings\n${input.repairContext.findings.length > 0 ? input.repairContext.findings.map((item) => `- ${item}`).join("\n") : "- <none>"}\n\nSuggested Fixes\n${input.repairContext.suggestedFixes.length > 0 ? input.repairContext.suggestedFixes.map((item) => `- ${item}`).join("\n") : "- <none>"}\n\nRepair Objective\nFix the reviewed issues while preserving valid existing implementation.\nDo not rewrite unrelated parts unless necessary.\n`
    : "";

  const repairChecklist = input.repairContext
    ? `- [ ] Read review.json and identify required fixes\n- [ ] Preserve already-correct implementation structure\n- [ ] Fix critical issues from review\n- [ ] Re-verify mandatory behaviors after repair\n`
    : "";

  return `# Codegen Task: ${input.slug}

Implement the extension core code in:
${path.join(input.targetDir, "index.ts")}

## Goals
- Implement index.ts from the provided spec and implementation-method
- Respect the requirement category: ${input.category}
- Preserve all mandatory behaviors
- Do not downgrade workflow/system requirements into thin wrappers

## Inputs
- Spec: extension-generator-spec.json
- Contract: implementation-method.json
${repairSection}
## Checklist
- [ ] Read spec and implementation-method
${repairChecklist}- [ ] Identify required runtime structure and core control flow
- [ ] Implement state/orchestrator/handlers required by the contract
- [ ] Write index.ts
- [ ] Verify implementation aligns with mandatory behaviors
${behaviorChecklist}
- [ ] Record verification evidence

## Verification
- Record files written
- Record key functions added
- Record any local validation steps
- Record blockers if unresolved

## Notes
- implementation-method.json is the implementation contract
- Do not redefine product scope
- Do not skip required structural behaviors
`;
}

function buildCodegenSubagentPrompt(input: {
  targetDir: string;
  specText: string;
  implementationMethodText: string;
  taskFilePath: string;
  repairMode?: boolean;
  repairContext?: {
    reviewPath: string;
    verdict: string;
    criticalIssues: string[];
    findings: string[];
    suggestedFixes: string[];
  };
}): string {
  const repairHeader = input.repairMode
    ? [
        "This is NOT a first-pass implementation.",
        "This is a review-driven repair cycle.",
        "You must:",
        "1. Read review.json",
        "2. Fix the reviewed issues",
        "3. Preserve valid existing implementation unless changes are necessary",
        "4. Do not re-scope the extension",
        "5. Do not downgrade required architecture",
        "",
        "--- REVIEW CONTEXT ---",
        `Review path: ${input.repairContext?.reviewPath ?? ""}`,
        "Critical issues:",
        ...(input.repairContext?.criticalIssues.length ? input.repairContext.criticalIssues.map((item) => `- ${item}`) : ["- <none>"]),
        "Findings:",
        ...(input.repairContext?.findings.length ? input.repairContext.findings.map((item) => `- ${item}`) : ["- <none>"]),
        "Suggested fixes:",
        ...(input.repairContext?.suggestedFixes.length ? input.repairContext.suggestedFixes.map((item) => `- ${item}`) : ["- <none>"]),
        "",
      ]
    : [];

  return [
    "You are the isolated code implementation subagent for extension-maker.",
    "Your job is to implement the extension core code in the target directory.",
    "You must treat implementation-method.json as the implementation contract.",
    "You must work iteratively in a Ralph-style loop using the provided task file.",
    "Do not redesign the spec. Do not simplify away required workflow/system behaviors.",
    ...repairHeader,
    "",
    `Target directory: ${input.targetDir}`,
    `Ralph task file: ${input.taskFilePath}`,
    "",
    "Required workflow:",
    "1. Read the spec and implementation-method carefully.",
    "2. Update the Ralph task file as you work.",
    "3. Implement index.ts in the target directory.",
    "4. Record verification evidence in the task file.",
    "5. When implementation is complete, output a concise summary of files changed, behaviors implemented, and verification evidence.",
    "",
    "--- SPEC ---",
    input.specText,
    "",
    "--- IMPLEMENTATION METHOD ---",
    input.implementationMethodText,
  ].join("\n");
}

function buildStrictJsonReviewPrompt(input: {
  reviewRulesText: string;
  specText: string;
  implementationMethodText: string;
  indexText: string;
  extensionsDocText: string;
  tuiDocText: string;
}): string {
  const jsonShape = JSON.stringify(
    {
      reviewedBySubagent: true,
      subagentMode: "spawn",
      verdict: "pass | fail",
      derivedImplementationModel: {},
      implementationContractCheck: {},
      categoryConsistencyCheck: {
        expectedCategory: "requirementCategory from spec",
        hasOrchestratorLoop: true,
        hasTerminationLogic: true,
        hasKnowledgeModel: true,
        behaviorCoverage: ["mandatoryBehavior1: implemented", "mandatoryBehavior2: missing"],
        downgradeDetected: false,
        consistent: true,
      },
      checks: [],
      findings: [],
      criticalIssues: [],
      suggestedFixes: [],
    },
    null,
    2,
  );

  return [
    "You are an isolated review agent for a generated Pi extension.",
    "Review dynamically from official docs + spec + implementation contract + generated code.",
    "Do not use a static checklist.",
    "Return STRICT JSON only.",
    "Do not wrap the JSON in markdown fences.",
    "Do not add explanations before or after the JSON.",
    "If you are uncertain, still return valid JSON and record uncertainty in findings / criticalIssues / suggestedFixes.",
    "If any critical issue exists, verdict must be fail.",
    "Your job:",
    "1. Re-derive the valid implementation model from the supplied official docs excerpts.",
    "2. Verify implementation-method.json against the docs and spec.",
    "3. Verify generated files actually implement implementation-method.json.",
    "4. Explicitly explain any used UI APIs: select signature, input signature, confirm return type, editor parameter semantics.",
    "5. CRITICAL — Category Consistency Check: Read spec.requirementCategory and verify the implementation contains the structural elements required by that category. For recursive-research-engine: must have main loop, knowledge pool, sufficiency logic. For multi-agent-orchestrator: must have delegation/aggregation. For stateful-workflow: must have state machine. If missing → verdict: fail.",
    "6. CRITICAL — Downgrade Detection: If spec describes a multi-round/system requirement (recursive-research-engine, multi-agent-orchestrator) but the implementation is a single-step function call with no loop or state machine → verdict: fail with criticalIssue SINGLE_STEP_DOWNGRADE.",
    "7. CRITICAL — Behavior Coverage: Every item in spec.mandatoryBehaviors must be implemented in code. If any is missing → verdict: fail.",
    "Review order: Category Consistency → Downgrade Detection → Behavior Coverage → API Signatures → State/Isolation. If steps 1-3 fail, you may skip steps 4-5.",
    "Required JSON shape:",
    jsonShape,
    "--- REVIEW RULES ---",
    input.reviewRulesText,
    "--- SPEC ---",
    input.specText,
    "--- IMPLEMENTATION METHOD ---",
    input.implementationMethodText,
    "--- GENERATED INDEX.TS ---",
    input.indexText,
    "--- OFFICIAL EXTENSIONS DOCS ---",
    input.extensionsDocText,
    "--- OFFICIAL TUI DOCS ---",
    input.tuiDocText,
  ].join("\n\n");
}

// ============================================================================
// 3. Prompt Builder
// ============================================================================

function buildPrompt(state: MakerState, step: number, options?: { repairContext?: string }): string {
  const stepName = STEP_NAMES[step] ?? "Unknown";
  const skillPath = path.join(__dirname, "SKILL.md");
  const refIntake = path.join(__dirname, "references", "spec-intake-rules.md");
  const refMapping = path.join(__dirname, "references", "codegen-mapping.md");
  const refReview = path.join(__dirname, "references", "review-rules.md");
  const refBlackBox = path.join(__dirname, "references", "black-box-design-protocol.md");

  const targetDir = state.targetDir;
  
  // CRITICAL: Hard Stop Instruction
  const stopRule = `⛔ STOP RULE: After you finish the current step, STOP immediately. DO NOT proceed to the next step on your own. You must WAIT for the user or the system to call the "next" tool.`;

  let instruction = "";
  if (step === 1) {
    instruction = `🎯 STEP 1: INTAKE\n- Use Black Box Protocol (${refBlackBox}).\n- FIRST: call ext_maker_choose_exposure(planningDir="${state.planningDir}") to let the user choose the exposure mode via fixed 3-option UI.\n- Exposure mode is the ONLY single-choice question in this workflow.\n- For all other requirement questions, use ext_maker_question in multi-select style by default.\n- When using ext_maker_question for non-exposure requirements, prefer giving multiple preset options and allow the user to add custom inputs; custom input may contain multiple items separated by |.\n- Do not proceed until exposure mode is explicitly chosen and stored in runtime state.\n- Goal: Confirm clear requirements and exposure mode.`;
  } else if (step === 2) {
    instruction = `📝 STEP 2: SPEC GEN\n- Read: ${refIntake}\n- Read: SKILL.md\n- IMPORTANT: The "slug" in the JSON MUST match the target directory name: "${state.slug}".\n- IMPORTANT: The generated spec MUST include the chosen exposure mode: "${state.exposureMode ?? "UNSET"}".\n- Map exposure mode to implementation intent:\n  - command-only => registerCommand() only\n  - tool-only => registerTool() only\n  - both => registerCommand() + registerTool()\n- MANDATORY: Before writing the spec, classify the requirement into one of 5 categories: simple-tool, provider-wrapper, stateful-workflow, recursive-research-engine, multi-agent-orchestrator. Use signals: loop/recursive/multi-round → recursive-research-engine; knowledge pool → recursive-research-engine; sufficiency judgment → recursive-research-engine; gap detection → recursive-research-engine; multiple agents → multi-agent-orchestrator; multi-step flow → stateful-workflow; API wrapping → provider-wrapper; simple I/O → simple-tool. When in doubt, choose the more complex category.\n- MANDATORY: The spec MUST include requirementCategory, complexityTier, and for stateful-workflow and above: orchestrationRequirements, mandatoryBehaviors, terminationCriteria. For recursive-research-engine and multi-agent-orchestrator, also include: knowledgeModel, roundControl, multiRoundLoop.\n- CRITICAL: Do NOT downgrade a multi-round/recursive system requirement into a simple linear workflow. If the user describes a research engine with knowledge accumulation, sufficiency judgment, and gap detection, the spec MUST reflect these as mandatory behaviors and the requirementCategory MUST be recursive-research-engine.\n- Write the spec using ext_maker_write_artifact(path="${path.join(targetDir, "extension-generator-spec.json")}", content=...).\n- Call ext_maker_next when done.`;
  } else if (step === 3) {
    instruction = `🔍 STEP 3: AUDIT SPEC\n- Read ${targetDir}/extension-generator-spec.json.\n- Fix logic errors.\n- Call ext_maker_next when passed.`;
  } else if (step === 4) {
    instruction = `💻 STEP 4: IMPLEMENTATION METHOD + ISOLATED CODEGEN\n- FIRST: Call ext_maker_read_docs(topic="extensions") and ext_maker_read_docs(topic="tui").\n- Read: ${refMapping}\n- Before writing any code, derive the implementation method for THIS extension from current docs + spec.\n- You MUST write this derived model using ext_maker_write_artifact to \"${path.join(targetDir, "implementation-method.json")}\".\n- The implementation-method.json is a docs+spec-derived implementation contract only. DO NOT include review-phase or repair-loop fields such as reviewInput / reviewPath / reviewVerdict / rollbackStep / repairContext.\n- The implementation-method.json must explicitly cover: exposure strategy, state strategy, file/path strategy, and any used UI APIs (ctx.ui.select / input / confirm / editor) with parameter shape, return type, and calling semantics inferred from docs.\n- MANDATORY: Read the spec's requirementCategory and complexityTier. If category is stateful-workflow or above, implementation-method.json MUST include: orchestratorDesign (describes main control flow / state machine) and behaviorContract (maps each mandatoryBehavior from spec to implementation approach).\n- MANDATORY: If category is recursive-research-engine or multi-agent-orchestrator, implementation-method.json MUST ALSO include: loopDesign ({ entryCondition, bodyDescription, terminationCondition, maxIterations, stateAccumulation }), knowledgeStructure (how knowledge accumulates across rounds), and sufficiencyLogic (how system decides when to stop).\n- CRITICAL: NEVER downgrade a recursive-research-engine or multi-agent-orchestrator spec into a single-function-call implementation. The generated code MUST contain the orchestrator loop / main control flow / knowledge accumulation that the spec requires.\n- After implementation-method.json is written, DO NOT generate index.ts directly in the main agent.\n- Instead, you MUST call ext_maker_codegen_with_subagent(planningDir="${state.planningDir}", targetDir="${targetDir}", specPath="${path.join(targetDir, "extension-generator-spec.json")}", implementationMethodPath="${path.join(targetDir, "implementation-method.json")}") to execute isolated code generation via coder subagent + Ralph-style iterative development.\n- Do not guess unsupported extra parameters or invented return structures.\n- Respect the chosen exposure mode: ${state.exposureMode ?? "UNSET"}.\n- Implement exposure as follows:\n  - command-only => only registerCommand() for the user entrypoint\n  - tool-only => only registerTool() for LLM discovery/calling\n  - both => registerCommand() and registerTool() together when appropriate\n- Call ext_maker_next only after isolated codegen is complete and index.ts exists.`;
  } else if (step === 5) {
    instruction = `📚 STEP 5: DOCS GEN\n- Generate \"SKILL.md\" and required files under \"references/\" in ${targetDir} using ext_maker_write_artifact.\n- This step may be entered either normally or as a repair cycle after review feedback. If this is a repair cycle, update docs to match the corrected implementation and review findings, but do not rewrite implementation-method.json with review bookkeeping.\n- Call ext_maker_next when done.`;
  } else if (step === 6) {
    instruction = `🛡️ STEP 6: REVIEW\n- FIRST: Call ext_maker_read_docs(topic="extensions") and ext_maker_read_docs(topic="tui").\n- Read: ${refReview}\n- Read \"implementation-method.json\" from ${targetDir} and use it as the primary implementation contract.\n- Review must verify that generated files actually implement implementation-method.json and that implementation-method.json itself is consistent with official docs + spec.\n- Your derived implementation model must explicitly explain any used UI APIs: select signature, input signature, confirm return type, editor parameter semantics.\n- MANDATORY CATEGORY CHECK: Before checking API signatures, FIRST verify that the implementation structure matches the spec's requirementCategory. If spec says recursive-research-engine but implementation has no main loop, no knowledge pool, no sufficiency judgment — this is a CRITICAL FAIL. If spec says stateful-workflow but implementation has no state machine — CRITICAL FAIL.\n- MANDATORY DOWNGRADE CHECK: Detect if a multi-round/system requirement was implemented as a single-step tool. If spec describes a research engine with recursive loops, knowledge accumulation, and gap detection, but the code only does a single API call — verdict MUST be fail with criticalIssue \"SINGLE_STEP_DOWNGRADE\".\n- MANDATORY BEHAVIOR CHECK: Every item in spec's mandatoryBehaviors must have a corresponding implementation in code. If any is missing — CRITICAL FAIL.\n- Review order: (1) Category consistency → (2) Downgrade detection → (3) Behavior coverage → (4) API signatures → (5) State/isolation/boundaries. Steps 4 and 5 can be skipped if steps 1-3 fail.\n- DO NOT use a static hard-coded checklist as the review standard.\n- MUST call ext_maker_review_with_subagent with spec + implementation-method + targetDir. This tool now runs the isolated review directly via passto-agent-runtime and writes review.json automatically.\n- If review.json verdict is not pass, DO NOT advance. Instead call ext_maker_apply_review_feedback(planningDir="${state.planningDir}", targetDir="${targetDir}") to classify fixes, roll back to the correct step, and continue the repair loop.\n- Call ext_maker_next only after review is complete and passing.`;
  } else if (step === 7) {
    instruction = `✅ STEP 7: DELIVERY\n- Read: ${targetDir}/review.json\n- Use ext_maker_review_gate to ask for confirmation.\n- If confirmed, call ext_maker_done.`;
  }

  const repairBanner = options?.repairContext
    ? `\n🔁 REPAIR CYCLE: This is a rollback from Step 6 review, not a first-pass generation step.\nRepair Context: ${options.repairContext}\nFocus on fixing the reviewed issues while preserving step boundaries.\n`
    : "";

  return `════════════════════════════════════════════
EXTENSION-MAKER: Step ${step}/${TOTAL_STEPS} — ${stepName}
════════════════════════════════════════════
User Goal: ${state.userIdea}
Target Dir: ${targetDir}
Slug: ${state.slug}
Exposure Mode: ${state.exposureMode ?? "UNSET"}${repairBanner}

🚫 ISOLATION: Only use "ext_maker_" tools in this workflow.
${stopRule}

References:
- SKILL: ${skillPath}
- Black Box: ${refBlackBox}

INSTRUCTIONS:
${instruction}
`;
}

// ============================================================================
// 4. Extension Entry & Tools
// ============================================================================

export default function (pi: ExtensionAPI) {
  const activeSessions = new Set<string>();

  // Tool: ext_maker_question (Passto-style interaction)
  pi.registerTool({
    name: "ext_maker_question",
    label: "交互式问答",
    description: "向用户提出支持多选的问题，并允许多次自定义输入",
    parameters: Type.Object({
      title: Type.String({ description: "问题标题" }),
      options: Type.Optional(Type.Array(Type.String(), { description: "预设选项列表（默认按多选处理）" })),
      placeholder: Type.Optional(Type.String({ description: "自定义输入占位符" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "UI 不可用" }], details: {} };

      const placeholder = params.placeholder || "请输入您的自定义内容...";
      const presetOptions = (params.options || []).filter(Boolean);
      const selections: string[] = [];

      if (presetOptions.length === 0) {
        const raw = await ctx.ui.input(params.title, `${placeholder}（可输入多项，用 | 分隔）`);
        const values = (raw || "")
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean);

        pi.sendUserMessage(
          `✅ 用户已回答当前问题：${values.join("、") || "无内容"}。请继续当前步骤：吸收该答案并决定是否还需要继续提问；如果当前步骤目标已满足，请调用相应的 ext_maker_next。`,
          { deliverAs: "steer" },
        );

        return {
          content: [{ type: "text", text: `✅ 用户回复: ${values.join("、") || "无内容"}` }],
          details: flowDetails(
            { shouldContinue: true, nextSuggestedAction: "continue-current-step-or-ext_maker_next" },
            { value: values.join("、") || null, values },
          ),
        };
      }

      while (true) {
        const menu = [
          ...presetOptions.map((option) => `${selections.includes(option) ? "☑" : "☐"} ${option}`),
          "✏️ 自定义输入",
          selections.length > 0 ? "✅ 完成选择" : "⏭️ 跳过此题",
        ];

        const choice = await ctx.ui.select(`${params.title}（可多选，重复选择可切换状态）`, menu);
        if (!choice) break;

        if (choice === "✅ 完成选择" || choice === "⏭️ 跳过此题") break;

        if (choice === "✏️ 自定义输入") {
          const raw = await ctx.ui.input(params.title, `${placeholder}（可输入多项，用 | 分隔）`);
          const customValues = (raw || "")
            .split("|")
            .map((item) => item.trim())
            .filter(Boolean);
          for (const value of customValues) {
            if (!selections.includes(value)) selections.push(value);
          }
          continue;
        }

        const option = choice.replace(/^[☑☐]\s+/, "").trim();
        if (!option) continue;

        if (selections.includes(option)) {
          const index = selections.indexOf(option);
          if (index >= 0) selections.splice(index, 1);
        } else {
          selections.push(option);
        }
      }

      const result = selections.join("、");
      pi.sendUserMessage(
        `✅ 用户已回答当前问题：${result || "无内容"}。请继续当前步骤：吸收该答案并决定是否还需要继续提问；如果当前步骤目标已满足，请调用相应的 ext_maker_next。`,
        { deliverAs: "steer" },
      );

      return {
        content: [{ type: "text", text: `✅ 用户回复: ${result || "无内容"}` }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: "continue-current-step-or-ext_maker_next" },
          { value: result || null, values: selections },
        ),
      };
    },
  });

  // Tool: ext_maker_choose_exposure
  pi.registerTool({
    name: "ext_maker_choose_exposure",
    label: "选择暴露方式",
    description: "通过固定三选一 UI 选择扩展在 Pi 中的暴露方式",
    parameters: Type.Object({
      planningDir: Type.String({ description: "规划目录" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "❌ 错误：未找到会话" }], details: {} };
      if (!ctx.hasUI) return { content: [{ type: "text", text: "❌ UI 不可用" }], details: {} };

      const options = [
        "仅 /命令 触发（command-only）",
        "仅暴露给 LLM 自动发现调用（tool-only）",
        "两者并存：/命令 + LLM 工具（both）",
      ];
      const choice = await ctx.ui.select("请选择该扩展在 Pi 中的暴露方式", options);
      if (!choice) {
        return { content: [{ type: "text", text: "已取消暴露方式选择。" }], details: { cancelled: true } };
      }

      let mode: MakerState["exposureMode"];
      if (choice === options[0]) mode = "command-only";
      else if (choice === options[1]) mode = "tool-only";
      else mode = "both";

      state.exposureMode = mode;
      saveState(state);

      pi.sendUserMessage(
        `✅ 暴露方式已设置为 ${mode}。现在继续完成 Step 1：如果需求仍不清晰，继续提问澄清；如果需求已足够清晰，请立即调用 ext_maker_next(planningDir=\"${params.planningDir}\", stepSummary=\"暴露方式已确认：${mode}\") 进入下一步。`,
        { deliverAs: "steer" },
      );

      return {
        content: [{ type: "text", text: `✅ 已设置暴露方式: ${mode}` }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: "continue-step-1-or-ext_maker_next" },
          { exposureMode: mode },
        ),
      };
    },
  });

  // Tool: ext_maker_set_exposure
  pi.registerTool({
    name: "ext_maker_set_exposure",
    label: "设置暴露方式",
    description: "设置扩展在 Pi 中的暴露方式：仅命令、仅工具、或两者并存",
    parameters: Type.Object({
      planningDir: Type.String({ description: "规划目录" }),
      mode: Type.String({ description: "command-only | tool-only | both" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "❌ 错误：未找到会话" }], details: {} };
      if (!["command-only", "tool-only", "both"].includes(params.mode)) {
        return { content: [{ type: "text", text: "❌ 非法模式，仅支持 command-only / tool-only / both" }], details: {} };
      }
      state.exposureMode = params.mode as MakerState["exposureMode"];
      saveState(state);

      pi.sendUserMessage(
        `✅ 暴露方式已设置为 ${state.exposureMode}。请继续当前步骤：如果需求仍不清晰，继续澄清；如果已经满足 Step 1 目标，请立即调用 ext_maker_next(planningDir=\"${params.planningDir}\", stepSummary=\"暴露方式已确认：${state.exposureMode}\")。`,
        { deliverAs: "steer" },
      );

      return {
        content: [{ type: "text", text: `✅ 已设置暴露方式: ${state.exposureMode}` }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: "continue-step-1-or-ext_maker_next" },
          { exposureMode: state.exposureMode },
        ),
      };
    },
  });

  // Tool: ext_maker_write_artifact
  pi.registerTool({
    name: "ext_maker_write_artifact",
    label: "写入工作流产物",
    description: "在 extension-maker 工作流中写入 spec / implementation-method / review 等文件",
    parameters: Type.Object({
      path: Type.String({ description: "目标文件路径" }),
      content: Type.String({ description: "文件内容" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      try {
        fs.mkdirSync(path.dirname(params.path), { recursive: true });
        const isImplementationMethod = path.basename(params.path) === "implementation-method.json";
        const finalContent = isImplementationMethod
          ? sanitizeImplementationMethodContent(params.content)
          : params.content;
        fs.writeFileSync(params.path, finalContent, "utf-8");
        return {
          content: [{ type: "text", text: `✅ 已写入文件: ${params.path}${isImplementationMethod ? "（已执行 implementation-method 清洗）" : ""}` }],
          details: flowDetails(
            { shouldContinue: true, nextSuggestedAction: "continue-current-step-or-ext_maker_next" },
            { path: params.path, sanitizedImplementationMethod: isImplementationMethod },
          ),
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `❌ 写入失败: ${params.path}\n${error instanceof Error ? error.message : String(error)}` }],
          details: flowDetails(
            { shouldContinue: false, nextSuggestedAction: "fix-artifact-write" },
            { path: params.path, error: error instanceof Error ? error.message : String(error) },
          ),
        };
      }
    },
  });

  // Tool: ext_maker_analyze
  pi.registerTool({
    name: "ext_maker_analyze",
    label: "黑盒分析目标",
    description: "分析目标文件",
    parameters: Type.Object({
      target: Type.String({ description: "路径" }),
      type: Type.String({ description: "类型: description 或 file" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      let content = "";
      if (params.type === "file") {
        if (!fs.existsSync(params.target)) return { content: [{ type: "text", text: "❌ 文件不存在" }], details: {} };
        content = fs.readFileSync(params.target, "utf-8");
      } else {
        content = `需求: ${params.target}`;
      }
      return {
        content: [{ type: "text", text: `✅ 目标已加载:\n${content.slice(0, 2000)}` }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: "continue-current-step" },
          { target: params.target },
        ),
      };
    },
  });

  // Command
  pi.registerCommand("extension-maker", {
    description: "启动 Extension 生成器",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;
      const idea = args.trim();
      if (!idea) {
        ctx.ui.notify("用法：/extension-maker <想法>", "warning");
        return;
      }
      
      const initialSlug = sanitize(idea);
      const baseDir = getStableBaseDir();
      const slug = resolveUniqueSlug(baseDir, initialSlug);
      const planningDir = path.join(baseDir, slug);
      const targetDir = path.join(baseDir, "generated", slug);

      const existing = loadState(planningDir);
      if (existing && existing.currentStep < TOTAL_STEPS) {
        ctx.ui.notify("恢复会话...", "info");
        const state = { ...existing, targetDir, slug, userIdea: idea };
        saveState(state);
        activeSessions.add(planningDir);
        updateUI(ctx, state);
        pi.sendUserMessage(buildPrompt(state, state.currentStep), { deliverAs: "steer" });
        return;
      }

      const state: MakerState = {
        userIdea: idea,
        planningDir,
        targetDir,
        slug,
        exposureMode: undefined,
        reviewExecuted: false,
        currentStep: 1,
        startedAt: new Date().toISOString(),
      };
      
      fs.mkdirSync(targetDir, { recursive: true });
      saveState(state);
      activeSessions.add(planningDir);
      updateUI(ctx, state);
      
      if (slug !== initialSlug) {
        ctx.ui.notify(`检测到 slug 冲突，已自动调整为: ${slug}`, "warning");
      }
      ctx.ui.notify(`🛠️ 生成器启动: ${slug}`, "info");
      pi.sendUserMessage(buildPrompt(state, 1), { deliverAs: "steer" });
    },
  });

  // Tool: ext_maker_next
  pi.registerTool({
    name: "ext_maker_next",
    label: "下一步",
    description: "推进生成器",
    parameters: Type.Object({
      planningDir: Type.String({ description: "规划目录" }),
      stepSummary: Type.Optional(Type.String({ description: "上一步摘要" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "❌ 错误：未找到会话" }], details: {} };
      
      if (state.currentStep >= TOTAL_STEPS) {
        return {
          content: [{ type: "text", text: "✅ 完成" }],
          details: flowDetails({ done: true, shouldContinue: false, nextSuggestedAction: "none" }),
        };
      }

      // Hard gate: exposure mode must be chosen before entering Step 2+
      if (state.currentStep === 1 && !state.exposureMode) {
        return {
          content: [{
            type: "text",
            text: "⛔ 不能进入下一步：尚未选择扩展暴露方式。请先调用 ext_maker_choose_exposure(planningDir) 完成固定三选一。",
          }],
          details: flowDetails({ blocked: true, reason: "exposureMode-unset", shouldContinue: false, nextSuggestedAction: "ext_maker_choose_exposure" }),
        };
      }

      // Hard gate: Step 2 must produce a valid spec before entering Step 3
      if (state.currentStep === 2) {
        const specPath = path.join(state.targetDir, "extension-generator-spec.json");
        if (!fs.existsSync(specPath)) {
          return {
            content: [{
              type: "text",
              text: `⛔ 不能进入规格审计步骤：缺少 spec 文件 ${specPath}`,
            }],
            details: flowDetails(
              { blocked: true, reason: "spec-missing", shouldContinue: false, nextSuggestedAction: "write-spec-json" },
              { specPath },
            ),
          };
        }

        try {
          const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
          const specSlug = String(spec?.slug ?? "");
          const specExposureMode = String(spec?.exposureMode ?? "");

          if (specSlug !== state.slug) {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入规格审计步骤：spec.slug 与当前会话 slug 不一致（spec: ${specSlug || "<empty>"}, state: ${state.slug}）。`,
              }],
              details: flowDetails(
                { blocked: true, reason: "spec-slug-mismatch", shouldContinue: false, nextSuggestedAction: "fix-spec-slug" },
                { specPath, specSlug, stateSlug: state.slug },
              ),
            };
          }

          if (specExposureMode !== String(state.exposureMode ?? "")) {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入规格审计步骤：spec.exposureMode 与当前状态不一致（spec: ${specExposureMode || "<empty>"}, state: ${state.exposureMode ?? "UNSET"}）。`,
              }],
              details: flowDetails(
                { blocked: true, reason: "spec-exposure-mismatch", shouldContinue: false, nextSuggestedAction: "fix-spec-exposure-mode" },
                { specPath, specExposureMode, stateExposureMode: state.exposureMode ?? null },
              ),
            };
          }
        } catch {
          return {
            content: [{
              type: "text",
              text: `⛔ 不能进入规格审计步骤：spec 文件无法解析。请先修复 ${specPath}`,
            }],
            details: flowDetails(
              { blocked: true, reason: "spec-invalid", shouldContinue: false, nextSuggestedAction: "fix-spec-json" },
              { specPath },
            ),
          };
        }

        // Hard gate: Step 2 spec MUST include requirementCategory for workflow/system requirements
        try {
          const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
          const category = String(spec?.requirementCategory ?? "");
          const tier = String(spec?.complexityTier ?? "");

          // Gate: ALL specs MUST declare a requirementCategory
          const validCategories = ["simple-tool", "provider-wrapper", "stateful-workflow", "recursive-research-engine", "multi-agent-orchestrator"];
          if (!validCategories.includes(category)) {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入规格审计步骤：spec 缺少 requirementCategory 或值无效（当前: "${category || "<empty>"}"）。必须在 5 类中选择：simple-tool, provider-wrapper, stateful-workflow, recursive-research-engine, multi-agent-orchestrator。`,
              }],
              details: flowDetails(
                { blocked: true, reason: "spec-missing-requirementCategory", shouldContinue: false, nextSuggestedAction: "add-requirement-category" },
                { specPath, category, validCategories },
              ),
            };
          }

          const inferred = inferMinimumRequirementCategory(state.userIdea);
          if (categoryRank(category) < categoryRank(inferred.minimumCategory)) {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入规格审计步骤：spec.requirementCategory 低估了原始需求复杂度（spec: ${category}，最低应为: ${inferred.minimumCategory}）。触发信号: ${inferred.matchedSignals.join(", ") || "<none>"}。请根据原始需求提升类别，避免将系统型需求降级实现。`,
              }],
              details: flowDetails(
                { blocked: true, reason: "spec-category-underrated", shouldContinue: false, nextSuggestedAction: "raise-requirement-category" },
                { specPath, category, inferredMinimumCategory: inferred.minimumCategory, matchedSignals: inferred.matchedSignals, userIdea: state.userIdea },
              ),
            };
          }

          // Determine if this is a workflow/system category that requires extra fields
          const workflowCategories = ["stateful-workflow", "recursive-research-engine", "multi-agent-orchestrator"];
          const systemCategories = ["recursive-research-engine", "multi-agent-orchestrator"];

          if (workflowCategories.includes(category)) {
            const missingFields: string[] = [];
            if (!spec.orchestrationRequirements) missingFields.push("orchestrationRequirements");
            if (!Array.isArray(spec.mandatoryBehaviors) || spec.mandatoryBehaviors.length === 0) missingFields.push("mandatoryBehaviors (must be non-empty array)");
            if (!spec.terminationCriteria) missingFields.push("terminationCriteria");

            if (missingFields.length > 0) {
              return {
                content: [{
                  type: "text",
                  text: `⛔ 不能进入规格审计步骤：spec 声明的类别为 "${category}"（complexityTier: "${tier}"），但缺少必需字段:\n${missingFields.map(f => `  - ${f}`).join("\n")}\n\n对于 ${category} 类别，spec 必须包含 orchestrationRequirements, mandatoryBehaviors, 和 terminationCriteria。`,
                }],
                details: flowDetails(
                  { blocked: true, reason: "spec-missing-workflow-fields", shouldContinue: false, nextSuggestedAction: "add-workflow-spec-fields" },
                  { specPath, category, tier, missingFields },
                ),
              };
            }
          }

          if (systemCategories.includes(category)) {
            const missingFields: string[] = [];
            if (!spec.knowledgeModel) missingFields.push("knowledgeModel");
            if (!spec.roundControl) missingFields.push("roundControl");
            if (!spec.multiRoundLoop) missingFields.push("multiRoundLoop");

            if (missingFields.length > 0) {
              return {
                content: [{
                  type: "text",
                  text: `⛔ 不能进入规格审计步骤：spec 声明的类别为 "${category}"（complexityTier: "${tier}"），但缺少系统级必需字段:\n${missingFields.map(f => `  - ${f}`).join("\n")}\n\n对于 ${category} 类别，spec 必须额外包含 knowledgeModel, roundControl, 和 multiRoundLoop。`,
                }],
                details: flowDetails(
                  { blocked: true, reason: "spec-missing-system-fields", shouldContinue: false, nextSuggestedAction: "add-system-spec-fields" },
                  { specPath, category, tier, missingFields },
                ),
              };
            }
          }
        } catch {
          // Already handled above; this is a fallback
        }
      }

      // Hard gate: Step 4 must produce implementation-method.json and index.ts before entering Step 5
      if (state.currentStep === 4) {
        const implementationMethodPath = path.join(state.targetDir, "implementation-method.json");
        const indexPath = path.join(state.targetDir, "index.ts");
        const missing = [implementationMethodPath, indexPath].filter((p) => !fs.existsSync(p));
        if (missing.length > 0) {
          return {
            content: [{
              type: "text",
              text: `⛔ 不能进入文档步骤：Step 4 尚未产出必需文件:\n${missing.join("\n")}`,
            }],
            details: flowDetails(
              { blocked: true, reason: "codegen-artifacts-missing", shouldContinue: false, nextSuggestedAction: "write-implementation-method-and-run-codegen-subagent" },
              { missing, implementationMethodPath, indexPath },
            ),
          };
        }

        // Hard gate: Step 4 implementation-method MUST include workflow/system fields
        if (fs.existsSync(implementationMethodPath)) {
          try {
            const method = JSON.parse(fs.readFileSync(implementationMethodPath, "utf-8"));
            const specPath = path.join(state.targetDir, "extension-generator-spec.json");
            let category = "";
            if (fs.existsSync(specPath)) {
              const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
              category = String(spec?.requirementCategory ?? "");
            }

            const workflowCategories = ["stateful-workflow", "recursive-research-engine", "multi-agent-orchestrator"];
            const systemCategories = ["recursive-research-engine", "multi-agent-orchestrator"];

            if (workflowCategories.includes(category)) {
              const missingFields: string[] = [];
              if (!method.orchestratorDesign) missingFields.push("orchestratorDesign");
              if (!method.behaviorContract) missingFields.push("behaviorContract");

              if (missingFields.length > 0) {
                return {
                  content: [{
                    type: "text",
                    text: `⛔ 不能进入文档步骤：implementation-method.json 声明的类别为 "${category}"，但缺少必需字段:\n${missingFields.map(f => `  - ${f}`).join("\n")}`,
                  }],
                  details: flowDetails(
                    { blocked: true, reason: "method-missing-workflow-fields", shouldContinue: false, nextSuggestedAction: "add-workflow-method-fields" },
                    { implementationMethodPath, category, missingFields },
                  ),
                };
              }
            }

            if (systemCategories.includes(category)) {
              const missingFields: string[] = [];
              if (!method.loopDesign) missingFields.push("loopDesign");
              if (!method.knowledgeStructure) missingFields.push("knowledgeStructure");
              if (!method.sufficiencyLogic) missingFields.push("sufficiencyLogic");

              if (missingFields.length > 0) {
                return {
                  content: [{
                    type: "text",
                    text: `⛔ 不能进入文档步骤：implementation-method.json 声明的类别为 "${category}"，但缺少系统级必需字段:\n${missingFields.map(f => `  - ${f}`).join("\n")}`,
                  }],
                  details: flowDetails(
                    { blocked: true, reason: "method-missing-system-fields", shouldContinue: false, nextSuggestedAction: "add-system-method-fields" },
                    { implementationMethodPath, category, missingFields },
                  ),
                };
              }
            }
          } catch {
            // If we can't parse, file existence check above already caught it
          }
        }
      }

      // Hard gate: Step 5 must produce docs artifacts before entering Step 6
      if (state.currentStep === 5) {
        const skillPath = path.join(state.targetDir, "SKILL.md");
        const referencesDir = path.join(state.targetDir, "references");
        const requiredReferenceFiles = [
          path.join(referencesDir, "codegen-mapping.md"),
          path.join(referencesDir, "review-rules.md"),
        ];

        const missing: string[] = [];
        if (!fs.existsSync(skillPath)) missing.push(skillPath);
        if (!fs.existsSync(referencesDir)) missing.push(referencesDir);
        for (const refFile of requiredReferenceFiles) {
          if (!fs.existsSync(refFile)) missing.push(refFile);
        }

        if (missing.length > 0) {
          return {
            content: [{
              type: "text",
              text: `⛔ 不能进入审查步骤：Step 5 尚未产出必需文档:\n${missing.join("\n")}`,
            }],
            details: flowDetails(
              { blocked: true, reason: "docs-artifacts-missing", shouldContinue: false, nextSuggestedAction: "write-skill-and-references" },
              { missing, skillPath, referencesDir, requiredReferenceFiles },
            ),
          };
        }
      }

      // Step 6 isolated review must be executed before final delivery review is expected
      if (state.currentStep === 6 && !state.reviewExecuted) {
        return {
          content: [{
            type: "text",
            text: "⛔ 不能进入交付步骤：尚未先调用 ext_maker_review_with_subagent 执行隔离审查。请先运行 review tool 生成 review.json。",
          }],
          details: flowDetails({ blocked: true, reason: "review-not-executed", shouldContinue: false, nextSuggestedAction: "ext_maker_review_with_subagent" }),
        };
      }

      // Final closure: delivery depends on review.json, not on the request alone
      if (state.currentStep === 6) {
        const reviewPath = path.join(state.targetDir, "review.json");
        if (!fs.existsSync(reviewPath)) {
          return {
            content: [{
              type: "text",
              text: `⛔ 不能进入交付步骤：缺少 review.json。请先完成隔离审查并写入 ${reviewPath}`,
            }],
            details: flowDetails(
              { blocked: true, reason: "review-json-missing", shouldContinue: false, nextSuggestedAction: "write-review-json" },
              { reviewPath },
            ),
          };
        }

        try {
          const review = JSON.parse(fs.readFileSync(reviewPath, "utf-8"));
          const requiredFields = [
            "derivedImplementationModel",
            "implementationContractCheck",
            "checks",
            "findings",
            "reviewedBySubagent",
            "subagentMode",
          ];
          const missingFields = requiredFields.filter((key) => review?.[key] === undefined);
          if (missingFields.length > 0) {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入交付步骤：review.json 缺少必需字段: ${missingFields.join(", ")}`,
              }],
              details: flowDetails(
                { blocked: true, reason: "review-schema-invalid", shouldContinue: false, nextSuggestedAction: "write-complete-review-json" },
                { reviewPath, missingFields, requiredFields },
              ),
            };
          }

          if (review?.reviewedBySubagent !== true) {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入交付步骤：review.json 必须明确标记 reviewedBySubagent=true。`,
              }],
              details: flowDetails(
                { blocked: true, reason: "review-not-from-subagent", shouldContinue: false, nextSuggestedAction: "rerun-subagent-review" },
                { reviewPath, reviewedBySubagent: review?.reviewedBySubagent ?? null },
              ),
            };
          }

          const subagentMode = String(review?.subagentMode ?? "").toLowerCase();
          if (subagentMode !== "spawn") {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入交付步骤：review.json 必须声明 subagentMode=spawn（当前: ${review?.subagentMode ?? "unknown"}）。`,
              }],
              details: flowDetails(
                { blocked: true, reason: "review-subagent-mode-invalid", shouldContinue: false, nextSuggestedAction: "rerun-subagent-review" },
                { reviewPath, subagentMode: review?.subagentMode ?? null },
              ),
            };
          }

          const verdict = String(review?.verdict ?? "").toLowerCase();
          if (verdict !== "pass") {
            return {
              content: [{
                type: "text",
                text: `⛔ 不能进入交付步骤：review.json verdict 不是 pass（当前: ${review?.verdict ?? "unknown"}）。请先修复问题。`,
              }],
              details: flowDetails(
                { blocked: true, reason: "review-not-pass", shouldContinue: false, nextSuggestedAction: "ext_maker_apply_review_feedback" },
                { verdict: review?.verdict ?? null, reviewPath },
              ),
            };
          }
        } catch {
          return {
            content: [{
              type: "text",
              text: `⛔ 不能进入交付步骤：review.json 无法解析。请先修复审查结果文件。`,
            }],
            details: flowDetails(
              { blocked: true, reason: "review-json-invalid", shouldContinue: false, nextSuggestedAction: "fix-review-json" },
              { reviewPath },
            ),
          };
        }
      }
      
      state.currentStep += 1;
      saveState(state);
      updateUI(ctx, state);
      
      // Send new prompt
      pi.sendUserMessage(`✅ Step ${state.currentStep-1} Done: ${params.stepSummary || "OK"}\n\n${buildPrompt(state, state.currentStep)}`, { deliverAs: "steer" });
      return {
        content: [{ type: "text", text: `已推进到第 ${state.currentStep} 步。` }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: "follow-current-step-prompt" },
          { currentStep: state.currentStep },
        ),
      };
    },
  });

  // Tool: ext_maker_read_docs
  pi.registerTool({
    name: "ext_maker_read_docs",
    label: "读取官方文档",
    description: "读取 Pi 官方 extensions 和 TUI 文档",
    parameters: Type.Object({
      topic: Type.String({ description: "主题: extensions 或 tui" }),
    }),
    async execute(_id, params, _signal, _onUpdate, _ctx) {
      const docsDir = "/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs";
      let file = params.topic === "tui" ? "tui.md" : params.topic === "extensions" ? "extensions.md" : "";
      if (!file) return { content: [{ type: "text", text: "❌ 未知主题" }], details: flowDetails({ shouldContinue: false, nextSuggestedAction: "provide-valid-topic" }) };

      const fullPath = path.join(docsDir, file);
      if (!fs.existsSync(fullPath)) return { content: [{ type: "text", text: `❌ 未找到文档` }], details: flowDetails({ shouldContinue: false, nextSuggestedAction: "check-docs-installation" }) };
      
      const content = fs.readFileSync(fullPath, "utf-8");
      return {
        content: [{ type: "text", text: content.slice(0, 20000) }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: "continue-current-step" },
          { file: fullPath },
        ),
      };
    },
  });

  // Tool: ext_maker_codegen_with_subagent
  pi.registerTool({
    name: "ext_maker_codegen_with_subagent",
    label: "通过隔离子进程执行代码开发",
    description: "通过 passto-agent-runtime 启动 coder subagent，并使用 Ralph-style 迭代方式实现核心代码",
    parameters: Type.Object({
      planningDir: Type.String({ description: "规划目录" }),
      targetDir: Type.String({ description: "目标目录" }),
      specPath: Type.String({ description: "spec 文件路径" }),
      implementationMethodPath: Type.String({ description: "implementation-method.json 路径" }),
      reviewPath: Type.Optional(Type.String({ description: "review.json 路径（repair mode 时提供）" })),
      repairMode: Type.Optional(Type.Boolean({ description: "是否为 review 驱动的返工修复模式" })),
    }),
    async execute(_id, params, signal, onUpdate, _ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "❌ 错误：未找到会话" }], details: {} };

      const requiredFiles = [params.specPath, params.implementationMethodPath];
      const missing = requiredFiles.filter((p) => !fs.existsSync(p));
      if (missing.length > 0) {
        return {
          content: [{ type: "text", text: `❌ 无法启动隔离 codegen，缺少文件:\n${missing.join("\n")}` }],
          details: flowDetails(
            { shouldContinue: false, nextSuggestedAction: "create-missing-codegen-inputs" },
            { missing },
          ),
        };
      }

      const specText = fs.readFileSync(params.specPath, "utf-8");
      const implementationMethodText = fs.readFileSync(params.implementationMethodPath, "utf-8");
      const spec = JSON.parse(specText);
      const category = String(spec?.requirementCategory ?? "");
      const mandatoryBehaviors = Array.isArray(spec?.mandatoryBehaviors) ? spec.mandatoryBehaviors : [];
      const repairMode = Boolean(params.repairMode);
      const repairContext = repairMode && params.reviewPath
        ? {
            reviewPath: params.reviewPath,
            ...loadRepairContextFromReviewPath(params.reviewPath),
          }
        : undefined;

      const ralphDir = path.join(params.targetDir, ".ralph");
      fs.mkdirSync(ralphDir, { recursive: true });

      const taskFilePath = path.join(ralphDir, `codegen-${state.slug}.md`);
      const taskContent = buildRalphCodegenTask({
        slug: state.slug,
        targetDir: params.targetDir,
        specText,
        implementationMethodText,
        category,
        mandatoryBehaviors,
        repairContext,
      });
      fs.writeFileSync(taskFilePath, taskContent, "utf-8");

      const prompt = buildCodegenSubagentPrompt({
        targetDir: params.targetDir,
        specText,
        implementationMethodText,
        taskFilePath,
        repairMode,
        repairContext,
      });

      try {
        const result = await runSubagent(
          {
            agent: "coder",
            prompt,
            cwd: params.targetDir,
            sessionMode: "spawn",
            tools: ["read", "bash", "edit", "write"],
            noSession: true,
            noContextFiles: true,
            offline: true,
            timeoutMs: 900_000,
            maxDepth: 1,
            preventCycles: true,
          },
          {
            onProgress(progress) {
              onUpdate?.(renderProgressUpdate(progress));
            },
          },
          signal,
        );

        const indexPath = path.join(params.targetDir, "index.ts");
        if (!fs.existsSync(indexPath)) {
          return {
            content: [{ type: "text", text: "❌ 隔离 codegen 运行结束，但未生成 index.ts" }],
            details: flowDetails(
              { shouldContinue: false, nextSuggestedAction: "inspect-codegen-subagent-output" },
              {
                codegenExecuted: true,
                targetDir: params.targetDir,
                taskFilePath,
                runId: result.runId,
                finalOutputText: result.finalOutputText,
              },
            ),
          };
        }

        const runInfoPath = path.join(params.targetDir, "codegen-run.json");
        fs.writeFileSync(
          runInfoPath,
          `${JSON.stringify({
            generatedBySubagent: true,
            agent: "coder",
            sessionMode: "spawn",
            repairMode,
            reviewPath: params.reviewPath ?? null,
            runId: result.runId,
            success: result.success,
            exitCode: result.exitCode,
            stopReason: result.stopReason,
            generatedFiles: ["index.ts"],
            taskFilePath,
            finishedAt: new Date().toISOString(),
          }, null, 2)}\n`,
          "utf-8",
        );

        const finalRendered = renderFinalResult({ ...result, finalOutputText: `✅ 已通过 coder subagent 完成核心代码生成，并写入 ${indexPath}` });
        return {
          content: finalRendered.content,
          details: flowDetails(
            { shouldContinue: true, nextSuggestedAction: "ext_maker_next" },
            {
              ...finalRendered.details,
              codegenExecuted: true,
              repairMode,
              repairedFromReview: repairMode,
              reviewPath: params.reviewPath ?? null,
              targetDir: params.targetDir,
              generatedFiles: ["index.ts"],
              taskFilePath,
              runInfoPath,
              runId: result.runId,
            },
          ),
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ 隔离 codegen 执行失败：${error instanceof Error ? error.message : String(error)}`,
          }],
          details: flowDetails(
            { shouldContinue: false, nextSuggestedAction: "fix-codegen-subagent-or-inputs" },
            {
              codegenExecuted: false,
              targetDir: params.targetDir,
              taskFilePath,
              error: error instanceof Error ? error.message : String(error),
            },
          ),
        };
      }
    },
  });

  // Tool: ext_maker_review_with_subagent
  pi.registerTool({
    name: "ext_maker_review_with_subagent",
    label: "通过隔离子进程执行审查",
    description: "通过 passto-agent-runtime 直接启动独立 pi 子进程执行审查，并自动写入 review.json",
    parameters: Type.Object({
      planningDir: Type.String({ description: "规划目录" }),
      targetDir: Type.String({ description: "目标目录" }),
      specPath: Type.String({ description: "spec 文件路径" }),
      implementationMethodPath: Type.String({ description: "implementation-method.json 路径" }),
    }),
    async execute(_id, params, signal, onUpdate, _ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "❌ 错误：未找到会话" }], details: {} };

      const indexPath = path.join(params.targetDir, "index.ts");
      const reviewPath = path.join(params.targetDir, "review.json");
      const reviewRulesPath = path.join(__dirname, "references", "review-rules.md");
      const requiredFiles = [params.specPath, params.implementationMethodPath, indexPath, reviewRulesPath];
      const missing = requiredFiles.filter((p) => !fs.existsSync(p));
      if (missing.length > 0) {
        return {
          content: [{ type: "text", text: `❌ 无法启动隔离 review，缺少文件:\n${missing.join("\n")}` }],
          details: flowDetails(
            { shouldContinue: false, nextSuggestedAction: "create-missing-review-inputs" },
            { missing },
          ),
        };
      }

      const specText = fs.readFileSync(params.specPath, "utf-8");
      const implementationMethodText = fs.readFileSync(params.implementationMethodPath, "utf-8");
      const indexText = fs.readFileSync(indexPath, "utf-8");
      const reviewRulesText = fs.readFileSync(reviewRulesPath, "utf-8");
      const extensionsDocPath = "/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/extensions.md";
      const tuiDocPath = "/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/tui.md";
      const extensionsDocText = fs.existsSync(extensionsDocPath) ? fs.readFileSync(extensionsDocPath, "utf-8") : "";
      const tuiDocText = fs.existsSync(tuiDocPath) ? fs.readFileSync(tuiDocPath, "utf-8") : "";

      const task = buildStrictJsonReviewPrompt({
        reviewRulesText,
        specText,
        implementationMethodText,
        indexText,
        extensionsDocText,
        tuiDocText,
      });

      state.reviewExecuted = true;
      saveState(state);

      try {
        const result = await runSubagent(
          {
            prompt: task,
            cwd: params.targetDir,
            agent: "reviewer",
            sessionMode: "spawn",
            tools: ["read", "bash"],
            noSession: true,
            noContextFiles: true,
            offline: true,
            timeoutMs: 600_000,
            maxDepth: 1,
            preventCycles: true,
          },
          {
            onProgress(progress) {
              onUpdate?.(renderProgressUpdate(progress));
            },
          },
          signal,
        );

        let review: any;
        try {
          review = parseJsonLenient(result.finalOutputText);
        } catch {
          review = buildFailedReview({
            findings: ["Subagent did not return valid JSON."],
            criticalIssues: [result.finalOutputText || result.errorMessage || result.stderr || "Subagent review failed without valid JSON output."],
            suggestedFixes: ["Fix the review prompt or runtime parsing so the isolated reviewer returns strict JSON."],
          });
        }

        review.reviewedBySubagent = true;
        review.subagentMode = "spawn";
        review.verdict = String(review.verdict ?? "fail").toLowerCase() === "pass" ? "pass" : "fail";
        if (review.derivedImplementationModel === undefined || review.derivedImplementationModel === null) {
          review.derivedImplementationModel = {
            status: "missing",
            reason: "reviewer-did-not-provide-derived-implementation-model",
          };
        }
        if (review.implementationContractCheck === undefined || review.implementationContractCheck === null) {
          review.implementationContractCheck = {
            status: "missing",
            reason: "reviewer-did-not-provide-implementation-contract-check",
          };
        }
        if (!Array.isArray(review.checks)) review.checks = [];
        if (!Array.isArray(review.findings)) review.findings = [];
        if (!Array.isArray(review.criticalIssues)) review.criticalIssues = [];
        if (!Array.isArray(review.suggestedFixes)) review.suggestedFixes = [];
        review.provenance = result.provenance;
        review.runtime = {
          runId: result.runId,
          success: result.success,
          exitCode: result.exitCode,
          stopReason: result.stopReason,
          errorMessage: result.errorMessage,
          usage: result.usage,
        };

        fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf-8");

        const finalRendered = renderFinalResult({ ...result, finalOutputText: `✅ 已完成隔离审查并写入 ${reviewPath}` });
        return {
          content: finalRendered.content,
          details: flowDetails(
            { shouldContinue: true, nextSuggestedAction: review.verdict === "pass" ? "ext_maker_next" : "ext_maker_apply_review_feedback" },
            {
              ...finalRendered.details,
              reviewExecuted: true,
              reviewPath,
              verdict: review.verdict,
            },
          ),
        };
      } catch (error) {
        const failedReview = buildFailedReview({
          findings: ["Isolated review runtime failed before producing a valid result."],
          criticalIssues: [error instanceof Error ? error.message : String(error)],
          suggestedFixes: ["Fix the isolated review runtime or child pi invocation, then rerun Step 6."],
          provenance: {
            reviewedBySubagent: true,
            subagentMode: "spawn",
            transport: "pi-cli-json",
            runtimeVersion: "extension-maker-fallback",
          },
          runtime: {
            success: false,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
        });
        fs.writeFileSync(reviewPath, `${JSON.stringify(failedReview, null, 2)}\n`, "utf-8");

        return {
          content: [{ type: "text", text: `❌ 隔离审查执行失败，已写入失败版 review.json: ${error instanceof Error ? error.message : String(error)}` }],
          details: flowDetails(
            { shouldContinue: true, nextSuggestedAction: "ext_maker_apply_review_feedback" },
            { reviewExecuted: true, reviewPath, verdict: "fail", error: error instanceof Error ? error.message : String(error) },
          ),
        };
      }
    },
  });

  // Tool: ext_maker_apply_review_feedback
  pi.registerTool({
    name: "ext_maker_apply_review_feedback",
    label: "应用审查反馈",
    description: "读取 review.json，判断应回退到哪个修复步骤，并继续返工闭环",
    parameters: Type.Object({
      planningDir: Type.String({ description: "规划目录" }),
      targetDir: Type.String({ description: "目标目录" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const state = loadState(params.planningDir);
      if (!state) return { content: [{ type: "text", text: "❌ 错误：未找到会话" }], details: {} };

      const reviewPath = path.join(params.targetDir, "review.json");
      if (!fs.existsSync(reviewPath)) {
        return {
          content: [{ type: "text", text: `❌ 未找到 review.json: ${reviewPath}` }],
          details: flowDetails(
            { shouldContinue: false, nextSuggestedAction: "run-step-6-review-first" },
            { reviewPath },
          ),
        };
      }

      let review: any;
      try {
        review = JSON.parse(fs.readFileSync(reviewPath, "utf-8"));
      } catch {
        return {
          content: [{ type: "text", text: `❌ review.json 无法解析: ${reviewPath}` }],
          details: flowDetails(
            { shouldContinue: false, nextSuggestedAction: "fix-review-json" },
            { reviewPath },
          ),
        };
      }

      const findings = [
        ...(Array.isArray(review?.criticalIssues) ? review.criticalIssues : []),
        ...(Array.isArray(review?.findings) ? review.findings : []),
        ...(Array.isArray(review?.suggestedFixes) ? review.suggestedFixes : []),
      ]
        .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
        .join("\n")
        .toLowerCase();

      const docsHints = ["skill.md", "references/", "documentation", "docs", "review-rules", "codegen-mapping"];
      const codeHints = ["index.ts", "registercommand", "registertool", "ctx.ui", "signal", "state", "logic", "implementation-method"];

      const needsDocs = docsHints.some((hint) => findings.includes(hint));
      const needsCode = codeHints.some((hint) => findings.includes(hint));

      let rollbackStep = 4;
      if (!needsCode && needsDocs) rollbackStep = 5;
      else rollbackStep = 4;

      state.currentStep = rollbackStep;
      saveState(state);
      updateUI(ctx, state);

      const repairContext = `来源: Step 6 review 未通过；review.json=${reviewPath}；回退目标=Step ${rollbackStep}；needsCode=${needsCode}；needsDocs=${needsDocs}`;
      const codegenRepairHint = rollbackStep === 4
        ? `\n\n🔧 CODE REPAIR PATH: 这是代码返工回合。请不要盲目重新生成。必须把 ${reviewPath} 作为修复输入，并优先调用 ext_maker_codegen_with_subagent(planningDir="${params.planningDir}", targetDir="${params.targetDir}", specPath="${path.join(params.targetDir, "extension-generator-spec.json")}", implementationMethodPath="${path.join(params.targetDir, "implementation-method.json")}", reviewPath="${reviewPath}", repairMode=true) 进行定向返工。`
        : "";

      pi.sendUserMessage(
        `⚠️ Review 未通过。当前进入的是“返工修复”流程，不是首次 Step ${rollbackStep}。请先读取 ${reviewPath}，根据 criticalIssues / findings / suggestedFixes 修复问题。修复完成后继续工作流，并在合适时重新执行 Step 6 review。${codegenRepairHint}\n\n${buildPrompt(state, rollbackStep, { repairContext })}`,
        { deliverAs: "steer" },
      );

      return {
        content: [{ type: "text", text: `✅ 已根据 review.json 回退到 Step ${rollbackStep} 进行修复。` }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: rollbackStep === 4 ? "ext_maker_codegen_with_subagent(repairMode=true)" : "fix-docs-then-rerun-review" },
          { reviewPath, rollbackStep, needsCode, needsDocs, repairMode: rollbackStep === 4 },
        ),
      };
    },
  });

  // Tool: ext_maker_review_gate
  pi.registerTool({
    name: "ext_maker_review_gate",
    label: "审阅交付结果",
    description: "请求最终确认",
    parameters: Type.Object({
      title: Type.String({ description: "标题" }),
      message: Type.String({ description: "摘要" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!ctx.hasUI) return { content: [{ type: "text", text: "UI 不可用" }], details: {} };
      const choice = await ctx.ui.select(params.title, ["✅ 确认通过 (Pass)", "⚠️ 我要修改 (Modify)"]);
      const confirmed = choice?.includes("Pass");

      pi.sendUserMessage(
        confirmed
          ? "✅ 用户已确认交付结果。请立即调用 ext_maker_done 完成会话。"
          : "⚠️ 用户要求修改。请返回前面步骤修复问题，不要结束会话。",
        { deliverAs: "steer" },
      );

      return {
        content: [{ type: "text", text: confirmed ? "用户已确认。" : "用户要求修改。" }],
        details: flowDetails(
          { shouldContinue: true, nextSuggestedAction: confirmed ? "ext_maker_done" : "return-to-fix-step" },
          { confirmed },
        ),
      };
    },
  });

  // Tool: ext_maker_done
  pi.registerTool({
    name: "ext_maker_done",
    label: "完成",
    description: "清理状态",
    parameters: Type.Object({
      planningDir: Type.String({ description: "规划目录" }),
      targetDir: Type.String({ description: "目标目录" }),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      removeState(params.planningDir);
      updateUI(ctx, null);
      return {
        content: [{ type: "text", text: `🎉 完成！\n路径: ${params.targetDir}` }],
        details: flowDetails(
          { done: true, shouldContinue: false, nextSuggestedAction: "none" },
          { targetDir: params.targetDir },
        ),
      };
    },
  });
}
