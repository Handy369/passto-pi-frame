import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SandboxCreateParams, SandboxHandle, SandboxManager } from "../sandbox.ts";

const execFileAsync = promisify(execFile);

async function runGit(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd });
    return stdout.trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Git command failed (${args.join(" ")}): ${message}`);
  }
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "sandbox";
}

export class WorktreeSandboxManager implements SandboxManager {
  async createPerspectiveSandbox(params: SandboxCreateParams): Promise<SandboxHandle> {
    const cleanupPolicy = params.cleanupPolicy ?? "always";
    const repoRoot = await runGit(["rev-parse", "--show-toplevel"], params.projectRoot)
      .catch(() => {
        throw new Error(`Worktree sandbox requires a git-backed project root: ${params.projectRoot}`);
      });
    const relativeProjectRoot = await runGit(["rev-parse", "--show-prefix"], params.projectRoot);
    const sourceRef = await runGit(["rev-parse", "--abbrev-ref", "HEAD"], params.projectRoot)
      .then((value) => value === "HEAD" ? "HEAD" : value)
      .catch(() => "HEAD");

    const sandboxBase = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-worktree-"));
    const worktreeName = `${sanitizePathSegment(params.runId)}-${sanitizePathSegment(params.perspective)}`;
    const worktreeRoot = path.join(sandboxBase, worktreeName);

    try {
      await runGit(["worktree", "add", "--detach", worktreeRoot], repoRoot);
    } catch (error) {
      await fs.rm(sandboxBase, { recursive: true, force: true });
      throw error;
    }

    const sandboxRoot = relativeProjectRoot ? path.join(worktreeRoot, relativeProjectRoot) : worktreeRoot;

    return {
      perspective: params.perspective,
      root: sandboxRoot,
      metadata: {
        runId: params.runId,
        perspective: params.perspective,
        projectRoot: params.projectRoot,
        strategy: "worktree",
        sandboxRoot,
        sandboxBase,
        createdAt: new Date().toISOString(),
        cleanupPolicy,
        preserveOnFailure: params.preserveOnFailure,
        repoRoot,
        worktreeRoot,
        sourceRef,
      },
      async cleanup(result = { success: true }): Promise<void> {
        const shouldPreserve = cleanupPolicy === "never"
          || (cleanupPolicy === "on-failure" && !result.success)
          || (cleanupPolicy === "on-success" && result.success)
          || (params.preserveOnFailure && !result.success);

        if (shouldPreserve) return;
        await runGit(["worktree", "remove", "--force", worktreeRoot], repoRoot);
        await fs.rm(sandboxBase, { recursive: true, force: true });
      },
    };
  }
}
