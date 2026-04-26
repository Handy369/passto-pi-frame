// ============================================================
// agent-web-search-pro v2 — State Persistence Utilities
// ============================================================
import { readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentWebSearchProState, ExposureMode, SearchMode, ProviderName } from "../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATE_FILE = path.join(__dirname, "..", ".state.json");

export const DEFAULT_STATE: AgentWebSearchProState = {
  currentStep: 1,
  startedAt: new Date().toISOString(),
  exposureMode: "both",
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidState(value: unknown): value is AgentWebSearchProState {
  if (!isObject(value)) return false;
  if (typeof value.currentStep !== "number") return false;
  if (typeof value.startedAt !== "string") return false;
  if (value.exposureMode !== "both") return false;
  if ("lastQuery" in value && typeof value.lastQuery !== "string" && typeof value.lastQuery !== "undefined") return false;
  if ("lastUrl" in value && typeof value.lastUrl !== "string" && typeof value.lastUrl !== "undefined") return false;
  if ("lastSummary" in value && typeof value.lastSummary !== "string" && typeof value.lastSummary !== "undefined") return false;
  if ("lastMode" in value && typeof value.lastMode !== "undefined" && !["search", "read-url", "site-search"].includes(value.lastMode)) return false;
  if ("lastProvider" in value && typeof value.lastProvider !== "undefined" && !["tavily", "jina-reader", "curl-jina-reader", "degraded", "hybrid"].includes(value.lastProvider)) return false;
  if ("lastResultCount" in value && typeof value.lastResultCount !== "number" && typeof value.lastResultCount !== "undefined") return false;
  return true;
}

export async function loadState(): Promise<AgentWebSearchProState> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return { ...DEFAULT_STATE };
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export async function saveState(state: AgentWebSearchProState): Promise<void> {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function removeState(): Promise<void> {
  await rm(STATE_FILE, { force: true });
}
