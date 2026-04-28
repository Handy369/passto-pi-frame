import type { BuilderArtifactRef, BuilderChecklistItem, BuilderStatus } from "./contracts.ts";
import type { BuilderPhaseName } from "./phases.ts";
import type { NormalizedBuilderInput } from "./input.ts";

export type BuilderRunState = {
  input: NormalizedBuilderInput;
  phase: BuilderPhaseName;
  status: BuilderStatus;
  currentAction: string;
  todoList: string[];
  checklist: BuilderChecklistItem[];
  completedItems: string[];
  artifacts: BuilderArtifactRef[];
  blockers: string[];
  needsAttention: boolean;
  summary: string;
};

export function createInitialBuilderState(input: NormalizedBuilderInput): BuilderRunState {
  return {
    input,
    phase: "prepare",
    status: "starting",
    currentAction: "Initializing builder run",
    todoList: [],
    checklist: input.checklist,
    completedItems: [],
    artifacts: [],
    blockers: [],
    needsAttention: false,
    summary: "Builder run created",
  };
}
