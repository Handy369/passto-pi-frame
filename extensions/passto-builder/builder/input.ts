import type { BuilderChecklistItem, BuilderInput } from "./contracts.ts";

export type NormalizedBuilderInput = BuilderInput & {
  task: string;
  checklist: BuilderChecklistItem[];
  expectedOutputs: string[];
  executionEngine: "ralph-loop";
};

export function normalizeBuilderInput(input: BuilderInput): NormalizedBuilderInput {
  const task = input.task ?? input.taskPackage?.tasks?.join("\n") ?? "";
  if (!input.goal?.trim()) {
    throw new Error("builder input requires goal");
  }
  if (!input.cwd?.trim()) {
    throw new Error("builder input requires cwd");
  }
  if (!task.trim()) {
    throw new Error("builder input requires task or taskPackage.tasks");
  }
  const checklist = input.checklist ?? input.taskPackage?.checklist ?? [];
  const expectedOutputs = input.expectedOutputs ?? [];
  return {
    ...input,
    task,
    checklist,
    expectedOutputs,
    executionEngine: input.executionEngine ?? "ralph-loop",
  };
}
