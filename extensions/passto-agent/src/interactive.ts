import path from "node:path";
import { analyzePasstoAgentDraft } from "./analysis.ts";
import { applyPasstoAgentStageDerivedDefaults } from "./inference.ts";
import { listPasstoAgentStages } from "./stages.ts";
import type { PasstoAgentDraftTask, PasstoAgentUiAdapter } from "./types.ts";

function inferStageFromText(input: string): string {
  const text = input.toLowerCase();
  if (/(review|审查|检查|评估)/i.test(text)) return "reviewer";
  if (/(流程|操作|准备|operator)/i.test(text)) return "operator";
  return "builder";
}

function inferTaskTitle(input: string, stage: string): string {
  const compact = input.trim().split(/\r?\n/)[0]?.trim() || `${stage} task`;
  return compact.length > 80 ? compact.slice(0, 80) : compact;
}

function cloneDraftTask(draft: PasstoAgentDraftTask): PasstoAgentDraftTask {
  return {
    ...draft,
    constraints: [...draft.constraints],
    todolist: [...draft.todolist],
    checklist: [...draft.checklist],
    inputs: draft.inputs.map((item) => ({ ...item })),
  };
}

function normalizeList(values: string[]): string[] {
  return values.map((item) => item.trim()).filter(Boolean);
}

function listStageNames(): string[] {
  return listPasstoAgentStages().map((item) => item.name);
}

async function askForMissingField(next: PasstoAgentDraftTask, missingField: string, ui: PasstoAgentUiAdapter): Promise<void> {
  if (missingField === "cwd") {
    next.cwd = await ui.prompt({
      title: "请输入 cwd",
      placeholder: "/absolute/path/to/project",
      prefill: next.cwd,
    });
    await applyPasstoAgentStageDerivedDefaults(next);
    return;
  }

  if (missingField === "stage") {
    next.stage = await ui.choose({
      title: "选择 stage",
      options: listStageNames(),
      allowOther: false,
    });
    await applyPasstoAgentStageDerivedDefaults(next);
    return;
  }

  if (missingField === "goal") {
    next.goal = await ui.prompt({
      title: "请输入 goal",
      placeholder: "Describe the task to execute",
      prefill: next.goal,
    });
    await applyPasstoAgentStageDerivedDefaults(next);
    return;
  }

  if (missingField === "task.title") {
    next.taskTitle = await ui.prompt({
      title: "请输入 task.title",
      placeholder: "Short summary of the task",
      prefill: next.taskTitle,
    });
    return;
  }

  if (missingField === "expected_output.todolist") {
    next.todolist = normalizeList(await ui.multiselect({
      title: "选择或输入 todolist",
      options: ["Execute the requested work"],
      allowOther: true,
      placeholder: "Use | to separate custom items",
    }));
    return;
  }

  if (missingField === "expected_output.checklist") {
    next.checklist = normalizeList(await ui.multiselect({
      title: "选择或输入 checklist",
      options: ["Keep the task within the requested scope"],
      allowOther: true,
      placeholder: "Use | to separate custom items",
    }));
  }
}

export async function buildPasstoAgentDraftFromText(input: string, cwd: string): Promise<PasstoAgentDraftTask> {
  const draft: PasstoAgentDraftTask = {
    stage: inferStageFromText(input),
    cwd,
    taskTitle: inferTaskTitle(input, inferStageFromText(input)),
    goal: input.trim(),
    executorType: undefined,
    constraints: [],
    todolist: ["Execute the requested work"],
    checklist: ["Keep the task within the requested scope"],
    inputs: [],
    preferredRole: undefined,
  };
  await applyPasstoAgentStageDerivedDefaults(draft);
  return draft;
}

async function confirmCriticalField(next: PasstoAgentDraftTask, field: "cwd" | "goal" | "stage", ui: PasstoAgentUiAdapter): Promise<void> {
  if (field === "cwd") {
    const confirmed = await ui.confirm({
      title: "确认 cwd",
      message: `cwd: ${next.cwd}`,
    });
    if (!confirmed) {
      next.cwd = await ui.prompt({
        title: "重新输入 cwd",
        placeholder: next.cwd || path.resolve(process.cwd()),
        prefill: next.cwd,
      });
      await applyPasstoAgentStageDerivedDefaults(next);
    }
    return;
  }

  if (field === "goal") {
    const confirmed = await ui.confirm({
      title: "确认 goal",
      message: next.goal,
    });
    if (!confirmed) {
      next.goal = await ui.prompt({
        title: "重新输入 goal",
        placeholder: next.goal,
        prefill: next.goal,
      });
      await applyPasstoAgentStageDerivedDefaults(next);
    }
    return;
  }

  const confirmed = await ui.confirm({
    title: "确认 stage",
    message: `stage: ${next.stage}`,
  });
  if (!confirmed) {
    next.stage = await ui.choose({
      title: "重新选择 stage",
      options: listStageNames(),
      allowOther: false,
    });
    await applyPasstoAgentStageDerivedDefaults(next);
  }
}

export async function completePasstoAgentDraftWithUi(draft: PasstoAgentDraftTask, ui: PasstoAgentUiAdapter): Promise<PasstoAgentDraftTask> {
  const next = cloneDraftTask(draft);

  if (!next.stage) {
    next.stage = await ui.choose({
      title: "选择 stage",
      options: listStageNames(),
      allowOther: false,
    });
  }
  await applyPasstoAgentStageDerivedDefaults(next);

  let analysis = analyzePasstoAgentDraft(next);
  for (const missingField of analysis.missingFields) {
    await askForMissingField(next, missingField, ui);
    analysis = analyzePasstoAgentDraft(next);
  }

  if (!next.taskTitle?.trim()) {
    next.taskTitle = inferTaskTitle(next.goal, next.stage);
  }
  await applyPasstoAgentStageDerivedDefaults(next);

  for (const field of analysis.confirmationRequired) {
    await confirmCriticalField(next, field, ui);
    analysis = analyzePasstoAgentDraft(next);
  }

  const finalAnalysis = analyzePasstoAgentDraft(next);
  for (const missingField of finalAnalysis.missingFields) {
    await askForMissingField(next, missingField, ui);
  }
  await applyPasstoAgentStageDerivedDefaults(next);

  return next;
}
