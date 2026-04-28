import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ensurePasstoProjectWorkspace } from "../../passto-executor/executor-core/project-workspace.ts";
import type { BuilderArtifactRef } from "./contracts.ts";

export function createBuilderArtifactRef(params: BuilderArtifactRef): BuilderArtifactRef {
  return { ...params };
}

export function createBuilderSummaryArtifact(summary: string): BuilderArtifactRef {
  return {
    type: "builder-summary",
    summary,
  };
}

export async function writeBuilderWorkspaceNote(params: {
  cwd: string;
  relativePath?: string;
  title: string;
  lines: string[];
}): Promise<BuilderArtifactRef> {
  const workspace = await ensurePasstoProjectWorkspace(params.cwd);
  const relativePath = params.relativePath ?? ".passto-ai/builder/implementation-note.md";
  const absolutePath = join(params.cwd, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  const content = [`# ${params.title}`, "", ...params.lines, ""].join("\n");
  await writeFile(absolutePath, content, "utf8");
  return {
    type: "workspace-note",
    path: absolutePath,
    summary: `Wrote builder workspace note to ${relativePath}`,
    metadata: {
      relativePath,
      builderDir: workspace.builderDir,
      projectMetadataPath: workspace.projectMetadataPath,
    },
  };
}
