import fs from "node:fs";
import crypto from "node:crypto";
import { analyzePasstoAgentDraft } from "./analysis.ts";
import { buildPasstoAgentDraftFromText, completePasstoAgentDraftWithUi } from "./interactive.ts";
import { listPasstoAgentStages } from "./stages.ts";
import { readTaskDocForPasstoAgentInput } from "./task-doc-reader.ts";
import { writePasstoAgentTaskDoc } from "./task-doc.ts";
import type { PasstoAgentDraftTask, PasstoAgentFieldResolution, PasstoAgentRequest, PasstoAgentResult, PasstoAgentUiAdapter } from "./types.ts";

function isMarkdownPathInput(input: string): boolean {
  const trimmed = input.trim();
  return trimmed.endsWith(".md") && fs.existsSync(trimmed);
}

async function executePasstoExecutorTaskDoc(taskDocPath: string, agent: string) {
  const { executeTaskDoc } = await import("../../passto-executor/index.ts");
  return executeTaskDoc(taskDocPath, {
    runId: crypto.randomUUID(),
    agent,
  });
}

function isConfirmationSatisfied(request: PasstoAgentRequest) {
  return request.confirm?.cwd === true && request.confirm?.goal === true && request.confirm?.stage === true;
}

function isResolutionForField(fieldResolutions: PasstoAgentFieldResolution[], field: string, source?: PasstoAgentFieldResolution["source"]) {
  return fieldResolutions.some((item) => item.field === field && (source ? item.source === source : true));
}

function renderList(items: string[], indent = "  "): string[] {
  return items.map((item) => `${indent}- ${item}`);
}

function renderInputLabels(inputs: PasstoAgentDraftTask["inputs"]): string[] {
  return inputs.map((item) => item.label ?? item.path ?? item.kind);
}

function renderPreviewSection(title: string, lines: string[]): string[] {
  if (!lines.length) return [];
  return [`## ${title}`, "", ...lines, ""];
}

function renderDraftPreview(draft: PasstoAgentDraftTask, analysis: ReturnType<typeof analyzePasstoAgentDraft>): string {
  const userProvidedLines: string[] = [];
  const inferredLines: string[] = [];

  if (draft.cwd && isResolutionForField(analysis.fieldResolutions, "cwd", "provided")) {
    userProvidedLines.push(`- cwd: ${draft.cwd}`);
  }
  if (draft.goal?.trim() && isResolutionForField(analysis.fieldResolutions, "goal", "provided")) {
    userProvidedLines.push("- goal:");
    userProvidedLines.push(...draft.goal.trim().split(/\r?\n/).map((line) => `  ${line}`));
  }
  if (draft.stage && isResolutionForField(analysis.fieldResolutions, "stage", "provided")) {
    userProvidedLines.push(`- stage: ${draft.stage}`);
  }
  if (draft.constraints.length && isResolutionForField(analysis.fieldResolutions, "constraints", "provided")) {
    userProvidedLines.push("- constraints:");
    userProvidedLines.push(...renderList(draft.constraints, "  "));
  }

  if (draft.executorType && isResolutionForField(analysis.fieldResolutions, "executor.type", "inferred")) {
    inferredLines.push(`- executor.type: ${draft.executorType}`);
  }
  if (draft.preferredRole && isResolutionForField(analysis.fieldResolutions, "hints.preferred_role", "inferred")) {
    inferredLines.push(`- hints.preferred_role: ${draft.preferredRole}`);
  }
  if (draft.preferredThinking) {
    inferredLines.push(`- hints.preferred_thinking: ${draft.preferredThinking}`);
  }
  if (draft.inputs.length && isResolutionForField(analysis.fieldResolutions, "inputs", "inferred")) {
    inferredLines.push("- inputs:");
    inferredLines.push(...renderList(renderInputLabels(draft.inputs), "  "));
  }

  if (!userProvidedLines.length && !inferredLines.length) {
    return "No previewable fields.";
  }

  return [
    "This preview separates explicit user input from non-blocking inferred fields.",
    "Only critical required fields need confirmation.",
    "",
    ...renderPreviewSection("User-provided", userProvidedLines),
    ...renderPreviewSection("Inferred optional fields", inferredLines),
    "Inferred optional fields do not block execution and do not require confirmation.",
  ].join("\n").trim();
}

async function showOptionalPreviewIfAvailable(ui: PasstoAgentUiAdapter, draft: PasstoAgentDraftTask, analysis: ReturnType<typeof analyzePasstoAgentDraft>) {
  await ui.preview?.({
    title: "Task preview",
    message: renderDraftPreview(draft, analysis),
  });
}

