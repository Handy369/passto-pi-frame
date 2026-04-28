// Phase 1A: Minimal planner contracts for passto-planner runtime.
// Defines the core shape for planner input, state, result, and handoff.

import type { ZodSchema } from "zod";

// ── Core Planner Types ──────────────────────────────────────────────

export type PlannerTaskId = string;
export type PlannerRunId = string;
export type PlanningPhase = "intake" | "analysis" | "synthesis" | "output";

// ── Planning Input ──────────────────────────────────────────────────

export interface PlannerRawInput {
  goal: string;
  cwd: string;
  constraints?: string[];
  expectedOutputs?: string[];
  todolist?: string[];
  stage?: string;
  [key: string]: unknown;
}

export interface PlannerNormalizedInput {
  goal: string;
  cwd: string;
  constraints: string[];
  expectedOutputs: string[];
  todolist: string[];
  stage: string;
  metadata: Record<string, unknown>;
}

// ── Planner State ───────────────────────────────────────────────────

export interface PlannerState {
  runId: PlannerRunId;
  taskId: PlannerTaskId;
  phase: PlanningPhase;
  input: PlannerNormalizedInput;
  artifacts: PlannerArtifactRef[];
  completedSteps: string[];
  summary: string;
  status: "running" | "completed" | "blocked" | "failed";
}

// ── Planner Result ──────────────────────────────────────────────────

export interface PlannerArtifactRef {
  type: string;
  path?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface PlannerResult {
  finalStatus: "success" | "failed" | "blocked" | "needs_review";
  resultSummary: string;
  producedArtifacts: PlannerArtifactRef[];
  remainingWork: string[];
  handoffNote: string;
  failureReason?: string;
  primaryRunId?: string;
}

// ── Planner Handoff ─────────────────────────────────────────────────

export interface PlannerHandoff {
  from: string;
  to: string;
  runId: PlannerRunId;
  resultSummary: string;
  artifacts: PlannerArtifactRef[];
  nextSteps: string[];
  metadata?: Record<string, unknown>;
}
