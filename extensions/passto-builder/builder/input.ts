import type { BuilderChecklistItem, BuilderInput } from "./contracts.ts";

export type NormalizedBuilderInput = BuilderInput & {
  executionPrompt: string;
  checklist: BuilderChecklistItem[];
  expectedOutputs: string[];
  todolist: string[];
  executionEngine: "ralph-loop";
};

export function normalizeBuilderInput(input: BuilderInput): NormalizedBuilderInput {
  const executionPrompt = input.executionPrompt ?? input.task ?? input.taskPackage?.tasks?.join("\n") ?? input.goal ?? "";
  if (!input.goal?.trim()) {
    throw new Error("builder input requires goal");
  }
  if (!input.cwd?.trim()) {
    throw new Error("builder input requires cwd");
  }
  if (!executionPrompt.trim()) {
    throw new Error("builder input requires executionPrompt, task, taskPackage.tasks, or goal");
  }
  const checklist = input.checklist ?? input.taskPackage?.checklist ?? [];
  const expectedOutputs = input.expectedOutputs ?? [];
  const todolist = input.todolist ?? [];
  return {
    ...input,
    executionPrompt,
    checklist,
    expectedOutputs,
    todolist,
    executionEngine: input.executionEngine ?? "ralph-loop",
  };
}
