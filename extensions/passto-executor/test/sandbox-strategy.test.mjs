import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { NoopSandboxManager } from "../executor-core/sandbox.ts";
import { TempCopySandboxManager } from "../executor-core/sandbox/temp-copy-sandbox.ts";
import { WorktreeSandboxManager } from "../executor-core/sandbox/worktree-sandbox.ts";
import { StrategySandboxManager } from "../executor-core/sandbox/strategy-manager.ts";

test("StrategySandboxManager selects the configured default strategy", async () => {
  const manager = new StrategySandboxManager({
    defaultStrategy: "noop",
    strategies: [
      { name: "noop", manager: new NoopSandboxManager() },
      { name: "temp-copy", manager: new TempCopySandboxManager() },
    ],
  });

  const handle = await manager.createPerspectiveSandbox({
    runId: "run-strategy-default",
    perspective: "builder",
    projectRoot: "/tmp/project",
  });

  assert.equal(handle.metadata.strategy, "noop");
  assert.equal(handle.root, "/tmp/project");
  await handle.cleanup({ success: true });
});

test("StrategySandboxManager can select a non-default strategy explicitly", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-strategy-project-"));
  await fs.writeFile(path.join(projectRoot, "hello.txt"), "hello\n", "utf-8");

  const manager = new StrategySandboxManager({
    defaultStrategy: "noop",
    strategies: [
      { name: "noop", manager: new NoopSandboxManager() },
      { name: "temp-copy", manager: new TempCopySandboxManager() },
    ],
  });

  const handle = await manager.createPerspectiveSandbox({
    runId: "run-strategy-explicit",
    perspective: "reviewer",
    projectRoot,
    strategy: "temp-copy",
  });

  assert.equal(handle.metadata.strategy, "temp-copy");
  await handle.cleanup({ success: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

test("StrategySandboxManager can route to the worktree strategy explicitly", async () => {
  const projectRoot = await fs.mkdtemp(path.join(os.tmpdir(), "passto-executor-worktree-strategy-project-"));
  await fs.writeFile(path.join(projectRoot, "hello.txt"), "hello\n", "utf-8");
  await import("node:child_process").then(async ({ execFile }) => {
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync("git", ["init", "-b", "main"], { cwd: projectRoot });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: projectRoot });
    await execFileAsync("git", ["config", "user.name", "Passto Test"], { cwd: projectRoot });
    await execFileAsync("git", ["add", "."], { cwd: projectRoot });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: projectRoot });
  });

  const manager = new StrategySandboxManager({
    defaultStrategy: "noop",
    strategies: [
      { name: "noop", manager: new NoopSandboxManager() },
      { name: "temp-copy", manager: new TempCopySandboxManager() },
      { name: "worktree", manager: new WorktreeSandboxManager() },
    ],
  });

  const handle = await manager.createPerspectiveSandbox({
    runId: "run-strategy-worktree",
    perspective: "reviewer",
    projectRoot,
    strategy: "worktree",
  });

  assert.equal(handle.metadata.strategy, "worktree");
  assert.ok(handle.metadata.worktreeRoot);
  await handle.cleanup({ success: true });
  await fs.rm(projectRoot, { recursive: true, force: true });
});

test("StrategySandboxManager rejects unknown strategies", async () => {
  const manager = new StrategySandboxManager({
    defaultStrategy: "noop",
    strategies: [{ name: "noop", manager: new NoopSandboxManager() }],
  });

  await assert.rejects(
    () => manager.createPerspectiveSandbox({
      runId: "run-strategy-missing",
      perspective: "builder",
      projectRoot: "/tmp/project",
      strategy: "missing",
    }),
    /Unknown sandbox strategy: missing/,
  );
});
