import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export type PasstoProjectWorkspaceLayout = {
  rootDir: string;
  workspaceDir: string;
  projectMetadataPath: string;
  plannerDir: string;
  executorDir: string;
  builderDir: string;
};

export function getPasstoProjectWorkspaceLayout(cwd: string): PasstoProjectWorkspaceLayout {
  const workspaceDir = join(cwd, ".passto-ai");
  return {
    rootDir: cwd,
    workspaceDir,
    projectMetadataPath: join(workspaceDir, "project.md"),
    plannerDir: join(workspaceDir, "planner"),
    executorDir: join(workspaceDir, "executor"),
    builderDir: join(workspaceDir, "builder"),
  };
}

export async function ensurePasstoProjectWorkspace(cwd: string): Promise<PasstoProjectWorkspaceLayout> {
  const layout = getPasstoProjectWorkspaceLayout(cwd);
  await mkdir(layout.workspaceDir, { recursive: true });
  await mkdir(layout.plannerDir, { recursive: true });
  await mkdir(layout.executorDir, { recursive: true });
  await mkdir(layout.builderDir, { recursive: true });
  return layout;
}
