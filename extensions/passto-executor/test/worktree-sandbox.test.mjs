import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { WorktreeSandboxManager } from "../executor-core/sandbox/worktree-sandbox.ts";

const execFileAsync = promisify(execFile);

async function git(cwd, ...args) {
  await execFileAsync("git", args, { cwd });
}

async function createGitProject() {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-worktree-project-"));
  await git(projectRoot, "init", "-b", "main");
  await git(projectRoot, "config", "user.email", "test@example.com");
  await git(projectRoot, "config", "user.name", "Passto Test");
  await fs.writeFile(path.join(projectRoot, "hello.txt"), "hello worktree\n", "utf-8");
  await git(projectRoot, "add", ".");
  await git(projectRoot, "commit", "-m", "init");
  return projectRoot;
}

test("WorktreeSandboxManager creates a git worktree with provenance metadata and cleans it up", async () => {
  const projectRoot = await createGitProject();
  const manager = new WorktreeSandboxManager();

  const handle = await manager.createPerspectiveSandbox({
    runId: "run-worktree",
    perspective: "builder",
    projectRoot,
  });

  assert.notEqual(handle.root, projectRoot);
  assert.equal(handle.metadata.strategy, "worktree");
  assert.equal(handle.metadata.projectRoot, projectRoot);
  assert.equal(await fs.realpath(handle.metadata.repoRoot), await fs.realpath(projectRoot));
  assert.ok(handle.metadata.worktreeRoot);
  assert.ok(handle.metadata.sourceRef);
  assert.equal(await fs.readFile(path.join(handle.root, "hello.txt"), "utf-8"), "hello worktree\n");

  await handle.cleanup({ success: true });
  await assert.rejects(() => fs.access(handle.metadata.worktreeRoot), /ENOENT/);
  await fs.rm(projectRoot, { recursive: true, force: true });
});

test("WorktreeSandboxManager preserves failed worktrees when configured", async () => {
  const projectRoot = await createGitProject();
  const manager = new WorktreeSandboxManager();

  const handle = await manager.createPerspectiveSandbox({
    runId: "run-worktree-preserve",
    perspective: "reviewer",
    projectRoot,
    cleanupPolicy: "on-failure",
  });

  await handle.cleanup({ success: false });
  await fs.access(handle.root);

  await execFileAsync("git", ["worktree", "remove", "--force", handle.metadata.worktreeRoot], { cwd: projectRoot });
  await fs.rm(handle.metadata.sandboxBase, { recursive: true, force: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

test("WorktreeSandboxManager rejects non-git project roots explicitly", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-nongit-project-"));
  const manager = new WorktreeSandboxManager();

  await assert.rejects(
    () => manager.createPerspectiveSandbox({
      runId: "run-worktree-nongit",
      perspective: "builder",
      projectRoot,
    }),
    /requires a git-backed project root/,
  );

  await fs.rm(projectRoot, { recursive: true, force: true });
});
