import fs from "node:fs";
import path from "node:path";
import { readPasstoAgentStageInfo } from "./stages.ts";
import type { PasstoAgentDraftTask, PasstoAgentTaskInput } from "./types.ts";

const EXPLICIT_PATH_PATTERN = /((?:\/|\.{1,2}\/)[^\s]+\.(?:md|txt|json|ts|tsx|js|jsx|mjs|cjs|py|sh))/g;

export type PasstoAgentMarkdownStructure = {
  constraints: string[];
  todolist: string[];
  checklist: string[];
};

export type PasstoAgentMarkdownExtractor = (params: {
  filePath: string;
  raw: string;
}) => Promise<PasstoAgentMarkdownStructure>;

let passtoAgentMarkdownExtractor: PasstoAgentMarkdownExtractor | undefined;

export function setPasstoAgentMarkdownExtractor(extractor: PasstoAgentMarkdownExtractor | undefined) {
  passtoAgentMarkdownExtractor = extractor;
}

function toAbsolutePath(cwd: string, candidate: string): string {
  return path.isAbsolute(candidate) ? candidate : path.resolve(cwd, candidate);
}

export function inferPasstoAgentInputsFromText(input: string, cwd: string): PasstoAgentTaskInput[] {
  const matches = Array.from(input.matchAll(EXPLICIT_PATH_PATTERN));
  const unique = new Set<string>();
  const inputs: PasstoAgentTaskInput[] = [];

  for (const match of matches) {
    const rawPath = match[1]?.trim();
    if (!rawPath) continue;
    const absPath = toAbsolutePath(cwd, rawPath);
    if (unique.has(absPath)) continue;
    unique.add(absPath);
    inputs.push({
      kind: "file",
      path: absPath,
      label: path.basename(absPath),
      required: true,
    });
  }

  return inputs;
}

export function inferPasstoAgentConstraintSignalsFromText(input: string): string[] {
  const lower = input.toLowerCase();
  const inferred: string[] = [];
  if (/(不要改|不要修改|不要动|do not modify|do not change)/i.test(input)) {
    inferred.push("Do not modify unrelated files");
  }
  if (/(不要加依赖|不要新增依赖|do not add new dependencies)/i.test(input)) {
    inferred.push("Do not add new dependencies");
  }
  if (/(只 review|只审查|review 当前改动|review current diff)/i.test(input)) {
    inferred.push("Only review the requested scope");
  }
  if (/(最小修改|minimal patch|minimal change)/i.test(lower)) {
    inferred.push("Prefer minimal changes over broad refactors");
  }
  return inferred;
}

function parseFallbackBulletList(raw: string, headingPattern: RegExp): string[] {
  const lines = raw.split(/\r?\n/);
  const items: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (headingPattern.test(line.trim())) {
      inSection = true;
      continue;
    }
    if (inSection && /^#{1,6}\s+/.test(line.trim())) break;
    if (!inSection) continue;
    const match = line.match(/^\s*[-*]\s+(.+)$/);
    if (match?.[1]?.trim()) items.push(match[1].trim().replace(/^"|"$/g, ""));
  }

  return items;
}

function fallbackInferPasstoAgentStructureFromMarkdownPath(filePath: string): PasstoAgentMarkdownStructure {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return {
      constraints: parseFallbackBulletList(raw, /^#{1,6}\s*(constraints|约束)\s*$/i),
      todolist: parseFallbackBulletList(raw, /^#{1,6}\s*(todolist|todo list|steps|步骤)\s*$/i),
      checklist: parseFallbackBulletList(raw, /^#{1,6}\s*(checklist|验收|检查项)\s*$/i),
    };
  } catch {
    return { constraints: [], todolist: [], checklist: [] };
  }
}

async function inferPasstoAgentStructureFromMarkdownPath(filePath: string): Promise<PasstoAgentMarkdownStructure> {
  if (!fs.existsSync(filePath)) {
    return { constraints: [], todolist: [], checklist: [] };
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  if (!passtoAgentMarkdownExtractor) {
    return fallbackInferPasstoAgentStructureFromMarkdownPath(filePath);
  }

  try {
    const extracted = await passtoAgentMarkdownExtractor({ filePath, raw });
    return {
      constraints: extracted.constraints.filter((item) => item.trim().length > 0),
      todolist: extracted.todolist.filter((item) => item.trim().length > 0),
      checklist: extracted.checklist.filter((item) => item.trim().length > 0),
    };
  } catch {
    return fallbackInferPasstoAgentStructureFromMarkdownPath(filePath);
  }
}

export async function applyPasstoAgentStageDerivedDefaults(next: PasstoAgentDraftTask) {
  const stageInfo = readPasstoAgentStageInfo(next.stage);
  if (!next.executorType && stageInfo.recommendedExecutorType) next.executorType = stageInfo.recommendedExecutorType;
  if (!next.preferredRole) next.preferredRole = next.stage;
  if (!next.taskTitle?.trim()) {
    const compact = next.goal.trim().split(/\r?\n/)[0]?.trim() || `${next.stage} task`;
    next.taskTitle = compact.length > 80 ? compact.slice(0, 80) : compact;
  }
  if (!next.constraints.length && next.stage === "builder") {
    next.constraints = ["Keep the task within the requested scope", ...inferPasstoAgentConstraintSignalsFromText(next.goal)];
  }
  if (!next.inputs.length) {
    next.inputs = inferPasstoAgentInputsFromText(next.goal, next.cwd);
  }

  const markdownInputs = next.inputs.filter((item) => item.path?.endsWith(".md"));
  for (const markdownInput of markdownInputs) {
    if (!markdownInput.path) continue;
    const derived = await inferPasstoAgentStructureFromMarkdownPath(markdownInput.path);
    if (derived.constraints.length) {
      const merged = new Set([...next.constraints, ...derived.constraints]);
      next.constraints = Array.from(merged);
    }
    if (next.todolist.length === 1 && next.todolist[0] === "Execute the requested work" && derived.todolist.length) next.todolist = derived.todolist;
    if (next.checklist.length === 1 && next.checklist[0] === "Keep the task within the requested scope" && derived.checklist.length) next.checklist = derived.checklist;
  }
}
