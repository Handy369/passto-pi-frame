import * as fs from "node:fs";
import * as path from "node:path";
import type { PlannerRunId } from "./contracts.ts";

export interface PlannerSessionState {
  sessionId: string;
  runId: PlannerRunId;
  target: string;
  planningDir: string;
  currentStep: number;
  totalSteps: number;
  startedAt: string;
  updatedAt: string;
  artifacts: string[];
  status: "active" | "completed" | "cancelled";
  history: Array<{
    step: number;
    summary?: string;
    at: string;
    action: "start" | "next" | "back" | "done" | "status";
  }>;
  metadata?: Record<string, unknown>;
}

export interface CreatePlannerSessionInput {
  target: string;
  planningDir: string;
  currentStep: number;
  totalSteps: number;
  artifacts?: string[];
  startedAt?: string;
  runId?: PlannerRunId;
  metadata?: Record<string, unknown>;
}

const SESSION_FILE = ".passto-planner-session.json";
const LEGACY_STATE_FILE = ".passto-planner-state.json";

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function readJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function getPlannerSessionPath(planningDir: string): string {
  return path.join(planningDir, SESSION_FILE);
}

export function getLegacyPlannerStatePath(planningDir: string): string {
  return path.join(planningDir, LEGACY_STATE_FILE);
}

function toLegacyState(session: PlannerSessionState) {
  return {
    target: session.target,
    planningDir: session.planningDir,
    currentStep: session.currentStep,
    startedAt: session.startedAt,
    artifacts: session.artifacts,
  };
}

function fromLegacyState(legacy: {
  target?: string;
  planningDir?: string;
  currentStep?: number;
  startedAt?: string;
  artifacts?: string[];
}, planningDir: string): PlannerSessionState | null {
  if (!legacy?.planningDir && !planningDir) return null;
  const now = new Date().toISOString();
  const resolvedPlanningDir = legacy.planningDir ?? planningDir;
  return {
    sessionId: `planner-session-${path.basename(resolvedPlanningDir)}-${Date.now()}`,
    runId: `planner-${Date.now()}`,
    target: legacy.target ?? resolvedPlanningDir,
    planningDir: resolvedPlanningDir,
    currentStep: legacy.currentStep ?? 1,
    totalSteps: 17,
    startedAt: legacy.startedAt ?? now,
    updatedAt: now,
    artifacts: Array.isArray(legacy.artifacts) ? legacy.artifacts : [],
    status: "active",
    history: [{ step: legacy.currentStep ?? 1, at: now, action: "start", summary: "Migrated from legacy planner state" }],
    metadata: { migratedFromLegacyState: true },
  };
}

export function createPlannerSession(input: CreatePlannerSessionInput): PlannerSessionState {
  const now = input.startedAt ?? new Date().toISOString();
  return {
    sessionId: `planner-session-${path.basename(input.planningDir)}-${Date.now()}`,
    runId: input.runId ?? `planner-${Date.now()}`,
    target: input.target,
    planningDir: input.planningDir,
    currentStep: input.currentStep,
    totalSteps: input.totalSteps,
    startedAt: now,
    updatedAt: now,
    artifacts: [...(input.artifacts ?? [])],
    status: "active",
    history: [{ step: input.currentStep, at: now, action: "start" }],
    metadata: input.metadata,
  };
}

export function loadPlannerSession(planningDir: string): PlannerSessionState | null {
  const sessionPath = getPlannerSessionPath(planningDir);
  const direct = readJson<PlannerSessionState>(sessionPath);
  if (direct) return direct;

  const legacyPath = getLegacyPlannerStatePath(planningDir);
  const legacy = readJson<{
    target?: string;
    planningDir?: string;
    currentStep?: number;
    startedAt?: string;
    artifacts?: string[];
  }>(legacyPath);
  if (!legacy) return null;

  const migrated = fromLegacyState(legacy, planningDir);
  if (!migrated) return null;
  savePlannerSession(migrated);
  return migrated;
}

export function savePlannerSession(session: PlannerSessionState): void {
  const normalized: PlannerSessionState = {
    ...session,
    updatedAt: new Date().toISOString(),
    artifacts: Array.from(new Set(session.artifacts)),
  };
  writeJson(getPlannerSessionPath(session.planningDir), normalized);
  writeJson(getLegacyPlannerStatePath(session.planningDir), toLegacyState(normalized));
}

export function updatePlannerSession(
  planningDir: string,
  updater: (session: PlannerSessionState) => PlannerSessionState,
): PlannerSessionState | null {
  const current = loadPlannerSession(planningDir);
  if (!current) return null;
  const updated = updater(current);
  savePlannerSession(updated);
  return updated;
}

export function closePlannerSession(planningDir: string, status: "completed" | "cancelled" = "completed"): PlannerSessionState | null {
  const current = loadPlannerSession(planningDir);
  if (!current) return null;
  const updated: PlannerSessionState = {
    ...current,
    status,
    updatedAt: new Date().toISOString(),
    history: [...current.history, { step: current.currentStep, at: new Date().toISOString(), action: "done" }],
  };
  savePlannerSession(updated);
  return updated;
}

export function removePlannerSession(planningDir: string): void {
  const paths = [getPlannerSessionPath(planningDir), getLegacyPlannerStatePath(planningDir)];
  for (const filePath of paths) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
