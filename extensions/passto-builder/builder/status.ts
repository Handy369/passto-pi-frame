import type { BuilderStateSnapshot } from "./contracts.ts";
import type { BuilderRunState } from "./state.ts";

export function toBuilderStateSnapshot(state: BuilderRunState): BuilderStateSnapshot {
  return {
    phase: state.phase,
    status: state.status,
    currentAction: state.currentAction,
    todoList: state.todoList,
    checklist: state.checklist,
    completedItems: state.completedItems,
    artifacts: state.artifacts,
    blockers: state.blockers,
    needsAttention: state.needsAttention,
    summary: state.summary,
  };
}
