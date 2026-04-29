import fs from "node:fs";
import path from "node:path";

const STAGES_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "stages");

export interface ExecutorStageRegistryEntry {
  name: string;
  stageDir: string;
  stageDocPath: string;
}

function listStageDirectories(): string[] {
  try {
    return fs.readdirSync(STAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

export function getExecutorStagesDir(): string {
  return STAGES_DIR;
}

export function listExecutorStageRegistry(): ExecutorStageRegistryEntry[] {
  return listStageDirectories()
    .map((name) => ({
      name,
      stageDir: path.join(STAGES_DIR, name),
      stageDocPath: path.join(STAGES_DIR, name, "stage.md"),
    }))
    .filter((entry) => fs.existsSync(entry.stageDocPath));
}

export function listExecutorStageNames(): string[] {
  return listExecutorStageRegistry().map((entry) => entry.name);
}

export function isKnownExecutorStage(stageName: string): boolean {
  return listExecutorStageNames().includes(stageName);
}

export function getExecutorStageDocPath(stageName: string): string | undefined {
  return listExecutorStageRegistry().find((entry) => entry.name === stageName)?.stageDocPath;
}
