import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { SandboxCreateParams, SandboxHandle, SandboxManager } from "../sandbox.ts";

async function copyProject(sourceRoot: string, destinationRoot: string): Promise<void> {
  await fs.cp(sourceRoot, destinationRoot, {
    recursive: true,
    force: true,
  });
}

export class TempCopySandboxManager implements SandboxManager {
  async createPerspectiveSandbox(params: SandboxCreateParams): Promise<SandboxHandle> {
    const sandboxBase = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-sandbox-"));
    const sandboxRoot = path.join(sandboxBase, path.basename(params.projectRoot));
    const cleanupPolicy = params.cleanupPolicy ?? "always";
    await copyProject(params.projectRoot, sandboxRoot);

    return {
      perspective: params.perspective,
      root: sandboxRoot,
      metadata: {
        runId: params.runId,
        perspective: params.perspective,
        projectRoot: params.projectRoot,
        strategy: "temp-copy",
        sandboxRoot,
        sandboxBase,
        createdAt: new Date().toISOString(),
        cleanupPolicy,
        preserveOnFailure: params.preserveOnFailure,
      },
      async cleanup(result = { success: true }): Promise<void> {
        const shouldPreserve = cleanupPolicy === "never"
          || (cleanupPolicy === "on-failure" && !result.success)
          || (cleanupPolicy === "on-success" && result.success)
          || (params.preserveOnFailure && !result.success);

        if (shouldPreserve) return;
        await fs.rm(sandboxBase, { recursive: true, force: true });
      },
    };
  }
}

export function toSandboxDebugUrl(root: string): string {
  return pathToFileURL(root).toString();
}