export async function runPasstoAgent(request: PasstoAgentRequest): Promise<PasstoAgentResult> {
  const cwd = request.cwd ?? process.cwd();

  if (isMarkdownPathInput(request.input)) {
    const parsed = readTaskDocForPasstoAgentInput(request.input.trim());
    const analysis = analyzePasstoAgentDraft({
      stage: parsed.frontmatter.stage,
      cwd: parsed.frontmatter.project.cwd,
      goal: parsed.body,
      taskTitle: parsed.body.split(/\r?\n/)[0]?.trim(),
      executorType: undefined,
      constraints: [],
      todolist: ["Use the provided markdown task-doc"],
      checklist: ["Respect the provided task-doc content"],
      inputs: parsed.frontmatter.inputs ?? [{ kind: "file", path: parsed.sourcePath, label: "task-doc", required: true }],
      preferredRole: parsed.frontmatter.hints?.preferredRole ?? parsed.frontmatter.stage,
    });
    const shouldExecute = request.execute !== false && analysis.missingFields.length === 0 && isConfirmationSatisfied(request);

    if (shouldExecute) {
      await executePasstoExecutorTaskDoc(request.input.trim(), parsed.frontmatter.hints?.preferredRole ?? parsed.frontmatter.stage);
    }

    return {
      stage: parsed.frontmatter.stage,
      taskDocPath: request.input.trim(),
      executed: shouldExecute,
      needsConfirmation: !isConfirmationSatisfied(request),
      missingFields: analysis.missingFields,
      confirmationRequired: analysis.confirmationRequired.filter((key) => request.confirm?.[key] !== true),
    };
  }

  const draft = await buildPasstoAgentDraftFromText(request.input, cwd);
  const analysis = analyzePasstoAgentDraft(draft);
  const taskDocPath = writePasstoAgentTaskDoc(draft);
  const shouldExecute = request.execute !== false && analysis.missingFields.length === 0 && isConfirmationSatisfied(request);

  if (shouldExecute) {
    await executePasstoExecutorTaskDoc(taskDocPath, draft.preferredRole ?? draft.stage);
  }

  return {
    stage: draft.stage,
    taskDocPath,
    executed: shouldExecute,
    needsConfirmation: !isConfirmationSatisfied(request),
    missingFields: analysis.missingFields,
    confirmationRequired: analysis.confirmationRequired.filter((key) => request.confirm?.[key] !== true),
  };
}

export async function runPasstoAgentWithUi(request: PasstoAgentRequest & { ui: PasstoAgentUiAdapter }): Promise<PasstoAgentResult> {
  const cwd = request.cwd ?? process.cwd();

  if (isMarkdownPathInput(request.input)) {
    const parsed = readTaskDocForPasstoAgentInput(request.input.trim());
    const draft: PasstoAgentDraftTask = {
      stage: parsed.frontmatter.stage,
      cwd: parsed.frontmatter.project.cwd,
      goal: parsed.body,
      taskTitle: parsed.body.split(/\r?\n/)[0]?.trim(),
      executorType: undefined,
      constraints: [],
      todolist: ["Use the provided markdown task-doc"],
      checklist: ["Respect the provided task-doc content"],
      inputs: parsed.frontmatter.inputs ?? [{ kind: "file", path: parsed.sourcePath, label: "task-doc", required: true }],
      preferredRole: parsed.frontmatter.hints?.preferredRole ?? parsed.frontmatter.stage,
    };
    const analysis = analyzePasstoAgentDraft(draft);

    await showOptionalPreviewIfAvailable(request.ui, draft, analysis);

    const confirmedCwd = await request.ui.confirm({ title: "确认 cwd", message: `cwd: ${parsed.frontmatter.project.cwd}` });
    const confirmedGoal = await request.ui.confirm({ title: "确认 goal", message: parsed.body });
    const confirmedStage = await request.ui.confirm({ title: "确认 stage", message: `stage: ${parsed.frontmatter.stage}` });
    const shouldExecute = request.execute !== false && analysis.missingFields.length === 0 && confirmedCwd && confirmedGoal && confirmedStage;

    if (shouldExecute) {
      await executePasstoExecutorTaskDoc(request.input.trim(), parsed.frontmatter.hints?.preferredRole ?? parsed.frontmatter.stage);
    }

    return {
      stage: parsed.frontmatter.stage,
      taskDocPath: request.input.trim(),
      executed: shouldExecute,
      needsConfirmation: !(confirmedCwd && confirmedGoal && confirmedStage),
      missingFields: analysis.missingFields,
      confirmationRequired: [
        ...(confirmedCwd ? [] : ["cwd"]),
        ...(confirmedGoal ? [] : ["goal"]),
        ...(confirmedStage ? [] : ["stage"]),
      ],
    };
  }

  const completedDraft = await completePasstoAgentDraftWithUi(await buildPasstoAgentDraftFromText(request.input, cwd), request.ui);
  const analysis = analyzePasstoAgentDraft(completedDraft);
  await showOptionalPreviewIfAvailable(request.ui, completedDraft, analysis);
  const taskDocPath = writePasstoAgentTaskDoc(completedDraft);
  const shouldExecute = request.execute !== false && analysis.missingFields.length === 0;

  if (shouldExecute) {
    await executePasstoExecutorTaskDoc(taskDocPath, completedDraft.preferredRole ?? completedDraft.stage);
  }

  return {
    stage: completedDraft.stage,
    taskDocPath,
    executed: shouldExecute,
    needsConfirmation: false,
    missingFields: analysis.missingFields,
    confirmationRequired: [],
  };
}

export function listAvailablePasstoAgentStages(): string[] {
  return listPasstoAgentStages().map((stage) => stage.name);
}
