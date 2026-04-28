import fs from "node:fs/promises";
import path from "node:path";

export interface PasstoProjectWorkspaceLayout {
  projectRoot: string;
  passtoAiDir: string;
  projectMetadataPath: string;
  plannerDir: string;
  executorDir: string;
  builderDir: string;
}

export function getPasstoProjectWorkspaceLayout(projectRoot: string): PasstoProjectWorkspaceLayout {
  const passtoAiDir = path.join(projectRoot, ".passto-ai");
  return {
    projectRoot,
    passtoAiDir,
    projectMetadataPath: path.join(passtoAiDir, "project.md"),
    plannerDir: path.join(passtoAiDir, "planner"),
    executorDir: path.join(passtoAiDir, "executor"),
    builderDir: path.join(passtoAiDir, "builder"),
  };
}

export async function ensurePasstoProjectWorkspace(projectRoot: string): Promise<PasstoProjectWorkspaceLayout> {
  const layout = getPasstoProjectWorkspaceLayout(projectRoot);
  await Promise.all([
    fs.mkdir(layout.passtoAiDir, { recursive: true }),
    fs.mkdir(layout.plannerDir, { recursive: true }),
    fs.mkdir(layout.executorDir, { recursive: true }),
    fs.mkdir(layout.builderDir, { recursive: true }),
  ]);
  return layout;
}
