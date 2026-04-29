import { readPasstoAgentStageInfo } from "./stages.ts";
import type { PasstoAgentAnalysis, PasstoAgentDraftTask, PasstoAgentFieldResolution } from "./types.ts";

const CRITICAL_CONFIRMATION_FIELDS = ["cwd", "goal", "stage"] as const;

function hasValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null;
}

function buildResolution(field: string, status: PasstoAgentFieldResolution["status"], source?: PasstoAgentFieldResolution["source"]): PasstoAgentFieldResolution {
  return { field, status, source };
}

function resolveRequiredField(param: string, draft: PasstoAgentDraftTask): PasstoAgentFieldResolution {
  if (param === "project.cwd") {
    return hasValue(draft.cwd) ? buildResolution("cwd", "provided", "provided") : buildResolution("cwd", "required-user-input");
  }
  if (param === "stage") {
    return hasValue(draft.stage) ? buildResolution("stage", "provided", "provided") : buildResolution("stage", "required-user-input");
  }
  if (param === "task.title") {
    return hasValue(draft.taskTitle) ? buildResolution("task.title", "inferred", "inferred") : buildResolution("task.title", "required-user-input");
  }
  if (param === "expected_output.todolist") {
    return draft.todolist.length ? buildResolution("expected_output.todolist", "inferred", "inferred") : buildResolution("expected_output.todolist", "required-user-input");
  }
  if (param === "expected_output.checklist") {
    return draft.checklist.length ? buildResolution("expected_output.checklist", "inferred", "inferred") : buildResolution("expected_output.checklist", "required-user-input");
  }
  return buildResolution(param, "skipped");
}

function resolveOptionalField(param: string, draft: PasstoAgentDraftTask, stageInfo: ReturnType<typeof readPasstoAgentStageInfo>): PasstoAgentFieldResolution {
  // Optional fields are never blocking. If the user did not provide them,
  // passto-agent may infer them opportunistically or leave them blank.
  if (param === "executor.type") {
    return hasValue(draft.executorType)
      ? buildResolution("executor.type", "inferred", "inferred")
      : stageInfo.recommendedExecutorType
        ? buildResolution("executor.type", "inferred", "inferred")
        : buildResolution("executor.type", "skipped");
  }
  if (param === "constraints") {
    return draft.constraints.length
      ? buildResolution("constraints", "provided", "provided")
      : buildResolution("constraints", "skipped");
  }
  if (param === "inputs") {
    return draft.inputs.length
      ? buildResolution("inputs", "inferred", "inferred")
      : buildResolution("inputs", "skipped");
  }
  if (param === "hints.preferred_role") {
    return hasValue(draft.preferredRole)
      ? buildResolution("hints.preferred_role", "inferred", "inferred")
      : hasValue(draft.stage)
        ? buildResolution("hints.preferred_role", "inferred", "inferred")
        : buildResolution("hints.preferred_role", "skipped");
  }
  return buildResolution(param, "skipped");
}

export function analyzePasstoAgentDraft(draft: PasstoAgentDraftTask): PasstoAgentAnalysis {
  const stageInfo = readPasstoAgentStageInfo(draft.stage);
  const requiredResolutions = stageInfo.requiredParameters.map((param) => resolveRequiredField(param, draft));
  const optionalResolutions = stageInfo.optionalParameters.map((param) => resolveOptionalField(param, draft, stageInfo));

  const goalResolution = hasValue(draft.goal)
    ? buildResolution("goal", "provided", "provided")
    : buildResolution("goal", "required-user-input");

  const allResolutions = [...requiredResolutions, ...optionalResolutions, goalResolution];
  const missingFields = allResolutions
    .filter((item) => item.status === "required-user-input")
    .map((item) => item.field);

  return {
    stage: draft.stage,
    missingFields: Array.from(new Set(missingFields)),
    confirmationRequired: [...CRITICAL_CONFIRMATION_FIELDS],
    stageInfo,
    fieldResolutions: allResolutions,
  };
}
